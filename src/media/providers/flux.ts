import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getApiKey } from "../../core/db/api-keys";
import type { GeneratedImage, ImageGenOptions, ImageProvider } from "../image-gen.ts";

// ─── Size Mapping ────────────────────────────────────────────────────────────

type FluxImageSize =
	| "square"
	| "square_hd"
	| "landscape_16_9"
	| "landscape_4_3"
	| "portrait_16_9"
	| "portrait_4_3";

function mapAspectRatioToSize(aspectRatio?: string): FluxImageSize {
	switch (aspectRatio) {
		case "16:9":
		case "1.91:1":
			return "landscape_16_9";
		case "4:3":
			return "landscape_4_3";
		case "9:16":
			return "portrait_16_9";
		case "4:5":
			return "portrait_4_3";
		default:
			return "square_hd";
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

// ─── Provider ────────────────────────────────────────────────────────────────

export const fluxProvider: ImageProvider = {
	name: "flux",
	strengths: ["photorealistic", "high-resolution", "product-shots", "nature", "portraits"],

	async generate(
		prompt: string,
		options: ImageGenOptions,
		db: PostgresJsDatabase,
		hubId: string,
	): Promise<GeneratedImage> {
		const falKey = await getApiKey(db, hubId, "fal");
		if (!falKey) {
			throw new Error("API key lookup returned empty value");
		}

		const { fal } = await import("@fal-ai/client");
		fal.config({ credentials: falKey });

		const imageSize = mapAspectRatioToSize(options.aspectRatio);

		const result = await fal.subscribe("fal-ai/flux-2-pro", {
			input: {
				prompt,
				image_size: imageSize,
				output_format: "jpeg",
			},
		});

		// Output type has images as ImageFile[] but at runtime they have url/width/height
		const data = result.data as unknown as {
			images?: Array<{ url: string; width: number; height: number }>;
		};
		const image = data.images?.[0];
		if (!image?.url) {
			throw new Error("Flux 2 via fal.ai returned no image data");
		}

		const buffer = await downloadToBuffer(image.url);

		return {
			buffer,
			mimeType: "image/jpeg",
			width: image.width,
			height: image.height,
			provider: "flux",
		};
	},
};
