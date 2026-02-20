import type { ZodType } from "zod/v4";
import {
	GRAPH_BASE_URL,
	InstagramApiError,
	type InstagramComment,
	InstagramCommentSchema,
	type InstagramHashtagSearch,
	InstagramHashtagSearchSchema,
	type InstagramInsights,
	InstagramInsightsSchema,
	type InstagramMediaList,
	InstagramMediaListSchema,
	type InstagramProfile,
	InstagramProfileSchema,
	InstagramRateLimitError,
	type InstagramRateLimitInfo,
	MAX_REQUESTS_PER_HOUR,
} from "./types.ts";

/**
 * Typed Instagram Graph API client with container workflow and rate limit tracking.
 * Uses raw fetch (no third-party SDK) mirroring XClient/LinkedInClient pattern.
 *
 * Instagram Platform API endpoints use:
 *   - Base: https://graph.instagram.com
 *   - Auth: access_token as query parameter
 */
export class InstagramClient {
	private accessToken: string;
	private accountId: string;
	private requestCount = 0;
	private windowStart = Date.now();

	constructor(accessToken: string, accountId: string) {
		this.accessToken = accessToken;
		this.accountId = accountId;
	}

	/**
	 * Core request method for Instagram Graph API endpoints.
	 * Handles auth, rate limit tracking, error mapping, and Zod validation.
	 */
	async request<T>(endpoint: string, options: RequestInit = {}, schema?: ZodType<T>): Promise<T> {
		// Track rate limiting (200 requests per hour)
		this.trackRequest();

		const url = endpoint.startsWith("http") ? endpoint : `${GRAPH_BASE_URL}${endpoint}`;

		// Add access_token to URL params
		const urlObj = new URL(url);
		urlObj.searchParams.set("access_token", this.accessToken);

		const response = await fetch(urlObj.toString(), options);

		if (response.status === 429) {
			const resetAt = new Date(Date.now() + 60_000);
			throw new InstagramRateLimitError({ remaining: 0, resetAt });
		}

		if (!response.ok) {
			const bodyText = await response.text();
			throw new InstagramApiError(response.status, bodyText);
		}

		const json = await response.json();
		return schema ? schema.parse(json) : (json as T);
	}

	/**
	 * POST request helper for container creation and publishing.
	 */
	async post<T>(endpoint: string, params: Record<string, string>, schema?: ZodType<T>): Promise<T> {
		const url = `${GRAPH_BASE_URL}${endpoint}`;
		const urlObj = new URL(url);
		urlObj.searchParams.set("access_token", this.accessToken);
		for (const [key, value] of Object.entries(params)) {
			urlObj.searchParams.set(key, value);
		}

		this.trackRequest();

		const response = await fetch(urlObj.toString(), { method: "POST" });

		if (response.status === 429) {
			const resetAt = new Date(Date.now() + 60_000);
			throw new InstagramRateLimitError({ remaining: 0, resetAt });
		}

		if (!response.ok) {
			const bodyText = await response.text();
			throw new InstagramApiError(response.status, bodyText);
		}

		const json = await response.json();
		return schema ? schema.parse(json) : (json as T);
	}

	/**
	 * Track requests per hour window for rate limit awareness.
	 * Instagram allows minimum 200 requests per hour.
	 */
	private trackRequest(): void {
		const now = Date.now();
		const hourMs = 60 * 60 * 1000;

		// Reset counter if we're in a new window
		if (now - this.windowStart > hourMs) {
			this.requestCount = 0;
			this.windowStart = now;
		}

		this.requestCount++;

		if (this.requestCount >= MAX_REQUESTS_PER_HOUR) {
			const resetAt = new Date(this.windowStart + hourMs);
			throw new InstagramRateLimitError({
				remaining: 0,
				resetAt,
			});
		}
	}

	// ─── Profile Methods ──────────────────────────────────────────────────

