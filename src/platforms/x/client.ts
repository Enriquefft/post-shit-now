import type { ZodType } from "zod/v4";
import {
	type RateLimitInfo,
	RateLimitError,
	TweetResponseSchema,
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

		const json = await response.json();
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
			const tweetText = tweets[i] as string;
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
