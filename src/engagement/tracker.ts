import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import type { HubDb } from "../core/db/connection.ts";
import { detectFeedbackMoments } from "../learning/feedback.ts";

// ─── Types ────────────────────────────────────────────────────────────────

export interface EngagementOutcome {
	impressions?: number;
	likes?: number;
	replies?: number;
}

const engagementOutcomeSchema = z.object({
	impressions: z.number().optional(),
	likes: z.number().optional(),
	replies: z.number().optional(),
});

export interface EngagementStat {
	totalEngagements: number;
	byPlatform: Record<string, number>;
	byType: Record<string, number>;
	avgOutcome: { impressions: number; likes: number; replies: number };
	topPerforming: {
		id: string;
		platform: string;
		type: string;
		impressions: number;
		likes: number;
	} | null;
}

export interface ScoringWeightSuggestion {
	dimension: string;
	currentWeight: number;
	suggestedWeight: number;
	reason: string;
}

export interface EngagementHistoryEntry {
	id: string;
	opportunityId: string;
	platform: string;
	engagementType: string;
	content: string;
	outcome: EngagementOutcome | null;
	engagedAt: string;
}

// ─── Raw SQL Row Schemas ──────────────────────────────────────────────────

const userIdRowSchema = z
	.object({
		user_id: z.string(),
	})
	.passthrough();

const scoringRowSchema = z.object({
	id: z.string(),
	outcome: engagementOutcomeSchema.nullable(),
	relevance_score_bps: z.coerce.number().nullable(),
	recency_score_bps: z.coerce.number().nullable(),
	reach_score_bps: z.coerce.number().nullable(),
	potential_score_bps: z.coerce.number().nullable(),
	composite_score_bps: z.coerce.number().nullable(),
});

const countGroupRowSchema = z
	.object({
		total: z.coerce.number(),
		platform: z.string(),
		engagement_type: z.string(),
	})
	.passthrough();

const avgOutcomeRowSchema = z
	.object({
		avg_impressions: z.coerce.number().nullable(),
		avg_likes: z.coerce.number().nullable(),
		avg_replies: z.coerce.number().nullable(),
	})
	.passthrough();

const topPerformerRowSchema = z
	.object({
		id: z.string(),
		platform: z.string(),
		engagement_type: z.string(),
		impressions: z.coerce.number().nullable(),
		likes: z.coerce.number().nullable(),
	})
	.passthrough();

const historyRowSchema = z
	.object({
		id: z.string(),
		opportunity_id: z.string(),
		platform: z.string(),
		engagement_type: z.string(),
		content: z.string(),
		outcome: engagementOutcomeSchema.nullable(),
		engaged_at: z.coerce.string(),
	})
	.passthrough();

// ─── Track Engagement Outcome ─────────────────────────────────────────────

/**
 * Update engagement_log row with outcome metrics.
 * Called after collecting engagement performance data.
 */
export async function trackEngagementOutcome(
	db: HubDb,
	engagementLogId: string,
	outcome: EngagementOutcome,
): Promise<void> {
	const outcomeJson = JSON.stringify(outcome);

	await db.execute(sql`
		UPDATE engagement_log
		SET outcome = ${outcomeJson}::jsonb
		WHERE id = ${engagementLogId}::uuid
	`);

	// Feed engagement signal into Phase 4 learning loop
	// Extract userId from the engagement log entry for feedback detection
	const logResult = await db.execute(sql`
		SELECT user_id FROM engagement_log WHERE id = ${engagementLogId}::uuid
	`);
	const logRow = userIdRowSchema.optional().parse(logResult.rows[0]);
	if (logRow?.user_id) {
		await feedEngagementToLearningLoop(db, logRow.user_id);
	}
}

// ─── Update Scoring Weights ───────────────────────────────────────────────

// Default scoring weights (from scoring.ts: relevance 40%, recency 30%, reach 20%, potential 10%)
const DEFAULT_WEIGHTS = {
	relevance: 0.4,
	recency: 0.3,
	reach: 0.2,
	potential: 0.1,
};

