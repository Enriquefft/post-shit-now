// Re-export metric types from X platform types for use by analytics modules
export {
	type TweetNonPublicMetrics,
	TweetNonPublicMetricsSchema,
	type TweetPublicMetrics,
	TweetPublicMetricsSchema,
	type TweetsLookupResponse,
	TweetsLookupResponseSchema,
	type TweetWithMetrics,
	TweetWithMetricsSchema,
	type UserLookupResponse,
	UserLookupResponseSchema,
	type UserPublicMetrics,
	UserPublicMetricsSchema,
} from "../platforms/x/types.ts";

// Re-export LinkedIn metric types
export type {
	LinkedInAnalyticsElement,
	LinkedInPostAnalyticsResponse,
} from "../platforms/linkedin/types.ts";

// ─── LinkedIn Metrics ────────────────────────────────────────────────────────

/** Normalized LinkedIn metrics for scoring and storage */
export interface LinkedInMetrics {
	platform: "linkedin";
	impressions: number;
	membersReached: number;
	reactions: number;
	comments: number;
	reshares: number;
}

/** X metrics wrapper with discriminator */
export interface XMetrics {
	platform: "x";
	impressions: number;
	likes: number;
	retweets: number;
	quotes: number;
	replies: number;
	bookmarks: number;
}

/** Platform-agnostic metrics union */
export type PlatformMetrics = XMetrics | LinkedInMetrics;

// ─── Analytics-specific types ──────────────────────────────────────────────

/** Result of computing engagement score and rate for a post */
export interface EngagementScoreResult {
	/** Weighted composite score (saves*4 + shares*3 + comments*2 + likes*1) */
	score: number;
	/** Engagement rate as a decimal (e.g., 0.05 = 5%) */
	rate: number;
	/** Engagement rate in basis points (e.g., 500 = 5%) for integer storage */
	rateBps: number;
}

/** Summary of a post's metrics for use in reviews and reports */
export interface PostMetricsSummary {
	postId: string;
	externalPostId: string;
	platform: string;
	format: string | null;
	topic: string | null;
	pillar: string | null;
	engagementScore: number;
	engagementRateBps: number;
	impressionCount: number;
	likeCount: number;
	retweetCount: number;
	quoteCount: number;
	replyCount: number;
	bookmarkCount: number;
	collectedAt: Date;
}
