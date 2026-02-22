import {
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { ImportedContent } from "./import.ts";
import {
	createBlankSlateProfile,
	createDefaultProfile,
	type MaturityLevel,
	type VoiceProfile,
	voiceProfileSchema,
} from "./types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type InterviewPhase = "identity" | "style" | "platforms" | "language" | "review";

export interface InterviewState {
	phase: InterviewPhase;
	questionIndex: number;
	answers: Map<string, string>;
	detectedExperience: "beginner" | "intermediate" | "advanced" | null;
	maturityLevel: MaturityLevel | null;
	languages: ("en" | "es")[];
	importedContent: ImportedContent[] | null;
	isBlankSlate: boolean;
	isRecalibration: boolean;
	existingProfile?: VoiceProfile;
}

export interface InterviewQuestion {
	id: string;
	phase: InterviewPhase;
	text: string;
	hint?: string;
	type: "open" | "scale" | "choice" | "multi-choice";
	options?: string[];
	required: boolean;
	branchCondition?: string;
}

// Zod schema for InterviewState validation (answers stored as object, not Map)
const interviewStateSchema = z.object({
	phase: z.enum(["identity", "style", "platforms", "language", "review"]),
	questionIndex: z.number().int().min(0),
	answers: z.record(z.string()),
	detectedExperience: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
	maturityLevel: z.enum(["never_posted", "sporadic", "consistent", "very_active"]).nullable(),
	languages: z.array(z.enum(["en", "es"])),
	importedContent: z.array(z.any()).nullable(), // ImportedContent is complex, accept any for now
	isBlankSlate: z.boolean(),
	isRecalibration: z.boolean(),
	existingProfile: voiceProfileSchema.optional(),
});

// ─── Directory Creation ────────────────────────────────────────────────────────

/**
 * Ensure voice profile and strategy directories exist.
 * Creates directories with recursive: true to handle missing parent dirs.
 *
 * Directories created:
 * - content/voice/profiles/ - Entity-scoped voice profiles
 * - content/voice/strategies/ - Entity-scoped strategy configs
 *
 * Permissions: System default (typically 755)
 *
 * @throws Error if directories cannot be created (e.g., permission denied)
 */
export async function ensureVoiceDirectories(): Promise<void> {
	const directories = [
		"content/voice/profiles",
		"content/voice/strategies",
	];

	for (const dir of directories) {
		try {
			await mkdir(dir, { recursive: true });
		} catch (err) {
			if (err instanceof Error) {
				throw new Error(
					`Failed to create interview directory: ${dir}\n${err.message}\n\n` +
						`Please check that you have write permissions for the content/ directory.`,
				);
			}
			throw err;
		}
	}
}

// ─── Starter Archetypes ─────────────────────────────────────────────────────

export const STARTER_ARCHETYPES = [
	{
		name: "Thought Leader",
		description: "Shares original insights, trends analysis, and industry perspectives",
		style: { formality: 6, humor: 4, technicalDepth: 7, storytelling: 5, controversy: 5 },
	},
	{
		name: "Educator",
		description: "Teaches concepts, shares how-tos, and makes complex topics accessible",
		style: { formality: 5, humor: 5, technicalDepth: 8, storytelling: 6, controversy: 2 },
	},
	{
		name: "Storyteller",
		description: "Weaves personal experiences into lessons, uses narrative hooks",
		style: { formality: 3, humor: 6, technicalDepth: 4, storytelling: 9, controversy: 3 },
	},
	{
		name: "Curator",
		description: "Finds and contextualizes the best content, tools, and resources",
		style: { formality: 5, humor: 3, technicalDepth: 6, storytelling: 4, controversy: 2 },
	},
	{
		name: "Provocateur",
		description: "Challenges conventional wisdom, sparks debate with hot takes",
		style: { formality: 3, humor: 7, technicalDepth: 5, storytelling: 5, controversy: 8 },
	},
	{
		name: "Academic Researcher",
		description: "Shares papers, research findings, and academic insights",
		style: { formality: 8, humor: 2, technicalDepth: 9, storytelling: 6, controversy: 4 },
	},
] as const;

// ─── Question Banks ─────────────────────────────────────────────────────────

const IDENTITY_QUESTIONS: InterviewQuestion[] = [
	{
		id: "pillars",
		phase: "identity",
		text: "What 3-5 topics do you want to be known for?",
		hint: "These become your content pillars. E.g., 'AI engineering, TypeScript, startup life'",
		type: "open",
		required: true,
	},
	{
		id: "boundaries",
		phase: "identity",
		text: "Are there topics or tones you want to avoid?",
		hint: "E.g., 'politics, negativity about competitors, personal health details'",
		type: "open",
		required: true,
	},
	{
		id: "reference_voices",
		phase: "identity",
		text: "Who do you admire on social media? What about their style appeals to you?",
		hint: "Name 1-3 people and what you'd emulate. E.g., '@levelsio — transparent building, @naval — concise philosophy'",
		type: "open",
		required: false,
	},
	{
		id: "timezone",
		phase: "identity",
		text: "What's your timezone?",
		hint: "Used for accurate scheduling and analytics display",
		type: "choice",
		required: false,
		options: [
			"America/New_York",
			"America/Los_Angeles",
			"Europe/London",
			"Europe/Paris",
			"Asia/Tokyo",
			"Australia/Sydney",
			"UTC",
			"Other (I'll specify)",
		],
	},
	{
		id: "audience",
		phase: "identity",
		text: "Who are you trying to reach?",
		hint: "E.g., 'other developers, startup founders, tech-curious generalists'",
		type: "open",
		required: true,
	},
	{
		id: "goals",
		phase: "identity",
		text: "What does success look like for your social media presence?",
		hint: "E.g., 'thought leadership in my niche, driving traffic to my product, building a community'",
		type: "open",
		required: true,
	},
	{
		id: "posting_frequency",
		phase: "identity",
		text: "How often do you currently post on social media?",
		hint: "This helps us tailor the experience to your comfort level",
		type: "choice",
		options: [
			"Never posted / just starting",
			"Sporadically (a few times per month)",
			"Consistently (multiple times per week)",
			"Very active (daily or near-daily)",
		],
		required: true,
	},
];

const IDENTITY_QUESTIONS_BLANK_SLATE: InterviewQuestion[] = [
	{
		id: "archetype",
		phase: "identity",
		text: "Which of these styles resonates most with you?",
		hint: "Pick 1-2 as starting points. We'll refine from here.",
		type: "multi-choice",
		options: STARTER_ARCHETYPES.map((a) => `${a.name}: ${a.description}`),
		required: true,
	},
	{
		id: "pillars",
		phase: "identity",
		text: "What topics are you passionate about?",
		hint: "Just 2-3 to start. You can always add more later.",
		type: "open",
		required: true,
	},
	{
		id: "boundaries",
		phase: "identity",
		text: "Anything you definitely want to avoid posting about?",
		type: "open",
		required: false,
	},
];

const STYLE_QUESTIONS_BEGINNER: InterviewQuestion[] = [
	{
		id: "formality",
		phase: "style",
		text: "How formal do you want to sound?",
		hint: "1 = very casual (like texting a friend), 10 = very formal (like a conference keynote)",
		type: "scale",
		required: true,
	},
	{
		id: "humor",
		phase: "style",
		text: "How much humor in your posts?",
		hint: "1 = strictly serious, 10 = comedy-first",
		type: "scale",
		required: true,
	},
	{
		id: "emoji_preference",
		phase: "style",
		text: "How do you feel about emojis?",
		type: "choice",
		options: ["Never use them", "Sparingly", "Moderate", "Love them"],
		required: true,
	},
];

const STYLE_QUESTIONS_ADVANCED: InterviewQuestion[] = [
	{
		id: "writing_style",
		phase: "style",
		text: "Describe your writing style in 2-3 sentences.",
		hint: "E.g., 'Conversational but precise. I use short sentences for impact. Occasionally drop in dry humor.'",
		type: "open",
		required: true,
	},
	{
		id: "openings",
		phase: "style",
		text: "How do you typically start posts? Any signature patterns?",
		hint: "E.g., 'I often start with a question' or 'I lead with a bold statement'",
		type: "open",
		required: false,
	},
	{
		id: "vocabulary_preferences",
		phase: "style",
		text: "Any words or phrases you love using? Or hate?",
		type: "open",
		required: false,
	},
];

const PLATFORM_SELECT_QUESTION: InterviewQuestion = {
	id: "platform_select",
	phase: "platforms",
	text: "Which platforms do you want to post on?",
	hint: "You can add more platforms later via /psn:voice edit",
	type: "multi-choice",
	required: true,
	options: ["X (Twitter)", "LinkedIn", "Instagram", "TikTok"],
};

const PLATFORM_X_QUESTIONS: InterviewQuestion[] = [
	{
		id: "x_tone",
		phase: "platforms",
		text: "What's your X persona?",
		hint: "E.g., 'Thread-heavy, concise, uses threads for deep dives'",
		type: "choice",
		options: ["Casual", "Professional", "Newsy", "Opinionated"],
		required: false,
		branchCondition: "platform_x_selected",
	},
	{
		id: "x_hashtag",
		phase: "platforms",
		text: "How do you use hashtags on X?",
		hint: "E.g., 'Minimal' or 'Strategic (1-3 per post)'",
		type: "choice",
		options: ["Minimal", "Strategic (1-3 per post)", "Heavy (5-10)"],
		required: false,
		branchCondition: "platform_x_selected",
	},
	{
		id: "x_emoji",
		phase: "platforms",
		text: "How do you feel about emojis on X?",
		hint: "X tends to use fewer emojis than other platforms",
		type: "choice",
		options: ["None", "Rare", "Moderate", "Heavy"],
		required: false,
		branchCondition: "platform_x_selected",
	},
];

const PLATFORM_LINKEDIN_QUESTIONS: InterviewQuestion[] = [
	{
		id: "linkedin_tone",
		phase: "platforms",
		text: "What's your LinkedIn persona?",
		hint: "E.g., 'Professional but accessible, uses carousels for frameworks'",
		type: "choice",
		options: ["Professional", "Thought Leader", "Educational", "Storyteller"],
		required: false,
		branchCondition: "platform_linkedin_selected",
	},
	{
		id: "linkedin_format",
		phase: "platforms",
		text: "What content formats do you prefer on LinkedIn?",
		hint: "LinkedIn supports text, image, carousel, and document posts",
		type: "multi-choice",
		options: ["Text-only", "Image", "Carousel", "Document"],
		required: false,
		branchCondition: "platform_linkedin_selected",
	},
	{
		id: "linkedin_hashtag",
		phase: "platforms",
		text: "How do you use hashtags on LinkedIn?",
		hint: "E.g., 'Strategic (3-5)' or 'None'",
		type: "choice",
		options: ["Strategic (3-5)", "None"],
		required: false,
		branchCondition: "platform_linkedin_selected",
	},
	{
		id: "linkedin_emoji",
		phase: "platforms",
		text: "How do you feel about emojis on LinkedIn?",
		hint: "LinkedIn tends to be more conservative with emojis",
		type: "choice",
		options: ["None", "Rare (for emphasis only)"],
		required: false,
		branchCondition: "platform_linkedin_selected",
	},
];

const PLATFORM_INSTAGRAM_QUESTIONS: InterviewQuestion[] = [
	{
		id: "instagram_tone",
		phase: "platforms",
		text: "What's your Instagram persona?",
		hint: "E.g., 'Visual-first, uses Reels for dynamic content, strategic hashtags'",
		type: "choice",
		options: ["Visual", "Lifestyle", "Educational", "Behind-the-scenes"],
		required: false,
		branchCondition: "platform_instagram_selected",
	},
	{
		id: "instagram_format",
		phase: "platforms",
		text: "What content formats do you prefer on Instagram?",
		hint: "Instagram supports photo, carousel, and reel posts",
		type: "multi-choice",
		options: ["Photo", "Carousel", "Reel"],
		required: false,
		branchCondition: "platform_instagram_selected",
	},
	{
		id: "instagram_hashtag",
		phase: "platforms",
		text: "How do you use hashtags on Instagram?",
		hint: "E.g., 'Strategic (5-10)' or 'Heavy (15-30 max)'",
		type: "choice",
		options: ["Strategic (5-10)", "Heavy (15-30 max)"],
		required: false,
		branchCondition: "platform_instagram_selected",
	},
	{
		id: "instagram_emoji",
		phase: "platforms",
		text: "How do you feel about emojis on Instagram?",
		hint: "Instagram culture uses emojis heavily",
		type: "choice",
		options: ["Moderate", "Heavy (Instagram norm)"],
		required: false,
		branchCondition: "platform_instagram_selected",
	},
];

const PLATFORM_TIKTOK_QUESTIONS: InterviewQuestion[] = [
	{
		id: "tiktok_tone",
		phase: "platforms",
		text: "What's your TikTok persona?",
		hint: "E.g., 'Authentic and casual, jumps on trends, heavy emoji usage'",
		type: "choice",
		options: ["Entertaining", "Educational", "Trend-focused", "Authentic"],
		required: false,
		branchCondition: "platform_tiktok_selected",
	},
	{
		id: "tiktok_format",
		phase: "platforms",
		text: "What video length do you prefer on TikTok?",
		hint: "TikTok supports both short and long video formats",
		type: "choice",
		options: ["Short video (15-30s)", "Long video (30-60s)"],
		required: false,
		branchCondition: "platform_tiktok_selected",
	},
	{
		id: "tiktok_hashtag",
		phase: "platforms",
		text: "How do you use hashtags on TikTok?",
		hint: "E.g., 'Strategic (3-5)' or 'Heavy (trending tags)'",
		type: "choice",
		options: ["Strategic (3-5)", "Heavy (trending tags)"],
		required: false,
		branchCondition: "platform_tiktok_selected",
	},
	{
		id: "tiktok_emoji",
		phase: "platforms",
		text: "How do you feel about emojis on TikTok?",
		hint: "TikTok culture uses emojis heavily in comments and descriptions",
		type: "choice",
		options: ["Moderate", "Heavy (TikTok culture)"],
		required: false,
		branchCondition: "platform_tiktok_selected",
	},
];

const PLATFORM_QUESTIONS: InterviewQuestion[] = [
	PLATFORM_SELECT_QUESTION,
	...PLATFORM_X_QUESTIONS,
	...PLATFORM_LINKEDIN_QUESTIONS,
	...PLATFORM_INSTAGRAM_QUESTIONS,
	...PLATFORM_TIKTOK_QUESTIONS,
];

const LANGUAGE_QUESTIONS: InterviewQuestion[] = [
	{
		id: "bilingual",
		phase: "language",
		text: "Do you post in both English and Spanish?",
		type: "choice",
		options: ["English only", "Spanish only", "Both"],
		required: true,
	},
	{
		id: "spanish_tone",
		phase: "language",
		text: "Is your Spanish voice different from your English voice?",
		hint: "Some people are more formal in one language, more playful in another",
		type: "open",
		required: false,
		branchCondition: "bilingual_yes",
	},
	{
		id: "spanish_expressions",
		phase: "language",
		text: "Any favorite Spanish expressions or idioms you use?",
		type: "open",
		required: false,
		branchCondition: "bilingual_yes",
	},
];

// ─── State Management ───────────────────────────────────────────────────────

export function createInterviewState(options?: {
	recalibration?: boolean;
	existingProfile?: VoiceProfile;
	importedContent?: ImportedContent[];
}): InterviewState {
	return {
		phase: "identity",
		questionIndex: 0,
		answers: new Map(),
		detectedExperience: options?.importedContent?.length
			? detectExperienceLevel(new Map(), options.importedContent)
			: null,
		maturityLevel: null,
		languages: ["en"],
		importedContent: options?.importedContent ?? null,
		isBlankSlate: !options?.importedContent?.length && !options?.existingProfile,
		isRecalibration: options?.recalibration ?? false,
		existingProfile: options?.existingProfile,
	};
}

// ─── Question Generation ────────────────────────────────────────────────────

export function generateQuestions(state: InterviewState): InterviewQuestion[] {
	switch (state.phase) {
		case "identity":
			return state.isBlankSlate ? IDENTITY_QUESTIONS_BLANK_SLATE : IDENTITY_QUESTIONS;
		case "style":
			return state.detectedExperience === "advanced"
				? STYLE_QUESTIONS_ADVANCED
				: STYLE_QUESTIONS_BEGINNER;
		case "platforms":
			return PLATFORM_QUESTIONS;
		case "language":
			return LANGUAGE_QUESTIONS;
		case "review":
			return [];
	}
}

// ─── Answer Processing ──────────────────────────────────────────────────────

const PHASE_ORDER = [
	"identity",
	"style",
	"platforms",
	"language",
	"review",
] as const satisfies readonly InterviewPhase[];

export function processAnswer(
	state: InterviewState,
	questionId: string,
	answer: string,
): InterviewState {
	const updated = { ...state, answers: new Map(state.answers) };
	updated.answers.set(questionId, answer);

	// Detect experience from accumulating answers
	if (!updated.detectedExperience || updated.phase === "identity") {
		updated.detectedExperience = detectExperienceLevel(
			updated.answers,
			updated.importedContent ?? undefined,
		);
	}

	// Handle bilingual detection
	if (questionId === "bilingual") {
		if (answer.toLowerCase().includes("both") || answer.toLowerCase().includes("spanish")) {
			updated.languages = ["en", "es"];
		} else if (answer.toLowerCase().includes("spanish only")) {
			updated.languages = ["es"];
		}
	}

	// Handle maturity detection from posting_frequency answer
	if (questionId === "posting_frequency") {
		updated.maturityLevel = detectMaturityFromAnswer(answer);
	}

	// Auto-advance phase when current questions are exhausted
	const currentQuestions = generateQuestions(updated);
	const answeredInPhase = currentQuestions.filter((q) => updated.answers.has(q.id)).length;
	const requiredInPhase = currentQuestions.filter((q) => q.required).length;
	const answeredRequired = currentQuestions.filter(
		(q) => q.required && updated.answers.has(q.id),
	).length;

	if (answeredRequired >= requiredInPhase && answeredInPhase >= currentQuestions.length) {
		const currentIndex = PHASE_ORDER.indexOf(updated.phase);
		const nextPhase = PHASE_ORDER[currentIndex + 1];
		if (nextPhase) {
			updated.phase = nextPhase;
			updated.questionIndex = 0;
		}
	}

	return updated;
}

export function advancePhase(state: InterviewState): InterviewState {
	const currentIndex = PHASE_ORDER.indexOf(state.phase);
	const nextPhase = PHASE_ORDER[currentIndex + 1];
	if (nextPhase) {
		return {
			...state,
			phase: nextPhase,
			questionIndex: 0,
		};
	}
	return state;
}

// ─── Experience Detection ───────────────────────────────────────────────────

const ADVANCED_SIGNALS = [
	"engagement",
	"impressions",
	"analytics",
	"growth",
	"strategy",
	"algorithm",
	"hook",
	"cta",
	"conversion",
	"funnel",
	"a/b test",
	"scheduling",
	"batch",
	"content calendar",
];

export function detectExperienceLevel(
	answers: Map<string, string>,
	importedContent?: ImportedContent[],
): "beginner" | "intermediate" | "advanced" {
	let score = 0;

	// Check answers for advanced signals
	for (const answer of answers.values()) {
		const lower = answer.toLowerCase();
		for (const signal of ADVANCED_SIGNALS) {
			if (lower.includes(signal)) score++;
		}
	}

	// Imported content quantity signals experience
	if (importedContent) {
		if (importedContent.length > 100) score += 3;
		else if (importedContent.length > 30) score += 2;
		else if (importedContent.length > 0) score += 1;
	}

	if (score >= 5) return "advanced";
	if (score >= 2) return "intermediate";
	return "beginner";
}

// ─── Maturity Detection ──────────────────────────────────────────────────────

/**
 * Detect maturity level from posting_frequency answer.
 * Maps natural language answers to MaturityLevel enum.
 */
export function detectMaturityFromAnswer(answer: string): MaturityLevel | null {
	const lower = answer.toLowerCase();
	if (lower.includes("never") || lower.includes("starting")) return "never_posted";
	if (lower.includes("sporadically") || lower.includes("few times per month")) return "sporadic";
	if (lower.includes("consistently") || lower.includes("multiple times per week"))
		return "consistent";
	if (lower.includes("very active") || lower.includes("daily")) return "very_active";
	return null;
}

// ─── Profile Finalization ───────────────────────────────────────────────────

export function finalizeProfile(state: InterviewState): VoiceProfile {
	const base =
		state.isRecalibration && state.existingProfile
			? { ...state.existingProfile }
			: state.isBlankSlate
				? createBlankSlateProfile()
				: createDefaultProfile();

	// Identity
	const pillarsRaw = state.answers.get("pillars") ?? "";
	base.identity.pillars = pillarsRaw
		.split(/[,\n]/)
		.map((p) => p.trim())
		.filter(Boolean);

	const boundariesRaw = state.answers.get("boundaries") ?? "";
	base.identity.boundaries.avoid = boundariesRaw
		.split(/[,\n]/)
		.map((b) => b.trim())
		.filter(Boolean);

	// Reference voices
	const refsRaw = state.answers.get("reference_voices") ?? "";
	if (refsRaw) {
		base.identity.referenceVoices = refsRaw
			.split(/[,\n]/)
			.map((r) => r.trim())
			.filter(Boolean)
			.map((r) => ({ name: r, platform: "unknown", whatToEmulate: "" }));
	}

	// Archetypes (blank-slate path)
	const archetypeRaw = state.answers.get("archetype");
	if (archetypeRaw) {
		const selected = STARTER_ARCHETYPES.filter((a) =>
			archetypeRaw.toLowerCase().includes(a.name.toLowerCase()),
		);
		if (selected.length > 0) {
			const first = selected[0];
			if (first) {
				base.style.formality = first.style.formality;
				base.style.humor = first.style.humor;
				base.style.technicalDepth = first.style.technicalDepth;
				base.style.storytelling = first.style.storytelling;
				base.style.controversy = first.style.controversy;
			}
		}
	}

	// Style traits (beginner path)
	const formalityRaw = state.answers.get("formality");
	if (formalityRaw) {
		const val = Number.parseInt(formalityRaw, 10);
		if (!Number.isNaN(val)) base.style.formality = Math.min(10, Math.max(1, val));
	}

	const humorRaw = state.answers.get("humor");
	if (humorRaw) {
		const val = Number.parseInt(humorRaw, 10);
		if (!Number.isNaN(val)) base.style.humor = Math.min(10, Math.max(1, val));
	}

	// Languages
	if (state.languages.includes("en")) {
		base.languages.en = base.languages.en ?? {
			vocabulary: [],
			sentencePatterns: [],
			openingStyles: [],
			closingStyles: [],
			idioms: [],
		};
	}
	if (state.languages.includes("es")) {
		base.languages.es = {
			vocabulary: [],
			sentencePatterns: [],
			openingStyles: [],
			closingStyles: [],
			idioms: [],
		};
		const spanishExpressions = state.answers.get("spanish_expressions") ?? "";
		if (spanishExpressions) {
			base.languages.es.idioms = spanishExpressions
				.split(/[,\n]/)
				.map((e) => e.trim())
				.filter(Boolean);
		}
	}

	// Platform personas - check which platforms are selected
	const platformSelectAnswer = state.answers.get("platform_select") ?? "";
	const selectedPlatforms: Set<string> = new Set();

	if (platformSelectAnswer.toLowerCase().includes("x") || platformSelectAnswer.toLowerCase().includes("twitter")) {
		selectedPlatforms.add("x");
	}
	if (platformSelectAnswer.toLowerCase().includes("linkedin")) {
		selectedPlatforms.add("linkedin");
	}
	if (platformSelectAnswer.toLowerCase().includes("instagram")) {
		selectedPlatforms.add("instagram");
	}
	if (platformSelectAnswer.toLowerCase().includes("tiktok")) {
		selectedPlatforms.add("tiktok");
	}

	// Helper function to map hashtag style answer to enum
	const mapHashtagStyle = (answer: string): "none" | "minimal" | "strategic" | "heavy" => {
		const lower = answer.toLowerCase();
		if (lower.includes("none") || lower.includes("no")) return "none";
		if (lower.includes("minimal")) return "minimal";
		if (lower.includes("strategic")) return "strategic";
		if (lower.includes("heavy")) return "heavy";
		return "minimal";
	};

	// Helper function to map emoji usage answer to enum
	const mapEmojiUsage = (answer: string): "none" | "rare" | "moderate" | "heavy" => {
		const lower = answer.toLowerCase();
		if (lower.includes("none") || lower.includes("no")) return "none";
		if (lower.includes("rare") || lower.includes("sparingly") || lower.includes("for emphasis")) return "rare";
		if (lower.includes("moderate")) return "moderate";
		if (lower.includes("heavy") || lower.includes("love") || lower.includes("norm") || lower.includes("culture")) return "heavy";
		return "rare";
	};

	// X platform persona
	if (selectedPlatforms.has("x")) {
		const tone = state.answers.get("x_tone") ?? "casual";
		const hashtagStyle = mapHashtagStyle(state.answers.get("x_hashtag") ?? "minimal");
		const emojiUsage = mapEmojiUsage(state.answers.get("x_emoji") ?? "rare");

		base.platforms.x = {
			tone,
			formatPreferences: [],
			hashtagStyle,
			emojiUsage,
		};
	}

	// LinkedIn platform persona
	if (selectedPlatforms.has("linkedin")) {
		const tone = state.answers.get("linkedin_tone") ?? "professional";
		const formatRaw = state.answers.get("linkedin_format") ?? "";
		const formatPreferences = formatRaw
			.split(",")
			.map((f) => f.trim().toLowerCase())
			.filter(Boolean);
		const hashtagStyle = mapHashtagStyle(state.answers.get("linkedin_hashtag") ?? "strategic");
		const emojiUsage = mapEmojiUsage(state.answers.get("linkedin_emoji") ?? "rare");

		base.platforms.linkedin = {
			tone,
			formatPreferences,
			hashtagStyle,
			emojiUsage,
		};
	}

	// Instagram platform persona
	if (selectedPlatforms.has("instagram")) {
		const tone = state.answers.get("instagram_tone") ?? "visual";
		const formatRaw = state.answers.get("instagram_format") ?? "";
		const formatPreferences = formatRaw
			.split(",")
			.map((f) => f.trim().toLowerCase())
			.filter(Boolean);
		const hashtagStyle = mapHashtagStyle(state.answers.get("instagram_hashtag") ?? "strategic");
		const emojiUsage = mapEmojiUsage(state.answers.get("instagram_emoji") ?? "moderate");

		base.platforms.instagram = {
			tone,
			formatPreferences,
			hashtagStyle,
			emojiUsage,
		};
	}

	// TikTok platform persona
	if (selectedPlatforms.has("tiktok")) {
		const tone = state.answers.get("tiktok_tone") ?? "authentic";
		const formatRaw = state.answers.get("tiktok_format") ?? "";
		const formatPreferences = formatRaw
			.split(",")
			.map((f) => f.trim().toLowerCase())
			.filter(Boolean);
		const hashtagStyle = mapHashtagStyle(state.answers.get("tiktok_hashtag") ?? "strategic");
		const emojiUsage = mapEmojiUsage(state.answers.get("tiktok_emoji") ?? "heavy");

		base.platforms.tiktok = {
			tone,
			formatPreferences,
			hashtagStyle,
			emojiUsage,
		};
	}

	// Calibration state
	if (state.isRecalibration && state.existingProfile) {
		// Preserve existing calibration data during recalibration
		base.calibration = { ...state.existingProfile.calibration };
	} else if (state.importedContent?.length) {
		base.calibration.status = "calibrating";
		base.calibration.confidence = 0.3;
	}

	// Maturity level
	if (state.maturityLevel) {
		base.maturityLevel = state.maturityLevel;
	}

	// Update timestamps
	const now = new Date().toISOString();
	base.updatedAt = now;
	if (!state.isRecalibration) {
		base.createdAt = now;
	}

	// Validate before returning
	const result = voiceProfileSchema.safeParse(base);
	if (!result.success) {
		// Return a valid default if finalization produced invalid data
		return createDefaultProfile();
	}

	return result.data;
}

// ─── State Persistence ─────────────────────────────────────────────────────────

/**
 * Generate a unique interview ID based on timestamp.
 * Used for concurrent interview support.
 *
 * @returns Timestamp-based ID (e.g., "lw8f9j2k")
 */
export function generateInterviewId(): string {
	return Date.now().toString(36);
}

/**
 * Get the file path for interview state.
 *
 * @param interviewId - Optional interview ID for concurrent interviews
 * @returns Path to interview state JSON file
 */
export function getInterviewStatePath(interviewId?: string): string {
	if (interviewId) {
		return `content/voice/.interview-${interviewId}.json`;
	}
	return "content/voice/.interview.json";
}

/**
 * Save interview state to JSON file with atomic write pattern.
 * Converts Map to object for JSON serialization, validates before writing.
 *
 * @param state - Interview state to save
 * @param interviewId - Optional interview ID for concurrent interviews
 * @throws Error if state validation fails
 */
export async function saveInterviewState(
	state: InterviewState,
	interviewId?: string,
): Promise<void> {
	const path = getInterviewStatePath(interviewId);

	// Convert Map to object for JSON serialization
	const stateForJson = {
		...state,
		answers: Object.fromEntries(state.answers),
	};

	// Validate state before writing
	const result = interviewStateSchema.safeParse(stateForJson);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
		throw new Error(`Invalid interview state: ${issues}`);
	}

	const content = JSON.stringify(result.data, null, 2);
	const tmpPath = `${path}.tmp`;

	// Atomic write: write to temp file, then rename
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, path);
}

