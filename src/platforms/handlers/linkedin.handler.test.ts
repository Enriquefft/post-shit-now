/**
 * Handler-level tests for LinkedInHandler covering:
 * - Author URN resolution: org URN from metadata vs person URN fallback
 * - Propagation of author URN to post creation AND media uploads
 *
 * Tests go through the public publish() method only.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { unlinkSync, writeFileSync } from "node:fs";
import { encrypt } from "../../core/utils/crypto.ts";
import { LinkedInClient } from "../linkedin/client.ts";

// ─── Module Mocks ────────────────────────────────────────────────────────────

mock.module("@trigger.dev/sdk", () => ({
	wait: { until: async () => {} },
	logger: { info: () => {}, warn: () => {}, error: () => {} },
	retry: { onThrow: async (fn: () => Promise<unknown>) => fn() },
	task: (_config: unknown) => _config,
	schedules: { task: (_config: unknown) => _config },
}));

mock.module("../linkedin/oauth.ts", () => ({
	createLinkedInOAuthClient: () => ({}),
	refreshAccessToken: async () => ({
		accessToken: "new_access",
		refreshToken: "new_refresh",
		expiresAt: new Date(Date.now() + 3600_000),
	}),
	LINKEDIN_CALLBACK_URL: "http://127.0.0.1:18923/callback",
}));

// Track which author URN is passed to createTextPost and initializeImageUpload
const createTextPostSpy = mock(() => Promise.resolve("urn:li:share:text123"));
const createImagePostSpy = mock(() => Promise.resolve("urn:li:share:img123"));
const initImageUploadSpy = mock((_token: string, _ownerUrn: string) =>
	Promise.resolve({
		uploadUrl: "https://upload.example.com",
		imageUrn: "urn:li:image:uploaded1",
		expiresAt: Date.now() + 60_000,
	}),
);

mock.module("../linkedin/media.ts", () => ({
	initializeImageUpload: (token: string, ownerUrn: string) => initImageUploadSpy(token, ownerUrn),
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

const TEST_ENC_KEY = Buffer.alloc(32);
const ENCRYPTED_ACCESS_TOKEN = encrypt("test_access_token", TEST_ENC_KEY);
const ENCRYPTED_REFRESH_TOKEN = encrypt("test_refresh_token", TEST_ENC_KEY);

const DEFAULT_OAUTH_TOKEN = {
	id: "token-001",
	userId: "user-001",
	platform: "linkedin",
	accessToken: ENCRYPTED_ACCESS_TOKEN,
	refreshToken: ENCRYPTED_REFRESH_TOKEN,
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
		select: mock(() => ({
			from: mock(() => ({
				where: mock(() => ({
					limit: mock(() => Promise.resolve([DEFAULT_OAUTH_TOKEN])),
				})),
			})),
		})),
		update: mock(() => ({
			set: mock(() => ({
				where: mock(() => Promise.resolve(undefined)),
			})),
		})),
		execute: mock(() => Promise.resolve(undefined)),
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LinkedInHandler", () => {
	let LinkedInHandler: typeof import("./linkedin.handler.ts").LinkedInHandler;

	beforeEach(async () => {
		process.env.LINKEDIN_CLIENT_ID = "test_client_id";
		process.env.LINKEDIN_CLIENT_SECRET = "test_client_secret";

		// Patch LinkedInClient prototype so the handler picks up mock methods
		LinkedInClient.prototype.createTextPost =
			createTextPostSpy as unknown as typeof LinkedInClient.prototype.createTextPost;
		LinkedInClient.prototype.createImagePost =
			createImagePostSpy as unknown as typeof LinkedInClient.prototype.createImagePost;

		createTextPostSpy.mockClear();
		createImagePostSpy.mockClear();
		initImageUploadSpy.mockClear();

		const mod = await import("./linkedin.handler.ts");
		LinkedInHandler = mod.LinkedInHandler;
	});

	afterEach(() => {
		delete process.env.LINKEDIN_CLIENT_ID;
		delete process.env.LINKEDIN_CLIENT_SECRET;
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

		// Write a temporary image file so Bun.file() can read it (globalThis.Bun is readonly)
		const tmpPath = "/tmp/psn-test-image.png";
		writeFileSync(tmpPath, Buffer.alloc(100));

		const post = buildPost({
			metadata: {
				linkedinAuthorUrn: "urn:li:organization:99999",
				linkedinFormat: "image",
			},
			mediaUrls: [tmpPath],
		});

		const result = await handler.publish(db as any, post as any, Buffer.alloc(32));
		unlinkSync(tmpPath);

		expect(result.status).toBe("published");

		// Media upload should use org URN as owner (not person URN)
		expect(initImageUploadSpy).toHaveBeenCalledWith(
			"test_access_token", // decrypted access token
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
	});
});

afterAll(() => {
	delete (LinkedInClient.prototype as unknown as Record<string, unknown>).createTextPost;
	delete (LinkedInClient.prototype as unknown as Record<string, unknown>).createImagePost;
	mock.restore();
});
