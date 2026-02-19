import { join } from "node:path";
import type { SetupResult } from "../core/types/index.ts";
import { parseEnvFile } from "../core/utils/env.ts";

const REQUIRED_KEYS_PHASE1 = [
	{ name: "NEON_API_KEY", source: "Neon Console -> Settings -> API Keys -> Generate new key" },
	{
		name: "TRIGGER_SECRET_KEY",
		source: "Trigger.dev Dashboard -> Project Settings -> API Keys",
	},
];

/**
 * Collect and store API keys in config/keys.env.
 * Returns need_input status for each missing key so Claude can prompt the user.
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
