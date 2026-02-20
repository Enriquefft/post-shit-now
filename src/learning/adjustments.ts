import { readFile, rename, writeFile } from "node:fs/promises";
import { and, eq, gt } from "drizzle-orm";
import { parse, stringify } from "yaml";
import { z } from "zod/v4";
import type { HubDb } from "../core/db/connection.ts";
import { strategyAdjustments } from "../core/db/schema.ts";
import { isSettingLocked, type LockedSetting } from "./locks.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdjustmentType =
	| "pillar_weight"
	| "posting_time"
	| "format_preference"
	| "frequency"
	| "new_pillar"
	| "drop_format";

export interface StrategyAdjustment {
	adjustmentType: AdjustmentType;
	field: string;
	oldValue: unknown;
	newValue: unknown;
	reason: string;
	evidence: string[];
	tier: "auto" | "approval";
}

export interface PreferenceModelData {
	topFormats: Array<{ format: string; avgScore: number }> | null;
	topPillars: Array<{ pillar: string; avgScore: number }> | null;
	bestPostingTimes: Array<{
		hour: number;
		dayOfWeek: number;
		avgScore: number;
	}> | null;
	lockedSettings: LockedSetting[] | null;
}

interface StrategyYaml {
	pillars: Array<{ name: string; weight: number }>;
	posting: {
		frequency: Record<string, number>;
		preferred_times: Record<string, string[]>;
		timezone: string;
	};
	formats: {
		preferences: string[];
	};
	locked: string[];
}

const strategyYamlSchema = z.object({
	pillars: z.array(z.object({ name: z.string(), weight: z.number() })),
	posting: z.object({
		frequency: z.record(z.string(), z.number()),
		preferred_times: z.record(z.string(), z.array(z.string())),
		timezone: z.string(),
	}),
	formats: z.object({
		preferences: z.array(z.string()),
	}),
	locked: z.array(z.string()),
});

// ─── Auto-apply Rules ───────────────────────────────────────────────────────

const AUTO_APPLY_RULES: Record<string, (delta: number) => boolean> = {
	pillar_weight: (delta) => Math.abs(delta) <= 0.05, // +/-5% per cycle
	posting_time: (shift) => Math.abs(shift) <= 2, // +/-2 hours
	format_preference: () => true, // always auto
	frequency: (delta) => Math.abs(delta) <= 1, // +/-1/week
	new_pillar: () => false, // always approval
	drop_format: () => false, // always approval
};

// ─── Speed Limits ───────────────────────────────────────────────────────────

const MIN_POSTS_FOR_ANY_ADJUSTMENT = 5;
const MIN_WEEKS_FOR_PILLAR_WEIGHT = 3;

// ─── Compute Adjustments ────────────────────────────────────────────────────

/**
 * Analyze preference model learnings against current strategy.yaml values.
 * Returns suggested adjustments with tier classification (auto vs approval).
 * Respects locked settings and speed limits.
 */
