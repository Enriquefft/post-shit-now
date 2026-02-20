import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import OpenAI from "openai";
import { getApiKey } from "../../core/db/api-keys";
import type { GeneratedImage, ImageGenOptions, ImageProvider } from "../image-gen.ts";

// ─── Size Mapping ────────────────────────────────────────────────────────────

type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536";

function mapAspectRatioToSize(aspectRatio?: string): OpenAIImageSize {
	switch (aspectRatio) {
		case "16:9":
		case "1.91:1":
			return "1536x1024";
		case "9:16":
		case "4:5":
			return "1024x1536";
		default:
			return "1024x1024";
	}
}

function parseDimensions(size: OpenAIImageSize): { width: number; height: number } {
	const parts = size.split("x").map(Number);
	return { width: parts[0] ?? 1024, height: parts[1] ?? 1024 };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const gptImageProvider: ImageProvider = {
	name: "gpt-image",
	strengths: ["versatile", "general-purpose", "editing", "style-variety"],

	async generate(
		prompt: string,
		options: ImageGenOptions,
		db: PostgresJsDatabase,
		hubId: string,
	): Promise<GeneratedImage> {
		const apiKey = await getApiKey(db, hubId, "openai");
		if (!apiKey) {
			throw new Error("API key lookup returned empty value");
		}

		const openai = new OpenAI({ apiKey });
		const size = mapAspectRatioToSize(options.aspectRatio);
		const { width, height } = parseDimensions(size);

		try {
			const response = await openai.images.generate({
				model: "gpt-image-1",
				prompt,
				size,
				n: 1,
			});

			const imageData = response.data?.[0];
			if (!imageData?.b64_json) {
				throw new Error("GPT Image returned no image data");
			}

			const buffer = Buffer.from(imageData.b64_json, "base64");

			return {
				buffer,
				mimeType: "image/png",
				width,
				height,
				provider: "gpt-image",
			};
		} catch (err) {
			if (err instanceof OpenAI.APIError) {
				throw new Error(`GPT Image API error (${err.status}): ${err.message}`);
			}
			throw err;
		}
	},
};
