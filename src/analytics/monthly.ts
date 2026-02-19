import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { and, eq, gt, lte } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { editHistory, postMetrics, strategyAdjustments } from "../core/db/schema.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VoiceDriftResult {
	detected: boolean;
	currentAvgEditRatio: number;
	baselineAvgEditRatio: number;
	deltaPoints: number;
	message: string;
}

export interface AudienceSignal {
	type: "growing" | "declining" | "format-outperforming";
	label: string;
	currentAvg: number;
	previousAvg: number;
	changePercent: number;
}

export interface RiskBudgetAssessment {
	autoAdjustmentsCount: number;
	improvingCount: number;
	degradingCount: number;
	netEffect: "positive" | "negative" | "neutral";
	recommendation: string;
}

export interface MonthlyAnalysis {
	period: { start: Date; end: Date };
	voiceDrift: VoiceDriftResult;
	audienceSignals: AudienceSignal[];
	riskBudget: RiskBudgetAssessment;
	strategicRecommendations: Array<{
		text: string;
		evidence: string[];
		tier: "approval";
	}>;
	reportPath: string;
}

// ─── Monthly Analysis ───────────────────────────────────────────────────────

/**
 * Generate a comprehensive monthly deep analysis.
 *
 * Covers voice drift detection, audience signal analysis,
 * risk budget assessment, and strategic recommendations.
 * Auto-escalated on 1st of each month (not user-triggered).
 */
export async function generateMonthlyAnalysis(db: HubDb, userId: string): Promise<MonthlyAnalysis> {
	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

	// ── 1. Voice drift detection ────────────────────────────────────────

	const voiceDrift = await detectVoiceDrift(db, userId, thirtyDaysAgo, sixtyDaysAgo);

	// ── 2. Audience signals ─────────────────────────────────────────────

	const audienceSignals = await analyzeAudienceSignals(
		db,
		userId,
		thirtyDaysAgo,
		sixtyDaysAgo,
		now,
	);

	// ── 3. Risk budget assessment ───────────────────────────────────────

	const riskBudget = await assessRiskBudget(db, userId, thirtyDaysAgo);

	// ── 4. Strategic recommendations ────────────────────────────────────

	const strategicRecommendations = generateStrategicRecommendations(audienceSignals, riskBudget);

	// Queue strategic recommendations as approval-tier adjustments
	for (const rec of strategicRecommendations) {
		await db.insert(strategyAdjustments).values({
			userId,
			adjustmentType: "new_pillar",
			field: "strategic_recommendation",
			oldValue: null,
			newValue: { text: rec.text, evidence: rec.evidence },
			reason: rec.text,
			evidence: rec.evidence,
			tier: "approval",
			status: "pending",
		});
	}

	// ── 5. Save report ──────────────────────────────────────────────────

	const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
	const reportPath = `analytics/reports/monthly-${monthStr}.md`;

	const reportContent = generateMonthlyReportMarkdown({
		period: { start: thirtyDaysAgo, end: now },
		voiceDrift,
		audienceSignals,
		riskBudget,
		strategicRecommendations,
	});

	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, reportContent, "utf-8");

	return {
		period: { start: thirtyDaysAgo, end: now },
		voiceDrift,
		audienceSignals,
		riskBudget,
		strategicRecommendations,
		reportPath,
	};
}

// ─── Voice Drift ────────────────────────────────────────────────────────────

