import type { SetupResult } from "../core/types/index.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import { createCompanyHub } from "../team/hub.ts";

interface SetupCompanyHubParams {
	slug: string;
	displayName: string;
	adminUserId?: string;
	configDir?: string;
	projectRoot?: string;
}

/**
 * CLI flow for Company Hub creation.
 * JSON output for Claude to interpret.
 *
 * Steps:
 * 1. Check NEON_API_KEY is set
 * 2. Call createCompanyHub() to provision DB, run migrations, write connection file
 * 3. Return SetupResult with hub details
 */
export async function setupCompanyHub(params: SetupCompanyHubParams): Promise<SetupResult> {
	const {
		slug,
		displayName,
		adminUserId = "default",
		configDir = "config",
		projectRoot = ".",
	} = params;

	// Validate slug format
	if (!/^[a-z0-9-]+$/.test(slug)) {
		return {
			step: "company-hub",
			status: "error",
			message:
				"Hub slug must contain only lowercase letters, numbers, and hyphens (e.g., 'my-company')",
		};
	}

	// Check NEON_API_KEY is available
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "company-hub",
			status: "error",
			message: `Cannot load API keys: ${keysResult.error}`,
		};
	}

	if (!keysResult.data.NEON_API_KEY) {
		return {
			step: "company-hub",
			status: "error",
			message: "NEON_API_KEY not found in keys.env. Run /psn:setup first.",
		};
	}

	// Get encryption key from hub.env (reuse Personal Hub's key)
	const hubEnvResult = await loadHubEnv(configDir);
	if (!hubEnvResult.success) {
		return {
			step: "company-hub",
			status: "error",
			message: `Cannot load hub config: ${hubEnvResult.error}. Run /psn:setup first.`,
		};
	}

	const encryptionKey = hubEnvResult.data.encryptionKey;
	if (!encryptionKey) {
		return {
			step: "company-hub",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub.env. Run /psn:setup first.",
		};
	}

	try {
		const result = await createCompanyHub(
			{
				slug,
				displayName,
				adminUserId,
				encryptionKey,
				configDir,
			},
			projectRoot,
		);

		return {
			step: "company-hub",
			status: "success",
			message: `Company Hub "${displayName}" created successfully`,
			data: {
				hubId: result.connection.hubId,
				slug,
				displayName,
				connectionFile: `.hubs/company-${slug}.json`,
				projectName: result.projectName,
			},
		};
	} catch (err) {
		return {
			step: "company-hub",
			status: "error",
			message: `Failed to create Company Hub: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}
