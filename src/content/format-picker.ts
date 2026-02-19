import type { Platform } from "../core/types/index.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PostFormat =
	| "short-post"
	| "thread"
	| "carousel"
	| "image-post"
	| "reel-script"
	| "video-post"
	| "quote-image"
	| "infographic";

export interface FormatSuggestion {
	recommended: PostFormat;
	alternatives: Array<{ format: PostFormat; reason: string }>;
	reasoning: string;
}

// ─── Format Constraints ─────────────────────────────────────────────────────

export const FORMAT_CONSTRAINTS: Record<PostFormat, { maxChars?: number; description: string }> = {
	"short-post": { maxChars: 280, description: "Single short text post" },
	thread: { description: "Multi-part thread (X) or long-form post (LinkedIn)" },
	carousel: { description: "Multi-slide visual content (LinkedIn, Instagram)" },
	"image-post": { description: "Text post with accompanying image" },
	"reel-script": { description: "Short-form video script (Instagram Reels, TikTok)" },
	"video-post": { description: "Video content with optional text caption" },
	"quote-image": { description: "Quote or text rendered as an image" },
	infographic: { description: "Data visualization or informational graphic" },
};

// ─── Content Type Keywords ──────────────────────────────────────────────────

const DATA_KEYWORDS = [
	"data",
	"stats",
	"statistics",
	"numbers",
	"chart",
	"graph",
	"list",
	"comparison",
	"ranking",
	"results",
];
const STORY_KEYWORDS = [
	"story",
	"experience",
	"learned",
	"journey",
	"happened",
	"realized",
	"behind the scenes",
];
const HOWTO_KEYWORDS = ["how to", "tutorial", "guide", "steps", "tips", "tricks", "walkthrough"];
const QUOTE_KEYWORDS = ["quote", "said", "wisdom", "inspiration", "words"];
const TREND_KEYWORDS = ["trend", "hot take", "controversial", "unpopular opinion", "debate"];

function hasKeywords(text: string, keywords: string[]): boolean {
	const lower = text.toLowerCase();
	return keywords.some((k) => lower.includes(k));
}

// ─── Format Selection ───────────────────────────────────────────────────────

export function pickFormat(params: {
	platform: Platform;
	contentLength?: number;
	contentType?: string;
	hasMedia?: boolean;
	voicePreferences?: string[];
}): FormatSuggestion {
	const { platform, contentLength, contentType, hasMedia, voicePreferences } = params;
	const type = contentType ?? "";

	// Check if voice preferences suggest a format
	const prefFormat = voicePreferences?.find((p) => Object.keys(FORMAT_CONSTRAINTS).includes(p)) as
		| PostFormat
		| undefined;

	switch (platform) {
		case "x":
			return pickFormatX(type, contentLength, hasMedia, prefFormat);
		case "linkedin":
			return pickFormatLinkedIn(type, hasMedia, prefFormat);
		case "instagram":
			return pickFormatInstagram(type, hasMedia, prefFormat);
		case "tiktok":
			return pickFormatTikTok(type, prefFormat);
	}
}

function pickFormatX(
	type: string,
	contentLength?: number,
	hasMedia?: boolean,
	prefFormat?: PostFormat,
): FormatSuggestion {
	if (prefFormat) {
		return {
			recommended: prefFormat,
			alternatives: [{ format: "short-post", reason: "Quick engagement" }],
			reasoning: `Using preferred format: ${prefFormat}`,
		};
	}

	if (hasKeywords(type, QUOTE_KEYWORDS)) {
		return {
			recommended: "quote-image",
			alternatives: [{ format: "short-post", reason: "Text-only version" }],
			reasoning: "Quote content works well as a visual quote image on X",
		};
	}

	if (hasKeywords(type, DATA_KEYWORDS)) {
		return {
			recommended: "infographic",
			alternatives: [{ format: "thread", reason: "Break data into a narrative thread" }],
			reasoning: "Data-heavy content performs well as an infographic on X",
		};
	}

	if (contentLength && contentLength > 280) {
		return {
			recommended: "thread",
			alternatives: [{ format: "image-post", reason: "Condense into image with key points" }],
			reasoning: "Content exceeds 280 chars, best as a thread",
		};
	}

	if (hasMedia) {
		return {
			recommended: "image-post",
			alternatives: [{ format: "short-post", reason: "Text-only version" }],
			reasoning: "Media content enhances engagement on X",
		};
	}

	return {
		recommended: "short-post",
		alternatives: [
			{ format: "thread", reason: "Expand into a deeper thread" },
			{ format: "image-post", reason: "Add a visual to boost engagement" },
		],
		reasoning: "Short, punchy posts perform well on X",
	};
}

