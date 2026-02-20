import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import type { CollectionSummary } from "../analytics/collector.ts";
import {
	collectAnalytics,
	collectInstagramAnalytics,
	collectLinkedInAnalytics,
	collectTikTokAnalytics,
} from "../analytics/collector.ts";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { InstagramClient } from "../platforms/instagram/client.ts";
import { refreshInstagramToken } from "../platforms/instagram/oauth.ts";
import { LinkedInClient } from "../platforms/linkedin/client.ts";
import {
	createLinkedInOAuthClient,
	refreshAccessToken as refreshLinkedInToken,
} from "../platforms/linkedin/oauth.ts";
import { TikTokClient } from "../platforms/tiktok/client.ts";
import { createTikTokOAuthClient, refreshTikTokToken } from "../platforms/tiktok/oauth.ts";
import { XClient } from "../platforms/x/client.ts";
import { createXOAuthClient, refreshAccessToken as refreshXToken } from "../platforms/x/oauth.ts";

/**
 * Daily analytics collector.
 * Fetches engagement metrics for published posts on all enabled platforms.
 * Runs at 6am UTC daily via Trigger.dev cron.
 *
 * Platform collection is independent — LinkedIn failure does NOT prevent X collection.
 */
export const analyticsCollector = schedules.task({
	id: "analytics-collector",
	cron: "0 6 * * *",
	maxDuration: 300, // 5 minutes
	run: async () => {
		// Load env vars
		const databaseUrl = process.env.DATABASE_URL;
		const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;

		if (!databaseUrl) {
			logger.error("DATABASE_URL not set — cannot run analytics collector");
			return { status: "error", reason: "missing_env" };
		}
		if (!encryptionKeyHex) {
			logger.error("HUB_ENCRYPTION_KEY not set — cannot decrypt tokens");
			return { status: "error", reason: "missing_env" };
		}

		const encKey = keyFromHex(encryptionKeyHex);
		const db = createHubConnection(databaseUrl);
		const userId = "default";

		const results: Record<string, CollectionSummary | { error: string }> = {};

		// ─── X Analytics Collection ─────────────────────────────────────────
		try {
			const xSummary = await collectXAnalytics(db, encKey, userId);
			results.x = xSummary;
			logger.info("X analytics collection complete", { ...xSummary });
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			logger.error("X analytics collection failed", { userId, reason });
			results.x = { error: reason };
		}

		// ─── LinkedIn Analytics Collection ──────────────────────────────────
		try {
			const linkedInSummary = await collectLinkedInAnalyticsTask(db, encKey, userId);
			if (linkedInSummary) {
				results.linkedin = linkedInSummary;
				logger.info("LinkedIn analytics collection complete", { ...linkedInSummary });
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			logger.error("LinkedIn analytics collection failed (X collection unaffected)", {
				userId,
				reason,
			});
			results.linkedin = { error: reason };
		}

		// ─── Instagram Analytics Collection ─────────────────────────────────
		try {
			const instagramSummary = await collectInstagramAnalyticsTask(db, encKey, userId);
			if (instagramSummary) {
				results.instagram = instagramSummary;
				logger.info("Instagram analytics collection complete", { ...instagramSummary });
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			logger.error("Instagram analytics collection failed (other platforms unaffected)", {
				userId,
				reason,
			});
			results.instagram = { error: reason };
		}

		// ─── TikTok Analytics Collection ────────────────────────────────────
		try {
			const tiktokSummary = await collectTikTokAnalyticsTask(db, encKey, userId);
			if (tiktokSummary) {
				results.tiktok = tiktokSummary;
				logger.info("TikTok analytics collection complete", { ...tiktokSummary });
			}
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			logger.error("TikTok analytics collection failed (other platforms unaffected)", {
				userId,
				reason,
			});
			results.tiktok = { error: reason };
		}

		return { status: "success", results };
	},
});

/**
 * Collect X analytics with token refresh.
 */
async function collectXAnalytics(
	db: ReturnType<typeof createHubConnection>,
	encKey: Buffer,
	userId: string,
): Promise<CollectionSummary> {
	const xClientId = process.env.X_CLIENT_ID;
	const xClientSecret = process.env.X_CLIENT_SECRET;

	if (!xClientId || !xClientSecret) {
		logger.warn("X_CLIENT_ID or X_CLIENT_SECRET not set — skipping X analytics");
		return { postsCollected: 0, followerCount: 0, apiCallsMade: 0, errors: 0 };
	}

	// Fetch OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
		.limit(1);

	if (!token) {
		logger.warn("No X OAuth token found for user", { userId });
		return { postsCollected: 0, followerCount: 0, apiCallsMade: 0, errors: 0 };
	}

	// Check token expiry and refresh if needed
	let accessTokenEncrypted = token.accessToken;

	if (token.expiresAt && token.expiresAt < new Date()) {
		if (!token.refreshToken) {
			throw new Error("X token expired and no refresh token available");
		}

		const xOAuthClient = createXOAuthClient({
			clientId: xClientId,
			clientSecret: xClientSecret,
			callbackUrl: "https://example.com/callback",
		});

		const decryptedRefresh = decrypt(token.refreshToken, encKey);
		const newTokens = await refreshXToken(xOAuthClient, decryptedRefresh);

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
		logger.info("X token refreshed during analytics collection", { userId });
	}

	const accessToken = decrypt(accessTokenEncrypted, encKey);
	const client = new XClient(accessToken);

	return collectAnalytics(db, client, userId);
}

/**
 * Collect LinkedIn analytics with token refresh.
 * Returns null if LinkedIn is not configured (optional platform).
 */
async function collectLinkedInAnalyticsTask(
	db: ReturnType<typeof createHubConnection>,
	encKey: Buffer,
	userId: string,
): Promise<CollectionSummary | null> {
	const linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
	const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET;

	if (!linkedInClientId || !linkedInClientSecret) {
		// LinkedIn not configured — skip silently (optional platform)
		return null;
	}

	// Fetch OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'linkedin'`)
		.limit(1);

	if (!token) {
		// No LinkedIn token — skip silently
		logger.info("No LinkedIn OAuth token found — skipping LinkedIn analytics", { userId });
		return null;
	}

	// Check token expiry
	if (token.expiresAt && token.expiresAt < new Date()) {
		if (!token.refreshToken) {
			logger.warn("LinkedIn token expired and no refresh token — skipping", { userId });
			return null;
		}

		const linkedInOAuthClient = createLinkedInOAuthClient({
			clientId: linkedInClientId,
			clientSecret: linkedInClientSecret,
			callbackUrl: "https://example.com/callback",
		});

		const decryptedRefresh = decrypt(token.refreshToken, encKey);
		const newTokens = await refreshLinkedInToken(linkedInOAuthClient, decryptedRefresh);

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

		token.accessToken = encryptedAccess;
		logger.info("LinkedIn token refreshed during analytics collection", { userId });
	}

	const accessToken = decrypt(token.accessToken, encKey);
	const client = new LinkedInClient(accessToken);

	return collectLinkedInAnalytics(db, client, userId);
}

/**
 * Collect Instagram analytics with token refresh.
 * Returns null if Instagram is not configured (optional platform).
 * Instagram tokens have no refresh token — the access token itself is refreshed.
 */
async function collectInstagramAnalyticsTask(
	db: ReturnType<typeof createHubConnection>,
	encKey: Buffer,
	userId: string,
): Promise<CollectionSummary | null> {
	const instagramAppId = process.env.INSTAGRAM_APP_ID;
	const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET;

	if (!instagramAppId || !instagramAppSecret) {
		// Instagram not configured — skip silently
		return null;
	}

	// Fetch OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'instagram'`)
		.limit(1);

	if (!token) {
		logger.info("No Instagram OAuth token found — skipping Instagram analytics", { userId });
		return null;
	}

	// Check token expiry and refresh if needed
	// Instagram uses ig_refresh_token grant — refreshes the access token itself (no separate refresh token)
	let accessTokenEncrypted = token.accessToken;

	if (token.expiresAt && token.expiresAt < new Date()) {
		const decryptedAccess = decrypt(token.accessToken, encKey);

		try {
			const refreshed = await refreshInstagramToken(decryptedAccess);

			const encryptedAccess = encrypt(refreshed.accessToken, encKey);
			const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);

			await db.execute(sql`
				UPDATE oauth_tokens
				SET access_token = ${encryptedAccess},
				    expires_at = ${expiresAt},
				    updated_at = NOW(),
				    metadata = jsonb_set(
				      COALESCE(metadata, '{}'::jsonb),
				      '{lastRefreshAt}',
				      ${JSON.stringify(new Date().toISOString())}::jsonb
				    )
				WHERE id = ${token.id}
			`);

			accessTokenEncrypted = encryptedAccess;
			logger.info("Instagram token refreshed during analytics collection", { userId });
		} catch (error) {
			logger.warn("Instagram token refresh failed — skipping", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	const accessToken = decrypt(accessTokenEncrypted, encKey);

	// Get account ID from token metadata
	const tokenMetadata = (token.metadata ?? {}) as Record<string, unknown>;
	const accountId = tokenMetadata.accountId as string | undefined;

	if (!accountId) {
		logger.warn("Instagram account ID not found in token metadata — skipping", { userId });
		return null;
	}

	const client = new InstagramClient(accessToken, accountId);

	return collectInstagramAnalytics(client, db, userId);
}

/**
 * Collect TikTok analytics with token refresh.
 * Returns null if TikTok is not configured (optional platform).
 * TikTok rotates refresh tokens on each refresh — both new tokens must be stored.
 */
async function collectTikTokAnalyticsTask(
	db: ReturnType<typeof createHubConnection>,
	encKey: Buffer,
	userId: string,
): Promise<CollectionSummary | null> {
	const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
	const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET;

	if (!tiktokClientKey || !tiktokClientSecret) {
		// TikTok not configured — skip silently
		return null;
	}

	// Fetch OAuth token
	const [token] = await db
		.select()
		.from(oauthTokens)
		.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'tiktok'`)
		.limit(1);

	if (!token) {
		logger.info("No TikTok OAuth token found — skipping TikTok analytics", { userId });
		return null;
	}

	// Check token expiry and refresh if needed
	let accessTokenEncrypted = token.accessToken;

	if (token.expiresAt && token.expiresAt < new Date()) {
		if (!token.refreshToken) {
			logger.warn("TikTok token expired and no refresh token — skipping", { userId });
			return null;
		}

		const tiktokOAuthClient = createTikTokOAuthClient({
			clientKey: tiktokClientKey,
			clientSecret: tiktokClientSecret,
			callbackUrl: "https://example.com/callback",
		});

		const decryptedRefresh = decrypt(token.refreshToken, encKey);
		const newTokens = await refreshTikTokToken(tiktokOAuthClient, decryptedRefresh);

		// TikTok rotates BOTH tokens on refresh
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
		logger.info("TikTok token refreshed during analytics collection", { userId });
	}

	const accessToken = decrypt(accessTokenEncrypted, encKey);

	// Get audit status from token metadata
	const tokenMetadata = (token.metadata ?? {}) as Record<string, unknown>;
	const auditStatus = (tokenMetadata.auditStatus as "unaudited" | "audited") ?? "unaudited";

	const client = new TikTokClient(accessToken, { auditStatus });

	return collectTikTokAnalytics(client, db, userId);
}
