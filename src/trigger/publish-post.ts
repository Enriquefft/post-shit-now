import { logger, task, wait } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens, posts } from "../core/db/schema.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { splitIntoThread } from "../core/utils/thread-splitter.ts";
import { XClient } from "../platforms/x/client.ts";
import { uploadMedia } from "../platforms/x/media.ts";
import { createXOAuthClient, refreshAccessToken } from "../platforms/x/oauth.ts";
import { RateLimitError } from "../platforms/x/types.ts";
import { recordEpisodePublished } from "../series/episodes.ts";

interface PublishPostPayload {
	postId: string;
}

interface ThreadProgress {
	posted: number;
	total: number;
	lastPostedId: string;
	tweetIds: string[];
}

/**
 * Publish-post Trigger.dev task.
 * Handles single tweets, threads (sequential with partial failure tracking),
 * media uploads, inline token refresh, and rate limit backoff via wait.until().
 *
 * Status transitions: scheduled/retry -> publishing -> published/failed
 * Sub-statuses: media_uploading, media_uploaded, rate_limited, thread_partial
 */
export const publishPost = task({
	id: "publish-post",
	retry: {
		maxAttempts: 3,
		factor: 2,
		minTimeoutInMs: 2000,
		maxTimeoutInMs: 30000,
	},
	maxDuration: 300,
	run: async (payload: PublishPostPayload) => {
		// 1. Load env
		const databaseUrl = process.env.DATABASE_URL;
		const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;
		const xClientId = process.env.X_CLIENT_ID;
		const xClientSecret = process.env.X_CLIENT_SECRET;

		if (!databaseUrl || !encryptionKeyHex || !xClientId || !xClientSecret) {
			throw new Error(
				"Missing required env vars: DATABASE_URL, HUB_ENCRYPTION_KEY, X_CLIENT_ID, X_CLIENT_SECRET",
			);
		}

		const encKey = keyFromHex(encryptionKeyHex);
		const db = createHubConnection(databaseUrl);

		// 2. Fetch post
		const [post] = await db.select().from(posts).where(eq(posts.id, payload.postId)).limit(1);

		if (!post) {
			logger.warn("Post not found", { postId: payload.postId });
			return { status: "skipped", reason: "post_not_found" };
		}

		// 3. Idempotency check — prevent double-publish
		if (!["scheduled", "retry"].includes(post.status)) {
			logger.warn("Post not in publishable state", {
				postId: post.id,
				status: post.status,
			});
			return { status: "skipped", reason: `invalid_status_${post.status}` };
		}

		// 4. Mark as publishing
		await db
			.update(posts)
			.set({ status: "publishing", subStatus: null, updatedAt: new Date() })
			.where(eq(posts.id, post.id));

		// 5. Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${post.userId} AND ${oauthTokens.platform} = 'x'`)
			.limit(1);

		if (!token) {
			await markFailed(db, post.id, "no_oauth_token");
			return { status: "failed", reason: "no_oauth_token" };
		}

		// 6. Check token expiry and refresh if needed
		let accessTokenEncrypted = token.accessToken;

		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				await markFailed(db, post.id, "token_expired_no_refresh");
				return { status: "failed", reason: "token_expired_no_refresh" };
			}

			try {
				const xOAuthClient = createXOAuthClient({
					clientId: xClientId,
					clientSecret: xClientSecret,
					callbackUrl: "https://example.com/callback",
				});

				const decryptedRefresh = decrypt(token.refreshToken, encKey);
				const newTokens = await refreshAccessToken(xOAuthClient, decryptedRefresh);

				// Encrypt and store both new tokens atomically
				const encryptedAccess = encrypt(newTokens.accessToken, encKey);
				const encryptedRefresh = encrypt(newTokens.refreshToken, encKey);

				await db.execute(sql`
					UPDATE oauth_tokens
					SET access_token = ${encryptedAccess},
					    refresh_token = ${encryptedRefresh},
					    expires_at = ${newTokens.expiresAt},
					    updated_at = NOW(),
					    metadata = jsonb_set(
					      COALESCE(metadata, '{}'::jsonb),
					      '{lastRefreshAt}',
					      ${JSON.stringify(new Date().toISOString())}::jsonb
					    )
					WHERE id = ${token.id}
				`);

				accessTokenEncrypted = encryptedAccess;

				logger.info("Token refreshed inline during publish", {
					postId: post.id,
					tokenId: token.id,
				});
			} catch (refreshError) {
				const reason = refreshError instanceof Error ? refreshError.message : String(refreshError);
				await markFailed(db, post.id, "token_expired_refresh_failed", {
					requiresReauth: true,
					refreshError: reason,
				});
				return { status: "failed", reason: "token_expired_refresh_failed" };
			}
		}

		// 7. Decrypt access token and create client
		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const client = new XClient(accessToken);

		// 8. Handle media uploads
		let mediaIds: string[] | undefined;

		if (post.mediaUrls && post.mediaUrls.length > 0) {
			await db
				.update(posts)
				.set({ subStatus: "media_uploading", updatedAt: new Date() })
				.where(eq(posts.id, post.id));

			mediaIds = [];
			for (const filePath of post.mediaUrls) {
				const file = Bun.file(filePath);
				const buffer = Buffer.from(await file.arrayBuffer());
				const mimeType = file.type || "image/png";

				const { mediaId } = await uploadMedia(buffer, mimeType, accessToken);
				mediaIds.push(mediaId);
			}

			await db
				.update(posts)
				.set({ subStatus: "media_uploaded", updatedAt: new Date() })
				.where(eq(posts.id, post.id));

			logger.info("Media uploaded", { postId: post.id, count: mediaIds.length });
		}

		// 9. Determine if thread
		let tweets: string[];
		let isThread = false;

		try {
			// Check if content is a JSON array (thread stored as JSON string array)
			const parsed = JSON.parse(post.content);
			if (Array.isArray(parsed)) {
				tweets = parsed as string[];
				isThread = tweets.length > 1;
			} else {
				tweets = [post.content];
			}
		} catch {
			// Plain text content
			if (post.content.length > 280) {
				// Shouldn't happen (CLI splits before storing), but handle gracefully
				tweets = splitIntoThread(post.content);
				isThread = tweets.length > 1;
			} else {
				tweets = [post.content];
			}
		}

		try {
			if (!isThread) {
				// 10. Single tweet
				const result = await client.createTweet({
					text: tweets[0] as string,
					mediaIds,
				});

				await db
					.update(posts)
					.set({
						status: "published",
						subStatus: null,
						externalPostId: result.id,
						publishedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(posts.id, post.id));

				logger.info("Single tweet published", {
					postId: post.id,
					tweetId: result.id,
				});

				// Advance series state if this post belongs to a series (SERIES-03)
				await advanceSeriesState(db, post);

				return { status: "published", tweetId: result.id };
			}

			// 11. Thread posting with partial failure tracking
			const metadata = (post.metadata ?? {}) as Record<string, unknown>;
			const threadProgress = metadata.threadProgress as ThreadProgress | undefined;
			const startIndex = threadProgress?.posted ?? 0;
			const tweetIds = threadProgress?.tweetIds ?? [];

			// Build media IDs per tweet (first tweet gets all media, or distribute as needed)
			const mediaIdsPerTweet: (string[] | undefined)[] = tweets.map((_, i) =>
				i === 0 ? mediaIds : undefined,
			);

			for (let i = startIndex; i < tweets.length; i++) {
				try {
					const result = await client.createTweet({
						text: tweets[i] as string,
						replyToId: i > 0 ? tweetIds[i - 1] : undefined,
						mediaIds: mediaIdsPerTweet[i],
					});

					tweetIds.push(result.id);
				} catch (tweetError) {
					// Partial thread failure — save progress and throw for retry
					await db
						.update(posts)
						.set({
							subStatus: "thread_partial",
							platformPostIds: tweetIds,
							updatedAt: new Date(),
							metadata: {
								...metadata,
								threadProgress: {
									posted: tweetIds.length,
									total: tweets.length,
									lastPostedId: tweetIds[tweetIds.length - 1] ?? "",
									tweetIds,
								},
							},
						})
						.where(eq(posts.id, post.id));

					// Handle rate limit specifically
					if (tweetError instanceof RateLimitError && tweetError.rateLimit) {
						await db
							.update(posts)
							.set({
								subStatus: "rate_limited",
								updatedAt: new Date(),
								metadata: {
									...metadata,
									rateLimitResetAt: tweetError.rateLimit.resetAt.toISOString(),
									threadProgress: {
										posted: tweetIds.length,
										total: tweets.length,
										lastPostedId: tweetIds[tweetIds.length - 1] ?? "",
										tweetIds,
									},
								},
							})
							.where(eq(posts.id, post.id));

						logger.warn("Rate limited during thread, waiting", {
							postId: post.id,
							tweetIndex: i,
							resetAt: tweetError.rateLimit.resetAt.toISOString(),
						});

						// Wait until rate limit resets (no compute cost during wait)
						await wait.until({ date: tweetError.rateLimit.resetAt });

						// Retry this tweet after rate limit wait
						i--;
						continue;
					}

					throw tweetError;
				}
			}

			// All tweets posted successfully
			await db
				.update(posts)
				.set({
					status: "published",
					subStatus: null,
					externalPostId: tweetIds[0],
					platformPostIds: tweetIds,
					publishedAt: new Date(),
					updatedAt: new Date(),
					metadata: {
						...metadata,
						threadProgress: undefined,
					},
				})
				.where(eq(posts.id, post.id));

			logger.info("Thread published", {
				postId: post.id,
				tweetCount: tweetIds.length,
				firstTweetId: tweetIds[0],
			});

			// Advance series state if this post belongs to a series (SERIES-03)
			await advanceSeriesState(db, post);

			return { status: "published", tweetIds };
		} catch (error) {
			// 12. Rate limit handling for single tweets
			if (error instanceof RateLimitError && error.rateLimit) {
				await db
					.update(posts)
					.set({
						subStatus: "rate_limited",
						updatedAt: new Date(),
						metadata: {
							...(post.metadata as Record<string, unknown> | undefined),
							rateLimitResetAt: error.rateLimit.resetAt.toISOString(),
						},
					})
					.where(eq(posts.id, post.id));

				logger.warn("Rate limited, waiting until reset", {
					postId: post.id,
					resetAt: error.rateLimit.resetAt.toISOString(),
				});

				await wait.until({ date: error.rateLimit.resetAt });

				// After wait, throw to trigger Trigger.dev retry
				throw error;
			}

			// 13. Non-rate-limit error — throw for Trigger.dev retry
			// After all retries exhausted, Trigger.dev marks as failed.
			// The watchdog catches posts stuck in "publishing" and marks them failed.
			throw error;
		}
	},
});

