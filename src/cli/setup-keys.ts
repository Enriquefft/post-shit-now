import { join } from "node:path";
import type { SetupResult } from "../core/types/index.ts";
import { createHubConnection, getHubDb, type HubDb } from "../core/db/connection.ts";
import { parseEnvFile, loadHubEnv } from "../core/utils/env.ts";
import { getApiKey, setApiKey, listKeys } from "../core/db/api-keys";

const REQUIRED_KEYS_PHASE1 = [
	{ name: "NEON_API_KEY", source: "Neon Console -> Settings -> API Keys -> Generate new key" },
	{
		name: "TRIGGER_SECRET_KEY",
		source: "Trigger.dev Dashboard -> Project Settings -> API Keys",
	},
];

// ─── Provider Key Definitions ────────────────────────────────────────────────

const PROVIDER_KEYS = [
	{ name: "perplexity", service: "Perplexity AI", source: "https://www.perplexity.ai/settings/api" },
	{ name: "brave", service: "Brave Search", source: "https://api.search.brave.com" },
	{ name: "tavily", service: "Tavily", source: "https://tavily.com/api" },
	{ name: "exa", service: "Exa AI", source: "https://exa.ai/api" },
	{ name: "openai", service: "OpenAI (GPT Image)", source: "https://platform.openai.com/api-keys" },
	{ name: "ideogram", service: "Ideogram", source: "https://ideogram.ai/api" },
	{ name: "fal", service: "fal.ai (Flux/Kling/Pika)", source: "https://fal.ai/dashboard" },
	{ name: "runway", service: "Runway ML", source: "https://runwayml.com/console" },
];

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
export async function setupProviderKeys(configDir = "config"): Promise<SetupResult | SetupResult[]> {
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
