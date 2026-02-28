import { readFileSync, writeFileSync } from "node:fs";
import type { SetupResult } from "../core/types/index.ts";
import { loadKeysEnv } from "../core/utils/env.ts";
import { formatErrorWithMasking, maskApiKey } from "./utils/masking.ts";
import { createProgressStep, runStep } from "./utils/progress.ts";

const TRIGGER_CONFIG_PATH = "trigger.config.ts";
const PLACEHOLDER_REF = "<your-project-ref>";

/**
 * Interface for detected project ref from various sources.
 */
export interface DetectedProjectRef {
	source: "config" | "secret-key" | "env" | "none";
	projectRef?: string;
	environment?: "dev" | "prod";
}

/**
 * Type alias for loadKeysEnv result type.
 */
type KeysResult = Awaited<ReturnType<typeof loadKeysEnv>>;

/**
 * Detect project ref from multiple sources.
 * Priority: env var > secret key format > none
 *
 * @param keysResult - Result from loadKeysEnv()
 * @returns DetectedProjectRef with source and details
 */
export function detectProjectRef(keysResult: KeysResult): DetectedProjectRef {
	if (!keysResult.success) {
		return { source: "none" };
	}

	const { TRIGGER_PROJECT_REF, TRIGGER_SECRET_KEY } = keysResult.data;

	// Priority 1: TRIGGER_PROJECT_REF env var
	if (TRIGGER_PROJECT_REF) {
		const environment = TRIGGER_SECRET_KEY?.startsWith("tr_prod_") ? "prod" : "dev";
		return { source: "env", projectRef: TRIGGER_PROJECT_REF, environment };
	}

	// Priority 2: Extract from secret key format (tr_dev_PROJECTREF_... or tr_prod_PROJECTREF_...)
	if (TRIGGER_SECRET_KEY) {
		const match = TRIGGER_SECRET_KEY.match(/^tr_(dev|prod)_([a-zA-Z0-9]+)_/);
		if (match) {
			return {
				source: "secret-key",
				projectRef: match[2],
				environment: match[1] === "prod" ? "prod" : "dev",
			};
		}
	}

	// No project ref found
	return { source: "none" };
}

/**
 * Verify Trigger.dev project via CLI whoami command.
 *
 * @param projectRef - Project reference to verify
 * @param secretKey - Trigger.dev secret key for authentication
 * @returns Verification result with status and suggested actions
 */
