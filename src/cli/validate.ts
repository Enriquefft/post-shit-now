import { existsSync, readFileSync } from "node:fs";
import { createHubConnection } from "../core/db/connection.ts";
import type { ValidationResult, ValidationSummary } from "../core/types/index.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";

/**
 * Validate all Hub connections and configuration.
 * Each check is independent — all checks run even if some fail.
 */
export async function validateAll(configDir = "config"): Promise<ValidationSummary> {
	const results: ValidationResult[] = [];

	// Check 1: Database connectivity
	results.push(await checkDatabase(configDir));

	// Check 2: Trigger.dev configuration
	results.push(await checkTrigger(configDir));

	// Check 3: Config directory structure
	results.push(checkConfigStructure(configDir));

	// Check 4: API keys present
	results.push(await checkApiKeys(configDir));

	const allPassed = results.every((r) => r.status === "pass");

	return { allPassed, results };
}

async function checkDatabase(configDir: string): Promise<ValidationResult> {
	const env = await loadHubEnv(configDir);
	if (!env.success) {
		return { check: "database", status: "fail", message: env.error };
	}

	try {
		const db = createHubConnection(env.data.databaseUrl);
		// Execute a simple query to verify connectivity
		const result = await db.execute("SELECT 1 as ok");
		if (result) {
			return {
				check: "database",
				status: "pass",
				message: "Database connection successful",
			};
		}
		return {
			check: "database",
			status: "fail",
			message: "Database query returned no result",
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { check: "database", status: "fail", message: `Database connection failed: ${msg}` };
	}
}

async function checkTrigger(configDir: string): Promise<ValidationResult> {
	const keysResult = await loadKeysEnv(configDir);

	if (!keysResult.success) {
		return {
			check: "trigger",
			status: "fail",
			message: "keys.env not found — Trigger.dev secret key missing",
		};
	}

	if (!keysResult.data.TRIGGER_SECRET_KEY) {
		return {
			check: "trigger",
			status: "fail",
			message: "TRIGGER_SECRET_KEY not found in keys.env",
		};
	}

	// Check trigger.config.ts has a real project ref
	try {
		const config = readFileSync("trigger.config.ts", "utf-8");
		if (config.includes("<your-project-ref>")) {
			return {
				check: "trigger",
				status: "fail",
				message: "trigger.config.ts still has placeholder project ref",
			};
		}
		return {
			check: "trigger",
			status: "pass",
			message: "Trigger.dev configured with secret key and project ref",
		};
	} catch {
		return {
			check: "trigger",
			status: "fail",
			message: "trigger.config.ts not found",
		};
	}
}

function checkConfigStructure(configDir: string): ValidationResult {
	const requiredDirs = ["voice-profiles", "series", "connections", "company"];

	const missing = requiredDirs.filter((dir) => !existsSync(`${configDir}/${dir}`));

	if (missing.length > 0) {
		return {
			check: "config-structure",
			status: "fail",
			message: `Missing config directories: ${missing.join(", ")}`,
		};
	}

	return {
		check: "config-structure",
		status: "pass",
		message: "Config directory structure is complete",
	};
}

async function checkApiKeys(configDir: string): Promise<ValidationResult> {
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { check: "api-keys", status: "fail", message: keysResult.error };
	}

	const required = ["NEON_API_KEY", "TRIGGER_SECRET_KEY"];
	const missing = required.filter((k) => !keysResult.data[k]);

	if (missing.length > 0) {
		return {
			check: "api-keys",
			status: "fail",
			message: `Missing required keys: ${missing.join(", ")}`,
		};
	}

	return {
		check: "api-keys",
		status: "pass",
		message: `All required API keys present (${required.length}/${required.length})`,
	};
}
