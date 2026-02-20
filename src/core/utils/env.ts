import { join } from "node:path";

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

export { parseEnvFile };