export async function verifyTriggerProject(
	projectRef: string,
	secretKey: string,
): Promise<{ valid: boolean; error?: string; suggestedAction?: string }> {
	try {
		// Run Trigger.dev CLI whoami command
		const proc = Bun.spawn(
			["bunx", "trigger.dev@latest", "whoami", "--api-key", maskApiKey(secretKey)],
			{
				stdout: "pipe",
				stderr: "pipe",
				env: { ...process.env, TRIGGER_SECRET_KEY: secretKey },
			},
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();

		// Authentication error
		if (
			exitCode !== 0 &&
			(stderr.includes("401") ||
				stderr.includes("Unauthorized") ||
				stderr.includes("not authenticated"))
		) {
			return {
				valid: false,
				error: "Invalid TRIGGER_SECRET_KEY or insufficient permissions",
				suggestedAction: "Check your Trigger.dev secret key in keys.env",
			};
		}

		// Network/connectivity error
		if (
			exitCode !== 0 &&
			(stderr.includes("ECONNREFUSED") ||
				stderr.includes("network") ||
				stderr.includes("ENOTFOUND"))
		) {
			return {
				valid: false,
				error: "Cannot connect to Trigger.dev",
				suggestedAction: "Check your internet connection",
			};
		}

		// CLI succeeded - verify project ref matches
		if (exitCode === 0) {
			// Parse output to check if project ref is found
			// The whoami output includes project information
			const output = stdout || stderr;

			// If project ref is mentioned in output, verify it matches
			if (output.includes(projectRef)) {
				return { valid: true };
			}

			// Project ref mismatch
			return {
				valid: false,
				error: `Configured project ref (${projectRef}) does not match Trigger.dev project`,
				suggestedAction:
					"Update trigger.config.ts with the correct project ref or run /psn:setup trigger to reconfigure",
			};
		}

		// Unknown error
		return {
			valid: false,
			error: "Trigger.dev verification failed",
			suggestedAction: "Run /psn:setup trigger to reconfigure",
		};
	} catch (error) {
		// Unexpected error
		return {
			valid: false,
			error: `Trigger.dev verification failed: ${error instanceof Error ? error.message : String(error)}`,
			suggestedAction: "Check your internet connection and Trigger.dev credentials",
		};
	}
}

/**
 * Set up Trigger.dev project configuration.
 * Updates trigger.config.ts with the project ref.
 * Resumes from failure: skips if config already has a real project ref.
 */
export async function setupTrigger(configDir = "config"): Promise<SetupResult> {
	// Display step list upfront
	createProgressStep([
		"Detecting project ref",
		"Verifying Trigger.dev connectivity",
		"Updating trigger.config.ts",
	]);

	// Check if trigger.config.ts already has a real project ref
	const configContent = readFileSync(TRIGGER_CONFIG_PATH, "utf-8");
	if (!configContent.includes(PLACEHOLDER_REF)) {
		return {
			step: "trigger",
			status: "skipped",
			message: "Trigger.dev already configured (project ref found in trigger.config.ts)",
		};
	}

	// Load Trigger secret key
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "trigger",
			status: "error",
			message: keysResult.error,
		};
	}

	const secretKey = keysResult.data.TRIGGER_SECRET_KEY;
	if (!secretKey) {
		return {
			step: "trigger",
			status: "error",
			message: "TRIGGER_SECRET_KEY not found in keys.env. Run key setup first.",
		};
	}

	// Detect project ref from available sources
	const detected = detectProjectRef(keysResult);

	// If no project ref detected, run trigger.dev init
	if (detected.source === "none") {
		// Run trigger.dev init to create/link project (long-running operation)
		await runStep("Initializing Trigger.dev project", async () => {
			const proc = Bun.spawn(["bunx", "trigger.dev@latest", "init", "--skip-package-install"], {
				stdout: "pipe",
				stderr: "pipe",
				env: { ...process.env, TRIGGER_SECRET_KEY: secretKey },
			});

			const exitCode = await proc.exited;
			const stderr = await new Response(proc.stderr).text();

			if (exitCode !== 0) {
				throw new Error(
					formatErrorWithMasking(
						`trigger.dev init failed: ${stderr.trim()}. You can manually set TRIGGER_PROJECT_REF in keys.env.`,
						{ apiKey: secretKey },
					),
				);
			}

			// Re-read config to check if init updated it
			const updatedConfig = readFileSync(TRIGGER_CONFIG_PATH, "utf-8");
			if (updatedConfig.includes(PLACEHOLDER_REF)) {
				throw new Error(
					"Could not auto-detect project ref. Please provide your Trigger.dev project ref (starts with proj_).",
				);
			}
		});

		return {
			step: "trigger",
			status: "success",
			message: "Trigger.dev project initialized via CLI",
		};
	}

	// Project ref detected - verify it
	if (!detected.projectRef) {
		throw new Error("Project ref not found despite detection — unexpected state");
	}
	const projectRef = detected.projectRef;
	await runStep("Verifying Trigger.dev project connectivity", async () => {
		const verification = await verifyTriggerProject(projectRef, secretKey);
		if (!verification.valid) {
			throw new Error(
				`${verification.error}. ${verification.suggestedAction || "Run /psn:setup trigger --verify for more details."}`,
			);
		}
	});

	// Update trigger.config.ts with the project ref
	const updated = configContent.replace(PLACEHOLDER_REF, projectRef);
	writeFileSync(TRIGGER_CONFIG_PATH, updated);

	return {
		step: "trigger",
		status: "success",
		message: `Trigger.dev configured with project ref: ${projectRef} (detected from ${detected.source})`,
		data: { projectRef, source: detected.source },
	};
}

/**
 * Verify Trigger.dev setup and return detailed status.
 * Used by /psn:setup trigger --verify command.
 *
 * @param configDir - Configuration directory
 * @returns SetupResult with verification details
 */
export async function verifyTriggerSetup(configDir = "config"): Promise<SetupResult> {
	// Load Trigger secret key
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "trigger",
			status: "error",
			message: keysResult.error,
		};
	}

	const secretKey = keysResult.data.TRIGGER_SECRET_KEY;
	if (!secretKey) {
		return {
			step: "trigger",
			status: "error",
			message: "TRIGGER_SECRET_KEY not found in keys.env",
			suggestedAction: "Run /psn:setup to configure your Trigger.dev secret key",
		};
	}

	// Detect project ref
	const detected = detectProjectRef(keysResult);

	if (detected.source === "none") {
		return {
			step: "trigger",
			status: "error",
			message: "No project ref detected from config file or secret key",
			suggestedAction:
				"Set TRIGGER_PROJECT_REF in keys.env or ensure your secret key has the correct format (tr_dev_PROJECTREF_...)",
			data: { secretKeyFormat: maskApiKey(secretKey) },
		};
	}

	if (!detected.projectRef) {
		return {
			step: "trigger",
			status: "error",
			message: "Project ref not found despite detection — unexpected state",
		};
	}
	const projectRef = detected.projectRef;

	// Verify project via Trigger.dev CLI
	const verification = await verifyTriggerProject(projectRef, secretKey);

	if (!verification.valid) {
		return {
			step: "trigger",
			status: "error",
			message: verification.error || "Trigger.dev verification failed",
			suggestedAction: verification.suggestedAction,
			data: { projectRef, source: detected.source, environment: detected.environment },
		};
	}

	return {
		step: "trigger",
		status: "success",
		message: `Trigger.dev verified successfully - project ref: ${projectRef} (from ${detected.source})`,
		data: { projectRef, source: detected.source, environment: detected.environment },
	};
}
