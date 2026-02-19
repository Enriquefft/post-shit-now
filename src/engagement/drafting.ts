import type { VoiceProfile } from "../voice/types.ts";
import type { EngagementOpportunity, SuggestedEngagement } from "./types.ts";

// ─── Draft Types ──────────────────────────────────────────────────────────

export interface ReplyDraft {
	content: string;
	tone: string;
	engagementType: SuggestedEngagement;
	approach: "direct" | "conversational" | "unique-angle";
}

export interface QuotePostDraft {
	content: string;
	commentary: string;
}

export interface RepostCommentaryDraft {
	commentary: string;
}

export interface DuetStitchDraft {
	script: string;
	hookLine: string;
}

// ─── Platform Character Limits ────────────────────────────────────────────

const PLATFORM_REPLY_LIMITS: Record<string, number> = {
	x: 280,
	linkedin: 1250,
	instagram: 2200,
	tiktok: 150,
};

// ─── Voice Context Extraction ─────────────────────────────────────────────

interface VoiceContext {
	formality: number;
	humor: number;
	tone: string;
	pillars: string[];
	avoid: string[];
	vocabulary: string[];
}

/**
 * Extract voice context from profile, adapting to target platform.
 */
function extractVoiceContext(
	voiceProfile: VoiceProfile,
	platform: string,
): VoiceContext {
	const platformPersona = voiceProfile.platforms[platform as keyof typeof voiceProfile.platforms];
	const primaryLang = voiceProfile.languages.en ?? voiceProfile.languages.es;

	return {
		formality: voiceProfile.style.formality,
		humor: voiceProfile.style.humor,
		tone: platformPersona?.tone ?? "professional",
		pillars: voiceProfile.identity.pillars,
		avoid: voiceProfile.identity.boundaries.avoid,
		vocabulary: primaryLang?.vocabulary ?? [],
	};
}

// ─── Thread Tone Analysis ─────────────────────────────────────────────────

type ThreadTone = "formal" | "casual" | "technical" | "humorous";

/**
 * Analyze the tone of the original post for context-adaptive voice matching.
 * Returns the detected tone so replies can adapt while keeping user's voice recognizable.
 */
function analyzeThreadTone(postSnippet: string): ThreadTone {
	const lower = postSnippet.toLowerCase();

	// Humorous indicators
	const humorSignals = ["lol", "lmao", "haha", "😂", "🤣", "funny", "joke"];
	if (humorSignals.some((s) => lower.includes(s))) return "humorous";

	// Technical indicators
	const techSignals = [
		"algorithm",
		"implementation",
		"architecture",
		"api",
		"database",
		"deployment",
		"infrastructure",
		"latency",
		"throughput",
		"benchmark",
	];
	if (techSignals.filter((s) => lower.includes(s)).length >= 2) return "technical";

	// Formal indicators
	const formalSignals = [
		"furthermore",
		"moreover",
		"consequently",
		"therefore",
		"hereby",
		"regarding",
		"pursuant",
	];
	if (formalSignals.some((s) => lower.includes(s))) return "formal";

	// Default to casual
	return "casual";
}

/**
 * Adapt formality level based on thread tone while keeping user's base style.
 * Returns an adjusted formality (1-10) that blends toward the thread's tone.
 */
function adaptFormality(baseFormality: number, threadTone: ThreadTone): number {
	const toneTargets: Record<ThreadTone, number> = {
		formal: 8,
		casual: 3,
		technical: 7,
		humorous: 2,
	};

	const target = toneTargets[threadTone];
	// Blend 70% user's base + 30% thread tone
	return Math.round(baseFormality * 0.7 + target * 0.3);
}

// ─── Reply Drafting ───────────────────────────────────────────────────────

/**
 * Generate 2-3 reply options for a given opportunity.
 * Each option varies in approach: direct, conversational, unique-angle.
 * Context-adaptive: analyzes thread tone, adapts voice while keeping recognizable.
 *
 * Returns structured data for Claude to present to the user (never auto-posts).
 */
