import type { ZodType } from "zod/v4";
import {
	TIKTOK_BASE_URL,
	TikTokApiError,
	TikTokCommentSchema,
	TikTokPublishSchema,
	TikTokPublishStatusSchema,
	TikTokRateLimitError,
	TikTokUserInfoSchema,
	TikTokVideoListSchema,
	SELF_ONLY,
	MAX_TITLE_LENGTH,
	MAX_DESCRIPTION_LENGTH,
	type TikTokAuditStatus,
	type TikTokCommentResponse,
	type TikTokPrivacyLevel,
	type TikTokPublishResponse,
	type TikTokPublishStatusResponse,
	type TikTokRateLimitInfo,
	type TikTokUserInfoResponse,
	type TikTokVideoListResponse,
} from "./types.ts";

/**
 * Typed TikTok Content Posting API client.
 * Uses raw fetch with Bearer token authentication and Zod response validation.
 * Follows XClient/LinkedInClient pattern.
 *
 * When auditStatus is "unaudited", all privacy levels are forced to SELF_ONLY
 * (draft-only mode — posts visible only to the creator).
 */
export class TikTokClient {
	private accessToken: string;
	private auditStatus: TikTokAuditStatus;
	private rateLimits: Map<string, TikTokRateLimitInfo> = new Map();

	constructor(accessToken: string, options?: { auditStatus?: TikTokAuditStatus }) {
		this.accessToken = accessToken;
		this.auditStatus = options?.auditStatus ?? "unaudited";
	}

	/**
	 * Core request method for TikTok API.
	 * Handles auth, rate limit extraction, error mapping, and Zod validation.
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit,
		schema?: ZodType<T>,
	): Promise<T> {
		const url = `${TIKTOK_BASE_URL}${endpoint}`;
		const headers = new Headers(options.headers);
		headers.set("Authorization", `Bearer ${this.accessToken}`);
		if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
			headers.set("Content-Type", "application/json");
		}

		const response = await fetch(url, { ...options, headers });

		// Extract rate limit info from response headers
		const rateLimit = this.extractRateLimit(endpoint, response.headers);

		if (response.status === 429) {
			throw new TikTokRateLimitError(rateLimit);
		}

		if (!response.ok) {
			const bodyText = await response.text();
			// Try to extract log_id from error response
			let logId: string | undefined;
			try {
				const errorJson = JSON.parse(bodyText) as { error?: { log_id?: string } };
				logId = errorJson.error?.log_id;
			} catch {
				// Not JSON, ignore
			}
			throw new TikTokApiError(response.status, bodyText, rateLimit, logId);
		}

		const json = await response.json();

		// Check for API-level errors in the response body
		const errorObj = (json as Record<string, unknown>).error as
			| { code?: string; message?: string; log_id?: string }
			| undefined;
		if (errorObj?.code && errorObj.code !== "ok") {
			throw new TikTokApiError(
				response.status,
				errorObj.message ?? `TikTok API error: ${errorObj.code}`,
				rateLimit,
				errorObj.log_id,
			);
		}

		return schema ? schema.parse(json) : (json as T);
	}

	/**
	 * Extract rate limit info from TikTok API response headers.
	 */
	private extractRateLimit(endpoint: string, headers: Headers): TikTokRateLimitInfo {
		const remaining = Number.parseInt(headers.get("x-ratelimit-remaining") ?? "100", 10);
		const resetEpoch = Number.parseInt(headers.get("x-ratelimit-reset") ?? "0", 10);
		const resetAt = resetEpoch > 0 ? new Date(resetEpoch * 1000) : new Date(Date.now() + 60_000);

		const info: TikTokRateLimitInfo = { remaining, resetAt };
		this.rateLimits.set(endpoint, info);
		return info;
	}

	/**
	 * Resolve privacy level based on audit status.
	 * Unaudited apps are forced to SELF_ONLY regardless of requested level.
	 */
	private resolvePrivacyLevel(requested?: TikTokPrivacyLevel): TikTokPrivacyLevel {
		if (this.auditStatus === "unaudited") {
			return SELF_ONLY;
		}
		return requested ?? SELF_ONLY;
	}

	// ─── User Info ────────────────────────────────────────────────────────

	/**
	 * Get the authenticated user's basic info.
	 * Fields: open_id, display_name, follower_count, avatar_url
	 */
	async getUserInfo(): Promise<TikTokUserInfoResponse> {
		return this.request(
			"/v2/user/info/?fields=open_id,display_name,follower_count,avatar_url",
			{ method: "GET" },
			TikTokUserInfoSchema,
		);
	}

	// ─── Video List ───────────────────────────────────────────────────────

