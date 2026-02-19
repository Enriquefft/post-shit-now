import type { Platform } from "../core/types/index.ts";

// ─── Image Specs ────────────────────────────────────────────────────────────

export interface PlatformImageSpec {
	maxSizeBytes: number;
	formats: string[];
	recommendedAspectRatios: string[];
	recommendedDimensions: Record<string, { w: number; h: number }>;
}

export const PLATFORM_IMAGE_SPECS: Record<Platform, PlatformImageSpec> = {
	x: {
		maxSizeBytes: 5_242_880,
		formats: ["jpeg", "png", "webp", "gif"],
		recommendedAspectRatios: ["16:9", "1:1"],
		recommendedDimensions: {
			landscape: { w: 1200, h: 675 },
			square: { w: 1080, h: 1080 },
		},
	},
	linkedin: {
		maxSizeBytes: 10_485_760,
		formats: ["jpeg", "png"],
		recommendedAspectRatios: ["1.91:1", "1:1", "4:5"],
		recommendedDimensions: {
			landscape: { w: 1200, h: 627 },
			square: { w: 1080, h: 1080 },
			portrait: { w: 1080, h: 1350 },
		},
	},
	instagram: {
		maxSizeBytes: 8_388_608,
		formats: ["jpeg"],
		recommendedAspectRatios: ["1:1", "4:5", "9:16"],
		recommendedDimensions: {
			square: { w: 1080, h: 1080 },
			portrait: { w: 1080, h: 1350 },
			story: { w: 1080, h: 1920 },
		},
	},
	tiktok: {
		maxSizeBytes: 10_485_760,
		formats: ["jpeg", "png"],
		recommendedAspectRatios: ["9:16"],
		recommendedDimensions: {
			vertical: { w: 1080, h: 1920 },
		},
	},
};

// ─── Video Specs ────────────────────────────────────────────────────────────

export interface PlatformVideoSpec {
	maxDuration: number;
	optimalDuration: number;
	formats: string[];
	codec: string;
}

export const PLATFORM_VIDEO_SPECS: Record<Platform, PlatformVideoSpec> = {
	x: {
		maxDuration: 140,
		optimalDuration: 15,
		formats: ["mp4"],
		codec: "h264",
	},
	linkedin: {
		maxDuration: 600,
		optimalDuration: 60,
		formats: ["mp4"],
		codec: "h264",
	},
	instagram: {
		maxDuration: 90,
		optimalDuration: 25,
		formats: ["mp4"],
		codec: "h264",
	},
	tiktok: {
		maxDuration: 600,
		optimalDuration: 60,
		formats: ["mp4"],
		codec: "h264",
	},
};
