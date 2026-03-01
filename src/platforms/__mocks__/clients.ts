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
	private tweets: PostedTweet[] = [];
	private nextId = 1;
	private pendingFailure: Error | null = null;

	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: stored for potential future use
	constructor(private readonly accessToken: string) {}

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
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: stored for potential future use
	constructor(private readonly accessToken: string) {}
}

// ─── MockInstagramClient ─────────────────────────────────────────────────────

interface MockContainer {
	id: string;
	type: string;
	caption: string;
}

/**
 * Mock Instagram client mirroring InstagramClient public API.
 * Supports the container workflow (create, poll status, publish) and
 * failure injection for error path testing.
 */
export class MockInstagramClient {
	private containers: MockContainer[] = [];
	private nextId = 1;
	private pendingFailure: Error | null = null;

	constructor(
		_accessToken: string,
		private readonly accountId: string,
	) {}

	/**
	 * Create a media container. Returns incrementing container_N IDs.
	 * If a failure has been set via setFailure(), throws that error instead.
	 */
	async createContainer(params: Record<string, string>): Promise<{ id: string }> {
		this.checkFailure();
		const id = `container_${this.nextId++}`;
		this.containers.push({
			id,
			type: params.media_type ?? "IMAGE",
			caption: params.caption ?? "",
		});
		return { id };
	}

	/**
	 * Check container processing status. Always returns FINISHED in mock.
	 */
	async getContainerStatus(containerId: string): Promise<{ id: string; status_code: string }> {
		this.checkFailure();
		return { id: containerId, status_code: "FINISHED" };
	}

	/**
	 * Publish a container. Returns incrementing ig_media_N IDs.
	 */
	async publishContainer(containerId: string): Promise<{ id: string }> {
		this.checkFailure();
		void containerId;
		return { id: `ig_media_${this.nextId++}` };
	}

	/**
	 * Get the authenticated user's profile info.
	 */
	async getMe(): Promise<{ id: string; username: string }> {
		this.checkFailure();
		return { id: this.accountId, username: "test_user" };
	}

	// ─── Test Helpers ──────────────────────────────────────────────────────────

	/** Cause the next API call to throw the provided error. */
	setFailure(error: Error): void {
		this.pendingFailure = error;
	}

	/** Restore normal behavior. */
	clearFailure(): void {
		this.pendingFailure = null;
	}

	/** Get all containers created through this mock. */
	getPublishedContainers(): MockContainer[] {
		return [...this.containers];
	}

	/** Reset all state: containers, ID counter, and pending failures. */
	reset(): void {
		this.containers = [];
		this.nextId = 1;
		this.pendingFailure = null;
	}

	/** Check and throw pending failure if set. */
	private checkFailure(): void {
		if (this.pendingFailure) {
			const error = this.pendingFailure;
			throw error;
		}
	}
}

// ─── MockTikTokClient ────────────────────────────────────────────────────────

/** Minimal stub -- TikTok publish flow not in current test scope. */
export class MockTikTokClient {
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: stored for potential future use
	constructor(private readonly accessToken: string) {}
}
