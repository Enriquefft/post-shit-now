import { getApiKey } from "../db/api-keys";
import type { DbClient } from "../db/connection";

/**
 * Resolve multiple credentials for a service from the database.
 * Returns null if any key is missing — DB is the single source of truth.
 */
export async function resolveCredentials(
	db: DbClient,
	hubId: string,
	service: string,
	keyNames: string[],
): Promise<Record<string, string> | null> {
	const result: Record<string, string> = {};

	for (const keyName of keyNames) {
		try {
			result[keyName] = await getApiKey(db, hubId, service, keyName);
		} catch {
			return null;
		}
	}

	return result;
}
