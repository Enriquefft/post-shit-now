import { logger, task, wait } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens, posts, preferenceModel } from "../core/db/schema.ts";
import type { Platform, PlatformPublishResult } from "../core/types/index.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { splitIntoThread } from "../core/utils/thread-splitter.ts";
import { LinkedInClient } from "../platforms/linkedin/client.ts";
import {
	initializeDocumentUpload,
	initializeImageUpload,
	uploadDocumentBinary,
	uploadImageBinary,
	waitForMediaReady,
} from "../platforms/linkedin/media.ts";
import {
	createLinkedInOAuthClient,
	refreshAccessToken as refreshLinkedInToken,
} from "../platforms/linkedin/oauth.ts";
import { LinkedInRateLimitError } from "../platforms/linkedin/types.ts";
import { XClient } from "../platforms/x/client.ts";
import { uploadMedia } from "../platforms/x/media.ts";
import {
	createXOAuthClient,
	refreshAccessToken as refreshXToken,
} from "../platforms/x/oauth.ts";
import { RateLimitError } from "../platforms/x/types.ts";
import { recordEpisodePublished } from "../series/episodes.ts";

interface PublishPostPayload {
	postId: string;
	/** Optional: publish to specific platforms (defaults to post.platform for backward compat) */
	targetPlatforms?: Platform[];
}

interface ThreadProgress {
	posted: number;
	total: number;
	lastPostedId: string;
	tweetIds: string[];
}

/**
 * Publish-post Trigger.dev task.
 * Supports multi-platform dispatch with partial failure isolation.
 *
 * When targetPlatforms is provided, publishes to each platform independently.
 * When not provided, publishes to post.platform only (backward compatible).
 *
 * Status transitions: scheduled/retry -> publishing -> published/failed
 * Sub-statuses: media_uploading, media_uploaded, rate_limited, thread_partial, partial_failure
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

		if (!databaseUrl || !encryptionKeyHex) {
			throw new Error("Missing required env vars: DATABASE_URL, HUB_ENCRYPTION_KEY");
		}

		const encKey = keyFromHex(encryptionKeyHex);
		const db = createHubConnection(databaseUrl);

		// 2. Fetch post
		const [post] = await db.select().from(posts).where(eq(posts.id, payload.postId)).limit(1);

		if (!post) {
			logger.warn("Post not found", { postId: payload.postId });
			return { status: "skipped", reason: "post_not_found" };
		}

		// 2b. Approval gate for company posts
		const postMetadata = (post.metadata ?? {}) as Record<string, unknown>;
		if (postMetadata.hubId) {
			// Company post — check approval status
			if (post.approvalStatus !== "approved") {
				if (post.approvalStatus === "submitted") {
					// Tentatively scheduled post: skip (not fail) if unapproved at scheduled time
					await db
						.update(posts)
						.set({
							status: "draft",
							updatedAt: new Date(),
							metadata: {
								...postMetadata,
								skippedReason: "Unapproved at scheduled time",
								skippedAt: new Date().toISOString(),
							},
						})
						.where(eq(posts.id, post.id));

					logger.info("Company post skipped: not approved by scheduled time", {
						postId: post.id,
						approvalStatus: post.approvalStatus,
					});

					return { status: "skipped", reason: "unapproved_at_scheduled_time" };
				}

				// Not submitted (draft/rejected) — should not be in publish queue
				logger.warn("Company post not approved", {
					postId: post.id,
					approvalStatus: post.approvalStatus,
				});
				return { status: "skipped", reason: `not_approved_${post.approvalStatus ?? "draft"}` };
			}
			// approvalStatus === 'approved' — proceed with publish
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

		// 5. Determine target platforms
		const targetPlatforms = payload.targetPlatforms ?? [post.platform as Platform];

		// 6. Dispatch to each platform independently
		const results: PlatformPublishResult[] = [];

		for (const platform of targetPlatforms) {
			try {
				const result = await publishToPlatform(db, post, platform, encKey);
				results.push(result);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error("Platform publish failed", {
					postId: post.id,
					platform,
					error: errorMessage,
				});
				results.push({
					platform,
					status: "failed",
					error: errorMessage,
				});
			}
		}

		// 7. Determine overall status from platform results
		const succeeded = results.filter((r) => r.status === "published");
		const failed = results.filter((r) => r.status === "failed");

		const metadata = (post.metadata ?? {}) as Record<string, unknown>;
		const platformStatus: Record<string, { status: string; externalPostId?: string; error?: string }> = {};
		for (const r of results) {
			platformStatus[r.platform] = {
				status: r.status,
				externalPostId: r.externalPostId,
				error: r.error,
			};
		}

		if (succeeded.length > 0) {
			const overallSubStatus = failed.length > 0 ? "partial_failure" : null;
			const primaryExternalId = succeeded[0]?.externalPostId;

			await db
				.update(posts)
				.set({
					status: "published",
					subStatus: overallSubStatus,
					externalPostId: primaryExternalId ?? post.externalPostId,
					publishedAt: new Date(),
					updatedAt: new Date(),
					metadata: {
						...metadata,
						platformStatus,
					},
				})
				.where(eq(posts.id, post.id));

			// Advance series state if applicable
			await advanceSeriesState(db, post);

			// Update company brand preference model if this is a company post
			await updateBrandPreferenceIfCompany(db, post);

			logger.info("Post published", {
				postId: post.id,
				platforms: succeeded.map((r) => r.platform),
				partialFailure: failed.length > 0,
			});

			return {
				status: "published",
				results,
				partialFailure: failed.length > 0,
			};
		}

		// All platforms failed
		await markFailed(db, post.id, "all_platforms_failed", { platformStatus });
		return { status: "failed", results };
	},
});

/**
 * Route publish to the correct platform handler.
 */
