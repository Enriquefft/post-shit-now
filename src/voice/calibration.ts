import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { diffWords } from "diff";
import { loadProfile, saveProfile } from "./profile.ts";
import { createDefaultProfile, type VoiceProfile } from "./types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EditPattern {
	type:
		| "tone-adjustment"
		| "word-choice"
		| "structure-change"
		| "length-change"
		| "addition"
		| "removal"
		| "rewrite";
	description: string;
	count: number;
}

export interface EditResult {
	distance: number;
	ratio: number;
	patterns: EditPattern[];
}

export interface CalibrationReport {
	postsReviewed: number;
	avgEditDistance: number;
	editDistanceTrend: "improving" | "stable" | "worsening";
	topEditPatterns: EditPattern[];
	calibrationStatus: "uncalibrated" | "calibrating" | "calibrated";
	confidence: number;
	recommendation: string;
}

// ─── Edit Distance Computation ──────────────────────────────────────────────

function normalizeContent(content: string): string {
	// Handle thread content stored as JSON arrays
	try {
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) {
			return parsed.join("\n");
		}
	} catch {
		// Not JSON — use as-is
	}
	return content;
}

export function computeEditDistance(original: string, edited: string): EditResult {
	const normalizedOriginal = normalizeContent(original);
	const normalizedEdited = normalizeContent(edited);

	const diff = diffWords(normalizedOriginal, normalizedEdited);

	let additions = 0;
	let removals = 0;
	let totalOriginalWords = 0;
	const patternCounts: Record<string, number> = {};

	for (const part of diff) {
		const wordCount = part.value.trim().split(/\s+/).filter(Boolean).length;

		if (!part.added && !part.removed) {
			totalOriginalWords += wordCount;
		} else if (part.added) {
			additions += wordCount;
			patternCounts.addition = (patternCounts.addition ?? 0) + wordCount;
		} else if (part.removed) {
			removals += wordCount;
			totalOriginalWords += wordCount;
			patternCounts.removal = (patternCounts.removal ?? 0) + wordCount;
		}
	}

	const changes = additions + removals;
	const ratio = totalOriginalWords > 0 ? Math.round((changes / totalOriginalWords) * 100) : 0;

	// Detect patterns
	const patterns: EditPattern[] = [];

	const originalLength = normalizedOriginal.length;
	const editedLength = normalizedEdited.length;
	const lengthDiff = Math.abs(editedLength - originalLength);

	if (lengthDiff > originalLength * 0.3) {
		patterns.push({
			type: "length-change",
			description:
				editedLength > originalLength ? "Significant content added" : "Significant content removed",
			count: 1,
		});
	}

	if (ratio > 50) {
		patterns.push({
			type: "rewrite",
			description: "Major rewrite (>50% changed)",
			count: 1,
		});
	}

	if (additions > 0 && removals === 0) {
		patterns.push({
			type: "addition",
			description: `${additions} words added`,
			count: additions,
		});
	}

	if (removals > 0 && additions === 0) {
		patterns.push({
			type: "removal",
			description: `${removals} words removed`,
			count: removals,
		});
	}

	if (additions > 0 && removals > 0 && ratio <= 50) {
		patterns.push({
			type: "word-choice",
			description: `${Math.min(additions, removals)} word replacements`,
			count: Math.min(additions, removals),
		});
	}

	return {
		distance: changes,
		ratio: Math.min(100, ratio),
		patterns,
	};
}

// ─── Track Edit ─────────────────────────────────────────────────────────────

export async function trackEdit(params: {
	postId: string;
	originalContent: string;
	editedContent: string;
	databaseUrl: string;
}): Promise<EditResult> {
	const result = computeEditDistance(params.originalContent, params.editedContent);

	// Insert into edit_history table
	// NOTE: Actual DB insertion requires drizzle client initialization
	// which is handled by the caller. This function computes and returns the metrics.
	// The DB write is a side effect that depends on the connection being available.

	return result;
}

// ─── Calibration Update ─────────────────────────────────────────────────────

