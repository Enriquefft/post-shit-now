import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { collectAnalytics } from "../analytics/collector.ts";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { XClient } from "../platforms/x/client.ts";
import { createXOAuthClient, refreshAccessToken } from "../platforms/x/oauth.ts";

/**
 * Daily analytics collector.
 * Fetches X engagement metrics for published posts, computes scores, and stores them.
 * Runs at 6am UTC daily via Trigger.dev cron.
 */
export const analyticsCollector = schedules.task({
	id: "analytics-collector",
	cron: "0 6 * * *",
	maxDuration: 300, // 5 minutes
	run: async () => {
		// Load env vars
		const databaseUrl = process.env.DATABASE_URL;
		const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;
		const xClientId = process.env.X_CLIENT_ID;
		const xClientSecret = process.env.X_CLIENT_SECRET;

		if (!databaseUrl) {
			logger.error("DATABASE_URL not set — cannot run analytics collector");
			return { status: "error", reason: "missing_env" };
		}
		if (!encryptionKeyHex) {
			logger.error("HUB_ENCRYPTION_KEY not set — cannot decrypt tokens");
			return { status: "error", reason: "missing_env" };
		}
		if (!xClientId || !xClientSecret) {
			logger.error("X_CLIENT_ID or X_CLIENT_SECRET not set");
			return { status: "error", reason: "missing_env" };
		}

		const encKey = keyFromHex(encryptionKeyHex);
		const db = createHubConnection(databaseUrl);

		// Fetch OAuth token for default user
		const userId = "default";
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
			.limit(1);

		if (!token) {
			logger.error("No X OAuth token found for user", { userId });
			return { status: "error", reason: "no_oauth_token" };
		}

		// Check token expiry and refresh if needed (same pattern as publish-post.ts)
		let accessTokenEncrypted = token.accessToken;

		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				logger.error("Token expired and no refresh token available", { userId });
				return { status: "error", reason: "token_expired_no_refresh" };
			}

			try {
				const xOAuthClient = createXOAuthClient({
					clientId: xClientId,
					clientSecret: xClientSecret,
					callbackUrl: "https://example.com/callback",
				});

				const decryptedRefresh = decrypt(token.refreshToken, encKey);
				const newTokens = await refreshAccessToken(xOAuthClient, decryptedRefresh);

				const encryptedAccess = encrypt(newTokens.accessToken, encKey);
				const encryptedRefresh = encrypt(newTokens.refreshToken, encKey);

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

				accessTokenEncrypted = encryptedAccess;
				logger.info("Token refreshed during analytics collection", { userId });
			} catch (refreshError) {
				const reason = refreshError instanceof Error ? refreshError.message : String(refreshError);
				logger.error("Token refresh failed", { userId, reason });
				return { status: "error", reason: "token_refresh_failed" };
			}
		}

		// Create client and run collection
		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const client = new XClient(accessToken);

		const summary = await collectAnalytics(db, client, userId);

		logger.info("Analytics collection complete", {
			postsCollected: summary.postsCollected,
			followerCount: summary.followerCount,
			apiCallsMade: summary.apiCallsMade,
			errors: summary.errors,
		});

		return { status: "success", ...summary };
	},
});