async function publishToPlatform(
	db: ReturnType<typeof createHubConnection>,
	post: Record<string, unknown>,
	platform: Platform,
	encKey: Buffer,
): Promise<PlatformPublishResult> {
	switch (platform) {
		case "x":
			return publishToX(db, post, encKey);
		case "linkedin":
			return publishToLinkedIn(db, post, encKey);
		default:
			return {
				platform,
				status: "skipped",
				error: `Platform ${platform} not yet supported`,
			};
	}
}

// ─── X Publishing ───────────────────────────────────────────────────────────

async function publishToX(
	db: ReturnType<typeof createHubConnection>,
	post: Record<string, unknown>,
	encKey: Buffer,
): Promise<PlatformPublishResult> {
	const postId = post.id as string;
	const userId = post.userId as string;
	const content = post.content as string;
	const mediaUrls = post.mediaUrls as string[] | null;
	const metadata = (post.metadata ?? {}) as Record<string, unknown>;

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

	if (!token) {
		return { platform: "x", status: "failed", error: "no_oauth_token" };
	}

	// Check token expiry and refresh if needed
	let accessTokenEncrypted = token.accessToken;

	if (token.expiresAt && token.expiresAt < new Date()) {
		if (!token.refreshToken) {
			return { platform: "x", status: "failed", error: "token_expired_no_refresh" };
		}

		const xOAuthClient = createXOAuthClient({
			clientId: xClientId,
			clientSecret: xClientSecret,
			callbackUrl: "https://example.com/callback",
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
			    metadata = jsonb_set(
			      COALESCE(metadata, '{}'::jsonb),
			      '{lastRefreshAt}',
			      ${JSON.stringify(new Date().toISOString())}::jsonb
			    )
			WHERE id = ${token.id}
		`);

		accessTokenEncrypted = encryptedAccess;
		logger.info("X token refreshed inline during publish", { postId });
	}

	// Decrypt access token and create client
	const accessToken = decrypt(accessTokenEncrypted, encKey);
	const client = new XClient(accessToken);

	// Handle media uploads
	let mediaIds: string[] | undefined;

	if (mediaUrls && mediaUrls.length > 0) {
		await db
			.update(posts)
			.set({ subStatus: "media_uploading", updatedAt: new Date() })
			.where(eq(posts.id, postId));

		mediaIds = [];
		for (const filePath of mediaUrls) {
			const file = Bun.file(filePath);
			const buffer = Buffer.from(await file.arrayBuffer());
			const mimeType = file.type || "image/png";
			const { mediaId } = await uploadMedia(buffer, mimeType, accessToken);
			mediaIds.push(mediaId);
		}

		await db
			.update(posts)
			.set({ subStatus: "media_uploaded", updatedAt: new Date() })
			.where(eq(posts.id, postId));
	}

	// Determine if thread
	let tweets: string[];
	let isThread = false;

	try {
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) {
			tweets = parsed as string[];
			isThread = tweets.length > 1;
		} else {
			tweets = [content];
		}
	} catch {
		if (content.length > 280) {
			tweets = splitIntoThread(content);
			isThread = tweets.length > 1;
		} else {
			tweets = [content];
		}
	}

	try {
		if (!isThread) {
			const result = await client.createTweet({
				text: tweets[0] as string,
				mediaIds,
			});

			return { platform: "x", status: "published", externalPostId: result.id };
		}

		// Thread posting
		const threadProgress = metadata.threadProgress as ThreadProgress | undefined;
		const startIndex = threadProgress?.posted ?? 0;
		const tweetIds = threadProgress?.tweetIds ?? [];

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
				if (tweetError instanceof RateLimitError && tweetError.rateLimit) {
					logger.warn("X rate limited during thread, waiting", {
						postId,
						tweetIndex: i,
						resetAt: tweetError.rateLimit.resetAt.toISOString(),
					});
					await wait.until({ date: tweetError.rateLimit.resetAt });
					i--;
					continue;
				}
				throw tweetError;
			}
		}

		return { platform: "x", status: "published", externalPostId: tweetIds[0] };
	} catch (error) {
		if (error instanceof RateLimitError && error.rateLimit) {
			await wait.until({ date: error.rateLimit.resetAt });
			throw error;
		}
		throw error;
	}
}

// ─── LinkedIn Publishing ────────────────────────────────────────────────────

async function publishToLinkedIn(
	db: ReturnType<typeof createHubConnection>,
	post: Record<string, unknown>,
	encKey: Buffer,
): Promise<PlatformPublishResult> {
	const postId = post.id as string;
	const userId = post.userId as string;
	const content = post.content as string;
	const mediaUrls = post.mediaUrls as string[] | null;
	const metadata = (post.metadata ?? {}) as Record<string, unknown>;

	const linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
	const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET;

	if (!linkedInClientId || !linkedInClientSecret) {
		return { platform: "linkedin", status: "failed", error: "LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set" };
	}

	// Fetch OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'linkedin'`)
		.limit(1);

	if (!token) {
		return { platform: "linkedin", status: "failed", error: "no_linkedin_oauth_token" };
	}

	// Check token expiry and refresh if needed
	let accessTokenEncrypted = token.accessToken;

	if (token.expiresAt && token.expiresAt < new Date()) {
		if (!token.refreshToken) {
			return { platform: "linkedin", status: "failed", error: "linkedin_token_expired_no_refresh" };
		}

		const linkedInOAuthClient = createLinkedInOAuthClient({
			clientId: linkedInClientId,
			clientSecret: linkedInClientSecret,
			callbackUrl: "https://example.com/callback",
		});

		const decryptedRefresh = decrypt(token.refreshToken, encKey);
		const newTokens = await refreshLinkedInToken(linkedInOAuthClient, decryptedRefresh);

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
		logger.info("LinkedIn token refreshed inline during publish", { postId });
	}

	// Decrypt access token and create client
	const accessToken = decrypt(accessTokenEncrypted, encKey);
	const client = new LinkedInClient(accessToken);

	// Get author URN from token metadata
	const tokenMetadata = (token.metadata ?? {}) as Record<string, unknown>;
	const personUrn = tokenMetadata.personUrn as string | undefined;

	if (!personUrn) {
		return { platform: "linkedin", status: "failed", error: "person_urn_not_found_in_token_metadata" };
	}

	// Determine content type from metadata
	const linkedinFormat = (metadata.linkedinFormat as string) ?? (metadata.format as string) ?? "text";
	const visibility = (metadata.linkedinVisibility as "PUBLIC" | "CONNECTIONS") ?? "PUBLIC";

	// Extract plain text from content (strip thread JSON if needed)
	let commentary: string;
	try {
		const parsed = JSON.parse(content);
		commentary = Array.isArray(parsed) ? (parsed as string[]).join("\n\n") : content;
	} catch {
		commentary = content;
	}

	try {
		let linkedInPostId: string;

		switch (linkedinFormat) {
			case "carousel":
			case "document": {
				// Document post — PDF carousel
				if (!mediaUrls || mediaUrls.length === 0) {
					// No media, fall back to text post
					linkedInPostId = await client.createTextPost(personUrn, commentary, visibility);
					break;
				}

				// Load PDF file
				const pdfPath = mediaUrls[0] as string;
				const pdfFile = Bun.file(pdfPath);
				const pdfBuffer = new Uint8Array(await pdfFile.arrayBuffer());

				// Two-step document upload
				const docUpload = await initializeDocumentUpload(accessToken, personUrn);
				await uploadDocumentBinary(docUpload.uploadUrl, accessToken, pdfBuffer);
				await waitForMediaReady(accessToken, docUpload.documentUrn, "document");

				const title = (metadata.carouselTitle as string) ?? undefined;
				linkedInPostId = await client.createDocumentPost(
					personUrn,
					commentary,
					docUpload.documentUrn,
					title,
					visibility,
				);
				break;
			}

			case "image-post":
			case "image": {
				if (!mediaUrls || mediaUrls.length === 0) {
					linkedInPostId = await client.createTextPost(personUrn, commentary, visibility);
					break;
				}

				if (mediaUrls.length === 1) {
					// Single image post
					const imgPath = mediaUrls[0] as string;
					const imgFile = Bun.file(imgPath);
					const imgBuffer = new Uint8Array(await imgFile.arrayBuffer());

					const imgUpload = await initializeImageUpload(accessToken, personUrn);
					await uploadImageBinary(imgUpload.uploadUrl, accessToken, imgBuffer);
					await waitForMediaReady(accessToken, imgUpload.imageUrn, "image");

					const altText = (metadata.imageAltText as string) ?? undefined;
					linkedInPostId = await client.createImagePost(
						personUrn,
						commentary,
						imgUpload.imageUrn,
						altText,
						visibility,
					);
				} else {
					// Multi-image post
					const imageUrns: string[] = [];
					for (const imgPath of mediaUrls) {
						const imgFile = Bun.file(imgPath);
						const imgBuffer = new Uint8Array(await imgFile.arrayBuffer());

						const imgUpload = await initializeImageUpload(accessToken, personUrn);
						await uploadImageBinary(imgUpload.uploadUrl, accessToken, imgBuffer);
						await waitForMediaReady(accessToken, imgUpload.imageUrn, "image");
						imageUrns.push(imgUpload.imageUrn);
					}

					linkedInPostId = await client.createMultiImagePost(
						personUrn,
						commentary,
						imageUrns,
						visibility,
					);
				}
				break;
			}

			case "article":
			case "linkedin-article": {
				const articleUrl = (metadata.articleUrl as string) ?? "";
				const articleTitle = (metadata.articleTitle as string) ?? "";
				const articleDescription = (metadata.articleDescription as string) ?? "";

				if (!articleUrl) {
					linkedInPostId = await client.createTextPost(personUrn, commentary, visibility);
					break;
				}

				linkedInPostId = await client.createArticlePost(
					personUrn,
					commentary,
					articleUrl,
					articleTitle,
					articleDescription,
					undefined,
					visibility,
				);
				break;
			}

			default: {
				// Text post (default)
				linkedInPostId = await client.createTextPost(personUrn, commentary, visibility);
				break;
			}
		}

		logger.info("LinkedIn post published", {
			postId,
			linkedInPostId,
			format: linkedinFormat,
		});

		return { platform: "linkedin", status: "published", externalPostId: linkedInPostId };
	} catch (error) {
		if (error instanceof LinkedInRateLimitError && error.rateLimit) {
			logger.warn("LinkedIn rate limited, waiting", {
				postId,
				resetAt: error.rateLimit.resetAt.toISOString(),
			});
			await wait.until({ date: error.rateLimit.resetAt });
			throw error;
		}
		throw error;
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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
 */
async function advanceSeriesState(
	db: ReturnType<typeof createHubConnection>,
	post: { id?: unknown; seriesId?: unknown },
) {
	const id = post.id as string | undefined;
	const seriesId = post.seriesId as string | null | undefined;
	if (!seriesId || !id) return;

	try {
		await recordEpisodePublished(db, seriesId);
		logger.info("Series state advanced", { postId: id, seriesId });
	} catch (error) {
		logger.error("Failed to advance series state (publish succeeded)", {
			postId: id,
			seriesId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

// ─── Brand Preference Model ────────────────────────────────────────────────

/**
 * Update company brand preference model after successful publish.
 * The brand preference model is shared across all team members in a Company Hub.
 * Uses userId = hubId for company-level preference records.
 */
async function updateBrandPreferenceIfCompany(
	db: ReturnType<typeof createHubConnection>,
	post: Record<string, unknown>,
) {
	const metadata = (post.metadata ?? {}) as Record<string, unknown>;
	const hubId = metadata.hubId as string | undefined;
	if (!hubId) return; // Not a company post

	try {
		const platform = post.platform as string;
		const postFormat = (metadata.format as string) ?? "text";
		const postPillar = (metadata.pillar as string) ?? "general";

		// Upsert the company-level preference model
		// Uses hubId as the userId for company-wide tracking
		const [existing] = await db
			.select()
			.from(preferenceModel)
			.where(eq(preferenceModel.userId, hubId))
			.limit(1);

		if (!existing) {
			// Create initial brand preference model
			await db.insert(preferenceModel).values({
				userId: hubId, // company-level record keyed by hubId
				topFormats: [{ format: postFormat, avgScore: 0 }],
				topPillars: [{ pillar: postPillar, avgScore: 0 }],
				bestPostingTimes: [],
				updatedAt: new Date(),
			});
			logger.info("Brand preference model created", { hubId, platform });
		} else {
			// Update existing brand model with new format/pillar data
			const topFormats = (existing.topFormats ?? []) as Array<{ format: string; avgScore: number }>;
			const topPillars = (existing.topPillars ?? []) as Array<{ pillar: string; avgScore: number }>;

			// Track format usage (score updated later by analytics)
			const formatEntry = topFormats.find((f) => f.format === postFormat);
			if (!formatEntry) {
				topFormats.push({ format: postFormat, avgScore: 0 });
			}

			// Track pillar usage
			const pillarEntry = topPillars.find((p) => p.pillar === postPillar);
			if (!pillarEntry) {
				topPillars.push({ pillar: postPillar, avgScore: 0 });
			}

			await db
				.update(preferenceModel)
				.set({
					topFormats,
					topPillars,
					updatedAt: new Date(),
				})
				.where(eq(preferenceModel.userId, hubId));

			logger.info("Brand preference model updated", { hubId, format: postFormat, pillar: postPillar });
		}
	} catch (error) {
		// Brand model update failure should never roll back a successful publish
		logger.error("Failed to update brand preference model (publish succeeded)", {
			postId: post.id as string,
			hubId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
