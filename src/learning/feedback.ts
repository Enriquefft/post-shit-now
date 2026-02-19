import { and, desc, eq, gt } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { editHistory, postMetrics } from "../core/db/schema.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FeedbackMoment {
	type: "high-performer" | "underperformer" | "high-edit-streak" | "low-edit-streak";
	postId: string | null;
	message: string;
	actionSuggestion?: string;
}

// ─── Feedback Detection ─────────────────────────────────────────────────────

const HIGH_PERFORMER_MULTIPLIER = 3;
const UNDERPERFORMER_MULTIPLIER = 0.3;
const HIGH_EDIT_STREAK_COUNT = 3;
const HIGH_EDIT_RATIO_THRESHOLD = 50;
const LOW_EDIT_STREAK_COUNT = 5;
const LOW_EDIT_RATIO_THRESHOLD = 10;

/**
 * Detect posts and patterns that deserve explicit feedback prompts.
 * Called during /psn:review to find key moments per LEARN-03.
 * Only prompts at exceptional moments, NOT every post.
 */
export async function detectFeedbackMoments(
	db: HubDb,
	userId: string,
): Promise<FeedbackMoment[]> {
	const moments: FeedbackMoment[] = [];
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	// ── 1. Engagement-based feedback ─────────────────────────────────────

	const metrics = await db
		.select()
		.from(postMetrics)
		.where(
			and(
				eq(postMetrics.userId, userId),
				gt(postMetrics.collectedAt, sevenDaysAgo),
			),
		);

	if (metrics.length >= 2) {
		const avgScore =
			metrics.reduce((sum, m) => sum + m.engagementScore, 0) / metrics.length;

		// High performers: >= 3x average
		for (const m of metrics) {
			if (avgScore > 0 && m.engagementScore >= avgScore * HIGH_PERFORMER_MULTIPLIER) {
				moments.push({
					type: "high-performer",
					postId: m.postId,
					message: `This post scored ${m.engagementScore} (${Math.round(m.engagementScore / avgScore)}x your average). What made this work so well?`,
					actionSuggestion: "Consider creating more content in this style or topic.",
				});
			}
		}

		// Underperformers: < 0.3x average
		for (const m of metrics) {
			if (avgScore > 0 && m.engagementScore < avgScore * UNDERPERFORMER_MULTIPLIER) {
				moments.push({
					type: "underperformer",
					postId: m.postId,
					message: `This post scored ${m.engagementScore} (${Math.round((m.engagementScore / avgScore) * 100)}% of your average). What went wrong here?`,
					actionSuggestion: "Consider avoiding this format or topic combination.",
				});
			}
		}
	}

	// ── 2. Edit streak-based feedback ────────────────────────────────────

	const recentEdits = await db
		.select()
		.from(editHistory)
		.where(eq(editHistory.userId, userId))
		.orderBy(desc(editHistory.createdAt))
		.limit(Math.max(HIGH_EDIT_STREAK_COUNT, LOW_EDIT_STREAK_COUNT));

	if (recentEdits.length >= HIGH_EDIT_STREAK_COUNT) {
		// High edit streak: last 3+ posts all > 50% edit ratio
		const lastN = recentEdits.slice(0, HIGH_EDIT_STREAK_COUNT);
		const allHighEdits = lastN.every((e) => e.editRatio > HIGH_EDIT_RATIO_THRESHOLD);

		if (allHighEdits) {
			moments.push({
				type: "high-edit-streak",
				postId: null,
				message: `You've been heavily editing your last ${HIGH_EDIT_STREAK_COUNT}+ posts (all >50% edit ratio). Want to adjust voice settings?`,
				actionSuggestion: "Run /psn:voice tweak to fine-tune your voice profile.",
			});
		}
	}

	if (recentEdits.length >= LOW_EDIT_STREAK_COUNT) {
		// Low edit streak: last 5+ posts all < 10% edit ratio
		const lastN = recentEdits.slice(0, LOW_EDIT_STREAK_COUNT);
		const allLowEdits = lastN.every((e) => e.editRatio < LOW_EDIT_RATIO_THRESHOLD);

		if (allLowEdits) {
			moments.push({
				type: "low-edit-streak",
				postId: null,
				message: "Voice calibration is excellent! Your last 5+ posts needed minimal editing.",
			});
		}
	}

	return moments;
}