/**
 * Analyze engagement_log outcomes vs opportunity scores.
 * If high-scored opportunities consistently underperform, suggest weight adjustments.
 *
 * Uses same learning loop pattern from Phase 4 preference model:
 * - Track: compare actual outcome vs predicted score
 * - Suggest: weight adjustments (not auto-applied)
 * - Approval-tier: suggestions require human review
 */
export async function updateScoringWeights(
	db: HubDb,
	userId: string,
): Promise<ScoringWeightSuggestion[]> {
	const suggestions: ScoringWeightSuggestion[] = [];

	// Get engagement logs with outcomes and their opportunity scores
	const result = await db.execute(sql`
		SELECT
			el.id,
			el.outcome,
			eo.relevance_score_bps,
			eo.recency_score_bps,
			eo.reach_score_bps,
			eo.potential_score_bps,
			eo.composite_score_bps
		FROM engagement_log el
		JOIN engagement_opportunities eo ON eo.id = el.opportunity_id
		WHERE el.user_id = ${userId}
			AND el.outcome IS NOT NULL
		ORDER BY el.engaged_at DESC
		LIMIT 50
	`);

	const rows = z.array(scoringRowSchema).parse(result.rows);

	if (rows.length < 5) {
		// Not enough data to make suggestions
		return [];
	}

	// Calculate correlation between each score dimension and actual outcome
	const dimensions = ["relevance", "recency", "reach", "potential"] as const;
	const correlations: Record<string, { highScoreAvgOutcome: number; lowScoreAvgOutcome: number }> =
		{};

	for (const dim of dimensions) {
		const bpsKey = `${dim}_score_bps` as const;
		const sorted = [...rows].sort((a, b) => (b[bpsKey] ?? 0) - (a[bpsKey] ?? 0));

		const topHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
		const bottomHalf = sorted.slice(Math.ceil(sorted.length / 2));

		const avgOutcome = (entries: z.infer<typeof scoringRowSchema>[]): number => {
			if (entries.length === 0) return 0;
			let total = 0;
			for (const entry of entries) {
				const outcome = entry.outcome;
				total +=
					(outcome?.impressions ?? 0) + (outcome?.likes ?? 0) * 10 + (outcome?.replies ?? 0) * 20;
			}
			return total / entries.length;
		};

		correlations[dim] = {
			highScoreAvgOutcome: avgOutcome(topHalf),
			lowScoreAvgOutcome: avgOutcome(bottomHalf),
		};
	}

	// Suggest weight changes based on predictive accuracy
	for (const dim of dimensions) {
		const corr = correlations[dim];
		if (!corr) continue;

		const currentWeight = DEFAULT_WEIGHTS[dim];
		const ratio =
			corr.lowScoreAvgOutcome > 0
				? corr.highScoreAvgOutcome / corr.lowScoreAvgOutcome
				: corr.highScoreAvgOutcome > 0
					? 2
					: 1;

		// If high-scored items don't outperform low-scored items, reduce weight
		if (ratio < 1.1 && currentWeight > 0.1) {
			suggestions.push({
				dimension: dim,
				currentWeight,
				suggestedWeight: Math.round((currentWeight - 0.05) * 100) / 100,
				reason: `High-${dim} opportunities don't significantly outperform low-${dim} ones (ratio: ${ratio.toFixed(2)}). Consider reducing weight.`,
			});
		}

		// If high-scored items strongly outperform, increase weight
		if (ratio > 2.0 && currentWeight < 0.5) {
			suggestions.push({
				dimension: dim,
				currentWeight,
				suggestedWeight: Math.round((currentWeight + 0.05) * 100) / 100,
				reason: `High-${dim} opportunities strongly outperform (ratio: ${ratio.toFixed(2)}). Consider increasing weight.`,
			});
		}
	}

	return suggestions;
}

// ─── Feed Engagement to Learning Loop ─────────────────────────────────────

/**
 * Bridge engagement outcomes into the Phase 4 learning loop.
 * Calls detectFeedbackMoments which analyzes post metrics and edit patterns
 * to surface exceptional moments (high performers, underperformers, edit streaks).
 *
 * Engagement outcomes influence what gets surfaced during /psn:review,
 * completing the cross-phase wire: engagement → tracker → learning/feedback.
 */