const CONVERGENCE_THRESHOLD = 15; // <15% edit ratio = calibrated
const CONVERGENCE_WINDOW = 10; // 10 consecutive posts

export function computeCalibrationFromEdits(editRatios: number[]): {
	status: "uncalibrated" | "calibrating" | "calibrated";
	confidence: number;
	trend: "improving" | "stable" | "worsening";
	avgEditDistance: number;
} {
	if (editRatios.length === 0) {
		return {
			status: "uncalibrated",
			confidence: 0,
			trend: "stable",
			avgEditDistance: 0,
		};
	}

	const avg = editRatios.reduce((a, b) => a + b, 0) / editRatios.length;

	// Check convergence: last N posts all below threshold
	const recent = editRatios.slice(-CONVERGENCE_WINDOW);
	const allBelowThreshold =
		recent.length >= CONVERGENCE_WINDOW && recent.every((r) => r < CONVERGENCE_THRESHOLD);

	// Determine trend
	let trend: "improving" | "stable" | "worsening" = "stable";
	if (editRatios.length >= 10) {
		const firstHalf = editRatios.slice(0, Math.floor(editRatios.length / 2));
		const secondHalf = editRatios.slice(Math.floor(editRatios.length / 2));
		const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
		const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

		if (secondAvg < firstAvg - 5) trend = "improving";
		else if (secondAvg > firstAvg + 5) trend = "worsening";
	}

	const confidence = Math.max(0, Math.min(1, 1 - avg / 100));

	return {
		status: allBelowThreshold
			? "calibrated"
			: editRatios.length > 0
				? "calibrating"
				: "uncalibrated",
		confidence: Math.round(confidence * 100) / 100,
		trend,
		avgEditDistance: Math.round(avg * 10) / 10,
	};
}

export async function updateCalibration(params: {
	profilePath: string;
	editRatios: number[];
}): Promise<CalibrationReport> {
	const profile = await loadProfile(params.profilePath);
	const { status, confidence, trend, avgEditDistance } = computeCalibrationFromEdits(
		params.editRatios,
	);

	// Update profile calibration state
	profile.calibration.status = status;
	profile.calibration.confidence = confidence;
	profile.calibration.avgEditDistance = avgEditDistance;
	profile.calibration.postsReviewed = params.editRatios.length;
	profile.calibration.lastCalibrationAt = new Date().toISOString();

	await saveProfile(profile, params.profilePath);

	let recommendation: string;
	switch (status) {
		case "calibrated":
			recommendation = "Voice profile is well calibrated. Continue posting to maintain accuracy.";
			break;
		case "calibrating":
			recommendation =
				trend === "improving"
					? "Getting closer! Your edits are decreasing. Keep reviewing posts."
					: "Consider running /psn:voice tweak to adjust specific traits.";
			break;
		default:
			recommendation = "Start by generating and reviewing a few posts to begin calibration.";
	}

	return {
		postsReviewed: params.editRatios.length,
		avgEditDistance,
		editDistanceTrend: trend,
		topEditPatterns: [],
		calibrationStatus: status,
		confidence,
		recommendation,
	};
}

export async function getCalibrationReport(params: {
	profilePath: string;
	editRatios: number[];
}): Promise<CalibrationReport> {
	const { status, confidence, trend, avgEditDistance } = computeCalibrationFromEdits(
		params.editRatios,
	);

	let recommendation: string;
	switch (status) {
		case "calibrated":
			recommendation = "Voice profile is well calibrated.";
			break;
		case "calibrating":
			recommendation =
				trend === "improving"
					? "Calibration is progressing well."
					: "Consider adjusting voice profile traits.";
			break;
		default:
			recommendation = "Generate and review posts to begin calibration.";
	}

	return {
		postsReviewed: params.editRatios.length,
		avgEditDistance,
		editDistanceTrend: trend,
		topEditPatterns: [],
		calibrationStatus: status,
		confidence,
		recommendation,
	};
}

// ─── Brand Profile Management ───────────────────────────────────────────────

