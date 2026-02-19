import { describe, expect, it } from "vitest";
import {
	aggregateThreadMetrics,
	computeEngagementRate,
	computeEngagementRateBps,
	computeEngagementScore,
	ENGAGEMENT_WEIGHTS,
} from "./scoring.ts";
import type { TweetPublicMetrics } from "./types.ts";

describe("computeEngagementScore", () => {
	it("computes weighted score from all metric types", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 2,
			retweet_count: 3,
			quote_count: 1,
			reply_count: 5,
			like_count: 10,
			impression_count: 1000,
		};
		// 2*4 + 3*3 + 1*3 + 5*2 + 10*1 = 8+9+3+10+10 = 40
		expect(computeEngagementScore(metrics)).toBe(40);
	});

	it("returns 0 for all zeros", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 0,
			retweet_count: 0,
			quote_count: 0,
			reply_count: 0,
			like_count: 0,
			impression_count: 0,
		};
		expect(computeEngagementScore(metrics)).toBe(0);
	});

	it("scores high saves dominance correctly", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 100,
			retweet_count: 0,
			quote_count: 0,
			reply_count: 0,
			like_count: 0,
			impression_count: 500,
		};
		expect(computeEngagementScore(metrics)).toBe(400);
	});

	it("uses correct weight ordering: saves(4) > shares(3) > comments(2) > likes(1)", () => {
		expect(ENGAGEMENT_WEIGHTS.bookmark_count).toBe(4);
		expect(ENGAGEMENT_WEIGHTS.retweet_count).toBe(3);
		expect(ENGAGEMENT_WEIGHTS.quote_count).toBe(3);
		expect(ENGAGEMENT_WEIGHTS.reply_count).toBe(2);
		expect(ENGAGEMENT_WEIGHTS.like_count).toBe(1);
	});
});

describe("computeEngagementRate", () => {
	it("computes rate as total engagements divided by impressions", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 10,
			retweet_count: 10,
			quote_count: 5,
			reply_count: 10,
			like_count: 15,
			impression_count: 1000,
		};
		// total engagements = 10+10+5+10+15 = 50
		// rate = 50/1000 = 0.05
		expect(computeEngagementRate(metrics)).toBe(0.05);
	});

	it("returns 0 when impressions are zero (no division by zero)", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 5,
			retweet_count: 3,
			quote_count: 1,
			reply_count: 2,
			like_count: 10,
			impression_count: 0,
		};
		expect(computeEngagementRate(metrics)).toBe(0);
	});

	it("computes rate with very low impressions", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 1,
			retweet_count: 1,
			quote_count: 0,
			reply_count: 1,
			like_count: 2,
			impression_count: 10,
		};
		// total = 5, rate = 5/10 = 0.5
		expect(computeEngagementRate(metrics)).toBe(0.5);
	});
});

describe("computeEngagementRateBps", () => {
	it("returns rate multiplied by 10000 and rounded to integer", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 10,
			retweet_count: 10,
			quote_count: 5,
			reply_count: 10,
			like_count: 15,
			impression_count: 1000,
		};
		// rate = 0.05, bps = 500
		expect(computeEngagementRateBps(metrics)).toBe(500);
	});

	it("returns 0 when impressions are zero", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 1,
			retweet_count: 0,
			quote_count: 0,
			reply_count: 0,
			like_count: 0,
			impression_count: 0,
		};
		expect(computeEngagementRateBps(metrics)).toBe(0);
	});

	it("rounds fractional basis points to nearest integer", () => {
		const metrics: TweetPublicMetrics = {
			bookmark_count: 1,
			retweet_count: 1,
			quote_count: 1,
			reply_count: 0,
			like_count: 0,
			impression_count: 300,
		};
		// total = 3, rate = 3/300 = 0.01, bps = 100
		expect(computeEngagementRateBps(metrics)).toBe(100);
	});
});

describe("aggregateThreadMetrics", () => {
	it("sums absolute counts across all tweets in thread", () => {
		const thread: TweetPublicMetrics[] = [
			{
				bookmark_count: 5,
				retweet_count: 10,
				quote_count: 2,
				reply_count: 8,
				like_count: 20,
				impression_count: 1000,
			},
			{
				bookmark_count: 2,
				retweet_count: 3,
				quote_count: 1,
				reply_count: 4,
				like_count: 10,
				impression_count: 500,
			},
			{
				bookmark_count: 1,
				retweet_count: 1,
				quote_count: 0,
				reply_count: 2,
				like_count: 5,
				impression_count: 300,
			},
		];

		const result = aggregateThreadMetrics(thread);

		expect(result.bookmark_count).toBe(8);
		expect(result.retweet_count).toBe(14);
		expect(result.quote_count).toBe(3);
		expect(result.reply_count).toBe(14);
		expect(result.like_count).toBe(35);
	});

	it("uses first tweet impression count for rate calculation", () => {
		const thread: TweetPublicMetrics[] = [
			{
				bookmark_count: 5,
				retweet_count: 10,
				quote_count: 2,
				reply_count: 8,
				like_count: 20,
				impression_count: 1000,
			},
			{
				bookmark_count: 1,
				retweet_count: 1,
				quote_count: 0,
				reply_count: 1,
				like_count: 5,
				impression_count: 200,
			},
		];

		const result = aggregateThreadMetrics(thread);
		expect(result.impression_count).toBe(1000);
	});

	it("returns zero metrics for empty thread", () => {
		const result = aggregateThreadMetrics([]);

		expect(result.bookmark_count).toBe(0);
		expect(result.retweet_count).toBe(0);
		expect(result.quote_count).toBe(0);
		expect(result.reply_count).toBe(0);
		expect(result.like_count).toBe(0);
		expect(result.impression_count).toBe(0);
	});
});