async function detectVoiceDrift(
	db: HubDb,
	userId: string,
	thirtyDaysAgo: Date,
	sixtyDaysAgo: Date,
): Promise<VoiceDriftResult> {
	// Recent 30-day edit patterns
	const recentEdits = await db
		.select({ editRatio: editHistory.editRatio })
		.from(editHistory)
		.where(and(eq(editHistory.userId, userId), gt(editHistory.createdAt, thirtyDaysAgo)));

	// Previous 30-day edit patterns (baseline)
	const baselineEdits = await db
		.select({ editRatio: editHistory.editRatio })
		.from(editHistory)
		.where(
			and(
				eq(editHistory.userId, userId),
				gt(editHistory.createdAt, sixtyDaysAgo),
				lte(editHistory.createdAt, thirtyDaysAgo),
			),
		);

	const currentAvg =
		recentEdits.length > 0
			? recentEdits.reduce((s, e) => s + e.editRatio, 0) / recentEdits.length
			: 0;

	const baselineAvg =
		baselineEdits.length > 0
			? baselineEdits.reduce((s, e) => s + e.editRatio, 0) / baselineEdits.length
			: 0;

	const deltaPoints = Math.round(currentAvg - baselineAvg);
	const detected = deltaPoints > 10;

	return {
		detected,
		currentAvgEditRatio: Math.round(currentAvg),
		baselineAvgEditRatio: Math.round(baselineAvg),
		deltaPoints,
		message: detected
			? `Voice drift detected -- avg edit ratio increased by ${deltaPoints} points (${Math.round(baselineAvg)}% -> ${Math.round(currentAvg)}%). Calibration may be regressing.`
			: `Voice is stable. Edit ratio delta: ${deltaPoints > 0 ? "+" : ""}${deltaPoints} points.`,
	};
}

// ─── Audience Signals ───────────────────────────────────────────────────────

async function analyzeAudienceSignals(
	db: HubDb,
	userId: string,
	thirtyDaysAgo: Date,
	sixtyDaysAgo: Date,
	now: Date,
): Promise<AudienceSignal[]> {
	const signals: AudienceSignal[] = [];

	// Current 30-day metrics
	const currentMetrics = await db
		.select()
		.from(postMetrics)
		.where(
			and(
				eq(postMetrics.userId, userId),
				gt(postMetrics.collectedAt, thirtyDaysAgo),
				lte(postMetrics.collectedAt, now),
			),
		);

	// Previous 30-day metrics
	const previousMetrics = await db
		.select()
		.from(postMetrics)
		.where(
			and(
				eq(postMetrics.userId, userId),
				gt(postMetrics.collectedAt, sixtyDaysAgo),
				lte(postMetrics.collectedAt, thirtyDaysAgo),
			),
		);

	// Topic-level analysis
	const currentByTopic = groupByField(currentMetrics, "postTopic");
	const previousByTopic = groupByField(previousMetrics, "postTopic");

	for (const [topic, currentPosts] of currentByTopic) {
		const currentAvg = avgScore(currentPosts);
		const prevPosts = previousByTopic.get(topic);
		if (!prevPosts || prevPosts.length === 0) continue;

		const prevAvg = avgScore(prevPosts);
		if (prevAvg === 0) continue;

		const changePercent = Math.round(((currentAvg - prevAvg) / prevAvg) * 100);

		if (changePercent > 20) {
			signals.push({
				type: "growing",
				label: topic,
				currentAvg: Math.round(currentAvg),
				previousAvg: Math.round(prevAvg),
				changePercent,
			});
		} else if (changePercent < -20) {
			signals.push({
				type: "declining",
				label: topic,
				currentAvg: Math.round(currentAvg),
				previousAvg: Math.round(prevAvg),
				changePercent,
			});
		}
	}

	// Format-level analysis
	const currentByFormat = groupByField(currentMetrics, "postFormat");
	const previousByFormat = groupByField(previousMetrics, "postFormat");
	const overallCurrentAvg =
		currentMetrics.length > 0
			? currentMetrics.reduce((s, m) => s + m.engagementScore, 0) / currentMetrics.length
			: 0;

	for (const [format, currentPosts] of currentByFormat) {
		const formatAvg = avgScore(currentPosts);
		const prevPosts = previousByFormat.get(format);

		// New format outperforming historical averages
		if ((!prevPosts || prevPosts.length === 0) && formatAvg > overallCurrentAvg * 1.2) {
			signals.push({
				type: "format-outperforming",
				label: format,
				currentAvg: Math.round(formatAvg),
				previousAvg: 0,
				changePercent: 100,
			});
		}
	}

	return signals;
}

// ─── Risk Budget ────────────────────────────────────────────────────────────

