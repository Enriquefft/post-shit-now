import { TikTok, generateCodeVerifier, generateState } from "arctic";
import type { TikTokOAuthConfig } from "./types.ts";

/**
 * Create an Arctic TikTok OAuth 2.0 client with PKCE support.
 */
export function createTikTokOAuthClient(config: TikTokOAuthConfig): TikTok {
	return new TikTok(config.clientKey, config.clientSecret, config.callbackUrl);
}

/**
 * Generate an authorization URL for TikTok OAuth 2.0 PKCE flow.
 * Returns the URL, state parameter, and PKCE code verifier.
 * Caller must store state and codeVerifier for the callback.
 *
 * TikTok scopes:
 *   - user.info.basic: Basic user info (display name, avatar)
 *   - video.list: List user's videos with metrics
 *   - video.publish: Publish videos and photos
 *   - video.upload: Upload video files
 */
export function generateTikTokAuthUrl(client: TikTok): {
	url: string;
	state: string;
	codeVerifier: string;
} {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = ["user.info.basic", "video.list", "video.publish", "video.upload"];
	const url = client.createAuthorizationURL(state, codeVerifier, scopes);
	return { url: url.toString(), state, codeVerifier };
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * Called after user authorizes via the auth URL and provides the code.
 * Requires the codeVerifier from the auth URL generation step (PKCE).
 */
export async function exchangeTikTokCode(
	client: TikTok,
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
 * Refresh an expired TikTok access token using the refresh token.
 * CRITICAL: TikTok rotates refresh tokens on each refresh — store the new one.
 * The old refresh token is invalidated after use.
 */
export async function refreshTikTokToken(
	client: TikTok,
	refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
	const tokens = await client.refreshAccessToken(refreshToken);
	return {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		expiresAt: tokens.accessTokenExpiresAt(),
	};
}
