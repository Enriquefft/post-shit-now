import Parser from "rss-parser";
import type { RawTrend } from "../types.ts";

const parser = new Parser();

/**
 * Fetch trending searches from Google Trends RSS feed.
 * No authentication required -- always available.
 */
export async function fetchGoogleTrends(): Promise<RawTrend[]> {
	const feed = await parser.parseURL("https://trends.google.com/trending/rss?geo=US");

	return (feed.items ?? []).map((item) => ({
		title: item.title ?? "Unknown trend",
		url: item.link,
		source: "google-trends" as const,
		publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
	}));
}
