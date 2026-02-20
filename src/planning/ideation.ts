import { and, desc, eq, gt, gte } from "drizzle-orm";
import { isTopicFatigued } from "../analytics/fatigue.ts";
import type { PostFormat } from "../content/format-picker.ts";
import { suggestTopics } from "../content/topic-suggest.ts";
import type { HubDb } from "../core/db/connection.ts";
import { trends } from "../core/db/schema.ts";
import { getReadyIdeas } from "../ideas/bank.ts";
import { searchAll } from "../intelligence/search/index.ts";
import { getPreferenceModel } from "../learning/preference-model.ts";
import { loadProfile } from "../voice/profile.ts";
import type { MaturityLevel, VoiceProfile } from "../voice/types.ts";
import type { PlanIdea, PlanIdeaSource } from "./types.ts";

// ─── Maturity Adaptations ─────────────────────────────────────────────────────

/**
 * Defines how planning adapts based on user's social media experience level.
 * Never-posted users get full hand-holding; very active users get autonomous mode.
 */
export const MATURITY_ADAPTATIONS: Record<
	MaturityLevel,
	{
		explainBeforeAsking: boolean;
		suggestedIdeasCount: number;
		showSamplePosts: boolean;
		handHoldingLevel: "full" | "moderate" | "minimal" | "none";
	}
> = {
	never_posted: {
		explainBeforeAsking: true,
		suggestedIdeasCount: 2,
		showSamplePosts: true,
		handHoldingLevel: "full",
	},
	sporadic: {
		explainBeforeAsking: false,
		suggestedIdeasCount: 3,
		showSamplePosts: false,
		handHoldingLevel: "moderate",
	},
	consistent: {
		explainBeforeAsking: false,
		suggestedIdeasCount: 5,
		showSamplePosts: false,
		handHoldingLevel: "minimal",
	},
	very_active: {
		explainBeforeAsking: false,
		suggestedIdeasCount: 8,
		showSamplePosts: false,
		handHoldingLevel: "none",
	},
};

/**
 * Get maturity adaptation settings for a given level.
 * Defaults to "consistent" behavior if no level provided.
 */
export function getMaturityAdaptation(
	level: MaturityLevel | undefined,
): typeof MATURITY_ADAPTATIONS.never_posted {
	return MATURITY_ADAPTATIONS[level ?? "consistent"];
}

// ─── Sample Post Generation ──────────────────────────────────────────────────

/**
 * Generate a short sample post for never-posted users.
 * Uses voice profile for tone matching.
 * Returns a brief (2-3 sentences) sample to show how a post might look.
 */
export async function generateSamplePost(options: {
	profile: VoiceProfile;
	topic: string;
	platform: string;
}): Promise<string> {
	const { profile, topic, platform } = options;

	// Get tone hints from profile
	const platformPersona = profile.platforms[platform as keyof typeof profile.platforms];
	const _tone = platformPersona?.tone ?? "professional";
	const formality = profile.style.formality;

	// Build a sample post template based on voice characteristics
	const formalityPrefix =
		formality >= 7 ? "I've been thinking about" : formality <= 3 ? "Hot take:" : "Thoughts on";

	// Generate sample - this is a template; Claude will generate actual content
	const sample = `${formalityPrefix} ${topic}.\n\n[This is a sample of how your post might start. The actual content would match your voice more precisely after calibration.]`;

	return sample;
}

/**
 * Format a sample post for display with context about why it works.
 */
export function getSampleContext(idea: PlanIdea): string {
	if (!idea.samplePost) return "";

	const parts = [
		`**Sample post for "${idea.topic}":**`,
		"",
		idea.samplePost,
		"",
		`*Why this works: This sample uses a ${idea.angle} angle on your ${idea.pillar} pillar. The format (${idea.format}) is well-suited for this topic.*`,
	];

	return parts.join("\n");
}

// ─── Ideation Options ────────────────────────────────────────────────────────

export interface IdeationOptions {
	count?: number;
	platform?: string;
	profilePath?: string;
	enableOnDemandSearch?: boolean;
	maturityLevel?: MaturityLevel;
}

// ─── Generate Plan Ideas ─────────────────────────────────────────────────────

/**
 * Generate 10-15 ideas for weekly planning by mixing multiple sources:
 * ~30% trend-based, ~30% from idea bank, ~20% generated, ~10% remix, ~10% recycle.
 *
 * Checks stored trends, idea bank, on-demand search (if keys available),
 * and analytics preference model for top formats and fatigued topics.
 */
