import { logger, schedules } from "@trigger.dev/sdk";
import { createHubConnection } from "../core/db/connection.ts";
import { expireTimelyIdeas } from "../ideas/lifecycle.ts";

/**
 * Daily idea expiry checker.
 * Kills timely ideas past their expiration date to keep the idea bank clean.
 * Runs at 7 AM UTC daily (1 hour after trend collector) via Trigger.dev cron.
 */
export const ideaExpiry = schedules.task({
	id: "idea-expiry",
	cron: "0 7 * * *",
	maxDuration: 60, // 1 minute
	run: async () => {
		const databaseUrl = process.env.DATABASE_URL;

		if (!databaseUrl) {
			logger.error("DATABASE_URL not set -- cannot run idea expiry");
			return { status: "error", reason: "missing_env" };
		}

		const db = createHubConnection(databaseUrl);
		const userId = "default";

		try {
			const result = await expireTimelyIdeas(db, userId);

			logger.info("Idea expiry check complete", {
				expired: result.expired,
			});

			return { status: "success", expired: result.expired };
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			logger.error("Idea expiry failed", { reason });
			return { status: "error", reason };
		}
	},
});
