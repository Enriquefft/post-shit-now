import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod/v4";
import type { InstagramClient } from "./client.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HashtagPoolEntry {
	tag: string;
	id: string;
	mediaCount: number;
	relevantPillar: string;
}

export interface HashtagPoolCache {
	lastRefreshed: string; // ISO date
	searchesUsedThisWeek: number;
	weekStartDate: string; // ISO date
	hashtags: HashtagPoolEntry[];
}

const CACHE_PATH = "content/cache/hashtag-pool.json";
const MAX_SEARCHES_PER_WEEK = 30;

// ─── Cache Management ───────────────────────────────────────────────────────

/**
 * Load the hashtag pool from local cache file.
 * Returns null if cache doesn't exist or is invalid.
 */
function loadCache(projectRoot = "."): HashtagPoolCache | null {
	const cachePath = path.join(projectRoot, CACHE_PATH);
	try {
		if (!fs.existsSync(cachePath)) return null;
		const raw = fs.readFileSync(cachePath, "utf-8");
		const HashtagPoolCacheSchema = z.object({
			lastRefreshed: z.string(),
			searchesUsedThisWeek: z.number(),
			weekStartDate: z.string(),
			hashtags: z.array(
				z.object({
					tag: z.string(),
					id: z.string(),
					mediaCount: z.number(),
					relevantPillar: z.string(),
				}),
			),
		});
		return HashtagPoolCacheSchema.parse(JSON.parse(raw));
	} catch {
		return null;
	}
}

/**
 * Save the hashtag pool cache to local file.
 */
function saveCache(cache: HashtagPoolCache, projectRoot = "."): void {
	const cachePath = path.join(projectRoot, CACHE_PATH);
	const cacheDir = path.dirname(cachePath);
	if (!fs.existsSync(cacheDir)) {
		fs.mkdirSync(cacheDir, { recursive: true });
	}
	fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

/**
 * Check if the current week window has reset (7-day rolling window).
 * Returns true if we're in a new week and searches should reset.
 */
function isNewWeekWindow(weekStartDate: string): boolean {
	const start = new Date(weekStartDate);
	const now = new Date();
	const daysSinceStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
	return daysSinceStart >= 7;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the cached hashtag pool.
 * Returns existing pool from local cache file (content/cache/hashtag-pool.json).
 * If no cache exists, returns an empty pool.
 */
export function getHashtagPool(projectRoot = "."): HashtagPoolCache {
	const cache = loadCache(projectRoot);
	if (cache) return cache;

	return {
		lastRefreshed: new Date().toISOString(),
		searchesUsedThisWeek: 0,
		weekStartDate: new Date().toISOString(),
		hashtags: [],
	};
}

/**
 * Refresh the hashtag pool by searching Instagram's Hashtag API for each pillar keyword.
 * Respects the 30-search/week budget by tracking usage in the cache.
 *
 * @param client - Instagram API client
 * @param pillars - Content pillar keywords to search for
 * @param maxSearches - Max searches per refresh call (default 10, to stay within budget)
 * @param projectRoot - Project root for cache file location
 */
export async function refreshHashtagPool(
	client: InstagramClient,
	pillars: string[],
	maxSearches = 10,
	projectRoot = ".",
): Promise<HashtagPoolCache> {
	const cache = loadCache(projectRoot) ?? {
		lastRefreshed: new Date().toISOString(),
		searchesUsedThisWeek: 0,
		weekStartDate: new Date().toISOString(),
		hashtags: [],
	};

	// Reset weekly counter if in a new 7-day window
	if (isNewWeekWindow(cache.weekStartDate)) {
		cache.searchesUsedThisWeek = 0;
		cache.weekStartDate = new Date().toISOString();
	}

	// Check budget
	if (cache.searchesUsedThisWeek >= MAX_SEARCHES_PER_WEEK) {
		// Budget exhausted — return existing cache without searching
		return cache;
	}

	const remainingBudget = MAX_SEARCHES_PER_WEEK - cache.searchesUsedThisWeek;
	const searchLimit = Math.min(maxSearches, remainingBudget, pillars.length);

	// Search for each pillar (up to budget limit)
	const existingTags = new Set(cache.hashtags.map((h) => h.tag));

	for (let i = 0; i < searchLimit; i++) {
		const pillar = pillars[i];
		if (!pillar) continue;

		try {
			const result = await client.searchHashtags(pillar);
			cache.searchesUsedThisWeek++;

			// Add new hashtags to pool
			for (const hashtag of result.data) {
				const tag = pillar.toLowerCase().replace(/\s+/g, "");
				if (!existingTags.has(tag)) {
					cache.hashtags.push({
						tag,
						id: hashtag.id,
						mediaCount: 0, // Media count not returned by search endpoint
						relevantPillar: pillar,
					});
					existingTags.add(tag);
				}
			}
		} catch {
			// Individual search failure — continue with next pillar
		}
	}

	cache.lastRefreshed = new Date().toISOString();
	saveCache(cache, projectRoot);

	return cache;
}

/**
 * Pick hashtags for a post from the cached pool.
 * Selects a mix of hashtags relevant to different pillars.
 *
 * @param pool - Array of hashtag pool entries
 * @param count - Number of hashtags to pick (default 15, Instagram allows 30 per post)
 */
export function pickHashtags(pool: HashtagPoolEntry[], count = 15): string[] {
	if (pool.length === 0) return [];

	// Shuffle pool for variety
	const shuffled = [...pool].sort(() => Math.random() - 0.5);

	// Pick up to count hashtags
	const selected = shuffled.slice(0, Math.min(count, pool.length));
	return selected.map((h) => `#${h.tag}`);
}
