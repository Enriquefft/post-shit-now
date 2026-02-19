import type { GeneratedVideo, VideoGenParams, VideoProvider } from "../video-gen.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapDuration(seconds: number): "5" | "10" {
	return seconds <= 5 ? "5" : "10";
}

function mapAspectRatio(aspectRatio?: string): "16:9" | "9:16" | "1:1" {
	switch (aspectRatio) {
		case "9:16":
			return "9:16";
		case "1:1":
			return "1:1";
		default:
			return "16:9";
	}
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

export const klingProvider: VideoProvider = {
	name: "kling",
	strengths: ["realistic-motion", "product-demos", "audio-visual", "b-roll", "voiceover"],
	supportedModes: ["text-to-video", "image-to-video"],

	async generate(params: VideoGenParams): Promise<GeneratedVideo> {
		const falKey = process.env.FAL_KEY;
		if (!falKey) {
			throw new Error("FAL_KEY environment variable is required for Kling video generation");
		}

		const { fal } = await import("@fal-ai/client");
		fal.config({ credentials: falKey });

		const duration = mapDuration(params.duration);
		const aspectRatio = mapAspectRatio(params.aspectRatio);

		let endpoint: string;
		let input: Record<string, unknown>;

		if (params.mode === "image-to-video" && params.sourceImage) {
			endpoint = "fal-ai/kling-video/v1.6/pro/image-to-video";
			input = {
				prompt: params.prompt,
				image_url: params.sourceImage,
				duration,
				aspect_ratio: aspectRatio,
			};
		} else {
			endpoint = "fal-ai/kling-video/v1.6/pro/text-to-video";
			input = {
				prompt: params.prompt,
				duration,
				aspect_ratio: aspectRatio,
				cfg_scale: 0.5,
				...(params.withAudio ? { generate_audio: true } : {}),
			};
		}

		try {
			const result = await fal.subscribe(endpoint, {
				input,
				pollInterval: 5000,
				timeout: 300000, // 5 minute timeout
			});

			const data = result.data as unknown as {
				video?: { url: string };
			};
			const videoUrl = data.video?.url;
			if (!videoUrl) {
				throw new Error("Kling returned no video data");
			}

			const buffer = await downloadToBuffer(videoUrl);

			return {
				url: videoUrl,
				buffer,
				mimeType: "video/mp4",
				duration: Number(duration),
				provider: "kling",
				hasAudio: params.withAudio ?? false,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Kling video generation failed: ${message}`);
		}
	},
};