	/**
	 * Get the authenticated user's profile info.
	 * GET /{accountId}?fields=id,username,followers_count,media_count
	 */
	async getMe(): Promise<InstagramProfile> {
		return this.request(
			`/${this.accountId}?fields=id,username,followers_count,media_count`,
			{ method: "GET" },
			InstagramProfileSchema,
		);
	}

	// ─── Media Methods ────────────────────────────────────────────────────

	/**
	 * Get insights for a specific media post.
	 * GET /{mediaId}/insights?metric=impressions,reach,likes,comments,shares,saved
	 * Returns a flat Record<string, number> of metric name -> value.
	 */
	async getMediaInsights(mediaId: string): Promise<Record<string, number>> {
		const metrics = "impressions,reach,likes,comments,shares,saved";
		const data = await this.request(
			`/${mediaId}/insights?metric=${metrics}`,
			{ method: "GET" },
			InstagramInsightsSchema,
		);

		// Flatten insights into a simple record
		const result: Record<string, number> = {};
		for (const insight of data.data) {
			const value = insight.values[0]?.value;
			if (typeof value === "number") {
				result[insight.name] = value;
			}
		}
		return result;
	}

	/**
	 * Get account-level insights.
	 * GET /{accountId}/insights?metric={metrics}&period={period}
	 */
	async getAccountInsights(
		period: "day" | "week" | "days_28",
		metrics: string[],
	): Promise<InstagramInsights> {
		return this.request(
			`/${this.accountId}/insights?metric=${metrics.join(",")}&period=${period}`,
			{ method: "GET" },
			InstagramInsightsSchema,
		);
	}

	/**
	 * Get recent media for the authenticated user.
	 * GET /{accountId}/media?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count
	 */
	async getRecentMedia(limit = 25): Promise<InstagramMediaList> {
		const fields = "id,caption,media_type,timestamp,permalink,like_count,comments_count";
		return this.request(
			`/${this.accountId}/media?fields=${fields}&limit=${limit}`,
			{ method: "GET" },
			InstagramMediaListSchema,
		);
	}

	// ─── Hashtag Methods ──────────────────────────────────────────────────

	/**
	 * Search for hashtag IDs by keyword.
	 * GET /ig_hashtag_search?q={query}&user_id={accountId}
	 * Budget: 30 searches per 7-day rolling window.
	 */
	async searchHashtags(query: string): Promise<InstagramHashtagSearch> {
		return this.request(
			`/ig_hashtag_search?q=${encodeURIComponent(query)}&user_id=${this.accountId}`,
			{ method: "GET" },
			InstagramHashtagSearchSchema,
		);
	}

	/**
	 * Get recent media for a hashtag.
	 * GET /{hashtagId}/recent_media?user_id={accountId}&fields=...
	 */
	async getHashtagRecentMedia(hashtagId: string): Promise<InstagramMediaList> {
		const fields = "id,caption,like_count,comments_count,timestamp,permalink";
		return this.request(
			`/${hashtagId}/recent_media?user_id=${this.accountId}&fields=${fields}`,
			{ method: "GET" },
			InstagramMediaListSchema,
		);
	}

	// ─── Engagement Methods ───────────────────────────────────────────────

	/**
	 * Post a comment on a media post.
	 * POST /{mediaId}/comments?message={message}
	 */
	async postComment(mediaId: string, message: string): Promise<InstagramComment> {
		return this.post(`/${mediaId}/comments`, { message }, InstagramCommentSchema);
	}

	// ─── Rate Limit Info ──────────────────────────────────────────────────

	/**
	 * Get current rate limit info.
	 */
	getRateLimit(): InstagramRateLimitInfo {
		const hourMs = 60 * 60 * 1000;
		const remaining = Math.max(0, MAX_REQUESTS_PER_HOUR - this.requestCount);
		const resetAt = new Date(this.windowStart + hourMs);
		return { remaining, resetAt };
	}

	/**
	 * Check if currently rate limited.
	 */
	isRateLimited(): boolean {
		return this.requestCount >= MAX_REQUESTS_PER_HOUR;
	}

	/**
	 * Get the account ID for this client.
	 */
	getAccountId(): string {
		return this.accountId;
	}
}
