import type { TweetPublicMetrics } from "./types.ts";

/**
 * Engagement weights reflecting user decision: saves > shares > comments > likes.
 * bookmark_count = saves, retweet_count + quote_count = shares, reply_count = comments.
 */
export const ENGAGEMENT_WEIGHTS = {
	bookmark_count: 4, // saves — highest signal
	retweet_count: 3, // shares
	quote_count: 3, // shares (quote tweets are high-quality shares)
	reply_count: 2, // comments
	like_count: 1, // likes — lowest signal
} as const;

/**
 * Compute a weighted composite engagement score.
 * Pure function — no I/O.
 */
export function computeEngagementScore(metrics: TweetPublicMetrics): number {
	return (
		metrics.bookmark_count * ENGAGEMENT_WEIGHTS.bookmark_count +
		metrics.retweet_count * ENGAGEMENT_WEIGHTS.retweet_count +
		metrics.quote_count * ENGAGEMENT_WEIGHTS.quote_count +
		metrics.reply_count * ENGAGEMENT_WEIGHTS.reply_count +
		metrics.like_count * ENGAGEMENT_WEIGHTS.like_count
	);
}

/**
 * Compute engagement rate as a decimal (total engagements / impressions).
 * Returns 0 if impressions is 0 to avoid division by zero.
 * Pure function — no I/O.
 */
export function computeEngagementRate(metrics: TweetPublicMetrics): number {
	if (!metrics.impression_count || metrics.impression_count === 0) return 0;
	const totalEngagements =
		metrics.bookmark_count +
		metrics.retweet_count +
		metrics.quote_count +
		metrics.reply_count +
		metrics.like_count;
	return totalEngagements / metrics.impression_count;
}

/**
 * Compute engagement rate in basis points (1 bps = 0.01%).
 * Suitable for integer storage in the database.
 * Pure function — no I/O.
 */
export function computeEngagementRateBps(metrics: TweetPublicMetrics): number {
	return Math.round(computeEngagementRate(metrics) * 10000);
}

/**
 * Aggregate metrics across all tweets in a thread.
 * Sums absolute counts. Uses first tweet's impression_count for rate calculations
 * (the first tweet receives the most organic impressions in a thread).
 * Pure function — no I/O.
 */
export function aggregateThreadMetrics(threadMetrics: TweetPublicMetrics[]): TweetPublicMetrics {
	if (threadMetrics.length === 0) {
		return {
			bookmark_count: 0,
			retweet_count: 0,
			quote_count: 0,
			reply_count: 0,
			like_count: 0,
			impression_count: 0,
		};
	}

	const aggregated: TweetPublicMetrics = {
		bookmark_count: 0,
		retweet_count: 0,
		quote_count: 0,
		reply_count: 0,
		like_count: 0,
		impression_count: threadMetrics[0]?.impression_count ?? 0,
	};

	for (const m of threadMetrics) {
		aggregated.bookmark_count += m.bookmark_count;
		aggregated.retweet_count += m.retweet_count;
		aggregated.quote_count += m.quote_count;
		aggregated.reply_count += m.reply_count;
		aggregated.like_count += m.like_count;
	}

	return aggregated;
}
