import { describe, expect, test } from "bun:test";
import {
	createInterviewState,
	finalizeProfile,
	generateInterviewId,
	getInterviewStatePath,
	processAnswer,
} from "./interview.ts";
import { createBlankSlateProfile, voiceProfileSchema } from "./types.ts";

describe("Interview State Core Logic", () => {
	describe("Interview ID Generation", () => {
		test("should generate timestamp-based IDs", () => {
			const id1 = generateInterviewId();
			const id2 = generateInterviewId();

			// IDs should be base36 encoded timestamps
			expect(parseInt(id1, 36)).toBeTypeOf("number");
			expect(parseInt(id2, 36)).toBeTypeOf("number");
		});
	});

	describe("Interview State Path", () => {
		test("should return path for default interview", () => {
			const path = getInterviewStatePath();
			expect(path).toBe("content/voice/.interview-default.json");
		});

		test("should return path for specific interview ID", () => {
			const path = getInterviewStatePath("abc123");
			expect(path).toBe("content/voice/.interview-abc123.json");
		});
	});

	describe("Interview State Creation", () => {
		test("should create blank slate interview with no options", () => {
			const state = createInterviewState();

			expect(state.phase).toBe("identity");
			expect(state.questionIndex).toBe(0);
			expect(state.answers.size).toBe(0);
			expect(state.isBlankSlate).toBe(true);
			expect(state.isRecalibration).toBe(false);
			expect(state.detectedExperience).toBe(null);
			expect(state.maturityLevel).toBe(null);
			expect(state.languages).toEqual(["en"]);
		});

		test("should create recalibration interview", () => {
			const state = createInterviewState({ recalibration: true });

			expect(state.isRecalibration).toBe(true);
			expect(state.isBlankSlate).toBe(true);
		});

		test("should create interview with existing profile", () => {
			const existingProfile = createBlankSlateProfile();
			const state = createInterviewState({ existingProfile });

			expect(state.existingProfile).toBe(existingProfile);
			expect(state.isBlankSlate).toBe(false);
		});
	});

	describe("Answer Processing", () => {
		test("should process answers", () => {
			const state = createInterviewState();
			const updated = processAnswer(state, "pillars", "AI, TypeScript, Startups");

			expect(updated.answers.has("pillars")).toBe(true);
			expect(updated.answers.get("pillars")).toBe("AI, TypeScript, Startups");
		});

		test("should detect experience level", () => {
			const state = createInterviewState();
			state.answers.set("pillars", "engagement, analytics, conversion");
			state.answers.set("posting_frequency", "Consistently (multiple times per week)");

			const updated = processAnswer(state, "pillars", "engagement, analytics, conversion");

			expect(updated.detectedExperience).not.toBe(null);
		});

		test("should handle bilingual detection", () => {
			const state = createInterviewState();
			const updated = processAnswer(state, "bilingual", "Both");

			expect(updated.languages).toEqual(["en", "es"]);
		});

		test("should detect maturity level", () => {
			const state = createInterviewState();
			const updated = processAnswer(
				state,
				"posting_frequency",
				"Consistently (multiple times per week)",
			);

			expect(updated.maturityLevel).toBeDefined();
			if (updated.maturityLevel) {
				expect(updated.maturityLevel).toBe("consistent");
			}
		});

		test("should not advance phase until all questions are answered", () => {
			const state = createInterviewState();
			// Answer only some identity questions
			state.answers.set("pillars", "AI, TypeScript");
			state.answers.set("boundaries", "politics");

			const updated = processAnswer(state, "boundaries", "politics");

			expect(updated.phase).toBe("identity"); // Should stay in identity phase
		});
	});

	describe("Profile Finalization", () => {
		test("should finalize profile from interview state", () => {
			const state = createInterviewState();
			// Process answers to trigger maturity level detection
			const processedState = processAnswer(
				state,
				"posting_frequency",
				"Consistently (multiple times per week)",
			);
			processedState.answers.set("pillars", "AI, TypeScript, Startups");
			processedState.answers.set("boundaries", "politics, negativity");
			processedState.answers.set("timezone", "America/New_York");
			processedState.answers.set("platform_select", "X (Twitter), LinkedIn");
			processedState.answers.set("bilingual", "Both");
			processedState.languages = ["en", "es"];

			const profile = finalizeProfile(processedState);

			expect(profile.identity.pillars).toEqual(["AI", "TypeScript", "Startups"]);
			expect(profile.identity.boundaries.avoid).toEqual(["politics", "negativity"]);
			expect(profile.timezone).toBe("America/New_York");
			expect(profile.maturityLevel).toBeDefined();
			expect(profile.languages.en).toBeDefined();
			expect(profile.languages.es).toBeDefined();
			expect(profile.platforms.x).toBeDefined();
			expect(profile.platforms.linkedin).toBeDefined();
		});

		test("should validate finalized profile", () => {
			const state = createInterviewState();
			const profile = finalizeProfile(state);

			const result = voiceProfileSchema.safeParse(profile);
			expect(result.success).toBe(true);
		});

		test("should handle empty answers gracefully", () => {
			const state = createInterviewState();
			// Don't set any answers

			const profile = finalizeProfile(state);

			expect(profile.identity.pillars).toEqual([]);
			expect(profile.identity.boundaries.avoid).toEqual([]);
			expect(profile.languages.en).toBeDefined();
		});

		test("should parse comma-separated values", () => {
			const state = createInterviewState();
			state.answers.set("pillars", "AI, TypeScript, Startups");
			state.answers.set("boundaries", "politics, negativity, religion");

			const profile = finalizeProfile(state);

			expect(profile.identity.pillars).toEqual(["AI", "TypeScript", "Startups"]);
			expect(profile.identity.boundaries.avoid).toEqual(["politics", "negativity", "religion"]);
		});
	});

	describe("Interview Flow", () => {
		test("should start in identity phase", () => {
			const state = createInterviewState();
			expect(state.phase).toBe("identity");
		});

		test("should handle blank slate vs normal flow", () => {
			const normal = createInterviewState({
				importedContent: [{ text: "some post", platform: "x", source: "other" }],
			});
			const blankSlate = createInterviewState();

			expect(normal.isBlankSlate).toBe(false);
			expect(blankSlate.isBlankSlate).toBe(true);
		});

		test("should detect experience from imported content and answers", () => {
			const importedContent = [
				{ text: "post about content", platform: "x", source: "other" as const },
			];
			const state = createInterviewState({ importedContent });
			// Add answer with advanced signals
			state.answers.set(
				"pillars",
				"engagement, analytics, growth, strategy, algorithms, conversion",
			);

			const updated = processAnswer(
				state,
				"pillars",
				"engagement, analytics, growth, strategy, algorithms, conversion",
			);
			expect(updated.detectedExperience).toBe("advanced"); // Answer signals should push to advanced
		});
	});
});
