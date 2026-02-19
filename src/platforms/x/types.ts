import { z } from "zod/v4";

// ─── Zod Schemas for X API ─────────────────────────────────────────────────

/** Schema for POST /2/tweets request body */
export const TweetCreateSchema = z.object({
	text: z.string().min(1).max(280),
	reply: z
		.object({
			in_reply_to_tweet_id: z.string(),
		})
		.optional(),
	media: z
		.object({
			media_ids: z.array(z.string()),
		})
		.optional(),
});

export type TweetCreate = z.infer<typeof TweetCreateSchema>;

/** Schema for tweet creation response */
export const TweetResponseSchema = z.object({
	data: z.object({
		id: z.string(),
		text: z.string(),
	}),
});

export type TweetResponse = z.infer<typeof TweetResponseSchema>;

/** Schema for media upload response */
export const MediaUploadResponseSchema = z.object({
	media_id: z.string(),
	media_key: z.string(),
});

export type MediaUploadResponse = z.infer<typeof MediaUploadResponseSchema>;

// ─── Tweet Metrics Schemas (GET /2/tweets) ─────────────────────────────────

/** Public metrics available on any tweet via X API v2 */
export const TweetPublicMetricsSchema = z.object({
	retweet_count: z.number(),
	reply_count: z.number(),
	like_count: z.number(),
	quote_count: z.number(),
	bookmark_count: z.number(),
	impression_count: z.number(),
});

export type TweetPublicMetrics = z.infer<typeof TweetPublicMetricsSchema>;

/** Non-public metrics (only available to tweet author, 30-day window) */
export const TweetNonPublicMetricsSchema = z.object({
	url_link_clicks: z.number().optional(),
	user_profile_clicks: z.number().optional(),
});

export type TweetNonPublicMetrics = z.infer<typeof TweetNonPublicMetricsSchema>;

/** Single tweet with metrics from GET /2/tweets lookup */
export const TweetWithMetricsSchema = z.object({
	id: z.string(),
	text: z.string(),
	public_metrics: TweetPublicMetricsSchema,
	non_public_metrics: TweetNonPublicMetricsSchema.optional(),
});

export type TweetWithMetrics = z.infer<typeof TweetWithMetricsSchema>;

/** Batch tweet lookup response from GET /2/tweets?ids=... */
export const TweetsLookupResponseSchema = z.object({
	data: z.array(TweetWithMetricsSchema),
});

export type TweetsLookupResponse = z.infer<typeof TweetsLookupResponseSchema>;

// ─── User Metrics Schemas (GET /2/users/me) ────────────────────────────────

/** Public metrics on a user profile */
export const UserPublicMetricsSchema = z.object({
	followers_count: z.number(),
	following_count: z.number(),
	tweet_count: z.number(),
	listed_count: z.number(),
});

export type UserPublicMetrics = z.infer<typeof UserPublicMetricsSchema>;

/** User lookup response from GET /2/users/me */
export const UserLookupResponseSchema = z.object({
	data: z.object({
		id: z.string(),
		name: z.string(),
		username: z.string(),
		public_metrics: UserPublicMetricsSchema.optional(),
	}),
});

export type UserLookupResponse = z.infer<typeof UserLookupResponseSchema>;

// ─── Rate Limit Types ───────────────────────────────────────────────────────

export interface RateLimitInfo {
	limit: number;
	remaining: number;
	resetAt: Date;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/** Base error for X API failures with rate limit awareness */
export class XApiError extends Error {
	public readonly statusCode: number;
	public readonly rateLimit?: RateLimitInfo;

	constructor(statusCode: number, message: string, rateLimit?: RateLimitInfo) {
		super(message);
		this.name = "XApiError";
		this.statusCode = statusCode;
		this.rateLimit = rateLimit;
	}

	/** Returns true if this error is due to rate limiting (HTTP 429) */
	get isRateLimit(): boolean {
		return this.statusCode === 429;
	}
}

/** Specialized error for rate limit responses (HTTP 429) */
export class RateLimitError extends XApiError {
	constructor(rateLimit: RateLimitInfo) {
		super(429, `Rate limited — resets at ${rateLimit.resetAt.toISOString()}`, rateLimit);
		this.name = "RateLimitError";
	}
}
