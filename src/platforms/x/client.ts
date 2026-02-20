import type { ZodType } from "zod/v4";
import {
	RateLimitError,
	type RateLimitInfo,
	type TimelineResponse,
	TimelineResponseSchema,
	TweetResponseSchema,
	type TweetsLookupResponse,
	TweetsLookupResponseSchema,
	type UserLookupResponse,
	UserLookupResponseSchema,
	XApiError,
} from "./types.ts";

const BASE_URL = "https://api.x.com";

/**
 * Typed X API client with rate limit tracking from response headers.
 * Uses raw fetch (no third-party SDK) per research recommendation.
 */
export class XClient {
	private accessToken: string;
	private rateLimits: Map<string, RateLimitInfo> = new Map();

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	/**
	 * Core request method — handles auth, rate limit extraction, error mapping, and Zod validation.
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit,
		schema?: ZodType<T>,
	): Promise<{ data: T; rateLimit: RateLimitInfo }> {
		const url = `${BASE_URL}${endpoint}`;
		const headers = new Headers(options.headers);
		headers.set("Authorization", `Bearer ${this.accessToken}`);
		if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
			headers.set("Content-Type", "application/json");
		}

		const response = await fetch(url, { ...options, headers });

		// Extract rate limit info from response headers
		const rateLimit = this.extractRateLimit(endpoint, response.headers);

		if (response.status === 429) {
			throw new RateLimitError(rateLimit);
		}

		if (!response.ok) {
			const bodyText = await response.text();
			throw new XApiError(response.status, bodyText, rateLimit);
		}

		const json: unknown = await response.json();
		// Intentional cast: callers without a schema accept responsibility for type safety
		const data = schema ? schema.parse(json) : (json as T);

		return { data, rateLimit };
	}

	/**
	 * Extract rate limit info from X API response headers.
	 */
	private extractRateLimit(endpoint: string, headers: Headers): RateLimitInfo {
		const limit = Number.parseInt(headers.get("x-rate-limit-limit") ?? "0", 10);
		const remaining = Number.parseInt(headers.get("x-rate-limit-remaining") ?? "0", 10);
		const resetEpoch = Number.parseInt(headers.get("x-rate-limit-reset") ?? "0", 10);
		const resetAt = new Date(resetEpoch * 1000);

		const info: RateLimitInfo = { limit, remaining, resetAt };
		this.rateLimits.set(endpoint, info);
		return info;
	}

	/**
	 * Create a single tweet, optionally as a reply or with media attachments.
	 */
	async createTweet(params: {
		text: string;
		replyToId?: string;
		mediaIds?: string[];
	}): Promise<{ id: string; text: string; rateLimit: RateLimitInfo }> {
		const body: Record<string, unknown> = { text: params.text };

		if (params.replyToId) {
			body.reply = { in_reply_to_tweet_id: params.replyToId };
		}
		if (params.mediaIds && params.mediaIds.length > 0) {
			body.media = { media_ids: params.mediaIds };
		}

		const { data, rateLimit } = await this.request(
			"/2/tweets",
			{ method: "POST", body: JSON.stringify(body) },
			TweetResponseSchema,
		);

		return { id: data.data.id, text: data.data.text, rateLimit };
	}

	/**
	 * Post a thread of tweets sequentially.
	 * Each tweet after the first is posted as a reply to the previous one.
	 * Sequential posting is required — each tweet needs the previous tweet's ID.
	 */
	async postThread(
		tweets: string[],
		mediaIdsPerTweet?: (string[] | undefined)[],
	): Promise<{ tweetIds: string[]; rateLimits: RateLimitInfo[] }> {
		const tweetIds: string[] = [];
		const rateLimits: RateLimitInfo[] = [];

		for (let i = 0; i < tweets.length; i++) {
			const tweetText = tweets[i]!;
			const result = await this.createTweet({
				text: tweetText,
				replyToId: i > 0 ? tweetIds[i - 1] : undefined,
				mediaIds: mediaIdsPerTweet?.[i],
			});

			tweetIds.push(result.id);
			rateLimits.push(result.rateLimit);
		}

		return { tweetIds, rateLimits };
	}

