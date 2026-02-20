import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { SearchResult } from "../types.ts";
import { searchBrave } from "./brave-search.ts";
import { searchExa } from "./exa.ts";
import { searchPerplexity } from "./perplexity.ts";
import { searchTavily } from "./tavily.ts";

/**
 * Unified search aggregator across all available providers.
 * Calls all providers in parallel via Promise.allSettled.
 * Deduplicates results by URL. Missing API keys cause providers to throw errors.
 */
export async function searchAll(
	query: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<SearchResult[]> {
	const results = await Promise.allSettled([
		searchPerplexity(query, db, hubId),
		searchExa(query, db, hubId),
		searchTavily(query, db, hubId),
		searchBrave(query, db, hubId),
	]);

	const allResults: SearchResult[] = [];
	const seenUrls = new Set<string>();

	for (const result of results) {
		if (result.status === "fulfilled") {
			for (const item of result.value) {
				// Deduplicate by URL (skip empty URLs from Perplexity fallback)
				if (item.url && seenUrls.has(item.url)) continue;
				if (item.url) seenUrls.add(item.url);
				allResults.push(item);
			}
		}
		// Rejected promises are silently dropped -- BYOK degradation
	}

	return allResults;
}

export { searchBrave } from "./brave-search.ts";
export { searchExa } from "./exa.ts";
// Re-export individual clients for direct use
export { searchPerplexity } from "./perplexity.ts";
export { searchTavily } from "./tavily.ts";
