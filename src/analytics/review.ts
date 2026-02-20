import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { and, eq, gt, lte } from "drizzle-orm";
import { parse } from "yaml";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics, posts } from "../core/db/schema.ts";
import {
	applyAutoAdjustments,
	computeAdjustments,
	getRecentChangelog,
	type StrategyAdjustment,
} from "../learning/adjustments.ts";
import { detectFeedbackMoments, type FeedbackMoment } from "../learning/feedback.ts";
import { computeWeeklyUpdate, getPreferenceModel } from "../learning/preference-model.ts";
import { detectTopicFatigue, type FatigueResult } from "./fatigue.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PostDetail {
	postId: string;
	contentSnippet: string;
	format: string | null;
	pillar: string | null;
	topic: string | null;
	engagementScore: number;
	engagementRateBps: number;
	impressionCount: number;
	likeCount: number;
	retweetCount: number;
	bookmarkCount: number;
	replyCount: number;
	quoteCount: number;
	publishedAt: Date | null;
	analysis: string;
}

export interface PostCompact {
	postId: string;
	contentSnippet: string;
	engagementScore: number;
	engagementRateBps: number;
	verdict: string;
}

export interface PeriodStats {
	totalEngagementScore: number;
	avgScorePerPost: number;
	totalImpressions: number;
	avgEngagementRateBps: number;
	postCount: number;
}

export interface WeeklyReview {
	period: { start: Date; end: Date };
	postBreakdown: {
		top: PostDetail[];
		bottom: PostDetail[];
		rest: PostCompact[];
	};
	comparison: {
		current: PeriodStats;
		previous: PeriodStats;
		deltas: Record<string, number>;
	};
	pillarBreakdown: Array<{
		pillar: string;
		avgScore: number;
		postCount: number;
	}>;
	recommendations: Array<{
		text: string;
		evidence: string[];
		priority: "high" | "medium" | "low";
	}>;
	followerTrend: { current: number; previous: number; delta: number };
	changelog: Awaited<ReturnType<typeof getRecentChangelog>>;
	pendingApprovals: StrategyAdjustment[];
	feedbackMoments: FeedbackMoment[];
	fatiguedTopics: FatigueResult[];
	reportPath: string;
}

// ─── Weekly Review ──────────────────────────────────────────────────────────

/**
 * Generate a comprehensive weekly review.
 *
 * Ranks posts, compares periods, breaks down by pillar, generates
 * evidence-backed recommendations, triggers the learning loop,
 * and saves a report to analytics/reports/.
 */