export async function generatePlanIdeas(
	db: HubDb,
	userId: string,
	pillars: Array<{ name: string; weight: number }>,
	opts?: IdeationOptions,
): Promise<PlanIdea[]> {
	// Get maturity adaptation to limit idea count based on experience level
	const adaptation = getMaturityAdaptation(opts?.maturityLevel);
	const requestedCount = opts?.count ?? 12;
	// Adapt count based on maturity - never_posted gets fewer, more focused ideas
	const targetCount = Math.min(requestedCount, adaptation.suggestedIdeasCount);
	const ideas: PlanIdea[] = [];

	// Load preference model for format insights and fatigue
	let fatiguedTopics: Array<{ topic: string; cooldownUntil: string }> = [];
	let topFormats: string[] = [];
	try {
		const model = await getPreferenceModel(db, userId);
		if (model) {
			const ft = model.fatiguedTopics as Array<{
				topic: string;
				cooldownUntil: string;
				lastScores: number[];
			}> | null;
			fatiguedTopics = ft?.filter((t) => isTopicFatigued(t.topic, ft)) ?? [];

			const tf = model.topFormats as Array<{ format: string; avgScore: number }> | null;
			topFormats = tf ? [...tf].sort((a, b) => b.avgScore - a.avgScore).map((f) => f.format) : [];
		}
	} catch {
		// Graceful degradation
	}

	const fatiguedSet = new Set(fatiguedTopics.map((t) => t.topic.toLowerCase()));

	// 1. Trend-based ideas (~30%)
	const trendTarget = Math.ceil(targetCount * 0.3);
	try {
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const storedTrends = await db
			.select()
			.from(trends)
			.where(
				and(
					eq(trends.userId, userId),
					gt(trends.overallScore, 30),
					gte(trends.detectedAt, sevenDaysAgo),
				),
			)
			.orderBy(desc(trends.overallScore))
			.limit(trendTarget * 2); // fetch extra for filtering

		for (const trend of storedTrends) {
			if (ideas.length >= trendTarget) break;
			if (fatiguedSet.has(trend.title.toLowerCase())) continue;

			const angles = trend.suggestedAngles as string[] | null;
			ideas.push({
				topic: trend.title,
				pillar: findBestPillar(trend.pillarRelevance as Record<string, number> | null, pillars),
				angle: angles?.[0] ?? "trend",
				format: topFormats[0] ?? "short-post",
				source: "trend" as PlanIdeaSource,
				sourceId: trend.id,
				score: trend.overallScore,
			});
		}
	} catch {
		// Trends table may not exist yet
	}

	// 2. Idea bank ideas (~30%)
	const bankTarget = Math.ceil(targetCount * 0.3);
	try {
		const readyIdeas = await getReadyIdeas(db, userId, { limit: bankTarget * 2 });
		for (const idea of readyIdeas) {
			if (ideas.length >= trendTarget + bankTarget) break;
			if (idea.title && fatiguedSet.has(idea.title.toLowerCase())) continue;

			ideas.push({
				topic: idea.title,
				pillar: idea.pillar ?? pillars[0]?.name ?? "general",
				angle: "bank",
				format: (idea.format as PostFormat) ?? topFormats[0] ?? "short-post",
				source: "bank" as PlanIdeaSource,
				sourceId: idea.id,
			});
		}
	} catch {
		// Ideas table may not exist yet
	}

	// 3. On-demand search supplement (if enabled)
	if (opts?.enableOnDemandSearch) {
		try {
			for (const pillar of pillars.slice(0, 2)) {
				const results = await searchAll(`${pillar.name} latest trends 2026`);
				for (const result of results.slice(0, 2)) {
					ideas.push({
						topic: result.title,
						pillar: pillar.name,
						angle: "trend",
						format: "thread",
						source: "trend" as PlanIdeaSource,
					});
				}
			}
		} catch {
			// Search providers may not be available
		}
	}

	// 4. Generated ideas (~20%)
	const generatedTarget = Math.ceil(targetCount * 0.2);
	try {
		const profile = await loadProfile(opts?.profilePath ?? "content/voice/personal.yaml");
		const suggestions = suggestTopics({
			profile,
			platform: (opts?.platform as "x" | "linkedin" | "instagram" | "tiktok") ?? "x",
			count: generatedTarget,
			fatiguedTopics: fatiguedTopics.map((t) => t.topic),
		});

		for (const suggestion of suggestions) {
			ideas.push({
				topic: suggestion.topic,
				pillar: suggestion.pillar,
				angle: suggestion.angle,
				format: suggestion.suggestedFormat,
				source: "generated" as PlanIdeaSource,
			});
		}
	} catch {
		// Voice profile may not exist
	}

	// 5. For never_posted users, generate sample post for top idea
	if (adaptation.showSamplePosts && ideas.length > 0) {
		try {
			const profile = await loadProfile(opts?.profilePath ?? "content/voice/personal.yaml");
			const topIdea = ideas[0];
			if (topIdea) {
				const samplePost = await generateSamplePost({
					profile,
					topic: topIdea.topic,
					platform: opts?.platform ?? "x",
				});
				topIdea.samplePost = samplePost;
			}
		} catch {
			// Voice profile may not exist, skip sample generation
		}
	}

	// Trim to target count
	return ideas.slice(0, targetCount);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBestPillar(
	relevance: Record<string, number> | null,
	pillars: Array<{ name: string }>,
): string {
	if (!relevance || Object.keys(relevance).length === 0) {
		return pillars[0]?.name ?? "general";
	}

	let bestPillar = pillars[0]?.name ?? "general";
	let bestScore = 0;

	for (const [pillar, score] of Object.entries(relevance)) {
		if (score > bestScore) {
			bestScore = score;
			bestPillar = pillar;
		}
	}

	return bestPillar;
}
