import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, lt, sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";
import { publishPost } from "./publish-post.ts";

const MAX_WATCHDOG_RETRIES = 3;

export interface WatchdogResult {
	checked: number;
	stuck: number;
	retried: number;
	failed: number;
}

/**
 * Find posts stuck in "scheduled" state past their scheduled time.
 * These are posts that should have been published but weren't.
 */
export async function findStuckScheduled(db: ReturnType<typeof createHubConnection>) {
	return db
		.select()
		.from(posts)
		.where(
			and(eq(posts.status, "scheduled"), lt(posts.scheduledAt, sql`NOW() - INTERVAL '5 minutes'`)),
		);
}

/**
 * Find posts stuck in "publishing" state for too long.
 * These are posts where the publish task started but never completed.
 */
export async function findStuckPublishing(db: ReturnType<typeof createHubConnection>) {
	return db
		.select()
		.from(posts)
		.where(
			and(eq(posts.status, "publishing"), lt(posts.updatedAt, sql`NOW() - INTERVAL '10 minutes'`)),
		);
}

/**
 * Post watchdog cron task.
 * Runs every 15 minutes to detect and handle stuck posts.
 * Re-triggers stuck posts via publishPost task with retry counting (max 3).
 */
export const postWatchdog = schedules.task({
	id: "post-watchdog",
	maxDuration: 60,
	run: async () => {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			logger.error("DATABASE_URL not set — cannot run watchdog");
			return { checked: 0, stuck: 0, retried: 0, failed: 0 };
		}

		const db = createHubConnection(databaseUrl);
		const result: WatchdogResult = { checked: 0, stuck: 0, retried: 0, failed: 0 };

		// Find posts stuck in "scheduled" state
		const stuckScheduled = await findStuckScheduled(db);
		result.checked += stuckScheduled.length;

		for (const post of stuckScheduled) {
			const metadata = (post.metadata ?? {}) as Record<string, unknown>;
			const retryCount = (metadata.retryCount as number) ?? 0;

			logger.warn("Stuck scheduled post detected", {
				postId: post.id,
				scheduledAt: post.scheduledAt?.toISOString(),
				platform: post.platform,
				retryCount,
			});

			// Check retry limit (SCHED-04: 3 retries max)
			if (retryCount >= MAX_WATCHDOG_RETRIES) {
				await db
					.update(posts)
					.set({
						status: "failed",
						failReason: "max_retries_exceeded",
						updatedAt: new Date(),
						metadata: {
							...metadata,
							failedAt: new Date().toISOString(),
							failReason: "Exceeded maximum watchdog retries",
						},
					})
					.where(eq(posts.id, post.id));

				logger.error("Post exceeded max retries — marking as failed", {
					postId: post.id,
					retryCount,
				});

				result.stuck++;
				result.failed++;
				continue;
			}

			// Re-trigger via publishPost task
			const handle = await publishPost.trigger({ postId: post.id });

			await db
				.update(posts)
				.set({
					status: "retry",
					triggerRunId: handle.id,
					updatedAt: new Date(),
					metadata: {
						...metadata,
						retryCount: retryCount + 1,
						watchdogRetryAt: new Date().toISOString(),
						lastTriggerRunId: handle.id,
					},
				})
				.where(eq(posts.id, post.id));

			logger.info("Re-triggered stuck post via publishPost", {
				postId: post.id,
				triggerRunId: handle.id,
				retryCount: retryCount + 1,
			});

			result.stuck++;
			result.retried++;
		}

		// Find posts stuck in "publishing" state
		const stuckPublishing = await findStuckPublishing(db);
		result.checked += stuckPublishing.length;

		for (const post of stuckPublishing) {
			logger.warn("Stuck publishing post — marking as failed", {
				postId: post.id,
				updatedAt: post.updatedAt.toISOString(),
				platform: post.platform,
			});

			await db
				.update(posts)
				.set({
					status: "failed",
					failReason: "watchdog_timeout",
					updatedAt: new Date(),
					metadata: {
						...(post.metadata as Record<string, unknown> | undefined),
						failReason: "watchdog_timeout",
						failedAt: new Date().toISOString(),
					},
				})
				.where(eq(posts.id, post.id));

			result.stuck++;
			result.failed++;
		}

		logger.info("Watchdog scan complete", { ...result });
		return result;
	},
});
