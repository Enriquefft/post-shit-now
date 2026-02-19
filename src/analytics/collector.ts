import { and, eq, gt } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics, posts, preferenceModel } from "../core/db/schema.ts";
import type { InstagramClient } from "../platforms/instagram/client.ts";
import type { LinkedInClient } from "../platforms/linkedin/client.ts";
import type { TikTokClient } from "../platforms/tiktok/client.ts";
import type { XClient } from "../platforms/x/client.ts";
import {
	aggregateThreadMetrics,
	computeEngagementRateBps,
	computeEngagementScore,
} from "./scoring.ts";
import type { TweetPublicMetrics, TweetWithMetrics } from "./types.ts";

export interface CollectionSummary {
	postsCollected: number;
	followerCount: number;
	apiCallsMade: number;
	errors: number;
}

/**
 * Collect analytics for published X posts with tiered cadence.
 *
 * Cadence (per CONTEXT.md / research):
 *   - 0-3 days old: every run
 *   - 4-7 days old: every run (daily cron)
 *   - 8-30 days old: only if collectedAt is NULL or older than 3 days
 *
 * Handles threads by aggregating metrics across all tweet IDs.
 * Tracks follower count in preferenceModel.followerHistory.
 */
export async function collectAnalytics(
	db: HubDb,
	client: XClient,
	userId: string,
): Promise<CollectionSummary> {
	const summary: CollectionSummary = {
		postsCollected: 0,
		followerCount: 0,
		apiCallsMade: 0,
		errors: 0,
	};

	// 1. Query published X posts from last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	const threeDaysAgoDate = new Date();
	threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);

	const publishedPosts = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.userId, userId),
				eq(posts.platform, "x"),
				eq(posts.status, "published"),
				gt(posts.publishedAt, thirtyDaysAgo),
			),
		);

	if (publishedPosts.length === 0) {
		// Still track follower count even with no posts
		summary.followerCount = await trackFollowerCount(db, client, userId, summary);
		return summary;
	}

	// 2. Apply tiered cadence filter
	// Fetch existing metrics to check collectedAt
	const existingMetrics = await db
		.select({
			postId: postMetrics.postId,
			collectedAt: postMetrics.collectedAt,
		})
		.from(postMetrics)
		.where(eq(postMetrics.userId, userId));

	const metricsMap = new Map(existingMetrics.map((m) => [m.postId, m.collectedAt]));

	const postsToCollect = publishedPosts.filter((post) => {
		if (!post.publishedAt) return false;
		const ageMs = Date.now() - post.publishedAt.getTime();
		const ageDays = ageMs / (1000 * 60 * 60 * 24);

		// 0-7 days: always collect
		if (ageDays <= 7) return true;

		// 8-30 days: only if never collected or collected > 3 days ago
		const lastCollected = metricsMap.get(post.id);
		if (!lastCollected) return true;
		return lastCollected < threeDaysAgoDate;
	});

	if (postsToCollect.length === 0) {
		summary.followerCount = await trackFollowerCount(db, client, userId, summary);
		return summary;
	}

	// 3. Gather all tweet IDs (including thread IDs)
	const tweetIdToPostMap = new Map<string, (typeof postsToCollect)[number]>();
	const postTweetIds = new Map<string, string[]>();

	for (const post of postsToCollect) {
		const ids: string[] = [];

		// Thread posts have all IDs in platformPostIds
		if (post.platformPostIds && post.platformPostIds.length > 0) {
			for (const id of post.platformPostIds) {
				ids.push(id);
				tweetIdToPostMap.set(id, post);
			}
		} else if (post.externalPostId) {
			ids.push(post.externalPostId);
			tweetIdToPostMap.set(post.externalPostId, post);
		}

		if (ids.length > 0) {
			postTweetIds.set(post.id, ids);
		}
	}

	const allTweetIds = [...new Set(tweetIdToPostMap.keys())];

	if (allTweetIds.length === 0) {
		summary.followerCount = await trackFollowerCount(db, client, userId, summary);
		return summary;
	}

	// 4. Batch fetch metrics from X API
	let tweetMetricsMap: Map<string, TweetWithMetrics>;
	try {
		const { data } = await client.getTweets(allTweetIds, {
			tweetFields: ["public_metrics", "non_public_metrics"],
		});
		summary.apiCallsMade += Math.ceil(allTweetIds.length / 100);

		tweetMetricsMap = new Map(data.data.map((t) => [t.id, t]));
	} catch (_error) {
		// If the batch fetch fails entirely, we can't collect anything
		summary.errors++;
		summary.followerCount = await trackFollowerCount(db, client, userId, summary);
		return summary;
	}

	// 5. Compute and upsert per post
	for (const post of postsToCollect) {
		try {
			const tweetIds = postTweetIds.get(post.id);
			if (!tweetIds || tweetIds.length === 0) continue;

			let metrics: TweetPublicMetrics;
			const isThread = tweetIds.length > 1;

			if (isThread) {
				// Aggregate thread metrics
				const threadMetrics: TweetPublicMetrics[] = [];
				for (const tid of tweetIds) {
					const tweet = tweetMetricsMap.get(tid);
					if (tweet?.public_metrics) {
						threadMetrics.push(tweet.public_metrics);
					}
				}
				if (threadMetrics.length === 0) continue;
				metrics = aggregateThreadMetrics(threadMetrics);
			} else {
				const tweet = tweetMetricsMap.get(tweetIds[0] as string);
				if (!tweet?.public_metrics) continue;
				metrics = tweet.public_metrics;
			}

			const score = computeEngagementScore(metrics);
			const rateBps = computeEngagementRateBps(metrics);

			// Extract context from post metadata
			const metadata = (post.metadata ?? {}) as Record<string, unknown>;
			const postFormat = (metadata.format as string) ?? null;
			const postTopic = (metadata.topic as string) ?? null;
			const postPillar = (metadata.pillar as string) ?? null;

			// Non-public metrics from first tweet (if available)
			const firstTweet = tweetMetricsMap.get(tweetIds[0] as string);
			const nonPublic = firstTweet?.non_public_metrics;

			// Upsert into postMetrics (ON CONFLICT postId+platform)
			await db
				.insert(postMetrics)
				.values({
					userId,
					postId: post.id,
					platform: "x",
					externalPostId: post.externalPostId ?? (tweetIds[0] as string),
					impressionCount: metrics.impression_count,
					likeCount: metrics.like_count,
					retweetCount: metrics.retweet_count,
					quoteCount: metrics.quote_count,
					replyCount: metrics.reply_count,
					bookmarkCount: metrics.bookmark_count,
					urlLinkClicks: nonPublic?.url_link_clicks ?? null,
					userProfileClicks: nonPublic?.user_profile_clicks ?? null,
					engagementScore: score,
					engagementRateBps: rateBps,
					postFormat,
					postTopic,
					postPillar,
					collectedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [postMetrics.postId, postMetrics.platform],
					set: {
						impressionCount: metrics.impression_count,
						likeCount: metrics.like_count,
						retweetCount: metrics.retweet_count,
						quoteCount: metrics.quote_count,
						replyCount: metrics.reply_count,
						bookmarkCount: metrics.bookmark_count,
						urlLinkClicks: nonPublic?.url_link_clicks ?? null,
						userProfileClicks: nonPublic?.user_profile_clicks ?? null,
						engagementScore: score,
						engagementRateBps: rateBps,
						postFormat,
						postTopic,
						postPillar,
						collectedAt: new Date(),
					},
				});

			summary.postsCollected++;
		} catch (_error) {
			// Per-post error isolation — log and continue
			summary.errors++;
		}
	}

	// 6. Track follower count
	summary.followerCount = await trackFollowerCount(db, client, userId, summary);

	return summary;
}

