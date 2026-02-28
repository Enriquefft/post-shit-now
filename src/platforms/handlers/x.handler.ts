import { logger, retry, wait } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { oauthTokens, posts } from "../../core/db/schema.ts";
import type { PlatformPublishResult } from "../../core/types/index.ts";
import type {
	DbConnection,
	PlatformPublisher,
	PostRow,
	RateLimitInfo,
} from "../../core/types/publisher.ts";
import { decrypt, encrypt } from "../../core/utils/crypto.ts";
import { registerHandler } from "../../core/utils/publisher-factory.ts";
import { splitIntoThread } from "../../core/utils/thread-splitter.ts";
import { countTweetChars, validateTweet } from "../../core/utils/tweet-validator.ts";
import { XClient } from "../x/client.ts";
import { uploadMedia } from "../x/media.ts";
import {
	createXOAuthClient,
	refreshAccessToken as refreshXToken,
	X_CALLBACK_URL,
} from "../x/oauth.ts";
import { RateLimitError, XApiError } from "../x/types.ts";

const stringArraySchema = z.array(z.string());
const threadProgressSchema = z.object({
	posted: z.number(),
	total: z.number(),
	lastPostedId: z.string(),
	tweetIds: z.array(z.string()),
});

/** Wrapper to skip retry.onThrow retries for errors needing domain-specific handling */
class SkipRetryError extends Error {
	override readonly cause: Error;
	constructor(cause: Error) {
		super("abort_retry");
		this.name = "SkipRetryError";
		this.cause = cause;
	}
}

function isDuplicateError(error: unknown): boolean {
	if (error instanceof XApiError && error.statusCode === 403) {
		return error.message.toLowerCase().includes("duplicate content");
	}
	return false;
}

async function recoverTweetId(client: XClient, tweetText: string): Promise<string | null> {
	try {
		const timeline = await client.getTimeline({ maxResults: 10 });
		// Normalize for t.co URL differences: compare trimmed text without URLs
		const normalize = (s: string) => s.replace(/https?:\/\/\S+/g, "").trim();
		const normalizedInput = normalize(tweetText);
		const match = timeline.data.find((t) => normalize(t.text) === normalizedInput);
		return match?.id ?? null;
	} catch {
		return null; // Recovery is best-effort
	}
}

async function saveCheckpoint(
	db: DbConnection,
	postId: string,
	tweetIds: string[],
	totalTweets: number,
	existingMetadata: Record<string, unknown>,
) {
	await retry.onThrow(
		async () => {
			await db
				.update(posts)
				.set({
					subStatus: "thread_partial",
					updatedAt: new Date(),
					metadata: {
						...existingMetadata,
						threadProgress: JSON.stringify({
							posted: tweetIds.length,
							total: totalTweets,
							lastPostedId: tweetIds[tweetIds.length - 1] ?? "",
							tweetIds: [...tweetIds],
						}),
					},
				})
				.where(eq(posts.id, postId));
		},
		{ maxAttempts: 3, minTimeoutInMs: 500, factor: 2, randomize: false },
	);
}

export class XHandler implements PlatformPublisher {
	private currentRateLimit: RateLimitInfo | null = null;

