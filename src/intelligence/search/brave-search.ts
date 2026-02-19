import type { SearchResult } from "../types.ts";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getApiKey } from "../../core/db/api-keys";

/**
 * Search via Brave Search API.
 * GET to /res/v1/web/search with query params and X-Subscription-Token header.
 * Uses getApiKey() to retrieve hub-scoped key. Throws error if key not found.
 */
export async function searchBrave(
	query: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<SearchResult[]> {
	const apiKey = await getApiKey(db, hubId, "brave");
	if (!apiKey) {
		throw new Error("API key lookup returned empty value");
	}

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