/**
 * Load interview state from JSON file with validation.
 *
 * @param interviewId - Optional interview ID for concurrent interviews
 * @returns Interview state or null if file doesn't exist
 * @throws Error if state is corrupted (validation fails)
 */
export async function loadInterviewState(
	interviewId?: string,
): Promise<InterviewState | null> {
	const path = getInterviewStatePath(interviewId);

	try {
		const content = await readFile(path, "utf-8");
		const parsed = JSON.parse(content);

		// Validate loaded state
		const result = interviewStateSchema.safeParse(parsed);
		if (!result.success) {
			const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
			throw new Error(
				`Corrupted interview state at ${path}\nValidation errors: ${issues}\n\n` +
					`To fix: Delete the file and restart the interview.\nCommand: rm ${path}`,
			);
		}

		// Convert answers back to Map
		return {
			...result.data,
			answers: new Map(Object.entries(result.data.answers)),
		};
	} catch (err) {
		const error = err as { code?: string };
		if (error.code === "ENOENT") {
			return null; // File doesn't exist, return null (not an error)
		}
		throw err; // Re-throw other errors
	}
}

/**
 * List all interview state files with metadata.
 *
 * @returns Array of interview metadata (id, path, age in milliseconds)
 */
export async function listInterviews(): Promise<
	{ id: string; path: string; ageMs: number }[]
