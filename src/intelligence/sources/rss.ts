import Parser from "rss-parser";
import type { RawTrend } from "../types.ts";

const parser = new Parser();

/**
 * Fetch latest items from custom RSS/Atom feeds.
 * Gracefully skips feeds that fail to parse or fetch.
 */
export async function fetchRSSFeeds(feedUrls: string[], limit = 5): Promise<RawTrend[]> {
	const allTrends: RawTrend[] = [];

	for (const url of feedUrls) {
		try {
			const feed = await parser.parseURL(url);
			const items = (feed.items ?? []).slice(0, limit);

			for (const item of items) {
				allTrends.push({
					title: item.title ?? "Untitled",
					url: item.link,
					source: "rss",
					publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
					tags: item.categories ?? undefined,
				});
			}
		} catch {}
	}

	return allTrends;
}
