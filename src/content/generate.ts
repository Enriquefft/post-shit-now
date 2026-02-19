import { isTopicFatigued } from "../analytics/fatigue.ts";
import { resolveHub } from "../cli/post-finish.ts";
import { createHubConnection } from "../core/db/connection.ts";
import type { Platform } from "../core/types/index.ts";
import { getPreferenceModel } from "../learning/preference-model.ts";
import { loadProfile } from "../voice/profile.ts";
import type { VoiceProfile } from "../voice/types.ts";
import { saveDraft } from "./drafts.ts";
import { type FormatSuggestion, type PostFormat, pickFormat } from "./format-picker.ts";
import { checkIdeaBank, suggestTopics, type TopicSuggestion } from "./topic-suggest.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GeneratePostOptions {
	topic?: string;
	platform: Platform;
	persona?: "personal" | "brand-operator" | "brand-ambassador";
	language?: "en" | "es" | "both";
	format?: PostFormat;
	variations?: number;
	mediaType?: "image" | "video" | "none";
	mediaHints?: string[];
	profilePath?: string;
	databaseUrl?: string;
	userId?: string;
}

export interface GeneratedDraft {
	content: string;
	format: PostFormat;
	formatSuggestion: FormatSuggestion;
	platform: Platform;
	persona: string;
	language: string;
	draftId: string;
	draftPath: string;
	voiceContext: string;
	topicSuggestions?: TopicSuggestion[];
	mediaGenerated?: boolean;
	mediaPath?: string;
	ideaBankStatus?: { hasReadyIdeas: boolean; readyCount: number };
	preferenceLearnings?: PreferenceLearnings | null;
	fatigueWarning?: {
		topic: string;
		suggestion: string;
	};
	/** When language is "both", contains independently crafted versions in each language */
	bilingualPair?: { en: GeneratedDraft; es: GeneratedDraft };
}

export interface PreferenceLearnings {
	hooks: string[];
	formats: string[];
	fatiguedTopics: string[];
}

// ─── Build Voice Prompt Context ─────────────────────────────────────────────

export function buildVoicePromptContext(
	profile: VoiceProfile,
	platform: Platform,
	language: "en" | "es",
): string {
	const sections: string[] = [];

	// Style traits
	sections.push("## Voice Style");
	sections.push(`- Formality: ${profile.style.formality}/10`);
	sections.push(`- Humor: ${profile.style.humor}/10`);
	sections.push(`- Technical depth: ${profile.style.technicalDepth}/10`);
	sections.push(`- Storytelling: ${profile.style.storytelling}/10`);
	sections.push(`- Controversy tolerance: ${profile.style.controversy}/10`);

	// Platform persona
	const platformPersona = profile.platforms[platform];
	if (platformPersona) {
		sections.push(`\n## ${platform} Persona`);
		sections.push(`- Tone: ${platformPersona.tone}`);
		sections.push(`- Hashtag style: ${platformPersona.hashtagStyle}`);
		sections.push(`- Emoji usage: ${platformPersona.emojiUsage}`);
		if (platformPersona.formatPreferences.length > 0) {
			sections.push(`- Format preferences: ${platformPersona.formatPreferences.join(", ")}`);
		}
		if (platformPersona.maxLength) {
			sections.push(`- Max length: ${platformPersona.maxLength} chars`);
		}
	}

	// Language-specific patterns
	const langVoice = profile.languages[language];
	if (langVoice) {
		sections.push(`\n## Language (${language})`);
		if (langVoice.vocabulary.length > 0) {
			sections.push(`- Preferred vocabulary: ${langVoice.vocabulary.join(", ")}`);
		}
		if (langVoice.sentencePatterns.length > 0) {
			sections.push(`- Sentence patterns: ${langVoice.sentencePatterns.join("; ")}`);
		}
		if (langVoice.openingStyles.length > 0) {
			sections.push(`- Opening styles: ${langVoice.openingStyles.join("; ")}`);
		}
		if (langVoice.closingStyles.length > 0) {
			sections.push(`- Closing styles: ${langVoice.closingStyles.join("; ")}`);
		}
		if (langVoice.idioms.length > 0) {
			sections.push(`- Idioms/expressions: ${langVoice.idioms.join(", ")}`);
		}
	}

	// Boundaries
	if (profile.identity.boundaries.avoid.length > 0) {
		sections.push("\n## Boundaries");
		sections.push(`- AVOID: ${profile.identity.boundaries.avoid.join(", ")}`);
	}
	if (profile.identity.boundaries.cautious.length > 0) {
		sections.push(`- CAUTIOUS: ${profile.identity.boundaries.cautious.join(", ")}`);
	}

	// Reference voices
	if (profile.identity.referenceVoices.length > 0) {
		sections.push("\n## Reference Voices");
		for (const ref of profile.identity.referenceVoices) {
			sections.push(`- ${ref.name} (${ref.platform}): ${ref.whatToEmulate}`);
		}
	}

	// Calibration status
	sections.push(`\n## Calibration`);
	sections.push(`- Status: ${profile.calibration.status}`);
	sections.push(`- Confidence: ${Math.round(profile.calibration.confidence * 100)}%`);

	return sections.join("\n");
}

