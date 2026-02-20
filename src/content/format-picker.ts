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
const ACADEMIC_KEYWORDS = [
	"paper",
	"research",
	"study",
	"findings",
	"published",
	"accepted",
	"journal",
	"conference",
	"academic",
	"publication",
	"results",
];

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

	if (hasKeywords(type, ACADEMIC_KEYWORDS)) {
		return {
			recommended: "thread",
			alternatives: [{ format: "short-post", reason: "Condense into single tweet" }],
			reasoning:
				"Academic content works well as threads — break down research into digestible chunks (problem → methods → findings → implications)",
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

const LINKEDIN_LIST_KEYWORDS = [
	"list",
	"steps",
	"framework",
	"comparison",
	"how to",
	"tips",
	"guide",
	"walkthrough",
	"ranking",
];
const LINKEDIN_EXTERNAL_KEYWORDS = ["article", "blog", "link", "resource", "read", "check out"];

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

	// Academic content -> carousel (research findings and data visualization)
	if (hasKeywords(type, ACADEMIC_KEYWORDS)) {
		return {
			recommended: "carousel",
			alternatives: [
				{ format: "long-post", reason: "Long-form text version (1000-1300 chars)" },
				{ format: "infographic", reason: "Single-image data visualization" },
			],
			reasoning:
				"Research findings and data visualization work best as LinkedIn carousels (11.2x impressions)",
		};
	}

	// Lists, steps, frameworks, how-tos, comparisons -> carousel (auto-suggested)
	if (hasKeywords(type, LINKEDIN_LIST_KEYWORDS) || hasKeywords(type, DATA_KEYWORDS)) {
		return {
			recommended: "carousel",
			alternatives: [
				{ format: "long-post", reason: "Long-form text version (1000-1300 chars)" },
				{ format: "infographic", reason: "Single-image data visualization" },
			],
			reasoning:
				"Carousels dominate LinkedIn with 11.2x impressions vs text — auto-suggested for list/step/framework content",
		};
	}

	// Stories, experiences, lessons learned -> long-post
	if (hasKeywords(type, STORY_KEYWORDS)) {
		return {
			recommended: "long-post",
			alternatives: [
				{ format: "carousel", reason: "Visual storytelling carousel" },
				{ format: "image-post", reason: "Story with a key image" },
			],
			reasoning:
				"Personal stories perform well as long-form LinkedIn text posts (1000-1300 chars optimal)",
		};
	}

	// External reference with commentary -> linkedin-article
	if (hasKeywords(type, LINKEDIN_EXTERNAL_KEYWORDS)) {
		return {
			recommended: "linkedin-article",
			alternatives: [
				{ format: "long-post", reason: "Commentary without link preview" },
				{ format: "carousel", reason: "Break down article points visually" },
			],
			reasoning: "External content works well as LinkedIn article posts with link preview",
		};
	}

	// Quotes, inspiration -> quote-image
	if (hasKeywords(type, QUOTE_KEYWORDS)) {
		return {
			recommended: "quote-image",
			alternatives: [
				{ format: "long-post", reason: "Text-based quote with context" },
				{ format: "carousel", reason: "Quote collection carousel" },
			],
			reasoning: "Quote content works well as visual quote images on LinkedIn",
		};
	}

	// Hot takes -> long-post (but recommend expanding for LinkedIn)
	if (hasKeywords(type, TREND_KEYWORDS)) {
		return {
			recommended: "long-post",
			alternatives: [
				{ format: "carousel", reason: "Break down the take into slides" },
				{ format: "short-post", reason: "Quick punchy take (expand recommended)" },
			],
			reasoning: "Hot takes perform well as longer LinkedIn posts with context and reasoning",
		};
	}

	// Default to carousel on LinkedIn
	return {
		recommended: "carousel",
		alternatives: [
			{ format: "long-post", reason: "Long-form text post" },
			{ format: "image-post", reason: "Single image with insight" },
		],
		reasoning: "Default to carousel on LinkedIn for maximum reach (11.2x impressions vs text)",
	};
}

// ─── Instagram Format Keywords ───────────────────────────────────────────────

const IG_REEL_KEYWORDS = [
	"tutorial",
	"how to",
	"behind the scenes",
	"behind-the-scenes",
	"day in the life",
	"trending",
	"challenge",
	"reaction",
	"transformation",
	"before and after",
	"storytelling",
	"vlog",
	"grwm",
	"routine",
	"process",
];
const IG_CAROUSEL_KEYWORDS = [
	"list",
	"steps",
	"framework",
	"comparison",
	"educational",
	"tips",
	"guide",
	"ranking",
	"myths",
	"mistakes",
	"lessons",
	"facts",
	"swipe",
	"slide",
	"part 1",
];
const IG_QUOTE_KEYWORDS = ["quote", "motivation", "inspiration", "wisdom", "mindset"];

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

	// Academic content -> reel-script (visual explanations of research concepts)
	if (hasKeywords(type, ACADEMIC_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [
				{ format: "carousel", reason: "Step-by-step breakdown visual" },
				{ format: "image-post", reason: "Single finding as image" },
			],
			reasoning: "Visual explanations of research concepts perform well as Reels",
		};
	}

	// Reels: tutorials, how-to, behind-scenes, storytelling, trending
	if (hasKeywords(type, IG_REEL_KEYWORDS) || hasKeywords(type, TREND_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [
				{ format: "carousel", reason: "Step-by-step visual alternative" },
				{ format: "image-post", reason: "Static post version" },
			],
			reasoning:
				"Reels dominate Instagram reach (30.81%) — best for tutorials, trends, and storytelling",
		};
	}

	// Carousel: lists, steps, frameworks, comparisons, educational
	if (hasKeywords(type, IG_CAROUSEL_KEYWORDS) || hasKeywords(type, DATA_KEYWORDS)) {
		return {
			recommended: "carousel",
			alternatives: [
				{ format: "reel-script", reason: "Video walkthrough for higher reach" },
				{ format: "image-post", reason: "Single summary image" },
			],
			reasoning:
				"Carousel posts drive saves and shares — ideal for educational/list content on Instagram",
		};
	}

	// Quotes, announcements -> feed image
	if (hasKeywords(type, IG_QUOTE_KEYWORDS) || hasKeywords(type, QUOTE_KEYWORDS)) {
		return {
			recommended: "quote-image",
			alternatives: [
				{ format: "carousel", reason: "Quote collection carousel" },
				{ format: "reel-script", reason: "Animated quote reel" },
			],
			reasoning: "Quote content works well as visual images on Instagram",
		};
	}

	// Story/experience content -> Reel (bias toward Reels when ambiguous)
	if (hasKeywords(type, STORY_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [
				{ format: "carousel", reason: "Story as visual slides" },
				{ format: "image-post", reason: "Key moment as single image" },
			],
			reasoning:
				"Story content performs best as Reels on Instagram — biasing toward video for reach",
		};
	}

	// Default: bias toward Reels (30.81% reach rate beats static posts)
	return {
		recommended: "reel-script",
		alternatives: [
			{ format: "image-post", reason: "Static visual for simpler content" },
			{ format: "carousel", reason: "Multi-slide for deeper content" },
		],
		reasoning:
			"Default to Reels on Instagram for maximum reach (30.81% reach rate, 55% views from non-followers)",
	};
}