function pickFormatLinkedIn(
	type: string,
	_hasMedia?: boolean,
	prefFormat?: PostFormat,
): FormatSuggestion {
	if (prefFormat) {
		return {
			recommended: prefFormat,
			alternatives: [{ format: "carousel", reason: "Carousels get 11.2x impressions" }],
			reasoning: `Using preferred format: ${prefFormat}`,
		};
	}

	if (hasKeywords(type, DATA_KEYWORDS) || hasKeywords(type, HOWTO_KEYWORDS)) {
		return {
			recommended: "carousel",
			alternatives: [
				{ format: "short-post", reason: "Quick insight post" },
				{ format: "infographic", reason: "Single-image data visualization" },
			],
			reasoning: "Carousels dominate LinkedIn with 11.2x impressions vs text posts",
		};
	}

	if (hasKeywords(type, STORY_KEYWORDS)) {
		return {
			recommended: "short-post",
			alternatives: [{ format: "carousel", reason: "Visual storytelling carousel" }],
			reasoning: "Personal stories perform well as text posts on LinkedIn",
		};
	}

	return {
		recommended: "carousel",
		alternatives: [
			{ format: "short-post", reason: "Quick engagement post" },
			{ format: "image-post", reason: "Single image with insight" },
		],
		reasoning: "Default to carousel on LinkedIn for maximum reach",
	};
}

function pickFormatInstagram(
	type: string,
	_hasMedia?: boolean,
	prefFormat?: PostFormat,
): FormatSuggestion {
	if (prefFormat) {
		return {
			recommended: prefFormat,
			alternatives: [{ format: "reel-script", reason: "Reels get 30.81% reach rate" }],
			reasoning: `Using preferred format: ${prefFormat}`,
		};
	}

	if (hasKeywords(type, HOWTO_KEYWORDS) || hasKeywords(type, DATA_KEYWORDS)) {
		return {
			recommended: "carousel",
			alternatives: [{ format: "reel-script", reason: "Short tutorial reel" }],
			reasoning: "Educational content works well as Instagram carousels",
		};
	}

	if (hasKeywords(type, TREND_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [{ format: "image-post", reason: "Static hot take post" }],
			reasoning: "Trending content gets maximum reach as Reels (30.81% reach rate)",
		};
	}

	return {
		recommended: "image-post",
		alternatives: [
			{ format: "carousel", reason: "Multi-slide for deeper content" },
			{ format: "reel-script", reason: "Video for maximum reach" },
		],
		reasoning: "Visual content is core to Instagram engagement",
	};
}

function pickFormatTikTok(type: string, prefFormat?: PostFormat): FormatSuggestion {
	if (prefFormat && (prefFormat === "video-post" || prefFormat === "reel-script")) {
		return {
			recommended: prefFormat,
			alternatives: [{ format: "reel-script", reason: "Short-form video" }],
			reasoning: `Using preferred format: ${prefFormat}`,
		};
	}

	if (hasKeywords(type, HOWTO_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [{ format: "video-post", reason: "Longer tutorial format" }],
			reasoning: "Tutorial-style short videos perform well on TikTok",
		};
	}

	return {
		recommended: "video-post",
		alternatives: [{ format: "reel-script", reason: "Shorter clip version" }],
		reasoning: "TikTok is video-first — all content should be video",
	};
}