export async function feedEngagementToLearningLoop(db: HubDb, userId: string): Promise<void> {
	// detectFeedbackMoments analyzes post_metrics and edit_history
	// to find patterns worth surfacing. Engagement outcomes stored in
	// engagement_log complement this by providing engagement-side signals.
	await detectFeedbackMoments(db, userId);
}

// ─── Get Engagement Stats ─────────────────────────────────────────────────

/**
 * Return engagement summary for a period.
 * Total engagements, by platform, by type, average outcome, top performer.
 */
export async function getEngagementStats(
	db: HubDb,
	userId: string,
	period: "day" | "week" | "month" = "week",
): Promise<EngagementStat> {
	const intervalMap = { day: "1 day", week: "7 days", month: "30 days" };
	const interval = intervalMap[period];

	// Total and by-platform counts
	const countResult = await db.execute(sql`
		SELECT
			COUNT(*)::int as total,
			platform,
			engagement_type
		FROM engagement_log
		WHERE user_id = ${userId}
			AND engaged_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
		GROUP BY platform, engagement_type
	`);

	const countRows = z.array(countGroupRowSchema).parse(countResult.rows);

	let totalEngagements = 0;
	const byPlatform: Record<string, number> = {};
	const byType: Record<string, number> = {};

	for (const row of countRows) {
		const count = row.total ?? 0;
		const platform = row.platform;
		const type = row.engagement_type;

		totalEngagements += count;
		byPlatform[platform] = (byPlatform[platform] ?? 0) + count;
		byType[type] = (byType[type] ?? 0) + count;
	}

	// Average outcome metrics
	const outcomeResult = await db.execute(sql`
		SELECT
			AVG((outcome->>'impressions')::int)::int as avg_impressions,
			AVG((outcome->>'likes')::int)::int as avg_likes,
			AVG((outcome->>'replies')::int)::int as avg_replies
		FROM engagement_log
		WHERE user_id = ${userId}
			AND engaged_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
			AND outcome IS NOT NULL
	`);

	const outcomeRow = avgOutcomeRowSchema.optional().parse(outcomeResult.rows[0]);

	// Top performing engagement
	const topResult = await db.execute(sql`
		SELECT
			id,
			platform,
			engagement_type,
			(outcome->>'impressions')::int as impressions,
			(outcome->>'likes')::int as likes
		FROM engagement_log
		WHERE user_id = ${userId}
			AND engaged_at >= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
			AND outcome IS NOT NULL
		ORDER BY
			COALESCE((outcome->>'impressions')::int, 0) +
			COALESCE((outcome->>'likes')::int, 0) * 10 DESC
		LIMIT 1
	`);

	const topRow = topPerformerRowSchema.optional().parse(topResult.rows[0]);

	return {
		totalEngagements,
		byPlatform,
		byType,
		avgOutcome: {
			impressions: outcomeRow?.avg_impressions ?? 0,
			likes: outcomeRow?.avg_likes ?? 0,
			replies: outcomeRow?.avg_replies ?? 0,
		},
		topPerforming: topRow
			? {
					id: topRow.id,
					platform: topRow.platform,
					type: topRow.engagement_type,
					impressions: topRow.impressions ?? 0,
					likes: topRow.likes ?? 0,
				}
			: null,
	};
}

// ─── Get Engagement History ───────────────────────────────────────────────

/**
 * Recent engagement log entries for review.
 */
export async function getEngagementHistory(
	db: HubDb,
	userId: string,
	limit = 20,
): Promise<EngagementHistoryEntry[]> {
	const result = await db.execute(sql`
		SELECT
			id, opportunity_id, platform, engagement_type,
			content, outcome, engaged_at
		FROM engagement_log
		WHERE user_id = ${userId}
		ORDER BY engaged_at DESC
		LIMIT ${limit}
	`);

	return z
		.array(historyRowSchema)
		.parse(result.rows)
		.map((row) => ({
			id: row.id,
			opportunityId: row.opportunity_id,
			platform: row.platform,
			engagementType: row.engagement_type,
			content: row.content,
			outcome: row.outcome ?? null,
			engagedAt: row.engaged_at,
		}));
}
