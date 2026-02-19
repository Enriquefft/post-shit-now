import type { HubDb } from "../core/db/connection.ts";
import type { Platform } from "../core/types/index.ts";
import { getReadyIdeas } from "../ideas/bank.ts";
import type { VoiceProfile } from "../voice/types.ts";
import type { PostFormat } from "./format-picker.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TopicSuggestion {
	topic: string;
	pillar: string;
	angle: string;
	suggestedFormat: PostFormat;
}

// ─── Angle Templates ────────────────────────────────────────────────────────

export const ANGLES = [
	{ name: "hot-take", template: "Hot take: {pillar}", format: "short-post" as PostFormat },
	{ name: "how-to", template: "How to {pillar}", format: "thread" as PostFormat },
	{
		name: "story",
		template: "A lesson I learned about {pillar}",
		format: "short-post" as PostFormat,
	},
	{
		name: "trend",
		template: "What's changing in {pillar} right now",
		format: "thread" as PostFormat,
	},
	{
		name: "myth-busting",
		template: "The biggest myth about {pillar}",
		format: "short-post" as PostFormat,
	},
	{
		name: "comparison",
		template: "{pillar}: what most people get wrong",
		format: "carousel" as PostFormat,
	},
	{
		name: "prediction",
		template: "Where {pillar} is headed in the next year",
		format: "thread" as PostFormat,
	},
	{
		name: "behind-the-scenes",
		template: "Behind the scenes of my {pillar} work",
		format: "image-post" as PostFormat,
	},
	{
		name: "tool-recommendation",
		template: "Best tools for {pillar}",
		format: "carousel" as PostFormat,
	},
	{
		name: "quick-tip",
		template: "Quick {pillar} tip that changed everything",
		format: "short-post" as PostFormat,
	},
];

// Platform-specific format overrides
const PLATFORM_FORMAT_MAP: Record<Platform, Partial<Record<string, PostFormat>>> = {
	x: { "how-to": "thread", story: "thread" },
	linkedin: { "how-to": "carousel", comparison: "carousel", "tool-recommendation": "carousel" },
	instagram: { "hot-take": "reel-script", trend: "reel-script" },
	tiktok: { "hot-take": "reel-script", "how-to": "reel-script", story: "reel-script" },
};

// ─── Topic Suggestion ───────────────────────────────────────────────────────

let angleRotationIndex = 0;

export function suggestTopics(params: {
	profile: VoiceProfile;
	platform: Platform;
	count?: number;
	fatiguedTopics?: string[];
}): TopicSuggestion[] {
	const { profile, platform, count = 3, fatiguedTopics = [] } = params;
	const pillars = profile.identity.pillars;

	if (pillars.length === 0) {
		return [
			{
				topic: "Share something you learned this week",
				pillar: "general",
				angle: "story",
				suggestedFormat: platform === "tiktok" ? "reel-script" : "short-post",
			},
		];
	}

	const suggestions: TopicSuggestion[] = [];

	for (let i = 0; i < count; i++) {
		// Rotate through pillars and angles
		const pillar = pillars[i % pillars.length] ?? pillars[0];
		if (!pillar) continue;

		const angle = ANGLES[(angleRotationIndex + i) % ANGLES.length];
		if (!angle) continue;

		// Apply platform-specific format override
		const platformOverride = PLATFORM_FORMAT_MAP[platform][angle.name];
		const format = platformOverride ?? angle.format;

		suggestions.push({
			topic: angle.template.replace("{pillar}", pillar),
			pillar,
			angle: angle.name,
			suggestedFormat: format,
		});
	}

	// Advance rotation to avoid repeating on next call
	angleRotationIndex = (angleRotationIndex + count) % ANGLES.length;

	// Deprioritize fatigued topics: move them to end with "cooling" label
	if (fatiguedTopics.length > 0) {
		const fatiguedSet = new Set(fatiguedTopics.map((t) => t.toLowerCase()));
		const fresh: TopicSuggestion[] = [];
		const cooling: TopicSuggestion[] = [];

		for (const s of suggestions) {
			const isFatigued =
				fatiguedSet.has(s.pillar.toLowerCase()) ||
				fatiguedTopics.some((ft) => s.topic.toLowerCase().includes(ft.toLowerCase()));
			if (isFatigued) {
				cooling.push({
					...s,
					topic: `${s.topic} (cooling)`,
				});
			} else {
				fresh.push(s);
			}
		}

		return [...fresh, ...cooling];
	}

	return suggestions;
}

// ─── Idea Bank Check ────────────────────────────────────────────────────────

/**
 * Check the idea bank for ready ideas. Wired to real implementation in Phase 5.
 * Falls back to empty if no DB provided (backward compatible for non-DB contexts).
 */
export async function checkIdeaBank(
	db?: HubDb,
	userId?: string,
): Promise<{
	hasReadyIdeas: boolean;
	readyCount: number;
	ideas: Array<{ id: string; title: string; pillar: string | null }>;
}> {
	if (!db || !userId) {
		return { hasReadyIdeas: false, readyCount: 0, ideas: [] };
	}

	try {
		const readyIdeas = await getReadyIdeas(db, userId, { limit: 10 });
		return {
			hasReadyIdeas: readyIdeas.length > 0,
			readyCount: readyIdeas.length,
			ideas: readyIdeas.map((i) => ({
				id: i.id,
				title: i.title,
				pillar: i.pillar,
			})),
		};
	} catch {
		// Graceful fallback if ideas table doesn't exist
		return { hasReadyIdeas: false, readyCount: 0, ideas: [] };
	}
}