// ─── Preference Model Learnings ──────────────────────────────────────────────

export async function getPreferenceModelLearnings(
	_platform: Platform,
	options?: { databaseUrl?: string; userId?: string },
): Promise<PreferenceLearnings | null> {
	if (!options?.databaseUrl) return null;

	try {
		const db = createHubConnection(options.databaseUrl);
		const userId = options.userId ?? "default";
		const model = await getPreferenceModel(db, userId);

		if (!model) return null;

		// Extract top 3 hook patterns
		const hooks = (model.hookPatterns as string[] | null)?.slice(0, 3) ?? [];

		// Extract top 3 format names sorted by score
		const topFormats = model.topFormats as Array<{ format: string; avgScore: number }> | null;
		const formats = topFormats
			? [...topFormats]
					.sort((a, b) => b.avgScore - a.avgScore)
					.slice(0, 3)
					.map((f) => f.format)
			: [];

		// Extract fatigued topics with active cooldowns only
		const fatiguedEntries = model.fatiguedTopics as Array<{
			topic: string;
			cooldownUntil: string;
			lastScores: number[];
		}> | null;
		const fatiguedTopics = fatiguedEntries
			? fatiguedEntries
					.filter((ft) => isTopicFatigued(ft.topic, fatiguedEntries))
					.map((ft) => ft.topic)
			: [];

		return { hooks, formats, fatiguedTopics };
	} catch {
		// Graceful fallback — DB unavailable
		return null;
	}
}

// ─── Generate Post ──────────────────────────────────────────────────────────

export async function generatePost(options: GeneratePostOptions): Promise<GeneratedDraft> {
	const persona = options.persona ?? "personal";
	const language = options.language ?? "en";

	// Two-pass generation for bilingual "both" (POST-08)
	if (language === "both") {
		const enDraft = await generatePost({ ...options, language: "en" });
		const esDraft = await generatePost({ ...options, language: "es" });

		// Return the English draft as primary with bilingual pair attached
		return {
			...enDraft,
			language: "both",
			bilingualPair: { en: enDraft, es: esDraft },
		};
	}

	// Load voice profile
	let profilePath = options.profilePath;
	if (!profilePath) {
		switch (persona) {
			case "personal":
				profilePath = "content/voice/personal.yaml";
				break;
			case "brand-operator":
				profilePath = "content/voice/brand-operator.yaml";
				break;
			case "brand-ambassador":
				profilePath = "content/voice/brand-ambassador.yaml";
				break;
		}
	}

	const profile = await loadProfile(profilePath);

	// Check idea bank (POST-11 stub)
	const ideaBankStatus = await checkIdeaBank();

	// Pre-fetch preference learnings for topic suggestions
	const earlyLearnings = await getPreferenceModelLearnings(options.platform, {
		databaseUrl: options.databaseUrl,
		userId: options.userId,
	});

	// Topic suggestions if no topic provided
	let topicSuggestions: TopicSuggestion[] | undefined;
	if (!options.topic && !ideaBankStatus.hasReadyIdeas) {
		topicSuggestions = suggestTopics({
			profile,
			platform: options.platform,
			count: 3,
			fatiguedTopics: earlyLearnings?.fatiguedTopics,
		});
	}

	// Pick format
	const formatSuggestion = pickFormat({
		platform: options.platform,
		contentType: options.topic,
		hasMedia: options.mediaType !== "none" && options.mediaType !== undefined,
		voicePreferences: profile.platforms[options.platform]?.formatPreferences,
	});
	const format = options.format ?? formatSuggestion.recommended;

	// Build voice context
	const voiceContext = buildVoicePromptContext(profile, options.platform, language);

	// Reuse early learnings query (already fetched above for topic suggestions)
	const preferenceLearnings = earlyLearnings;

	// Check topic fatigue and build warning if applicable
	let fatigueWarning: GeneratedDraft["fatigueWarning"];
	if (options.topic && preferenceLearnings?.fatiguedTopics.length) {
		const matchedFatigued = preferenceLearnings.fatiguedTopics.find((ft) =>
			options.topic?.toLowerCase().includes(ft.toLowerCase()),
		);
		if (matchedFatigued) {
			fatigueWarning = {
				topic: matchedFatigued,
				suggestion: `Topic "${matchedFatigued}" has been cooling -- consider rotating to a different content pillar`,
			};
		}
	}

	// Build initial content (placeholder for Claude to fill in via slash command)
	const content = options.topic
		? `[Draft for ${options.platform}] Topic: ${options.topic}`
		: "[Awaiting topic selection]";

	// Determine hub routing based on persona (SCHED-06)
	const hub = resolveHub(persona);

	// Save draft shell
	const { draftPath, draftId } = await saveDraft({
		content,
		platform: options.platform,
		format,
		persona,
		language,
		hub,
		metadata: {
			topic: options.topic,
			mediaType: options.mediaType,
			mediaHints: options.mediaHints,
			hub,
		},
	});

	return {
		content,
		format,
		formatSuggestion,
		platform: options.platform,
		persona,
		language,
		draftId,
		draftPath,
		voiceContext,
		topicSuggestions,
		ideaBankStatus,
		preferenceLearnings,
		fatigueWarning,
	};
}
