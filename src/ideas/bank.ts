import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { ideas } from "../core/db/schema.ts";
import type { Idea, IdeaStatus, Urgency } from "./types.ts";

// ─── Row to Idea Mapper ────────────────────────────────────────────────────

function rowToIdea(row: typeof ideas.$inferSelect): Idea {
	return {
		id: row.id,
		userId: row.userId,
		hubId: row.hubId,
		title: row.title,
		notes: row.notes,
		tags: row.tags,
		status: row.status as IdeaStatus,
		urgency: row.urgency as Urgency,
		pillar: row.pillar,
		platform: row.platform,
		format: row.format,
		claimedBy: row.claimedBy,
		killReason: row.killReason,
		expiresAt: row.expiresAt,
		lastTouchedAt: row.lastTouchedAt,
		sourceType: row.sourceType as Idea["sourceType"],
		sourceId: row.sourceId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

// ─── Get Ready Ideas ────────────────────────────────────────────────────────

export async function getReadyIdeas(
	db: HubDb,
	userId: string,
	opts?: { pillar?: string; platform?: string; limit?: number },
) {
	const conditions = [eq(ideas.userId, userId), eq(ideas.status, "ready")];

	if (opts?.pillar) conditions.push(eq(ideas.pillar, opts.pillar));
	if (opts?.platform) conditions.push(eq(ideas.platform, opts.platform));

	const rows = await db
		.select()
		.from(ideas)
		.where(and(...conditions))
		.orderBy(desc(ideas.lastTouchedAt))
		.limit(opts?.limit ?? 10);

	return rows.map(rowToIdea);
}

// ─── Search Ideas ───────────────────────────────────────────────────────────

export async function searchIdeas(
	db: HubDb,
	userId: string,
	query: string,
	opts?: { status?: IdeaStatus; limit?: number },
): Promise<Idea[]> {
	const pattern = `%${query}%`;
	const conditions = [
		eq(ideas.userId, userId),
		or(ilike(ideas.title, pattern), ilike(ideas.notes, pattern)),
	];

	if (opts?.status) conditions.push(eq(ideas.status, opts.status));

	const rows = await db
		.select()
		.from(ideas)
		.where(and(...conditions))
		.orderBy(desc(ideas.lastTouchedAt))
		.limit(opts?.limit ?? 20);

	return rows.map(rowToIdea);
}

// ─── Get Ideas by Status ────────────────────────────────────────────────────

export async function getIdeasByStatus(
	db: HubDb,
	userId: string,
	status: IdeaStatus,
	opts?: { limit?: number },
): Promise<Idea[]> {
	const rows = await db
		.select()
		.from(ideas)
		.where(and(eq(ideas.userId, userId), eq(ideas.status, status)))
		.orderBy(desc(ideas.lastTouchedAt))
		.limit(opts?.limit ?? 50);

	return rows.map(rowToIdea);
}

// ─── Get Idea Stats ─────────────────────────────────────────────────────────

export async function getIdeaStats(db: HubDb, userId: string): Promise<Record<IdeaStatus, number>> {
	const rows = await db
		.select({
			status: ideas.status,
			count: sql<number>`count(*)::int`,
		})
		.from(ideas)
		.where(eq(ideas.userId, userId))
		.groupBy(ideas.status);

	const stats: Record<IdeaStatus, number> = {
		spark: 0,
		seed: 0,
		ready: 0,
		claimed: 0,
		developed: 0,
		used: 0,
		killed: 0,
	};

	for (const row of rows) {
		const status = row.status as IdeaStatus;
		if (status in stats) {
			stats[status] = row.count;
		}
	}

	return stats;
}

// ─── List Ideas ─────────────────────────────────────────────────────────────

export async function listIdeas(
	db: HubDb,
	userId: string,
	opts?: {
		status?: IdeaStatus;
		urgency?: Urgency;
		pillar?: string;
		limit?: number;
		offset?: number;
	},
): Promise<Idea[]> {
	const conditions = [eq(ideas.userId, userId)];

	if (opts?.status) conditions.push(eq(ideas.status, opts.status));
	if (opts?.urgency) conditions.push(eq(ideas.urgency, opts.urgency));
	if (opts?.pillar) conditions.push(eq(ideas.pillar, opts.pillar));

	const rows = await db
		.select()
		.from(ideas)
		.where(and(...conditions))
		.orderBy(desc(ideas.createdAt))
		.limit(opts?.limit ?? 50)
		.offset(opts?.offset ?? 0);

	return rows.map(rowToIdea);
}

// ─── Get Killed Ideas Since ─────────────────────────────────────────────────

export async function getKilledIdeasSince(db: HubDb, userId: string, since: Date): Promise<Idea[]> {
	const rows = await db
		.select()
		.from(ideas)
		.where(
			and(eq(ideas.userId, userId), eq(ideas.status, "killed"), gt(ideas.lastTouchedAt, since)),
		)
		.orderBy(desc(ideas.lastTouchedAt));

	return rows.map(rowToIdea);
}