export function computeAdjustments(
	prefModel: PreferenceModelData,
	currentStrategy: StrategyYaml,
	totalPostCount: number,
	weeksOfData: number,
): StrategyAdjustment[] {
	const adjustments: StrategyAdjustment[] = [];
	const locked = prefModel.lockedSettings;

	if (totalPostCount < MIN_POSTS_FOR_ANY_ADJUSTMENT) {
		return adjustments;
	}

	// ── Pillar weight adjustments ────────────────────────────────────────

	if (
		prefModel.topPillars &&
		prefModel.topPillars.length > 0 &&
		weeksOfData >= MIN_WEEKS_FOR_PILLAR_WEIGHT
	) {
		for (const pillarData of prefModel.topPillars) {
			const currentPillar = currentStrategy.pillars.find((p) => p.name === pillarData.pillar);
			if (!currentPillar) continue;

			const field = `pillars.${pillarData.pillar}.weight`;
			if (isSettingLocked(locked, field)) continue;

			// Suggest increasing weight for top performers, decreasing for bottom
			const avgAcrossPillars =
				prefModel.topPillars.reduce((sum, p) => sum + p.avgScore, 0) / prefModel.topPillars.length;

			if (avgAcrossPillars === 0) continue;

			const performanceRatio = pillarData.avgScore / avgAcrossPillars;
			let suggestedDelta = 0;

			if (performanceRatio > 1.2) {
				suggestedDelta = 0.05; // Boost by 5%
			} else if (performanceRatio < 0.8) {
				suggestedDelta = -0.05; // Reduce by 5%
			}

			if (suggestedDelta !== 0) {
				const newWeight = Math.max(0, Math.min(1, currentPillar.weight + suggestedDelta));
				const delta = newWeight - currentPillar.weight;
				const rule = AUTO_APPLY_RULES.pillar_weight;

				adjustments.push({
					adjustmentType: "pillar_weight",
					field,
					oldValue: currentPillar.weight,
					newValue: newWeight,
					reason:
						suggestedDelta > 0
							? `"${pillarData.pillar}" outperforms average by ${Math.round((performanceRatio - 1) * 100)}%`
							: `"${pillarData.pillar}" underperforms average by ${Math.round((1 - performanceRatio) * 100)}%`,
					evidence: [],
					tier: rule?.(delta) ? "auto" : "approval",
				});
			}
		}
	}

	// ── Posting time adjustments ─────────────────────────────────────────

	if (prefModel.bestPostingTimes && prefModel.bestPostingTimes.length > 0) {
		// For each platform, suggest the top performing times
		for (const platform of Object.keys(currentStrategy.posting.preferred_times)) {
			const field = `posting.preferred_times.${platform}`;
			if (isSettingLocked(locked, field)) continue;

			const currentTimes = currentStrategy.posting.preferred_times[platform] ?? [];
			const bestTimes = prefModel.bestPostingTimes
				.slice(0, 3)
				.map((t) => `${String(t.hour).padStart(2, "0")}:00`);

			// Check if times differ enough to suggest change
			const hasChanges = bestTimes.some((t) => !currentTimes.includes(t));
			if (!hasChanges) continue;

			// Calculate max hour shift
			const maxShift = Math.max(
				...bestTimes.map((bt) => {
					const bestHour = Number.parseInt(bt.split(":")[0] ?? "0", 10);
					const minDist = Math.min(
						...currentTimes.map((ct) => {
							const currentHour = Number.parseInt(ct.split(":")[0] ?? "0", 10);
							return Math.abs(bestHour - currentHour);
						}),
					);
					return minDist;
				}),
			);

			const rule = AUTO_APPLY_RULES.posting_time;
			adjustments.push({
				adjustmentType: "posting_time",
				field,
				oldValue: currentTimes,
				newValue: bestTimes,
				reason: `Data suggests better engagement at ${bestTimes.join(", ")} UTC`,
				evidence: [],
				tier: rule?.(maxShift) ? "auto" : "approval",
			});
		}
	}

	// ── Format preference adjustments ────────────────────────────────────

	if (prefModel.topFormats && prefModel.topFormats.length > 0) {
		const field = "formats.preferences";
		if (!isSettingLocked(locked, field)) {
			const newOrder = prefModel.topFormats.map((f) => f.format);
			const currentOrder = currentStrategy.formats.preferences;

			// Only suggest if order actually differs
			const ordersDiffer =
				newOrder.length !== currentOrder.length || newOrder.some((f, i) => f !== currentOrder[i]);

			if (ordersDiffer) {
				const rule = AUTO_APPLY_RULES.format_preference;
				adjustments.push({
					adjustmentType: "format_preference",
					field,
					oldValue: currentOrder,
					newValue: newOrder,
					reason: `Format ranking updated: ${newOrder.join(" > ")} by engagement`,
					evidence: [],
					tier: rule?.(0) ? "auto" : "approval",
				});
			}
		}
	}

	// ── Frequency adjustments ────────────────────────────────────────────

	for (const platform of Object.keys(currentStrategy.posting.frequency)) {
		const field = `posting.frequency.${platform}`;
		if (isSettingLocked(locked, field)) continue;

		const currentFreq = currentStrategy.posting.frequency[platform];
		if (currentFreq === undefined) continue;

		// If we have good engagement data and enough posts, suggest +1/week
		// This is a simplified heuristic; real logic would track engagement per post trends
		if (
			prefModel.topFormats &&
			prefModel.topFormats.length > 0 &&
			totalPostCount >= MIN_POSTS_FOR_ANY_ADJUSTMENT * 2
		) {
			// Only suggest increase if not already at a high frequency
			const maxFrequency: Record<string, number> = {
				x: 14,
				linkedin: 7,
				instagram: 7,
				tiktok: 7,
			};

			const cap = maxFrequency[platform] ?? 14;
			if (currentFreq < cap) {
				const delta = 1;
				const rule = AUTO_APPLY_RULES.frequency;
				adjustments.push({
					adjustmentType: "frequency",
					field,
					oldValue: currentFreq,
					newValue: currentFreq + delta,
					reason: `Engagement is stable with ${totalPostCount} posts — consider posting more`,
					evidence: [],
					tier: rule?.(delta) ? "auto" : "approval",
				});
			}
		}
	}

	return adjustments;
}

// ─── Apply Auto Adjustments ─────────────────────────────────────────────────

/**
 * Apply auto-tier adjustments to strategy.yaml.
 * Uses atomic write (.tmp + rename) pattern.
 * Records all adjustments (auto + approval) to the DB.
 */