export function draftReplies(params: {
	opportunity: EngagementOpportunity;
	voiceProfile: VoiceProfile;
	count?: number;
}): ReplyDraft[] {
	const { opportunity, voiceProfile, count = 3 } = params;
	const voice = extractVoiceContext(voiceProfile, opportunity.platform);
	const threadTone = analyzeThreadTone(opportunity.postSnippet);
	const adaptedFormality = adaptFormality(voice.formality, threadTone);
	const charLimit = PLATFORM_REPLY_LIMITS[opportunity.platform] ?? 280;

	const drafts: ReplyDraft[] = [];

	// Build context for Claude to use when generating actual reply text
	const contextBlock = buildReplyContext({
		opportunity,
		voice,
		threadTone,
		adaptedFormality,
		charLimit,
	});

	// Option 1: Direct/concise
	drafts.push({
		content: contextBlock.direct,
		tone: `${threadTone}-adapted, formality ${adaptedFormality}/10`,
		engagementType: opportunity.suggestedType ?? "reply",
		approach: "direct",
	});

	// Option 2: Conversational/expanded
	if (count >= 2) {
		drafts.push({
			content: contextBlock.conversational,
			tone: `${threadTone}-adapted, formality ${Math.max(1, adaptedFormality - 1)}/10`,
			engagementType: opportunity.suggestedType ?? "reply",
			approach: "conversational",
		});
	}

	// Option 3: Unique angle/question
	if (count >= 3) {
		drafts.push({
			content: contextBlock.uniqueAngle,
			tone: `${threadTone}-adapted, formality ${adaptedFormality}/10, with question`,
			engagementType: opportunity.suggestedType ?? "reply",
			approach: "unique-angle",
		});
	}

	return drafts;
}

// ─── Context Builder (for Claude to generate actual text) ─────────────────

interface ReplyContext {
	direct: string;
	conversational: string;
	uniqueAngle: string;
}

function buildReplyContext(params: {
	opportunity: EngagementOpportunity;
	voice: VoiceContext;
	threadTone: ThreadTone;
	adaptedFormality: number;
	charLimit: number;
}): ReplyContext {
	const { opportunity, voice, threadTone, adaptedFormality, charLimit } = params;

	// These are structured prompts/context blocks that Claude will use
	// to generate the actual reply text during the engagement session.
	// The content brain pattern: assemble context, Claude generates.

	const baseContext = [
		`Platform: ${opportunity.platform} (max ${charLimit} chars)`,
		`Original post by @${opportunity.authorHandle}: "${opportunity.postSnippet.slice(0, 200)}"`,
		`Thread tone: ${threadTone}`,
		`Voice: formality ${adaptedFormality}/10, humor ${voice.humor}/10, tone "${voice.tone}"`,
		`Pillars: ${voice.pillars.join(", ")}`,
		voice.vocabulary.length > 0 ? `Vocabulary hints: ${voice.vocabulary.slice(0, 5).join(", ")}` : "",
		voice.avoid.length > 0 ? `AVOID: ${voice.avoid.join(", ")}` : "",
	]
		.filter(Boolean)
		.join("\n");

	return {
		direct: `[DRAFT CONTEXT - DIRECT]\n${baseContext}\nApproach: Concise, to-the-point response. Share a clear perspective or insight.`,
		conversational: `[DRAFT CONTEXT - CONVERSATIONAL]\n${baseContext}\nApproach: Expanded, warm response. Build on the original point, add personal experience or anecdote.`,
		uniqueAngle: `[DRAFT CONTEXT - UNIQUE ANGLE]\n${baseContext}\nApproach: Offer a surprising perspective or ask a thought-provoking question that adds to the discussion.`,
	};
}

// ─── Quote Post Drafting ──────────────────────────────────────────────────

