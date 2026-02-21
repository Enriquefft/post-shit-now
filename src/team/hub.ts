import crypto from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHubConnection, type HubDb } from "../core/db/connection.ts";
import { runMigrationsWithRetry } from "../core/db/migrate.ts";
import * as schema from "../core/db/schema.ts";
import { loadKeysEnv } from "../core/utils/env.ts";
import { type HubConnection, HubConnectionSchema } from "./types.ts";

// ─── Hub Provisioning ──────────────────────────────────────────────────────

interface CreateHubParams {
	slug: string;
	displayName: string;
	adminUserId: string;
	encryptionKey: string;
	configDir?: string;
}

interface CreateHubResult {
	connection: HubConnection;
	projectName: string;
}

/**
 * Create a new Company Hub: provisions Neon DB, runs migrations,
 * inserts admin record, and writes connection file.
 */
export async function createCompanyHub(
	params: CreateHubParams,
	projectRoot = ".",
): Promise<CreateHubResult> {
	const { slug, displayName, adminUserId, encryptionKey, configDir = "config" } = params;

	const hubId = `hub_${crypto.randomUUID().slice(0, 12)}`;

	// Load Neon API key
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		throw new Error(`Cannot load API keys: ${keysResult.error}`);
	}

	const neonApiKey = keysResult.data.NEON_API_KEY;
	if (!neonApiKey) {
		throw new Error("NEON_API_KEY not found in keys.env");
	}

	// Get existing Neon project ID (list projects and use the first one)
	const listProc = Bun.spawn(
		["neonctl", "projects", "list", "--output", "json", "--api-key", neonApiKey],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const listExit = await listProc.exited;
	const listStdout = await new Response(listProc.stdout).text();

	if (listExit !== 0) {
		throw new Error(`Failed to list Neon projects: ${await new Response(listProc.stderr).text()}`);
	}

	const projects = JSON.parse(listStdout);
	const projectList = Array.isArray(projects) ? projects : (projects.projects ?? []);
	if (projectList.length === 0) {
		throw new Error("No Neon projects found. Run /psn:setup first to create a Personal Hub.");
	}

	const neonProjectId = projectList[0].id;
	const projectName = `psn-company-${slug}`;

	// Create a new database in the existing Neon project
	const createProc = Bun.spawn(
		[
			"neonctl",
			"databases",
			"create",
			"--name",
			projectName,
			"--project-id",
			neonProjectId,
			"--output",
			"json",
			"--api-key",
			neonApiKey,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const createExit = await createProc.exited;
	if (createExit !== 0) {
		const stderr = await new Response(createProc.stderr).text();
		throw new Error(`Failed to create Neon database: ${stderr}`);
	}

	// Get the connection string for the new database
	const connProc = Bun.spawn(
		[
			"neonctl",
			"connection-string",
			"--project-id",
			neonProjectId,
			"--database-name",
			projectName,
			"--api-key",
			neonApiKey,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);

	const connExit = await connProc.exited;
	const connStdout = await new Response(connProc.stdout).text();

	if (connExit !== 0) {
		const stderr = await new Response(connProc.stderr).text();
		throw new Error(`Failed to get connection string: ${stderr}`);
	}

	const databaseUrl = connStdout.trim();

	// Run Drizzle migrations on the new Company Hub DB
	const migrationResult = await runMigrationsWithRetry(databaseUrl);
	if (!migrationResult.success) {
		throw new Error(`Migrations failed on Company Hub DB: ${migrationResult.error}`);
	}

	// Insert creator as admin in team_members table
	const db = createHubConnection(databaseUrl);
	await db.insert(schema.teamMembers).values({
		userId: adminUserId,
		hubId,
		role: schema.HubRole.admin,
	});

	// Get Trigger.dev project ref from hub.env (reuse personal hub's project)
	const { loadHubEnv } = await import("../core/utils/env.ts");
	const hubEnvResult = await loadHubEnv(configDir);
	const triggerProjectId = hubEnvResult.success ? hubEnvResult.data.triggerProjectRef : "";

	// Create connection file
	const connection: HubConnection = {
		hubId,
		slug,
		displayName,
		databaseUrl,
		triggerProjectId,
		role: "admin",
		joinedAt: new Date().toISOString(),
		encryptionKey,
	};

	const hubsDir = join(projectRoot, ".hubs");
	await mkdir(hubsDir, { recursive: true });
	const connectionFile = join(hubsDir, `company-${slug}.json`);
	await writeFile(connectionFile, JSON.stringify(connection, null, 2), "utf-8");

	return { connection, projectName };
}

// ─── Hub Discovery ─────────────────────────────────────────────────────────

/**
 * Scan .hubs/ directory for all hub connection files.
 * Returns Personal Hub (personal.json) and Company Hubs (company-*.json).
 * Returns empty array if .hubs/ doesn't exist (graceful degradation).
 * @deprecated Use discoverAllHubs() for strict validation with detailed error messages
 */
export async function discoverCompanyHubs(projectRoot = "."): Promise<HubConnection[]> {
	const result = await discoverAllHubs(projectRoot);
	return result.hubs;
}

/**
 * Unified hub discovery for Personal and Company hubs with strict validation.
 * Loads all .hubs/*.json files and validates them strictly.
 *
 * Returns:
 *   - hubs: Array of valid HubConnection objects
 *   - error: Optional error object with file path and detailed reason
 *
 * Errors immediately on:
 *   - Empty .hubs/ directory
 *   - Corrupted hub connection files
 *   - Missing required fields (hubId, slug, databaseUrl)
 *
 * Error messages include file path, parse error location, and expected format.
 */
export async function discoverAllHubs(
	projectRoot = ".",
): Promise<{ hubs: HubConnection[]; error?: { file: string; reason: string } }> {
	const hubsDir = join(projectRoot, ".hubs");

	// Check directory exists
	let entries: string[];
	try {
		entries = await readdir(hubsDir);
	} catch {
		// Empty .hubs/ directory — error immediately (user decision)
		return {
			hubs: [],
			error: {
				file: ".hubs/",
				reason: "Hub directory not found. Run /psn:setup to configure your Personal Hub.",
			},
		};
	}

	if (entries.length === 0) {
		return {
			hubs: [],
			error: {
				file: ".hubs/",
				reason: "No hub connection files found. Run /psn:setup to configure your Personal Hub.",
			},
		};
	}

	const hubs: HubConnection[] = [];

	for (const entry of entries) {
		if (!entry.endsWith(".json")) continue;

		const filePath = join(hubsDir, entry);

		try {
			const content = await readFile(filePath, "utf-8");
			const parsed = JSON.parse(content);

			// Strict Zod validation - fails fast on first error
			const validated = HubConnectionSchema.parse(parsed);

			// Check required fields (user decision: strict validation)
			if (!validated.hubId || !validated.slug || !validated.databaseUrl) {
				throw new Error(`Missing required field: hubId, slug, or databaseUrl`);
			}

			hubs.push(validated);
		} catch (err) {
			// Fail-fast on corrupted files (user decision)
			const reason = err instanceof Error ? err.message : String(err);
			const parseLocation = extractParseLocation(reason);

			return {
				hubs: [],
				error: {
					file: entry,
					reason:
						`Invalid hub connection file at ${filePath}: ${reason}\n` +
						`Location: ${parseLocation}\n` +
						`Expected format: { "hubId": "...", "slug": "...", "displayName": "...", "databaseUrl": "...", ... }`,
				},
			};
		}
	}

	return { hubs, error: undefined };
}

/**
 * Extract parse location from error message.
 * Returns line/column info from Zod errors or position from JSON.parse errors.
 */
function extractParseLocation(error: string): string {
	// Parse Zod error for line/column info
	const match = error.match(/at "(.+)" \((\d+):(\d+)\)/);
	if (match) {
		return `Line ${match[2]}, column ${match[3]}`;
	}
	// Parse JSON.parse errors
	const jsonMatch = error.match(/position (\d+)/);
	if (jsonMatch) {
		return `Position ${jsonMatch[1]}`;
	}
	return "Unknown location";
}

// ─── Connection Management ─────────────────────────────────────────────────

/**
 * Find a specific hub connection by slug or hubId.
 * Returns null if not found.
 */
export async function getHubConnection(
	projectRoot: string,
	slugOrId: string,
): Promise<HubConnection | null> {
	const hubs = await discoverCompanyHubs(projectRoot);
	return hubs.find((h) => h.slug === slugOrId || h.hubId === slugOrId) ?? null;
}

/**
 * Delete a Company Hub connection file.
 * Does NOT delete the Neon DB or team_members record (content preserved).
 */
export async function removeHubConnection(projectRoot: string, slug: string): Promise<void> {
	const connectionFile = join(projectRoot, ".hubs", `company-${slug}.json`);
	try {
		await rm(connectionFile);
	} catch {
		// File doesn't exist — already removed
	}
}

// ─── Hub Database Connection ───────────────────────────────────────────────

/**
 * Create a Drizzle database connection to a Company Hub.
 * Uses the same createHubConnection pattern from core/db/connection.ts.
 */
export function getHubDb(connection: HubConnection): HubDb {
	return createHubConnection(connection.databaseUrl);
}
