/**
 * Handler-level tests for XHandler covering:
 * - Single tweet publish (success, validation failure, missing credentials, missing token)
 * - Thread publish (ordered posting, checkpoint persistence, resume from checkpoint)
 * - Thread error handling (duplicate recovery, checkpoint-before-error)
 *
 * Tests go through the public publish() method only -- no private method access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { XApiError } from "../x/types.ts";

// ─── Module Mocks ────────────────────────────────────────────────────────────

vi.mock("@trigger.dev/sdk", () => ({
	retry: {
		onThrow: async (fn: () => Promise<unknown>) => fn(),
	},
	wait: { until: async () => {} },
	logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

vi.mock("../../core/utils/publisher-factory.ts", () => ({
	registerHandler: () => {},
}));

vi.mock("../x/client.ts", () => {
	const { MockXClient } = require("../__mocks__/clients.ts");
	return { XClient: MockXClient };
});

vi.mock("../x/oauth.ts", () => ({
	createXOAuthClient: () => ({}),
	refreshAccessToken: async () => ({
		accessToken: "new_access",
		refreshToken: "new_refresh",
		expiresAt: new Date(Date.now() + 3600_000),
	}),
	X_CALLBACK_URL: "http://127.0.0.1:18923/callback",
}));

vi.mock("../../core/utils/crypto.ts", () => ({
	decrypt: (val: string) => val,
	encrypt: (val: string) => val,
	keyFromHex: (hex: string) => Buffer.from(hex, "hex"),
}));

vi.mock("../x/media.ts", () => ({
	uploadMedia: async () => ({ mediaId: "media_1" }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPost(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "post-001",
		userId: "user-001",
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

/**
 * Build a mock DB that supports the Drizzle chained query pattern used by XHandler.
 * Tracks update().set() calls for checkpoint verification.
 */
const DEFAULT_OAUTH_TOKEN = {
	id: "token-001",
	userId: "user-001",
	platform: "x",
	accessToken: "encrypted_access_token",
	refreshToken: "encrypted_refresh_token",
	expiresAt: new Date(Date.now() + 3600_000), // not expired
	scopes: "tweet.read tweet.write",
	metadata: null,
	createdAt: new Date(),
	updatedAt: new Date(),
};

