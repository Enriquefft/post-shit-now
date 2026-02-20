/**
 * TikTok Creative Center — Free trending content discovery.
 *
 * Provides access to trending topics and videos via TikTok's Creative Center
 * public data. This is the free tier fallback; EnsembleData (~$100/mo) is
 * the paid upgrade path for real-time monitoring.
 *
 * Graceful degradation: if scraping fails, returns empty arrays with warning
 * logs (never crashes).
 */

import { z } from "zod/v4";

const CREATIVE_CENTER_BASE = "https://ads.tiktok.com/business/creativecenter/api";

export interface TrendingTopic {
	topic: string;
	viewCount: number;
	trending: "up" | "down" | "stable";
}

export interface TrendingVideo {
	videoId: string;
	description: string;
	authorHandle: string;
	viewCount: number;
	likeCount: number;
	commentCount: number;
}

/**
 * Fetch trending topics from TikTok Creative Center.
 * Returns topic names, view counts, and trend direction.
 *
 * @param options.country - Country code (default: "US")
 * @returns Array of trending topics, or empty array on failure
 */
export async function getTrendingTopics(options?: { country?: string }): Promise<TrendingTopic[]> {
	const country = options?.country ?? "US";

	try {
		const url = `${CREATIVE_CENTER_BASE}/trending/hashtag/list?page=1&limit=20&country_code=${country}`;
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; PostShitNow/1.0)",
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			console.warn(`[TikTok Creative Center] Trending topics request failed: ${response.status}`);
			return [];
		}

		const TrendingTopicsResponseSchema = z.object({
			data: z
				.object({
					list: z
						.array(
							z.object({
								hashtag_name: z.string().optional(),
								publish_cnt: z.number().optional(),
								trend: z.number().optional(),
							}),
						)
						.optional(),
				})
				.optional(),
		});

		const json = TrendingTopicsResponseSchema.parse(await response.json());

		const list = json.data?.list ?? [];
		return list.map((item) => ({
			topic: item.hashtag_name ?? "",
			viewCount: item.publish_cnt ?? 0,
			trending: item.trend === 1 ? "up" : item.trend === 2 ? "down" : "stable",
		}));
	} catch (error) {
		console.warn(
			`[TikTok Creative Center] Failed to fetch trending topics: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}

/**
 * Search Creative Center for keyword-relevant trending videos.
 * Returns video metadata with engagement metrics.
 *
 * @param keyword - Search keyword
 * @param options.country - Country code (default: "US")
 * @param options.limit - Max results (default: 20)
 * @returns Array of trending videos, or empty array on failure
 */
export async function getTrendingVideos(
	keyword: string,
	options?: { country?: string; limit?: number },
): Promise<TrendingVideo[]> {
	const country = options?.country ?? "US";
	const limit = options?.limit ?? 20;

	try {
		const url = `${CREATIVE_CENTER_BASE}/trending/video/list?page=1&limit=${limit}&country_code=${country}&keyword=${encodeURIComponent(keyword)}`;
		const response = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; PostShitNow/1.0)",
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			console.warn(`[TikTok Creative Center] Trending videos request failed: ${response.status}`);
			return [];
		}

		const TrendingVideosResponseSchema = z.object({
			data: z
				.object({
					videos: z
						.array(
							z.object({
								item_id: z.string().optional(),
								title: z.string().optional(),
								author_name: z.string().optional(),
								vv_cnt: z.number().optional(),
								like_cnt: z.number().optional(),
								comment_cnt: z.number().optional(),
							}),
						)
						.optional(),
				})
				.optional(),
		});

		const json = TrendingVideosResponseSchema.parse(await response.json());

		const videos = json.data?.videos ?? [];
		return videos.map((item) => ({
			videoId: item.item_id ?? "",
			description: item.title ?? "",
			authorHandle: item.author_name ?? "",
			viewCount: item.vv_cnt ?? 0,
			likeCount: item.like_cnt ?? 0,
			commentCount: item.comment_cnt ?? 0,
		}));
	} catch (error) {
		console.warn(
			`[TikTok Creative Center] Failed to fetch trending videos: ${error instanceof Error ? error.message : String(error)}`,
		);
		return [];
	}
}
