import sharp from "sharp";
import type { Platform } from "../core/types/index.ts";
import { PLATFORM_IMAGE_SPECS } from "./platform-specs.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProcessedImage {
	buffer: Buffer;
	mimeType: string;
	width: number;
	height: number;
	sizeBytes: number;
}

export interface ImageMetadata {
	width: number;
	height: number;
	format: string;
	sizeBytes: number;
	hasAlpha: boolean;
}

// ─── Get Image Metadata ─────────────────────────────────────────────────────

export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
	const meta = await sharp(buffer).metadata();
	return {
		width: meta.width ?? 0,
		height: meta.height ?? 0,
		format: meta.format ?? "unknown",
		sizeBytes: buffer.length,
		hasAlpha: meta.hasAlpha ?? false,
	};
}

// ─── Ensure Size Limit ──────────────────────────────────────────────────────

export async function ensureSizeLimit(
	buffer: Buffer,
	maxBytes: number,
	format: "jpeg" | "png" | "webp",
): Promise<Buffer> {
	if (buffer.length <= maxBytes) return buffer;

	let quality = 85;
	let result = buffer;

	while (result.length > maxBytes && quality >= 10) {
		if (format === "png") {
			// PNG doesn't have quality, use compression level
			result = await sharp(buffer).png({ compressionLevel: 9 }).toBuffer();
			break; // PNG compression is not iterative like JPEG
		}
		result = await sharp(buffer)[format]({ quality }).toBuffer();
		quality -= 10;
	}

	if (result.length > maxBytes) {
		throw new Error(
			`Image still exceeds ${maxBytes} bytes (${result.length}) after maximum compression`,
		);
	}

	return result;
}

// ─── Process Image for Platform ─────────────────────────────────────────────

function getFirstDimension(dims: Record<string, { w: number; h: number }>): {
	w: number;
	h: number;
} {
	const first = Object.values(dims)[0];
	if (!first) throw new Error("Platform has no recommended dimensions");
	return first;
}

function getDimensions(platform: Platform, aspectRatio?: string): { w: number; h: number } {
	const spec = PLATFORM_IMAGE_SPECS[platform];
	const dims = spec.recommendedDimensions;

	// Map aspect ratio to dimension key
	if (aspectRatio) {
		switch (aspectRatio) {
			case "16:9":
			case "1.91:1":
				return dims.landscape ?? getFirstDimension(dims);
			case "1:1":
				return dims.square ?? getFirstDimension(dims);
			case "4:5":
				return dims.portrait ?? dims.vertical ?? getFirstDimension(dims);
			case "9:16":
				return dims.story ?? dims.vertical ?? dims.portrait ?? getFirstDimension(dims);
			default:
				break;
		}
	}

	// Default to first dimension
	return getFirstDimension(dims);
}

function getOutputFormat(platform: Platform): "jpeg" | "png" | "webp" {
	const spec = PLATFORM_IMAGE_SPECS[platform];
	// Instagram requires JPEG
	if (platform === "instagram") return "jpeg";
	// Prefer JPEG for smaller file sizes
	if (spec.formats.includes("jpeg")) return "jpeg";
	if (spec.formats.includes("png")) return "png";
	return "jpeg";
}

export async function processImageForPlatform(
	imageBuffer: Buffer,
	platform: Platform,
	options?: { aspectRatio?: string; quality?: number },
): Promise<ProcessedImage> {
	const spec = PLATFORM_IMAGE_SPECS[platform];
	const { w, h } = getDimensions(platform, options?.aspectRatio);
	const format = getOutputFormat(platform);
	const quality = options?.quality ?? 85;

	const pipeline = sharp(imageBuffer).resize(w, h, { fit: "cover" });

	let processed: Buffer;
	switch (format) {
		case "jpeg":
			processed = await pipeline.jpeg({ quality }).toBuffer();
			break;
		case "png":
			processed = await pipeline.png().toBuffer();
			break;
		case "webp":
			processed = await pipeline.webp({ quality }).toBuffer();
			break;
	}

	// Ensure within size limit
	processed = await ensureSizeLimit(processed, spec.maxSizeBytes, format);

	const meta = await sharp(processed).metadata();

	return {
		buffer: processed,
		mimeType: `image/${format}`,
		width: meta.width ?? w,
		height: meta.height ?? h,
		sizeBytes: processed.length,
	};
}
