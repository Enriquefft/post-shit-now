import { and, eq, sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics, posts, series } from "../core/db/schema.ts";
import type { CreateSeriesInput, SeriesWithAnalytics } from "./types.ts";

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSeries(
	db: HubDb,
	userId: string,
	input: CreateSeriesInput,
) {
	const rows = await db
		.insert(series)
		.values({
			userId,
			hubId: input.hubId ?? null,
			name: input.name,
			description: input.description ?? null,
			platform: input.platform,
			template: input.template,
			cadence: input.cadence,
			cadenceCustomDays: input.cadenceCustomDays ?? null,
			trackingMode: input.trackingMode ?? "auto-increment",
			trackingFormat: input.trackingFormat ?? null,
			episodeCount: 0,
			status: "active",
			pillar: input.pillar ?? null,
		})
		.returning();

	const created = rows[0];
	if (!created) throw new Error("Failed to create series");
	return created;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateSeries(
	db: HubDb,
	seriesId: string,
	updates: Partial<CreateSeriesInput>,
) {
	const setClause: Record<string, unknown> = { updatedAt: new Date() };

	if (updates.name !== undefined) setClause.name = updates.name;
	if (updates.description !== undefined)
		setClause.description = updates.description;
	if (updates.template !== undefined) setClause.template = updates.template;
	if (updates.cadence !== undefined) setClause.cadence = updates.cadence;
	if (updates.cadenceCustomDays !== undefined)
		setClause.cadenceCustomDays = updates.cadenceCustomDays;
	if (updates.trackingMode !== undefined)
		setClause.trackingMode = updates.trackingMode;
	if (updates.trackingFormat !== undefined)
		setClause.trackingFormat = updates.trackingFormat;
	if (updates.pillar !== undefined) setClause.pillar = updates.pillar;
	if (updates.platform !== undefined) setClause.platform = updates.platform;

	const rows = await db
		.update(series)
		.set(setClause)
		.where(eq(series.id, seriesId))
		.returning();

	const updated = rows[0];
	if (!updated) throw new Error(`Series not found: ${seriesId}`);
	return updated;
}

// ─── Lifecycle (pause / resume / retire) ─────────────────────────────────────

export async function pauseSeries(db: HubDb, seriesId: string) {
	const [existing] = await db
		.select()
		.from(series)
		.where(eq(series.id, seriesId))
		.limit(1);
	if (!existing) throw new Error(`Series not found: ${seriesId}`);
	if (existing.status === "paused") throw new Error("Series is already paused");
	if (existing.status === "retired")
		throw new Error("Cannot pause a retired series");

	const rows = await db
		.update(series)
		.set({ status: "paused", updatedAt: new Date() })
		.where(eq(series.id, seriesId))
		.returning();
	return rows[0]!;
}

export async function resumeSeries(db: HubDb, seriesId: string) {
	const [existing] = await db
		.select()
		.from(series)
		.where(eq(series.id, seriesId))
		.limit(1);
	if (!existing) throw new Error(`Series not found: ${seriesId}`);
	if (existing.status !== "paused")
		throw new Error("Can only resume a paused series");

	const rows = await db
		.update(series)
		.set({ status: "active", updatedAt: new Date() })
		.where(eq(series.id, seriesId))
		.returning();
	return rows[0]!;
}

export async function retireSeries(db: HubDb, seriesId: string) {
	const [existing] = await db
		.select()
		.from(series)
		.where(eq(series.id, seriesId))
		.limit(1);
	if (!existing) throw new Error(`Series not found: ${seriesId}`);
	if (existing.status === "retired")
		throw new Error("Series is already retired");

	const rows = await db
		.update(series)
		.set({ status: "retired", updatedAt: new Date() })
		.where(eq(series.id, seriesId))
		.returning();
	return rows[0]!;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getSeries(db: HubDb, seriesId: string) {
	const [row] = await db
		.select()
		.from(series)
		.where(eq(series.id, seriesId))
		.limit(1);
	if (!row) throw new Error(`Series not found: ${seriesId}`);
	return row;
}

export async function listSeries(
	db: HubDb,
	userId: string,
	opts?: { status?: string; platform?: string; hubId?: string },
) {
	const conditions = [eq(series.userId, userId)];

	// Default: active only (unless status explicitly passed)
	const status = opts?.status ?? "active";
	conditions.push(eq(series.status, status));

	if (opts?.platform) {
		conditions.push(eq(series.platform, opts.platform));
	}
	if (opts?.hubId) {
		conditions.push(eq(series.hubId, opts.hubId));
	}

	return db.select().from(series).where(and(...conditions));
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getSeriesAnalytics(
	db: HubDb,
	seriesId: string,
): Promise<SeriesWithAnalytics> {
	// Get the series itself
	const seriesRow = await getSeries(db, seriesId);

	// Query posts linked to this series and their metrics
	const metricsRows = await db
		.select({
			engagementScore: postMetrics.engagementScore,
			publishedAt: posts.publishedAt,
		})
		.from(posts)
		.innerJoin(postMetrics, eq(posts.id, postMetrics.postId))
		.where(eq(posts.seriesId, seriesId));

	const totalEpisodes = metricsRows.length;
	const avgEngagement =
		totalEpisodes > 0
			? Math.round(
					metricsRows.reduce((sum, r) => sum + r.engagementScore, 0) /
						totalEpisodes,
				)
			: 0;

	// Find latest episode date
	const dates = metricsRows
		.map((r) => r.publishedAt)
		.filter((d): d is Date => d !== null);
	const lastEpisodeDate =
		dates.length > 0
			? new Date(Math.max(...dates.map((d) => d.getTime())))
			: undefined;

	return {
		...seriesRow,
		totalEpisodes,
		avgEngagement,
		lastEpisodeDate,
	};
}
