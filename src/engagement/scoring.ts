import { PLATFORM_ENGAGEMENT_TYPES, type OpportunityScore, type SuggestedEngagement } from "./types.ts";

// ─── Relevance Score ────────────────────────────────────────────────────────

/**
 * Count keyword matches in post content, normalize to 0-100.
 * Higher score = more keyword overlap with user's niche.
 */
export function computeRelevanceScore(
	postContent: string,
	nicheKeywords: string[],
): number {
	if (nicheKeywords.length === 0) return 0;

	const lowerContent = postContent.toLowerCase();
	let matches = 0;

	for (const keyword of nicheKeywords) {
		if (lowerContent.includes(keyword.toLowerCase())) {
			matches++;
		}
	}

	// Normalize: if all keywords match = 100, scale linearly
	const ratio = matches / nicheKeywords.length;
	return Math.round(Math.min(100, ratio * 100));
}

// ─── Recency Score ──────────────────────────────────────────────────────────

/**
 * Exponential decay based on post age.
 * 100 for < 1 hour, decays to 0 for > 24 hours.
 */
export function computeRecencyScore(postedAt: Date): number {
	const hoursAgo = (Date.now() - postedAt.getTime()) / 3_600_000;

	if (hoursAgo < 1) return 100;
	if (hoursAgo < 3) return 80;
	if (hoursAgo < 6) return 60;
	if (hoursAgo < 12) return 40;
	if (hoursAgo < 24) return 20;
	return 0;
}

// ─── Reach Score ────────────────────────────────────────────────────────────

/**
 * Log scale based on follower count.
 * 100 for 100K+, descending to 20 for < 100.
 */
export function computeReachScore(followerCount: number): number {
	if (followerCount >= 100_000) return 100;
	if (followerCount >= 10_000) return 80;
	if (followerCount >= 1_000) return 60;
	if (followerCount >= 100) return 40;
	return 20;
}

// ─── Potential Score ────────────────────────────────────────────────────────

/**
 * Engagement velocity: interactions per hour since posting.
 * Normalize to 0-100 based on platform averages.
 */
export function computePotentialScore(metrics: {
	likes: number;
	comments: number;
	shares: number;
	views?: number;
	postedAt: Date;
}): number {
	const hoursAgo = Math.max(0.1, (Date.now() - metrics.postedAt.getTime()) / 3_600_000);
	const totalInteractions = metrics.likes + metrics.comments + metrics.shares;
	const velocity = totalInteractions / hoursAgo;

	// Normalize: 500+ interactions/hour = 100, scale logarithmically
	if (velocity <= 0) return 0;
	const score = Math.round(Math.log10(velocity + 1) * 37); // log10(500) * 37 ~= 100
	return Math.min(100, Math.max(0, score));
}

// ─── Composite Score ────────────────────────────────────────────────────────

/**
 * Weighted composite: relevance 40%, recency 30%, reach 20%, potential 10%.
 * Returns integer 0-100.
 */
export function scoreOpportunity(raw: {
	relevance: number;
	recency: number;
	reach: number;
	potential: number;
}): number {
	const composite =
		raw.relevance * 0.4 + raw.recency * 0.3 + raw.reach * 0.2 + raw.potential * 0.1;
	return Math.round(Math.min(100, Math.max(0, composite)));
}

/**
 * Build a full OpportunityScore from raw component scores.
 */
export function buildOpportunityScore(raw: {
	relevance: number;
	recency: number;
	reach: number;
	potential: number;
}): OpportunityScore {
	return {
		relevance: raw.relevance,
		recency: raw.recency,
		reach: raw.reach,
		potential: raw.potential,
		composite: scoreOpportunity(raw),
	};
}

// ─── Basis Points Conversion ────────────────────────────────────────────────

/**
 * Convert 0-100 score to basis points for DB storage (score * 100).
 */
export function toBasisPoints(score: number): number {
	return Math.round(score * 100);
}

/**
 * Convert basis points to 0-100 score for display (bps / 100).
 */
export function fromBasisPoints(bps: number): number {
	return bps / 100;
}

// ─── Suggest Engagement Type ────────────────────────────────────────────────

/**
 * Based on platform capabilities and post context, suggest best engagement type.
 * X: reply for conversations, quote for hot takes
 * LinkedIn: comment for thought leadership
 * Instagram: comment
 * TikTok: duet for visual responses, stitch for educational, comment otherwise
 */
export function suggestEngagementType(
	platform: string,
	_score: number,
	postContext: string,
): SuggestedEngagement {
	const availableTypes = PLATFORM_ENGAGEMENT_TYPES[platform];
	if (!availableTypes || availableTypes.length === 0) return "comment";

	const lowerContext = postContext.toLowerCase();

	switch (platform) {
		case "x": {
			// Quote for strong opinions / hot takes
			if (
				lowerContext.includes("opinion") ||
				lowerContext.includes("hot take") ||
				lowerContext.includes("unpopular") ||
				lowerContext.includes("debate")
			) {
				return "quote";
			}
			// Reply for conversational posts / questions
			if (
				lowerContext.includes("?") ||
				lowerContext.includes("what do you think") ||
				lowerContext.includes("discussion")
			) {
				return "reply";
			}
			return "reply"; // default for X
		}

		case "linkedin":
			return "comment"; // comment for thought leadership

		case "instagram":
			return "comment";

		case "tiktok": {
			// Duet for visual responses
			if (
				lowerContext.includes("reaction") ||
				lowerContext.includes("respond") ||
				lowerContext.includes("challenge")
			) {
				return "duet";
			}
			// Stitch for educational content
			if (
				lowerContext.includes("explain") ||
				lowerContext.includes("tutorial") ||
				lowerContext.includes("how to") ||
				lowerContext.includes("learn")
			) {
				return "stitch";
			}
			return "comment";
		}

		default:
			return availableTypes[0] ?? "comment";
	}
}