// ─── LinkedIn Analytics Collection ──────────────────────────────────────────

/** LinkedIn engagement weights: reshares > comments > reactions */
const LINKEDIN_ENGAGEMENT_WEIGHTS = {
	reshares: 4, // high signal, equivalent to X retweets
	comments: 3, // high quality on LinkedIn
	reactions: 1, // engagement but lower signal
} as const;

/**
 * Compute LinkedIn engagement score using LinkedIn-specific weights.
 */
function computeLinkedInEngagementScore(metrics: {
	reactions: number;
	comments: number;
	reshares: number;
}): number {
	return (
		metrics.reshares * LINKEDIN_ENGAGEMENT_WEIGHTS.reshares +
		metrics.comments * LINKEDIN_ENGAGEMENT_WEIGHTS.comments +
		metrics.reactions * LINKEDIN_ENGAGEMENT_WEIGHTS.reactions
	);
}

/**
 * Compute LinkedIn engagement rate in basis points.
 */
function computeLinkedInEngagementRateBps(
	metrics: { reactions: number; comments: number; reshares: number },
	impressions: number,
): number {
	if (!impressions || impressions === 0) return 0;
	const totalEngagements = metrics.reactions + metrics.comments + metrics.reshares;
	return Math.round((totalEngagements / impressions) * 10000);
}

