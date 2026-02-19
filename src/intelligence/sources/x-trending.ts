import type { XClient } from "../../platforms/x/client.ts";
import type { RawTrend } from "../types.ts";

/**
 * Fetch trending content from the user's X home timeline.
 * Requires an authenticated XClient instance.
 * Maps tweets to RawTrend with like_count as sourceScore.
 */
export async function fetchXTrending(xClient: XClient): Promise<RawTrend[]> {
	// Use the user's timeline to detect what's trending in their network
	// X API v2 reverse chronological timeline
	const { data } = await xClient.getTimeline({
		maxResults: 50,
		tweetFields: ["created_at", "public_metrics"],
	});

	return data.map((tweet) => ({
		title: tweet.text,
		source: "x" as const,
		sourceScore: tweet.publicMetrics?.likeCount ?? 0,
		publishedAt: tweet.createdAt ? new Date(tweet.createdAt) : undefined,
	}));
}
