import { neon } from "@neondatabase/serverless";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema.ts";

/**
 * Generic type for both database implementations.
 * Accepts both Neon HTTP and Postgres.js database types.
 */
export type DbClient = PostgresJsDatabase<typeof schema> | NeonHttpDatabase<typeof schema>;

/**
 * Create a Hub database connection using Neon HTTP driver.
 * Best for: serverless environments, Trigger.dev tasks, short-lived operations.
 * Each call is a stateless HTTP request — no connection pooling needed.
 */
export function createHubConnection(databaseUrl: string) {
	const sql = neon(databaseUrl);
	return drizzleHttp(sql, { schema });
}

/**
 * Create a Hub database connection using Neon WebSocket driver.
 * Best for: long-running processes, local development, streaming queries.
 * Uses connection pooling via WebSocket.
 */
export async function createHubConnectionWs(databaseUrl: string) {
	// Dynamic import to avoid loading ws in serverless environments
	const { Pool, neonConfig } = await import("@neondatabase/serverless");
	const { default: ws } = await import("ws");
	const { drizzle } = await import("drizzle-orm/neon-serverless");

	neonConfig.webSocketConstructor = ws as unknown as typeof WebSocket;

	const pool = new Pool({ connectionString: databaseUrl });
	return drizzle(pool, { schema });
}

export type HubDb = ReturnType<typeof createHubConnection>;