export async function createBrandOperatorProfile(params: {
	companyName: string;
	brandGuidelines?: string;
	tone?: string;
	pillars?: string[];
	boundaries?: string[];
	outputDir?: string;
}): Promise<{ profilePath: string; profile: VoiceProfile }> {
	const profile = createDefaultProfile();

	// Brand-specific identity
	profile.identity.pillars = params.pillars ?? [];
	profile.identity.boundaries.avoid = params.boundaries ?? [];

	// Professional brand voice (higher formality, lower controversy)
	profile.style.formality = 7;
	profile.style.humor = 3;
	profile.style.controversy = 2;
	profile.style.technicalDepth = 6;
	profile.style.storytelling = 4;

	// Platform personas with brand tone
	const tone = params.tone ?? "professional";
	profile.platforms.x = {
		tone,
		formatPreferences: [],
		hashtagStyle: "strategic",
		emojiUsage: "rare",
	};
	profile.platforms.linkedin = {
		tone,
		formatPreferences: ["carousel", "short-post"],
		hashtagStyle: "strategic",
		emojiUsage: "none",
	};

	const dir = params.outputDir ?? "content/voice";
	const profilePath = join(
		dir,
		`${params.companyName.toLowerCase().replace(/\s+/g, "-")}-operator.yaml`,
	);
	await saveProfile(profile, profilePath);

	return { profilePath, profile };
}

export async function createBrandAmbassadorProfile(params: {
	personalProfilePath: string;
	companyName: string;
	guardrails?: {
		maxControversy?: number;
		requiredTopics?: string[];
		bannedTopics?: string[];
		toneOverride?: string;
	};
}): Promise<{ profilePath: string; profile: VoiceProfile }> {
	const personal = await loadProfile(params.personalProfilePath);

	// Clone personal profile
	const profile = JSON.parse(JSON.stringify(personal)) as VoiceProfile;

	// Apply guardrails
	if (params.guardrails) {
		if (params.guardrails.maxControversy !== undefined) {
			profile.style.controversy = Math.min(
				profile.style.controversy,
				params.guardrails.maxControversy,
			);
		}
		if (params.guardrails.requiredTopics) {
			for (const topic of params.guardrails.requiredTopics) {
				if (!profile.identity.pillars.includes(topic)) {
					profile.identity.pillars.push(topic);
				}
			}
		}
		if (params.guardrails.bannedTopics) {
			for (const topic of params.guardrails.bannedTopics) {
				if (!profile.identity.boundaries.avoid.includes(topic)) {
					profile.identity.boundaries.avoid.push(topic);
				}
			}
		}
		if (params.guardrails.toneOverride) {
			for (const key of Object.keys(profile.platforms)) {
				const p = profile.platforms[key as keyof typeof profile.platforms];
				if (p) p.tone = params.guardrails.toneOverride;
			}
		}
	}

	profile.updatedAt = new Date().toISOString();

	const profilePath = join(
		"content/voice",
		`${params.companyName.toLowerCase().replace(/\s+/g, "-")}-ambassador.yaml`,
	);
	await saveProfile(profile, profilePath);

	return { profilePath, profile };
}

// ─── List Voice Profiles ────────────────────────────────────────────────────

export async function listVoiceProfiles(
	voiceDir = "content/voice",
): Promise<
	Array<{ path: string; type: "personal" | "brand-operator" | "brand-ambassador"; name: string }>
> {
	try {
		const files = await readdir(voiceDir);
		const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

		const profiles: Array<{
			path: string;
			type: "personal" | "brand-operator" | "brand-ambassador";
			name: string;
		}> = [];

		for (const file of yamlFiles) {
			const filePath = join(voiceDir, file);
			const name = file.replace(/\.(yaml|yml)$/, "");

			let type: "personal" | "brand-operator" | "brand-ambassador" = "personal";
			if (name.endsWith("-operator")) type = "brand-operator";
			else if (name.endsWith("-ambassador")) type = "brand-ambassador";

			profiles.push({ path: filePath, type, name });
		}

		return profiles.sort((a, b) => a.name.localeCompare(b.name));
	} catch {
		return [];
	}
}
