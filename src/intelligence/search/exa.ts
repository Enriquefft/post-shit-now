import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getApiKey } from "../../core/db/api-keys";
import type { SearchResult } from "../types.ts";

/**
 * Search via Exa AI's neural search.
 * POST to /search endpoint with query, type "auto", numResults 5.
 * Uses getApiKey() to retrieve hub-scoped key. Throws error if key not found.
 */
export async function searchExa(
	query: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<SearchResult[]> {
	const apiKey = await getApiKey(db, hubId, "exa");
	if (!apiKey) {
		throw new Error("API key lookup returned empty value");
	}

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
		throw new Error(`Exa API error: ${response.status} ${response.statusText}`);
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
