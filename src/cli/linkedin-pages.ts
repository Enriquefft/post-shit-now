import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import { LinkedInClient } from "../platforms/linkedin/client.ts";

/**
 * CLI utility to list LinkedIn pages (organizations) the user can post as.
 * Used by /psn:post to offer page vs personal profile selection.
 *
 * Output: JSON with { pages: [...], personUrn: "..." }
 */
async function main() {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		console.log(JSON.stringify({ error: hubEnv.error }));
		process.exit(1);
	}

	const { databaseUrl, encryptionKey } = hubEnv.data;
	if (!encryptionKey) {
		console.log(JSON.stringify({ error: "HUB_ENCRYPTION_KEY not found" }));
		process.exit(1);
	}

	const db = createHubConnection(databaseUrl);
	const encKey = keyFromHex(encryptionKey);

	// Fetch LinkedIn OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.platform} = 'linkedin'`)
		.limit(1);

	if (!token) {
		console.log(JSON.stringify({ error: "No LinkedIn OAuth token found" }));
		process.exit(1);
	}

	const accessToken = decrypt(token.accessToken, encKey);
	const client = new LinkedInClient(accessToken);

	const personUrn = token.metadata?.personUrn ?? null;

	try {
		const pages = await client.getAdminOrganizations();
		console.log(
			JSON.stringify({
				personUrn,
				pages: pages.map((p) => ({
					organizationUrn: p.organizationUrn,
					name: p.organizationName ?? "(unnamed)",
				})),
			}),
		);
	} catch (error) {
		console.log(
			JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
				personUrn,
				pages: [],
			}),
		);
	}
}

main().catch((err) => {
	console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
	process.exit(1);
});