/**
 * Collect analytics for published LinkedIn posts.
 * Follows the same pattern as X analytics collection:
 *   - Query published LinkedIn posts from last 30 days
 *   - Fetch per-post analytics via memberCreatorPostAnalytics API
 *   - Compute engagement scores with LinkedIn-weighted metrics
 *   - Per-post error isolation (catch, log, continue)
 */
export async function collectLinkedInAnalytics(
	db: HubDb,
	client: LinkedInClient,
	userId: string,
): Promise<CollectionSummary> {
	const summary: CollectionSummary = {
		postsCollected: 0,
		followerCount: 0,
		apiCallsMade: 0,
		errors: 0,
	};

	// 1. Query published LinkedIn posts from last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const threeDaysAgoDate = new Date();
	threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);

	const publishedPosts = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.userId, userId),
				eq(posts.platform, "linkedin"),
				eq(posts.status, "published"),
				gt(posts.publishedAt, thirtyDaysAgo),
			),
		);

	if (publishedPosts.length === 0) {
		return summary;
	}

	// 2. Apply tiered cadence filter (same as X)
	const existingMetrics = await db
		.select({
			postId: postMetrics.postId,
			collectedAt: postMetrics.collectedAt,
		})
		.from(postMetrics)
		.where(eq(postMetrics.userId, userId));

	const metricsMap = new Map(existingMetrics.map((m) => [m.postId, m.collectedAt]));

	const postsToCollect = publishedPosts.filter((post) => {
		if (!post.publishedAt) return false;
		const ageMs = Date.now() - post.publishedAt.getTime();
		const ageDays = ageMs / (1000 * 60 * 60 * 24);

		if (ageDays <= 7) return true;

		const lastCollected = metricsMap.get(post.id);
		if (!lastCollected) return true;
		return lastCollected < threeDaysAgoDate;
	});

	if (postsToCollect.length === 0) {
		return summary;
	}

	// 3. Fetch analytics per post
	for (const post of postsToCollect) {
		try {
			if (!post.externalPostId) continue;

			const analyticsResponse = await client.getPostAnalytics(post.externalPostId);
			summary.apiCallsMade++;

			const element = analyticsResponse.elements[0];
			if (!element) continue;

			const stats = element.totalShareStatistics;

			const linkedInMetrics = {
				reactions: stats.likeCount,
				comments: stats.commentCount,
				reshares: stats.shareCount,
			};

			const score = computeLinkedInEngagementScore(linkedInMetrics);
			const rateBps = computeLinkedInEngagementRateBps(linkedInMetrics, stats.impressionCount);

			// Extract context from post metadata
			const metadata = (post.metadata ?? {}) as Record<string, unknown>;
			const postFormat = (metadata.format as string) ?? null;
			const postTopic = (metadata.topic as string) ?? null;
			const postPillar = (metadata.pillar as string) ?? null;

			// Upsert into postMetrics
			await db
				.insert(postMetrics)
				.values({
					userId,
					postId: post.id,
					platform: "linkedin",
					externalPostId: post.externalPostId,
					impressionCount: stats.impressionCount,
					likeCount: stats.likeCount, // reactions
					retweetCount: stats.shareCount, // reshares
					quoteCount: 0, // LinkedIn doesn't have quotes
					replyCount: stats.commentCount,
					bookmarkCount: 0, // LinkedIn doesn't expose saves
					urlLinkClicks: stats.clickCount ?? null,
					userProfileClicks: null,
					engagementScore: score,
					engagementRateBps: rateBps,
					postFormat,
					postTopic,
					postPillar,
					collectedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [postMetrics.postId, postMetrics.platform],
					set: {
						impressionCount: stats.impressionCount,
						likeCount: stats.likeCount,
						retweetCount: stats.shareCount,
						quoteCount: 0,
						replyCount: stats.commentCount,
						bookmarkCount: 0,
						urlLinkClicks: stats.clickCount ?? null,
						engagementScore: score,
						engagementRateBps: rateBps,
						postFormat,
						postTopic,
						postPillar,
						collectedAt: new Date(),
					},
				});

			summary.postsCollected++;
		} catch (_error) {
			// Per-post error isolation — log and continue
			summary.errors++;
		}
	}

	return summary;
}

