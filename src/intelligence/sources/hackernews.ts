import { z } from "zod/v4";
import type { RawTrend } from "../types.ts";

/**
 * Fetch top stories from Hacker News Firebase API.
 * No authentication required -- always available.
 */
export async function fetchHNTopStories(limit = 30): Promise<RawTrend[]> {
	const idsResponse = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
	if (!idsResponse.ok) {
		throw new Error(`HN topstories failed: ${idsResponse.status}`);
	}

	const ids = z.array(z.number()).parse(await idsResponse.json());
	const topIds = ids.slice(0, limit);

	const hnItemSchema = z.object({
		id: z.number(),
		type: z.string(),
		title: z.string(),
		url: z.string().nullable().optional(),
		score: z.number(),
		time: z.number(),
	});

	const stories = await Promise.all(
		topIds.map(async (id) => {
			const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
			if (!res.ok) return null;
			const result = hnItemSchema.safeParse(await res.json());
			return result.success ? result.data : null;
		}),
	);

	return stories
		.filter((s): s is NonNullable<typeof s> => s != null && s.type === "story")
		.map((s) => ({
			title: s.title,
			url: s.url ?? undefined,
			source: "hackernews" as const,
			sourceScore: s.score,
			publishedAt: new Date(s.time * 1000),
		}));
}
