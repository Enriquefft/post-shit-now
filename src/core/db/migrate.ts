import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Run all pending Drizzle migrations against the Hub database.
 * Uses the HTTP driver (stateless, no connection pool needed).
 */
export async function runMigrations(
	databaseUrl: string,
	migrationsFolder = "./drizzle/migrations",
): Promise<{ success: boolean; error?: string }> {
	try {
		const sql = neon(databaseUrl);
		const db = drizzle(sql);
		await migrate(db, { migrationsFolder });
		return { success: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, error: message };
	}
}