	/**
	 * Batch-fetch tweets by ID with optional field expansion.
	 * Chunks into batches of 100 (X API limit) and aggregates results.
	 */
	async getTweets(
		ids: string[],
		fields?: { tweetFields?: string[] },
	): Promise<{ data: TweetsLookupResponse; rateLimit: RateLimitInfo }> {
		if (ids.length === 0) {
			return {
				data: { data: [] },
				rateLimit: { limit: 0, remaining: 0, resetAt: new Date() },
			};
		}

		const allTweets: TweetsLookupResponse["data"] = [];
		let lastRateLimit: RateLimitInfo = { limit: 0, remaining: 0, resetAt: new Date() };

		// Chunk IDs into batches of 100
		const chunkSize = 100;
		for (let i = 0; i < ids.length; i += chunkSize) {
			const chunk = ids.slice(i, i + chunkSize);
			const params = new URLSearchParams();
			params.set("ids", chunk.join(","));
			if (fields?.tweetFields) {
				params.set("tweet.fields", fields.tweetFields.join(","));
			}

			const { data, rateLimit } = await this.request(
				`/2/tweets?${params.toString()}`,
				{ method: "GET" },
				TweetsLookupResponseSchema,
			);

			allTweets.push(...data.data);
			lastRateLimit = rateLimit;
		}

		return { data: { data: allTweets }, rateLimit: lastRateLimit };
	}

	/**
	 * Get the authenticated user's profile with optional field expansion.
	 */
	async getMe(fields?: {
		userFields?: string[];
	}): Promise<{ data: UserLookupResponse; rateLimit: RateLimitInfo }> {
		const params = new URLSearchParams();
		if (fields?.userFields) {
			params.set("user.fields", fields.userFields.join(","));
		}

		const queryString = params.toString();
		const endpoint = queryString ? `/2/users/me?${queryString}` : "/2/users/me";

		return this.request(endpoint, { method: "GET" }, UserLookupResponseSchema);
	}

	/**
	 * Get the authenticated user's recent tweets (reverse chronological timeline).
	 * Used by intelligence layer to detect trending topics in user's network.
	 */
	async getTimeline(params?: { maxResults?: number; tweetFields?: string[] }): Promise<{
		data: Array<{
			id: string;
			text: string;
			createdAt?: string;
			publicMetrics?: {
				likeCount: number;
				retweetCount: number;
				replyCount: number;
				impressionCount: number;
			};
		}>;
		rateLimit: RateLimitInfo;
	}> {
		// First get the user's ID
		const { data: user } = await this.getMe();
		const userId = user.data.id;

		const queryParams = new URLSearchParams();
		queryParams.set("max_results", String(params?.maxResults ?? 50));
		if (params?.tweetFields) {
			queryParams.set("tweet.fields", params.tweetFields.join(","));
		}

		const { data, rateLimit } = await this.request<TimelineResponse>(
			`/2/users/${userId}/tweets?${queryParams.toString()}`,
			{ method: "GET" },
			TimelineResponseSchema,
		);

		return {
			data: (data.data ?? []).map((tweet) => ({
				id: tweet.id,
				text: tweet.text,
				createdAt: tweet.created_at,
				publicMetrics: tweet.public_metrics
					? {
							likeCount: tweet.public_metrics.like_count,
							retweetCount: tweet.public_metrics.retweet_count,
							replyCount: tweet.public_metrics.reply_count,
							impressionCount: tweet.public_metrics.impression_count,
						}
					: undefined,
			})),
			rateLimit,
		};
	}

	/**
	 * Look up a user by username.
	 * Used by competitive intelligence to find monitored accounts.
	 */
	async getUserByUsername(
		username: string,
		fields?: { tweetFields?: string[] },
	): Promise<{
		data: { id: string; name: string; username: string };
		rateLimit: RateLimitInfo;
	}> {
		const params = new URLSearchParams();
		if (fields?.tweetFields) {
			params.set("tweet.fields", fields.tweetFields.join(","));
		}
		const queryString = params.toString();
		const endpoint = queryString
			? `/2/users/by/username/${username}?${queryString}`
			: `/2/users/by/username/${username}`;

		const { data, rateLimit } = await this.request<{
			data: { id: string; name: string; username: string };
		}>(endpoint, { method: "GET" });

		return { data: data.data, rateLimit };
	}

