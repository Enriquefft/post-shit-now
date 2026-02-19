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

	const ids = (await idsResponse.json()) as number[];
	const topIds = ids.slice(0, limit);

	const stories = await Promise.all(
		topIds.map(async (id) => {
			const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
			if (!res.ok) return null;
			return res.json() as Promise<{
				id: number;
				type: string;
				title: string;
				url?: string;
				score: number;
				time: number;
			}>;
		}),
	);

	return stories
		.filter((s): s is NonNullable<typeof s> => s != null && s.type === "story")
		.map((s) => ({
			title: s.title,
			url: s.url,
			source: "hackernews" as const,
			sourceScore: s.score,
			publishedAt: new Date(s.time * 1000),
		}));
}
