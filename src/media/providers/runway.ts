import { getApiKey } from "../../core/db/api-keys";
import type { DbClient } from "../../core/db/connection.ts";
import type { GeneratedVideo, VideoGenParams, VideoProvider } from "../types.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RunwayRatio = "1280:720" | "720:1280" | "960:960";

function mapAspectRatio(aspectRatio?: string): RunwayRatio {
	switch (aspectRatio) {
		case "9:16":
			return "720:1280";
		case "1:1":
			return "960:960";
		default:
			return "1280:720";
	}
}

function clampDuration(seconds: number): number {
	return Math.min(10, Math.max(2, seconds));
}

async function downloadToBuffer(url: string): Promise<Buffer> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
	}
	const arrayBuffer = await response.arrayBuffer();
	return Buffer.from(arrayBuffer);
}

// ─── Provider ────────────────────────────────────────────────────────────────

// ─── Text-to-Video specific mappings ─────────────────────────────────────────

type T2VRatio = "1280:720" | "720:1280" | "1080:1920" | "1920:1080";

function mapT2VRatio(aspectRatio?: string): T2VRatio {
	switch (aspectRatio) {
		case "9:16":
			return "720:1280";
		default:
			return "1280:720";
	}
}

function mapT2VDuration(seconds: number): 4 | 6 | 8 {
	if (seconds <= 4) return 4;
	if (seconds <= 6) return 6;
	return 8;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export const runwayProvider: VideoProvider = {
	name: "runway",
	strengths: ["stylized", "cinematic", "image-to-video", "consistent-characters"],
	supportedModes: ["text-to-video", "image-to-video"],

	async generate(params: VideoGenParams, db: DbClient, hubId: string): Promise<GeneratedVideo> {
		const apiSecret = await getApiKey(db, hubId, "runway");
		if (!apiSecret) {
			throw new Error("API key lookup returned empty value");
		}

		const { default: RunwayML } = await import("@runwayml/sdk");
		const client = new RunwayML({ apiKey: apiSecret });

		const ratio = mapAspectRatio(params.aspectRatio);
		const duration = clampDuration(params.duration);

		try {
			let taskResult: { output: string[] };

			if (params.mode === "image-to-video" && params.sourceImage) {
				// Gen4 Turbo for image-to-video
				taskResult = await client.imageToVideo
					.create({
						model: "gen4_turbo",
						promptImage: params.sourceImage,
						promptText: params.prompt,
						ratio,
						duration,
					})
					.waitForTaskOutput({ timeout: 300000 });
			} else {
				// Veo 3.1 for text-to-video (Runway SDK supported model)
				const t2vRatio = mapT2VRatio(params.aspectRatio);
				taskResult = await client.textToVideo
					.create({
						model: "veo3.1",
						promptText: params.prompt,
						ratio: t2vRatio,
						duration: mapT2VDuration(duration),
					})
					.waitForTaskOutput({ timeout: 300000 });
			}

			const videoUrl = taskResult.output[0];
			if (!videoUrl) {
				throw new Error("Runway returned no video output");
			}

			const buffer = await downloadToBuffer(videoUrl);

			return {
				url: videoUrl,
				buffer,
				mimeType: "video/mp4",
				duration,
				provider: "runway",
				hasAudio: false,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Runway video generation failed: ${message}`);
		}
	},
};
