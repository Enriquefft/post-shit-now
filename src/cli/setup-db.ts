import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runMigrationsWithRetry } from "../core/db/migrate.ts";
import type { SetupResult } from "../core/types/index.ts";
import { generateEncryptionKey } from "../core/utils/crypto.ts";
import { loadKeysEnv, migratePersonalHubToHubsDir, validateNeonApiKey } from "../core/utils/env.ts";
import { maskDatabaseUrl } from "./utils/masking.ts";
import { createProgressStep, runStep } from "./utils/progress.ts";

/**
 * Provision a Neon database for the Personal Hub.
 * Uses neonctl CLI with API key (no browser required).
 * Resumes from failure: skips if .hubs/personal.json already exists with DATABASE_URL.
 */
export async function setupDatabase(configDir = "config", projectRoot = "."): Promise<SetupResult> {
	const hubsDir = join(projectRoot, ".hubs");
	const personalHubPath = join(hubsDir, "personal.json");

	// Display step list upfront
	createProgressStep([
		"Creating Neon project",
		"Running database migrations",
		"Saving connection to .hubs/personal.json",
	]);

	// Migration check: migrate config/hub.env to .hubs/personal.json if needed
	const migrateResult = await migratePersonalHubToHubsDir(configDir, projectRoot);
	if (!migrateResult.success) {
		return {
			step: "database",
			status: "error",
			message: migrateResult.error,
		};
	}

	// Resume check: skip if already configured
	try {
		const personalHubFile = Bun.file(personalHubPath);
		if (await personalHubFile.exists()) {
			const content = await personalHubFile.text();
			const parsed = JSON.parse(content);
			if (parsed.databaseUrl) {
				return {
					step: "database",
					status: "skipped",
					message: "Database already configured",
					data: { databaseUrl: maskDatabaseUrl(parsed.databaseUrl) },
				};
			}
		}
	} catch {
		// Continue with setup
	}

	// Load Neon API key from keys.env
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "database",
			status: "error",
			message: keysResult.error,
		};
	}

	const neonApiKey = keysResult.data.NEON_API_KEY;
	if (!neonApiKey) {
		return {
			step: "database",
			status: "error",
			message: "NEON_API_KEY not found in keys.env. Run key setup first.",
		};
	}

	// Validate API key before attempting database creation
	const keyValidation = await validateNeonApiKey(neonApiKey);
	if (!keyValidation.valid) {
		return {
			step: "database",
			status: "error",
			message: `API key validation failed: ${keyValidation.error}`,
			data: {
				error: keyValidation.error,
				suggestion: keyValidation.suggestion,
			},
		};
	}

	if (keyValidation.warning) {
		console.warn(`Warning: ${keyValidation.warning}`);
	}

	// Check neonctl is installed
	try {
		const which = Bun.spawn(["which", "neonctl"], { stdout: "pipe", stderr: "pipe" });
		await which.exited;
		if (which.exitCode !== 0) {
			throw new Error("not found");
		}
	} catch {
		return {
			step: "database",
			status: "error",
			message: "neonctl CLI not found in PATH",
			data: {
				suggestion: "Install neonctl to continue with database setup:",
				commands: ["npm install -g neonctl", "bun add -g neonctl"],
				docs: "https://neon.tech/docs/reference/cli-reference",
				troubleshooting: [
					"After installation, restart your terminal or run: source ~/.bashrc (or ~/.zshrc)",
					"Verify installation with: neonctl version",
				],
			},
		};
	}

	// Create Neon project (long-running operation)
	const suffix = Math.random().toString(36).slice(2, 8);
	const projectName = `psn-hub-${suffix}`;

	const connectionUri = await runStep("Creating Neon project", async () => {
		const proc = Bun.spawn(
			[
				"neonctl",
				"projects",
				"create",
				"--name",
				projectName,
				"--output",
				"json",
				"--api-key",
				neonApiKey,
			],
			{ stdout: "pipe", stderr: "pipe" },
		);

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();

		if (exitCode !== 0) {
			throw new Error(`neonctl failed: ${stderr.trim() || stdout.trim()}`);
		}

		// Parse neonctl output to extract connection string
		try {
			const output = JSON.parse(stdout);
			let uri = output.connection_uris?.[0]?.connection_uri ?? output.connection_uri ?? "";

			if (!uri) {
				// Try alternative output format
				const dbUri = output.databases?.[0]?.connection_uri;
				if (dbUri) {
					uri = dbUri;
				} else {
					throw new Error(
						`Could not extract connection URI from neonctl output. Raw: ${stdout.slice(0, 200)}`,
					);
				}
			}
			return uri;
		} catch (error) {
			if (error instanceof Error) throw error;
			throw new Error(`Failed to parse neonctl output: ${stdout.slice(0, 200)}`);
		}
	});

	// Generate encryption key
	const encKey = generateEncryptionKey().toString("hex");

	// Generate hub ID
	const hubId = `hub_${crypto.randomUUID().slice(0, 12)}`;

	// Create connection object
	const connection = {
		hubId,
		slug: "personal",
		displayName: "Personal Hub",
		databaseUrl: connectionUri,
		triggerProjectId: "", // Will be set by setup-trigger.ts
		encryptionKey: encKey,
		role: "admin" as const,
		joinedAt: new Date().toISOString(),
	};

	// Write to .hubs/personal.json (not config/hub.env)
	await mkdir(hubsDir, { recursive: true });
	await Bun.write(personalHubPath, JSON.stringify(connection, null, 2));

	// Run migrations (long-running operation)
	await runStep("Running database migrations", async () => {
		const migrationResult = await runMigrationsWithRetry(connectionUri);
		if (!migrationResult.success) {
			throw new Error(
				`Migrations failed: ${migrationResult.error}. personal.json saved — re-run setup to retry migrations.`,
			);
		}
	});

	return {
		step: "database",
		status: "success",
		message: `Database "${projectName}" created, migrations applied`,
		data: { projectName, databaseUrl: maskDatabaseUrl(connectionUri) },
	};
}
