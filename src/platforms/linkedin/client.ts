import type { ZodType } from "zod/v4";
import {
	LinkedInApiError,
	type LinkedInPostAnalyticsResponse,
	LinkedInPostAnalyticsResponseSchema,
	type LinkedInPostsListResponse,
	LinkedInPostsListResponseSchema,
	LinkedInRateLimitError,
	type LinkedInRateLimitInfo,
	type LinkedInUserInfo,
	LinkedInUserInfoSchema,
} from "./types.ts";

const REST_BASE_URL = "https://api.linkedin.com/rest";
const V2_BASE_URL = "https://api.linkedin.com/v2";

/**
 * Typed LinkedIn REST API client with versioned headers and rate limit tracking.
 * Uses raw fetch (no third-party SDK) mirroring XClient pattern.
 *
 * All /rest/* endpoints require:
 *   - LinkedIn-Version: YYYYMM
 *   - X-Restli-Protocol-Version: 2.0.0
 */
export class LinkedInClient {
	private accessToken: string;
	private version: string;
	private rateLimits: Map<string, LinkedInRateLimitInfo> = new Map();

	constructor(accessToken: string, version = "202602") {
		this.accessToken = accessToken;
		this.version = version;
	}

	/**
	 * Core request method for /rest/* endpoints.
	 * Handles auth, versioned headers, rate limit extraction, error mapping, and Zod validation.
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit,
		schema?: ZodType<T>,
	): Promise<{ data: T; rateLimit: LinkedInRateLimitInfo; headers: Headers }> {
		const url = `${REST_BASE_URL}${endpoint}`;
		const headers = new Headers(options.headers);
		headers.set("Authorization", `Bearer ${this.accessToken}`);
		headers.set("LinkedIn-Version", this.version);
		headers.set("X-Restli-Protocol-Version", "2.0.0");
		if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
			headers.set("Content-Type", "application/json");
		}

		const response = await fetch(url, { ...options, headers });

		// Extract rate limit info from response headers
		const rateLimit = this.extractRateLimit(endpoint, response.headers);

		if (response.status === 429) {
			throw new LinkedInRateLimitError(rateLimit);
		}

		if (!response.ok) {
			const bodyText = await response.text();
			throw new LinkedInApiError(response.status, bodyText, rateLimit);
		}

		// Some LinkedIn endpoints return empty body (201 Created)
		let data: T;
		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			const json: unknown = await response.json();
			// Intentional cast: callers without a schema accept responsibility for type safety
			data = schema ? schema.parse(json) : (json as T);
		} else {
			// Intentional cast: empty body for non-JSON responses (e.g. 201 Created)
			data = {} as T;
		}

		return { data, rateLimit, headers: response.headers };
	}

	/**
	 * Request method for /v2/* endpoints (OpenID Connect, etc.)
	 */
	private async requestV2<T>(
		endpoint: string,
		options: RequestInit,
		schema?: ZodType<T>,
	): Promise<T> {
		const url = `${V2_BASE_URL}${endpoint}`;
		const headers = new Headers(options.headers);
		headers.set("Authorization", `Bearer ${this.accessToken}`);

		const response = await fetch(url, { ...options, headers });

		if (!response.ok) {
			const bodyText = await response.text();
			throw new LinkedInApiError(response.status, bodyText);
		}

		const json: unknown = await response.json();
		// Intentional cast: callers without a schema accept responsibility for type safety
		return schema ? schema.parse(json) : (json as T);
	}

	/**
	 * Extract rate limit info from LinkedIn API response headers.
	 */
	private extractRateLimit(endpoint: string, headers: Headers): LinkedInRateLimitInfo {
		// LinkedIn uses x-li-throttle-count and other headers
		const remaining = Number.parseInt(headers.get("x-li-throttle-count") ?? "100", 10);
		const resetEpoch = Number.parseInt(headers.get("x-li-throttle-reset") ?? "0", 10);
		const resetAt = resetEpoch > 0 ? new Date(resetEpoch * 1000) : new Date(Date.now() + 60_000);

		const info: LinkedInRateLimitInfo = { remaining, resetAt };
		this.rateLimits.set(endpoint, info);
		return info;
	}

	/**
	 * URL-encode a LinkedIn URN for use in query parameters.
	 * e.g. "urn:li:person:abc123" -> "urn%3Ali%3Aperson%3Aabc123"
	 */
	static encodeUrn(urn: string): string {
		return encodeURIComponent(urn);
	}

	// ─── Post Creation Methods ─────────────────────────────────────────────