// ─── Instagram Analytics Collection ─────────────────────────────────────────

/** Instagram engagement weights */
const INSTAGRAM_ENGAGEMENT_WEIGHTS = {
	shares: 4, // highest signal — viral amplification
	saved: 3, // strong intent signal on Instagram
	comments: 2, // engagement
	likes: 1, // lowest signal but still counts
} as const;

function computeInstagramEngagementScore(metrics: {
	likes: number;
	comments: number;
	shares: number;
	saved: number;
}): number {
	return (
		metrics.shares * INSTAGRAM_ENGAGEMENT_WEIGHTS.shares +
		metrics.saved * INSTAGRAM_ENGAGEMENT_WEIGHTS.saved +
		metrics.comments * INSTAGRAM_ENGAGEMENT_WEIGHTS.comments +
		metrics.likes * INSTAGRAM_ENGAGEMENT_WEIGHTS.likes
	);
}

function computeInstagramEngagementRateBps(
	metrics: { likes: number; comments: number; shares: number; saved: number },
	impressions: number,
): number {
	if (!impressions || impressions === 0) return 0;
	const totalEngagements = metrics.likes + metrics.comments + metrics.shares + metrics.saved;
	return Math.round((totalEngagements / impressions) * 10000);
}

/**
 * Collect analytics for published Instagram posts.
 * Follows the same tiered cadence as X/LinkedIn:
 *   - 0-7 day posts: every run
 *   - 8-30 day posts: only if not collected in 3 days
 *
 * Rate limit budget: ~50 req/hr reserved for analytics (from 200/hr total).
 * Per-post error isolation (catch, log, continue).
 */
export async function collectInstagramAnalytics(
	client: InstagramClient,
	db: HubDb,
	userId: string,
): Promise<CollectionSummary> {
	const summary: CollectionSummary = {
		postsCollected: 0,
		followerCount: 0,
		apiCallsMade: 0,
		errors: 0,
	};

	// Rate limit budget for analytics: cap at 50 API calls
	const ANALYTICS_BUDGET = 50;

	// 1. Query published Instagram posts from last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const threeDaysAgoDate = new Date();
	threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);

	const publishedPosts = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.userId, userId),
				eq(posts.platform, "instagram"),
				eq(posts.status, "published"),
				gt(posts.publishedAt, thirtyDaysAgo),
			),
		);

	if (publishedPosts.length === 0) {
		return summary;
	}

	// 2. Apply tiered cadence filter
	const existingMetrics = await db
		.select({
			postId: postMetrics.postId,
			collectedAt: postMetrics.collectedAt,
		})
		.from(postMetrics)
		.where(eq(postMetrics.userId, userId));

	const metricsMap = new Map(existingMetrics.map((m) => [m.postId, m.collectedAt]));

	const postsToCollect = publishedPosts.filter((post) => {
		if (!post.publishedAt) return false;
		const ageMs = Date.now() - post.publishedAt.getTime();
		const ageDays = ageMs / (1000 * 60 * 60 * 24);

		if (ageDays <= 7) return true;

		const lastCollected = metricsMap.get(post.id);
		if (!lastCollected) return true;
		return lastCollected < threeDaysAgoDate;
	});

	if (postsToCollect.length === 0) {
		return summary;
	}

	// 3. Fetch insights per post (one API call per post)
	for (const post of postsToCollect) {
		// Respect analytics rate limit budget
		if (summary.apiCallsMade >= ANALYTICS_BUDGET) break;

		try {
			// Get the Instagram media ID from platformPostIds or externalPostId
			const metadata = (post.metadata ?? {}) as Record<string, unknown>;
			const platformPostIds = metadata.platformPostIds as Record<string, string> | undefined;
			const mediaId = platformPostIds?.instagram ?? post.externalPostId;
			if (!mediaId) continue;

			const insights = await client.getMediaInsights(mediaId);
			summary.apiCallsMade++;

			const igMetrics = {
				likes: insights.likes ?? 0,
				comments: insights.comments ?? 0,
				shares: insights.shares ?? 0,
				saved: insights.saved ?? 0,
			};

			const impressions = insights.impressions ?? 0;
			const score = computeInstagramEngagementScore(igMetrics);
			const rateBps = computeInstagramEngagementRateBps(igMetrics, impressions);

			const postFormat = (metadata.format as string) ?? null;
			const postTopic = (metadata.topic as string) ?? null;
			const postPillar = (metadata.pillar as string) ?? null;

			await db
				.insert(postMetrics)
				.values({
					userId,
					postId: post.id,
					platform: "instagram",
					externalPostId: mediaId,
					impressionCount: impressions,
					likeCount: igMetrics.likes,
					retweetCount: igMetrics.shares, // shares mapped to retweetCount column
					quoteCount: 0, // Instagram has no quotes
					replyCount: igMetrics.comments,
					bookmarkCount: igMetrics.saved,
					urlLinkClicks: null,
					userProfileClicks: insights.reach ?? null, // reach stored in profile clicks column
					engagementScore: score,
					engagementRateBps: rateBps,
					postFormat,
					postTopic,
					postPillar,
					collectedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: [postMetrics.postId, postMetrics.platform],
					set: {
						impressionCount: impressions,
						likeCount: igMetrics.likes,
						retweetCount: igMetrics.shares,
						quoteCount: 0,
						replyCount: igMetrics.comments,
						bookmarkCount: igMetrics.saved,
						urlLinkClicks: null,
						userProfileClicks: insights.reach ?? null,
						engagementScore: score,
						engagementRateBps: rateBps,
						postFormat,
						postTopic,
						postPillar,
						collectedAt: new Date(),
					},
				});

			summary.postsCollected++;
		} catch (_error) {
			// Per-post error isolation — log and continue
			summary.errors++;
		}
	}

	return summary;
}

