import type { Pillar, RawTrend, ScoredTrend } from "./types.ts";

// ─── Angle Templates (reused from topic-suggest.ts pattern) ─────────────────

const ANGLE_TEMPLATES = [
	{ name: "hot-take", template: "Hot take: {topic}" },
	{ name: "how-to", template: "How to leverage {topic}" },
	{ name: "trend", template: "What's changing with {topic} right now" },
	{ name: "myth-busting", template: "The biggest myth about {topic}" },
	{ name: "comparison", template: "What most people get wrong about {topic}" },
	{ name: "prediction", template: "Where {topic} is headed next" },
	{ name: "behind-the-scenes", template: "Behind the scenes: {topic}" },
	{ name: "quick-tip", template: "Quick {topic} tip that changed everything" },
];

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
 * Generate 2-3 angle stubs for a trend title.
 * Uses the ANGLES template pattern from topic-suggest.ts.
 */
export function generateAngleStubs(trendTitle: string): string[] {
	// Pick 2-3 random angles from the template list
	const shuffled = [...ANGLE_TEMPLATES].sort(() => Math.random() - 0.5);
	const count = 2 + Math.round(Math.random()); // 2 or 3 angles

	return shuffled.slice(0, count).map((angle) => angle.template.replace("{topic}", trendTitle));
}

/**
 * Score an array of raw trends against content pillars.
 * Returns ScoredTrend[] with IDs, timestamps, and angle stubs for high-scoring trends.
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

		// Generate angle stubs for high-scoring trends (70+)
		if (overallScore >= 70) {
			scored.suggestedAngles = generateAngleStubs(raw.title);
		}

		return scored;
	});
}
