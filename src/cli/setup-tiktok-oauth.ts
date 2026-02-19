import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import {
	createTikTokOAuthClient,
	exchangeTikTokCode,
	generateTikTokAuthUrl,
} from "../platforms/tiktok/oauth.ts";

const TIKTOK_CALLBACK_URL = "https://example.com/callback";

/**
 * TikTok OAuth setup step for /psn:setup.
 * Checks for TikTok Developer Portal credentials, validates existing tokens,
 * or initiates the OAuth 2.0 PKCE authorization flow.
 *
 * TikTok setup is optional — skip gracefully if no credentials provided.
 */
export async function setupTikTokOAuth(configDir = "config"): Promise<SetupResult> {
	// Load hub.env for encryption key and database URL
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: hubResult.error,
		};
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	// Load keys.env for TikTok credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: keysResult.error,
		};
	}

	const clientKey = keysResult.data.TIKTOK_CLIENT_KEY;
	const clientSecret = keysResult.data.TIKTOK_CLIENT_SECRET;

	// If TikTok credentials not found, skip gracefully (TikTok is optional)
	if (!clientKey || !clientSecret) {
		return {
			step: "tiktok-oauth",
			status: "skipped",
			message: "TikTok credentials not found — skipping (optional platform)",
			data: {
				instructions: [
					"To enable TikTok, add these to config/keys.env:",
					"  TIKTOK_CLIENT_KEY=<your app key>",
					"  TIKTOK_CLIENT_SECRET=<your app secret>",
					"",
					"Setup steps:",
					"1. Go to https://developers.tiktok.com -> Manage Apps -> Create",
					"2. Enable scopes: user.info.basic, video.list, video.publish, video.upload",
					"3. Set OAuth redirect URL to: https://example.com/callback",
					"4. Copy App Key and App Secret from app settings",
					"5. (Optional) Submit for API audit — without audit, posts are draft-only (SELF_ONLY visibility)",
				].join("\n"),
			},
		};
	}

	// Check for existing valid token in DB
	if (encryptionKey && databaseUrl) {
		try {
			const sql = neon(databaseUrl);
			const db = drizzle(sql);
			const existing = await db
				.select()
				.from(oauthTokens)
				.where(eq(oauthTokens.platform, "tiktok"))
				.limit(1);

			if (existing.length > 0) {
				const token = existing[0];
				if (token?.expiresAt && token.expiresAt > new Date()) {
					// Token exists and is not expired — verify it decrypts
					try {
						const key = keyFromHex(encryptionKey);
						decrypt(token.accessToken, key);
						return {
							step: "tiktok-oauth",
							status: "skipped",
							message: "TikTok OAuth token is still valid",
						};
					} catch {
						// Token can't be decrypted, re-auth needed
					}
				}
			}
		} catch {
			// DB query failed — proceed with auth flow
		}
	}

	// No valid token — generate auth URL with PKCE
	const client = createTikTokOAuthClient({
		clientKey,
		clientSecret,
		callbackUrl: TIKTOK_CALLBACK_URL,
	});
	const { url, state, codeVerifier } = generateTikTokAuthUrl(client);

	return {
		step: "tiktok-oauth",
		status: "need_input",
		message: "TikTok authorization required",
		data: {
			authUrl: url,
			state,
			codeVerifier,
			instructions:
				"Open the URL above in your browser, authorize the app, then paste the authorization code from the redirect URL (the 'code' parameter)",
			note: "Without API audit approval, all posts will be draft-only (SELF_ONLY visibility). You can submit for audit later at https://developers.tiktok.com",
		},
	};
}

/**
 * Complete the TikTok OAuth flow after user provides the authorization code.
 * Exchanges the code for tokens (with PKCE), encrypts tokens, and stores in DB.
 */
export async function completeTikTokOAuth(
	configDir: string,
	code: string,
	_state: string,
	codeVerifier: string,
): Promise<SetupResult> {
	// Load hub.env
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return { step: "tiktok-oauth", status: "error", message: hubResult.error };
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub.env",
		};
	}

	// Load TikTok credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "tiktok-oauth", status: "error", message: keysResult.error };
	}

	const clientKey = keysResult.data.TIKTOK_CLIENT_KEY;
	const clientSecret = keysResult.data.TIKTOK_CLIENT_SECRET;
	if (!clientKey || !clientSecret) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET must be in keys.env",
		};
	}

	// Create client and exchange code with PKCE codeVerifier
	const client = createTikTokOAuthClient({
		clientKey,
		clientSecret,
		callbackUrl: TIKTOK_CALLBACK_URL,
	});

	const tokens = await exchangeTikTokCode(client, code, codeVerifier);
	const key = keyFromHex(encryptionKey);

	// Fetch user info to get open_id
	let openId: string | undefined;
	let displayName: string | undefined;
	try {
		const userInfoResponse = await fetch(
			"https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count",
			{
				headers: { Authorization: `Bearer ${tokens.accessToken}` },
			},
		);
		if (userInfoResponse.ok) {
			const userInfo = (await userInfoResponse.json()) as {
				data?: { user?: { open_id?: string; display_name?: string } };
			};
			openId = userInfo.data?.user?.open_id;
			displayName = userInfo.data?.user?.display_name;
		}
	} catch {
		// User info fetch failed — proceed without (can be fetched later)
	}

	// Encrypt tokens
	const encryptedAccess = encrypt(tokens.accessToken, key);
	const encryptedRefresh = encrypt(tokens.refreshToken, key);

	// Upsert into oauth_tokens
	const sql = neon(databaseUrl);
	const db = drizzle(sql);

	const existing = await db
		.select()
		.from(oauthTokens)
		.where(eq(oauthTokens.platform, "tiktok"))
		.limit(1);

	const metadata: Record<string, unknown> = {
		lastRefreshedAt: new Date().toISOString(),
		auditStatus: "unaudited", // Default to unaudited — user updates after API audit approval
		...(openId ? { openId } : {}),
		...(displayName ? { displayName } : {}),
	};

	if (existing.length > 0) {
		await db
			.update(oauthTokens)
			.set({
				accessToken: encryptedAccess,
				refreshToken: encryptedRefresh,
				expiresAt: tokens.expiresAt,
				scopes: "user.info.basic,video.list,video.publish,video.upload",
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(oauthTokens.platform, "tiktok"));
	} else {
		await db.insert(oauthTokens).values({
			userId: "default",
			platform: "tiktok",
			accessToken: encryptedAccess,
			refreshToken: encryptedRefresh,
			expiresAt: tokens.expiresAt,
			scopes: "user.info.basic,video.list,video.publish,video.upload",
			metadata,
		});
	}

	return {
		step: "tiktok-oauth",
		status: "success",
		message: `TikTok OAuth configured${displayName ? ` for ${displayName}` : ""}${openId ? ` (${openId})` : ""} — NOTE: App is unaudited, posts will be draft-only (SELF_ONLY visibility) until API audit is approved`,
	};
}
