import { GRAPH_BASE_URL, IG_AUTH_BASE, InstagramApiError, InstagramTokenSchema } from "./types.ts";

/**
 * Instagram Platform API OAuth - Direct Login flow.
 * Arctic does NOT have a native Instagram provider — implemented manually using raw fetch.
 *
 * Flow:
 * 1. generateInstagramAuthUrl() - Build authorization URL
 * 2. exchangeInstagramCode() - Exchange code for short-lived token, then swap for long-lived 60-day token
 * 3. refreshInstagramToken() - Refresh long-lived token before 60-day expiry
 */

// ─── Auth URL Generation ────────────────────────────────────────────────────

/**
 * Build the Instagram authorization URL for the Direct Login OAuth flow.
 * User visits this URL to authorize the app.
 *
 * Scopes:
 *   - instagram_business_basic: Read profile, media
 *   - instagram_business_content_publish: Create posts, reels, carousels
 */
export function generateInstagramAuthUrl(config: {
	appId: string;
	redirectUri: string;
	state: string;
}): string {
	const params = new URLSearchParams({
		client_id: config.appId,
		redirect_uri: config.redirectUri,
		scope: "instagram_business_basic,instagram_business_content_publish",
		response_type: "code",
		state: config.state,
	});

	return `${IG_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

// ─── Code Exchange ──────────────────────────────────────────────────────────

/**
 * Exchange an authorization code for tokens.
 * Two-step process:
 * 1. POST to /oauth/access_token for short-lived token (1 hour)
 * 2. GET /access_token with ig_exchange_token grant for long-lived token (60 days)
 *
 * Returns the long-lived token with userId and expiry.
 */
export async function exchangeInstagramCode(config: {
	appId: string;
	appSecret: string;
	redirectUri: string;
	code: string;
}): Promise<{ accessToken: string; userId: string; expiresIn: number }> {
	// Step 1: Exchange code for short-lived token
	const formData = new URLSearchParams({
		client_id: config.appId,
		client_secret: config.appSecret,
		grant_type: "authorization_code",
		redirect_uri: config.redirectUri,
		code: config.code,
	});

	const shortResponse = await fetch(`${IG_AUTH_BASE}/oauth/access_token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: formData.toString(),
	});

	if (!shortResponse.ok) {
		const bodyText = await shortResponse.text();
		throw new InstagramApiError(
			shortResponse.status,
			`Instagram code exchange failed: ${bodyText}`,
		);
	}

	const shortJson = await shortResponse.json();
	const shortToken = InstagramTokenSchema.parse(shortJson);

	// Step 2: Exchange short-lived token for long-lived 60-day token
	const exchangeParams = new URLSearchParams({
		grant_type: "ig_exchange_token",
		client_secret: config.appSecret,
		access_token: shortToken.access_token,
	});

	const longResponse = await fetch(`${GRAPH_BASE_URL}/access_token?${exchangeParams.toString()}`);

	if (!longResponse.ok) {
		const bodyText = await longResponse.text();
		throw new InstagramApiError(
			longResponse.status,
			`Instagram long-lived token exchange failed: ${bodyText}`,
		);
	}

	const longJson = await longResponse.json();
	const longToken = InstagramTokenSchema.parse(longJson);

	return {
		accessToken: longToken.access_token,
		userId: String(shortToken.user_id ?? ""),
		expiresIn: longToken.expires_in ?? 5184000, // Default 60 days in seconds
	};
}

// ─── Token Refresh ──────────────────────────────────────────────────────────

/**
 * Refresh a long-lived Instagram token.
 * Long-lived tokens can be refreshed as long as they are at least 24 hours old
 * and not expired. Returns a new 60-day token.
 *
 * Note: Instagram does NOT use refresh tokens — the access token itself is refreshed.
 */
export async function refreshInstagramToken(accessToken: string): Promise<{
	accessToken: string;
	expiresIn: number;
}> {
	const params = new URLSearchParams({
		grant_type: "ig_refresh_token",
		access_token: accessToken,
	});

	const response = await fetch(`${GRAPH_BASE_URL}/refresh_access_token?${params.toString()}`);

	if (!response.ok) {
		const bodyText = await response.text();
		throw new InstagramApiError(response.status, `Instagram token refresh failed: ${bodyText}`);
	}

	const json = await response.json();
	const token = InstagramTokenSchema.parse(json);

	return {
		accessToken: token.access_token,
		expiresIn: token.expires_in ?? 5184000,
	};
}
