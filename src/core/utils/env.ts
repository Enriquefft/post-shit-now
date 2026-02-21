import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { type HubConnection, HubConnectionSchema } from "../../team/types.ts";
import { nanoid } from "./nanoid.ts";

export interface ValidationResult {
	valid: boolean;
	error?: string;
	suggestion?: string;
	warning?: string;
}

interface HubEnv {
	databaseUrl: string;
	triggerProjectRef: string;
	encryptionKey: string;
	hubId?: string;
}

function parseEnvFile(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) continue;
		const key = trimmed.slice(0, eqIndex).trim();
		let value = trimmed.slice(eqIndex + 1).trim();
		// Strip surrounding quotes
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

export async function loadHubEnv(
	configDir = "config",
): Promise<{ success: true; data: HubEnv } | { success: false; error: string }> {
	const filePath = join(configDir, "hub.env");
	const file = Bun.file(filePath);

	if (!(await file.exists())) {
		return {
			success: false,
			error: `Hub config not found at ${filePath}. Run /psn:setup to create it.`,
		};
	}

	const content = await file.text();
	const env = parseEnvFile(content);

	if (!env.DATABASE_URL) {
		return { success: false, error: "DATABASE_URL not found in hub.env" };
	}

	return {
		success: true,
		data: {
			databaseUrl: env.DATABASE_URL,
			triggerProjectRef: env.TRIGGER_PROJECT_REF ?? "",
			encryptionKey: env.HUB_ENCRYPTION_KEY ?? "",
			hubId: env.HUB_ID,
		},
	};
}

export async function loadKeysEnv(
	configDir = "config",
): Promise<{ success: true; data: Record<string, string> } | { success: false; error: string }> {
	const filePath = join(configDir, "keys.env");
	const file = Bun.file(filePath);

	if (!(await file.exists())) {
		return {
			success: false,
			error: `API keys not found at ${filePath}. Run /psn:setup to configure.`,
		};
	}

	const content = await file.text();
	const keys = parseEnvFile(content);

	return { success: true, data: keys };
}

