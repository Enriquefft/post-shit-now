import { readFileSync } from "node:fs";
import type { HealthReport } from "../trigger/health.ts";
import { createHubConnection } from "../core/db/connection.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import { listKeys } from "../core/db/api-keys";
import { discoverAllHubs, getHubDb } from "../team/hub.ts";
import { maskDatabaseUrl, maskApiKey } from "../cli/utils/masking.ts";
import { createProgressStep, runStep } from "../cli/utils/progress.ts";

// ─── Health Check Types ─────────────────────────────────────────────────────

export interface HealthCheckResult {
	check: string;
	status: "pass" | "fail" | "warning";
	message: string;
	details?: Record<string, unknown>;
}

export interface HealthCheckSummary {
	allPassed: boolean;
	timestamp: string;
	results: HealthCheckResult[];
}

// ─── Health Check Functions ─────────────────────────────────────────────────

/**
 * Check database connectivity by executing a simple query.
 * Returns pass/fail based on query execution success.
 */
export async function checkDatabaseHealth(
	configDir = "config",
): Promise<HealthCheckResult> {
	try {
		const envResult = await loadHubEnv(configDir);
		if (!envResult.success) {
			return {
				check: "database",
				status: "fail",
				message: envResult.error,
			};
		}

		const db = createHubConnection(envResult.data.databaseUrl);
		const result = await db.execute("SELECT 1 as health_check");

		if (result) {
			return {
				check: "database",
				status: "pass",
				message: "Database connection successful",
				details: {
					databaseUrl: maskDatabaseUrl(envResult.data.databaseUrl),
				},
			};
		}

		return {
			check: "database",
			status: "fail",
			message: "Database query returned no result",
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return {
			check: "database",
			status: "fail",
			message: `Database connection failed: ${msg}`,
		};
	}
}

/**
 * Check Trigger.dev configuration by verifying secret key and project ref.
 * Returns pass/fail/warning based on configuration status.
 */
export async function checkTriggerHealth(
	configDir = "config",
): Promise<HealthCheckResult> {
	try {
		const keysResult = await loadKeysEnv(configDir);

		if (!keysResult.success) {
			return {
				check: "trigger",
				status: "fail",
				message: "keys.env not found — Trigger.dev secret key missing",
			};
		}

		const { TRIGGER_SECRET_KEY } = keysResult.data;

		if (!TRIGGER_SECRET_KEY) {
			return {
				check: "trigger",
				status: "fail",
				message: "TRIGGER_SECRET_KEY not found in keys.env",
			};
		}

		// Validate secret key format
		if (!TRIGGER_SECRET_KEY.startsWith("tr_dev_") && !TRIGGER_SECRET_KEY.startsWith("tr_prod_")) {
			return {
				check: "trigger",
				status: "fail",
				message: "TRIGGER_SECRET_KEY has invalid format (must start with tr_dev_ or tr_prod_)",
			};
		}

		// Check trigger.config.ts for project ref
		try {
			const config = readFileSync("trigger.config.ts", "utf-8");
			if (config.includes("<your-project-ref>")) {
				return {
					check: "trigger",
					status: "fail",
					message: "trigger.config.ts still has placeholder project ref",
				};
			}

			// Extract project ref from secret key for comparison
			const match = TRIGGER_SECRET_KEY.match(/^tr_(?:dev|prod)_([a-zA-Z0-9]+)_/);
			const projectRef = match?.[1];

			return {
				check: "trigger",
				status: "pass",
				message: "Trigger.dev configured with secret key and project ref",
				details: {
					secretKey: maskApiKey(TRIGGER_SECRET_KEY),
					projectRef: projectRef || "unknown",
				},
			};
		} catch (configErr) {
			return {
				check: "trigger",
				status: "fail",
				message: `Failed to read trigger.config.ts: ${configErr instanceof Error ? configErr.message : String(configErr)}`,
			};
		}
	} catch (err) {
		return {
			check: "trigger",
			status: "fail",
			message: `Trigger.dev health check failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Check all hub connections by testing database connectivity for each.
 * Returns pass/fail/warning based on hub connection status.
 */
export async function checkHubHealth(
	projectRoot = ".",
): Promise<HealthCheckResult> {
	try {
		const { hubs, error } = await discoverAllHubs(projectRoot);

		if (error) {
			return {
				check: "hub",
				status: "fail",
				message: `Hub discovery failed: ${error.reason}`,
			};
		}

		if (hubs.length === 0) {
			return {
				check: "hub",
				status: "warning",
				message: "No hub connections configured",
			};
		}

		// Check each hub connection
		const hubStatuses: Array<{
			name: string;
			slug: string;
			status: "pass" | "fail";
			error?: string;
		}> = [];

		let atLeastOnePass = false;

		for (const hub of hubs) {
			try {
				const db = getHubDb(hub);
				await db.execute("SELECT 1 as health_check");
				hubStatuses.push({
					name: hub.displayName,
					slug: hub.slug,
					status: "pass",
				});
				atLeastOnePass = true;
			} catch (hubErr) {
				hubStatuses.push({
					name: hub.displayName,
					slug: hub.slug,
					status: "fail",
					error: hubErr instanceof Error ? hubErr.message : String(hubErr),
				});
			}
		}

		// Overall status: pass if all pass, fail if all fail, warning if some pass
		const allPass = hubStatuses.every((h) => h.status === "pass");
		const allFail = hubStatuses.every((h) => h.status === "fail");

		const overallStatus: "pass" | "fail" | "warning" = allPass
			? "pass"
			: allFail
				? "fail"
				: "warning";

		return {
			check: "hub",
			status: overallStatus,
			message: `Checked ${hubStatuses.length} hub connection(s)`,
			details: {
				hubs: hubStatuses,
				passCount: hubStatuses.filter((h) => h.status === "pass").length,
				failCount: hubStatuses.filter((h) => h.status === "fail").length,
			},
		};
	} catch (err) {
		return {
			check: "hub",
			status: "fail",
			message: `Hub health check failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

/**
 * Check configured provider keys by listing keys from the database.
 * Returns pass/warning based on key configuration status.
 */
export async function checkProviderKeysHealth(
	configDir = "config",
	projectRoot = ".",
): Promise<HealthCheckResult> {
	try {
		// Get hub connection for database access
		const connection = await discoverAllHubs(projectRoot);
		if (connection.error || connection.hubs.length === 0) {
			return {
				check: "provider-keys",
				status: "warning",
				message: "No hub configured — cannot check provider keys",
			};
		}

		// Use the first available hub (Personal Hub is typically first)
		const hub = connection.hubs[0];
		const db = getHubDb(hub);
		const keys = await listKeys(db, hub.hubId);

		if (keys.length === 0) {
			return {
				check: "provider-keys",
				status: "warning",
				message: "No provider keys configured",
				details: {
					suggestion: "Configure provider keys with /psn:setup keys",
					hubId: hub.hubId,
				},
			};
		}

		// Group keys by service
		const services = new Map<string, number>();
		for (const key of keys) {
			services.set(key.service, (services.get(key.service) || 0) + 1);
		}

		return {
			check: "provider-keys",
			status: "pass",
			message: `${keys.length} provider key(s) configured across ${services.size} service(s)`,
			details: {
				services: Object.fromEntries(services),
				totalKeys: keys.length,
				hubId: hub.hubId,
			},
		};
	} catch (err) {
		return {
			check: "provider-keys",
			status: "warning",
			message: `Provider keys check failed: ${err instanceof Error ? err.message : String(err)}`,
			details: {
				suggestion: "Check database connectivity and hub configuration",
			},
		};
	}
}

// ─── Main Health Check Orchestrator ─────────────────────────────────────────

/**
 * Run comprehensive health checks with human-readable or JSON output.
 * Checks: database, Trigger.dev, hub connections, provider keys.
 */
export async function runHealthCheck(
	configDir = "config",
	jsonOutput = false,
	projectRoot = ".",
): Promise<HealthCheckSummary> {
	const results: HealthCheckResult[] = [];

	// Create progress step list upfront
	const steps = ["Database", "Trigger.dev", "Hub connections", "Provider keys"];
	createProgressStep(steps);

	// Run all checks in parallel
	const [dbResult, triggerResult, hubResult, providerKeysResult] = await Promise.all([
		runStep("Database", () => checkDatabaseHealth(configDir)),
		runStep("Trigger.dev", () => checkTriggerHealth(configDir)),
		runStep("Hub connections", () => checkHubHealth(projectRoot)),
		runStep("Provider keys", () => checkProviderKeysHealth(configDir, projectRoot)),
	]);

	results.push(dbResult, triggerResult, hubResult, providerKeysResult);

	const allPassed = results.every((r) => r.status === "pass");
	const timestamp = new Date().toISOString();

	// Build summary
	const summary: HealthCheckSummary = {
		allPassed,
		timestamp,
		results,
	};

	// Output results
	if (jsonOutput) {
		console.log(JSON.stringify(summary, null, 2));
	} else {
		displayHumanReadableResults(summary);
	}

	return summary;
}

/**
 * Display health check results in human-readable format with color coding.
 * Uses unicode symbols: ✓ (pass), ✗ (fail), ⚠ (warning).
 */
function displayHumanReadableResults(summary: HealthCheckSummary): void {
	const { allPassed, timestamp, results } = summary;

	console.log("\n" + "=".repeat(60));
	console.log("Health Check Report");
	console.log("=".repeat(60));
	console.log(`Timestamp: ${timestamp}`);
	console.log(`Overall Status: ${allPassed ? "✓ PASSED" : "✗ FAILED"}`);
	console.log("=".repeat(60));

	for (const result of results) {
		const symbol =
			result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "⚠";
		const color = result.status === "pass" ? "\x1b[32m" : result.status === "fail" ? "\x1b[31m" : "\x1b[33m";
		const reset = "\x1b[0m";

		console.log(`\n${color}${symbol} ${result.check.toUpperCase()}${reset}`);
		console.log(`  ${result.message}`);

		// Show details for failed checks
		if (result.status === "fail" && result.details) {
			console.log(`  Details:`);
			for (const [key, value] of Object.entries(result.details)) {
				if (typeof value === "object" && value !== null) {
					console.log(`    ${key}: ${JSON.stringify(value)}`);
				} else {
					console.log(`    ${key}: ${value}`);
				}
			}
		}

		// Show hub details for multi-hub checks
		if (result.check === "hub" && result.details?.hubs) {
			const hubs = result.details.hubs as Array<{
				name: string;
				slug: string;
				status: string;
				error?: string;
			}>;
			console.log(`  Hubs:`);
			for (const hub of hubs) {
				const hubSymbol = hub.status === "pass" ? "✓" : "✗";
				console.log(`    ${hubSymbol} ${hub.displayName} (${hub.slug})`);
				if (hub.error) {
					console.log(`      Error: ${hub.error}`);
				}
			}
		}

		// Show provider keys details
		if (result.check === "provider-keys" && result.details?.services) {
			const services = result.details.services as Record<string, number>;
			console.log(`  Services:`);
			for (const [service, count] of Object.entries(services)) {
				console.log(`    ${service}: ${count} key(s)`);
			}
		}
	}

	console.log("\n" + "=".repeat(60));

	// Show next steps for failed checks
	const failedChecks = results.filter((r) => r.status !== "pass");
	if (failedChecks.length > 0) {
		console.log("Action Required:");
		for (const failed of failedChecks) {
			switch (failed.check) {
				case "database":
					console.log("  - Run /psn:setup to configure your database");
					break;
				case "trigger":
					console.log("  - Run /psn:setup to configure Trigger.dev");
					break;
				case "hub":
					console.log("  - Check hub connection files in .hubs/ directory");
					break;
				case "provider-keys":
					console.log("  - Run /psn:setup keys to configure provider keys");
					break;
			}
		}
		console.log("=".repeat(60));
	}
}
