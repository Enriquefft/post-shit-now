import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";
import { SYNC_ENV_VAR_NAMES } from "./src/trigger/env-validation.ts";

export default defineConfig({
	runtime: "bun",
	project: "<your-project-ref>", // Replaced during /psn:setup
	dirs: ["./src/trigger"],
	retries: {
		enabledInDev: false,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	maxDuration: 300,
	build: {
		extensions: [
			syncEnvVars(async (ctx) => {
				const synced: { name: string; value: string }[] = [];
				const skipped: string[] = [];

				for (const name of SYNC_ENV_VAR_NAMES) {
					const value = process.env[name];
					if (value) {
						synced.push({ name, value });
					} else {
						skipped.push(name);
					}
				}

				// Critical vars must be present -- abort deploy if missing
				const criticalMissing: string[] = [];
				if (!process.env.DATABASE_URL) criticalMissing.push("DATABASE_URL");
				if (!process.env.HUB_ENCRYPTION_KEY)
					criticalMissing.push("HUB_ENCRYPTION_KEY");

				if (criticalMissing.length > 0) {
					console.error(
						`[trigger.config] ABORTING DEPLOY: Missing critical env vars: ${criticalMissing.join(", ")}.\n` +
							"Run /psn:setup to configure your hub before deploying.",
					);
					throw new Error(
						`Missing critical env vars: ${criticalMissing.join(", ")}. Run /psn:setup to configure your hub.`,
					);
				}

				console.log(
					`Syncing ${synced.length} env vars to Trigger.dev Cloud (${ctx.environment}): ${synced.map((v) => v.name).join(", ")}`,
				);

				if (skipped.length > 0) {
					console.info(
						`Skipping ${skipped.length} unset env vars (platform not configured): ${skipped.join(", ")}`,
					);
				}

				return synced;
			}),
		],
	},
});
