/**
 * Mock client classes for platform API testing.
 * Mock at the class boundary (not HTTP/fetch layer) per project convention.
 *
 * MockXClient mirrors XClient public API with test helpers.
 * Other mock clients are minimal stubs -- their publish logic is not yet in test scope.
 */

import type { RateLimitInfo } from "../x/types.ts";
import { createDefaultRateLimit } from "./fixtures.ts";

// ─── MockXClient ─────────────────────────────────────────────────────────────

interface PostedTweet {
	id: string;
	text: string;
	replyToId?: string;
	mediaIds?: string[];
}

/**
 * Mock X (Twitter) client mirroring XClient public API.
 * Tracks posted tweets in memory and supports failure injection for error path testing.
 */
export class MockXClient {
	private accessToken: string;
	private tweets: PostedTweet[] = [];
	private nextId = 1;
	private pendingFailure: Error | null = null;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}

	/**
	 * Create a tweet. Returns incrementing tweet_N IDs.
	 * If a failure has been set via setFailure(), throws that error instead.
	 */
	async createTweet(params: {
		text: string;
		replyToId?: string;
		mediaIds?: string[];
	}): Promise<{ id: string; text: string; rateLimit: RateLimitInfo }> {
		if (this.pendingFailure) {
			const error = this.pendingFailure;
			throw error;
		}

		const id = `tweet_${this.nextId++}`;
		const tweet: PostedTweet = {
			id,
			text: params.text,
			replyToId: params.replyToId,
			mediaIds: params.mediaIds,
		};
		this.tweets.push(tweet);

		return {
			id,
			text: params.text,
			rateLimit: createDefaultRateLimit(),
		};
	}

	/**
	 * Get timeline -- returns previously posted tweets.
	 */
	async getTimeline(params?: { maxResults?: number }): Promise<{
		data: Array<{ id: string; text: string; createdAt?: string }>;
		rateLimit: RateLimitInfo;
	}> {
		const maxResults = params?.maxResults ?? 50;
		const data = this.tweets.slice(0, maxResults).map((t) => ({
			id: t.id,
			text: t.text,
			createdAt: new Date().toISOString(),
		}));

		return {
			data,
			rateLimit: createDefaultRateLimit(),
		};
	}

	// ─── Test Helpers ──────────────────────────────────────────────────────────

	/** Cause the next createTweet call to throw the provided error. */
	setFailure(error: Error): void {
		this.pendingFailure = error;
	}

	/** Restore normal createTweet behavior. */
	clearFailure(): void {
		this.pendingFailure = null;
	}

	/** Get all tweets posted through this mock. */
	getPostedTweets(): PostedTweet[] {
		return [...this.tweets];
	}

	/** Reset all state: posted tweets, ID counter, and pending failures. */
	reset(): void {
		this.tweets = [];
		this.nextId = 1;
		this.pendingFailure = null;
	}
}

// ─── MockLinkedInClient ──────────────────────────────────────────────────────

/** Minimal stub -- LinkedIn publish flow not in current test scope. */
export class MockLinkedInClient {
	private accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}
}

// ─── MockInstagramClient ─────────────────────────────────────────────────────

/** Minimal stub -- Instagram publish flow not in current test scope. */
export class MockInstagramClient {
	private accessToken: string;
	private accountId: string;

	constructor(accessToken: string, accountId: string) {
		this.accessToken = accessToken;
		this.accountId = accountId;
	}
}

// ─── MockTikTokClient ────────────────────────────────────────────────────────

/** Minimal stub -- TikTok publish flow not in current test scope. */
export class MockTikTokClient {
	private accessToken: string;

	constructor(accessToken: string) {
		this.accessToken = accessToken;
	}
}
