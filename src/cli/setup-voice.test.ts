import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DbClient } from "../core/db/connection.ts";
import { getSetupStatus, setupVoice } from "./setup-voice.ts";

describe("Setup Voice Tests", () => {
	const TEST_DIR = ".hubs";

	beforeEach(() => {
		vi.clearAllMocks();
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		// Clean up legacy voice profile that might exist
		if (existsSync("content/voice/personal.yaml")) {
			rmSync("content/voice/personal.yaml", { force: true });
		}
	});

	describe("Get Setup Status", () => {
		test("should detect no setup when nothing exists", async () => {
			const status = await getSetupStatus("config");

			expect(status.hasHub).toBe(false);
			expect(status.hasVoiceProfile).toBe(false);
			expect(status.hasEntities).toBe(false);
			expect(status.hasPlatforms).toBe(false);
			expect(status.entityCount).toBe(0);
			expect(status.incompleteSteps).toEqual(["hub", "voice", "platforms"]);
			expect(status.recommendedAction).toBe("run-setup");
		});

		test("should detect hub when .hubs/personal.json exists", async () => {
			writeFileSync(join(TEST_DIR, "personal.json"), '{"name": "Personal Hub"}');

			const status = await getSetupStatus("config");

			expect(status.hasHub).toBe(true);
			expect(status.hasVoiceProfile).toBe(false);
			expect(status.incompleteSteps).toEqual(["voice", "platforms"]);
			expect(status.recommendedAction).toBe("setup-voice");
		});

		test("should detect legacy voice profile", async () => {
			mkdirSync("content/voice", { recursive: true });
			writeFileSync("content/voice/personal.yaml", "identity:\n  pillars:\n    - AI");

			const status = await getSetupStatus("config");

			expect(status.hasVoiceProfile).toBe(true);
			expect(status.hasEntities).toBe(true);
			expect(status.entityCount).toBe(1);
		});

		test("should determine correct recommended action", async () => {
			// Hub missing
			let status = await getSetupStatus("config");
			expect(status.recommendedAction).toBe("run-setup");

			// Hub exists, voice missing - should still need voice setup
			writeFileSync(join(TEST_DIR, "personal.json"), '{"name": "Personal Hub"}');
			status = await getSetupStatus("config");
			expect(status.incompleteSteps).toEqual(["voice", "platforms"]);
			expect(status.recommendedAction).toBe("setup-voice");

			// Hub and voice exist, platforms missing - should recommend connect platforms
			mkdirSync("content/voice", { recursive: true });
			writeFileSync("content/voice/personal.yaml", "identity:\n  pillars:\n    - AI");
			status = await getSetupStatus("config");
			expect(status.incompleteSteps).toEqual(["platforms"]);
			expect(status.recommendedAction).toBe("connect-platform");
		});
	});

	describe("Setup Voice Handler", () => {
		test("should return interview for entity creation", async () => {
			const result = await setupVoice({
				userId: "user123",
				entitySlug: "test-entity",
				db: {} as unknown as DbClient,
				configDir: "config",
			});

			expect(result.step).toBe("voice");
			expect(result.status).toBe("need_input");
			expect(result.data!.action).toBe("interview");
			expect(result.data!.entitySlug).toBe("test-entity");
		});
	});

	describe("File System Integration", () => {
		test("should handle directory creation gracefully", async () => {
			// Remove test directory to simulate missing case
			rmSync(TEST_DIR, { recursive: true, force: true });

			const status = await getSetupStatus("config");
			expect(status.hasHub).toBe(false);
		});

		test("should handle malformed JSON gracefully", async () => {
			writeFileSync(join(TEST_DIR, "personal.json"), "invalid json");

			const status = await getSetupStatus("config");
			// Malformed JSON should not crash
			expect(status).toBeDefined();
		});
	});

	describe("Database Scenarios", () => {
		test("should handle null db gracefully (file-based fallback)", async () => {
			const status = await getSetupStatus("config", undefined, "user123");

			expect(status).toBeDefined();
			expect(typeof status.incompleteSteps).toBe("object");
		});
	});
});
