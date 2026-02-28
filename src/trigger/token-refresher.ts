import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { createHubConnection } from "../core/db/connection.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { refreshInstagramToken } from "../platforms/instagram/oauth.ts";
import {
	createLinkedInOAuthClient,
	refreshAccessToken as refreshLinkedInToken,
} from "../platforms/linkedin/oauth.ts";
import { createTikTokOAuthClient, refreshTikTokToken } from "../platforms/tiktok/oauth.ts";
import {
	createXOAuthClient,
	refreshAccessToken as refreshXToken,
	X_CALLBACK_URL,
} from "../platforms/x/oauth.ts";
import {
	CRYPTO_ENV_VARS,
	LINKEDIN_ENV_VARS,
	requireEnvVars,
	TIKTOK_ENV_VARS,
	X_ENV_VARS,
} from "./env-validation.ts";
import { notificationDispatcherTask } from "./notification-dispatcher.ts";

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
	expires_at: Date | string | null;
	metadata: Record<string, unknown> | null;
}

const TokenRowSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	platform: z.string(),
	access_token: z.string(),
	refresh_token: z.string().nullable(),
	expires_at: z.union([z.date(), z.string(), z.null()]),
	metadata: z.record(z.string(), z.unknown()).nullable(),
});

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
		const env = requireEnvVars(CRYPTO_ENV_VARS, "token-refresher");

		const db = createHubConnection(env.DATABASE_URL);
		const encKey = keyFromHex(env.HUB_ENCRYPTION_KEY);

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
			WHERE (
			    (platform = 'x' AND refresh_token IS NOT NULL AND expires_at < NOW() + INTERVAL '1 day')
			    OR (platform = 'linkedin' AND refresh_token IS NOT NULL AND expires_at < NOW() + INTERVAL '7 days')
			    OR (platform = 'instagram' AND expires_at < NOW() + INTERVAL '7 days')
			    OR (platform = 'tiktok' AND refresh_token IS NOT NULL AND expires_at < NOW() + INTERVAL '1 day')
			  )
			FOR UPDATE SKIP LOCKED
			LIMIT 10
		`);

		const rows = z.array(TokenRowSchema).parse(queryResult.rows);
		result.total = rows.length;

		// Build platform-specific OAuth clients lazily
		let xOAuthClient: ReturnType<typeof createXOAuthClient> | null = null;
		let linkedInOAuthClient: ReturnType<typeof createLinkedInOAuthClient> | null = null;
		let tikTokOAuthClient: ReturnType<typeof createTikTokOAuthClient> | null = null;

		for (const token of rows) {
			try {
				// Instagram uses access token refresh (no refresh token needed)
				// X and LinkedIn require a refresh token
				if (!token.refresh_token && token.platform !== "instagram") {
					result.skipped++;
					continue;
				}

				// Decrypt the stored refresh token (for X and LinkedIn)
				const decryptedRefresh = token.refresh_token ? decrypt(token.refresh_token, encKey) : "";

				let newTokens: { accessToken: string; refreshToken: string; expiresAt: Date };

				if (token.platform === "x") {
					// ─── X Token Refresh ──────────────────────────────────────
					const xEnv = requireEnvVars(X_ENV_VARS, "token-refresher/x");

					if (!xOAuthClient) {
						xOAuthClient = createXOAuthClient({
							clientId: xEnv.X_CLIENT_ID,
							clientSecret: xEnv.X_CLIENT_SECRET,
							callbackUrl: X_CALLBACK_URL,
						});
					}

					// CRITICAL: X refresh tokens are one-time use
					newTokens = await refreshXToken(xOAuthClient, decryptedRefresh);
				} else if (token.platform === "linkedin") {
					// ─── LinkedIn Token Refresh ───────────────────────────────
					const liEnv = requireEnvVars(LINKEDIN_ENV_VARS, "token-refresher/linkedin");

					if (!linkedInOAuthClient) {
						linkedInOAuthClient = createLinkedInOAuthClient({
							clientId: liEnv.LINKEDIN_CLIENT_ID,
							clientSecret: liEnv.LINKEDIN_CLIENT_SECRET,
							callbackUrl: "https://example.com/callback",
						});
					}

					// LinkedIn refresh tokens can be reused (unlike X one-time-use)
					newTokens = await refreshLinkedInToken(linkedInOAuthClient, decryptedRefresh);

					// Progressive warning logging for LinkedIn tokens
					logLinkedInExpiryWarnings(token);
				} else if (token.platform === "tiktok") {
					// ─── TikTok Token Refresh ────────────────────────────────
					const ttEnv = requireEnvVars(TIKTOK_ENV_VARS, "token-refresher/tiktok");

					if (!tikTokOAuthClient) {
						tikTokOAuthClient = createTikTokOAuthClient({
							clientKey: ttEnv.TIKTOK_CLIENT_KEY,
							clientSecret: ttEnv.TIKTOK_CLIENT_SECRET,
							callbackUrl: "https://example.com/callback",
						});
					}

					// CRITICAL: TikTok rotates refresh tokens on each refresh — store the new one
					newTokens = await refreshTikTokToken(tikTokOAuthClient, decryptedRefresh);
				} else if (token.platform === "instagram") {
					// ─── Instagram Token Refresh ─────────────────────────────
					// Instagram does NOT use refresh tokens — the access token itself is refreshed
					// via the ig_refresh_token grant type. Decrypt the stored access token to refresh it.
					const decryptedAccess = decrypt(token.access_token, encKey);

					const igResult = await refreshInstagramToken(decryptedAccess);

					// Instagram refresh returns only an access token (no refresh token)
					const expiresAt = new Date(Date.now() + igResult.expiresIn * 1000);
					newTokens = {
						accessToken: igResult.accessToken,
						refreshToken: "", // Instagram has no refresh token
						expiresAt,
					};

					// Progressive warning logging (same pattern as LinkedIn)
					logInstagramExpiryWarnings(token);
				} else {
					logger.warn("Unknown platform in token refresh", {
						tokenId: token.id,
						platform: token.platform,
					});
					result.skipped++;
					continue;
				}

				// Encrypt new tokens for storage
				const encryptedAccess = encrypt(newTokens.accessToken, encKey);
				const encryptedRefresh = newTokens.refreshToken
					? encrypt(newTokens.refreshToken, encKey)
					: null;

				// Update the row atomically with new tokens
				await db.execute(sql`
					UPDATE oauth_tokens
					SET access_token = ${encryptedAccess},
					    refresh_token = ${encryptedRefresh ?? token.refresh_token},
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

				// AUTH-07: Notify user on token refresh failure requiring re-auth
				// Already wired: see lines 267-282, token.expiring notification trigger.

				// Notify user about token expiry requiring re-auth (fire-and-forget)
				try {
					await notificationDispatcherTask.trigger({
						eventType: "token.expiring",
						userId: token.user_id,
						payload: {
							platform: token.platform,
							tokenId: token.id,
							error: errorMessage,
						},
					});
				} catch (notifError) {
					logger.warn("Failed to trigger token expiry notification", {
						tokenId: token.id,
						error: notifError instanceof Error ? notifError.message : String(notifError),
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
 * Log progressive warnings for Instagram tokens approaching expiry.
 * Same pattern as LinkedIn — 60-day tokens with progressive warnings.
 */
function logInstagramExpiryWarnings(token: TokenRow): void {
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
		logger.error("Instagram token expiring tomorrow — re-auth may be needed", context);
	} else if (daysUntilExpiry <= 3) {
		logger.warn("Instagram token expiring in 3 days — refresh recommended", context);
	} else if (daysUntilExpiry <= 7) {
		logger.info("Instagram token expiring in 7 days", context);
	}
}

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
