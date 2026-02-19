import { and, eq, gt, isNotNull, lt, not, inArray, sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { ideas, trends } from "../core/db/schema.ts";
import type { Idea, IdeaStatus } from "./types.ts";
import { STALENESS_DAYS, VALID_TRANSITIONS } from "./types.ts";

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
		urgency: row.urgency as Idea["urgency"],
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

// ─── Transition Idea ────────────────────────────────────────────────────────

export async function transitionIdea(
	db: HubDb,
	ideaId: string,
	newStatus: IdeaStatus,
	opts?: { claimedBy?: string; killReason?: string },
): Promise<Idea> {
	const rows = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
	const existing = rows[0];
	if (!existing) throw new Error(`Idea not found: ${ideaId}`);

	const currentStatus = existing.status as IdeaStatus;
	const allowed = VALID_TRANSITIONS[currentStatus];
	if (!allowed.includes(newStatus)) {
		throw new Error(
			`Invalid transition: ${currentStatus} -> ${newStatus}. Allowed: ${allowed.join(", ") || "none (terminal)"}`,
		);
	}

	if (newStatus === "killed" && !opts?.killReason) {
		throw new Error("killReason is required when transitioning to killed");
	}

	const updates: Record<string, unknown> = {
		status: newStatus,
		lastTouchedAt: new Date(),
		updatedAt: new Date(),
	};

	if (newStatus === "claimed" && opts?.claimedBy) {
		updates.claimedBy = opts.claimedBy;
	}

	if (newStatus === "killed" && opts?.killReason) {
		updates.killReason = opts.killReason;
	}

	// Clear claimedBy when reverting from claimed
	if (currentStatus === "claimed" && newStatus === "ready") {
		updates.claimedBy = null;
	}

	const updated = await db
		.update(ideas)
		.set(updates)
		.where(eq(ideas.id, ideaId))
		.returning();

	const row = updated[0];
	if (!row) throw new Error("Failed to update idea");

	return rowToIdea(row);
}

// ─── Auto-Promote Ideas ────────────────────────────────────────────────────

export async function autoPromoteIdeas(
	db: HubDb,
	userId: string,
): Promise<{ promoted: number }> {
	let promoted = 0;

	// 1. Promote sparks that match high-scoring trends (overallScore > 50)
	const sparks = await db
		.select()
		.from(ideas)
		.where(and(eq(ideas.userId, userId), eq(ideas.status, "spark")));

	if (sparks.length > 0) {
		const trendRows = await db
			.select()
			.from(trends)
			.where(and(eq(trends.userId, userId), gt(trends.overallScore, 50)));

		const trendTitles = trendRows.map((t) => t.title.toLowerCase());

		for (const spark of sparks) {
			const sparkWords = spark.title.toLowerCase().split(/\s+/);
			const matches = sparkWords.some((word) =>
				word.length > 3 && trendTitles.some((title) => title.includes(word)),
			);

			if (matches) {
				await db
					.update(ideas)
					.set({
						status: "seed",
						lastTouchedAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(ideas.id, spark.id));
				promoted++;
			}
		}
	}

	// 2. Promote seeds that have notes added to ready
	const seedsWithNotes = await db
		.select()
		.from(ideas)
		.where(
			and(
				eq(ideas.userId, userId),
				eq(ideas.status, "seed"),
				isNotNull(ideas.notes),
			),
		);

	for (const seed of seedsWithNotes) {
		await db
			.update(ideas)
			.set({
				status: "ready",
				lastTouchedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(ideas.id, seed.id));
		promoted++;
	}

	return { promoted };
}

// ─── Get Stale Ideas ────────────────────────────────────────────────────────

export async function getStaleIdeas(db: HubDb, userId: string): Promise<Idea[]> {
	const now = new Date();
	const staleIdeas: Idea[] = [];

	for (const [status, days] of Object.entries(STALENESS_DAYS)) {
		if (days === undefined) continue;
		const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

		const rows = await db
			.select()
			.from(ideas)
			.where(
				and(
					eq(ideas.userId, userId),
					eq(ideas.status, status),
					lt(ideas.lastTouchedAt, threshold),
				),
			);

		staleIdeas.push(...rows.map(rowToIdea));
	}

	return staleIdeas;
}

// ─── Expire Timely Ideas ────────────────────────────────────────────────────

export async function expireTimelyIdeas(
	db: HubDb,
	userId: string,
): Promise<{ expired: number }> {
	const now = new Date();
	const terminalStatuses: IdeaStatus[] = ["used", "killed"];

	const expiredRows = await db
		.select()
		.from(ideas)
		.where(
			and(
				eq(ideas.userId, userId),
				eq(ideas.urgency, "timely"),
				lt(ideas.expiresAt, now),
				not(inArray(ideas.status, terminalStatuses)),
			),
		);

	for (const row of expiredRows) {
		await db
			.update(ideas)
			.set({
				status: "killed",
				killReason: "expired (timely)",
				lastTouchedAt: now,
				updatedAt: now,
			})
			.where(eq(ideas.id, row.id));
	}

	return { expired: expiredRows.length };
}

// ─── Record Kill Feedback ───────────────────────────────────────────────────

export async function recordKillFeedback(
	db: HubDb,
	ideaId: string,
	killReason: string,
): Promise<void> {
	await db
		.update(ideas)
		.set({
			killReason,
			updatedAt: new Date(),
		})
		.where(eq(ideas.id, ideaId));
}
