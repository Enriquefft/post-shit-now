import type { Platform } from "../core/types/index.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PostFormat =
	| "short-post"
	| "long-post"
	| "thread"
	| "carousel"
	| "image-post"
	| "reel-script"
	| "video-post"
	| "quote-image"
	| "infographic"
	| "linkedin-article";

export interface FormatSuggestion {
	recommended: PostFormat;
	alternatives: Array<{ format: PostFormat; reason: string }>;
	reasoning: string;
}

export interface FormatOptions {
	available: Array<{ format: PostFormat; description: string; maxChars?: number }>;
	voicePreference?: PostFormat;
	hasMedia: boolean;
	contentLength?: number;
}

// ─── Format Constraints ─────────────────────────────────────────────────────

export const FORMAT_CONSTRAINTS: Record<PostFormat, { maxChars?: number; description: string }> = {
	"short-post": { maxChars: 280, description: "Single short text post" },
	"long-post": {
		maxChars: 3000,
		description: "Long-form LinkedIn text post (optimal 1000-1300 chars)",
	},
	thread: { description: "Multi-part thread (X) or long-form post (LinkedIn)" },
	carousel: { description: "Multi-slide visual content (LinkedIn document post, Instagram)" },
	"image-post": { description: "Text post with accompanying image" },
	"reel-script": { description: "Short-form video script (Instagram Reels, TikTok)" },
	"video-post": { description: "Video content with optional text caption" },
	"quote-image": { description: "Quote or text rendered as an image" },
	infographic: { description: "Data visualization or informational graphic" },
	"linkedin-article": { description: "LinkedIn article with URL, title, and description" },
};

// ─── Platform Format Support Map ────────────────────────────────────────────

/** Which formats are supported on each platform */
export const PLATFORM_FORMAT_SUPPORT: Record<Platform, PostFormat[]> = {
	x: ["short-post", "thread", "image-post", "video-post", "quote-image"],
	linkedin: [
		"short-post",
		"long-post",
		"carousel",
		"image-post",
		"linkedin-article",
		"video-post",
		"quote-image",
		"infographic",
	],
	instagram: ["image-post", "carousel", "reel-script", "video-post", "quote-image"],
	tiktok: ["video-post", "reel-script"],
};

// ─── Format Options (data for the LLM to decide) ───────────────────────────

export function getFormatOptions(params: {
	platform: Platform;
	contentLength?: number;
	hasMedia?: boolean;
	voicePreferences?: string[];
}): FormatOptions {
	const { platform, contentLength, hasMedia, voicePreferences } = params;

	const supported = PLATFORM_FORMAT_SUPPORT[platform];
	const available = supported.map((format) => {
		const constraint = FORMAT_CONSTRAINTS[format];
		return {
			format,
			description: constraint.description,
			...(constraint.maxChars != null ? { maxChars: constraint.maxChars } : {}),
		};
	});

	const voicePreference = voicePreferences?.find((p) => supported.includes(p as PostFormat)) as
		| PostFormat
		| undefined;

	return {
		available,
		voicePreference,
		hasMedia: hasMedia ?? false,
		contentLength,
	};
}

/** @deprecated Use getFormatOptions — returns FormatOptions instead of FormatSuggestion */
export const pickFormat = getFormatOptions;