export async function validateNeonApiKey(apiKey: string): Promise<ValidationResult> {
	// Step 1: Fast prefix check (immediate feedback)
	const projectScopedPrefix =
		"napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09";
	if (apiKey.startsWith(projectScopedPrefix)) {
		return {
			valid: false,
			error: "Project-scoped API key detected",
			suggestion:
				"Generate an organization-scoped API key from Neon Console -> Account -> API Keys. Organization keys start with: napi_k...",
		};
	}

	// Step 2: API validation (actual verification via minimal API call)
	try {
		const response = await fetch("https://console.neon.tech/api/v1/projects", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json",
			},
		});

		if (response.status === 401) {
			return {
				valid: false,
				error: "API key invalid or expired",
				suggestion: "Regenerate API key from Neon Console.",
			};
		}

		if (response.status === 403) {
			return {
				valid: false,
				error: "API key lacks project creation permissions",
				suggestion: "Use an organization-scoped API key with project creation permissions.",
			};
		}

		// Success: can list projects, key is valid
		return { valid: true };
	} catch (error) {
		// Network failure - don't fail hard, just warn
		return {
			valid: true, // Assume valid if can't verify
			warning: `Could not validate API key with Neon API: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

async function validateTriggerDevApiKey(apiKey: string): Promise<ValidationResult> {
	// Prefix check: Trigger.dev keys start with "tr_dev_" or "tr_prod_"
	if (!apiKey.startsWith("tr_dev_") && !apiKey.startsWith("tr_prod_")) {
		return {
			valid: false,
			error: "Invalid Trigger.dev API key format",
			suggestion:
				"Trigger.dev API keys start with 'tr_dev_' (development) or 'tr_prod_' (production).",
		};
	}

	// API validation: list projects to verify key works
	try {
		const response = await fetch("https://api.trigger.dev/v1/projects", {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.status === 401) {
			return {
				valid: false,
				error: "Trigger.dev API key invalid or expired",
				suggestion: "Regenerate API key from Trigger.dev Dashboard.",
			};
		}

		// Success: can list projects
		return { valid: true };
	} catch (error) {
		return {
			valid: true, // Assume valid if can't verify
			warning: `Could not validate Trigger.dev key: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

async function validatePerplexityApiKey(apiKey: string): Promise<ValidationResult> {
	// Prefix check: Perplexity keys start with "pplx-"
	if (!apiKey.startsWith("pplx-")) {
		return {
			valid: false,
			error: "Invalid Perplexity API key format",
			suggestion: "Perplexity API keys start with 'pplx-'.",
		};
	}

	// API validation: make a minimal API call
	try {
		const response = await fetch("https://api.perplexity.ai/models", {
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.status === 401) {
			return {
				valid: false,
				error: "Perplexity API key invalid or expired",
				suggestion: "Regenerate API key from Perplexity Settings.",
			};
		}

		// Success: can list models
		return { valid: true };
	} catch (error) {
		return {
			valid: true,
			warning: `Could not validate Perplexity key: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

async function validateAnthropicApiKey(apiKey: string): Promise<ValidationResult> {
	// Prefix check: Anthropic keys start with "sk-ant-"
	if (!apiKey.startsWith("sk-ant-")) {
		return {
			valid: false,
			error: "Invalid Anthropic API key format",
			suggestion: "Anthropic API keys start with 'sk-ant-'.",
		};
	}

	// API validation: list models
	try {
		const response = await fetch("https://api.anthropic.com/v1/models", {
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
		});

		if (response.status === 401) {
			return {
				valid: false,
				error: "Anthropic API key invalid or expired",
				suggestion: "Regenerate API key from Anthropic Console.",
			};
		}

		// Success: can list models
		return { valid: true };
	} catch (error) {
		return {
			valid: true,
			warning: `Could not validate Anthropic key: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

// Map of provider names to validation functions
const VALIDATORS: Record<string, (key: string) => Promise<ValidationResult>> = {
	neon: validateNeonApiKey,
	trigger: validateTriggerDevApiKey,
	perplexity: validatePerplexityApiKey,
	anthropic: validateAnthropicApiKey,
	// Add more validators as needed
};

/**
 * Validate a provider API key using the appropriate validator.
 * Returns valid=true if no validator exists for the provider (graceful degradation).
 */
export async function validateProviderKey(
	service: string,
	apiKey: string,
): Promise<ValidationResult> {
	const validator = VALIDATORS[service];
	if (!validator) {
		// No validator defined for this provider - assume valid
		return { valid: true };
	}
	return await validator(apiKey);
}

export { parseEnvFile };

/**
 * Migrate Personal Hub from config/hub.env to .hubs/personal.json.
 * One-time migration: if hub.env exists and personal.json doesn't, migrate automatically.
 * Auto-generates nanoid-style hubId if HUB_ID is missing from legacy hub.env.
 */
export async function migratePersonalHubToHubsDir(
	configDir = "config",
	projectRoot = ".",
): Promise<
	{ success: true; migrated: boolean; hubId?: string } | { success: false; error: string }
> {
	const hubEnvPath = join(projectRoot, configDir, "hub.env");
	const hubsDir = join(projectRoot, ".hubs");
	const personalHubPath = join(hubsDir, "personal.json");

	// Check if migration is needed
	try {
		await readFile(personalHubPath);
		// personal.json exists, already migrated
		return { success: true, migrated: false };
	} catch {
		// personal.json doesn't exist, check if hub.env exists
	}

	try {
		await readFile(hubEnvPath);
	} catch {
		// Neither file exists, no migration needed
		return { success: true, migrated: false };
	}

	// Migrate: read hub.env, parse, write personal.json
	try {
		const hubEnvContent = await readFile(hubEnvPath, "utf-8");
		const env = parseEnvFile(hubEnvContent);

		// Generate hubId if missing (legacy hub.env files)
		const hubId = env.HUB_ID || `hub_${nanoid()}`;

		const hubConnection: HubConnection = {
			hubId,
			slug: "personal",
			displayName: "Personal Hub",
			databaseUrl: env.DATABASE_URL || "",
			triggerProjectId: env.TRIGGER_PROJECT_REF || "",
			encryptionKey: env.HUB_ENCRYPTION_KEY || "",
			role: "admin",
			joinedAt: new Date().toISOString(),
		};

		// Validate with schema before writing (prevents partial state corruption)
		const validated = HubConnectionSchema.parse(hubConnection);

		// Ensure .hubs directory exists
		await mkdir(hubsDir, { recursive: true });

		// Write personal.json (only after validation succeeds)
		await Bun.write(personalHubPath, JSON.stringify(validated, null, 2));

		// Delete old hub.env
		await rm(hubEnvPath);

		return { success: true, migrated: true, hubId };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			success: false,
			error: `Failed to migrate Personal Hub: ${message}`,
		};
	}
}
