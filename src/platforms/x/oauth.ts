import { generateCodeVerifier, generateState, Twitter } from "arctic";
import type { XOAuthConfig } from "../../core/types/index.ts";

/** Single source of truth for X OAuth callback URL. Used by setup flow and callback server. */
export const X_CALLBACK_URL = "http://127.0.0.1:18923/callback";
export const OAUTH_CALLBACK_PORT = 18923;
export const OAUTH_CALLBACK_HOSTNAME = "127.0.0.1";

/**
 * Create an Arctic Twitter OAuth 2.0 PKCE client.
 */
export function createXOAuthClient(config: XOAuthConfig): Twitter {
	return new Twitter(config.clientId, config.clientSecret, config.callbackUrl);
}

/**
 * Generate an authorization URL for X OAuth 2.0 PKCE flow.
 * Returns the URL, state parameter, and PKCE code verifier.
 * Caller must store state and codeVerifier for the callback.
 */
export function generateAuthUrl(client: Twitter): {
	url: string;
	state: string;
	codeVerifier: string;
} {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];
	const url = client.createAuthorizationURL(state, codeVerifier, scopes);
	return { url: url.toString(), state, codeVerifier };
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * Called after user authorizes via the auth URL and provides the code.
 */
export async function exchangeCode(
	client: Twitter,
	code: string,
	codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
	const tokens = await client.validateAuthorizationCode(code, codeVerifier);
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}

/**
 * Refresh an expired access token using the refresh token.
 * CRITICAL: X refresh tokens are ONE-TIME USE.
 * The caller MUST store the new refresh token returned here,
 * as the old refresh token is immediately invalidated.
 */
export async function refreshAccessToken(
	client: Twitter,
	refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
	const tokens = await client.refreshAccessToken(refreshToken);
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}
