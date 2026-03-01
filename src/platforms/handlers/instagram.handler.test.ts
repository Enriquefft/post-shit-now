/**
 * Handler-level tests for InstagramHandler covering:
 * - Single post publish (image, reel, carousel)
 * - Error paths (missing credentials, missing token, missing accountId, daily limit)
 * - Rate limit tracking (self-counting updates after publish)
 *
 * Tests go through the public publish() method only -- no private method access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("@trigger.dev/sdk", () => ({
	wait: { until: async () => {} },
	logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

vi.mock("../../core/utils/publisher-factory.ts", () => ({
	registerHandler: () => {},
}));

vi.mock("../instagram/client.ts", () => {
	const { MockInstagramClient } = require("../__mocks__/clients.ts");
	return { InstagramClient: MockInstagramClient };
});

vi.mock("../instagram/oauth.ts", () => ({
	refreshInstagramToken: async () => ({
		accessToken: "refreshed",
		expiresIn: 5184000,
	}),
}));

vi.mock("../../core/utils/crypto.ts", () => ({
	decrypt: (val: string) => val,
	encrypt: (val: string) => val,
}));

vi.mock("../instagram/media.ts", () => ({
	createImageContainer: async (_client: unknown, _url: string, _caption: string) => ({
		id: "container_1",
	}),
	createReelsContainer: async (_client: unknown, _url: string, _caption: string) => ({
		id: "container_1",
	}),
	createCarouselContainers: async (_client: unknown, _urls: string[], _caption: string) => ({
		id: "container_1",
	}),
	waitForContainerReady: async () => {},
	publishContainer: async (_client: unknown, _containerId: string) => ({
		id: "ig_media_123",
	}),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPost(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "post-001",
		userId: "user-001",
		platform: "instagram",
		content: "Check out this photo!",
		status: "scheduled",
		subStatus: null,
		approvalStatus: null,
		metadata: null,
		mediaUrls: ["https://example.com/img.jpg"],
		seriesId: null,
		externalPostId: null,
		publishedAt: null,
		failReason: null,
		language: null,
		parentPostId: null,
		threadPosition: null,
		triggerRunId: null,
		platformPostIds: null,
		reviewerId: null,
		reviewComment: null,
		reviewedAt: null,
		scheduledAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

const DEFAULT_OAUTH_TOKEN = {
	id: "token-001",
	userId: "user-001",
	platform: "instagram",
	accessToken: "encrypted_access_token",
	refreshToken: null,
	expiresAt: new Date(Date.now() + 3600_000), // not expired
	scopes: "instagram_basic,instagram_content_publish",
	metadata: { accountId: "ig_12345" },
	createdAt: new Date(),
	updatedAt: new Date(),
};

function buildMockDb(
	options: {
		noToken?: boolean;
		tokenMetadata?: Record<string, unknown>;
		todayPostCount?: number;
	} = {},
) {
	const tokenRow = options.noToken
		? []
		: [
				{
					...DEFAULT_OAUTH_TOKEN,
					metadata: options.tokenMetadata ?? DEFAULT_OAUTH_TOKEN.metadata,
				},
			];

	const todayPosts = Array.from({ length: options.todayPostCount ?? 0 }, (_, i) => ({
		id: `post-today-${i}`,
		platform: "instagram",
		status: "published",
	}));

	// InstagramHandler calls:
	// 1. select().from(oauthTokens).where().limit() — returns token row
	// 2. select().from(posts).where() — returns today's posts (no .limit())
	let selectCallCount = 0;

	const mockDb = {
		select: vi.fn().mockImplementation(() => {
			selectCallCount++;
			const callNum = selectCallCount;
			return {
				from: vi.fn().mockImplementation(() => {
					if (callNum === 1) {
						// OAuth token query
						return {
							where: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue(tokenRow),
							}),
						};
					}
					// Posts query (daily limit check) — no .limit()
					return {
						where: vi.fn().mockResolvedValue(todayPosts),
					};
				}),
			};
		}),
		execute: vi.fn().mockResolvedValue(undefined),
	};

	return mockDb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("InstagramHandler", () => {
	let InstagramHandler: new () => {
		publish: (
			db: unknown,
			post: unknown,
			encKey: Buffer,
		) => Promise<{
			platform: string;
			status: string;
			externalPostId?: string;
			error?: string;
		}>;
		getRateLimitInfo: () => { limit: number; remaining: number; resetAt: Date } | null;
	};

	beforeEach(async () => {
		process.env.INSTAGRAM_APP_ID = "test_app_id";
		process.env.INSTAGRAM_APP_SECRET = "test_app_secret";
		const mod = await import("./instagram.handler.ts");
		InstagramHandler = mod.InstagramHandler as typeof InstagramHandler;
	});

	afterEach(() => {
		delete process.env.INSTAGRAM_APP_ID;
		delete process.env.INSTAGRAM_APP_SECRET;
		vi.clearAllMocks();
	});

	describe("single post publish", () => {
		it("publishes image post successfully", async () => {
			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("ig_media_123");
			expect(result.platform).toBe("instagram");
		});

		it("publishes reel successfully", async () => {
			const handler = new InstagramHandler();
			const post = buildPost({
				mediaUrls: ["https://example.com/video.mp4"],
				metadata: { instagramFormat: "reel" },
			});
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("ig_media_123");
		});

		it("publishes carousel successfully", async () => {
			const handler = new InstagramHandler();
			const post = buildPost({
				mediaUrls: [
					"https://example.com/img1.jpg",
					"https://example.com/img2.jpg",
					"https://example.com/img3.jpg",
				],
				metadata: { instagramFormat: "carousel" },
			});
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("ig_media_123");
		});
	});

	describe("error paths", () => {
		it("fails when INSTAGRAM_APP_ID missing", async () => {
			delete process.env.INSTAGRAM_APP_ID;
			delete process.env.INSTAGRAM_APP_SECRET;

			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toContain("not set");
		});

		it("fails when no OAuth token found", async () => {
			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb({ noToken: true });
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toBe("no_instagram_oauth_token");
		});

		it("fails when accountId missing from metadata", async () => {
			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb({ tokenMetadata: {} });
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toBe("instagram_account_id_not_in_token_metadata");
		});

		it("fails when daily post limit reached", async () => {
			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb({ todayPostCount: 25 });
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toContain("daily_limit");
		});
	});

	describe("rate limiting", () => {
		it("updates rate limit info after successful publish", async () => {
			const handler = new InstagramHandler();
			const post = buildPost();
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			// Before publish, rate limit should be null
			expect(handler.getRateLimitInfo()).toBeNull();

			await handler.publish(db as unknown as never, post as never, encKey);

			const rateLimit = handler.getRateLimitInfo();
			expect(rateLimit).not.toBeNull();
			expect(rateLimit!.limit).toBe(200);
			// 200 - 3 = 197 (3 API calls per publish cycle)
			expect(rateLimit!.remaining).toBe(197);
			expect(rateLimit!.resetAt).toBeInstanceOf(Date);
		});
	});
});
