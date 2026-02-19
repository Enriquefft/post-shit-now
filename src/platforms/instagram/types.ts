import { z } from "zod/v4";

// ─── Platform Constants ─────────────────────────────────────────────────────

export const GRAPH_BASE_URL = "https://graph.instagram.com";
export const IG_AUTH_BASE = "https://api.instagram.com";

// ─── Rate Limit Constants ───────────────────────────────────────────────────

/** Instagram Platform API rate limits */
export const MAX_REQUESTS_PER_HOUR = 200;
export const MAX_POSTS_PER_DAY = 25;
export const MAX_HASHTAG_SEARCHES_PER_WEEK = 30;

// ─── Zod Schemas for Instagram API ──────────────────────────────────────────

/** Schema for container creation response (id + status_code) */
export const InstagramContainerSchema = z.object({
	id: z.string(),
	status_code: z.string().optional(),
});

export type InstagramContainer = z.infer<typeof InstagramContainerSchema>;

/** Schema for container status check response */
export const InstagramContainerStatusSchema = z.object({
	id: z.string(),
	status_code: z.string(),
});

export type InstagramContainerStatus = z.infer<typeof InstagramContainerStatusSchema>;

/** Schema for media object from GET /{media-id} or /{account-id}/media */
export const InstagramMediaSchema = z.object({
	id: z.string(),
	media_type: z.string().optional(),
	caption: z.string().optional(),
	timestamp: z.string().optional(),
	permalink: z.string().optional(),
	like_count: z.number().optional(),
	comments_count: z.number().optional(),
});

export type InstagramMedia = z.infer<typeof InstagramMediaSchema>;

/** Schema for media list response */
export const InstagramMediaListSchema = z.object({
	data: z.array(InstagramMediaSchema),
	paging: z
		.object({
			cursors: z
				.object({
					before: z.string().optional(),
					after: z.string().optional(),
				})
				.optional(),
			next: z.string().optional(),
		})
		.optional(),
});

export type InstagramMediaList = z.infer<typeof InstagramMediaListSchema>;

/** Schema for insights response */
export const InstagramInsightValueSchema = z.object({
	value: z.union([z.number(), z.record(z.string(), z.number())]),
	end_time: z.string().optional(),
});

export const InstagramInsightSchema = z.object({
	name: z.string(),
	period: z.string().optional(),
	values: z.array(InstagramInsightValueSchema),
	title: z.string().optional(),
	description: z.string().optional(),
	id: z.string().optional(),
});

export const InstagramInsightsSchema = z.object({
	data: z.array(InstagramInsightSchema),
});

export type InstagramInsights = z.infer<typeof InstagramInsightsSchema>;

/** Schema for token exchange/refresh response */
export const InstagramTokenSchema = z.object({
	access_token: z.string(),
	token_type: z.string().optional(),
	expires_in: z.number().optional(),
	user_id: z.union([z.string(), z.number()]).optional(),
});

export type InstagramToken = z.infer<typeof InstagramTokenSchema>;

/** Schema for user profile response */
export const InstagramProfileSchema = z.object({
	id: z.string(),
	username: z.string().optional(),
	followers_count: z.number().optional(),
	media_count: z.number().optional(),
});

export type InstagramProfile = z.infer<typeof InstagramProfileSchema>;

/** Schema for hashtag search response */
export const InstagramHashtagSearchSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
		}),
	),
});

export type InstagramHashtagSearch = z.infer<typeof InstagramHashtagSearchSchema>;

/** Schema for publish response */
export const InstagramPublishSchema = z.object({
	id: z.string(),
});

export type InstagramPublish = z.infer<typeof InstagramPublishSchema>;

/** Schema for comment response */
export const InstagramCommentSchema = z.object({
	id: z.string(),
});

export type InstagramComment = z.infer<typeof InstagramCommentSchema>;

// ─── Rate Limit Types ───────────────────────────────────────────────────────

export interface InstagramRateLimitInfo {
	/** Remaining calls allowed in current window */
	remaining: number;
	/** When the rate limit window resets */
	resetAt: Date;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/** Base error for Instagram API failures with rate limit awareness */
export class InstagramApiError extends Error {
	public readonly statusCode: number;
	public readonly rateLimit?: InstagramRateLimitInfo;

	constructor(statusCode: number, message: string, rateLimit?: InstagramRateLimitInfo) {
		super(message);
		this.name = "InstagramApiError";
		this.statusCode = statusCode;
		this.rateLimit = rateLimit;
	}

	/** Returns true if this error is due to rate limiting (HTTP 429) */
	get isRateLimit(): boolean {
		return this.statusCode === 429;
	}
}

/** Specialized error for Instagram rate limit responses (HTTP 429) */
export class InstagramRateLimitError extends InstagramApiError {
	constructor(rateLimit: InstagramRateLimitInfo) {
		super(429, `Instagram rate limited — resets at ${rateLimit.resetAt.toISOString()}`, rateLimit);
		this.name = "InstagramRateLimitError";
	}
}
