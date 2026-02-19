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
