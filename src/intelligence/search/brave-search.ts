import type { SearchResult } from "../types.ts";

/**
 * Search via Brave Search API.
 * GET to /res/v1/web/search with query params and X-Subscription-Token header.
 * Requires BRAVE_API_KEY env var. Returns empty array if missing.
 */
export async function searchBrave(query: string): Promise<SearchResult[]> {
	const apiKey = process.env.BRAVE_API_KEY;
	if (!apiKey) return [];

	const params = new URLSearchParams({
		q: query,
		count: "5",
	});

	const response = await fetch(
		`https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
		{
			method: "GET",
			headers: {
				Accept: "application/json",
				"Accept-Encoding": "gzip",
				"X-Subscription-Token": apiKey,
			},
		},
	);

	if (!response.ok) {
		throw new Error(
			`Brave Search API error: ${response.status} ${response.statusText}`,
		);
	}

	const json = (await response.json()) as {
		web?: {
			results?: Array<{
				title?: string;
				url: string;
				description?: string;
			}>;
		};
	};

	return (json.web?.results ?? []).map((r) => ({
		title: r.title ?? query,
		url: r.url,
		snippet: r.description?.slice(0, 300) ?? "",
		source: "brave" as const,
	}));
}