async function assessRiskBudget(
	db: HubDb,
	userId: string,
	thirtyDaysAgo: Date,
): Promise<RiskBudgetAssessment> {
	const adjustments = await db
		.select()
		.from(strategyAdjustments)
		.where(
			and(
				eq(strategyAdjustments.userId, userId),
				gt(strategyAdjustments.createdAt, thirtyDaysAgo),
				eq(strategyAdjustments.tier, "auto"),
			),
		);

	const applied = adjustments.filter((a) => a.status === "applied");
	const autoAdjustmentsCount = applied.length;

	// For each applied adjustment, check if subsequent metrics improved
	// Simple heuristic: compare adjustment's evidence claims to outcomes
	// Since we don't have post-adjustment metric snapshots, use a count-based approach
	let improvingCount = 0;
	let degradingCount = 0;

	// Fetch recent metrics to check overall trend
	const recentMetrics = await db
		.select()
		.from(postMetrics)
		.where(and(eq(postMetrics.userId, userId), gt(postMetrics.collectedAt, thirtyDaysAgo)));

	if (recentMetrics.length >= 4) {
		const midpoint = Math.floor(recentMetrics.length / 2);
		const firstHalf = recentMetrics.slice(0, midpoint);
		const secondHalf = recentMetrics.slice(midpoint);

		const firstAvg = avgScore(firstHalf);
		const secondAvg = avgScore(secondHalf);

		if (secondAvg > firstAvg * 1.1) {
			improvingCount = autoAdjustmentsCount;
		} else if (secondAvg < firstAvg * 0.9) {
			degradingCount = autoAdjustmentsCount;
		} else {
			improvingCount = Math.ceil(autoAdjustmentsCount / 2);
			degradingCount = 0;
		}
	}

	const netEffect =
		degradingCount > improvingCount
			? "negative"
			: improvingCount > degradingCount
				? "positive"
				: "neutral";

	const recommendation =
		netEffect === "negative"
			? "Auto-adjustments appear to be degrading performance. Consider reducing auto-apply scope or reviewing recent changes."
			: netEffect === "positive"
				? "Auto-adjustments are contributing positively. Current autonomy level is appropriate."
				: `${autoAdjustmentsCount} auto-adjustments made with neutral impact. Monitor for another cycle.`;

	return {
		autoAdjustmentsCount,
		improvingCount,
		degradingCount,
		netEffect,
		recommendation,
	};
}

// ─── Strategic Recommendations ──────────────────────────────────────────────

function generateStrategicRecommendations(
	signals: AudienceSignal[],
	riskBudget: RiskBudgetAssessment,
): Array<{ text: string; evidence: string[]; tier: "approval" }> {
	const recs: Array<{ text: string; evidence: string[]; tier: "approval" }> = [];

	// Growing off-pillar topics could become new pillars
	const growingTopics = signals.filter((s) => s.type === "growing" && s.changePercent > 50);
	for (const signal of growingTopics) {
		recs.push({
			text: `Consider adding "${signal.label}" as a content pillar -- engagement grew ${signal.changePercent}% month-over-month`,
			evidence: [
				`Current avg score: ${signal.currentAvg}`,
				`Previous avg score: ${signal.previousAvg}`,
			],
			tier: "approval",
		});
	}

	// Declining formats could be dropped
	const decliningFormats = signals.filter(
		(s) => s.type === "declining" && s.changePercent < -30 && s.label !== "uncategorized",
	);
	for (const signal of decliningFormats) {
		recs.push({
			text: `Consider reducing "${signal.label}" format usage -- engagement dropped ${Math.abs(signal.changePercent)}%`,
			evidence: [
				`Current avg score: ${signal.currentAvg}`,
				`Previous avg score: ${signal.previousAvg}`,
			],
			tier: "approval",
		});
	}

	// New formats outperforming
	const outperforming = signals.filter((s) => s.type === "format-outperforming");
	for (const signal of outperforming) {
		recs.push({
			text: `New format "${signal.label}" is outperforming averages -- consider prioritizing it`,
			evidence: [`Avg score: ${signal.currentAvg}, above overall average`],
			tier: "approval",
		});
	}

	// Risk budget warning
	if (riskBudget.netEffect === "negative") {
		recs.push({
			text: "Reduce auto-adjustment scope -- recent automatic changes are correlating with declining performance",
			evidence: [
				`${riskBudget.autoAdjustmentsCount} auto-adjustments, ${riskBudget.degradingCount} correlating with decline`,
			],
			tier: "approval",
		});
	}

	return recs;
}

