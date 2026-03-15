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

// ─── Topic Suggestion ────────────────────────────────────────────────────────

export interface IdeaBankStatus {
	hasReadyIdeas: boolean;
	readyCount: number;
	ideas: Array<{ id: string; title: string; pillar: string | null }>;
}

/**
 * Aggregates raw pillars, fatigue data, and idea bank items into TopicSuggestion[].
 * Does NOT decide angles or formats — the caller (Claude) handles creative decisions.
 */
export function suggestTopics(params: {
	profile: VoiceProfile;
	platform: Platform;
	count?: number;
	fatiguedTopics?: string[];
	ideaBankStatus?: IdeaBankStatus;
}): TopicSuggestion[] {
	const { profile, count = 3, fatiguedTopics = [], ideaBankStatus } = params;
	const pillars = profile.identity.pillars;

	// POST-11: Mix in ready ideas from bank if available
	// Ready ideas appear first in suggestions, prioritized over pillar-based topics
	const suggestions: TopicSuggestion[] = [];
	if (ideaBankStatus?.hasReadyIdeas && ideaBankStatus.readyCount > 0) {
		for (const idea of ideaBankStatus.ideas) {
			suggestions.push({
				topic: `Ready: ${idea.title} (${idea.pillar ?? "general"})`,
				pillar: idea.pillar ?? "general",
				angle: "idea-bank",
				suggestedFormat: "short-post",
			});
		}
	}

	if (pillars.length === 0) {
		return suggestions.length > 0
			? suggestions
			: [{ topic: "general", pillar: "general", angle: "raw", suggestedFormat: "short-post" }];
	}

	// Emit raw pillars — caller decides angle and format
	for (let i = suggestions.length; i < count; i++) {
		const pillar = pillars[(i - suggestions.length) % pillars.length] ?? pillars[0];
		if (!pillar) continue;

		suggestions.push({
			topic: pillar,
			pillar,
			angle: "raw",
			suggestedFormat: "short-post",
		});
	}

	// Deprioritize fatigued pillars: move them to end with "cooling" label
	if (fatiguedTopics.length > 0) {
		const fatiguedSet = new Set(fatiguedTopics.map((t) => t.toLowerCase()));
		const fresh: TopicSuggestion[] = [];
		const cooling: TopicSuggestion[] = [];

		for (const s of suggestions) {
			const isFatigued =
				fatiguedSet.has(s.pillar.toLowerCase()) ||
				fatiguedTopics.some((ft) => s.topic.toLowerCase().includes(ft.toLowerCase()));
			if (isFatigued) {
				cooling.push({ ...s, topic: `${s.topic} (cooling)` });
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
 * Check the idea bank for ready ideas.
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
