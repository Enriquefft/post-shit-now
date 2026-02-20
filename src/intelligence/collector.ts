import { readFile } from "node:fs/promises";
import { XClient } from "../platforms/x/client.ts";
import { fetchGoogleTrends } from "./sources/google-trends.ts";
import { fetchHNTopStories } from "./sources/hackernews.ts";
import { fetchProductHuntFeatured } from "./sources/producthunt.ts";
import { fetchRedditTrending } from "./sources/reddit.ts";
import { fetchRSSFeeds } from "./sources/rss.ts";
import { fetchXTrending } from "./sources/x-trending.ts";
import type { Pillar, RawTrend } from "./types.ts";

// ---- Strategy YAML helpers ------------------------------------------------

interface StrategyYaml {
	pillars?: Array<{ name: string; weight: number }>;
	customRssFeeds?: string[];
}

async function loadStrategy(strategyPath = "content/strategy.yaml"): Promise<StrategyYaml | null> {
	try {
		const raw = await readFile(strategyPath, "utf-8");
		// Lightweight YAML parse — strategy files are simple key-value
		// We only need customRssFeeds, which is a string array
		const feeds: string[] = [];
		let inFeeds = false;
		for (const line of raw.split("\n")) {
			if (line.trim().startsWith("customRssFeeds:")) {
				inFeeds = true;
				continue;
			}
			if (inFeeds) {
				const match = line.match(/^\s+-\s+(.+)/);
				if (match?.[1]) {
					feeds.push(match[1].trim().replace(/^["']|["']$/g, ""));
				} else {
					inFeeds = false;
				}
			}
		}
		return { customRssFeeds: feeds.length > 0 ? feeds : undefined };
	} catch {
		return null;
	}
}

// ---- Collector Results ----------------------------------------------------

export interface CollectResult {
	trends: RawTrend[];
	errors: Array<{ source: string; error: string }>;
}

// ---- Main Collector -------------------------------------------------------

/**
 * Orchestrate all source adapters with BYOK graceful degradation.
 * Always calls HN and Google Trends (no auth needed).
 * Conditionally calls Reddit, Product Hunt, RSS, X based on available credentials.
 */
export async function collectTrends(
	_pillars: Pillar[],
	options?: { strategyPath?: string; xAccessToken?: string },
): Promise<CollectResult> {
	const trends: RawTrend[] = [];
	const errors: Array<{ source: string; error: string }> = [];

	// Helper to safely run a source adapter
	const collect = async (name: string, fn: () => Promise<RawTrend[]>): Promise<void> => {
		try {
			const result = await fn();
			trends.push(...result);
		} catch (err) {
			errors.push({
				source: name,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	};

	// Always available (no auth)
	const tasks: Promise<void>[] = [
		collect("hackernews", () => fetchHNTopStories(30)),
		collect("google-trends", () => fetchGoogleTrends()),
	];

	// BYOK: Reddit (requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET)
	if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
		tasks.push(
			collect("reddit", () => fetchRedditTrending(["technology", "programming", "startups"], 10)),
		);
	}

	// BYOK: Product Hunt (requires PRODUCTHUNT_TOKEN)
	if (process.env.PRODUCTHUNT_TOKEN) {
		tasks.push(collect("producthunt", () => fetchProductHuntFeatured(10)));
	}

	// RSS feeds from strategy.yaml
	const strategy = await loadStrategy(options?.strategyPath);
	if (strategy?.customRssFeeds && strategy.customRssFeeds.length > 0) {
		const feeds = strategy.customRssFeeds;
		tasks.push(collect("rss", () => fetchRSSFeeds(feeds, 5)));
	}

	// BYOK: X trending (requires stored access token)
	const xToken = options?.xAccessToken;
	if (xToken || process.env.DATABASE_URL) {
		// If an explicit token is provided, use it directly
		// Otherwise, the caller should provide it from stored credentials
		if (xToken) {
			const xClient = new XClient(xToken);
			tasks.push(collect("x", () => fetchXTrending(xClient)));
		}
	}

	await Promise.allSettled(tasks);

	return { trends, errors };
}

/**
 * Lighter collector for breaking news detection (INTEL-02 poller).
 * Only fetches HN top 10 and X trending for fast execution.
 */
export async function collectBreakingNews(options?: {
	xAccessToken?: string;
}): Promise<CollectResult> {
	const trends: RawTrend[] = [];
	const errors: Array<{ source: string; error: string }> = [];

	const collect = async (name: string, fn: () => Promise<RawTrend[]>): Promise<void> => {
		try {
			const result = await fn();
			trends.push(...result);
		} catch (err) {
			errors.push({
				source: name,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	};

	const tasks: Promise<void>[] = [collect("hackernews", () => fetchHNTopStories(10))];

	if (options?.xAccessToken) {
		const xClient = new XClient(options.xAccessToken);
		tasks.push(collect("x", () => fetchXTrending(xClient)));
	}

	await Promise.allSettled(tasks);

	return { trends, errors };
}
