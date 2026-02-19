import { sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import type { XClient } from "../platforms/x/client.ts";
import type { InstagramClient } from "../platforms/instagram/client.ts";
import { getTrendingTopics, getTrendingVideos } from "../platforms/tiktok/creative-center.ts";
import {
	buildOpportunityScore,
	computePotentialScore,
	computeReachScore,
	computeRecencyScore,
	computeRelevanceScore,
	suggestEngagementType,
	toBasisPoints,
} from "./scoring.ts";
import { isBlocked, isPlatformMonitoringEnabled } from "./config.ts";
import type { EngagementConfig, EngagementOpportunity } from "./types.ts";

// ─── Platform Client Types ──────────────────────────────────────────────────

export interface PlatformClients {
	x?: XClient;
	instagram?: InstagramClient;
	// linkedin intentionally omitted -- no content discovery API (walled garden)
	// tiktok uses Creative Center (no auth needed)
}

// ─── Raw Opportunity (before scoring) ───────────────────────────────────────

interface RawOpportunity {
	platform: string;
	externalPostId: string;
	authorHandle: string;
	authorFollowerCount?: number;
	postSnippet: string;
	postUrl?: string;
	postedAt?: Date;
	metrics: {
		likes: number;
		comments: number;
		shares: number;
		views?: number;
	};
}

// ─── Discover Opportunities ─────────────────────────────────────────────────

/**
 * Orchestrates discovery across all enabled platforms.
 * Returns scored EngagementOpportunity[] stored in DB.
 */
export async function discoverOpportunities(params: {
	db: HubDb;
	userId: string;
	nicheKeywords: string[];
	config: EngagementConfig;
	platformClients: PlatformClients;
}): Promise<EngagementOpportunity[]> {
	const { db, userId, nicheKeywords, config, platformClients } = params;
	const allOpportunities: EngagementOpportunity[] = [];
	const errors: Array<{ platform: string; error: string }> = [];

	// Search each enabled platform with per-platform error isolation
	const platforms: Array<{
		name: string;
		search: () => Promise<RawOpportunity[]>;
	}> = [];

	if (isPlatformMonitoringEnabled(config, "x") && platformClients.x) {
		platforms.push({
			name: "x",
			search: () => searchXTrending(platformClients.x!, nicheKeywords),
		});
	}

	if (isPlatformMonitoringEnabled(config, "instagram") && platformClients.instagram) {
		platforms.push({
			name: "instagram",
			search: () => searchInstagramTrending(platformClients.instagram!, nicheKeywords),
		});
	}

	if (isPlatformMonitoringEnabled(config, "tiktok")) {
		platforms.push({
			name: "tiktok",
			search: () => searchTikTokTrending(nicheKeywords),
		});
	}

	if (isPlatformMonitoringEnabled(config, "linkedin")) {
		platforms.push({
			name: "linkedin",
			search: () => searchLinkedInTrending(nicheKeywords),
		});
	}

	for (const platform of platforms) {
		try {
			const raw = await platform.search();

			for (const opp of raw) {
				// Filter: blocked authors
				if (isBlocked(config, opp.authorHandle)) continue;

				// Filter: posts older than 24 hours
				if (opp.postedAt && Date.now() - opp.postedAt.getTime() > 24 * 60 * 60 * 1000) {
					continue;
				}

				// Score the opportunity
				const relevance = computeRelevanceScore(opp.postSnippet, nicheKeywords);
				const recency = opp.postedAt ? computeRecencyScore(opp.postedAt) : 50;
				const reach = opp.authorFollowerCount
					? computeReachScore(opp.authorFollowerCount)
					: 40;
				const potential = opp.postedAt
					? computePotentialScore({ ...opp.metrics, postedAt: opp.postedAt })
					: 30;

				const score = buildOpportunityScore({ relevance, recency, reach, potential });
				const suggestedType = suggestEngagementType(
					opp.platform,
					score.composite,
					opp.postSnippet,
				);

				const opportunity: EngagementOpportunity = {
					userId,
					platform: opp.platform,
					externalPostId: opp.externalPostId,
					authorHandle: opp.authorHandle,
					authorFollowerCount: opp.authorFollowerCount,
					postSnippet: opp.postSnippet,
					postUrl: opp.postUrl,
					postedAt: opp.postedAt,
					score,
					status: "pending",
					suggestedType,
					detectedAt: new Date(),
				};

				// Upsert to DB (avoid duplicates by externalPostId + platform)
				try {
					await db.execute(sql`
						INSERT INTO engagement_opportunities (
							id, user_id, platform, external_post_id, author_handle,
							author_follower_count, post_snippet, post_url, posted_at,
							composite_score_bps, relevance_score_bps, recency_score_bps,
							reach_score_bps, potential_score_bps,
							status, suggested_type, detected_at, created_at
						) VALUES (
							gen_random_uuid(), ${userId}, ${opp.platform},
							${opp.externalPostId}, ${opp.authorHandle},
							${opp.authorFollowerCount ?? null},
							${opp.postSnippet}, ${opp.postUrl ?? null},
							${opp.postedAt?.toISOString() ?? null}::timestamptz,
							${toBasisPoints(score.composite)}, ${toBasisPoints(score.relevance)},
							${toBasisPoints(score.recency)}, ${toBasisPoints(score.reach)},
							${toBasisPoints(score.potential)},
							'pending', ${suggestedType},
							NOW(), NOW()
						)
						ON CONFLICT (external_post_id, platform) DO UPDATE SET
							composite_score_bps = GREATEST(engagement_opportunities.composite_score_bps, EXCLUDED.composite_score_bps),
							relevance_score_bps = CASE
								WHEN EXCLUDED.composite_score_bps > engagement_opportunities.composite_score_bps
								THEN EXCLUDED.relevance_score_bps
								ELSE engagement_opportunities.relevance_score_bps
							END,
							recency_score_bps = EXCLUDED.recency_score_bps,
							reach_score_bps = CASE
								WHEN EXCLUDED.composite_score_bps > engagement_opportunities.composite_score_bps
								THEN EXCLUDED.reach_score_bps
								ELSE engagement_opportunities.reach_score_bps
							END,
							potential_score_bps = CASE
								WHEN EXCLUDED.composite_score_bps > engagement_opportunities.composite_score_bps
								THEN EXCLUDED.potential_score_bps
								ELSE engagement_opportunities.potential_score_bps
							END
					`);

					allOpportunities.push(opportunity);
				} catch (err) {
					// Per-opportunity error isolation
					console.warn(
						`[Engagement Monitor] Failed to store opportunity: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}
		} catch (err) {
			// Per-platform error isolation: if one platform fails, continue with others
			errors.push({
				platform: platform.name,
				error: err instanceof Error ? err.message : String(err),
			});
			console.warn(
				`[Engagement Monitor] ${platform.name} search failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	if (errors.length > 0) {
		console.warn("[Engagement Monitor] Platform errors:", errors);
	}

	return allOpportunities;
}

// ─── X Search ───────────────────────────────────────────────────────────────

/**
 * Use X search/recent API to find trending posts matching niche keywords.
 */
export async function searchXTrending(
	client: XClient,
	keywords: string[],
): Promise<RawOpportunity[]> {
	if (keywords.length === 0) return [];

	const opportunities: RawOpportunity[] = [];

	// Build search query from keywords (OR them together, limit query length)
	const query = keywords.slice(0, 5).join(" OR ");

	try {
		const result = await client.searchRecent(query, {
			maxResults: 10,
			tweetFields: ["created_at", "public_metrics", "author_id"],
			userFields: ["username", "public_metrics"],
		});

		// Build user lookup map from includes
		const userMap = new Map<string, { username: string; followers: number }>();
		if (result.includes?.users) {
			for (const user of result.includes.users) {
				userMap.set(user.id, {
					username: user.username,
					followers: user.publicMetrics?.followersCount ?? 0,
				});
			}
		}

		for (const tweet of result.data) {
			const user = tweet.authorId ? userMap.get(tweet.authorId) : undefined;

			opportunities.push({
				platform: "x",
				externalPostId: tweet.id,
				authorHandle: user?.username ?? "unknown",
				authorFollowerCount: user?.followers,
				postSnippet: tweet.text.slice(0, 500),
				postUrl: user?.username
					? `https://x.com/${user.username}/status/${tweet.id}`
					: undefined,
				postedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
				metrics: {
					likes: tweet.publicMetrics?.likeCount ?? 0,
					comments: tweet.publicMetrics?.replyCount ?? 0,
					shares: tweet.publicMetrics?.retweetCount ?? 0,
				},
			});
		}
	} catch (err) {
		console.warn(
			`[Engagement Monitor] X search failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	return opportunities;
}

// ─── Instagram Search ───────────────────────────────────────────────────────

/**
 * Use Instagram hashtag search API for keyword-derived hashtags.
 * Budget-aware: limit hashtag searches to avoid exhausting 30/week budget.
 */
export async function searchInstagramTrending(
	client: InstagramClient,
	keywords: string[],
): Promise<RawOpportunity[]> {
	if (keywords.length === 0) return [];

	const opportunities: RawOpportunity[] = [];

	// Limit to 2 keyword searches per run to preserve weekly budget (30 searches/7 days)
	const searchKeywords = keywords.slice(0, 2);

	for (const keyword of searchKeywords) {
		try {
			// Search for hashtag ID
			const hashtagResult = await client.searchHashtags(keyword.replace(/\s+/g, ""));
			const hashtagIds = hashtagResult.data ?? [];

			if (hashtagIds.length === 0) continue;

			// Get recent media for first matching hashtag
			const hashtagId = hashtagIds[0]?.id;
			if (!hashtagId) continue;

			const media = await client.getHashtagRecentMedia(hashtagId);

			for (const post of media.data ?? []) {
				opportunities.push({
					platform: "instagram",
					externalPostId: post.id,
					authorHandle: "instagram_user", // Instagram hashtag search doesn't return author
					postSnippet: (post.caption ?? "").slice(0, 500),
					postUrl: post.permalink,
					postedAt: post.timestamp ? new Date(post.timestamp) : undefined,
					metrics: {
						likes: post.like_count ?? 0,
						comments: post.comments_count ?? 0,
						shares: 0, // Instagram doesn't expose share count
					},
				});
			}
		} catch (err) {
			console.warn(
				`[Engagement Monitor] Instagram hashtag search failed for "${keyword}": ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	return opportunities;
}

// ─── TikTok Search ──────────────────────────────────────────────────────────

/**
 * Use Creative Center (free tier) to find trending content matching keywords.
 * Graceful degradation if scraping fails.
 */
export async function searchTikTokTrending(
	keywords: string[],
): Promise<RawOpportunity[]> {
	const opportunities: RawOpportunity[] = [];

	try {
		// Get trending topics to see if any match keywords
		const trendingTopics = await getTrendingTopics();
		const matchingTopics = trendingTopics.filter((topic) =>
			keywords.some((kw) => topic.topic.toLowerCase().includes(kw.toLowerCase())),
		);

		// Search for trending videos with relevant keywords
		const searchTerms = keywords.slice(0, 3);
		for (const keyword of searchTerms) {
			const videos = await getTrendingVideos(keyword, { limit: 5 });

			for (const video of videos) {
				opportunities.push({
					platform: "tiktok",
					externalPostId: video.videoId,
					authorHandle: video.authorHandle || "tiktok_user",
					postSnippet: video.description.slice(0, 500),
					postUrl: video.videoId
						? `https://www.tiktok.com/@${video.authorHandle}/video/${video.videoId}`
						: undefined,
					metrics: {
						likes: video.likeCount,
						comments: video.commentCount,
						shares: 0,
						views: video.viewCount,
					},
				});
			}
		}

		// Add matching trending topics as lower-priority opportunities
		for (const topic of matchingTopics.slice(0, 5)) {
			opportunities.push({
				platform: "tiktok",
				externalPostId: `topic-${topic.topic}`,
				authorHandle: "trending_topic",
				postSnippet: `Trending topic: ${topic.topic} (${topic.viewCount} views, ${topic.trending})`,
				metrics: { likes: 0, comments: 0, shares: 0, views: topic.viewCount },
			});
		}
	} catch (err) {
		console.warn(
			`[Engagement Monitor] TikTok Creative Center search failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	return opportunities;
}

// ─── LinkedIn Search ────────────────────────────────────────────────────────

/**
 * LinkedIn has NO content discovery API (walled garden per project notes).
 * Engagement on LinkedIn is manual-only discovery.
 * Returns empty array with info log.
 */
export async function searchLinkedInTrending(
	_keywords: string[],
): Promise<RawOpportunity[]> {
	console.info(
		"[Engagement Monitor] LinkedIn has no content discovery API -- engagement is manual-only discovery",
	);
	return [];
}

// ─── Expire Old Opportunities ───────────────────────────────────────────────

/**
 * Expire opportunities older than 48 hours that are still pending.
 */
export async function expireOldOpportunities(
	db: HubDb,
	userId: string,
): Promise<number> {
	const result = await db.execute(sql`
		UPDATE engagement_opportunities
		SET status = 'expired'
		WHERE user_id = ${userId}
			AND status = 'pending'
			AND detected_at < NOW() - INTERVAL '48 hours'
		RETURNING id
	`);

	return result.rows.length;
}
