import type { Platform } from "../core/types/index.ts";
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

const ANGLES = [
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
}): TopicSuggestion[] {
	const { profile, platform, count = 3 } = params;
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

	return suggestions;
}

// ─── Idea Bank Stub (Phase 5) ───────────────────────────────────────────────

export async function checkIdeaBank(): Promise<{
	hasReadyIdeas: boolean;
	readyCount: number;
}> {
	// Stub for Phase 5 — idea bank doesn't exist yet
	// When Phase 5 adds the idea bank table, this will query for status=ready ideas
	return { hasReadyIdeas: false, readyCount: 0 };
}
