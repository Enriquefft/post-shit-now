import { logger } from "@trigger.dev/sdk";

/** Core env vars required by all tasks */
export const CORE_ENV_VARS = ["DATABASE_URL"] as const;

/** Env vars for tasks that decrypt stored OAuth tokens */
export const CRYPTO_ENV_VARS = [...CORE_ENV_VARS, "HUB_ENCRYPTION_KEY"] as const;

/** X (Twitter) platform credentials */
export const X_ENV_VARS = ["X_CLIENT_ID", "X_CLIENT_SECRET"] as const;

/** LinkedIn platform credentials */
export const LINKEDIN_ENV_VARS = ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const;

/** Instagram platform credentials */
export const INSTAGRAM_ENV_VARS = ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"] as const;

/** TikTok platform credentials */
export const TIKTOK_ENV_VARS = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] as const;

/**
 * All env var names that syncEnvVars pushes to Trigger.dev Cloud at deploy time.
 * Union of all groups + notification service vars.
 *
 * NOTE: TRIGGER_SECRET_KEY is intentionally excluded -- Trigger.dev Cloud
 * sets it automatically and overwriting it causes task-to-task auth failures.
 */
export const SYNC_ENV_VAR_NAMES = [
	...CRYPTO_ENV_VARS,
	...X_ENV_VARS,
	...LINKEDIN_ENV_VARS,
	...INSTAGRAM_ENV_VARS,
	...TIKTOK_ENV_VARS,
	"WAHA_BASE_URL",
	"WAHA_API_KEY",
	"WAHA_SESSION",
	"TWILIO_ACCOUNT_SID",
	"TWILIO_AUTH_TOKEN",
	"TWILIO_FROM_NUMBER",
] as const;

/**
 * Validates that all required env vars are present and returns them as a typed record.
 * Collects ALL missing vars before throwing (not just the first).
 *
 * @param varNames - Array of env var names to validate
 * @param taskId - Task identifier for error context
 * @returns Record mapping each var name to its value
 * @throws Error if any vars are missing, with actionable fix instructions
 */
export function requireEnvVars<T extends readonly string[]>(
	varNames: T,
	taskId: string,
): Record<T[number], string> {
	const result = {} as Record<string, string>;
	const missing: string[] = [];

	for (const name of varNames) {
		const value = process.env[name];
		if (value) {
			result[name] = value;
		} else {
			missing.push(name);
		}
	}

	if (missing.length > 0) {
		const message = [
			`[${taskId}] Missing ${missing.length} required env var(s):`,
			...missing.map((v) => `  - ${v}`),
			"",
			"Fix: redeploy with `bunx trigger.dev deploy` after setting these vars locally,",
			"or set them directly in the Trigger.dev dashboard under Environment Variables.",
		].join("\n");

		logger.error(message);
		throw new Error(message);
	}

	return result as Record<T[number], string>;
}
