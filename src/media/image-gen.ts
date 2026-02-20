import type { DbClient } from "../core/db/connection.ts";
import type { Platform } from "../core/types/index.ts";
import { type ProcessedImage, processImageForPlatform } from "./processor.ts";
import { fluxProvider } from "./providers/flux.ts";
import { gptImageProvider } from "./providers/gpt-image.ts";
import { ideogramProvider } from "./providers/ideogram.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImageProvider {
	name: string;
	strengths: string[];
	generate(
		prompt: string,
		options: ImageGenOptions,
		db: DbClient,
		hubId: string,
	): Promise<GeneratedImage>;
}

export interface ImageGenOptions {
	aspectRatio?: string;
	style?: string;
	negativePrompt?: string;
	size?: { width: number; height: number };
}

export interface GeneratedImage {
	buffer: Buffer;
	mimeType: string;
	width: number;
	height: number;
	provider: string;
}

// ─── Provider Registry ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, ImageProvider> = {
	"gpt-image": gptImageProvider,
	ideogram: ideogramProvider,
	flux: fluxProvider,
};

// ─── Content Hint Keywords ──────────────────────────────────────────────────

const IDEOGRAM_HINTS = new Set([
	"text",
	"typography",
	"logo",
	"poster",
	"infographic",
	"banner",
	"quote",
	"title",
	"headline",
	"lettering",
	"signage",
]);

const FLUX_HINTS = new Set([
	"photo",
	"realistic",
	"product",
	"portrait",
	"nature",
	"landscape",
	"photorealistic",
	"studio",
	"cinematic",
	"documentary",
]);

// ─── Provider Selection ─────────────────────────────────────────────────────

export interface ProviderSelection {
	provider: ImageProvider;
	reason: string;
	suggestion?: string;
}

export function selectImageProvider(
	contentHints: string[],
	userPreference?: string,
): ProviderSelection {
	const hints = contentHints.map((h) => h.toLowerCase());

	// Respect explicit user preference
	if (userPreference) {
		const preferred = PROVIDERS[userPreference];
		if (preferred) {
			// Check if a different provider would be better
			let suggestion: string | undefined;
			if (hints.some((h) => IDEOGRAM_HINTS.has(h)) && userPreference !== "ideogram") {
				suggestion = "Ideogram excels at text rendering — consider it for text-heavy images";
			} else if (hints.some((h) => FLUX_HINTS.has(h)) && userPreference !== "flux") {
				suggestion = "Flux 2 excels at photorealism — consider it for photo-style images";
			}
			return { provider: preferred, reason: `User preference: ${userPreference}`, suggestion };
		}
	}

	// Auto-select based on content hints
	const ideogramScore = hints.filter((h) => IDEOGRAM_HINTS.has(h)).length;
	const fluxScore = hints.filter((h) => FLUX_HINTS.has(h)).length;

	if (ideogramScore > 0 && ideogramScore >= fluxScore) {
		return {
			provider: ideogramProvider,
			reason: `Content hints suggest text/design: ${hints.filter((h) => IDEOGRAM_HINTS.has(h)).join(", ")}`,
		};
	}

	if (fluxScore > 0) {
		return {
			provider: fluxProvider,
			reason: `Content hints suggest photorealism: ${hints.filter((h) => FLUX_HINTS.has(h)).join(", ")}`,
		};
	}

	// Default to GPT Image (most versatile)
	return {
		provider: gptImageProvider,
		reason: "Default provider — versatile for general content",
	};
}

// ─── Generate Image ─────────────────────────────────────────────────────────

export interface GenerateImageOptions {
	platform: Platform;
	contentHints?: string[];
	userPreference?: string;
	aspectRatio?: string;
	style?: string;
	negativePrompt?: string;
	db?: DbClient;
	hubId?: string;
}

export interface GenerateImageResult {
	image: ProcessedImage;
	provider: string;
	providerReason: string;
	suggestion?: string;
}

export async function generateImage(
	prompt: string,
	options: GenerateImageOptions,
): Promise<GenerateImageResult> {
	const { provider, reason, suggestion } = selectImageProvider(
		options.contentHints ?? [],
		options.userPreference,
	);

	if (!options.db || !options.hubId) {
		throw new Error("db and hubId are required for image generation");
	}

	const generated = await provider.generate(
		prompt,
		{
			aspectRatio: options.aspectRatio,
			style: options.style,
			negativePrompt: options.negativePrompt,
		},
		options.db,
		options.hubId,
	);

	// Process for platform compliance (resize, format, compress)
	const processed = await processImageForPlatform(generated.buffer, options.platform, {
		aspectRatio: options.aspectRatio,
	});

	return {
		image: processed,
		provider: provider.name,
		providerReason: reason,
		suggestion,
	};
}

// ─── Exports ────────────────────────────────────────────────────────────────

export { gptImageProvider, ideogramProvider, fluxProvider };
