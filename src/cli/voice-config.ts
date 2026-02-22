import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { z } from "zod/v4";
import type { Platform } from "../core/types/index.ts";
import { applyTweak, loadProfile, validateProfile } from "../voice/profile.ts";
import type { VoiceProfile, VoiceTweak } from "../voice/types.ts";
import { voiceProfileSchema } from "../voice/types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedTweak {
	raw: string;
	tweak: VoiceTweak;
	description: string;
}

// ─── Tweak Parsing ──────────────────────────────────────────────────────────

const _PLATFORMS: Platform[] = ["x", "linkedin", "instagram", "tiktok"];
const platformSchema = z.enum(["x", "linkedin", "instagram", "tiktok"]);

export function parseTweakString(input: string): ParsedTweak {
	const trimmed = input.trim();

	// add-banned:{word}
	const addBannedMatch = trimmed.match(/^add-banned:(.+)$/);
	if (addBannedMatch) {
		const word = addBannedMatch[1] ?? "";
		return {
			raw: trimmed,
			tweak: { type: "add_banned_word", word },
			description: `Add "${word}" to banned words`,
		};
	}

	// remove-banned:{word}
	const removeBannedMatch = trimmed.match(/^remove-banned:(.+)$/);
	if (removeBannedMatch) {
		const word = removeBannedMatch[1] ?? "";
		return {
			raw: trimmed,
			tweak: { type: "remove_banned_word", word },
			description: `Remove "${word}" from banned words`,
		};
	}

	// formality:{value}
	const formalityMatch = trimmed.match(/^formality:(\d+)$/);
	if (formalityMatch) {
		const value = Number.parseInt(formalityMatch[1] ?? "5", 10);
		return {
			raw: trimmed,
			tweak: { type: "adjust_formality", value },
			description: `Set formality to ${value}/10`,
		};
	}

	// humor:{value}
	const humorMatch = trimmed.match(/^humor:(\d+)$/);
	if (humorMatch) {
		const value = Number.parseInt(humorMatch[1] ?? "5", 10);
		return {
			raw: trimmed,
			tweak: { type: "adjust_humor", value },
			description: `Set humor to ${value}/10`,
		};
	}

	// add-pillar:{topic}
	const addPillarMatch = trimmed.match(/^add-pillar:(.+)$/);
	if (addPillarMatch) {
		const pillar = addPillarMatch[1] ?? "";
		return {
			raw: trimmed,
			tweak: { type: "add_pillar", pillar },
			description: `Add "${pillar}" to content pillars`,
		};
	}

	// remove-pillar:{topic}
	const removePillarMatch = trimmed.match(/^remove-pillar:(.+)$/);
	if (removePillarMatch) {
		const pillar = removePillarMatch[1] ?? "";
		return {
			raw: trimmed,
			tweak: { type: "remove_pillar", pillar },
			description: `Remove "${pillar}" from content pillars`,
		};
	}

	// tone-{platform}:{tone}
	const toneMatch = trimmed.match(/^tone-(\w+):(.+)$/);
	if (toneMatch) {
		const platform = platformSchema.parse(toneMatch[1] ?? "");
		const tone = toneMatch[2] ?? "";

		return {
			raw: trimmed,
			tweak: { type: "set_platform_tone", platform, tone },
			description: `Set ${platform} tone to "${tone}"`,
		};
	}

	throw new Error(
		`Unknown tweak format: "${trimmed}". Valid formats: add-banned:{word}, remove-banned:{word}, formality:{1-10}, humor:{1-10}, add-pillar:{topic}, remove-pillar:{topic}, tone-{platform}:{tone}`,
	);
}

// ─── Apply Config Tweaks ────────────────────────────────────────────────────

