import type { DbClient } from "../core/db/connection.ts";

// ─── Image Types ─────────────────────────────────────────────────────────────

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

// ─── Video Types ─────────────────────────────────────────────────────────────

export type VideoMode = "text-to-video" | "image-to-video";

export interface VideoProvider {
	name: string;
	strengths: string[];
	supportedModes: VideoMode[];
	generate(params: VideoGenParams, db: DbClient, hubId: string): Promise<GeneratedVideo>;
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