	/**
	 * Get the authenticated user's video list with metrics.
	 * Supports cursor-based pagination.
	 */
	async getVideoList(
		cursor?: number,
		maxCount = 20,
	): Promise<TikTokVideoListResponse> {
		const body: Record<string, unknown> = { max_count: maxCount };
		if (cursor !== undefined) {
			body.cursor = cursor;
		}

		return this.request(
			"/v2/video/list/?fields=id,title,create_time,like_count,comment_count,share_count,view_count",
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			TikTokVideoListSchema,
		);
	}

	// ─── Video Upload ─────────────────────────────────────────────────────

	/**
	 * Initialize a video upload via inbox (chunked upload).
	 * Returns a publish_id and upload_url for the chunked upload.
	 *
	 * @param videoSize - Total video file size in bytes
	 * @param chunkSize - Size of each chunk in bytes (5MB-64MB)
	 */
	async initVideoUpload(
		videoSize: number,
		chunkSize: number,
	): Promise<{ publishId: string; uploadUrl: string }> {
		const body = {
			post_info: {
				title: "",
				privacy_level: this.resolvePrivacyLevel(),
				disable_duet: false,
				disable_comment: false,
				disable_stitch: false,
			},
			source_info: {
				source: "FILE_UPLOAD",
				video_size: videoSize,
				chunk_size: chunkSize,
				total_chunk_count: Math.ceil(videoSize / chunkSize),
			},
		};

		const result = await this.request<TikTokPublishResponse>(
			"/v2/post/publish/inbox/video/init/",
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			TikTokPublishSchema,
		);

		return {
			publishId: result.data.publish_id,
			uploadUrl: result.data.upload_url ?? "",
		};
	}

	// ─── Photo Posting ────────────────────────────────────────────────────

	/**
	 * Post photos via URL pull (PULL_FROM_URL source).
	 * Photos are fetched by TikTok from the provided URLs.
	 *
	 * @param params.title - Post title (max 90 chars, auto-clamped)
	 * @param params.description - Post description (max 4000 chars, auto-clamped)
	 * @param params.photoUrls - Array of photo URLs (max 35)
	 * @param params.privacyLevel - Privacy level (forced to SELF_ONLY if unaudited)
	 */
	async postPhotos(params: {
		title: string;
		description: string;
		photoUrls: string[];
		privacyLevel?: TikTokPrivacyLevel;
	}): Promise<TikTokPublishResponse> {
		const title = params.title.slice(0, MAX_TITLE_LENGTH);
		const description = params.description.slice(0, MAX_DESCRIPTION_LENGTH);
		const privacyLevel = this.resolvePrivacyLevel(params.privacyLevel);

		const body = {
			post_info: {
				title,
				description,
				privacy_level: privacyLevel,
				disable_comment: false,
			},
			source_info: {
				source: "PULL_FROM_URL",
				photo_images: params.photoUrls,
			},
			post_mode: "DIRECT_POST",
			media_type: "PHOTO",
		};

		return this.request<TikTokPublishResponse>(
			"/v2/post/publish/content/init/",
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			TikTokPublishSchema,
		);
	}

	// ─── Comments ─────────────────────────────────────────────────────────

	/**
	 * Post a comment on a video for engagement replies.
	 */
	async postComment(videoId: string, text: string): Promise<TikTokCommentResponse> {
		const body = {
			video_id: videoId,
			text,
		};

		return this.request<TikTokCommentResponse>(
			"/v2/comment/",
			{
				method: "POST",
				body: JSON.stringify(body),
			},
			TikTokCommentSchema,
		);
	}

	// ─── Publish Status ───────────────────────────────────────────────────

	/**
	 * Check the publish status of an upload.
	 * Used to poll for upload completion.
	 */
	async getPublishStatus(publishId: string): Promise<TikTokPublishStatusResponse> {
		return this.request<TikTokPublishStatusResponse>(
			"/v2/post/publish/status/fetch/",
			{
				method: "POST",
				body: JSON.stringify({ publish_id: publishId }),
			},
			TikTokPublishStatusSchema,
		);
	}

	// ─── Rate Limit Info ──────────────────────────────────────────────────

	/**
	 * Get current rate limit info for a given endpoint.
	 */
	getRateLimit(endpoint: string): TikTokRateLimitInfo | undefined {
		return this.rateLimits.get(endpoint);
	}

	/**
	 * Check if an endpoint is currently rate limited.
	 */
	isRateLimited(endpoint: string): boolean {
		const info = this.rateLimits.get(endpoint);
		if (!info) return false;
		return info.remaining === 0 && info.resetAt > new Date();
	}

	/**
	 * Get the current audit status.
	 */
	getAuditStatus(): TikTokAuditStatus {
		return this.auditStatus;
	}
}
