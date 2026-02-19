import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getApiKey } from "../../core/db/api-keys";
import type { GeneratedImage, ImageGenOptions, ImageProvider } from "../image-gen.ts";

// ─── Size Mapping (fal.ai SDK uses image_size, not aspect_ratio) ─────────────

type FalImageSize =
	| "square_hd"
	| "square"
	| "portrait_4_3"
	| "portrait_16_9"
	| "landscape_4_3"
	| "landscape_16_9";

function mapAspectRatioToSize(aspectRatio?: string): FalImageSize {
	switch (aspectRatio) {
		case "16:9":
		case "1.91:1":
			return "landscape_16_9";
		case "9:16":
			return "portrait_16_9";
		case "4:3":
			return "landscape_4_3";
		case "4:5":
			return "portrait_4_3";
		default:
			return "square_hd";
	}
}

// Direct API uses ASPECT_X_X format
function mapAspectRatioDirect(aspectRatio?: string): string {
	switch (aspectRatio) {
		case "16:9":
		case "1.91:1":
			return "ASPECT_16_9";
		case "9:16":
			return "ASPECT_9_16";
		case "4:3":
			return "ASPECT_4_3";
		case "4:5":
			return "ASPECT_10_16";
		default:
			return "ASPECT_1_1";
	}
}

// ─── Download helper ─────────────────────────────────────────────────────────

async function downloadToBuffer(url: string): Promise<Buffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

// ─── Style Mapping ───────────────────────────────────────────────────────────

function mapStyle(style?: string): "AUTO" | "GENERAL" | "REALISTIC" | "DESIGN" | undefined {
	if (!style) return undefined;
	const upper = style.toUpperCase();
	if (upper === "REALISTIC" || upper === "GENERAL" || upper === "DESIGN" || upper === "AUTO") {
		return upper as "AUTO" | "GENERAL" | "REALISTIC" | "DESIGN";
	}
	return "AUTO";
}

// ─── fal.ai Path ─────────────────────────────────────────────────────────────

async function generateViaFal(
	prompt: string,
	aspectRatio?: string,
	style?: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<GeneratedImage> {
	const falKey = await getApiKey(db, hubId, "fal");
	if (!falKey) {
		throw new Error("API key lookup returned empty value");
	}

	const { fal } = await import("@fal-ai/client");
	fal.config({ credentials: falKey });

	const imageSize = mapAspectRatioToSize(aspectRatio);
	const mappedStyle = mapStyle(style);

	const result = await fal.subscribe("fal-ai/ideogram/v3", {
		input: {
			prompt,
			image_size: imageSize,
			rendering_speed: "BALANCED",
			expand_prompt: true,
			...(mappedStyle ? { style: mappedStyle } : {}),
		},
	});

	// Output type has images as File[] but at runtime they have url/width/height
	const data = result.data as unknown as {
		images?: Array<{ url: string; width: number; height: number }>;
	};
	const image = data.images?.[0];
	if (!image?.url) {
		throw new Error("Ideogram via fal.ai returned no image data");
	}

	const buffer = await downloadToBuffer(image.url);

	return {
		buffer,
		mimeType: "image/png",
		width: image.width,
		height: image.height,
		provider: "ideogram",
	};
}

// ─── Direct API Path ─────────────────────────────────────────────────────────

async function generateViaDirect(
	prompt: string,
	aspectRatio?: string,
	style?: string,
	db: PostgresJsDatabase,
	hubId: string,
): Promise<GeneratedImage> {
	const apiKey = await getApiKey(db, hubId, "ideogram");
	if (!apiKey) {
		throw new Error("API key lookup returned empty value");
	}

	const response = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
		method: "POST",
		headers: {
			"Api-Key": apiKey,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			prompt,
			aspect_ratio: mapAspectRatioDirect(aspectRatio),
			rendering_speed: "DEFAULT",
			magic_prompt: "AUTO",
			...(style ? { style_type: style } : {}),
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Ideogram API error (${response.status}): ${text}`);
	}

	const data = (await response.json()) as {
		data?: Array<{ url: string; resolution: { width: number; height: number } }>;
	};
	const image = data.data?.[0];
	if (!image?.url) {
		throw new Error("Ideogram API returned no image data");
	}

	const buffer = await downloadToBuffer(image.url);

	return {
		buffer,
		mimeType: "image/png",
		width: image.resolution.width,
		height: image.resolution.height,
		provider: "ideogram",
	};
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const ideogramProvider: ImageProvider = {
	name: "ideogram",
	strengths: ["text-rendering", "typography", "logos", "posters", "design"],

	async generate(
		prompt: string,
		options: ImageGenOptions,
		db: PostgresJsDatabase,
		hubId: string,
	): Promise<GeneratedImage> {
		// Prefer fal.ai (no minimum usage requirement) over direct API
		// Check if fal key exists by attempting to get it
		try {
			return await generateViaFal(prompt, options.aspectRatio, options.style, db, hubId);
		} catch (err) {
			if (err instanceof Error && err.message.includes("API key")) {
				// Fal key not found, try ideogram key
				return await generateViaDirect(prompt, options.aspectRatio, options.style, db, hubId);
			}
			throw err;
		}
	},
};
