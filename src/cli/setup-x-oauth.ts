import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { oauthTokens } from "../core/db/schema.ts";
import type { SetupResult } from "../core/types/index.ts";
import { decrypt, encrypt, keyFromHex } from "../core/utils/crypto.ts";
import { loadHubEnv, loadKeysEnv } from "../core/utils/env.ts";
import { createXOAuthClient, exchangeCode, generateAuthUrl } from "../platforms/x/oauth.ts";

const X_CALLBACK_URL = "https://example.com/callback";

/**
 * X OAuth setup step for /psn:setup.
 * Checks for X Developer Portal credentials, validates existing tokens,
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
	const { databaseUrl, encryptionKey } = hubResult.data;

	// Load keys.env for X credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return {
			step: "x-oauth",
			status: "error",
			message: keysResult.error,
		};
	}

	const clientId = keysResult.data.X_CLIENT_ID;
	const clientSecret = keysResult.data.X_CLIENT_SECRET;

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
					"   - Set Callback URL to: https://example.com/callback",
					"   - Set Website URL to any valid URL",
					"3. Go to Keys and tokens -> OAuth 2.0 Client ID and Client Secret",
					"4. Add to config/keys.env:",
					"   X_CLIENT_ID=<your client id>",
					"   X_CLIENT_SECRET=<your client secret>",
				].join("\n"),
				missingKeys: [
					...(!clientId ? ["X_CLIENT_ID"] : []),
					...(!clientSecret ? ["X_CLIENT_SECRET"] : []),
				],
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

	// No valid token — generate auth URL
	const client = createXOAuthClient({
		clientId,
		clientSecret,
		callbackUrl: X_CALLBACK_URL,
	});
	const { url, state: _state, codeVerifier } = generateAuthUrl(client);

	return {
		step: "x-oauth",
		status: "need_input",
		message: "X authorization required",
		data: {
			authUrl: url,
			state: _state,
			codeVerifier,
			instructions:
				"Open the URL above in your browser, authorize the app, then paste the authorization code from the redirect URL (the 'code' parameter)",
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
	// biome-ignore lint/correctness/noUnusedVariables: Parameter is used for metadata storage
	codeVerifier: string,
): Promise<SetupResult> {
	// Load hub.env
	const hubResult = await loadHubEnv(configDir);
	if (!hubResult.success) {
		return { step: "x-oauth", status: "error", message: hubResult.error };
	}
	const { databaseUrl, encryptionKey } = hubResult.data;

	if (!encryptionKey) {
		return {
			step: "x-oauth",
			status: "error",
			message: "HUB_ENCRYPTION_KEY not found in hub.env",
		};
	}

	// Load X credentials
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "x-oauth", status: "error", message: keysResult.error };
	}

	const clientId = keysResult.data.X_CLIENT_ID;
	const clientSecret = keysResult.data.X_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		return {
			step: "x-oauth",
			status: "error",
			message: "X_CLIENT_ID and X_CLIENT_SECRET must be in keys.env",
		};
	}

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
	const encryptedRefresh = encrypt(tokens.refreshToken, key);

	// Upsert into oauth_tokens
	const db = drizzle(databaseUrl);

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
