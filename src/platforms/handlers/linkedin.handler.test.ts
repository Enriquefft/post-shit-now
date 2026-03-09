/**
 * Handler-level tests for LinkedInHandler covering:
 * - Author URN resolution: org URN from metadata vs person URN fallback
 * - Propagation of author URN to post creation AND media uploads
 *
 * Tests go through the public publish() method only.
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

vi.mock("../../core/utils/crypto.ts", () => ({
	decrypt: (val: string) => val,
	encrypt: (val: string) => val,
	keyFromHex: (hex: string) => Buffer.from(hex, "hex"),
}));

vi.mock("../linkedin/oauth.ts", () => ({
	createLinkedInOAuthClient: () => ({}),
	refreshAccessToken: async () => ({
		accessToken: "new_access",
		refreshToken: "new_refresh",
		expiresAt: new Date(Date.now() + 3600_000),
	}),
	LINKEDIN_CALLBACK_URL: "http://127.0.0.1:18923/callback",
}));

// Track which author URN is passed to createTextPost and initializeImageUpload
const createTextPostSpy = vi.fn().mockResolvedValue("urn:li:share:text123");
const createImagePostSpy = vi.fn().mockResolvedValue("urn:li:share:img123");
const initImageUploadSpy = vi.fn().mockResolvedValue({
	uploadUrl: "https://upload.example.com",
	imageUrn: "urn:li:image:uploaded1",
	expiresAt: Date.now() + 60_000,
});

vi.mock("../linkedin/client.ts", () => {
	class MockLinkedInClient {
		createTextPost = createTextPostSpy;
		createImagePost = createImagePostSpy;
	}
	return { LinkedInClient: MockLinkedInClient };
});

vi.mock("../linkedin/media.ts", () => ({
	initializeImageUpload: (...args: unknown[]) => initImageUploadSpy(...args),
	uploadImageBinary: async () => {},
	initializeDocumentUpload: async () => ({
		uploadUrl: "https://upload.example.com",
		documentUrn: "urn:li:document:doc1",
		expiresAt: Date.now() + 60_000,
	}),
	uploadDocumentBinary: async () => {},
	waitForMediaReady: async () => {},
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_OAUTH_TOKEN = {
	id: "token-001",
	userId: "user-001",
	platform: "linkedin",
	accessToken: "encrypted_access_token",
	refreshToken: "encrypted_refresh_token",
	expiresAt: new Date(Date.now() + 3600_000),
	scopes: "openid profile w_member_social",
	metadata: { personUrn: "urn:li:person:abc123" },
	createdAt: new Date(),
	updatedAt: new Date(),
};

function buildPost(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "post-001",
		userId: "user-001",
		platform: "linkedin",
		content: "Test LinkedIn post",
		status: "scheduled",
		subStatus: null,
		approvalStatus: null,
		metadata: null,
		mediaUrls: [],
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

function buildMockDb() {
	return {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue([DEFAULT_OAUTH_TOKEN]),
				}),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
		execute: vi.fn().mockResolvedValue(undefined),
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LinkedInHandler", () => {
	let LinkedInHandler: typeof import("./linkedin.handler.ts").LinkedInHandler;

	beforeEach(async () => {
		process.env.LINKEDIN_CLIENT_ID = "test_client_id";
		process.env.LINKEDIN_CLIENT_SECRET = "test_client_secret";

		createTextPostSpy.mockClear();
		createImagePostSpy.mockClear();
		initImageUploadSpy.mockClear();

		const mod = await import("./linkedin.handler.ts");
		LinkedInHandler = mod.LinkedInHandler;
	});

	afterEach(() => {
		delete process.env.LINKEDIN_CLIENT_ID;
		delete process.env.LINKEDIN_CLIENT_SECRET;
		vi.restoreAllMocks();
	});

	it("uses personUrn when no linkedinAuthorUrn in metadata (personal post)", async () => {
		const handler = new LinkedInHandler();
		const db = buildMockDb();
		const post = buildPost({ metadata: null });

		const result = await handler.publish(db as any, post as any, Buffer.alloc(32));

		expect(result.status).toBe("published");
		// createTextPost should receive the person URN from token metadata
		expect(createTextPostSpy).toHaveBeenCalledWith(
			"urn:li:person:abc123",
			"Test LinkedIn post",
			"PUBLIC",
		);
	});

	it("uses linkedinAuthorUrn from metadata for page posts, including media uploads", async () => {
		const handler = new LinkedInHandler();
		const db = buildMockDb();
		const post = buildPost({
			metadata: {
				linkedinAuthorUrn: "urn:li:organization:99999",
				linkedinFormat: "image",
			},
			mediaUrls: ["/tmp/test-image.png"],
		});

		// Mock Bun.file for media read (vitest runs in Node, not Bun)
		const mockFile = {
			arrayBuffer: async () => new ArrayBuffer(100),
		};
		(globalThis as any).Bun = { file: () => mockFile };

		const result = await handler.publish(db as any, post as any, Buffer.alloc(32));

		expect(result.status).toBe("published");

		// Media upload should use org URN as owner (not person URN)
		expect(initImageUploadSpy).toHaveBeenCalledWith(
			"encrypted_access_token", // decrypted access token (mock decrypt returns input)
			"urn:li:organization:99999",
		);

		// Post creation should use org URN as author
		expect(createImagePostSpy).toHaveBeenCalledWith(
			"urn:li:organization:99999",
			"Test LinkedIn post",
			"urn:li:image:uploaded1",
			undefined, // altText
			"PUBLIC",
		);

		delete (globalThis as any).Bun;
	});
});
