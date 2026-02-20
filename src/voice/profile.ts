import { readFile, rename, writeFile } from "node:fs/promises";
import { parse, stringify } from "yaml";
import type { DbClient } from "../core/db/connection.ts";
import type { Platform } from "../core/types/index.ts";
import { loadProfileByEntity } from "./entity-profiles.ts";
import {
	type StrategyConfig,
	strategyConfigSchema,
	type VoiceProfile,
	type VoiceTweak,
	voiceProfileSchema,
} from "./types.ts";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_PROFILE_PATH = "content/voice/personal.yaml";
const DEFAULT_STRATEGY_PATH = "content/voice/strategy.yaml";

// ─── Load Profile ───────────────────────────────────────────────────────────

export interface LoadProfileOptions {
	profilePath?: string;
	entitySlug?: string;
	db?: DbClient;
	userId?: string;
}

export async function loadProfile(options?: LoadProfileOptions): Promise<VoiceProfile>;
export async function loadProfile(profilePath?: string): Promise<VoiceProfile>;
export async function loadProfile(
	optionsOrPath?: LoadProfileOptions | string,
): Promise<VoiceProfile> {
	// Handle legacy string overload
	const options: LoadProfileOptions =
		typeof optionsOrPath === "string" ? { profilePath: optionsOrPath } : (optionsOrPath ?? {});

	// If db and userId and entitySlug provided, try loading from DB
	if (options.db && options.userId && options.entitySlug) {
		const profile = await loadProfileByEntity(options.db, options.userId, options.entitySlug);
		if (profile) {
			return profile;
		}
		throw new Error(`Entity not found: ${options.entitySlug}`);
	}

	// Fall back to YAML file loading
	const path = options.profilePath ?? DEFAULT_PROFILE_PATH;

	let raw: string;
	try {
		raw = await readFile(path, "utf-8");
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code === "ENOENT") {
			throw new Error(
				`Voice profile not found at: ${path}. Run /psn:voice interview to create one.`,
			);
		}
		throw err;
	}

	const parsed = parse(raw);
	const result = voiceProfileSchema.safeParse(parsed);

	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
		throw new Error(`Invalid voice profile at ${path}: ${issues}`);
	}

	return result.data;
}

// ─── Save Profile ───────────────────────────────────────────────────────────

export async function saveProfile(profile: VoiceProfile, profilePath?: string): Promise<void> {
	const path = profilePath ?? DEFAULT_PROFILE_PATH;

	// Update timestamp
	const updated = { ...profile, updatedAt: new Date().toISOString() };

	// Validate before writing
	const result = voiceProfileSchema.safeParse(updated);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
		throw new Error(`Cannot save invalid voice profile: ${issues}`);
	}

	const content = stringify(result.data);
	const tmpPath = `${path}.tmp`;

	// Atomic write: write to temp file, then rename
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, path);
}

// ─── Validate Profile ───────────────────────────────────────────────────────

export function validateProfile(profile: unknown): { valid: boolean; errors: string[] } {
	const result = voiceProfileSchema.safeParse(profile);
	if (result.success) {
		return { valid: true, errors: [] };
	}
	return {
		valid: false,
		errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
	};
}

// ─── Apply Tweaks ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export async function applyTweak(profilePath: string, tweaks: VoiceTweak[]): Promise<VoiceProfile> {
	const profile = await loadProfile(profilePath);

	for (const tweak of tweaks) {
		switch (tweak.type) {
			case "add_banned_word":
				if (!profile.identity.boundaries.avoid.includes(tweak.word)) {
					profile.identity.boundaries.avoid.push(tweak.word);
				}
				break;
			case "remove_banned_word":
				profile.identity.boundaries.avoid = profile.identity.boundaries.avoid.filter(
					(w) => w !== tweak.word,
				);
				break;
			case "adjust_formality":
				profile.style.formality = clamp(tweak.value, 1, 10);
				break;
			case "adjust_humor":
				profile.style.humor = clamp(tweak.value, 1, 10);
				break;
			case "add_pillar":
				if (!profile.identity.pillars.includes(tweak.pillar)) {
					profile.identity.pillars.push(tweak.pillar);
				}
				break;
			case "remove_pillar":
				profile.identity.pillars = profile.identity.pillars.filter((p) => p !== tweak.pillar);
				break;
			case "set_platform_tone": {
				const platform = tweak.platform as keyof typeof profile.platforms;
				if (profile.platforms[platform]) {
					profile.platforms[platform].tone = tweak.tone;
				} else {
					profile.platforms[platform] = {
						tone: tweak.tone,
						formatPreferences: [],
						hashtagStyle: "minimal",
						emojiUsage: "rare",
					};
				}
				break;
			}
		}
	}

	await saveProfile(profile, profilePath);
	return profile;
}

// ─── Generate Strategy ──────────────────────────────────────────────────────

const DEFAULT_PLATFORM_FREQUENCIES: Record<Platform, number> = {
	x: 7, // 1/day
	linkedin: 4, // 4/week
	instagram: 4, // 4/week
	tiktok: 4, // 4/week
};

const DEFAULT_BEST_TIMES: Record<Platform, string[]> = {
	x: ["8:00", "12:00", "17:00"],
	linkedin: ["9:00", "12:00"],
	instagram: ["11:00", "14:00", "19:00"],
	tiktok: ["12:00", "17:00", "21:00"],
};

export function generateStrategy(profile: VoiceProfile): StrategyConfig {
	// Map pillars to weighted categories (equal weight)
	const pillarWeight =
		profile.identity.pillars.length > 0 ? 1 / profile.identity.pillars.length : 0;
	const pillars = profile.identity.pillars.map((name) => ({
		name,
		weight: Math.round(pillarWeight * 100) / 100,
		description: "",
	}));

	// Set platform frequency based on which platforms have personas
	const platforms: Record<string, { enabled: boolean; frequency: number; bestTimes: string[] }> =
		{};
	const platformKeys: Platform[] = ["x", "linkedin", "instagram", "tiktok"];

	let totalFrequency = 0;
	for (const key of platformKeys) {
		const enabled = profile.platforms[key] !== undefined;
		const frequency = enabled ? DEFAULT_PLATFORM_FREQUENCIES[key] : 0;
		totalFrequency += frequency;
		platforms[key] = {
			enabled,
			frequency,
			bestTimes: enabled ? DEFAULT_BEST_TIMES[key] : [],
		};
	}

	// Determine primary language
	const hasEn = profile.languages.en !== undefined;
	const hasEs = profile.languages.es !== undefined;
	const primary = hasEn ? "en" : hasEs ? "es" : "en";
	const secondary = hasEn && hasEs ? "es" : undefined;

	return {
		pillars,
		platforms,
		languages: { primary, secondary },
		postingFrequency: {
			min: Math.max(1, Math.floor(totalFrequency * 0.7)),
			max: totalFrequency,
		},
	};
}

// ─── Save Strategy ──────────────────────────────────────────────────────────

export async function saveStrategy(strategy: StrategyConfig, strategyPath?: string): Promise<void> {
	const path = strategyPath ?? DEFAULT_STRATEGY_PATH;

	const result = strategyConfigSchema.safeParse(strategy);
	if (!result.success) {
		const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
		throw new Error(`Cannot save invalid strategy: ${issues}`);
	}

	const content = stringify(result.data);
	const tmpPath = `${path}.tmp`;
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, path);
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export type { EntitySummary } from "./entity-profiles.ts";