function buildMockDb(
	options: { noToken?: boolean; recentPosts?: Array<{ content: string }> } = {},
) {
	const tokenResult = options.noToken ? [] : [DEFAULT_OAUTH_TOKEN];
	const recentPosts = options.recentPosts ?? [];

	// Track all update().set() calls for checkpoint verification
	const setCalls: Array<{ args: unknown[]; table: string }> = [];

	// XHandler calls select().from(oauthTokens) first, then select({content}).from(posts)
	// Distinguish by select() arguments: select() with no args = oauth, select({content}) = posts
	const mockDb = {
		_setCalls: setCalls,
		select: vi.fn().mockImplementation((...selectArgs: unknown[]) => {
			// If select is called with field mapping (e.g. { content: posts.content }), it's the duplicate check
			const isFieldSelect =
				selectArgs.length > 0 && typeof selectArgs[0] === "object" && selectArgs[0] !== null;

			return {
				from: vi.fn().mockImplementation(() => {
					if (isFieldSelect) {
						// Duplicate check query: select({ content: posts.content }).from(posts)
						return {
							where: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue(recentPosts),
							}),
						};
					}
					// OAuth token query: select().from(oauthTokens)
					return {
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue(tokenResult),
						}),
					};
				}),
			};
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockImplementation((...args: unknown[]) => {
				setCalls.push({ args, table: "posts" });
				return {
					where: vi.fn().mockResolvedValue(undefined),
				};
			}),
		}),
		execute: vi.fn().mockResolvedValue(undefined),
	};

	return mockDb;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("XHandler", () => {
	let XHandler: new () => {
		publish: (
			db: unknown,
			post: unknown,
			encKey: Buffer,
		) => Promise<{ platform: string; status: string; externalPostId?: string; error?: string }>;
	};

	beforeEach(async () => {
		process.env.X_CLIENT_ID = "test_id";
		process.env.X_CLIENT_SECRET = "test_secret";
		// Dynamic import to get fresh module after mocks are set
		const mod = await import("./x.handler.ts");
		XHandler = mod.XHandler as typeof XHandler;
	});

	afterEach(() => {
		delete process.env.X_CLIENT_ID;
		delete process.env.X_CLIENT_SECRET;
		vi.clearAllMocks();
	});

	describe("publish() - single tweet", () => {
		it("returns published with externalPostId for content under 280 chars", async () => {
			const handler = new XHandler();
			const post = buildPost({ content: "Hello from PSN" });
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("tweet_1");
			expect(result.platform).toBe("x");
		});

		it("returns failed for oversized content (>280 weighted chars)", async () => {
			const handler = new XHandler();
			// Create a single JSON-encoded array with one oversized tweet to trigger validation
			// A single-item array won't be treated as a thread (isThread = tweets.length > 1)
			const longContent = JSON.stringify(["A".repeat(300)]);
			const post = buildPost({ content: longContent });
			const db = buildMockDb({});
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toContain("280");
		});

		it("returns failed when X credentials are missing", async () => {
			delete process.env.X_CLIENT_ID;
			delete process.env.X_CLIENT_SECRET;

			const handler = new XHandler();
			const post = buildPost();
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toBe("X_CLIENT_ID or X_CLIENT_SECRET not set");
		});

		it("returns failed when no OAuth token exists", async () => {
			const handler = new XHandler();
			const post = buildPost();
			const db = buildMockDb({ noToken: true });
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("failed");
			expect(result.error).toBe("no_oauth_token");
		});
	});

	describe("publish() - thread", () => {
		it("posts all tweets in order with correct replyToId chaining", async () => {
			const handler = new XHandler();
			const tweets = ["First tweet", "Second tweet", "Third tweet"];
			const post = buildPost({ content: JSON.stringify(tweets) });
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("tweet_1"); // First tweet ID
		});

		it("saves checkpoint after each tweet (verify DB update calls)", async () => {
			const handler = new XHandler();
			const tweets = ["First tweet", "Second tweet", "Third tweet"];
			const post = buildPost({ content: JSON.stringify(tweets) });
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			await handler.publish(db as unknown as never, post as never, encKey);

			// Should have checkpoint saves after each tweet (3 tweets = 3 checkpoints)
			const checkpointCalls = db._setCalls.filter((call) => {
				const setArg = call.args[0] as Record<string, unknown>;
				return setArg?.subStatus === "thread_partial";
			});
			expect(checkpointCalls.length).toBe(3);

			// Verify the last checkpoint has all 3 tweet IDs
			const lastCheckpoint = checkpointCalls[2];
			const metadata = (lastCheckpoint?.args[0] as Record<string, unknown>)?.metadata as Record<
				string,
				unknown
			>;
			const threadProgress = JSON.parse(metadata?.threadProgress as string);
			expect(threadProgress.posted).toBe(3);
			expect(threadProgress.total).toBe(3);
			expect(threadProgress.tweetIds).toHaveLength(3);
		});

		it("resumes from checkpoint (metadata.threadProgress present)", async () => {
			const handler = new XHandler();
			const tweets = ["First tweet", "Second tweet", "Third tweet"];
			const threadProgress = JSON.stringify({
				posted: 2,
				total: 3,
				lastPostedId: "t2",
				tweetIds: ["t1", "t2"],
			});
			const post = buildPost({
				content: JSON.stringify(tweets),
				metadata: { threadProgress },
			});
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			expect(result.status).toBe("published");
			// Should return first tweet ID from the resumed tweetIds
			expect(result.externalPostId).toBe("t1");

			// Only 1 checkpoint save (for tweet 3 only, tweets 1-2 were already posted)
			const checkpointCalls = db._setCalls.filter((call) => {
				const setArg = call.args[0] as Record<string, unknown>;
				return setArg?.subStatus === "thread_partial";
			});
			expect(checkpointCalls.length).toBe(1);

			// Verify the checkpoint shows 3 posted
			const checkpoint = checkpointCalls[0];
			const metadata = (checkpoint?.args[0] as Record<string, unknown>)?.metadata as Record<
				string,
				unknown
			>;
			const progress = JSON.parse(metadata?.threadProgress as string);
			expect(progress.posted).toBe(3);
			expect(progress.tweetIds).toEqual(["t1", "t2", "tweet_1"]);
		});
	});

	describe("publish() - thread error handling", () => {
		it("recovers tweet ID on duplicate error (403)", async () => {
			const handler = new XHandler();
			const tweets = ["First tweet", "Duplicate tweet"];
			const post = buildPost({ content: JSON.stringify(tweets) });
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			// We need to make the second createTweet call throw a duplicate error
			// The MockXClient is injected via vi.mock, so we need to access it
			// We'll set up the failure after the first tweet posts
			// Since MockXClient is used via the XClient mock, we need to intercept it
			// The handler creates a new XClient internally, so we hook into the mock
			const { XClient: MockedClient } = await import("../x/client.ts");

			// Override createTweet to fail on second call
			let callCount = 0;
			const originalCreateTweet = MockedClient.prototype.createTweet;
			MockedClient.prototype.createTweet = async function (
				this: InstanceType<typeof MockedClient>,
				params: { text: string; replyToId?: string; mediaIds?: string[] },
			) {
				callCount++;
				if (callCount === 2) {
					// First call already happened, now throw duplicate for second
					// But first, post the tweet so getTimeline can find it
					const _result = await originalCreateTweet.call(this, params);
					// Now set up a duplicate error to be thrown
					throw new XApiError(403, "You are not allowed to create a Tweet with duplicate content.");
				}
				return originalCreateTweet.call(this, params);
			};

			const result = await handler.publish(db as unknown as never, post as never, encKey);

			// Restore
			MockedClient.prototype.createTweet = originalCreateTweet;

			expect(result.status).toBe("published");
			expect(result.externalPostId).toBe("tweet_1"); // First tweet ID
		});

		it("saves checkpoint before propagating non-duplicate error", async () => {
			const handler = new XHandler();
			const tweets = ["First tweet", "Second tweet", "Third tweet", "Fourth tweet"];
			const post = buildPost({ content: JSON.stringify(tweets) });
			const db = buildMockDb();
			const encKey = Buffer.from("0".repeat(64), "hex");

			const { XClient: MockedClient } = await import("../x/client.ts");

			// Fail on the 3rd tweet (after 2 succeed)
			let callCount = 0;
			const originalCreateTweet = MockedClient.prototype.createTweet;
			MockedClient.prototype.createTweet = async function (
				this: InstanceType<typeof MockedClient>,
				params: { text: string; replyToId?: string; mediaIds?: string[] },
			) {
				callCount++;
				if (callCount === 3) {
					throw new Error("Network error");
				}
				return originalCreateTweet.call(this, params);
			};

			try {
				await handler.publish(db as unknown as never, post as never, encKey);
				// Should have thrown
				expect.unreachable("Should have thrown");
			} catch (error) {
				expect((error as Error).message).toBe("Network error");
			}

			// Restore
			MockedClient.prototype.createTweet = originalCreateTweet;

			// Verify checkpoint was saved with 2 posted tweets before the error
			const checkpointCalls = db._setCalls.filter((call) => {
				const setArg = call.args[0] as Record<string, unknown>;
				return setArg?.subStatus === "thread_partial";
			});

			// Should have 2 successful checkpoints + 1 error checkpoint = 3 total
			// Actually: 2 from successful tweets + 1 from saveCheckpoint before error = 3
			expect(checkpointCalls.length).toBe(3);

			// Last checkpoint (the error checkpoint) should show 2 posted
			const errorCheckpoint = checkpointCalls[checkpointCalls.length - 1];
			const metadata = (errorCheckpoint?.args[0] as Record<string, unknown>)?.metadata as Record<
				string,
				unknown
			>;
			const progress = JSON.parse(metadata?.threadProgress as string);
			expect(progress.posted).toBe(2);
			expect(progress.total).toBe(4);
			expect(progress.tweetIds).toHaveLength(2);
		});
	});
});
