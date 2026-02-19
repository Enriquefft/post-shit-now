import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, lt, sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";

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
			logger.warn("Stuck scheduled post detected", {
				postId: post.id,
				scheduledAt: post.scheduledAt?.toISOString(),
				platform: post.platform,
			});

			// Mark for retry — Phase 2 will add actual re-trigger logic
			await db
				.update(posts)
				.set({
					status: "retry",
					updatedAt: new Date(),
					metadata: {
						...(post.metadata as Record<string, unknown> | undefined),
						watchdogRetryAt: new Date().toISOString(),
					},
				})
				.where(eq(posts.id, post.id));

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