	/**
	 * Create a text-only post.
	 * Returns the post URN from the x-restli-id response header.
	 */
	async createTextPost(
		author: string,
		commentary: string,
		visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC",
	): Promise<string> {
		const body = {
			author,
			commentary,
			visibility,
			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: [],
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false,
		};

		const { headers } = await this.request("/posts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return headers.get("x-restli-id") ?? "";
	}

	/**
	 * Create a post with an image.
	 * Image must be uploaded first via initializeImageUpload + uploadImageBinary.
	 */
	async createImagePost(
		author: string,
		commentary: string,
		imageUrn: string,
		altText?: string,
		visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC",
	): Promise<string> {
		const body = {
			author,
			commentary,
			visibility,
			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: [],
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false,
			content: {
				media: {
					id: imageUrn,
					...(altText ? { altText } : {}),
				},
			},
		};

		const { headers } = await this.request("/posts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return headers.get("x-restli-id") ?? "";
	}

	/**
	 * Create a post with a document (used for organic carousels).
	 * Document (PDF) must be uploaded first via initializeDocumentUpload + uploadDocumentBinary.
	 */
	async createDocumentPost(
		author: string,
		commentary: string,
		documentUrn: string,
		title?: string,
		visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC",
	): Promise<string> {
		const body = {
			author,
			commentary,
			visibility,
			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: [],
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false,
			content: {
				media: {
					id: documentUrn,
					...(title ? { title } : {}),
				},
			},
		};

		const { headers } = await this.request("/posts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return headers.get("x-restli-id") ?? "";
	}

	/**
	 * Create a post with multiple images (max 20).
	 */
	async createMultiImagePost(
		author: string,
		commentary: string,
		imageUrns: string[],
		visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC",
	): Promise<string> {
		const body = {
			author,
			commentary,
			visibility,
			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: [],
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false,
			content: {
				multiImage: {
					images: imageUrns.map((urn) => ({ id: urn })),
				},
			},
		};

		const { headers } = await this.request("/posts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return headers.get("x-restli-id") ?? "";
	}

	/**
	 * Create a post with an article link.
	 */
	async createArticlePost(
		author: string,
		commentary: string,
		articleUrl: string,
		title: string,
		description: string,
		thumbnailUrn?: string,
		visibility: "PUBLIC" | "CONNECTIONS" = "PUBLIC",
	): Promise<string> {
		const body = {
			author,
			commentary,
			visibility,
			distribution: {
				feedDistribution: "MAIN_FEED",
				targetEntities: [],
				thirdPartyDistributionChannels: [],
			},
			lifecycleState: "PUBLISHED",
			isReshareDisabledByAuthor: false,
			content: {
				article: {
					source: articleUrl,
					title,
					description,
					...(thumbnailUrn ? { thumbnail: thumbnailUrn } : {}),
				},
			},
		};

		const { headers } = await this.request("/posts", {
			method: "POST",
			body: JSON.stringify(body),
		});

		return headers.get("x-restli-id") ?? "";
	}

	// ─── Post Read/Delete Methods ──────────────────────────────────────────

	/**
	 * Get a post by its URN.
	 */
	async getPost(postUrn: string): Promise<Record<string, unknown>> {
		const { data } = await this.request<Record<string, unknown>>(
			`/posts/${LinkedInClient.encodeUrn(postUrn)}`,
			{ method: "GET" },
		);
		return data;
	}

	/**
	 * Get posts by author URN.
	 */
	async getPostsByAuthor(
		authorUrn: string,
		count = 20,
		sortBy: "LAST_MODIFIED" | "CREATED" = "LAST_MODIFIED",
	): Promise<LinkedInPostsListResponse> {
		const params = new URLSearchParams({
			author: authorUrn,
			q: "author",
			count: String(count),
			sortBy,
		});

		const { data } = await this.request(
			`/posts?${params.toString()}`,
			{ method: "GET" },
			LinkedInPostsListResponseSchema,
		);

		return data;
	}

	/**
	 * Delete a post by URN.
	 */
	async deletePost(postUrn: string): Promise<void> {
		await this.request(`/posts/${LinkedInClient.encodeUrn(postUrn)}`, {
			method: "DELETE",
		});
	}

	// ─── Analytics Methods ─────────────────────────────────────────────────

	/**
	 * Get analytics for a specific post.
	 * Uses the memberCreatorPostAnalytics entity finder.
	 */
	async getPostAnalytics(postUrn: string): Promise<LinkedInPostAnalyticsResponse> {
		const params = new URLSearchParams({
			q: "analytics",
			"posts[0]": postUrn,
		});

		const { data } = await this.request(
			`/memberCreatorPostAnalytics?${params.toString()}`,
			{ method: "GET" },
			LinkedInPostAnalyticsResponseSchema,
		);

		return data;
	}

	/**
	 * Get aggregated analytics for all of the authenticated user's posts.
	 */
	async getAggregatedAnalytics(dateRange?: {
		start: string;
		end: string;
	}): Promise<LinkedInPostAnalyticsResponse> {
		const params = new URLSearchParams({
			q: "analytics",
		});

		if (dateRange) {
			params.set("dateRange.start.day", dateRange.start.split("-")[2] ?? "1");
			params.set("dateRange.start.month", dateRange.start.split("-")[1] ?? "1");
			params.set("dateRange.start.year", dateRange.start.split("-")[0] ?? "2026");
			params.set("dateRange.end.day", dateRange.end.split("-")[2] ?? "1");
			params.set("dateRange.end.month", dateRange.end.split("-")[1] ?? "1");
			params.set("dateRange.end.year", dateRange.end.split("-")[0] ?? "2026");
		}

		const { data } = await this.request(
			`/memberCreatorPostAnalytics?${params.toString()}`,
			{ method: "GET" },
			LinkedInPostAnalyticsResponseSchema,
		);

		return data;
	}

	// ─── User Info ─────────────────────────────────────────────────────────

	/**
	 * Get the authenticated user's info via OpenID Connect userinfo endpoint.
	 * Returns person URN (sub), name, email, picture.
	 */
	async getUserInfo(): Promise<LinkedInUserInfo> {
		return this.requestV2("/userinfo", { method: "GET" }, LinkedInUserInfoSchema);
	}

	// ─── Rate Limit Info ───────────────────────────────────────────────────

	/**
	 * Get current rate limit info for a given endpoint.
	 */
	getRateLimit(endpoint: string): LinkedInRateLimitInfo | undefined {
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
}