/**
 * Helper to mark a post as failed with a reason.
 */
async function markFailed(
	db: ReturnType<typeof createHubConnection>,
	postId: string,
	failReason: string,
	extraMetadata?: Record<string, unknown>,
) {
	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
	const existingMetadata = (post?.metadata ?? {}) as Record<string, unknown>;

	await db
		.update(posts)
		.set({
			status: "failed",
			subStatus: null,
			failReason,
			updatedAt: new Date(),
			metadata: {
				...existingMetadata,
				...extraMetadata,
				failedAt: new Date().toISOString(),
			},
		})
		.where(eq(posts.id, postId));

	logger.error("Post marked as failed", { postId, failReason });
}

/**
 * Advance series state after a successful publish.
 * If the post belongs to a series, increments episodeCount and sets lastPublishedAt.
 * Wrapped in try/catch: failure to advance series state must NOT roll back the publish.
 */
async function advanceSeriesState(
	db: ReturnType<typeof createHubConnection>,
	post: { id: string; seriesId: string | null },
) {
	if (!post.seriesId) return;

	try {
		await recordEpisodePublished(db, post.seriesId);
		logger.info("Series state advanced", {
			postId: post.id,
			seriesId: post.seriesId,
		});
	} catch (error) {
		// Log but do not fail the publish
		logger.error("Failed to advance series state (publish succeeded)", {
			postId: post.id,
			seriesId: post.seriesId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
