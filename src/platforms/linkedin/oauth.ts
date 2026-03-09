import { generateState, LinkedIn } from "arctic";
import { OAUTH_CALLBACK_HOSTNAME, OAUTH_CALLBACK_PORT } from "../x/oauth.ts";
import type { LinkedInOAuthConfig } from "./types.ts";

/** Single source of truth for LinkedIn OAuth callback URL. */
export const LINKEDIN_CALLBACK_URL = `http://${OAUTH_CALLBACK_HOSTNAME}:${OAUTH_CALLBACK_PORT}/callback`;

/** Default scopes that work for all LinkedIn app types (including dev apps). */
const DEFAULT_LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];

/** Analytics scope — requires partner approval, not available on dev apps. */
export const LINKEDIN_ANALYTICS_SCOPE = "r_member_postAnalytics";

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
 *
 * Default scopes (no partner approval needed):
 *   - openid: Required for userinfo endpoint
 *   - profile: User's name and picture
 *   - w_member_social: Create, edit, delete posts
 *
 * Optional scopes (require partner approval):
 *   - r_member_postAnalytics: Read post analytics
 *
 * Note: LinkedIn does NOT support PKCE — no codeVerifier needed.
 */
export function generateAuthUrl(
	client: LinkedIn,
	options?: { scopes?: string[] },
): {
	url: string;
	state: string;
} {
	const state = generateState();
	const scopes = options?.scopes ?? DEFAULT_LINKEDIN_SCOPES;
	const url = client.createAuthorizationURL(state, scopes);
	return { url: url.toString(), state };
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * Called after user authorizes via the auth URL and provides the code.
 *
 * LinkedIn tokens expire in 60 days (not 2 hours like X).
 * Dev apps may not return refresh tokens — returns null in that case.
 */
export async function exchangeCode(
	client: LinkedIn,
	code: string,
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date }> {
	const tokens = await client.validateAuthorizationCode(code);
	let refreshToken: string | null = null;
	try {
		refreshToken = tokens.refreshToken();
	} catch {
		// Dev apps don't return refresh tokens
	}
	return {
		accessToken: tokens.accessToken(),
		refreshToken,
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
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date }> {
	const tokens = await client.refreshAccessToken(refreshToken);
	let newRefreshToken: string | null = null;
	try {
		newRefreshToken = tokens.refreshToken();
	} catch {
		// Refresh may not return a new refresh token
	}
	return {
		accessToken: tokens.accessToken(),
		refreshToken: newRefreshToken,
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}
