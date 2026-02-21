import { join } from "node:path";
import readlineSync from "readline-sync";
import { listKeys, setApiKey } from "../core/db/api-keys";
import { createHubConnection } from "../core/db/connection.ts";
import type { SetupResult } from "../core/types/index.ts";
import { loadHubEnv, parseEnvFile, validateProviderKey } from "../core/utils/env.ts";

const REQUIRED_KEYS_PHASE1 = [
	{ name: "NEON_API_KEY", source: "Neon Console -> Settings -> API Keys -> Generate new key" },
	{
		name: "TRIGGER_SECRET_KEY",
		source: "Trigger.dev Dashboard -> Project Settings -> API Keys",
	},
];

// ─── Provider Key Definitions ────────────────────────────────────────────────

const PROVIDER_KEYS = [
	{
		name: "perplexity",
		service: "Perplexity AI",
		source: "https://www.perplexity.ai/settings/api",
	},
	{ name: "brave", service: "Brave Search", source: "https://api.search.brave.com" },
	{ name: "tavily", service: "Tavily", source: "https://tavily.com/api" },
	{ name: "exa", service: "Exa AI", source: "https://exa.ai/api" },
	{ name: "openai", service: "OpenAI (GPT Image)", source: "https://platform.openai.com/api-keys" },
	{ name: "ideogram", service: "Ideogram", source: "https://ideogram.ai/api" },
	{ name: "fal", service: "fal.ai (Flux/Kling/Pika)", source: "https://fal.ai/dashboard" },
	{ name: "runway", service: "Runway ML", source: "https://runwayml.com/console" },
];

// ─── Masked Input Functions ──────────────────────────────────────────────────

/**
 * Prompt for API key with masked input.
 * Validates key format and makes minimal API test before accepting.
 *
 * @param keyName - Name of the key (e.g., "perplexity", "openai")
 * @param service - Display name of service (e.g., "Perplexity AI")
 * @returns The validated API key, or null if user cancels
 */
export async function promptForKey(
	keyName: string,
	service: string,
): Promise<string | null> {
	// Display source info if available
	const PROVIDER_SOURCE_MAP: Record<string, string> = {
		perplexity: "https://www.perplexity.ai/settings/api",
		brave: "https://api.search.brave.com",
		tavily: "https://tavily.com/api",
		exa: "https://exa.ai/api",
		openai: "https://platform.openai.com/api-keys",
		ideogram: "https://ideogram.ai/api",
		fal: "https://fal.ai/dashboard",
		runway: "https://runwayml.com/console",
	};

	const source = PROVIDER_SOURCE_MAP[keyName];
	if (source) {
		console.log(`\nGet your API key from: ${source}`);
	}

	// Prompt with masked input
	const apiKey = readlineSync.question(
		`\nEnter ${service} API key (input will be hidden): `,
		{
			hideEchoBack: true, // Hide typed characters
			mask: "*", // Show asterisks instead of nothing
		},
	);

	// Allow user to cancel
	if (!apiKey || apiKey.trim() === "") {
		console.log("Cancelled (no key provided).");
		return null;
	}

	// Validate key with format check + minimal API test
	console.log("Validating API key...");
	const validation = await validateProviderKey(keyName, apiKey);

	if (!validation.valid) {
		console.error(`❌ Invalid ${service} API key: ${validation.error}`);
		if (validation.suggestion) {
			console.log(`   Hint: ${validation.suggestion}`);
		}

		// Reprompt once on validation failure
		const retry = readlineSync.question("\nTry again? (y/n): ");
		if (retry.toLowerCase() === "y") {
			return promptForKey(keyName, service); // Recursive retry
		}
		return null;
	}

	if (validation.warning) {
		console.log(`⚠️  Warning: ${validation.warning}`);
	}

	console.log(`✅ ${service} API key validated.`);

	return apiKey;
}

// ─── Hub ID Extraction ──────────────────────────────────────────────────────

async function getHubIdForSetup(configDir = "config"): Promise<string> {
	// Try to load from hub.env (Personal Hub)
	const hubEnvResult = await loadHubEnv(configDir);
	if (hubEnvResult.success && hubEnvResult.data.hubId) {
		return hubEnvResult.data.hubId;
	}

	// Fallback: use "default" for Personal Hub without explicit hubId
	return "default";
}

// ─── Phase 1: Original Keys ───────────────────────────────────────────────

/**
 * Collect and store API keys in config/keys.env.
 * Returns need_input status for each missing key so Claude can prompt user.
 */