> {
	const voiceDir = "content/voice";
	try {
		const files = await readdir(voiceDir);
		const interviews: { id: string; path: string; ageMs: number }[] = [];

		for (const file of files) {
			const match = file.match(/^\.interview-(.+)\.json$/) ||
				file === ".interview.json";
			if (match) {
				const fullPath = join(voiceDir, file);
				const stats = await stat(fullPath);
				const ageMs = Date.now() - stats.mtimeMs;

				if (file === ".interview.json") {
					interviews.push({ id: "default", path: fullPath, ageMs });
				} else {
					interviews.push({ id: match[1]!, path: fullPath, ageMs });
				}
			}
		}

		// Sort by age (newest first)
		interviews.sort((a, b) => a.ageMs - b.ageMs);
		return interviews;
	} catch (err) {
		const error = err as { code?: string };
		if (error.code === "ENOENT") {
			return []; // Directory doesn't exist yet
		}
		throw err;
	}
}

/**
 * Clean up old interview state files.
 *
 * @param maxAgeMs - Maximum age in milliseconds before cleanup (default: 7 days)
 */
export async function cleanupOldInterviews(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
	const interviews = await listInterviews();
	let cleaned = 0;

	for (const interview of interviews) {
		if (interview.ageMs > maxAgeMs) {
			await rm(interview.path);
			cleaned++;
			console.log(`Cleaned up old interview: ${interview.path} (${(interview.ageMs / 1000 / 60 / 60 / 24).toFixed(1)} days old)`);
		}
	}

	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} old interview file(s)`);
	}
}

/**
 * Delete a specific interview state file.
 * Used after completing an interview.
 *
 * @param interviewId - Interview ID (undefined for default interview)
 */
export async function deleteInterviewState(interviewId?: string): Promise<void> {
	const path = getInterviewStatePath(interviewId);
	await rm(path);
}
