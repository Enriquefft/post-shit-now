/**
 * Real X API v2 response shapes for test data.
 * Shapes match actual X API responses documented at:
 * https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets
 */

import type { RateLimitInfo } from "../x/types.ts";

/** Successful tweet creation response (POST /2/tweets) */
export const TWEET_RESPONSE = {
	data: {
		id: "1849234567890123456",
		text: "Hello world",
	},
} as const;

/** 403 Forbidden -- duplicate content error response */
export const DUPLICATE_ERROR_RESPONSE = {
	status: 403,
	detail: "You are not allowed to create a Tweet with duplicate content.",
	type: "about:blank",
	title: "Forbidden",
} as const;

/** Rate limit headers from X API responses (string values as returned by HTTP headers) */
export const RATE_LIMIT_HEADERS = {
	"x-rate-limit-limit": "300",
	"x-rate-limit-remaining": "0",
	"x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
} as const;

/** Default rate limit info for mock client responses (not rate-limited state) */
export function createDefaultRateLimit(): RateLimitInfo {
	return {
		limit: 300,
		remaining: 299,
		resetAt: new Date(Date.now() + 15 * 60 * 1000),
	};
}
