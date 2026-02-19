import type { GeneratedVideo, VideoGenParams, VideoProvider } from "../video-gen.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: string): string {
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

export const pikaProvider: VideoProvider = {
	name: "pika",
	strengths: ["animated-clips", "text-animation", "quote-videos", "creative-effects"],
	supportedModes: ["text-to-video", "image-to-video"],

	async generate(params: VideoGenParams): Promise<GeneratedVideo> {
		const falKey = process.env.FAL_KEY;
		if (!falKey) {
			throw new Error("FAL_KEY environment variable is required for Pika video generation");
		}

		const { fal } = await import("@fal-ai/client");
		fal.config({ credentials: falKey });

		const aspectRatio = mapAspectRatio(params.aspectRatio);

		let endpoint: string;
		let input: Record<string, unknown>;

		if (params.mode === "image-to-video" && params.sourceImage) {
			endpoint = "fal-ai/pika/v2.2/image-to-video";
			input = {
				prompt: params.prompt,
				image_url: params.sourceImage,
				duration: params.duration,
			};
		} else {
			endpoint = "fal-ai/pika/v2.2/text-to-video";
			input = {
				prompt: params.prompt,
				duration: params.duration,
				aspect_ratio: aspectRatio,
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
				throw new Error("Pika returned no video data");
			}

			const buffer = await downloadToBuffer(videoUrl);

			return {
				url: videoUrl,
				buffer,
				mimeType: "video/mp4",
				duration: params.duration,
				provider: "pika",
				hasAudio: false,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new Error(`Pika video generation failed: ${message}`);
		}
	},
};
