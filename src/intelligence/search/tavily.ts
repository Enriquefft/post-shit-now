import { z } from "zod/v4";
import { getApiKey } from "../../core/db/api-keys";
import type { DbClient } from "../../core/db/connection.ts";
import type { SearchResult } from "../types.ts";

/**
 * Search via Tavily's search API.
 * POST to /search with query, searchDepth "basic", maxResults 5.
 * Uses getApiKey() to retrieve hub-scoped key. Throws error if key not found.
 */
export async function searchTavily(
	query: string,
	db: DbClient,
	hubId: string,
): Promise<SearchResult[]> {
	const apiKey = await getApiKey(db, hubId, "tavily");
	if (!apiKey) {
		throw new Error("API key lookup returned empty value");
	}

	const response = await fetch("https://api.tavily.com/search", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			api_key: apiKey,
			query,
			search_depth: "basic",
			max_results: 5,
		}),
	});

	if (!response.ok) {
		throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
	}

	const tavilyResponseSchema = z.object({
		results: z
			.array(
				z.object({
					title: z.string().optional(),
					url: z.string(),
					content: z.string().optional(),
					score: z.number().optional(),
				}),
			)
			.optional(),
	});
	const json = tavilyResponseSchema.parse(await response.json());

	return (json.results ?? []).map((r) => ({
		title: r.title ?? query,
		url: r.url,
		snippet: r.content?.slice(0, 300) ?? "",
		source: "tavily" as const,
	}));
}
