import { logger, schedules } from "@trigger.dev/sdk";
import { generateMonthlyAnalysis } from "../analytics/monthly.ts";
import { createHubConnection } from "../core/db/connection.ts";

/**
 * Monthly deep analysis task.
 * Runs on the 1st of each month at 8am UTC.
 * Covers voice drift, audience signals, risk budget, and strategic recommendations.
 */
export const monthlyAnalysis = schedules.task({
	id: "monthly-analysis",
	cron: "0 8 1 * *",
	maxDuration: 600,
	run: async () => {
		const databaseUrl = process.env.DATABASE_URL;

		if (!databaseUrl) {
			logger.error("DATABASE_URL not set -- cannot run monthly analysis");
			return { status: "error", reason: "missing_env" };
		}

		const db = createHubConnection(databaseUrl);
		const userId = "default";

		try {
			const analysis = await generateMonthlyAnalysis(db, userId);

			logger.info("Monthly analysis complete", {
				voiceDriftDetected: analysis.voiceDrift.detected,
				audienceSignals: analysis.audienceSignals.length,
				autoAdjustments: analysis.riskBudget.autoAdjustmentsCount,
				strategicRecs: analysis.strategicRecommendations.length,
				reportPath: analysis.reportPath,
			});

			return { status: "success", reportPath: analysis.reportPath };
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			logger.error("Monthly analysis failed", { reason });
			return { status: "error", reason };
		}
	},
});
