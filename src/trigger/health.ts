import { logger, task } from "@trigger.dev/sdk";
import { createHubConnection } from "../core/db/connection.ts";
import { CORE_ENV_VARS, requireEnvVars } from "./env-validation.ts";

export interface HealthReport {
	database: "ok" | "error";
	env: "ok" | "error";
	timestamp: string;
	details: Record<string, string>;
}

/**
 * Health check task — triggered on demand to verify Hub connectivity.
 * Run this during setup validation or periodic monitoring.
 */
export const healthCheck = task({
	id: "health-check",
	maxDuration: 30,
	run: async (): Promise<HealthReport> => {
		const report: HealthReport = {
			database: "error",
			env: "error",
			timestamp: new Date().toISOString(),
			details: {},
		};

		// Check critical env vars
		const env = requireEnvVars(CORE_ENV_VARS, "health-check");
		report.env = "ok";

		// Test DB connection
		try {
			const db = createHubConnection(env.DATABASE_URL);
			await db.execute("SELECT 1 as health_check");
			report.database = "ok";
			logger.info("Database connection healthy");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			report.details.databaseError = msg;
			logger.error("Database connection failed", { error: msg });
		}

		logger.info("Health check complete", { ...report });
		return report;
	},
});