export async function applyConfigTweaks(
	tweaks: string[],
	profilePath = "content/voice/personal.yaml",
): Promise<{ applied: ParsedTweak[]; profile: VoiceProfile }> {
	if (tweaks.length === 0) {
		throw new Error("No tweaks provided");
	}

	// Parse all tweaks first (fail fast on bad input)
	const parsed = tweaks.map(parseTweakString);

	// Apply all tweaks atomically
	const voiceTweaks = parsed.map((p) => p.tweak);
	const profile = await applyTweak(profilePath, voiceTweaks);

	return { applied: parsed, profile };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	try {
		switch (command) {
			case "apply": {
				const profilePath = args.find((a) => a.startsWith("--profile="))?.split("=")[1];
				const tweakArgs = args.slice(1).filter((a) => !a.startsWith("--"));

				if (tweakArgs.length === 0) {
					console.log(
						JSON.stringify({
							error: "No tweaks provided. Examples: formality:8, add-pillar:AI, add-banned:slang",
						}),
					);
					process.exit(1);
				}

				const result = await applyConfigTweaks(tweakArgs, profilePath);
				console.log(
					JSON.stringify({
						applied: result.applied.map((p) => ({
							raw: p.raw,
							description: p.description,
						})),
						profile: {
							pillars: result.profile.identity.pillars,
							banned: result.profile.identity.boundaries.avoid,
							formality: result.profile.style.formality,
							humor: result.profile.style.humor,
							platforms: Object.fromEntries(
								Object.entries(result.profile.platforms)
									.filter(([, v]) => v !== undefined)
									.map(([k, v]) => [k, { tone: v?.tone }]),
							),
						},
					}),
				);
				break;
			}

			case "show": {
				const profilePath =
					args.find((a) => a.startsWith("--profile="))?.split("=")[1] ??
					"content/voice/personal.yaml";
				const profile = await loadProfile(profilePath);
				console.log(
					JSON.stringify({
						pillars: profile.identity.pillars,
						banned: profile.identity.boundaries.avoid,
						cautious: profile.identity.boundaries.cautious,
						formality: profile.style.formality,
						humor: profile.style.humor,
						technicalDepth: profile.style.technicalDepth,
						storytelling: profile.style.storytelling,
						controversy: profile.style.controversy,
						platforms: Object.fromEntries(
							Object.entries(profile.platforms)
								.filter(([, v]) => v !== undefined)
								.map(([k, v]) => [
									k,
									{ tone: v?.tone, hashtags: v?.hashtagStyle, emoji: v?.emojiUsage },
								]),
						),
						calibration: profile.calibration,
					}),
				);
				break;
			}

			case "validate": {
				const profilePath =
					args.find((a) => a.startsWith("--profile-path="))?.split("=")[1] ??
					"content/voice/personal.yaml";

				// Check if profile file exists
				let profileData: unknown;
				try {
					const raw = await readFile(profilePath, "utf-8");
					profileData = parse(raw);
				} catch (err) {
					if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
						console.log(
							JSON.stringify({
								valid: false,
								errors: [`Voice profile not found at: ${profilePath}`],
							}),
						);
						process.exit(1);
					}
					console.log(
						JSON.stringify({
							valid: false,
							errors: [`Failed to read profile: ${String(err)}`],
						}),
					);
					process.exit(1);
				}

				// Validate against schema
				const result = validateProfile(profileData);

				if (result.valid) {
					console.log(
						JSON.stringify({
							valid: true,
							message: `Voice profile at ${profilePath} conforms to schema`,
						}),
					);
					process.exit(0);
				} else {
					// Format errors in a user-friendly way
					const formattedErrors = result.errors.map((err) => {
						// Parse Zod error format "path: message"
						const parts = err.split(":");
						if (parts.length >= 2) {
							const path = parts[0] || "root";
							const message = parts.slice(1).join(":").trim();
							return { path, message };
						}
						return { path: "unknown", message: err };
					});

					console.log(
						JSON.stringify({
							valid: false,
							profile: profilePath,
							errors: formattedErrors,
						}),
					);
					process.exit(1);
				}
			}

			default:
				console.log(
					JSON.stringify({
						error: "Unknown command. Use: apply, show, validate",
						examples: [
							"apply formality:8 add-pillar:AI",
							"apply add-banned:slang remove-pillar:crypto",
							"show --profile=content/voice/personal.yaml",
							"validate --profile-path=content/voice/personal.yaml",
						],
					}),
				);
		}
	} catch (err) {
		console.error(JSON.stringify({ error: String(err) }));
		process.exit(1);
	}
}
