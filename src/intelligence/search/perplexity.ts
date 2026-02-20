import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getApiKey } from "../../core/db/api-keys";
import type { SearchResult } from "../types.ts";

/**
 * Search via Perplexity AI's sonar model.
 * POST to chat/completions endpoint with query as a user message.
 * Uses getApiKey() to retrieve hub-scoped key. Throws error if key not found.
 */
export async function searchPerplexity(
	query: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<SearchResult[]> {
	const apiKey = await getApiKey(db, hubId, "perplexity");
	if (!apiKey) {
		throw new Error("API key lookup returned empty value");
	}

	const response = await fetch("https://api.perplexity.ai/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "sonar",
			messages: [
				{
					role: "system",
					content: "You are a research assistant. Provide factual search results with source URLs.",
				},
				{ role: "user", content: query },
			],
		}),
	});

	if (!response.ok) {
		throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
	}

	const json = (await response.json()) as {
		choices?: Array<{
			message?: { content?: string };
		}>;
		citations?: string[];
	};

	const content = json.choices?.[0]?.message?.content ?? "";
	const citations = json.citations ?? [];

	// Map citations to SearchResult format
	// Perplexity returns citations as URLs referenced in response
	const results: SearchResult[] = citations.map((url, i) => ({
		title: `Result ${i + 1}`,
		url,
		snippet: content.slice(0, 200),
		source: "perplexity" as const,
	}));

	// If no citations but we got content, return a single result
	if (results.length === 0 && content.length > 0) {
		results.push({
			title: query,
			url: "",
			snippet: content.slice(0, 500),
			source: "perplexity" as const,
		});
	}

	return results;
}
