import { apiKeys } from "./schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt, keyFromHex } from "../utils/crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export interface ApiKeyEntry {
	service: string;
	keyName?: string;
}

/**
 * Retrieve and decrypt an API key from the api_keys table.
 * @param db Database connection
 * @param hubId Hub ID (user ID for Personal Hub, hub ID for Company Hub)
 * @param service Service name (e.g., "openai", "perplexity", "fal")
 * @param keyName Optional key name for services with multiple keys
 * @returns Decrypted API key plaintext
 * @throws Error if key not found or HUB_ENCRYPTION_KEY is missing
 */
export async function getApiKey(
	db: PostgresJsDatabase,
	hubId: string,
	service: string,
	keyName?: string,
): Promise<string> {
	const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;
	if (!encryptionKeyHex) {
		throw new Error("HUB_ENCRYPTION_KEY environment variable is required for API key decryption");
	}

	const key = await keyFromHex(encryptionKeyHex);

	const conditions = [eq(apiKeys.userId, hubId), eq(apiKeys.service, service)];
	if (keyName) {
		conditions.push(eq(apiKeys.keyName, keyName));
	}

	const result = await db
		.select({ encryptedValue: apiKeys.encryptedValue })
		.from(apiKeys)
		.where(and(...conditions))
		.limit(1);

	if (result.length === 0) {
		const keyIdentifier = keyName ? `${service}:${keyName}` : service;
		throw new Error(`API key for ${keyIdentifier} not found in hub ${hubId}`);
	}

	const encryptedValue = result[0].encryptedValue;
	if (!encryptedValue) {
		throw new Error(`API key lookup returned empty value for ${service} in hub ${hubId}`);
	}

	const decrypted = decrypt(encryptedValue, key);
	if (!decrypted) {
		throw new Error(`Failed to decrypt API key for ${service} in hub ${hubId}`);
	}

	return decrypted;
}

/**
 * Encrypt and store an API key in the api_keys table.
 * @param db Database connection
 * @param hubId Hub ID (user ID for Personal Hub, hub ID for Company Hub)
 * @param service Service name (e.g., "openai", "perplexity", "fal")
 * @param keyName Optional key name for services with multiple keys
 * @param plaintextKey The API key plaintext to encrypt and store
 * @throws Error if HUB_ENCRYPTION_KEY is missing
 */
export async function setApiKey(
	db: PostgresJsDatabase,
	hubId: string,
	service: string,
	keyName: string,
	plaintextKey: string,
): Promise<void> {
	const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;
	if (!encryptionKeyHex) {
		throw new Error("HUB_ENCRYPTION_KEY environment variable is required for API key encryption");
	}

	const key = await keyFromHex(encryptionKeyHex);
	const encryptedValue = encrypt(plaintextKey, key);

	// Check if key already exists
	const existing = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(eq(apiKeys.userId, hubId), eq(apiKeys.service, service), eq(apiKeys.keyName, keyName)))
		.limit(1);

	if (existing.length > 0) {
		// Update existing key
		await db
			.update(apiKeys)
			.set({ encryptedValue })
			.where(eq(apiKeys.id, existing[0].id));
	} else {
		// Insert new key
		await db.insert(apiKeys).values({
			userId: hubId,
			service,
			keyName,
			encryptedValue,
		});
	}
}

/**
 * List all keys for a hub (without decrypting values).
 * @param db Database connection
 * @param hubId Hub ID (user ID for Personal Hub, hub ID for Company Hub)
 * @param service Optional service filter
 * @returns Array of service/keyName pairs (no decrypted values)
 */
export async function listKeys(
	db: PostgresJsDatabase,
	hubId: string,
	service?: string,
): Promise<ApiKeyEntry[]> {
	const conditions = [eq(apiKeys.userId, hubId)];
	if (service) {
		conditions.push(eq(apiKeys.service, service));
	}

	const results = await db
		.select({ service: apiKeys.service, keyName: apiKeys.keyName })
		.from(apiKeys)
		.where(and(...conditions));

	return results.map((r) => ({
		service: r.service,
		keyName: r.keyName || undefined,
	}));
}
