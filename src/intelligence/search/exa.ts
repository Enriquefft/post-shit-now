import type { SearchResult } from "../types.ts";

/**
 * Search via Exa AI's neural search.
 * POST to /search endpoint with query, type "auto", numResults 5.
 * Requires EXA_API_KEY env var. Returns empty array if missing.
 */
export async function searchExa(query: string): Promise<SearchResult[]> {
	const apiKey = process.env.EXA_API_KEY;
	if (!apiKey) return [];

	const response = await fetch("https://api.exa.ai/search", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query,
			type: "auto",
			numResults: 5,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Exa API error: ${response.status} ${response.statusText}`,
		);
	}

	const json = (await response.json()) as {
		results?: Array<{
			title?: string;
			url: string;
			text?: string;
			publishedDate?: string;
		}>;
	};

	return (json.results ?? []).map((r) => ({
		title: r.title ?? query,
		url: r.url,
		snippet: r.text?.slice(0, 300) ?? "",
		source: "exa" as const,
	}));
}
