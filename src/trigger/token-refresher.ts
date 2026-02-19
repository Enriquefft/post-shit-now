import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { createXOAuthClient, refreshAccessToken } from "../platforms/x/oauth.ts";

export interface TokenRefresherResult {
	total: number;
	refreshed: number;
	failed: number;
	skipped: number;
}

interface TokenRow {
	id: string;
	user_id: string;
	platform: string;
	access_token: string;
	refresh_token: string | null;
	expires_at: Date | null;
	metadata: Record<string, unknown> | null;
}

/**
 * Token refresher cron task.
 * Runs every 6 hours to refresh X OAuth tokens before they expire.
 * Uses SELECT FOR UPDATE SKIP LOCKED for race-condition-safe concurrent execution.
 */
export const tokenRefresher = schedules.task({
	id: "token-refresher",
	cron: "0 */6 * * *",
	maxDuration: 120,
	run: async () => {
		const databaseUrl = process.env.DATABASE_URL;
		const encryptionKey = process.env.HUB_ENCRYPTION_KEY;

		if (!databaseUrl) {
			logger.error("DATABASE_URL not set — cannot run token refresher");
			return { total: 0, refreshed: 0, failed: 0, skipped: 0 };
		}
		if (!encryptionKey) {
			logger.error("HUB_ENCRYPTION_KEY not set — cannot decrypt tokens");
			return { total: 0, refreshed: 0, failed: 0, skipped: 0 };
		}

		const db = createHubConnection(databaseUrl);
		const encKey = keyFromHex(encryptionKey);

		const result: TokenRefresherResult = { total: 0, refreshed: 0, failed: 0, skipped: 0 };

		// Find tokens needing refresh using row-level locking.
		// SELECT FOR UPDATE SKIP LOCKED prevents race conditions when multiple
		// instances run concurrently — each instance processes different rows.
		const queryResult = await db.execute(sql`
			SELECT id, user_id, platform, access_token, refresh_token, expires_at, metadata
			FROM oauth_tokens
			WHERE platform = 'x'
			  AND refresh_token IS NOT NULL
			  AND expires_at < NOW() + INTERVAL '1 day'
			FOR UPDATE SKIP LOCKED
			LIMIT 10
		`);

		const rows = queryResult.rows as unknown as TokenRow[];
		result.total = rows.length;

		const clientId = process.env.X_CLIENT_ID;
		const clientSecret = process.env.X_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			logger.error("X_CLIENT_ID or X_CLIENT_SECRET not set — cannot refresh tokens");
			result.skipped = result.total;
			return result;
		}

		const xOAuthClient = createXOAuthClient({
			clientId,
			clientSecret,
			callbackUrl: "https://example.com/callback",
		});

		for (const token of rows) {
			try {
				if (!token.refresh_token) {
					result.skipped++;
					continue;
				}

				// Decrypt the stored refresh token
				const decryptedRefresh = decrypt(token.refresh_token, encKey);

				// Refresh via Arctic — returns new access + refresh tokens
				// CRITICAL: X refresh tokens are one-time use (pitfall #1)
				const newTokens = await refreshAccessToken(xOAuthClient, decryptedRefresh);

				// Encrypt BOTH new tokens for storage
				const encryptedAccess = encrypt(newTokens.accessToken, encKey);
				const encryptedRefresh = encrypt(newTokens.refreshToken, encKey);

				// Update the row atomically with new tokens
				await db.execute(sql`
					UPDATE oauth_tokens
					SET access_token = ${encryptedAccess},
					    refresh_token = ${encryptedRefresh},
					    expires_at = ${newTokens.expiresAt},
					    updated_at = NOW(),
					    metadata = jsonb_set(
					      COALESCE(metadata, '{}'::jsonb),
					      '{lastRefreshAt}',
					      ${JSON.stringify(new Date().toISOString())}::jsonb
					    )
					WHERE id = ${token.id}
				`);

				logger.info("Token refreshed successfully", {
					tokenId: token.id,
					userId: token.user_id,
					expiresAt: newTokens.expiresAt.toISOString(),
				});

				result.refreshed++;
			} catch (error) {
				// Don't let one failure stop processing other tokens
				const errorMessage = error instanceof Error ? error.message : String(error);

				logger.error("Token refresh failed", {
					tokenId: token.id,
					userId: token.user_id,
					error: errorMessage,
				});

				// Record failure in metadata for user notification (AUTH-07)
				try {
					await db.execute(sql`
						UPDATE oauth_tokens
						SET updated_at = NOW(),
						    metadata = jsonb_set(
						      jsonb_set(
						        jsonb_set(
						          COALESCE(metadata, '{}'::jsonb),
						          '{refreshError}',
						          ${JSON.stringify(errorMessage)}::jsonb
						        ),
						        '{refreshFailedAt}',
						        ${JSON.stringify(new Date().toISOString())}::jsonb
						      ),
						      '{requiresReauth}',
						      'true'::jsonb
						    )
						WHERE id = ${token.id}
					`);
				} catch (metaError) {
					logger.error("Failed to update token failure metadata", {
						tokenId: token.id,
						error: metaError instanceof Error ? metaError.message : String(metaError),
					});
				}

				result.failed++;
			}
		}

		logger.info("Token refresh cycle complete", { ...result });
		return result;
	},
});
