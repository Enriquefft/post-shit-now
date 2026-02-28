import { describe, expect, it, beforeEach } from "vitest";
import {
	MockXClient,
	MockLinkedInClient,
	MockInstagramClient,
	MockTikTokClient,
} from "./clients.ts";
import { XApiError } from "../x/types.ts";

describe("MockXClient", () => {
	let client: MockXClient;

	beforeEach(() => {
		client = new MockXClient("test-token");
	});

	it("creates tweets with incrementing IDs", async () => {
		const r1 = await client.createTweet({ text: "Hello" });
		const r2 = await client.createTweet({ text: "World" });
		expect(r1.id).toBe("tweet_1");
		expect(r1.text).toBe("Hello");
		expect(r2.id).toBe("tweet_2");
		expect(r2.text).toBe("World");
	});

	it("returns rate limit info on createTweet", async () => {
		const result = await client.createTweet({ text: "Test" });
		expect(result.rateLimit).toBeDefined();
		expect(result.rateLimit.limit).toBe(300);
		expect(result.rateLimit.remaining).toBeGreaterThanOrEqual(0);
		expect(result.rateLimit.resetAt).toBeInstanceOf(Date);
	});

	it("getTimeline returns previously posted tweets", async () => {
		await client.createTweet({ text: "First" });
		await client.createTweet({ text: "Second" });
		const timeline = await client.getTimeline();
		expect(timeline.data).toHaveLength(2);
		expect(timeline.data[0]?.text).toBe("First");
		expect(timeline.data[1]?.text).toBe("Second");
	});

	it("setFailure causes next createTweet to throw", async () => {
		const error = new XApiError(403, "Duplicate content");
		client.setFailure(error);
		await expect(client.createTweet({ text: "Dupe" })).rejects.toThrow("Duplicate content");
	});

	it("clearFailure restores normal behavior", async () => {
		client.setFailure(new Error("fail"));
		client.clearFailure();
		const result = await client.createTweet({ text: "Works" });
		expect(result.id).toBe("tweet_1");
	});

	it("reset clears all state", async () => {
		await client.createTweet({ text: "Before reset" });
		client.reset();
		const timeline = await client.getTimeline();
		expect(timeline.data).toHaveLength(0);
		// IDs restart
		const result = await client.createTweet({ text: "After reset" });
		expect(result.id).toBe("tweet_1");
	});

	it("getPostedTweets returns all posted tweets", async () => {
		await client.createTweet({ text: "A" });
		await client.createTweet({ text: "B" });
		const posted = client.getPostedTweets();
		expect(posted).toHaveLength(2);
		expect(posted[0]?.text).toBe("A");
		expect(posted[1]?.text).toBe("B");
	});
});

describe("MockLinkedInClient", () => {
	it("constructs with accessToken", () => {
		const client = new MockLinkedInClient("li-token");
		expect(client).toBeDefined();
	});
});

describe("MockInstagramClient", () => {
	it("constructs with accessToken and accountId", () => {
		const client = new MockInstagramClient("ig-token", "12345");
		expect(client).toBeDefined();
	});
});

describe("MockTikTokClient", () => {
	it("constructs with accessToken", () => {
		const client = new MockTikTokClient("tt-token");
		expect(client).toBeDefined();
	});
});