	async publish(db: DbConnection, post: PostRow, encKey: Buffer): Promise<PlatformPublishResult> {
		const { id: postId, userId, content, metadata } = post;
		const mediaUrls = post.mediaUrls ?? [];

		const xClientId = process.env.X_CLIENT_ID;
		const xClientSecret = process.env.X_CLIENT_SECRET;
		if (!xClientId || !xClientSecret) {
			return { platform: "x", status: "failed", error: "X_CLIENT_ID or X_CLIENT_SECRET not set" };
		}

		// Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
			.limit(1);
		if (!token) return { platform: "x", status: "failed", error: "no_oauth_token" };

		// Refresh token if expired
		let accessTokenEncrypted = token.accessToken;
		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				return { platform: "x", status: "failed", error: "token_expired_no_refresh" };
			}
			const xOAuthClient = createXOAuthClient({
				clientId: xClientId,
				clientSecret: xClientSecret,
				callbackUrl: X_CALLBACK_URL,
			});
			const decryptedRefresh = decrypt(token.refreshToken, encKey);
			const newTokens = await refreshXToken(xOAuthClient, decryptedRefresh);
			const encryptedAccess = encrypt(newTokens.accessToken, encKey);
			const encryptedRefresh = encrypt(newTokens.refreshToken, encKey);
			await db.execute(sql`
				UPDATE oauth_tokens
				SET access_token = ${encryptedAccess},
				    refresh_token = ${encryptedRefresh},
				    expires_at = ${newTokens.expiresAt},
				    updated_at = NOW(),
				    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{lastRefreshAt}', ${JSON.stringify(new Date().toISOString())}::jsonb)
				WHERE id = ${token.id}
			`);
			accessTokenEncrypted = encryptedAccess;
			logger.info("X token refreshed inline during publish", { postId });
		}

		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const client = new XClient(accessToken);

		// Handle media uploads
		let mediaIds: string[] | undefined;
		if (mediaUrls.length > 0) {
			await db
				.update(posts)
				.set({ subStatus: "media_uploading", updatedAt: new Date() })
				.where(eq(posts.id, postId));
			mediaIds = [];
			for (const filePath of mediaUrls) {
				const file = Bun.file(filePath);
				const buffer = Buffer.from(await file.arrayBuffer());
				const { mediaId } = await uploadMedia(buffer, file.type || "image/png", accessToken);
				mediaIds.push(mediaId);
			}
			await db
				.update(posts)
				.set({ subStatus: "media_uploaded", updatedAt: new Date() })
				.where(eq(posts.id, postId));
		}

		// Determine if thread or single tweet
		let tweets: string[];
		let isThread = false;
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				tweets = stringArraySchema.parse(parsed);
				isThread = tweets.length > 1;
			} else {
				tweets = [content];
			}
		} catch {
			if (countTweetChars(content) > 280) {
				tweets = splitIntoThread(content);
				isThread = tweets.length > 1;
			} else {
				tweets = [content];
			}
		}

		// Pre-flight tweet validation (blocks oversized, warns on mentions/hashtags)
		if (!isThread) {
			const validation = validateTweet(tweets[0] ?? content);
			if (!validation.valid) {
				return {
					platform: "x",
					status: "failed",
					error: `${validation.errors.join("; ")}. Consider splitting into a thread`,
				};
			}
			if (validation.warnings.length > 0) {
				logger.warn("Tweet validation warnings", { postId, warnings: validation.warnings });
			}
		} else {
			for (const [i, tweet] of tweets.entries()) {
				const v = validateTweet(tweet);
				if (!v.valid) {
					return {
						platform: "x",
						status: "failed",
						error: `Thread tweet ${i + 1}: ${v.errors.join("; ")}`,
					};
				}
				if (v.warnings.length > 0) {
					logger.warn("Thread tweet validation warnings", {
						postId,
						tweetIndex: i + 1,
						warnings: v.warnings,
					});
				}
			}
		}

		// Duplicate detection (soft warning only, does not block)
		const duplicateWarning = await this.checkDuplicates(db, userId, content);
		if (duplicateWarning) {
			logger.warn("Duplicate content detected", { postId, warning: duplicateWarning });
		}

		try {
			if (!isThread) {
				const result = await client.createTweet({ text: tweets[0] ?? content, mediaIds });
				return { platform: "x", status: "published", externalPostId: result.id };
			}
			return await this.postThread(
				client,
				tweets,
				mediaIds,
				metadata as Record<string, unknown>,
				postId,
				db,
			);
		} catch (error) {
			if (error instanceof RateLimitError && error.rateLimit) {
				await wait.until({ date: error.rateLimit.resetAt });
				throw error;
			}
			throw error;
		}
	}

	private async checkDuplicates(
		db: DbConnection,
		userId: string,
		content: string,
	): Promise<string | null> {
		const recentPosts = await db
			.select({ content: posts.content })
			.from(posts)
			.where(
				sql`${posts.userId} = ${userId}
					AND ${posts.platform} = 'x'
					AND ${posts.status} = 'published'
					AND ${posts.publishedAt} > NOW() - INTERVAL '7 days'`,
			)
			.limit(50);

		const inputWords = new Set(content.toLowerCase().split(/\s+/).filter(Boolean));
		for (const post of recentPosts) {
			const postWords = new Set(post.content.toLowerCase().split(/\s+/).filter(Boolean));
			const intersection = new Set([...inputWords].filter((w) => postWords.has(w)));
			const union = new Set([...inputWords, ...postWords]);
			const similarity = union.size > 0 ? intersection.size / union.size : 0;
			if (similarity >= 0.8) {
				return "Content is 80%+ similar to a post published within the last 7 days";
			}
		}
		return null;
	}

	private async postThread(
		client: XClient,
		tweets: string[],
		mediaIds: string[] | undefined,
		metadata: Record<string, unknown> | null,
		postId: string,
		db: DbConnection,
	): Promise<PlatformPublishResult> {
		const threadProgress = metadata?.threadProgress
			? threadProgressSchema.parse(JSON.parse(metadata.threadProgress as string))
			: undefined;
		const startIndex = threadProgress?.posted ?? 0;
		const tweetIds = threadProgress?.tweetIds ?? [];
		const existingMetadata = metadata ?? {};
		const mediaIdsPerTweet = tweets.map((_, i) => (i === 0 ? mediaIds : undefined));

		for (let i = startIndex; i < tweets.length; i++) {
			const tweetText = tweets[i];
			if (!tweetText) continue;

			let tweetId: string;

			try {
				// retry.onThrow retries the tweet API call 3 times inline for network errors
				// Rate limit and duplicate errors skip retry via __skipRetry marker
				const result = await retry.onThrow(
					async () => {
						try {
							return await client.createTweet({
								text: tweetText,
								replyToId: i > 0 ? tweetIds[i - 1] : undefined,
								mediaIds: mediaIdsPerTweet[i],
							});
						} catch (innerError) {
							// Let rate limit and duplicate errors skip retry
							if (innerError instanceof RateLimitError || isDuplicateError(innerError)) {
								throw new SkipRetryError(innerError as Error);
							}
							throw innerError; // Network/other errors: retry.onThrow will retry
						}
					},
					{ maxAttempts: 3, minTimeoutInMs: 1000, factor: 2 },
				);
				tweetId = result.id;
			} catch (tweetError) {
				// Unwrap skip-retry wrapper to get the original error
				const actualError = tweetError instanceof SkipRetryError ? tweetError.cause : tweetError;

				// Rate limit: wait for cooldown, retry same tweet
				if (actualError instanceof RateLimitError && actualError.rateLimit) {
					logger.warn("X rate limited during thread, waiting", {
						postId,
						tweetIndex: i,
						resetAt: actualError.rateLimit.resetAt.toISOString(),
					});
					await wait.until({ date: actualError.rateLimit.resetAt });
					i--;
					continue;
				}

				// Error 187 equivalent: duplicate content
				if (isDuplicateError(actualError)) {
					const recoveredId = await recoverTweetId(client, tweetText);
					if (recoveredId) {
						tweetId = recoveredId;
						logger.info("Recovered duplicate tweet ID", { postId, tweetIndex: i, recoveredId });
					} else {
						// Advance without ID per user decision
						tweetId = "";
						logger.warn("Duplicate detected but could not recover tweet ID", {
							postId,
							tweetIndex: i,
						});
					}
				} else {
					// Network error (after 3 inline retries exhausted) or content error:
					// checkpoint what we have, then throw for Trigger.dev task-level retry
					if (tweetIds.length > 0) {
						await saveCheckpoint(db, postId, tweetIds, tweets.length, existingMetadata);
						logger.info("Thread checkpoint saved before error", {
							postId,
							posted: tweetIds.length,
							total: tweets.length,
						});
					}
					throw actualError;
				}
			}

			tweetIds.push(tweetId);

			// Persist checkpoint after each successful tweet (THREAD-01)
			await saveCheckpoint(db, postId, tweetIds, tweets.length, existingMetadata);
			logger.info("Thread checkpoint saved", {
				postId,
				tweetIndex: i,
				posted: tweetIds.length,
				total: tweets.length,
			});
		}

		return { platform: "x", status: "published", externalPostId: tweetIds[0] };
	}

	async validateCredentials(): Promise<boolean> {
		return true;
	}
	getRateLimitInfo(): RateLimitInfo | null {
		return this.currentRateLimit;
	}
	async refreshCredentials(_db: DbConnection, _encKey: Buffer): Promise<void> {}
	isRateLimited(): boolean {
		return this.currentRateLimit?.remaining === 0;
	}
	getRetryAfter(): number {
		if (!this.currentRateLimit) return 0;
		return Math.max(0, Math.ceil((this.currentRateLimit.resetAt.getTime() - Date.now()) / 1000));
	}
}

// Auto-register
registerHandler("x", XHandler as unknown as new (...args: unknown[]) => PlatformPublisher);
