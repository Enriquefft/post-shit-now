import { and, eq, gt } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics, posts, preferenceModel } from "../core/db/schema.ts";
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