export async function applyAutoAdjustments(
	db: HubDb,
	userId: string,
	adjustments: StrategyAdjustment[],
	strategyPath = "content/strategy.yaml",
): Promise<{ applied: StrategyAdjustment[]; queued: StrategyAdjustment[] }> {
	const autoAdjustments = adjustments.filter((a) => a.tier === "auto");
	const approvalAdjustments = adjustments.filter((a) => a.tier === "approval");

	// Apply auto adjustments to strategy.yaml
	if (autoAdjustments.length > 0) {
		const raw = await readFile(strategyPath, "utf-8");
		const strategy = strategyYamlSchema.parse(parse(raw));

		for (const adj of autoAdjustments) {
			applyFieldUpdate(strategy, adj);
		}

		const content = stringify(strategy);
		const tmpPath = `${strategyPath}.tmp`;
		await writeFile(tmpPath, content, "utf-8");
		await rename(tmpPath, strategyPath);
	}

	// Record all adjustments in DB
	const now = new Date();
	for (const adj of autoAdjustments) {
		await db.insert(strategyAdjustments).values({
			userId,
			adjustmentType: adj.adjustmentType,
			field: adj.field,
			oldValue: adj.oldValue,
			newValue: adj.newValue,
			reason: adj.reason,
			evidence: adj.evidence,
			tier: "auto",
			status: "applied",
			appliedAt: now,
		});
	}

	for (const adj of approvalAdjustments) {
		await db.insert(strategyAdjustments).values({
			userId,
			adjustmentType: adj.adjustmentType,
			field: adj.field,
			oldValue: adj.oldValue,
			newValue: adj.newValue,
			reason: adj.reason,
			evidence: adj.evidence,
			tier: "approval",
			status: "pending",
		});
	}

	return { applied: autoAdjustments, queued: approvalAdjustments };
}

// ─── Field Update Helper ────────────────────────────────────────────────────

function applyFieldUpdate(strategy: StrategyYaml, adj: StrategyAdjustment): void {
	const parts = adj.field.split(".");

	switch (adj.adjustmentType) {
		case "pillar_weight": {
			// field: "pillars.<name>.weight"
			const pillarName = parts[1];
			const pillar = strategy.pillars.find((p) => p.name === pillarName);
			if (pillar && typeof adj.newValue === "number") {
				pillar.weight = adj.newValue;
			}
			break;
		}
		case "posting_time": {
			// field: "posting.preferred_times.<platform>"
			const platform = parts[2];
			if (platform && Array.isArray(adj.newValue)) {
				strategy.posting.preferred_times[platform] = z.array(z.string()).parse(adj.newValue);
			}
			break;
		}
		case "format_preference": {
			// field: "formats.preferences"
			if (Array.isArray(adj.newValue)) {
				strategy.formats.preferences = z.array(z.string()).parse(adj.newValue);
			}
			break;
		}
		case "frequency": {
			// field: "posting.frequency.<platform>"
			const platform = parts[2];
			if (platform && typeof adj.newValue === "number") {
				strategy.posting.frequency[platform] = adj.newValue;
			}
			break;
		}
	}
}

// ─── Changelog ──────────────────────────────────────────────────────────────

/**
 * Query strategy adjustments since a given date.
 * Returns structured data for rendering in the weekly review: "What the brain changed this week".
 */
export async function getRecentChangelog(db: HubDb, userId: string, since: Date) {
	const rows = await db
		.select()
		.from(strategyAdjustments)
		.where(and(eq(strategyAdjustments.userId, userId), gt(strategyAdjustments.createdAt, since)));

	return rows;
}

// ─── Approve / Reject ───────────────────────────────────────────────────────

/**
 * Approve a pending adjustment. Also applies the change to strategy.yaml.
 */
export async function approveAdjustment(
	db: HubDb,
	adjustmentId: string,
	strategyPath = "content/strategy.yaml",
): Promise<void> {
	const rows = await db
		.select()
		.from(strategyAdjustments)
		.where(eq(strategyAdjustments.id, adjustmentId))
		.limit(1);

	const adjustment = rows[0];
	if (!adjustment || adjustment.status !== "pending") return;

	// Apply to strategy.yaml
	const raw = await readFile(strategyPath, "utf-8");
	const strategy = strategyYamlSchema.parse(parse(raw));
	applyFieldUpdate(strategy, {
		adjustmentType: adjustment.adjustmentType,
		field: adjustment.field,
		oldValue: adjustment.oldValue,
		newValue: adjustment.newValue,
		reason: adjustment.reason,
		evidence: adjustment.evidence ?? [],
		tier: "approval",
	});

	const content = stringify(strategy);
	const tmpPath = `${strategyPath}.tmp`;
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, strategyPath);

	// Update status
	await db
		.update(strategyAdjustments)
		.set({ status: "approved", appliedAt: new Date() })
		.where(eq(strategyAdjustments.id, adjustmentId));
}

/**
 * Reject a pending adjustment.
 */
export async function rejectAdjustment(db: HubDb, adjustmentId: string): Promise<void> {
	await db
		.update(strategyAdjustments)
		.set({ status: "rejected" })
		.where(eq(strategyAdjustments.id, adjustmentId));
}
