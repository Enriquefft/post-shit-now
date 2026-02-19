import { and, eq, gt } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { type EditPattern, editHistory, postMetrics, preferenceModel } from "../core/db/schema.ts";
import { getKilledIdeasSince } from "../ideas/bank.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KilledIdeaPatterns {
	rejectedPillars: Record<string, number>;
	commonReasons: string[];
	recentKills: number;
}

export interface WeeklyUpdateSummary {
	formatsUpdated: boolean;
	pillarsUpdated: boolean;
	timesUpdated: boolean;
	editPatternsUpdated: boolean;
	killedIdeasProcessed: number;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function getPreferenceModel(db: HubDb, userId: string) {
	const rows = await db
		.select()
		.from(preferenceModel)
		.where(eq(preferenceModel.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}

export async function createPreferenceModel(db: HubDb, userId: string) {
	const rows = await db
		.insert(preferenceModel)
		.values({
			userId,
			topFormats: [],
			topPillars: [],
			bestPostingTimes: [],
			hookPatterns: [],
			commonEditPatterns: [],
			avgEditRatio: 0,
			fatiguedTopics: [],
			lockedSettings: [],
			followerHistory: [],
		})
		.returning();

	return rows[0] ?? null;
}

export async function updatePreferenceModel(
	db: HubDb,
	userId: string,
	updates: Partial<{
		topFormats: Array<{ format: string; avgScore: number }>;
		topPillars: Array<{ pillar: string; avgScore: number }>;
		bestPostingTimes: Array<{
			hour: number;
			dayOfWeek: number;
			avgScore: number;
		}>;
		hookPatterns: string[];
		commonEditPatterns: Array<{ type: string; frequency: number }>;
		avgEditRatio: number;
		fatiguedTopics: Array<{
			topic: string;
			cooldownUntil: string;
			lastScores: number[];
		}>;
		lockedSettings: Array<{
			field: string;
			value: unknown;
			lockedAt: string;
		}>;
		killedIdeaPatterns: {
			rejectedPillars: Record<string, number>;
			commonReasons: string[];
			recentKills: number;
		};
		followerHistory: Array<{ count: number; date: string }>;
	}>,
) {
	const [row] = await db
		.update(preferenceModel)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(preferenceModel.userId, userId))
		.returning();

	return row;
}

// ─── Weekly Update ──────────────────────────────────────────────────────────

const MIN_POSTS_FOR_DIMENSION = 3;

export async function computeWeeklyUpdate(db: HubDb, userId: string): Promise<WeeklyUpdateSummary> {
	const summary: WeeklyUpdateSummary = {
		formatsUpdated: false,
		pillarsUpdated: false,
		timesUpdated: false,
		editPatternsUpdated: false,
		killedIdeasProcessed: 0,
	};

	// Ensure preference model exists
	let model = await getPreferenceModel(db, userId);
	if (!model) {
		model = await createPreferenceModel(db, userId);
		if (!model) {
			return summary;
		}
	}

	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	// ── 1. Aggregate engagement signals ──────────────────────────────────

	const metrics = await db
		.select()
		.from(postMetrics)
		.where(and(eq(postMetrics.userId, userId), gt(postMetrics.collectedAt, sevenDaysAgo)));

	if (metrics.length > 0) {
		// Group by format
		const byFormat = new Map<string, number[]>();
		for (const m of metrics) {
			if (m.postFormat) {
				const scores = byFormat.get(m.postFormat) ?? [];
				scores.push(m.engagementScore);
				byFormat.set(m.postFormat, scores);
			}
		}

		const topFormats: Array<{ format: string; avgScore: number }> = [];
		for (const [format, scores] of byFormat) {
			if (scores.length >= MIN_POSTS_FOR_DIMENSION) {
				const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
				topFormats.push({
					format,
					avgScore: Math.round(avg * 100) / 100,
				});
			}
		}
		if (topFormats.length > 0) {
			topFormats.sort((a, b) => b.avgScore - a.avgScore);
			await updatePreferenceModel(db, userId, { topFormats });
			summary.formatsUpdated = true;
		}

		// Group by pillar
		const byPillar = new Map<string, number[]>();
		for (const m of metrics) {
			if (m.postPillar) {
				const scores = byPillar.get(m.postPillar) ?? [];
				scores.push(m.engagementScore);
				byPillar.set(m.postPillar, scores);
			}
		}

		const topPillars: Array<{ pillar: string; avgScore: number }> = [];
		for (const [pillar, scores] of byPillar) {
			if (scores.length >= MIN_POSTS_FOR_DIMENSION) {
				const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
				topPillars.push({
					pillar,
					avgScore: Math.round(avg * 100) / 100,
				});
			}
		}
		if (topPillars.length > 0) {
			topPillars.sort((a, b) => b.avgScore - a.avgScore);
			await updatePreferenceModel(db, userId, { topPillars });
			summary.pillarsUpdated = true;
		}

		// Group by hour + dayOfWeek of collectedAt (proxy for publish time)
		const byTime = new Map<string, number[]>();
		for (const m of metrics) {
			const date = new Date(m.collectedAt);
			const key = `${date.getUTCHours()}-${date.getUTCDay()}`;
			const scores = byTime.get(key) ?? [];
			scores.push(m.engagementScore);
			byTime.set(key, scores);
		}

		const bestPostingTimes: Array<{
			hour: number;
			dayOfWeek: number;
			avgScore: number;
		}> = [];
		for (const [key, scores] of byTime) {
			if (scores.length >= MIN_POSTS_FOR_DIMENSION) {
				const [hour, dayOfWeek] = key.split("-").map(Number) as [number, number];
				const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
				bestPostingTimes.push({
					hour,
					dayOfWeek,
					avgScore: Math.round(avg * 100) / 100,
				});
			}
		}
		if (bestPostingTimes.length > 0) {
			bestPostingTimes.sort((a, b) => b.avgScore - a.avgScore);
			await updatePreferenceModel(db, userId, { bestPostingTimes });
			summary.timesUpdated = true;
		}
	}

	// ── 2. Aggregate edit signals ────────────────────────────────────────

	const edits = await db
		.select()
		.from(editHistory)
		.where(and(eq(editHistory.userId, userId), gt(editHistory.createdAt, sevenDaysAgo)));

	if (edits.length > 0) {
		// Average edit ratio
		const totalRatio = edits.reduce((sum, e) => sum + e.editRatio, 0);
		const avgEditRatio = Math.round(totalRatio / edits.length);

		// Aggregate edit patterns by type
		const patternCounts = new Map<string, number>();
		for (const edit of edits) {
			const patterns = edit.editPatterns as EditPattern[] | null;
			if (patterns) {
				for (const p of patterns) {
					patternCounts.set(p.type, (patternCounts.get(p.type) ?? 0) + p.count);
				}
			}
		}

		const commonEditPatterns: Array<{ type: string; frequency: number }> = [];
		for (const [type, frequency] of patternCounts) {
			commonEditPatterns.push({ type, frequency });
		}
		commonEditPatterns.sort((a, b) => b.frequency - a.frequency);

		await updatePreferenceModel(db, userId, {
			avgEditRatio,
			commonEditPatterns,
		});
		summary.editPatternsUpdated = true;
	}

	// ── 3. Killed idea feedback ─────────────────────────────────────────

	try {
		const killedIdeas = await getKilledIdeasSince(db, userId, sevenDaysAgo);

		if (killedIdeas.length > 0) {
			// Group by pillar to identify rejected content areas
			const rejectedPillars: Record<string, number> = {};
			for (const idea of killedIdeas) {
				if (idea.pillar) {
					rejectedPillars[idea.pillar] = (rejectedPillars[idea.pillar] ?? 0) + 1;
				}
			}

			// Group by killReason to identify common rejection patterns
			const reasonCounts = new Map<string, number>();
			for (const idea of killedIdeas) {
				if (idea.killReason) {
					reasonCounts.set(
						idea.killReason,
						(reasonCounts.get(idea.killReason) ?? 0) + 1,
					);
				}
			}

			// Sort reasons by frequency and take top entries
			const commonReasons = [...reasonCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([reason]) => reason);

			const killedIdeaPatterns = {
				rejectedPillars,
				commonReasons,
				recentKills: killedIdeas.length,
			};

			await updatePreferenceModel(db, userId, { killedIdeaPatterns });
			summary.killedIdeasProcessed = killedIdeas.length;
		}
	} catch (_err) {
		// Gracefully handle case where ideas table doesn't exist yet
		summary.killedIdeasProcessed = 0;
	}

	return summary;
}