	/**
	 * Get recent tweets by a specific user ID.
	 * Used by competitive intelligence to monitor competitor accounts.
	 */
	async getUserTweets(
		userId: string,
		params?: { maxResults?: number; tweetFields?: string[] },
	): Promise<{
		data: Array<{
			id: string;
			text: string;
			createdAt?: string;
			publicMetrics?: {
				likeCount: number;
				retweetCount: number;
				replyCount: number;
				impressionCount: number;
			};
		}>;
		rateLimit: RateLimitInfo;
	}> {
		const queryParams = new URLSearchParams();
		queryParams.set("max_results", String(params?.maxResults ?? 10));
		if (params?.tweetFields) {
			queryParams.set("tweet.fields", params.tweetFields.join(","));
		}

		const { data, rateLimit } = await this.request<TimelineResponse>(
			`/2/users/${userId}/tweets?${queryParams.toString()}`,
			{ method: "GET" },
			TimelineResponseSchema,
		);

		return {
			data: (data.data ?? []).map((tweet) => ({
				id: tweet.id,
				text: tweet.text,
				createdAt: tweet.created_at,
				publicMetrics: tweet.public_metrics
					? {
							likeCount: tweet.public_metrics.like_count,
							retweetCount: tweet.public_metrics.retweet_count,
							replyCount: tweet.public_metrics.reply_count,
							impressionCount: tweet.public_metrics.impression_count,
						}
					: undefined,
			})),
			rateLimit,
		};
	}

	/**
	 * Search recent tweets by query (X API v2 /2/tweets/search/recent).
	 * Used by engagement monitor to discover trending content matching niche keywords.
	 * Basic tier: 10 req/month, pay-per-use unlocks more.
	 */
	async searchRecent(
		query: string,
		params?: { maxResults?: number; tweetFields?: string[]; userFields?: string[] },
	): Promise<{
		data: Array<{
			id: string;
			text: string;
			createdAt?: string;
			authorId?: string;
			publicMetrics?: {
				likeCount: number;
				retweetCount: number;
				replyCount: number;
				impressionCount: number;
			};
		}>;
		includes?: {
			users?: Array<{
				id: string;
				username: string;
				publicMetrics?: { followersCount: number };
			}>;
		};
		rateLimit: RateLimitInfo;
	}> {
		const queryParams = new URLSearchParams();
		queryParams.set("query", query);
		queryParams.set("max_results", String(params?.maxResults ?? 10));
		const tweetFields = params?.tweetFields ?? ["created_at", "public_metrics", "author_id"];
		queryParams.set("tweet.fields", tweetFields.join(","));
		queryParams.set("expansions", "author_id");
		if (params?.userFields) {
			queryParams.set("user.fields", params.userFields.join(","));
		} else {
			queryParams.set("user.fields", "username,public_metrics");
		}

		const { data, rateLimit } = await this.request<{
			data?: Array<{
				id: string;
				text: string;
				created_at?: string;
				author_id?: string;
				public_metrics?: {
					like_count: number;
					retweet_count: number;
					reply_count: number;
					impression_count: number;
				};
			}>;
			includes?: {
				users?: Array<{
					id: string;
					username: string;
					public_metrics?: { followers_count: number };
				}>;
			};
		}>(`/2/tweets/search/recent?${queryParams.toString()}`, { method: "GET" });

		return {
			data: (data.data ?? []).map((tweet) => ({
				id: tweet.id,
				text: tweet.text,
				createdAt: tweet.created_at,
				authorId: tweet.author_id,
				publicMetrics: tweet.public_metrics
					? {
							likeCount: tweet.public_metrics.like_count,
							retweetCount: tweet.public_metrics.retweet_count,
							replyCount: tweet.public_metrics.reply_count,
							impressionCount: tweet.public_metrics.impression_count,
						}
					: undefined,
			})),
			includes: data.includes
				? {
						users: data.includes.users?.map((u) => ({
							id: u.id,
							username: u.username,
							publicMetrics: u.public_metrics
								? { followersCount: u.public_metrics.followers_count }
								: undefined,
						})),
					}
				: undefined,
			rateLimit,
		};
	}

	/**
	 * Get current rate limit info for a given endpoint.
	 */
	getRateLimit(endpoint: string): RateLimitInfo | undefined {
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
