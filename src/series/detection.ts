import { and, eq, gte } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics } from "../core/db/schema.ts";

// ─── Pattern Detection ───────────────────────────────────────────────────────

export interface SeriesCandidate {
	pillar: string;
	format: string;
	count: number;
	recentTopics: string[];
}

/**
 * Detect recurring content patterns that suggest formalizing as a series.
 * Queries postMetrics for the last 30 days, groups by (postPillar, postFormat).
 * Flags combinations appearing 3+ times as potential series candidates.
 *
 * Feeds SERIES-06: "System suggests formalizing as series when it detects
 * recurring post patterns."
 */
export async function detectSeriesPatterns(db: HubDb, userId: string): Promise<SeriesCandidate[]> {
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	// Get metrics for last 30 days with pillar and format
	const rows = await db
		.select({
			postPillar: postMetrics.postPillar,
			postFormat: postMetrics.postFormat,
			postTopic: postMetrics.postTopic,
		})
		.from(postMetrics)
		.where(and(eq(postMetrics.userId, userId), gte(postMetrics.createdAt, thirtyDaysAgo)));

	// Group by (pillar, format) combination
	const combos = new Map<string, { pillar: string; format: string; topics: string[] }>();

	for (const row of rows) {
		if (!row.postPillar || !row.postFormat) continue;

		const key = `${row.postPillar}::${row.postFormat}`;
		const existing = combos.get(key);
		if (existing) {
			if (row.postTopic && !existing.topics.includes(row.postTopic)) {
				existing.topics.push(row.postTopic);
			}
		} else {
			combos.set(key, {
				pillar: row.postPillar,
				format: row.postFormat,
				topics: row.postTopic ? [row.postTopic] : [],
			});
		}
	}

	// Count occurrences per combo from the raw rows
	const counts = new Map<string, number>();
	for (const row of rows) {
		if (!row.postPillar || !row.postFormat) continue;
		const key = `${row.postPillar}::${row.postFormat}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	// Filter to 3+ occurrences
	const candidates: SeriesCandidate[] = [];
	for (const [key, data] of combos) {
		const count = counts.get(key) ?? 0;
		if (count >= 3) {
			candidates.push({
				pillar: data.pillar,
				format: data.format,
				count,
				recentTopics: data.topics.slice(0, 5),
			});
		}
	}

	// Sort by count descending
	candidates.sort((a, b) => b.count - a.count);

	return candidates;
}
