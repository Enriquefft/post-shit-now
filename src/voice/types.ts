import { z } from "zod";
import type { Platform } from "../core/types/index.ts";

// ─── Maturity Level ─────────────────────────────────────────────────────────

export type MaturityLevel = "never_posted" | "sporadic" | "consistent" | "very_active";

// ─── Calibration ────────────────────────────────────────────────────────────

export const calibrationStateSchema = z.object({
	status: z.enum(["uncalibrated", "calibrating", "calibrated"]),
	confidence: z.number().min(0).max(1),
	postsReviewed: z.number().int().min(0),
	avgEditDistance: z.number().min(0),
	lastCalibrationAt: z.string().optional(),
});

export type CalibrationState = z.infer<typeof calibrationStateSchema>;

// ─── Identity ───────────────────────────────────────────────────────────────

export const referenceVoiceSchema = z.object({
	name: z.string(),
	platform: z.string(),
	whatToEmulate: z.string(),
});

export const boundariesSchema = z.object({
	avoid: z.array(z.string()),
	cautious: z.array(z.string()),
});

export const identitySchema = z.object({
	pillars: z.array(z.string()),
	boundaries: boundariesSchema,
	referenceVoices: z.array(referenceVoiceSchema),
});

export type Identity = z.infer<typeof identitySchema>;

// ─── Style Traits (language-agnostic) ───────────────────────────────────────

export const styleTraitsSchema = z.object({
	formality: z.number().min(1).max(10),
	humor: z.number().min(1).max(10),
	technicalDepth: z.number().min(1).max(10),
	storytelling: z.number().min(1).max(10),
	controversy: z.number().min(1).max(10),
});

export type StyleTraits = z.infer<typeof styleTraitsSchema>;

// ─── Language Voice (per-language) ──────────────────────────────────────────

export const languageVoiceSchema = z.object({
	vocabulary: z.array(z.string()),
	sentencePatterns: z.array(z.string()),
	openingStyles: z.array(z.string()),
	closingStyles: z.array(z.string()),
	idioms: z.array(z.string()),
});

export type LanguageVoice = z.infer<typeof languageVoiceSchema>;

// ─── Platform Persona (per-platform) ────────────────────────────────────────

export const platformPersonaSchema = z.object({
	tone: z.string(),
	formatPreferences: z.array(z.string()),
	hashtagStyle: z.enum(["none", "minimal", "strategic", "heavy"]),
	emojiUsage: z.enum(["none", "rare", "moderate", "heavy"]),
	maxLength: z.number().int().positive().optional(),
});

export type PlatformPersona = z.infer<typeof platformPersonaSchema>;

// ─── Voice Profile (top-level) ──────────────────────────────────────────────

export const voiceProfileSchema = z.object({
	version: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	calibration: calibrationStateSchema,
	identity: identitySchema,
	style: styleTraitsSchema,
	languages: z.object({
		en: languageVoiceSchema.optional(),
		es: languageVoiceSchema.optional(),
	}),
	platforms: z.object({
		x: platformPersonaSchema.optional(),
		linkedin: platformPersonaSchema.optional(),
		instagram: platformPersonaSchema.optional(),
		tiktok: platformPersonaSchema.optional(),
	}),
	// Entity-scoped profile fields (for solo founder multi-project support)
	entitySlug: z.string().optional(),
	entityDisplayName: z.string().optional(),
	entityDescription: z.string().optional(),
	maturityLevel: z.enum(["never_posted", "sporadic", "consistent", "very_active"]).optional(),
});

export type VoiceProfile = z.infer<typeof voiceProfileSchema>;

// ─── Strategy Config (for strategy.yaml) ────────────────────────────────────

export const strategyPillarSchema = z.object({
	name: z.string(),
	weight: z.number().min(0).max(1),
	description: z.string(),
});

export const strategyPlatformSchema = z.object({
	enabled: z.boolean(),
	frequency: z.number().int().min(0),
	bestTimes: z.array(z.string()),
});

export const strategyConfigSchema = z.object({
	pillars: z.array(strategyPillarSchema),
	platforms: z.record(z.string(), strategyPlatformSchema),
	languages: z.object({
		primary: z.string(),
		secondary: z.string().optional(),
	}),
	postingFrequency: z.object({
		min: z.number().int().min(0),
		max: z.number().int().min(0),
	}),
});

export type StrategyConfig = z.infer<typeof strategyConfigSchema>;

// ─── Voice Tweaks ───────────────────────────────────────────────────────────

export type VoiceTweak =
	| { type: "add_banned_word"; word: string }
	| { type: "remove_banned_word"; word: string }
	| { type: "adjust_formality"; value: number }
	| { type: "adjust_humor"; value: number }
	| { type: "add_pillar"; pillar: string }
	| { type: "remove_pillar"; pillar: string }
	| { type: "set_platform_tone"; platform: Platform; tone: string };

// ─── Factory Functions ──────────────────────────────────────────────────────

const DEFAULT_LANGUAGE_VOICE: LanguageVoice = {
	vocabulary: [],
	sentencePatterns: [],
	openingStyles: [],
	closingStyles: [],
	idioms: [],
};

const DEFAULT_PLATFORM_PERSONA: PlatformPersona = {
	tone: "professional",
	formatPreferences: [],
	hashtagStyle: "minimal",
	emojiUsage: "rare",
};

export function createDefaultProfile(): VoiceProfile {
	const now = new Date().toISOString();
	return {
		version: "1.0",
		createdAt: now,
		updatedAt: now,
		calibration: {
			status: "uncalibrated",
			confidence: 0,
			postsReviewed: 0,
			avgEditDistance: 0,
		},
		identity: {
			pillars: [],
			boundaries: {
				avoid: [],
				cautious: [],
			},
			referenceVoices: [],
		},
		style: {
			formality: 5,
			humor: 5,
			technicalDepth: 5,
			storytelling: 5,
			controversy: 3,
		},
		languages: {
			en: { ...DEFAULT_LANGUAGE_VOICE },
		},
		platforms: {
			x: { ...DEFAULT_PLATFORM_PERSONA, tone: "casual-professional" },
		},
	};
}

export function createBlankSlateProfile(): VoiceProfile {
	const now = new Date().toISOString();
	return {
		version: "1.0",
		createdAt: now,
		updatedAt: now,
		calibration: {
			status: "uncalibrated",
			confidence: 0,
			postsReviewed: 0,
			avgEditDistance: 0,
		},
		identity: {
			pillars: [],
			boundaries: {
				avoid: [],
				cautious: [],
			},
			referenceVoices: [],
		},
		style: {
			formality: 5,
			humor: 5,
			technicalDepth: 5,
			storytelling: 5,
			controversy: 3,
		},
		languages: {},
		platforms: {},
	};
}
