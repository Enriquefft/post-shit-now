import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// ─── Required Tables ─────────────────────────────────────────────────────────────
// All tables that must exist after migration completes

const REQUIRED_TABLES = [
	"users",
	"oauth_tokens",
	"posts",
	"api_keys",
	"voice_profiles",
	"edit_history",
	"post_metrics",
	"preference_model",
	"strategy_adjustments",
	"ideas",
	"series",
	"trends",
	"weekly_plans",
	"monitored_accounts",
	"team_members",
	"invite_codes",
	"notification_preferences",
	"notification_log",
	"engagement_opportunities",
	"engagement_config",
	"engagement_log",
	"whatsapp_sessions",
] as const;

// ─── Run Migrations Once (No Retry) ────────────────────────────────────────────────
/**
 * Run all pending Drizzle migrations against Hub database.
 * Uses the HTTP driver (stateless, no connection pool needed).
 * No retry logic - use runMigrationsWithRetry for transient failure handling.
 */
export async function runMigrations(
	databaseUrl: string,
	migrationsFolder = "./drizzle/migrations",
): Promise<{ success: boolean; error?: string }> {
	try {
		const db = drizzle(databaseUrl);
		await migrate(db, { migrationsFolder });
		return { success: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, error: message };
	}
}

// ─── Migration Retry with Table Verification ───────────────────────────────────
/**
 * Run all pending Drizzle migrations with retry logic and table verification.
 * Handles transient network failures (connection, timeout, network errors) gracefully.
 * Distinguishes between retriable and permanent errors to avoid wasting time.
 *
 * @param databaseUrl - Database connection URL
 * @param migrationsFolder - Path to migrations folder (default: "./drizzle/migrations")
 * @returns Success status, error message (if failed), attempt count, and table verification status
 */
export async function runMigrationsWithRetry(
	databaseUrl: string,
	migrationsFolder = "./drizzle/migrations",
): Promise<{
	success: boolean;
	error?: string;
	attemptCount?: number;
	tablesVerified?: boolean;
}> {
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			console.log(`[Migration attempt ${attempt}/3] Running migrations...`);
			const db = drizzle(databaseUrl);
			await migrate(db, { migrationsFolder });

			console.log(`[Migration attempt ${attempt}/3] Verifying tables...`);
			const tablesExist = await verifyTablesExist(db);
			if (!tablesExist) {
				throw new Error("Migration completed but required tables missing");
			}

			console.log(
				`[Migration attempt ${attempt}/3] Success - ${REQUIRED_TABLES.length} tables verified`,
			);
			return {
				success: true,
				attemptCount: attempt,
				tablesVerified: true,
			};
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			const isRetriable = isRetryableError(error);
			const tableInfo = extractTableInfo(error);

			console.log(`[Migration attempt ${attempt}/3] Failed: ${error}`);
			if (tableInfo) {
				console.log(`[Migration attempt ${attempt}/3] Table context: ${tableInfo}`);
			}

			// Permanent errors: permission denied, syntax error, duplicate column, etc.
			if (!isRetriable) {
				console.log(`[Migration attempt ${attempt}/3] Error is permanent - not retrying`);
				return {
					success: false,
					error: `${error} (permanent error)`,
					attemptCount: attempt,
				};
			}

			// Retry with 2-second fixed delay
			if (attempt < 3) {
				console.log(`[Migration attempt ${attempt}/3] Retrying in 2 seconds...`);
				await new Promise((resolve) => setTimeout(resolve, 2000));
			} else {
				console.log(`[Migration attempt ${attempt}/3] Max retries reached`);
				return {
					success: false,
					error: `${error} (max retries reached)`,
					attemptCount: attempt,
				};
			}
		}
	}

	// Should never reach here, but TypeScript requires return
	return {
		success: false,
		error: "Unknown migration failure",
		attemptCount: 3,
	};
}

// ─── Table Verification ───────────────────────────────────────────────────────────
/**
 * Verify that all required tables exist in database.
 * Returns false if any table is missing (returns false on error, true if all pass).
 * Uses sql.identifier() for safe table name interpolation.
 */
async function verifyTablesExist(db: ReturnType<typeof drizzle>): Promise<boolean> {
	for (const table of REQUIRED_TABLES) {
		try {
			await db.execute(sql`SELECT 1 FROM ${sql.identifier(table)} LIMIT 1`);
		} catch {
			return false;
		}
	}
	return true;
}

// ─── Error Classification ─────────────────────────────────────────────────────────
/**
 * Determine if an error is retriable (transient) or permanent.
 * Retriable: connection, timeout, network, temporary failures
 * Permanent: permission denied, syntax error, duplicate column, relation already exists
 *
 * Check non-retriable patterns first (block them), then check retriable patterns.
 */
function isRetryableError(error: string): boolean {
	// Non-retriable patterns (permanent errors)
	const nonRetriablePatterns = [
		/permission denied/i,
		/syntax error/i,
		/duplicate column/i,
		/relation.*already exists/i,
		/duplicate key/i,
		/constraint/i,
		/cannot truncate/i,
	];

	// Block permanent errors
	if (nonRetriablePatterns.some((pattern) => pattern.test(error))) {
		return false;
	}

	// Retriable patterns (transient errors)
	const retriablePatterns = [
		/connection/i,
		/timeout/i,
		/network/i,
		/temporary/i,
		/could not connect/i,
		/connection reset/i,
		/econnrefused/i,
		/econnreset/i,
		/timed out/i,
	];

	return retriablePatterns.some((pattern) => pattern.test(error));
}

/**
 * Extract table name from error message for context.
 * Supports common error formats from Postgres/Drizzle.
 */
function extractTableInfo(error: string): string | null {
	// Pattern 1: relation "table_name" does not exist
	const relationMatch = error.match(/relation "([^"]+)" does not exist/i);
	if (relationMatch) return relationMatch[1] ?? null;

	// Pattern 2: table "table_name"
	const tableMatch = error.match(/table "([^"]+)"/i);
	if (tableMatch) return tableMatch[1] ?? null;

	return null;
}
