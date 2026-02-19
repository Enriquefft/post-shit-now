import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import {
	applyTweak,
	generateStrategy,
	loadProfile,
	saveProfile,
	saveStrategy,
	validateProfile,
} from "./profile.ts";
import {
	type VoiceProfile,
	createBlankSlateProfile,
	createDefaultProfile,
	voiceProfileSchema,
} from "./types.ts";

describe("Voice Profile", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "psn-voice-test-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	// ─── Factory Functions ────────────────────────────────────────────────────

	describe("createDefaultProfile", () => {
		it("returns a valid profile", () => {
			const profile = createDefaultProfile();
			const result = voiceProfileSchema.safeParse(profile);
			expect(result.success).toBe(true);
		});

		it("has english language section", () => {
			const profile = createDefaultProfile();
			expect(profile.languages.en).toBeDefined();
		});

		it("has x platform persona", () => {
			const profile = createDefaultProfile();
			expect(profile.platforms.x).toBeDefined();
		});
	});

	describe("createBlankSlateProfile", () => {
		it("returns a valid profile", () => {
			const profile = createBlankSlateProfile();
			const result = voiceProfileSchema.safeParse(profile);
			expect(result.success).toBe(true);
		});

		it("has no language sections", () => {
			const profile = createBlankSlateProfile();
			expect(profile.languages.en).toBeUndefined();
			expect(profile.languages.es).toBeUndefined();
		});

		it("has no platform personas", () => {
			const profile = createBlankSlateProfile();
			expect(profile.platforms.x).toBeUndefined();
		});
	});

	// ─── Load/Save ────────────────────────────────────────────────────────────

	describe("loadProfile", () => {
		it("loads a valid YAML file", async () => {
			const profile = createDefaultProfile();
			const path = join(tmpDir, "test.yaml");
			await writeFile(path, stringify(profile), "utf-8");

			const loaded = await loadProfile(path);
			expect(loaded.version).toBe("1.0");
			expect(loaded.calibration.status).toBe("uncalibrated");
		});

		it("throws on missing file", async () => {
			const path = join(tmpDir, "nonexistent.yaml");
			await expect(loadProfile(path)).rejects.toThrow("Voice profile not found");
		});

		it("throws on invalid YAML", async () => {
			const path = join(tmpDir, "invalid.yaml");
			await writeFile(path, stringify({ version: "1.0" }), "utf-8");
			await expect(loadProfile(path)).rejects.toThrow("Invalid voice profile");
		});
	});

	describe("saveProfile", () => {
		it("writes valid YAML that round-trips", async () => {
			const profile = createDefaultProfile();
			const path = join(tmpDir, "roundtrip.yaml");

			await saveProfile(profile, path);
			const loaded = await loadProfile(path);

			expect(loaded.version).toBe(profile.version);
			expect(loaded.calibration.status).toBe(profile.calibration.status);
			expect(loaded.style.formality).toBe(profile.style.formality);
		});

		it("performs atomic write (no .tmp leftover)", async () => {
			const profile = createDefaultProfile();
			const path = join(tmpDir, "atomic.yaml");

			await saveProfile(profile, path);

			// .tmp should not exist after successful write
			await expect(readFile(`${path}.tmp`, "utf-8")).rejects.toThrow();
			// Main file should exist
			const content = await readFile(path, "utf-8");
			expect(content).toBeTruthy();
		});

		it("updates updatedAt timestamp", async () => {
			const profile = createDefaultProfile();
			const originalUpdatedAt = profile.updatedAt;
			const path = join(tmpDir, "timestamp.yaml");

			// Small delay to ensure timestamps differ
			await new Promise((r) => setTimeout(r, 10));
			await saveProfile(profile, path);

			const loaded = await loadProfile(path);
			expect(loaded.updatedAt).not.toBe(originalUpdatedAt);
		});
	});

	// ─── Validate ─────────────────────────────────────────────────────────────

	describe("validateProfile", () => {
		it("returns valid for correct profile", () => {
			const profile = createDefaultProfile();
			const result = validateProfile(profile);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("returns structured errors for invalid data", () => {
			const result = validateProfile({ version: "1.0" });
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("returns errors for invalid style values", () => {
			const profile = createDefaultProfile();
			(profile as Record<string, unknown>).style = { formality: 15 };
			const result = validateProfile(profile);
			expect(result.valid).toBe(false);
		});
	});

	// ─── Tweaks ─────────────────────────────────────────────────────────────

	describe("applyTweak", () => {
		let profilePath: string;

		beforeEach(async () => {
			profilePath = join(tmpDir, "tweak.yaml");
			const profile = createDefaultProfile();
			profile.identity.pillars = ["AI", "typescript"];
			profile.identity.boundaries.avoid = ["politics"];
			await writeFile(profilePath, stringify(profile), "utf-8");
		});

		it("adds a banned word", async () => {
			const result = await applyTweak(profilePath, [{ type: "add_banned_word", word: "slang" }]);
			expect(result.identity.boundaries.avoid).toContain("slang");
		});

		it("does not duplicate banned words", async () => {
			const result = await applyTweak(profilePath, [{ type: "add_banned_word", word: "politics" }]);
			expect(result.identity.boundaries.avoid.filter((w) => w === "politics")).toHaveLength(1);
		});

		it("removes a banned word", async () => {
			const result = await applyTweak(profilePath, [
				{ type: "remove_banned_word", word: "politics" },
			]);
			expect(result.identity.boundaries.avoid).not.toContain("politics");
		});

		it("adjusts formality", async () => {
			const result = await applyTweak(profilePath, [{ type: "adjust_formality", value: 8 }]);
			expect(result.style.formality).toBe(8);
		});

		it("clamps formality to 1-10", async () => {
			const result = await applyTweak(profilePath, [{ type: "adjust_formality", value: 15 }]);
			expect(result.style.formality).toBe(10);
		});

		it("adjusts humor", async () => {
			const result = await applyTweak(profilePath, [{ type: "adjust_humor", value: 2 }]);
			expect(result.style.humor).toBe(2);
		});

		it("clamps humor to 1-10", async () => {
			const result = await applyTweak(profilePath, [{ type: "adjust_humor", value: -5 }]);
			expect(result.style.humor).toBe(1);
		});

		it("adds a pillar", async () => {
			const result = await applyTweak(profilePath, [{ type: "add_pillar", pillar: "devops" }]);
			expect(result.identity.pillars).toContain("devops");
		});

		it("removes a pillar", async () => {
			const result = await applyTweak(profilePath, [{ type: "remove_pillar", pillar: "AI" }]);
			expect(result.identity.pillars).not.toContain("AI");
		});

		it("sets platform tone for existing platform", async () => {
			const result = await applyTweak(profilePath, [
				{ type: "set_platform_tone", platform: "x", tone: "witty" },
			]);
			expect(result.platforms.x?.tone).toBe("witty");
		});

		it("creates platform persona if not exists", async () => {
			const result = await applyTweak(profilePath, [
				{ type: "set_platform_tone", platform: "linkedin", tone: "formal" },
			]);
			expect(result.platforms.linkedin?.tone).toBe("formal");
		});

		it("applies multiple tweaks at once", async () => {
			const result = await applyTweak(profilePath, [
				{ type: "add_banned_word", word: "yolo" },
				{ type: "adjust_formality", value: 9 },
				{ type: "add_pillar", pillar: "security" },
			]);
			expect(result.identity.boundaries.avoid).toContain("yolo");
			expect(result.style.formality).toBe(9);
			expect(result.identity.pillars).toContain("security");
		});
	});

	// ─── Strategy Generation ──────────────────────────────────────────────────

	describe("generateStrategy", () => {
		it("produces valid StrategyConfig from profile", () => {
			const profile = createDefaultProfile();
			profile.identity.pillars = ["AI", "TypeScript", "DevOps"];
			const strategy = generateStrategy(profile);

			expect(strategy.pillars).toHaveLength(3);
			expect(strategy.languages.primary).toBe("en");
		});

		it("distributes pillar weights equally", () => {
			const profile = createDefaultProfile();
			profile.identity.pillars = ["A", "B"];
			const strategy = generateStrategy(profile);

			expect(strategy.pillars[0]!.weight).toBe(0.5);
			expect(strategy.pillars[1]!.weight).toBe(0.5);
		});

		it("enables only platforms with personas", () => {
			const profile = createDefaultProfile();
			const strategy = generateStrategy(profile);

			expect(strategy.platforms.x?.enabled).toBe(true);
			expect(strategy.platforms.linkedin?.enabled).toBe(false);
		});

		it("detects primary and secondary languages", () => {
			const profile = createDefaultProfile();
			profile.languages.es = {
				vocabulary: [],
				sentencePatterns: [],
				openingStyles: [],
				closingStyles: [],
				idioms: [],
			};
			const strategy = generateStrategy(profile);

			expect(strategy.languages.primary).toBe("en");
			expect(strategy.languages.secondary).toBe("es");
		});

		it("calculates posting frequency from enabled platforms", () => {
			const profile = createDefaultProfile();
			const strategy = generateStrategy(profile);

			// Only X enabled (7/week)
			expect(strategy.postingFrequency.max).toBe(7);
			expect(strategy.postingFrequency.min).toBeGreaterThan(0);
		});
	});

	describe("saveStrategy", () => {
		it("writes valid strategy YAML", async () => {
			const profile = createDefaultProfile();
			profile.identity.pillars = ["AI"];
			const strategy = generateStrategy(profile);
			const path = join(tmpDir, "strategy.yaml");

			await saveStrategy(strategy, path);
			const content = await readFile(path, "utf-8");
			const parsed = parse(content);
			expect(parsed.pillars).toHaveLength(1);
		});
	});
});