/**
 * Generate a quote post/repost-with-commentary.
 * Adds user's perspective on the original content. Longer form than reply.
 */
export function draftQuotePost(params: {
	opportunity: EngagementOpportunity;
	voiceProfile: VoiceProfile;
}): QuotePostDraft {
	const { opportunity, voiceProfile } = params;
	const voice = extractVoiceContext(voiceProfile, opportunity.platform);
	const threadTone = analyzeThreadTone(opportunity.postSnippet);
	const adaptedFormality = adaptFormality(voice.formality, threadTone);

	const charLimit = opportunity.platform === "x" ? 280 : 3000;

	const context = [
		`[DRAFT CONTEXT - QUOTE POST]`,
		`Platform: ${opportunity.platform} (max ${charLimit} chars for commentary)`,
		`Original post by @${opportunity.authorHandle}: "${opportunity.postSnippet.slice(0, 300)}"`,
		`Thread tone: ${threadTone}`,
		`Voice: formality ${adaptedFormality}/10, humor ${voice.humor}/10, tone "${voice.tone}"`,
		`Pillars: ${voice.pillars.join(", ")}`,
		voice.avoid.length > 0 ? `AVOID: ${voice.avoid.join(", ")}` : "",
		`Approach: Add your own perspective. Why does this matter? What's your take? Connect to your expertise.`,
	]
		.filter(Boolean)
		.join("\n");

	return {
		content: context,
		commentary: context,
	};
}

// ─── Repost Commentary Drafting ───────────────────────────────────────────

/**
 * Generate commentary for repost/share.
 * Brief take on why the content matters.
 */
export function draftRepostCommentary(params: {
	opportunity: EngagementOpportunity;
	voiceProfile: VoiceProfile;
}): RepostCommentaryDraft {
	const { opportunity, voiceProfile } = params;
	const voice = extractVoiceContext(voiceProfile, opportunity.platform);

	const context = [
		`[DRAFT CONTEXT - REPOST COMMENTARY]`,
		`Platform: ${opportunity.platform}`,
		`Original by @${opportunity.authorHandle}: "${opportunity.postSnippet.slice(0, 200)}"`,
		`Voice: formality ${voice.formality}/10, tone "${voice.tone}"`,
		`Approach: Brief take (1-2 sentences) on why this content matters. Signal-boost with context.`,
	].join("\n");

	return { commentary: context };
}

// ─── Duet/Stitch Drafting (TikTok) ───────────────────────────────────────

/**
 * Generate script for TikTok duet or stitch.
 * Hook that references original, user's take, CTA.
 */
export function draftDuetStitch(params: {
	opportunity: EngagementOpportunity;
	voiceProfile: VoiceProfile;
	type: "duet" | "stitch";
}): DuetStitchDraft {
	const { opportunity, voiceProfile, type } = params;
	const voice = extractVoiceContext(voiceProfile, "tiktok");

	const typeLabel = type === "duet" ? "side-by-side reaction" : "clip-and-continue";

	const context = [
		`[DRAFT CONTEXT - TIKTOK ${type.toUpperCase()}]`,
		`Type: ${typeLabel}`,
		`Original by @${opportunity.authorHandle}: "${opportunity.postSnippet.slice(0, 200)}"`,
		`Voice: formality ${voice.formality}/10, humor ${voice.humor}/10`,
		`Structure:`,
		`  1. Hook line (references original, grabs attention)`,
		`  2. Your take (expertise-driven perspective, 15-30 seconds)`,
		`  3. CTA (question or prompt for engagement)`,
		`Approach: ${type === "duet" ? "React authentically, add your angle" : "Build on the original point, teach something new"}`,
	].join("\n");

	return {
		script: context,
		hookLine: `[Hook referencing @${opportunity.authorHandle}'s point about "${opportunity.postSnippet.slice(0, 50)}..."]`,
	};
}
