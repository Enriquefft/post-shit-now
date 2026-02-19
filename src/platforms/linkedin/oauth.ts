import { LinkedIn, generateState } from "arctic";
import type { LinkedInOAuthConfig } from "./types.ts";

/**
 * Create an Arctic LinkedIn OAuth 2.0 client.
 * LinkedIn does NOT use PKCE (unlike X) — uses state parameter only.
 */
export function createLinkedInOAuthClient(config: LinkedInOAuthConfig): LinkedIn {
	return new LinkedIn(config.clientId, config.clientSecret, config.callbackUrl);
}

/**
 * Generate an authorization URL for LinkedIn OAuth 2.0 flow.
 * Returns the URL and state parameter.
 * LinkedIn scopes:
 *   - openid: Required for userinfo endpoint
 *   - profile: User's name and picture
 *   - w_member_social: Create, edit, delete posts
 *   - r_member_postAnalytics: Read post analytics (impressions, reactions, etc.)
 *
 * Note: LinkedIn does NOT support PKCE — no codeVerifier needed.
 */
export function generateAuthUrl(client: LinkedIn): {
	url: string;
	state: string;
} {
	const state = generateState();
	const scopes = ["openid", "profile", "w_member_social", "r_member_postAnalytics"];
	const url = client.createAuthorizationURL(state, scopes);
	return { url: url.toString(), state };
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * Called after user authorizes via the auth URL and provides the code.
 *
 * LinkedIn tokens expire in 60 days (not 2 hours like X).
 */
export async function exchangeCode(
	client: LinkedIn,
	code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
	const tokens = await client.validateAuthorizationCode(code);
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}

/**
 * Refresh an expired LinkedIn access token using the refresh token.
 * Unlike X, LinkedIn refresh tokens can be reused until they expire
 * (refresh_token_expires_in is typically 365 days).
 */
export async function refreshAccessToken(
	client: LinkedIn,
	refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
	const tokens = await client.refreshAccessToken(refreshToken);
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}
