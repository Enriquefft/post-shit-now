import { join } from "node:path";

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
				suggestion:
					"Use an organization-scoped API key with project creation permissions.",
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

export { parseEnvFile };
