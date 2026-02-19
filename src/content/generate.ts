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

	// Platform-specific content guidance
	if (platform === "instagram") {
		sections.push("\n## Instagram Content Guidance");
		sections.push(`- Max caption: ${INSTAGRAM_CONTENT_GUIDANCE.maxCaptionLength} chars`);
		sections.push(`- ${INSTAGRAM_CONTENT_GUIDANCE.hashtagStrategy}`);
		for (const pattern of INSTAGRAM_CONTENT_GUIDANCE.patterns) {
			sections.push(`- ${pattern}`);
		}
	}

	if (platform === "tiktok") {
		sections.push("\n## TikTok Content Guidance");
		sections.push(`- Max title: ${TIKTOK_CONTENT_GUIDANCE.maxTitleLength} chars`);
		sections.push(`- Max description: ${TIKTOK_CONTENT_GUIDANCE.maxDescriptionLength} chars`);
		sections.push(`- Video script: Hook (${TIKTOK_CONTENT_GUIDANCE.videoScriptFormat.hook})`);
		sections.push(`- Video script: Body (${TIKTOK_CONTENT_GUIDANCE.videoScriptFormat.body})`);
		sections.push(`- Video script: CTA (${TIKTOK_CONTENT_GUIDANCE.videoScriptFormat.cta})`);
		for (const pattern of TIKTOK_CONTENT_GUIDANCE.patterns) {
			sections.push(`- ${pattern}`);
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

// ─── LinkedIn Content Guidance ───────────────────────────────────────────────

/** Platform-specific content generation guidance constants */
export const LINKEDIN_CONTENT_GUIDANCE = {
	optimalLength: { min: 1000, max: 1300 },
	maxLength: 3000,
	patterns: [
		"Use a strong hook in the first line (question, bold statement, or surprising fact)",
		"Add line breaks after the hook for readability",
		"Use short paragraphs (1-3 sentences each)",
		"Include a CTA (call-to-action) at the end when appropriate",
		"Add 3-5 relevant hashtags at the end (not inline)",
		"Professional but authentic tone — not corporate speak",
		"LinkedIn rewards vulnerability and personal experience",
	],
	hashtagLimit: 5,
} as const;

export const X_CONTENT_GUIDANCE = {
	maxLength: 280,
	patterns: [
		"Short, punchy, and direct",
		"Hook readers in the first few words",
		"Use clear, conversational language",
	],
} as const;

export const INSTAGRAM_CONTENT_GUIDANCE = {
	maxCaptionLength: 2200,
	defaultHashtagCount: 15,
	maxHashtags: 30,
	patterns: [
		"Instagram favors visual storytelling — Reels get 30.81% reach rate",
		"Caption should complement the visual, not duplicate it",
		"Use a strong hook in the first line (shown before 'more' button)",
		"Add line breaks for readability (Instagram truncates at ~125 chars)",
		"End with a CTA (save this, share with someone, comment your thoughts)",
		"Hashtags: append at end of caption or first comment",
		"Carousel: each slide should tell part of a story or list item",
	],
	hashtagStrategy: "Append 10-15 relevant hashtags at end of caption from hashtag pool",
} as const;

export const TIKTOK_CONTENT_GUIDANCE = {
	maxTitleLength: 90,
	maxDescriptionLength: 4000,
	patterns: [
		"TikTok algorithm strongly favors video — default to video content",
		"Hook viewers in the first 3 seconds (critical for retention)",
		"Video script format: Hook (0-3s) -> Body (value delivery) -> CTA (end)",
		"Keep it authentic and conversational — polished corporate content underperforms",
		"Trending sounds and formats boost discoverability",
		"Description: use keywords for search, hashtags for discovery",
		"Short-form (15-60s) gets highest completion rates",
	],
	videoScriptFormat: {
		hook: "First 3 seconds: surprising fact, bold statement, or visual hook",
		body: "Core value: tutorial steps, story beats, or key points",
		cta: "End with clear action: follow, comment, save, or try this",
	},
} as const;

// ─── Content Adaptation ─────────────────────────────────────────────────────

/**
 * Adapt content from one platform format to another.
 * Returns adapted content string with platform-appropriate adjustments.
 *
 * X -> LinkedIn: Expand short content, add hook + line breaks, add CTA, add hashtags
 * LinkedIn -> X: Condense to key point, split to thread if needed
 */
export function adaptContentForPlatform(
	content: string,
	fromPlatform: Platform,
	toPlatform: Platform,
): string {
	if (fromPlatform === toPlatform) return content;

	if (fromPlatform === "x" && toPlatform === "linkedin") {
		// X -> LinkedIn: content is likely short, needs expansion
		const lines = content.split("\n").filter((l) => l.trim());
		const adapted = [
			lines[0] ?? content, // Hook (first line)
			"", // Line break after hook (LinkedIn pattern)
			...lines.slice(1),
			"", // Space before hashtags
			"#ContentCreation #SocialMedia", // Placeholder hashtags
		];
		return adapted.join("\n");
	}

	if (fromPlatform === "linkedin" && toPlatform === "x") {
		// LinkedIn -> X: condense to key point
		const lines = content.split("\n").filter((l) => l.trim());
		// Take the hook (first line) and first substantive line
		const hook = lines[0] ?? "";
		// Strip hashtags from the condensed version
		const condensed = hook.replace(/#\w+/g, "").trim();
		return condensed.length > 280 ? `${condensed.slice(0, 277)}...` : condensed;
	}

	// X/LinkedIn -> Instagram: visual focus, add hashtags
	if (toPlatform === "instagram") {
		const lines = content.split("\n").filter((l) => l.trim());
		const caption = lines.join("\n\n");
		// Truncate to Instagram max caption length
		return caption.length > 2200 ? `${caption.slice(0, 2197)}...` : caption;
	}

	// Any -> TikTok: condense to video script format with hook/body/CTA
	if (toPlatform === "tiktok") {
		const lines = content.split("\n").filter((l) => l.trim());
		const hook = lines[0] ?? content;
		const body = lines.slice(1, -1).join("\n");
		const cta = lines[lines.length - 1] ?? "";
		const script = [
			`[HOOK - 0-3s] ${hook}`,
			body ? `[BODY] ${body}` : "",
			cta ? `[CTA] ${cta}` : "",
		]
			.filter(Boolean)
			.join("\n\n");
		return script.length > 4000 ? `${script.slice(0, 3997)}...` : script;
	}

	// Default: return as-is
	return content;
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