// ─── Report Markdown ────────────────────────────────────────────────────────

function generateMonthlyReportMarkdown(data: {
	period: { start: Date; end: Date };
	voiceDrift: VoiceDriftResult;
	audienceSignals: AudienceSignal[];
	riskBudget: RiskBudgetAssessment;
	strategicRecommendations: Array<{ text: string; evidence: string[] }>;
}): string {
	const lines: string[] = [];
	const fmt = (d: Date) => d.toISOString().split("T")[0];

	lines.push(`# Monthly Analysis: ${fmt(data.period.start)} to ${fmt(data.period.end)}`);
	lines.push("");

	// Voice drift
	lines.push("## Voice Drift");
	lines.push("");
	lines.push(data.voiceDrift.message);
	lines.push("");
	lines.push(`| Metric | Value |`);
	lines.push(`|--------|-------|`);
	lines.push(`| Current Avg Edit Ratio | ${data.voiceDrift.currentAvgEditRatio}% |`);
	lines.push(`| Baseline Avg Edit Ratio | ${data.voiceDrift.baselineAvgEditRatio}% |`);
	lines.push(
		`| Delta | ${data.voiceDrift.deltaPoints > 0 ? "+" : ""}${data.voiceDrift.deltaPoints} points |`,
	);
	lines.push(`| Drift Detected | ${data.voiceDrift.detected ? "Yes" : "No"} |`);
	lines.push("");

	// Audience signals
	lines.push("## Audience Signals");
	lines.push("");
	if (data.audienceSignals.length === 0) {
		lines.push("No significant audience signal changes detected this month.");
	} else {
		lines.push("| Type | Topic/Format | Current Avg | Previous Avg | Change |");
		lines.push("|------|-------------|-------------|--------------|--------|");
		for (const s of data.audienceSignals) {
			lines.push(
				`| ${s.type} | ${s.label} | ${s.currentAvg} | ${s.previousAvg} | ${s.changePercent > 0 ? "+" : ""}${s.changePercent}% |`,
			);
		}
	}
	lines.push("");

	// Risk budget
	lines.push("## Risk Budget Assessment");
	lines.push("");
	lines.push(`- **Auto-adjustments made:** ${data.riskBudget.autoAdjustmentsCount}`);
	lines.push(`- **Net effect:** ${data.riskBudget.netEffect}`);
	lines.push(`- **Recommendation:** ${data.riskBudget.recommendation}`);
	lines.push("");

	// Strategic recommendations
	if (data.strategicRecommendations.length > 0) {
		lines.push("## Strategic Recommendations (Require Approval)");
		lines.push("");
		for (const rec of data.strategicRecommendations) {
			lines.push(`- ${rec.text}`);
			if (rec.evidence.length > 0) {
				lines.push(`  - Evidence: ${rec.evidence.join("; ")}`);
			}
		}
		lines.push("");
	}

	lines.push("---");
	lines.push(`*Generated: ${new Date().toISOString()}*`);

	return lines.join("\n");
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function groupByField(
	metrics: Array<{
		engagementScore: number;
		postTopic: string | null;
		postFormat: string | null;
	}>,
	field: "postTopic" | "postFormat",
): Map<string, typeof metrics> {
	const map = new Map<string, typeof metrics>();
	for (const m of metrics) {
		const key = m[field] ?? "uncategorized";
		const arr = map.get(key) ?? [];
		arr.push(m);
		map.set(key, arr);
	}
	return map;
}

function avgScore(metrics: Array<{ engagementScore: number }>): number {
	if (metrics.length === 0) return 0;
	return metrics.reduce((s, m) => s + m.engagementScore, 0) / metrics.length;
}
