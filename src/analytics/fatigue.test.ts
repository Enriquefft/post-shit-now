import { describe, expect, it } from "vitest";
import {
	detectTopicFatigue,
	type FatiguedTopic,
	type FatigueInput,
	type FatigueResult,
	isTopicFatigued,
	updateFatiguedTopics,
} from "./fatigue.ts";

describe("detectTopicFatigue", () => {
	it("detects 3 posts with strictly declining scores as fatigued", () => {
		const posts: FatigueInput[] = [
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 60, publishedAt: new Date("2026-02-05") },
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-10") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(1);
		expect(results[0]?.topic).toBe("AI");
		expect(results[0]?.status).toBe("fatigued");
		expect(results[0]?.lastScores).toEqual([80, 60, 40]);
		expect(results[0]?.suggestion).toContain("AI");
		expect(results[0]?.suggestion).toContain("cooling");
	});

	it("does not flag increasing scores as fatigued", () => {
		const posts: FatigueInput[] = [
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 60, publishedAt: new Date("2026-02-05") },
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-10") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(0);
	});

	it("does not flag when middle dips but last recovers", () => {
		const posts: FatigueInput[] = [
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-05") },
			{ topic: "AI", score: 60, publishedAt: new Date("2026-02-10") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(0);
	});

	it("skips topics with only 2 posts (not enough data)", () => {
		const posts: FatigueInput[] = [
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-05") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(0);
	});

	it("handles multiple topics: returns only fatigued ones", () => {
		const posts: FatigueInput[] = [
			// AI: declining
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 60, publishedAt: new Date("2026-02-05") },
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-10") },
			// Rust: increasing
			{ topic: "Rust", score: 30, publishedAt: new Date("2026-02-01") },
			{ topic: "Rust", score: 50, publishedAt: new Date("2026-02-05") },
			{ topic: "Rust", score: 70, publishedAt: new Date("2026-02-10") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(1);
		expect(results[0]?.topic).toBe("AI");
	});

	it("returns empty array for empty input", () => {
		const results = detectTopicFatigue([]);
		expect(results).toHaveLength(0);
	});

	it("uses last 3 posts when more than 3 exist", () => {
		const posts: FatigueInput[] = [
			{ topic: "AI", score: 20, publishedAt: new Date("2026-01-01") },
			{ topic: "AI", score: 90, publishedAt: new Date("2026-01-15") },
			// Last 3: declining
			{ topic: "AI", score: 80, publishedAt: new Date("2026-02-01") },
			{ topic: "AI", score: 60, publishedAt: new Date("2026-02-05") },
			{ topic: "AI", score: 40, publishedAt: new Date("2026-02-10") },
		];

		const results = detectTopicFatigue(posts);
		expect(results).toHaveLength(1);
		expect(results[0]?.lastScores).toEqual([80, 60, 40]);
	});
});

describe("isTopicFatigued", () => {
	it("returns true for topic with future cooldown date", () => {
		const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const fatigued = [{ topic: "AI", cooldownUntil: future }];

		expect(isTopicFatigued("AI", fatigued)).toBe(true);
	});

	it("returns false for topic with past cooldown date (expired)", () => {
		const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
		const fatigued = [{ topic: "AI", cooldownUntil: past }];

		expect(isTopicFatigued("AI", fatigued)).toBe(false);
	});

	it("returns false for topic not in fatigued list", () => {
		const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const fatigued = [{ topic: "AI", cooldownUntil: future }];

		expect(isTopicFatigued("Rust", fatigued)).toBe(false);
	});

	it("returns false for empty fatigued list", () => {
		expect(isTopicFatigued("AI", [])).toBe(false);
	});
});

describe("updateFatiguedTopics", () => {
	it("adds new detections with cooldown", () => {
		const newDetections: FatigueResult[] = [
			{
				topic: "AI",
				status: "fatigued",
				lastScores: [80, 60, 40],
				suggestion: "test",
			},
		];

		const result = updateFatiguedTopics([], newDetections, 14);
		expect(result).toHaveLength(1);
		expect(result[0]?.topic).toBe("AI");
		expect(result[0]?.lastScores).toEqual([80, 60, 40]);

		const cooldown = new Date(result[0]?.cooldownUntil as string);
		const now = new Date();
		const diffDays = (cooldown.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
		expect(diffDays).toBeGreaterThan(13);
		expect(diffDays).toBeLessThan(15);
	});

	it("removes expired cooldowns", () => {
		const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const current: FatiguedTopic[] = [
			{ topic: "old-topic", cooldownUntil: past, lastScores: [50, 40, 30] },
		];

		const result = updateFatiguedTopics(current, [], 14);
		expect(result).toHaveLength(0);
	});

	it("merges new detections with existing non-expired entries", () => {
		const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
		const current: FatiguedTopic[] = [
			{ topic: "existing", cooldownUntil: future, lastScores: [70, 50, 30] },
		];
		const newDetections: FatigueResult[] = [
			{
				topic: "new-topic",
				status: "fatigued",
				lastScores: [80, 60, 40],
				suggestion: "test",
			},
		];

		const result = updateFatiguedTopics(current, newDetections, 14);
		expect(result).toHaveLength(2);

		const topics = result.map((r) => r.topic);
		expect(topics).toContain("existing");
		expect(topics).toContain("new-topic");
	});

	it("extends cooldown for re-detected topics", () => {
		const shortFuture = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
		const current: FatiguedTopic[] = [
			{ topic: "AI", cooldownUntil: shortFuture, lastScores: [70, 50, 30] },
		];
		const newDetections: FatigueResult[] = [
			{
				topic: "AI",
				status: "fatigued",
				lastScores: [60, 40, 20],
				suggestion: "test",
			},
		];

		const result = updateFatiguedTopics(current, newDetections, 14);
		expect(result).toHaveLength(1);
		expect(result[0]?.lastScores).toEqual([60, 40, 20]); // Updated scores

		const cooldown = new Date(result[0]?.cooldownUntil as string);
		const diffDays = (cooldown.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
		expect(diffDays).toBeGreaterThan(13); // Extended to 14 days from now
	});
});