// ─── TikTok Analytics Collection ────────────────────────────────────────────

/** TikTok engagement weights */
const TIKTOK_ENGAGEMENT_WEIGHTS = {
	shares: 4, // viral signal
	comments: 2, // engagement signal
	likes: 1, // basic engagement
} as const;

function computeTikTokEngagementScore(metrics: {
	likes: number;
	comments: number;
	shares: number;
}): number {
	return (
		metrics.shares * TIKTOK_ENGAGEMENT_WEIGHTS.shares +
		metrics.comments * TIKTOK_ENGAGEMENT_WEIGHTS.comments +
		metrics.likes * TIKTOK_ENGAGEMENT_WEIGHTS.likes
	);
}

function computeTikTokEngagementRateBps(
	metrics: { likes: number; comments: number; shares: number },
	views: number,
): number {
	if (!views || views === 0) return 0;
	const totalEngagements = metrics.likes + metrics.comments + metrics.shares;
	return Math.round((totalEngagements / views) * 10000);
}

/**
 * Collect analytics for published TikTok posts.
 * TikTok video.list returns metrics inline — no separate insights call needed (more efficient).
 * Follows the same tiered cadence as X/LinkedIn/Instagram.
 * Per-post error isolation (catch, log, continue).
 */
export async function collectTikTokAnalytics(
	client: TikTokClient,
	db: HubDb,
	userId: string,
): Promise<CollectionSummary> {
	const summary: CollectionSummary = {
		postsCollected: 0,
		followerCount: 0,
		apiCallsMade: 0,
		errors: 0,
	};

	// 1. Query published TikTok posts from last 30 days
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	const threeDaysAgoDate = new Date();
	threeDaysAgoDate.setDate(threeDaysAgoDate.getDate() - 3);

	const publishedPosts = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.userId, userId),
				eq(posts.platform, "tiktok"),
				eq(posts.status, "published"),
				gt(posts.publishedAt, thirtyDaysAgo),
			),
		);

	if (publishedPosts.length === 0) {
		return summary;
	}

	// 2. Apply tiered cadence filter
	const existingMetrics = await db
		.select({
			postId: postMetrics.postId,
			collectedAt: postMetrics.collectedAt,
		})
		.from(postMetrics)
		.where(eq(postMetrics.userId, userId));

	const metricsMap = new Map(existingMetrics.map((m) => [m.postId, m.collectedAt]));

	const postsToCollect = publishedPosts.filter((post) => {
		if (!post.publishedAt) return false;
		const ageMs = Date.now() - post.publishedAt.getTime();
		const ageDays = ageMs / (1000 * 60 * 60 * 24);

		if (ageDays <= 7) return true;

		const lastCollected = metricsMap.get(post.id);
		if (!lastCollected) return true;
		return lastCollected < threeDaysAgoDate;
	});

	if (postsToCollect.length === 0) {
		return summary;
	}

	// 3. Fetch video list from TikTok (metrics returned inline — efficient)
	// Build a map of TikTok video ID -> post for matching
	const tiktokIdToPost = new Map<string, (typeof postsToCollect)[number]>();
	for (const post of postsToCollect) {
		const metadata = (post.metadata ?? {}) as Record<string, unknown>;
		const platformPostIds = metadata.platformPostIds as Record<string, string> | undefined;
		const tiktokId = platformPostIds?.tiktok ?? post.externalPostId;
		if (tiktokId) {
			tiktokIdToPost.set(tiktokId, post);
		}
	}

	if (tiktokIdToPost.size === 0) {
		return summary;
	}

	// Fetch videos with metrics (paginate if needed)
	try {
		let cursor: number | undefined;
		let hasMore = true;

		while (hasMore) {
			const videoList = await client.getVideoList(cursor, 20);
			summary.apiCallsMade++;

			const videos = videoList.data.videos ?? [];
			for (const video of videos) {
				try {
					const post = tiktokIdToPost.get(video.id);
					if (!post) continue;

					const ttMetrics = {
						likes: video.like_count ?? 0,
						comments: video.comment_count ?? 0,
						shares: video.share_count ?? 0,
					};
					const views = video.view_count ?? 0;

					const score = computeTikTokEngagementScore(ttMetrics);
					const rateBps = computeTikTokEngagementRateBps(ttMetrics, views);

					const metadata = (post.metadata ?? {}) as Record<string, unknown>;
					const postFormat = (metadata.format as string) ?? null;
					const postTopic = (metadata.topic as string) ?? null;
					const postPillar = (metadata.pillar as string) ?? null;

					await db
						.insert(postMetrics)
						.values({
							userId,
							postId: post.id,
							platform: "tiktok",
							externalPostId: video.id,
							impressionCount: views, // views as impressions for TikTok
							likeCount: ttMetrics.likes,
							retweetCount: ttMetrics.shares, // shares mapped to retweetCount
							quoteCount: 0, // TikTok has no quotes
							replyCount: ttMetrics.comments,
							bookmarkCount: 0, // TikTok doesn't expose bookmarks via API
							urlLinkClicks: null,
							userProfileClicks: null,
							engagementScore: score,
							engagementRateBps: rateBps,
							postFormat,
							postTopic,
							postPillar,
							collectedAt: new Date(),
						})
						.onConflictDoUpdate({
							target: [postMetrics.postId, postMetrics.platform],
							set: {
								impressionCount: views,
								likeCount: ttMetrics.likes,
								retweetCount: ttMetrics.shares,
								quoteCount: 0,
								replyCount: ttMetrics.comments,
								bookmarkCount: 0,
								engagementScore: score,
								engagementRateBps: rateBps,
								postFormat,
								postTopic,
								postPillar,
								collectedAt: new Date(),
							},
						});

					summary.postsCollected++;
					// Remove matched post to track completion
					tiktokIdToPost.delete(video.id);
				} catch (_error) {
					// Per-post error isolation
					summary.errors++;
				}
			}

			// Check pagination
			hasMore = videoList.data.has_more ?? false;
			cursor = videoList.data.cursor;

			// Stop if all posts matched or no more pages
			if (tiktokIdToPost.size === 0) break;
		}
	} catch (_error) {
		// Video list fetch failed entirely
		summary.errors++;
	}

	return summary;
}

/**
 * Fetch follower count from X API and append to preferenceModel.followerHistory.
 */
async function trackFollowerCount(
	db: HubDb,
	client: XClient,
	userId: string,
	summary: CollectionSummary,
): Promise<number> {
	try {
		const { data } = await client.getMe({ userFields: ["public_metrics"] });
		summary.apiCallsMade++;

		const followerCount = data.data.public_metrics?.followers_count ?? 0;
		const entry = { count: followerCount, date: new Date().toISOString() };

		// Get existing preference model row
		const [existing] = await db
			.select()
			.from(preferenceModel)
			.where(eq(preferenceModel.userId, userId))
			.limit(1);

		if (existing) {
			const history = existing.followerHistory ?? [];
			history.push(entry);

			await db
				.update(preferenceModel)
				.set({
					followerHistory: history,
					updatedAt: new Date(),
				})
				.where(eq(preferenceModel.userId, userId));
		} else {
			// Create new preference model row with just follower history
			await db.insert(preferenceModel).values({
				userId,
				followerHistory: [entry],
			});
		}

		return followerCount;
	} catch (_error) {
		summary.errors++;
		return 0;
	}
}