// ─── TikTok Format Keywords ─────────────────────────────────────────────────

const TT_PHOTO_KEYWORDS = [
	"gallery",
	"photo dump",
	"outfit",
	"aesthetic",
	"collection",
	"before and after photos",
	"screenshot",
];

function pickFormatTikTok(type: string, prefFormat?: PostFormat): FormatSuggestion {
	if (prefFormat && (prefFormat === "video-post" || prefFormat === "reel-script")) {
		return {
			recommended: prefFormat,
			alternatives: [{ format: "reel-script", reason: "Short-form video" }],
			reasoning: `Using preferred format: ${prefFormat}`,
		};
	}

	// Photo: purely visual gallery content (rare — most content should be video)
	if (hasKeywords(type, TT_PHOTO_KEYWORDS)) {
		return {
			recommended: "video-post",
			alternatives: [{ format: "reel-script", reason: "Short clip instead of photos" }],
			reasoning: "Photo content on TikTok — consider video slideshow for better algorithm reach",
		};
	}

	// How-to -> short-form video (reel-script)
	if (hasKeywords(type, HOWTO_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [{ format: "video-post", reason: "Longer tutorial format" }],
			reasoning: "Tutorial-style short videos perform well on TikTok",
		};
	}

	// Trending/controversy -> short-form video
	if (hasKeywords(type, TREND_KEYWORDS)) {
		return {
			recommended: "reel-script",
			alternatives: [{ format: "video-post", reason: "Extended take format" }],
			reasoning: "Trending content as quick-take short video for TikTok algorithm",
		};
	}

	// Default: video (TikTok strongly favors video)
	return {
		recommended: "video-post",
		alternatives: [{ format: "reel-script", reason: "Shorter clip version" }],
		reasoning: "TikTok is video-first — all content should default to video",
	};
}
