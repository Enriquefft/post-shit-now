import type { SearchResult } from "../types.ts";

/**
 * Search via Tavily's search API.
 * POST to /search with query, searchDepth "basic", maxResults 5.
 * Requires TAVILY_API_KEY env var. Returns empty array if missing.
 */
export async function searchTavily(query: string): Promise<SearchResult[]> {
	const apiKey = process.env.TAVILY_API_KEY;
	if (!apiKey) return [];

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
		throw new Error(
			`Tavily API error: ${response.status} ${response.statusText}`,
		);
	}

	const json = (await response.json()) as {
		results?: Array<{
			title?: string;
			url: string;
			content?: string;
			score?: number;
		}>;
	};

	return (json.results ?? []).map((r) => ({
		title: r.title ?? query,
		url: r.url,
		snippet: r.content?.slice(0, 300) ?? "",
		source: "tavily" as const,
	}));
}
