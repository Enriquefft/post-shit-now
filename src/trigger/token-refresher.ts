import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import {
	createLinkedInOAuthClient,
	refreshAccessToken as refreshLinkedInToken,
} from "../platforms/linkedin/oauth.ts";
import { createXOAuthClient, refreshAccessToken as refreshXToken } from "../platforms/x/oauth.ts";

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
 * Runs every 6 hours to refresh OAuth tokens before they expire.
 * Handles both X (2-hour expiry, 1-day refresh window) and LinkedIn (60-day expiry, 7-day refresh window).
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
		// Platform-specific refresh windows:
		//   X: 1 day before expiry (tokens expire every 2 hours)
		//   LinkedIn: 7 days before expiry (tokens expire every 60 days)
		// SELECT FOR UPDATE SKIP LOCKED prevents race conditions when multiple
		// instances run concurrently — each instance processes different rows.
		const queryResult = await db.execute(sql`
			SELECT id, user_id, platform, access_token, refresh_token, expires_at, metadata
			FROM oauth_tokens
			WHERE refresh_token IS NOT NULL
			  AND (
			    (platform = 'x' AND expires_at < NOW() + INTERVAL '1 day')
			    OR (platform = 'linkedin' AND expires_at < NOW() + INTERVAL '7 days')
			  )
			FOR UPDATE SKIP LOCKED
			LIMIT 10
		`);

		const rows = queryResult.rows as unknown as TokenRow[];
		result.total = rows.length;

		// Build platform-specific OAuth clients lazily
		let xOAuthClient: ReturnType<typeof createXOAuthClient> | null = null;
		let linkedInOAuthClient: ReturnType<typeof createLinkedInOAuthClient> | null = null;

		for (const token of rows) {
			try {
				if (!token.refresh_token) {
					result.skipped++;
					continue;
				}

				// Decrypt the stored refresh token
				const decryptedRefresh = decrypt(token.refresh_token, encKey);

				let newTokens: { accessToken: string; refreshToken: string; expiresAt: Date };

				if (token.platform === "x") {
					// ─── X Token Refresh ──────────────────────────────────────
					const clientId = process.env.X_CLIENT_ID;
					const clientSecret = process.env.X_CLIENT_SECRET;
					if (!clientId || !clientSecret) {
						logger.warn("X_CLIENT_ID or X_CLIENT_SECRET not set — skipping X token", {
							tokenId: token.id,
						});
						result.skipped++;
						continue;
					}

					if (!xOAuthClient) {
						xOAuthClient = createXOAuthClient({
							clientId,
							clientSecret,
							callbackUrl: "https://example.com/callback",
						});
					}

					// CRITICAL: X refresh tokens are one-time use
					newTokens = await refreshXToken(xOAuthClient, decryptedRefresh);
				} else if (token.platform === "linkedin") {
					// ─── LinkedIn Token Refresh ───────────────────────────────
					const clientId = process.env.LINKEDIN_CLIENT_ID;
					const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
					if (!clientId || !clientSecret) {
						logger.warn("LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set — skipping LinkedIn token", {
							tokenId: token.id,
						});
						result.skipped++;
						continue;
					}

					if (!linkedInOAuthClient) {
						linkedInOAuthClient = createLinkedInOAuthClient({
							clientId,
							clientSecret,
							callbackUrl: "https://example.com/callback",
						});
					}

					// LinkedIn refresh tokens can be reused (unlike X one-time-use)
					newTokens = await refreshLinkedInToken(linkedInOAuthClient, decryptedRefresh);

					// Progressive warning logging for LinkedIn tokens
					logLinkedInExpiryWarnings(token);
				} else {
					logger.warn("Unknown platform in token refresh", {
						tokenId: token.id,
						platform: token.platform,
					});
					result.skipped++;
					continue;
				}

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
					platform: token.platform,
					expiresAt: newTokens.expiresAt.toISOString(),
				});

				result.refreshed++;
			} catch (error) {
				// Don't let one failure stop processing other tokens
				const errorMessage = error instanceof Error ? error.message : String(error);

				logger.error("Token refresh failed", {
					tokenId: token.id,
					userId: token.user_id,
					platform: token.platform,
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

/**
 * Log progressive warnings for LinkedIn tokens approaching expiry.
 * - 7 days: info
 * - 3 days: warn
 * - 1 day: error (re-auth may be needed)
 */
function logLinkedInExpiryWarnings(token: TokenRow): void {
	if (!token.expires_at) return;

	const now = new Date();
	const expiresAt = new Date(token.expires_at);
	const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

	const context = {
		tokenId: token.id,
		userId: token.user_id,
		expiresAt: expiresAt.toISOString(),
		daysUntilExpiry: Math.round(daysUntilExpiry),
	};

	if (daysUntilExpiry <= 1) {
		logger.error("LinkedIn token expiring tomorrow — re-auth may be needed", context);
	} else if (daysUntilExpiry <= 3) {
		logger.warn("LinkedIn token expiring in 3 days — refresh recommended", context);
	} else if (daysUntilExpiry <= 7) {
		logger.info("LinkedIn token expiring in 7 days", context);
	}
}
