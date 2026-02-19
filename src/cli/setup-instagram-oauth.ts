import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import {
	exchangeInstagramCode,
	generateInstagramAuthUrl,
} from "../platforms/instagram/oauth.ts";

const INSTAGRAM_CALLBACK_URL = "https://example.com/callback";

/**
 * Instagram OAuth setup step for /psn:setup.
 * Checks for Meta Developer Portal credentials, validates existing tokens,
 * or initiates the Instagram Direct Login OAuth flow.
 *
 * Instagram setup is optional — skip gracefully if no credentials provided.
 */
export async function setupInstagramOAuth(configDir = "config"): Promise<SetupResult> {
	// Load hub.env for encryption key and database URL
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return {
			step: "instagram-oauth",
			status: "error",
			message: hubResult.error,
		};
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	// Load keys.env for Instagram credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "instagram-oauth",
			status: "error",
			message: keysResult.error,
		};
	}

	const appId = keysResult.data.INSTAGRAM_APP_ID;
	const appSecret = keysResult.data.INSTAGRAM_APP_SECRET;

	// If Instagram credentials not found, skip gracefully (Instagram is optional)
	if (!appId || !appSecret) {
		return {
			step: "instagram-oauth",
			status: "skipped",
			message: "Instagram credentials not found — skipping (optional platform)",
			data: {
				instructions: [
					"To enable Instagram, add these to config/keys.env:",
					"  INSTAGRAM_APP_ID=<your app id>",
					"  INSTAGRAM_APP_SECRET=<your app secret>",
					"",
					"Setup steps:",
					"1. Go to https://developers.facebook.com/apps -> Create App -> Other -> Consumer",
					"2. Add Instagram Platform API product",
					"3. Configure scopes: instagram_business_basic, instagram_business_content_publish",
					"4. Set OAuth redirect URL to: https://example.com/callback",
					"5. Copy App ID and App Secret from App Dashboard",
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
				.where(eq(oauthTokens.platform, "instagram"))
				.limit(1);

			if (existing.length > 0) {
				const token = existing[0];
				if (token?.expiresAt && token.expiresAt > new Date()) {
					// Token exists and is not expired — verify it decrypts
					try {
						const key = keyFromHex(encryptionKey);
						decrypt(token.accessToken, key);
						return {
							step: "instagram-oauth",
							status: "skipped",
							message: "Instagram OAuth token is still valid",
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

	// No valid token — generate auth URL
	const state = crypto.randomUUID();
	const url = generateInstagramAuthUrl({
		appId,
		redirectUri: INSTAGRAM_CALLBACK_URL,
		state,
	});

	return {
		step: "instagram-oauth",
		status: "need_input",
		message: "Instagram authorization required",
		data: {
			authUrl: url,
			state,
			instructions:
				"Open the URL above in your browser, authorize the app, then paste the authorization code from the redirect URL (the 'code' parameter)",
		},
	};
}

/**
 * Complete the Instagram OAuth flow after user provides the authorization code.
 * Exchanges the code for a long-lived 60-day token, encrypts it, and stores in DB.
 */
export async function completeInstagramOAuth(
	configDir: string,
	code: string,
	_state: string,
): Promise<SetupResult> {
	// Load hub.env
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return { step: "instagram-oauth", status: "error", message: hubResult.error };
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "instagram-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub.env",
		};
	}

	// Load Instagram credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "instagram-oauth", status: "error", message: keysResult.error };
	}

	const appId = keysResult.data.INSTAGRAM_APP_ID;
	const appSecret = keysResult.data.INSTAGRAM_APP_SECRET;
	if (!appId || !appSecret) {
		return {
			step: "instagram-oauth",
			status: "error",
			message: "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be in keys.env",
		};
	}

	// Exchange code for long-lived token
	const tokens = await exchangeInstagramCode({
		appId,
		appSecret,
		redirectUri: INSTAGRAM_CALLBACK_URL,
		code,
	});

	const key = keyFromHex(encryptionKey);

	// Encrypt access token (Instagram has no refresh token — the access token itself is refreshed)
	const encryptedAccess = encrypt(tokens.accessToken, key);

	// Calculate expiry date
	const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

	// Upsert into oauth_tokens
	const sql = neon(databaseUrl);
	const db = drizzle(sql);

	const existing = await db
		.select()
		.from(oauthTokens)
		.where(eq(oauthTokens.platform, "instagram"))
		.limit(1);

	const metadata: Record<string, unknown> = {
		userId: tokens.userId,
		expiresAt: expiresAt.toISOString(),
		lastRefreshedAt: new Date().toISOString(),
	};

	if (existing.length > 0) {
		await db
			.update(oauthTokens)
			.set({
				accessToken: encryptedAccess,
				refreshToken: null, // Instagram does not use refresh tokens
				expiresAt,
				scopes: "instagram_business_basic,instagram_business_content_publish",
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(oauthTokens.platform, "instagram"));
	} else {
		await db.insert(oauthTokens).values({
			userId: "default",
			platform: "instagram",
			accessToken: encryptedAccess,
			refreshToken: null, // Instagram does not use refresh tokens
			expiresAt,
			scopes: "instagram_business_basic,instagram_business_content_publish",
			metadata,
		});
	}

	return {
		step: "instagram-oauth",
		status: "success",
		message: `Instagram OAuth configured for user ${tokens.userId} — token expires in 60 days, auto-refresh handles renewal`,
	};
}
