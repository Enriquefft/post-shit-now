import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import {
	createLinkedInOAuthClient,
	exchangeCode,
	generateAuthUrl,
} from "../platforms/linkedin/oauth.ts";
import { LinkedInUserInfoSchema } from "../platforms/linkedin/types.ts";

const LINKEDIN_CALLBACK_URL = "https://example.com/callback";

/**
 * LinkedIn OAuth setup step for /psn:setup.
 * Checks for LinkedIn Developer Portal credentials, validates existing tokens,
 * or initiates the OAuth 2.0 authorization flow.
 *
 * LinkedIn setup is optional — skip gracefully if no credentials provided.
 */
export async function setupLinkedInOAuth(configDir = "config"): Promise<SetupResult> {
	// Load hub.env for encryption key and database URL
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return {
			step: "linkedin-oauth",
			status: "error",
			message: hubResult.error,
		};
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	// Load keys.env for LinkedIn credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "linkedin-oauth",
			status: "error",
			message: keysResult.error,
		};
	}

	const clientId = keysResult.data.LINKEDIN_CLIENT_ID;
	const clientSecret = keysResult.data.LINKEDIN_CLIENT_SECRET;

	// If LinkedIn credentials not found, skip gracefully (LinkedIn is optional)
	if (!clientId || !clientSecret) {
		return {
			step: "linkedin-oauth",
			status: "skipped",
			message: "LinkedIn credentials not found — skipping (optional platform)",
			data: {
				instructions: [
					"To enable LinkedIn, add these to config/keys.env:",
					"  LINKEDIN_CLIENT_ID=<your client id>",
					"  LINKEDIN_CLIENT_SECRET=<your client secret>",
					"",
					"Setup steps:",
					"1. Go to https://www.linkedin.com/developers/apps -> Create App",
					"2. Enable 'Share on LinkedIn' product (Products tab, self-serve)",
					"3. Set OAuth redirect URL to: https://example.com/callback (Auth tab)",
					"4. Copy Client ID and Client Secret from Auth tab",
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
				.where(eq(oauthTokens.platform, "linkedin"))
				.limit(1);

			if (existing.length > 0) {
				const token = existing[0];
				if (token?.expiresAt && token.expiresAt > new Date()) {
					// Token exists and is not expired — verify it decrypts
					try {
						const key = keyFromHex(encryptionKey);
						decrypt(token.accessToken, key);
						return {
							step: "linkedin-oauth",
							status: "skipped",
							message: "LinkedIn OAuth token is still valid",
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
	const client = createLinkedInOAuthClient({
		clientId,
		clientSecret,
		callbackUrl: LINKEDIN_CALLBACK_URL,
	});
	const { url, state } = generateAuthUrl(client);

	return {
		step: "linkedin-oauth",
		status: "need_input",
		message: "LinkedIn authorization required",
		data: {
			authUrl: url,
			state,
			instructions:
				"Open the URL above in your browser, authorize the app, then paste the authorization code from the redirect URL (the 'code' parameter)",
		},
	};
}

/**
 * Complete the LinkedIn OAuth flow after user provides the authorization code.
 * Exchanges the code for tokens, fetches person URN, encrypts tokens, and stores in DB.
 */
export async function completeLinkedInOAuth(
	configDir: string,
	code: string,
	_state: string,
): Promise<SetupResult> {
	// Load hub.env
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return { step: "linkedin-oauth", status: "error", message: hubResult.error };
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "linkedin-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub.env",
		};
	}

	// Load LinkedIn credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "linkedin-oauth", status: "error", message: keysResult.error };
	}

	const clientId = keysResult.data.LINKEDIN_CLIENT_ID;
	const clientSecret = keysResult.data.LINKEDIN_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return {
			step: "linkedin-oauth",
			status: "error",
			message: "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be in keys.env",
		};
	}

	// Create client and exchange code (no codeVerifier for LinkedIn)
	const client = createLinkedInOAuthClient({
		clientId,
		clientSecret,
		callbackUrl: LINKEDIN_CALLBACK_URL,
	});

	const tokens = await exchangeCode(client, code);
	const key = keyFromHex(encryptionKey);

	// Fetch person URN via OpenID Connect userinfo endpoint
	let personUrn: string | undefined;
	let userName: string | undefined;
	try {
		const userinfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
			headers: { Authorization: `Bearer ${tokens.accessToken}` },
		});
		if (userinfoResponse.ok) {
			const userinfo = LinkedInUserInfoSchema.parse(await userinfoResponse.json());
			personUrn = userinfo.sub;
			userName = userinfo.name ?? undefined;
		}
	} catch {
		// Userinfo fetch failed — proceed without person URN (can be fetched later)
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
		.where(eq(oauthTokens.platform, "linkedin"))
		.limit(1);

	const metadata: Record<string, unknown> = {
		lastRefreshedAt: new Date().toISOString(),
		...(personUrn ? { personUrn } : {}),
		...(userName ? { userName } : {}),
	};

	if (existing.length > 0) {
		await db
			.update(oauthTokens)
			.set({
				accessToken: encryptedAccess,
				refreshToken: encryptedRefresh,
				expiresAt: tokens.expiresAt,
				scopes: "openid,profile,w_member_social,r_member_postAnalytics",
				metadata,
				updatedAt: new Date(),
			})
			.where(eq(oauthTokens.platform, "linkedin"));
	} else {
		await db.insert(oauthTokens).values({
			userId: "default",
			platform: "linkedin",
			accessToken: encryptedAccess,
			refreshToken: encryptedRefresh,
			expiresAt: tokens.expiresAt,
			scopes: "openid,profile,w_member_social,r_member_postAnalytics",
			metadata,
		});
	}

	return {
		step: "linkedin-oauth",
		status: "success",
		message: `LinkedIn OAuth configured${personUrn ? ` for ${userName ?? personUrn}` : ""} — token expires in 60 days, auto-refresh handles renewal`,
	};
}
