import type { Pillar, RawTrend, ScoredTrend } from "./types.ts";

// ─── Source Score Normalization Ranges ───────────────────────────────────────

const SOURCE_SCORE_RANGES: Record<string, { max: number }> = {
	hackernews: { max: 500 },
	reddit: { max: 10000 },
	producthunt: { max: 1000 },
	"google-trends": { max: 100 },
	rss: { max: 100 },
	x: { max: 1000 },
};

// ─── Scoring Functions ──────────────────────────────────────────────────────

/**
 * Score a trend title's relevance to each content pillar.
 * Uses keyword matching: split pillar name into words, check includes on lowercased title.
 * Full phrase match gets a bonus. Each score capped at 100.
 */
export function scorePillarRelevance(
	trendTitle: string,
	pillars: Pillar[],
): Record<string, number> {
	const scores: Record<string, number> = {};
	const titleLower = trendTitle.toLowerCase();

	for (const pillar of pillars) {
		const pillarWords = pillar.name.toLowerCase().split(/\s+/);
		let matchScore = 0;

		for (const word of pillarWords) {
			if (word.length < 3) continue; // skip short words like "AI" -- handled by full phrase match
			if (titleLower.includes(word)) {
				matchScore += 30; // direct keyword match
			}
		}

		// Full phrase match bonus
		if (titleLower.includes(pillar.name.toLowerCase())) {
			matchScore += 40;
		}

		// Handle short pillar names (e.g., "AI") that get skipped by word-length filter
		if (pillar.name.length <= 3 && titleLower.includes(pillar.name.toLowerCase())) {
			matchScore += 50;
		}

		scores[pillar.name] = Math.min(100, matchScore);
	}

	return scores;
}

/**
 * Compute overall trend score from pillar relevance and source popularity.
 * Weighted: 60% pillar relevance (weighted by pillar weights) + 40% normalized source popularity.
 */
export function computeOverallScore(
	pillarScores: Record<string, number>,
	sourceScore: number,
	source: string,
	pillars: Pillar[],
): number {
	// Weighted average of pillar relevance
	let weightedRelevance = 0;
	let totalWeight = 0;

	for (const pillar of pillars) {
		const score = pillarScores[pillar.name] ?? 0;
		weightedRelevance += score * pillar.weight;
		totalWeight += pillar.weight;
	}

	const relevance = totalWeight > 0 ? weightedRelevance / totalWeight : 0;

	// Normalize source score to 0-100 based on source type
	const range = SOURCE_SCORE_RANGES[source] ?? { max: 100 };
	const normalizedPopularity = Math.min(100, (sourceScore / range.max) * 100);

	return Math.round(relevance * 0.6 + normalizedPopularity * 0.4);
}

/**
 * Score an array of raw trends against content pillars.
 * Returns ScoredTrend[] with IDs and timestamps. Angle generation is handled
 * downstream by Claude with full voice/brand context.
 */
export function scoreTrends(rawTrends: RawTrend[], pillars: Pillar[]): ScoredTrend[] {
	const thirtyDaysFromNow = new Date();
	thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

	return rawTrends.map((raw) => {
		const pillarRelevance = scorePillarRelevance(raw.title, pillars);
		const overallScore = computeOverallScore(
			pillarRelevance,
			raw.sourceScore ?? 0,
			raw.source,
			pillars,
		);

		const scored: ScoredTrend = {
			id: crypto.randomUUID(),
			title: raw.title,
			url: raw.url,
			source: raw.source,
			sourceScore: raw.sourceScore ?? 0,
			pillarRelevance,
			overallScore,
			detectedAt: new Date(),
			expiresAt: thirtyDaysFromNow,
		};

		return scored;
	});
}
