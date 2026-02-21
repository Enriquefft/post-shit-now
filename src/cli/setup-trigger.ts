import { readFileSync, writeFileSync } from "node:fs";
import type { SetupResult } from "../core/types/index.ts";
import { loadKeysEnv } from "../core/utils/env.ts";
import { formatErrorWithMasking, maskApiKey } from "./utils/masking.ts";

const TRIGGER_CONFIG_PATH = "trigger.config.ts";
const PLACEHOLDER_REF = "<your-project-ref>";

/**
 * Set up Trigger.dev project configuration.
 * Updates trigger.config.ts with the project ref.
 * Resumes from failure: skips if config already has a real project ref.
 */
export async function setupTrigger(configDir = "config"): Promise<SetupResult> {
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

	// Extract project ref from secret key (format: tr_dev_PROJECTREF_...)
	// or from TRIGGER_PROJECT_REF if set
	let projectRef: string = keysResult.data.TRIGGER_PROJECT_REF ?? "";

	if (!projectRef) {
		// Try to extract from the secret key format
		const match = secretKey.match(/^tr_(?:dev|prod)_([a-zA-Z0-9]+)_/);
		if (match?.[1]) {
			projectRef = match[1];
		}
	}

	if (!projectRef) {
		// Run trigger.dev init to create/link project
		const proc = Bun.spawn(["bunx", "trigger.dev@latest", "init", "--skip-package-install"], {
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env, TRIGGER_SECRET_KEY: secretKey },
		});

		const exitCode = await proc.exited;
		const stderr = await new Response(proc.stderr).text();

		if (exitCode !== 0) {
			return {
				step: "trigger",
				status: "error",
				message: formatErrorWithMasking(
					`trigger.dev init failed: ${stderr.trim()}. You can manually set TRIGGER_PROJECT_REF in keys.env.`,
					{ apiKey: secretKey },
				),
			};
		}

		// Re-read config to check if init updated it
		const updatedConfig = readFileSync(TRIGGER_CONFIG_PATH, "utf-8");
		if (updatedConfig.includes(PLACEHOLDER_REF)) {
			return {
				step: "trigger",
				status: "need_input",
				message:
					"Could not auto-detect project ref. Please provide your Trigger.dev project ref (starts with proj_).",
				data: {
					key: "TRIGGER_PROJECT_REF",
					source: "Trigger.dev Dashboard -> Project Settings -> General",
				},
			};
		}

		return {
			step: "trigger",
			status: "success",
			message: "Trigger.dev project initialized via CLI",
		};
	}

	// Update trigger.config.ts with the project ref
	const updated = configContent.replace(PLACEHOLDER_REF, projectRef);
	writeFileSync(TRIGGER_CONFIG_PATH, updated);

	return {
		step: "trigger",
		status: "success",
		message: `Trigger.dev configured with project ref: ${projectRef}`,
		data: { projectRef },
	};
}
