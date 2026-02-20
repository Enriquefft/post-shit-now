import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Platform } from "../core/types/index.ts";
import { PLATFORM_VIDEO_SPECS } from "./platform-specs.ts";
import { klingProvider } from "./providers/kling.ts";
import { pikaProvider } from "./providers/pika.ts";
import { runwayProvider } from "./providers/runway.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export type VideoMode = "text-to-video" | "image-to-video";

export interface VideoProvider {
	name: string;
	strengths: string[];
	supportedModes: VideoMode[];
	generate(params: VideoGenParams, db: PostgresJsDatabase, hubId: string): Promise<GeneratedVideo>;
}

export interface VideoGenParams {
	prompt: string;
	mode: VideoMode;
	sourceImage?: string;
	duration: number;
	aspectRatio?: string;
	withAudio?: boolean;
}

export interface GeneratedVideo {
	url: string;
	buffer?: Buffer;
	mimeType: string;
	duration: number;
	provider: string;
	hasAudio: boolean;
}

// ─── Provider Registry ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, VideoProvider> = {
	kling: klingProvider,
	runway: runwayProvider,
	pika: pikaProvider,
};

// ─── Content Hint Keywords ──────────────────────────────────────────────────

const PIKA_HINTS = new Set([
	"text-animation",
	"quote",
	"animated-text",
	"creative",
	"effects",
	"artistic",
]);

const KLING_HINTS = new Set([
	"b-roll",
	"voiceover",
	"product-demo",
	"realistic",
	"product",
	"demo",
	"audio",
	"sound",
	"narration",
]);

const RUNWAY_HINTS = new Set([
	"cinematic",
	"stylized",
	"artistic",
	"consistent-characters",
	"character",
	"film",
]);

// ─── Provider Selection ─────────────────────────────────────────────────────

export interface VideoProviderSelection {
	provider: VideoProvider;
	reason: string;
	suggestion?: string;
}

export function selectVideoProvider(
	contentHints: string[],
	mode: VideoMode,
	userPreference?: string,
): VideoProviderSelection {
	const hints = contentHints.map((h) => h.toLowerCase());

	// Respect explicit user preference if provider supports the mode
	if (userPreference) {
		const preferred = PROVIDERS[userPreference];
		if (preferred?.supportedModes.includes(mode)) {
			return { provider: preferred, reason: `User preference: ${userPreference}` };
		}
		// If preferred provider doesn't support mode, warn and fall through
		if (preferred) {
			const fallback = selectByHints(hints, mode);
			return {
				...fallback,
				suggestion: `${userPreference} does not support ${mode}. Using ${fallback.provider.name} instead.`,
			};
		}
	}

	return selectByHints(hints, mode);
}

function selectByHints(hints: string[], mode: VideoMode): VideoProviderSelection {
	// Score each provider based on content hints
	const pikaScore = hints.filter((h) => PIKA_HINTS.has(h)).length;
	const klingScore = hints.filter((h) => KLING_HINTS.has(h)).length;
	const runwayScore = hints.filter((h) => RUNWAY_HINTS.has(h)).length;

	// Audio content strongly prefers Kling (native audio generation)
	if (hints.includes("audio") || hints.includes("sound") || hints.includes("voiceover")) {
		return {
			provider: klingProvider,
			reason: "Kling supports native audio generation for b-roll with voiceover",
		};
	}

	// Text animation content prefers Pika (VID-01)
	if (pikaScore > 0 && pikaScore >= klingScore && pikaScore >= runwayScore) {
		return {
			provider: pikaProvider,
			reason: `Content hints suggest text/animation: ${hints.filter((h) => PIKA_HINTS.has(h)).join(", ")}`,
		};
	}

	// Cinematic/stylized content prefers Runway
	if (runwayScore > 0 && mode === "image-to-video") {
		return {
			provider: runwayProvider,
			reason: `Content hints suggest cinematic style: ${hints.filter((h) => RUNWAY_HINTS.has(h)).join(", ")}`,
		};
	}

	if (klingScore > 0) {
		return {
			provider: klingProvider,
			reason: `Content hints suggest realistic/product content: ${hints.filter((h) => KLING_HINTS.has(h)).join(", ")}`,
		};
	}

	// Defaults based on mode
	if (mode === "image-to-video") {
		return {
			provider: runwayProvider,
			reason: "Default for image-to-video: Runway Gen4 Turbo (best quality)",
		};
	}

	return {
		provider: klingProvider,
		reason: "Default for text-to-video: Kling (most versatile)",
	};
}

// ─── Generate Video ─────────────────────────────────────────────────────────

export interface GenerateVideoOptions {
	prompt: string;
	mode: VideoMode;
	platform: Platform;
	contentHints?: string[];
	userPreference?: string;
	sourceImage?: string;
	withAudio?: boolean;
	duration?: number;
}

export interface GenerateVideoResult {
	video: GeneratedVideo;
	provider: string;
	providerReason: string;
	suggestion?: string;
	validation: VideoValidation;
}

export async function generateVideo(
	options: GenerateVideoOptions,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<GenerateVideoResult> {
	const spec = PLATFORM_VIDEO_SPECS[options.platform];
	const { provider, reason, suggestion } = selectVideoProvider(
		options.contentHints ?? [],
		options.mode,
		options.userPreference,
	);

	// Use optimal duration for platform if not specified
	const duration = options.duration ?? spec.optimalDuration;

	// Determine aspect ratio from platform
	const aspectRatio =
		options.mode === "text-to-video" ? getDefaultAspectRatio(options.platform) : undefined;

	const video = await provider.generate(
		{
			prompt: options.prompt,
			mode: options.mode,
			sourceImage: options.sourceImage,
			duration,
			aspectRatio,
			withAudio: options.withAudio,
		},
		db,
		hubId,
	);

	const validation = validateVideoForPlatform(video, options.platform);

	return {
		video,
		provider: provider.name,
		providerReason: reason,
		suggestion,
		validation,
	};
}

// ─── Platform Aspect Ratio ──────────────────────────────────────────────────

function getDefaultAspectRatio(platform: Platform): string {
	switch (platform) {
		case "tiktok":
		case "instagram":
			return "9:16";
		default:
			return "16:9";
	}
}

// ─── Validation ─────────────────────────────────────────────────────────────

export interface VideoValidation {
	valid: boolean;
	issues: string[];
}

export function validateVideoForPlatform(
	video: GeneratedVideo,
	platform: Platform,
): VideoValidation {
	const spec = PLATFORM_VIDEO_SPECS[platform];
	const issues: string[] = [];

	if (video.duration > spec.maxDuration) {
		issues.push(
			`Video duration ${video.duration}s exceeds ${platform} max of ${spec.maxDuration}s`,
		);
	}

	if (video.mimeType !== "video/mp4") {
		issues.push(`Video format ${video.mimeType} is not mp4 (required for ${platform})`);
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}

// ─── Exports ────────────────────────────────────────────────────────────────

export { klingProvider, runwayProvider, pikaProvider };
