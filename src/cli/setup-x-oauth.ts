import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../core/db/schema.ts";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { resolveCredentials } from "../core/utils/credentials.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import {
	createXOAuthClient,
	exchangeCode,
	generateAuthUrl,
	X_CALLBACK_URL,
} from "../platforms/x/oauth.ts";
import { captureOAuthCallback } from "./oauth-callback-server.ts";

/**
 * X OAuth setup step for /psn:setup.
 * Checks for X Developer Portal credentials in DB, validates existing tokens,
 * or initiates the OAuth 2.0 PKCE authorization flow.
 */
export async function setupXOAuth(configDir = "config"): Promise<SetupResult> {
	// Load hub.env for encryption key and database URL
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return {
			step: "x-oauth",
			status: "error",
			message: hubResult.error,
		};
	}
	const { databaseUrl, encryptionKey, hubId } = hubResult.data;

	if (!hubId) {
		return { step: "x-oauth", status: "error", message: "Hub ID not found in hub config" };
	}

	// Load X credentials from DB
	const db = drizzle(databaseUrl, { schema });
	const creds = await resolveCredentials(db, hubId, "x", ["client_id", "client_secret"]);

	const clientId = creds?.client_id;
	const clientSecret = creds?.client_secret;

	// If X credentials not found, guide user through Developer Portal setup
	if (!clientId || !clientSecret) {
		return {
			step: "x-oauth",
			status: "need_input",
			message: "X Developer Portal credentials needed",
			data: {
				instructions: [
					"1. Go to developer.x.com and create a project + app",
					"2. Under App Settings -> User authentication settings:",
					"   - Set App permissions: Read and write",
					"   - Set Type: Web App, Automated App or Bot",
					"   - Enable OAuth 2.0",
					"   - Set Callback URL to: http://127.0.0.1:18923/callback",
					"   - Set Website URL to any valid URL",
					"3. Go to Keys and tokens -> OAuth 2.0 Client ID and Client Secret",
					"4. Run `/psn:setup platform x` to configure credentials in the database",
				].join("\n"),
				missingKeys: [
					...(!clientId ? ["client_id"] : []),
					...(!clientSecret ? ["client_secret"] : []),
				],
			},
		};
	}

	// Check for existing valid token in DB
	if (encryptionKey && databaseUrl) {
		try {
			const db = drizzle(databaseUrl, { schema });
			const existing = await db
				.select()
				.from(oauthTokens)
				.where(eq(oauthTokens.platform, "x"))
				.limit(1);

			if (existing.length > 0) {
				const token = existing[0];
				if (token?.expiresAt && token.expiresAt > new Date()) {
					// Token exists and is not expired — verify it decrypts
					try {
						const key = keyFromHex(encryptionKey);
						decrypt(token.accessToken, key);
						return {
							step: "x-oauth",
							status: "skipped",
							message: "X OAuth token is still valid",
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

	// No valid token — initiate OAuth flow
	const client = createXOAuthClient({
		clientId,
		clientSecret,
		callbackUrl: X_CALLBACK_URL,
	});
	const { url, state, codeVerifier } = generateAuthUrl(client);

	// Try automatic capture via callback server
	const outcome = await captureOAuthCallback(state, {
		authUrl: url,
		timeoutMs: 120_000,
	});

	if (outcome.ok) {
		// Auto-captured -- proceed directly to token exchange
		return completeXOAuth(configDir, outcome.result.code, outcome.result.state, codeVerifier);
	}

	// Fallback: manual code entry (OAUTH-04)
	return {
		step: "x-oauth",
		status: "need_input",
		message: `${outcome.error.message} Paste the authorization code from the redirect URL:`,
		data: {
			authUrl: url,
			state,
			codeVerifier,
			instructions:
				"Open the URL above in your browser, authorize the app, then paste the authorization code (the 'code' query parameter from the redirect URL)",
		},
	};
}

/**
 * Complete the X OAuth flow after user provides the authorization code.
 * Exchanges the code for tokens, encrypts them, and stores in DB.
 */
export async function completeXOAuth(
	configDir: string,
	code: string,
	_state: string,
	codeVerifier: string,
): Promise<SetupResult> {
	// Load hub.env
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return { step: "x-oauth", status: "error", message: hubResult.error };
	}
	const { databaseUrl, encryptionKey, hubId } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "x-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub config",
		};
	}

	if (!hubId) {
		return { step: "x-oauth", status: "error", message: "Hub ID not found in hub config" };
	}

	// Load X credentials from DB
	const db = drizzle(databaseUrl, { schema });
	const creds = await resolveCredentials(db, hubId, "x", ["client_id", "client_secret"]);
	if (!creds) {
		return {
			step: "x-oauth",
			status: "error",
			message: "X credentials not configured. Run `/psn:setup platform x` first.",
		};
	}

	const clientId = creds.client_id!;
	const clientSecret = creds.client_secret!;

	// Create client and exchange code
	const client = createXOAuthClient({
		clientId,
		clientSecret,
		callbackUrl: X_CALLBACK_URL,
	});

	const tokens = await exchangeCode(client, code, codeVerifier);
	const key = keyFromHex(encryptionKey);

	// Encrypt tokens
	const encryptedAccess = encrypt(tokens.accessToken, key);
	const encryptedRefresh = tokens.refreshToken ? encrypt(tokens.refreshToken, key) : null;

	// Upsert into oauth_tokens
	const existing = await db
		.select()
		.from(oauthTokens)
		.where(eq(oauthTokens.platform, "x"))
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(oauthTokens)
			.set({
				accessToken: encryptedAccess,
				refreshToken: encryptedRefresh,
				expiresAt: tokens.expiresAt,
				scopes: "tweet.read,tweet.write,users.read,media.write,offline.access",
				metadata: { lastRefreshedAt: new Date().toISOString(), state: undefined },
				updatedAt: new Date(),
			})
			.where(eq(oauthTokens.platform, "x"));
	} else {
		await db.insert(oauthTokens).values({
			userId: "default",
			platform: "x",
			accessToken: encryptedAccess,
			refreshToken: encryptedRefresh,
			expiresAt: tokens.expiresAt,
			scopes: "tweet.read,tweet.write,users.read,media.write,offline.access",
			metadata: { lastRefreshedAt: new Date().toISOString(), state: undefined },
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}

	return {
		step: "x-oauth",
		status: "success",
		message: "X OAuth configured -- token expires in 2 hours, auto-refresh handles renewal",
	};
}
