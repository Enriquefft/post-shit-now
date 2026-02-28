/**
 * Integration tests for the refactored publish-post orchestration layer.
 *
 * Tests verify:
 * - Handler factory dispatch (createHandler is called per platform)
 * - Multi-platform dispatch with independent results
 * - Partial failure isolation (one platform fails, others succeed)
 * - Approval gate for company posts
 * - Idempotency check (non-publishable status is skipped)
 * - All platforms failed → markFailed path
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Platform } from "../core/types/index.ts";
import type { PlatformPublisher, RateLimitInfo } from "../core/types/publisher.ts";
import { registerHandler, unregisterHandler } from "../core/utils/publisher-factory.ts";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock Trigger.dev SDK — task() must be intercepted before publish-post.ts runs
vi.mock("@trigger.dev/sdk", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	task: vi.fn((config: { id: string; run: (...args: unknown[]) => unknown }) => config),
	wait: { until: vi.fn() },
}));

// Mock notification dispatcher (fire-and-forget side effect)
vi.mock("./notification-dispatcher.ts", () => ({
	notificationDispatcherTask: { trigger: vi.fn().mockResolvedValue(undefined) },
}));

// Mock the handler barrel exports to prevent real handler registration side-effects.
// Tests register their own mock handlers via registerHandler() instead.
vi.mock("../platforms/handlers/index.ts", () => ({}));

// Mock publish-helpers (DB side effects isolated from unit tests)
vi.mock("./publish-helpers.ts", () => ({
	markFailed: vi.fn().mockResolvedValue(undefined),
	advanceSeriesState: vi.fn().mockResolvedValue(undefined),
	updateBrandPreferenceIfCompany: vi.fn().mockResolvedValue(undefined),
}));

// Mock DB connection
vi.mock("../core/db/connection.ts", () => ({
	createHubConnection: vi.fn(),
}));

// Mock crypto
vi.mock("../core/utils/crypto.ts", () => ({
	keyFromHex: vi.fn(() => Buffer.from("0".repeat(64), "hex")),
	decrypt: vi.fn((val: string) => val),
	encrypt: vi.fn((val: string) => val),
}));

// ─── Fixture Helpers ─────────────────────────────────────────────────────────

/** Create a mock PlatformPublisher that always returns published */
function createSuccessHandler(platform: Platform): new () => PlatformPublisher {
	return class implements PlatformPublisher {
		async publish() {
			return { platform, status: "published" as const, externalPostId: `ext-${platform}-123` };
		}
		async validateCredentials() {
			return true;
		}
		getRateLimitInfo(): RateLimitInfo | null {
			return null;
		}
		async refreshCredentials() {}
		isRateLimited() {
			return false;
		}
		getRetryAfter() {
			return 0;
		}
	};
}

/** Create a mock PlatformPublisher that always returns failed */
function createFailHandler(platform: Platform, error = "mock_error"): new () => PlatformPublisher {
	return class implements PlatformPublisher {
		async publish() {
			return { platform, status: "failed" as const, error };
		}
		async validateCredentials() {
			return false;
		}
		getRateLimitInfo(): RateLimitInfo | null {
			return null;
		}
		async refreshCredentials() {}
		isRateLimited() {
			return false;
		}
		getRetryAfter() {
			return 0;
		}
	};
}

/** Build a minimal post row fixture */
function buildPost(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "post-123",
		userId: "user-456",
		platform: "x",
		content: "Hello world",
		status: "scheduled",
		subStatus: null,
		approvalStatus: null,
		metadata: null,
		mediaUrls: [],
		seriesId: null,
		externalPostId: null,
		publishedAt: null,
		failReason: null,
		scheduledAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

/** Build a mock DB that returns a given post row */
function buildMockDb(post: ReturnType<typeof buildPost> | null) {
	const mockLimit = vi.fn().mockResolvedValue(post ? [post] : []);
	const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
	const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
	const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
	const mockSetWhere = vi.fn().mockResolvedValue(undefined);
	const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
	const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

	return { select: mockSelect, update: mockUpdate } as unknown as ReturnType<
		typeof import("../core/db/connection.ts").createHubConnection
	>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("publish-post orchestration layer", () => {
	const ALL_PLATFORMS: Platform[] = ["x", "linkedin", "instagram", "tiktok"];

	beforeEach(() => {
		process.env.DATABASE_URL = "postgres://test";
		process.env.HUB_ENCRYPTION_KEY = "0".repeat(64);
		for (const p of ALL_PLATFORMS) unregisterHandler(p);
	});

	afterEach(() => {
		for (const p of ALL_PLATFORMS) unregisterHandler(p);
		vi.clearAllMocks();
	});

	it("dispatches to handler via factory and returns published", async () => {
		registerHandler("x", createSuccessHandler("x"));

		const { createHubConnection } = await import("../core/db/connection.ts");
		const post = buildPost();
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(post) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run({
			postId: "post-123",
			targetPlatforms: ["x"],
		});

		expect(result).toMatchObject({ status: "published" });
	});

	it("skips post not found", async () => {
		const { createHubConnection } = await import("../core/db/connection.ts");
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(null) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run({
			postId: "nonexistent",
		});

		expect(result).toMatchObject({ status: "skipped", reason: "post_not_found" });
	});

	it("skips post with non-publishable status (idempotency check)", async () => {
		const { createHubConnection } = await import("../core/db/connection.ts");
		const post = buildPost({ status: "published" });
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(post) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run({
			postId: "post-123",
		});

		expect(result).toMatchObject({ status: "skipped", reason: "invalid_status_published" });
	});

	it("handles partial failure when one platform fails", async () => {
		registerHandler("x", createSuccessHandler("x"));
		registerHandler("linkedin", createFailHandler("linkedin", "linkedin_error"));

		const { createHubConnection } = await import("../core/db/connection.ts");
		const post = buildPost();
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(post) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = (await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run(
			{
				postId: "post-123",
				targetPlatforms: ["x", "linkedin"],
			},
		)) as {
			status: string;
			partialFailure: boolean;
			results: Array<{ platform: string; status: string }>;
		};

		expect(result.status).toBe("published");
		expect(result.partialFailure).toBe(true);
		expect(result.results).toHaveLength(2);
	});

	it("marks failed when all platforms fail", async () => {
		registerHandler("x", createFailHandler("x", "x_error"));

		const { createHubConnection } = await import("../core/db/connection.ts");
		const post = buildPost();
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(post) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run({
			postId: "post-123",
			targetPlatforms: ["x"],
		});

		expect(result).toMatchObject({ status: "failed" });
		const { markFailed } = await import("./publish-helpers.ts");
		expect(markFailed).toHaveBeenCalled();
	});

	it("skips company post not yet approved (submitted status)", async () => {
		const { createHubConnection } = await import("../core/db/connection.ts");
		const post = buildPost({ approvalStatus: "submitted", metadata: { hubId: "hub-789" } });
		vi.mocked(createHubConnection).mockReturnValue(
			buildMockDb(post) as ReturnType<typeof createHubConnection>,
		);

		const { publishPost } = await import("./publish-post.ts");
		const result = await (publishPost as unknown as { run: (p: unknown) => Promise<unknown> }).run({
			postId: "post-123",
		});

		expect(result).toMatchObject({ status: "skipped", reason: "unapproved_at_scheduled_time" });
	});
});
