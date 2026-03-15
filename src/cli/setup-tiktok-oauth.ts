import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { z } from "zod/v4";
import * as schema from "../core/db/schema.ts";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { resolveCredentials } from "../core/utils/credentials.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import {
	createTikTokOAuthClient,
	exchangeTikTokCode,
	generateTikTokAuthUrl,
	TIKTOK_CALLBACK_URL,
} from "../platforms/tiktok/oauth.ts";

/**
 * TikTok OAuth setup step for /psn:setup.
 * Checks for TikTok Developer Portal credentials in DB, validates existing tokens,
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
	const { databaseUrl, encryptionKey, hubId } = hubResult.data;

	if (!hubId) {
		return { step: "tiktok-oauth", status: "error", message: "Hub ID not found in hub config" };
	}

	// Load TikTok credentials from DB
	const db = drizzle(databaseUrl, { schema });
	const creds = await resolveCredentials(db, hubId, "tiktok", ["client_key", "client_secret"]);

	const clientKey = creds?.client_key;
	const clientSecret = creds?.client_secret;

	// If TikTok credentials not found, skip gracefully (TikTok is optional)
	if (!clientKey || !clientSecret) {
		return {
			step: "tiktok-oauth",
			status: "skipped",
			message: "TikTok credentials not found — skipping (optional platform)",
			data: {
				instructions: [
					"To enable TikTok, run `/psn:setup platform tiktok` with:",
					"  client_key: <your app key>",
					"  client_secret: <your app secret>",
					"",
					"Setup steps:",
					"1. Go to https://developers.tiktok.com -> Manage Apps -> Create",
					"2. Enable scopes: user.info.basic, video.list, video.publish, video.upload",
					`3. Set OAuth redirect URL to: ${TIKTOK_CALLBACK_URL}`,
					"4. Copy App Key and App Secret from app settings",
					"5. (Optional) Submit for API audit — without audit, posts are draft-only (SELF_ONLY visibility)",
				].join("\n"),
			},
		};
	}

	// Check for existing valid token in DB
	if (encryptionKey && databaseUrl) {
		try {
			const db = drizzle(databaseUrl);
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
	const { databaseUrl, encryptionKey, hubId } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub config",
		};
	}

	if (!hubId) {
		return { step: "tiktok-oauth", status: "error", message: "Hub ID not found in hub config" };
	}

	// Load TikTok credentials from DB
	const db = drizzle(databaseUrl, { schema });
	const creds = await resolveCredentials(db, hubId, "tiktok", ["client_key", "client_secret"]);
	if (!creds) {
		return {
			step: "tiktok-oauth",
			status: "error",
			message: "TikTok credentials not configured. Run `/psn:setup platform tiktok` first.",
		};
	}

	const clientKey = creds.client_key!;
	const clientSecret = creds.client_secret!;

	// Create client and exchange code with PKCE codeVerifier
	const client = createTikTokOAuthClient({
		clientKey,
		clientSecret,
		callbackUrl: TIKTOK_CALLBACK_URL,
	});

	const tokens = await exchangeTikTokCode(client, code, codeVerifier);
	const key = keyFromHex(encryptionKey);

	// Fetch user info to get open_id
	const tiktokUserInfoSchema = z.object({
		data: z
			.object({
				user: z
					.object({
						open_id: z.string().optional(),
						display_name: z.string().optional(),
					})
					.optional(),
			})
			.optional(),
	});

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
			const userInfo = tiktokUserInfoSchema.parse(await userInfoResponse.json());
			openId = userInfo.data?.user?.open_id;
			displayName = userInfo.data?.user?.display_name;
		}
	} catch {
		// User info fetch failed — proceed without (can be fetched later)
	}

	// Encrypt tokens (refresh token may be null)
	const encryptedAccess = encrypt(tokens.accessToken, key);
	const encryptedRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken, key) : null;

	// Upsert into oauth_tokens
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