export async function setupKeys(configDir = "config"): Promise<SetupResult | SetupResult[]> {
	const filePath = join(configDir, "keys.env");
	const file = Bun.file(filePath);

	let existingKeys: Record<string, string> = {};
	if (await file.exists()) {
		const content = await file.text();
		existingKeys = parseEnvFile(content);
	}

	const missingKeys: SetupResult[] = [];
	for (const keyDef of REQUIRED_KEYS_PHASE1) {
		if (!existingKeys[keyDef.name]) {
			missingKeys.push({
				step: "keys",
				status: "need_input",
				message: `Provide ${keyDef.name}`,
				data: { key: keyDef.name, source: keyDef.source },
			});
		}
	}

	if (missingKeys.length > 0) {
		return missingKeys;
	}

	return {
		step: "keys",
		status: "success",
		message: "All required API keys are configured",
		data: { configuredKeys: Object.keys(existingKeys) },
	};
}

/**
 * Write or update a key in config/keys.env.
 */
export async function writeKey(
	key: string,
	value: string,
	configDir = "config",
): Promise<SetupResult> {
	// Validate NEON_API_KEY specifically
	if (key === "NEON_API_KEY") {
		const validation = await validateProviderKey("neon", value);
		if (!validation.valid) {
			return {
				step: "keys",
				status: "error",
				message: `NEON_API_KEY validation failed: ${validation.error}`,
				data: {
					error: validation.error,
					suggestion: validation.suggestion,
				},
			};
		}
	}

	const filePath = join(configDir, "keys.env");
	const file = Bun.file(filePath);

	let existingKeys: Record<string, string> = {};
	if (await file.exists()) {
		const content = await file.text();
		existingKeys = parseEnvFile(content);
	}

	existingKeys[key] = value;

	const lines = Object.entries(existingKeys).map(([k, v]) => `${k}=${v}`);
	await Bun.write(filePath, `${lines.join("\n")}\n`);

	return {
		step: "keys",
		status: "success",
		message: `${key} saved to ${filePath}`,
	};
}

// ─── Phase 2: Provider Keys (DB-based) ─────────────────────────────────────

/**
 * Check which provider keys are configured in the database.
 * Returns need_input status for missing keys so Claude can prompt user.
 */
export async function setupProviderKeys(
	configDir = "config",
): Promise<SetupResult | SetupResult[]> {
	const hubEnv = await loadHubEnv(configDir);
	if (!hubEnv.success) {
		return { step: "keys", status: "error", message: hubEnv.error };
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);
	const hubId = await getHubIdForSetup(configDir);

	try {
		const missingKeys: SetupResult[] = [];
		const existingKeys = await listKeys(db, hubId);
		const configuredServices = new Set(existingKeys.map((k) => k.service));

		for (const provider of PROVIDER_KEYS) {
			if (!configuredServices.has(provider.name)) {
				missingKeys.push({
					step: "keys",
					status: "need_input",
					message: `Provide ${provider.service} API key`,
					data: { key: provider.name, service: provider.service, source: provider.source },
				});
			}
		}

		if (missingKeys.length > 0) {
			return missingKeys;
		}

		return {
			step: "keys",
			status: "success",
			message: "All provider API keys are configured",
			data: { configuredServices: Array.from(configuredServices) },
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			step: "keys",
			status: "error",
			message: `Failed to check provider keys: ${message}`,
		};
	}
}

/**
 * Write or update a provider key in the database.
 */
export async function writeProviderKey(
	hubId: string,
	service: string,
	value: string,
	configDir = "config",
): Promise<SetupResult> {
	const hubEnv = await loadHubEnv(configDir);
	if (!hubEnv.success) {
		return { step: "keys", status: "error", message: hubEnv.error };
	}

	// Validate provider key before saving
	const validation = await validateProviderKey(service, value);
	if (!validation.valid) {
		return {
			step: "keys",
			status: "error",
			message: `${service} API key validation failed: ${validation.error}`,
			data: {
				error: validation.error,
				suggestion: validation.suggestion,
			},
		};
	}

	if (validation.warning) {
		console.warn(`Warning: ${validation.warning}`);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	try {
		await setApiKey(db, hubId, service, service, value);
		return {
			step: "keys",
			status: "success",
			message: `${service} key saved to database for hub ${hubId}`,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			step: "keys",
			status: "error",
			message: `Failed to save ${service} key: ${message}`,
		};
	}
}

/**
 * List all configured provider keys for a hub.
 */
export async function listProviderKeys(configDir = "config"): Promise<SetupResult> {
	const hubEnv = await loadHubEnv(configDir);
	if (!hubEnv.success) {
		return { step: "keys", status: "error", message: hubEnv.error };
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);
	const hubId = await getHubIdForSetup(configDir);

	try {
		const keys = await listKeys(db, hubId);
		return {
			step: "keys",
			status: "success",
			message: `Found ${keys.length} configured provider keys`,
			data: { keys },
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			step: "keys",
			status: "error",
			message: `Failed to list provider keys: ${message}`,
		};
	}
}
