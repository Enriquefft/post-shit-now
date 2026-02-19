import { logger, task } from "@trigger.dev/sdk";
import { createHubConnection } from "../core/db/connection.ts";

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
		const requiredEnvVars = ["DATABASE_URL"];
		const missingEnv = requiredEnvVars.filter((v) => !process.env[v]);

		if (missingEnv.length === 0) {
			report.env = "ok";
		} else {
			report.details.missingEnv = missingEnv.join(", ");
			logger.error("Missing environment variables", { missing: missingEnv });
		}

		// Test DB connection
		const databaseUrl = process.env.DATABASE_URL;
		if (databaseUrl) {
			try {
				const db = createHubConnection(databaseUrl);
				await db.execute("SELECT 1 as health_check");
				report.database = "ok";
				logger.info("Database connection healthy");
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				report.details.databaseError = msg;
				logger.error("Database connection failed", { error: msg });
			}
		} else {
			report.details.databaseError = "DATABASE_URL not set";
		}

		logger.info("Health check complete", { ...report });
		return report;
	},
});
