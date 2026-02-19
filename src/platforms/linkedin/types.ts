import { z } from "zod/v4";

// ─── LinkedIn OAuth Config ──────────────────────────────────────────────────

export interface LinkedInOAuthConfig {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
}

// ─── Zod Schemas for LinkedIn API ───────────────────────────────────────────

/** Schema for LinkedIn post creation — the post ID comes from x-restli-id header, not body */
export const LinkedInPostCreateResponseSchema = z.object({
	// LinkedIn returns empty body on success; post ID is in x-restli-id header
	// This schema validates any object (including empty)
});

export type LinkedInPostCreateResponse = z.infer<typeof LinkedInPostCreateResponseSchema>;

/** Schema for LinkedIn image upload initialization response */
export const LinkedInImageUploadResponseSchema = z.object({
	value: z.object({
		uploadUrlExpiresAt: z.number(),
		uploadUrl: z.string(),
		image: z.string(), // image URN e.g. "urn:li:image:xxx"
	}),
});

export type LinkedInImageUploadResponse = z.infer<typeof LinkedInImageUploadResponseSchema>;

/** Schema for LinkedIn document upload initialization response */
export const LinkedInDocumentUploadResponseSchema = z.object({
	value: z.object({
		uploadUrlExpiresAt: z.number(),
		uploadUrl: z.string(),
		document: z.string(), // document URN e.g. "urn:li:document:xxx"
	}),
});

export type LinkedInDocumentUploadResponse = z.infer<typeof LinkedInDocumentUploadResponseSchema>;

/** Schema for image/document status check */
export const LinkedInMediaStatusSchema = z.object({
	status: z.string(), // "AVAILABLE", "PROCESSING", etc.
	id: z.string().optional(),
});

export type LinkedInMediaStatus = z.infer<typeof LinkedInMediaStatusSchema>;

/** Schema for LinkedIn post analytics element */
export const LinkedInAnalyticsElementSchema = z.object({
	totalShareStatistics: z.object({
		impressionCount: z.number().default(0),
		uniqueImpressionsCount: z.number().default(0),
		shareCount: z.number().default(0),
		engagement: z.number().default(0),
		clickCount: z.number().default(0),
		likeCount: z.number().default(0),
		commentCount: z.number().default(0),
	}),
	share: z.string().optional(), // post URN
});

export type LinkedInAnalyticsElement = z.infer<typeof LinkedInAnalyticsElementSchema>;

/** Schema for LinkedIn post analytics response */
export const LinkedInPostAnalyticsResponseSchema = z.object({
	elements: z.array(LinkedInAnalyticsElementSchema),
});

export type LinkedInPostAnalyticsResponse = z.infer<typeof LinkedInPostAnalyticsResponseSchema>;

/** Schema for LinkedIn OpenID Connect userinfo response */
export const LinkedInUserInfoSchema = z.object({
	sub: z.string(), // person URN
	name: z.string().optional(),
	given_name: z.string().optional(),
	family_name: z.string().optional(),
	email: z.string().optional(),
	email_verified: z.boolean().optional(),
	picture: z.string().optional(),
});

export type LinkedInUserInfo = z.infer<typeof LinkedInUserInfoSchema>;

/** Schema for a LinkedIn post object from GET /rest/posts */
export const LinkedInPostSchema = z.object({
	author: z.string(),
	commentary: z.string().optional(),
	visibility: z.string(),
	lifecycleState: z.string(),
	id: z.string().optional(),
	content: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.number().optional(),
	lastModifiedAt: z.number().optional(),
});

export type LinkedInPost = z.infer<typeof LinkedInPostSchema>;

/** Schema for LinkedIn posts list response */
export const LinkedInPostsListResponseSchema = z.object({
	elements: z.array(LinkedInPostSchema),
	paging: z
		.object({
			count: z.number(),
			start: z.number(),
			total: z.number().optional(),
		})
		.optional(),
});

export type LinkedInPostsListResponse = z.infer<typeof LinkedInPostsListResponseSchema>;

// ─── Rate Limit Types ───────────────────────────────────────────────────────

export interface LinkedInRateLimitInfo {
	/** Remaining calls allowed in current window */
	remaining: number;
	/** When the rate limit window resets */
	resetAt: Date;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/** Base error for LinkedIn API failures with rate limit awareness */
export class LinkedInApiError extends Error {
	public readonly statusCode: number;
	public readonly rateLimit?: LinkedInRateLimitInfo;

	constructor(statusCode: number, message: string, rateLimit?: LinkedInRateLimitInfo) {
		super(message);
		this.name = "LinkedInApiError";
		this.statusCode = statusCode;
		this.rateLimit = rateLimit;
	}

	/** Returns true if this error is due to rate limiting (HTTP 429) */
	get isRateLimit(): boolean {
		return this.statusCode === 429;
	}
}

/** Specialized error for LinkedIn rate limit responses (HTTP 429) */
export class LinkedInRateLimitError extends LinkedInApiError {
	constructor(rateLimit: LinkedInRateLimitInfo) {
		super(429, `LinkedIn rate limited — resets at ${rateLimit.resetAt.toISOString()}`, rateLimit);
		this.name = "LinkedInRateLimitError";
	}
}
