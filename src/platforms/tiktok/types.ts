import { z } from "zod/v4";

// ─── TikTok API Base URL ────────────────────────────────────────────────────

export const TIKTOK_BASE_URL = "https://open.tiktokapis.com";

// ─── Audit Status ───────────────────────────────────────────────────────────

/**
 * TikTok app audit status.
 * - "unaudited": App not yet approved — all posts default to SELF_ONLY (draft-only mode)
 * - "audited": App approved by TikTok — full privacy level options available
 */
export type TikTokAuditStatus = "unaudited" | "audited";

// ─── Privacy Level Constants ────────────────────────────────────────────────

/** Only visible to the creator (default for unaudited apps) */
export const SELF_ONLY = "SELF_ONLY";
/** Visible to everyone */
export const PUBLIC_TO_EVERYONE = "PUBLIC_TO_EVERYONE";
/** Visible to mutual follow friends */
export const MUTUAL_FOLLOW_FRIENDS = "MUTUAL_FOLLOW_FRIENDS";
/** Visible to followers of the creator */
export const FOLLOWER_OF_CREATOR = "FOLLOWER_OF_CREATOR";

export type TikTokPrivacyLevel =
	| typeof SELF_ONLY
	| typeof PUBLIC_TO_EVERYONE
	| typeof MUTUAL_FOLLOW_FRIENDS
	| typeof FOLLOWER_OF_CREATOR;

// ─── Content Limits ─────────────────────────────────────────────────────────

export const MAX_TITLE_LENGTH = 90;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_PHOTOS_PER_POST = 35;
export const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_CHUNK_SIZE = 64 * 1024 * 1024; // 64MB

// ─── OAuth Config ───────────────────────────────────────────────────────────

export interface TikTokOAuthConfig {
	clientKey: string;
	clientSecret: string;
	callbackUrl: string;
}

// ─── Zod Schemas for TikTok API ─────────────────────────────────────────────

/** Schema for publish response (video init, photo post) */
export const TikTokPublishSchema = z.object({
	data: z.object({
		publish_id: z.string(),
		upload_url: z.string().optional(),
	}),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			log_id: z.string().optional(),
		})
		.optional(),
});

export type TikTokPublishResponse = z.infer<typeof TikTokPublishSchema>;

/** Schema for publish status response */
export const TikTokPublishStatusSchema = z.object({
	data: z.object({
		status: z.string(), // "PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD", "SEND_TO_USER_INBOX", "PUBLISH_COMPLETE", "FAILED"
		public_post_id: z.string().optional(),
		uploaded_bytes: z.number().optional(),
		fail_reason: z.string().optional(),
	}),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			log_id: z.string().optional(),
		})
		.optional(),
});

export type TikTokPublishStatusResponse = z.infer<typeof TikTokPublishStatusSchema>;

/** Schema for a single video in the video list */
export const TikTokVideoSchema = z.object({
	id: z.string(),
	title: z.string().optional(),
	create_time: z.number(),
	like_count: z.number().default(0),
	comment_count: z.number().default(0),
	share_count: z.number().default(0),
	view_count: z.number().default(0),
});

export type TikTokVideo = z.infer<typeof TikTokVideoSchema>;

/** Schema for video list response */
export const TikTokVideoListSchema = z.object({
	data: z.object({
		videos: z.array(TikTokVideoSchema),
		cursor: z.number().optional(),
		has_more: z.boolean().default(false),
	}),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			log_id: z.string().optional(),
		})
		.optional(),
});

export type TikTokVideoListResponse = z.infer<typeof TikTokVideoListSchema>;

/** Schema for user info response */
export const TikTokUserInfoSchema = z.object({
	data: z.object({
		user: z.object({
			open_id: z.string(),
			display_name: z.string().optional(),
			avatar_url: z.string().optional(),
			follower_count: z.number().optional(),
		}),
	}),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			log_id: z.string().optional(),
		})
		.optional(),
});

export type TikTokUserInfoResponse = z.infer<typeof TikTokUserInfoSchema>;

/** Schema for comment response */
export const TikTokCommentSchema = z.object({
	data: z.object({
		comment_id: z.string().optional(),
	}),
	error: z
		.object({
			code: z.string(),
			message: z.string(),
			log_id: z.string().optional(),
		})
		.optional(),
});

export type TikTokCommentResponse = z.infer<typeof TikTokCommentSchema>;

// ─── Rate Limit Types ───────────────────────────────────────────────────────

export interface TikTokRateLimitInfo {
	/** Remaining calls allowed in current window */
	remaining: number;
	/** When the rate limit window resets */
	resetAt: Date;
}

// ─── Error Classes ──────────────────────────────────────────────────────────

/** Base error for TikTok API failures with rate limit awareness */
export class TikTokApiError extends Error {
	public readonly statusCode: number;
	public readonly rateLimit?: TikTokRateLimitInfo;
	public readonly logId?: string;

	constructor(statusCode: number, message: string, rateLimit?: TikTokRateLimitInfo, logId?: string) {
		super(message);
		this.name = "TikTokApiError";
		this.statusCode = statusCode;
		this.rateLimit = rateLimit;
		this.logId = logId;
	}

	/** Returns true if this error is due to rate limiting (HTTP 429) */
	get isRateLimit(): boolean {
		return this.statusCode === 429;
	}
}

/** Specialized error for TikTok rate limit responses (HTTP 429) */
export class TikTokRateLimitError extends TikTokApiError {
	constructor(rateLimit: TikTokRateLimitInfo) {
		super(429, `TikTok rate limited — resets at ${rateLimit.resetAt.toISOString()}`, rateLimit);
		this.name = "TikTokRateLimitError";
	}
}

/** Error for expired upload URLs (403/410) during chunked upload */
export class TikTokUploadExpiredError extends TikTokApiError {
	constructor() {
		super(410, "Upload URL expired — re-initialize video upload to get a new URL");
		this.name = "TikTokUploadExpiredError";
	}
}