export async function generateWeeklyReview(
	db: HubDb,
	userId: string,
	options?: { days?: number },
): Promise<WeeklyReview> {
	const days = options?.days ?? 7;
	const now = new Date();
	const periodEnd = now;
	const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
	const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

	// ── 1. Fetch data ───────────────────────────────────────────────────

	const currentMetrics = await db
		.select({
			metric: postMetrics,
			postContent: posts.content,
			postPublishedAt: posts.publishedAt,
		})
		.from(postMetrics)
		.innerJoin(posts, eq(postMetrics.postId, posts.id))
		.where(
			and(
				eq(postMetrics.userId, userId),
				gt(postMetrics.collectedAt, periodStart),
				lte(postMetrics.collectedAt, periodEnd),
			),
		);

	const previousMetrics = await db
		.select()
		.from(postMetrics)
		.where(
			and(
				eq(postMetrics.userId, userId),
				gt(postMetrics.collectedAt, prevPeriodStart),
				lte(postMetrics.collectedAt, periodStart),
			),
		);

	const model = await getPreferenceModel(db, userId);

	// ── 2. Rank posts by engagementScore descending ─────────────────────

	const sorted = [...currentMetrics].sort(
		(a, b) => b.metric.engagementScore - a.metric.engagementScore,
	);

	// ── 3. Build post breakdown ─────────────────────────────────────────

	const toDetail = (row: (typeof sorted)[number], analysis: string): PostDetail => ({
		postId: row.metric.postId,
		contentSnippet: row.postContent.slice(0, 120),
		format: row.metric.postFormat,
		pillar: row.metric.postPillar,
		topic: row.metric.postTopic,
		engagementScore: row.metric.engagementScore,
		engagementRateBps: row.metric.engagementRateBps,
		impressionCount: row.metric.impressionCount,
		likeCount: row.metric.likeCount,
		retweetCount: row.metric.retweetCount,
		bookmarkCount: row.metric.bookmarkCount,
		replyCount: row.metric.replyCount,
		quoteCount: row.metric.quoteCount,
		publishedAt: row.postPublishedAt,
		analysis,
	});

	const avgScore =
		sorted.length > 0
			? sorted.reduce((s, r) => s + r.metric.engagementScore, 0) / sorted.length
			: 0;

	const top3 = sorted.slice(0, 3).map((row) => {
		const highlights: string[] = [];
		if (row.metric.bookmarkCount > 0) highlights.push(`${row.metric.bookmarkCount} saves`);
		if (row.metric.retweetCount + row.metric.quoteCount > 0)
			highlights.push(`${row.metric.retweetCount + row.metric.quoteCount} shares`);
		if (row.metric.replyCount > 0) highlights.push(`${row.metric.replyCount} replies`);
		const analysis =
			highlights.length > 0
				? `Strong performer: ${highlights.join(", ")}. ${row.metric.engagementRateBps / 100}% engagement rate.`
				: `Score ${row.metric.engagementScore} with ${row.metric.impressionCount} impressions.`;
		return toDetail(row, analysis);
	});

	const bottom3 = sorted
		.slice(-3)
		.reverse()
		.map((row) => {
			const issues: string[] = [];
			if (row.metric.impressionCount < (avgScore > 0 ? avgScore / 2 : 100))
				issues.push("low impressions");
			if (row.metric.engagementRateBps < 50) issues.push("low engagement rate");
			if (row.metric.bookmarkCount === 0 && row.metric.retweetCount === 0)
				issues.push("no saves or shares");
			const analysis =
				issues.length > 0
					? `Underperformed: ${issues.join(", ")}.`
					: `Below average with score ${row.metric.engagementScore}.`;
			return toDetail(row, analysis);
		});

	// Avoid overlap between top and bottom when few posts
	const topIds = new Set(top3.map((p) => p.postId));
	const bottomIds = new Set(bottom3.map((p) => p.postId));
	const filteredBottom = bottom3.filter((p) => !topIds.has(p.postId));

	const rest = sorted
		.filter((r) => !topIds.has(r.metric.postId) && !bottomIds.has(r.metric.postId))
		.map((row): PostCompact => {
			const verdict = generateVerdict(row.metric, avgScore);
			return {
				postId: row.metric.postId,
				contentSnippet: row.postContent.slice(0, 80),
				engagementScore: row.metric.engagementScore,
				engagementRateBps: row.metric.engagementRateBps,
				verdict,
			};
		});

	// ── 4. Time comparison ──────────────────────────────────────────────

	const currentStats = computePeriodStats(currentMetrics.map((r) => r.metric));
	const previousStats = computePeriodStats(previousMetrics);

	const deltas: Record<string, number> = {
		totalEngagementScore: percentDelta(
			currentStats.totalEngagementScore,
			previousStats.totalEngagementScore,
		),
		avgScorePerPost: percentDelta(currentStats.avgScorePerPost, previousStats.avgScorePerPost),
		totalImpressions: percentDelta(currentStats.totalImpressions, previousStats.totalImpressions),
		avgEngagementRateBps: percentDelta(
			currentStats.avgEngagementRateBps,
			previousStats.avgEngagementRateBps,
		),
	};

	// ── 5. Cross-pillar breakdown ───────────────────────────────────────

	const pillarMap = new Map<string, { total: number; count: number }>();
	for (const row of currentMetrics) {
		const pillar = row.metric.postPillar ?? "uncategorized";
		const existing = pillarMap.get(pillar) ?? { total: 0, count: 0 };
		existing.total += row.metric.engagementScore;
		existing.count++;
		pillarMap.set(pillar, existing);
	}

	const pillarBreakdown = [...pillarMap.entries()]
		.map(([pillar, data]) => ({
			pillar,
			avgScore: Math.round((data.total / data.count) * 100) / 100,
			postCount: data.count,
		}))
		.sort((a, b) => b.avgScore - a.avgScore);

	// ── 6. Recommendations ──────────────────────────────────────────────

	const recommendations = generateRecommendations(sorted, pillarBreakdown, avgScore);

	// Fatigue warnings
	const fatigueInputs = currentMetrics
		.filter(
			(r): r is typeof r & { metric: { postTopic: string }; postPublishedAt: Date } =>
				r.metric.postTopic !== null && r.postPublishedAt !== null,
		)
		.map((r) => ({
			topic: r.metric.postTopic,
			score: r.metric.engagementScore,
			publishedAt: r.postPublishedAt,
		}));
	const fatiguedTopics = detectTopicFatigue(fatigueInputs);

	if (fatiguedTopics.length > 0) {
		for (const ft of fatiguedTopics) {
			recommendations.push({
				text: ft.suggestion,
				evidence: [`Last 3 scores on "${ft.topic}": ${ft.lastScores.join(", ")}`],
				priority: "high",
			});
		}
	}

	// ── 7. Follower trend ───────────────────────────────────────────────

	const followerHistory = model?.followerHistory ?? [];
	const lastTwo = (followerHistory as Array<{ count: number; date: string }>).slice(-2);
	const followerTrend = {
		current: lastTwo.length > 0 ? (lastTwo[lastTwo.length - 1]?.count ?? 0) : 0,
		previous: lastTwo.length > 1 ? (lastTwo[0]?.count ?? 0) : 0,
		delta: 0,
	};
	followerTrend.delta = followerTrend.current - followerTrend.previous;

	// ── 8. Trigger learning loop ────────────────────────────────────────

	await computeWeeklyUpdate(db, userId);

	// Compute and apply strategy adjustments from preference model
	let changelog: Awaited<ReturnType<typeof getRecentChangelog>> = [];
	let pendingApprovals: StrategyAdjustment[] = [];
	let feedbackMoments: FeedbackMoment[] = [];

	try {
		changelog = await getRecentChangelog(db, userId, periodStart);
	} catch {
		// No changelog data yet
	}

	try {
		feedbackMoments = await detectFeedbackMoments(db, userId);
	} catch {
		// No feedback moments yet
	}

	// Compute adjustments from preference model + strategy.yaml
	try {
		const strategyRaw = await readFile("content/strategy.yaml", "utf-8");
		const strategy = parse(strategyRaw) as Parameters<typeof computeAdjustments>[1];

		if (model) {
			const weeksOfData = Math.floor(days / 7) || 1;
			const adjustments = computeAdjustments(
				{
					topFormats: model.topFormats,
					topPillars: model.topPillars,
					bestPostingTimes: model.bestPostingTimes,
					lockedSettings: model.lockedSettings,
				},
				strategy,
				currentMetrics.length,
				weeksOfData,
			);

			if (adjustments.length > 0) {
				const result = await applyAutoAdjustments(db, userId, adjustments);
				pendingApprovals = result.queued;
			}
		}
	} catch {
		// strategy.yaml may not exist yet — skip adjustments gracefully
	}

	// ── 9. Save report ──────────────────────────────────────────────────

	const dateStr = periodEnd.toISOString().split("T")[0];
	const reportPath = `analytics/reports/weekly-${dateStr}.md`;

	const reportContent = generateReportMarkdown({
		period: { start: periodStart, end: periodEnd },
		top: top3,
		bottom: filteredBottom,
		rest,
		comparison: { current: currentStats, previous: previousStats, deltas },
		pillarBreakdown,
		recommendations,
		followerTrend,
		fatiguedTopics,
	});

	await mkdir(dirname(reportPath), { recursive: true });
	await writeFile(reportPath, reportContent, "utf-8");

	// ── 10. Return structured review ────────────────────────────────────

	return {
		period: { start: periodStart, end: periodEnd },
		postBreakdown: { top: top3, bottom: filteredBottom, rest },
		comparison: { current: currentStats, previous: previousStats, deltas },
		pillarBreakdown,
		recommendations,
		followerTrend,
		changelog,
		pendingApprovals,
		feedbackMoments,
		fatiguedTopics,
		reportPath,
	};
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computePeriodStats(
	metrics: Array<{
		engagementScore: number;
		impressionCount: number;
		engagementRateBps: number;
	}>,
): PeriodStats {
	if (metrics.length === 0) {
		return {
			totalEngagementScore: 0,
			avgScorePerPost: 0,
			totalImpressions: 0,
			avgEngagementRateBps: 0,
			postCount: 0,
		};
	}

	const totalEngagementScore = metrics.reduce((s, m) => s + m.engagementScore, 0);
	const totalImpressions = metrics.reduce((s, m) => s + m.impressionCount, 0);
	const totalRateBps = metrics.reduce((s, m) => s + m.engagementRateBps, 0);

	return {
		totalEngagementScore,
		avgScorePerPost: Math.round((totalEngagementScore / metrics.length) * 100) / 100,
		totalImpressions,
		avgEngagementRateBps: Math.round(totalRateBps / metrics.length),
		postCount: metrics.length,
	};
}

function percentDelta(current: number, previous: number): number {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Math.round(((current - previous) / previous) * 10000) / 100;
}

function generateVerdict(
	metric: {
		engagementScore: number;
		engagementRateBps: number;
		bookmarkCount: number;
		retweetCount: number;
		impressionCount: number;
		postFormat: string | null;
	},
	avgScore: number,
): string {
	const parts: string[] = [];

	if (metric.engagementScore > avgScore * 1.5) {
		parts.push("Above average");
	} else if (metric.engagementScore < avgScore * 0.5) {
		parts.push("Below average");
	} else {
		parts.push("Average");
	}

	if (metric.bookmarkCount > 0) parts.push("strong saves");
	if (metric.retweetCount > 0) parts.push("good shares");
	if (metric.impressionCount < 50) parts.push("low reach");
	if (metric.postFormat) parts.push(metric.postFormat);

	return parts.join(", ");
}

function generateRecommendations(
	sorted: Array<{
		metric: {
			postId: string;
			engagementScore: number;
			postFormat: string | null;
			postPillar: string | null;
		};
		postContent: string;
	}>,
	pillarBreakdown: Array<{ pillar: string; avgScore: number; postCount: number }>,
	avgScore: number,
): Array<{ text: string; evidence: string[]; priority: "high" | "medium" | "low" }> {
	const recs: Array<{ text: string; evidence: string[]; priority: "high" | "medium" | "low" }> = [];

	if (sorted.length < 2) return recs;

	// Format performance comparison
	const formatScores = new Map<string, { total: number; count: number; postIds: string[] }>();
	for (const row of sorted) {
		const fmt = row.metric.postFormat ?? "unknown";
		const existing = formatScores.get(fmt) ?? { total: 0, count: 0, postIds: [] };
		existing.total += row.metric.engagementScore;
		existing.count++;
		existing.postIds.push(row.metric.postId);
		formatScores.set(fmt, existing);
	}

	const formatAvgs = [...formatScores.entries()]
		.map(([format, data]) => ({
			format,
			avg: data.total / data.count,
			postIds: data.postIds,
		}))
		.sort((a, b) => b.avg - a.avg);

	if (formatAvgs.length >= 2) {
		const best = formatAvgs[0];
		const worst = formatAvgs[formatAvgs.length - 1];
		if (best && worst && best.avg > worst.avg * 1.5) {
			recs.push({
				text: `${best.format} outperforms ${worst.format} by ${Math.round((best.avg / worst.avg) * 10) / 10}x -- lean into ${best.format} content`,
				evidence: best.postIds.slice(0, 3).map((id) => `post ${id.slice(0, 8)}`),
				priority: "high",
			});
		}
	}

	// Pillar performance gaps
	if (pillarBreakdown.length >= 2) {
		const overallAvg = pillarBreakdown.reduce((s, p) => s + p.avgScore, 0) / pillarBreakdown.length;
		for (const pillar of pillarBreakdown) {
			if (pillar.avgScore > overallAvg * 1.3 && pillar.postCount >= 2) {
				recs.push({
					text: `"${pillar.pillar}" pillar is outperforming -- consider increasing its weight`,
					evidence: [`${pillar.postCount} posts, avg score ${pillar.avgScore}`],
					priority: "medium",
				});
			}
			if (pillar.avgScore < overallAvg * 0.7 && pillar.postCount >= 2) {
				recs.push({
					text: `"${pillar.pillar}" pillar is underperforming -- consider fresh angles or reducing frequency`,
					evidence: [`${pillar.postCount} posts, avg score ${pillar.avgScore}`],
					priority: "medium",
				});
			}
		}
	}

	// Time-of-day patterns (simplified: morning vs afternoon vs evening based on collected data)
	const highPerformers = sorted.filter((r) => r.metric.engagementScore > avgScore * 1.5);
	if (highPerformers.length >= 2) {
		recs.push({
			text: `Your top ${highPerformers.length} posts significantly outperformed average -- study their patterns`,
			evidence: highPerformers
				.slice(0, 3)
				.map((r) => `post ${r.metric.postId.slice(0, 8)} (score: ${r.metric.engagementScore})`),
			priority: "low",
		});
	}

	return recs;
}

function generateReportMarkdown(data: {
	period: { start: Date; end: Date };
	top: PostDetail[];
	bottom: PostDetail[];
	rest: PostCompact[];
	comparison: { current: PeriodStats; previous: PeriodStats; deltas: Record<string, number> };
	pillarBreakdown: Array<{ pillar: string; avgScore: number; postCount: number }>;
	recommendations: Array<{ text: string; evidence: string[]; priority: string }>;
	followerTrend: { current: number; previous: number; delta: number };
	fatiguedTopics: FatigueResult[];
}): string {
	const lines: string[] = [];
	const fmt = (d: Date) => d.toISOString().split("T")[0];

	lines.push(`# Weekly Review: ${fmt(data.period.start)} to ${fmt(data.period.end)}`);
	lines.push("");

	// Summary
	lines.push("## Performance Summary");
	lines.push("");
	lines.push(`| Metric | This Period | Last Period | Change |`);
	lines.push(`|--------|------------|-------------|--------|`);
	lines.push(
		`| Total Score | ${data.comparison.current.totalEngagementScore} | ${data.comparison.previous.totalEngagementScore} | ${data.comparison.deltas.totalEngagementScore ?? 0}% |`,
	);
	lines.push(
		`| Avg Score/Post | ${data.comparison.current.avgScorePerPost} | ${data.comparison.previous.avgScorePerPost} | ${data.comparison.deltas.avgScorePerPost ?? 0}% |`,
	);
	lines.push(
		`| Total Impressions | ${data.comparison.current.totalImpressions} | ${data.comparison.previous.totalImpressions} | ${data.comparison.deltas.totalImpressions ?? 0}% |`,
	);
	lines.push(
		`| Avg Engagement Rate | ${data.comparison.current.avgEngagementRateBps}bps | ${data.comparison.previous.avgEngagementRateBps}bps | ${data.comparison.deltas.avgEngagementRateBps ?? 0}% |`,
	);
	lines.push(
		`| Post Count | ${data.comparison.current.postCount} | ${data.comparison.previous.postCount} | - |`,
	);
	lines.push("");

	// Top performers
	lines.push("## Top Performers");
	lines.push("");
	for (const p of data.top) {
		lines.push(`### ${p.contentSnippet}...`);
		lines.push(`- **Score:** ${p.engagementScore} | **Rate:** ${p.engagementRateBps / 100}%`);
		lines.push(
			`- **Format:** ${p.format ?? "N/A"} | **Pillar:** ${p.pillar ?? "N/A"} | **Topic:** ${p.topic ?? "N/A"}`,
		);
		lines.push(`- **Analysis:** ${p.analysis}`);
		lines.push("");
	}

	// Underperformers
	if (data.bottom.length > 0) {
		lines.push("## Underperformers");
		lines.push("");
		for (const p of data.bottom) {
			lines.push(`### ${p.contentSnippet}...`);
			lines.push(`- **Score:** ${p.engagementScore} | **Rate:** ${p.engagementRateBps / 100}%`);
			lines.push(`- **Analysis:** ${p.analysis}`);
			lines.push("");
		}
	}

	// Rest
	if (data.rest.length > 0) {
		lines.push("## Other Posts");
		lines.push("");
		lines.push("| Post | Score | Rate | Verdict |");
		lines.push("|------|-------|------|---------|");
		for (const p of data.rest) {
			lines.push(
				`| ${p.contentSnippet}... | ${p.engagementScore} | ${p.engagementRateBps / 100}% | ${p.verdict} |`,
			);
		}
		lines.push("");
	}

	// Pillar breakdown
	lines.push("## Cross-Pillar Breakdown");
	lines.push("");
	lines.push("| Pillar | Avg Score | Posts |");
	lines.push("|--------|-----------|-------|");
	for (const p of data.pillarBreakdown) {
		lines.push(`| ${p.pillar} | ${p.avgScore} | ${p.postCount} |`);
	}
	lines.push("");

	// Follower trend
	lines.push("## Follower Trend");
	lines.push("");
	const dir = data.followerTrend.delta > 0 ? "up" : data.followerTrend.delta < 0 ? "down" : "flat";
	lines.push(
		`Current: ${data.followerTrend.current} | Previous: ${data.followerTrend.previous} | Delta: ${data.followerTrend.delta > 0 ? "+" : ""}${data.followerTrend.delta} (${dir})`,
	);
	lines.push("");

	// Recommendations
	if (data.recommendations.length > 0) {
		lines.push("## Recommendations");
		lines.push("");
		for (const r of data.recommendations) {
			lines.push(`- **[${r.priority.toUpperCase()}]** ${r.text}`);
			if (r.evidence.length > 0) {
				lines.push(`  - Evidence: ${r.evidence.join("; ")}`);
			}
		}
		lines.push("");
	}

	// Fatigue warnings
	if (data.fatiguedTopics.length > 0) {
		lines.push("## Content Fatigue Warnings");
		lines.push("");
		for (const ft of data.fatiguedTopics) {
			lines.push(`- **${ft.topic}**: ${ft.suggestion} (scores: ${ft.lastScores.join(", ")})`);
		}
		lines.push("");
	}

	lines.push(`---`);
	lines.push(`*Generated: ${new Date().toISOString()}*`);

	return lines.join("\n");
}
