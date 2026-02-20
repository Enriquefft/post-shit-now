import { eq } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { SeriesCadence, series } from "../core/db/schema.ts";
import type { Series } from "./types.ts";
import { CADENCE_DAYS } from "./types.ts";

// ─── Due Episodes ────────────────────────────────────────────────────────────

/**
 * Get active series with episodes that are due (nextDueDate <= asOfDate).
 * Per RESEARCH.md pitfall 4: calculates from lastPublishedAt, not creation date.
 * Falls back to createdAt only when no episode has been published yet.
 */
export async function getDueEpisodes(db: HubDb, userId: string, asOfDate?: Date) {
	const now = asOfDate ?? new Date();

	const activeSeries = await db.select().from(series).where(eq(series.status, "active"));

	// Filter to user's series
	const userSeries = activeSeries.filter((s) => s.userId === userId);

	const dueEpisodes: Array<{
		series: (typeof userSeries)[number];
		nextDueDate: Date;
		nextEpisodeLabel: string | undefined;
	}> = [];

	for (const s of userSeries) {
		const cadenceDays = getCadenceDays(s.cadence as SeriesCadence, s.cadenceCustomDays);
		// Use lastPublishedAt if available, otherwise createdAt
		const baseDate = s.lastPublishedAt ?? s.createdAt;
		const nextDueDate = new Date(baseDate.getTime() + cadenceDays * 24 * 60 * 60 * 1000);

		if (nextDueDate <= now) {
			dueEpisodes.push({
				series: s,
				nextDueDate,
				nextEpisodeLabel: getNextEpisodeLabel(s as unknown as Series),
			});
		}
	}

	return dueEpisodes;
}

// ─── Episode Label ───────────────────────────────────────────────────────────

/**
 * Get the next episode label based on tracking mode.
 * - "none": no label
 * - "auto-increment": "#N"
 * - "custom": parse format string with {e} for episode, {s} for season
 */
export function getNextEpisodeLabel(s: Series): string | undefined {
	const nextEp = s.episodeCount + 1;

	switch (s.trackingMode) {
		case "none":
			return undefined;

		case "auto-increment":
			return `#${nextEp}`;

		case "custom": {
			if (!s.trackingFormat) return `#${nextEp}`;
			let label = s.trackingFormat.replace("{e}", String(nextEp));
			// Season tracking: stored in template metadata if present
			if (label.includes("{s}")) {
				const template = s.template as Record<string, unknown> | null;
				const season = (template?.season as number) ?? 1;
				label = label.replace("{s}", String(season));
			}
			return label;
		}

		default:
			return `#${nextEp}`;
	}
}

// ─── Record Published ────────────────────────────────────────────────────────

/**
 * Record that a series episode was published.
 * Increments episodeCount, sets lastPublishedAt to now.
 */
export async function recordEpisodePublished(db: HubDb, seriesId: string) {
	const [existing] = await db.select().from(series).where(eq(series.id, seriesId)).limit(1);
	if (!existing) throw new Error(`Series not found: ${seriesId}`);

	const rows = await db
		.update(series)
		.set({
			episodeCount: existing.episodeCount + 1,
			lastPublishedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(series.id, seriesId))
		.returning();

	const updatedSeries = rows[0];
	if (!updatedSeries) {
		throw new Error(`Series with id ${seriesId} not found`);
	}
	return updatedSeries;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCadenceDays(cadence: SeriesCadence, customDays: number | null): number {
	if (cadence === SeriesCadence.custom) {
		if (!customDays) throw new Error("Custom cadence requires cadenceCustomDays");
		return customDays;
	}
	const days = CADENCE_DAYS[cadence];
	if (!days) {
		throw new Error(`Unknown cadence: ${cadence}`);
	}
	return days;
}
