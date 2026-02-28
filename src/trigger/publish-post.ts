import { logger, task } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { type PostMetadata, posts } from "../core/db/schema.ts";
import type { Platform, PlatformPublishResult } from "../core/types/index.ts";
import { keyFromHex } from "../core/utils/crypto.ts";
import { createHandler } from "../core/utils/publisher-factory.ts";
// Side-effect imports: register all platform handlers with the factory
import "../platforms/handlers/index.ts";
import { CRYPTO_ENV_VARS, requireEnvVars } from "./env-validation.ts";
import { notificationDispatcherTask } from "./notification-dispatcher.ts";
import {
	advanceSeriesState,
	markFailed,
	markPartiallyPosted,
	updateBrandPreferenceIfCompany,
} from "./publish-helpers.ts";

interface PublishPostPayload {
	postId: string;
	/** Optional: publish to specific platforms (defaults to post.platform for backward compat) */
	targetPlatforms?: Platform[];
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
		const env = requireEnvVars(CRYPTO_ENV_VARS, "publish-post");

		const encKey = keyFromHex(env.HUB_ENCRYPTION_KEY);
		const db = createHubConnection(env.DATABASE_URL);

		// 2. Fetch post
		const [post] = await db.select().from(posts).where(eq(posts.id, payload.postId)).limit(1);

		if (!post) {
			logger.warn("Post not found", { postId: payload.postId });
			return { status: "skipped", reason: "post_not_found" };
		}

		// 2b. Approval gate for company posts
		const postMetadata: PostMetadata = post.metadata ?? {};
		if (postMetadata.hubId) {
			if (post.approvalStatus !== "approved") {
				if (post.approvalStatus === "submitted") {
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

				logger.warn("Company post not approved", {
					postId: post.id,
					approvalStatus: post.approvalStatus,
				});
				return { status: "skipped", reason: `not_approved_${post.approvalStatus ?? "draft"}` };
			}
		}

		// 3. Idempotency check — prevent double-publish
		if (!["scheduled", "retry", "partially_posted"].includes(post.status)) {
			logger.warn("Post not in publishable state", { postId: post.id, status: post.status });
			return { status: "skipped", reason: `invalid_status_${post.status}` };
		}

		// 4. Mark as publishing
		await db
			.update(posts)
			.set({ status: "publishing", subStatus: null, updatedAt: new Date() })
			.where(eq(posts.id, post.id));

		// 5. Determine target platforms
		const targetPlatforms = payload.targetPlatforms ?? [post.platform as Platform];

		// 6. Dispatch to each platform via factory-created handlers
		const results: PlatformPublishResult[] = [];

		for (const platform of targetPlatforms) {
			try {
				const handler = createHandler(platform);
				const result = await handler.publish(db, post, encKey);
				results.push(result);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				logger.error("Platform publish failed", { postId: post.id, platform, error: errorMessage });
				results.push({ platform, status: "failed", error: errorMessage });
			}
		}

		// 7. Determine overall status from platform results
		const succeeded = results.filter((r) => r.status === "published");
		const failed = results.filter((r) => r.status === "failed");

		const metadata: PostMetadata = post.metadata ?? {};
		const platformStatus: Record<
			string,
			{ status: string; externalPostId?: string; error?: string }
		> = {};
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
					metadata: { ...metadata, platformStatus },
				})
				.where(eq(posts.id, post.id));

			await advanceSeriesState(db, post);
			await updateBrandPreferenceIfCompany(db, post);

			logger.info("Post published", {
				postId: post.id,
				platforms: succeeded.map((r) => r.platform),
				partialFailure: failed.length > 0,
			});

			return { status: "published", results, partialFailure: failed.length > 0 };
		}

		// All platforms failed -- check if there's partial thread progress to preserve
		const postMeta = post.metadata ?? {};
		if (postMeta.threadProgress) {
			// Thread had partial progress -- mark as partially_posted to preserve checkpoint
			const progress = JSON.parse(postMeta.threadProgress as string);
			await markPartiallyPosted(
				db,
				post.id,
				progress.tweetIds ?? [],
				progress.total ?? 0,
				"thread_halted_mid_publish",
			);
		} else {
			await markFailed(db, post.id, "all_platforms_failed", { platformStatus });
		}

		try {
			await notificationDispatcherTask.trigger({
				eventType: "post.failed",
				userId: post.userId,
				hubId: postMetadata.hubId ?? undefined,
				payload: {
					postId: post.id,
					platform: targetPlatforms.join(","),
					error: "all_platforms_failed",
					title: post.content.slice(0, 60),
				},
			});
		} catch (notifError) {
			logger.warn("Failed to trigger post failure notification", {
				postId: post.id,
				error: notifError instanceof Error ? notifError.message : String(notifError),
			});
		}

		return { status: "failed", results };
	},
});
