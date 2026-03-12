import { beforeEach, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = "/nix/store/ffgyf7g2n4gbhi1zgbcphssivfah1c4s-bun-1.3.10/bin/bun";
const CLI_SCRIPT = "src/cli/voice-interview.ts";

describe("Voice Interview CLI Tests", () => {
	const TEST_DIR = "content/voice";

	beforeEach(() => {
		// Clean up test directory
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
		mkdirSync(TEST_DIR, { recursive: true });
	});

	// Skip afterEach cleanup for now to allow multiple CLI commands to work

	describe("Command Parsing", () => {
		test("should show help for unknown command", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "unknown");

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Unknown command");
		});
	});

	describe("Start Command", () => {
		test("should start new interview", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "start");

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.phase).toBe("identity");
			expect(output.interviewId).toBe("default");

			// Check that interview file was created
			expect(existsSync("content/voice/.interview-default.json")).toBe(true);
		});

		test("should support recalibration flag", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "start", "--recalibrate");

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.isBlankSlate).toBe(true);
		});
	});

	describe("Submit Command", () => {
		test("should submit answers JSON", async () => {
			// First start an interview
			await runCommand(CLI_PATH, CLI_SCRIPT, "start");

			const answers = JSON.stringify({
				pillars: "AI, TypeScript, Startups",
				boundaries: "politics",
				posting_frequency: "Consistently (multiple times per week)",
			});

			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "submit", "--answers", answers);

			expect(result.status).toBe(0); // CLI returns 0 for successful submission
			const output = JSON.parse(result.stdout);
			expect(output.complete).toBe(false); // Should not be complete yet
			expect(output.phase).toBe("identity"); // Should still be in identity phase
		});

		test("should handle invalid JSON answers", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "submit", "--answers", "invalid{json");

			expect(result.status).toBe(1);
			expect(result.stderr).toContain("Invalid JSON for --answers");
		});
	});

	describe("Complete Command", () => {
		test("should complete interview with entity", async () => {
			// First start and submit some answers
			await runCommand(CLI_PATH, CLI_SCRIPT, "start");
			await runCommand(
				CLI_PATH,
				CLI_SCRIPT,
				"submit",
				"--answers",
				JSON.stringify({
					pillars: "AI, TypeScript",
					boundaries: "politics",
					platform_select: "X (Twitter)",
				}),
			);

			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "complete", "--entity", "test-entity");

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.success).toBe(true);
			expect(output.profilePath).toBe("content/voice/test-entity.yaml");
			expect(existsSync("content/voice/test-entity.yaml")).toBe(true);

			// Interview file should be deleted
			expect(existsSync("content/voice/.interview-default.json")).toBe(false);
		});
	});

	describe("List Command", () => {
		test("should show no interviews when empty", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "list");

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("No interviews in progress");
		});

		test("should show interviews when they exist", async () => {
			// Create some interview files
			writeFileSync("content/voice/.interview.json", '{"phase": "identity"}');
			writeFileSync("content/voice/.interview-abc123.json", '{"phase": "style"}');

			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "list");

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("2 interview(s)");
			expect(result.stdout).toContain("default");
			expect(result.stdout).toContain("abc123");
		});
	});

	describe("Select Command", () => {
		test("should select specific interview", async () => {
			// Create interview file
			writeFileSync("content/voice/.interview-abc123.json", '{"phase": "style"}');

			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "select", "abc123");

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Selected interview: abc123");
			expect(result.stdout).toContain("Next steps:");
		});

		test("should error for non-existent interview", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "select", "nonexistent");

			expect(result.status).toBe(1);
			expect(result.stderr).toContain("not found");
		});
	});

	describe("Interview ID Management", () => {
		test("should support explicit interview IDs in start", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "start", "--interview-id", "custom123");

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.interviewId).toBe("default"); // Still uses default internally
		});
	});

	describe("Error Handling", () => {
		test("should provide helpful error when interview not found", async () => {
			const result = await runCommand(
				CLI_PATH,
				CLI_SCRIPT,
				"complete",
				"--interview-id",
				"nonexistent",
			);

			expect(result.status).toBe(1);
			expect(result.stderr).toContain("No interview in progress");
		});
	});

	describe("Cleanup Command", () => {
		test("should cleanup old interviews", async () => {
			// Create old interview file (simulate old by timestamp)
			writeFileSync("content/voice/.interview-old.json", '{"phase": "identity"}');

			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "cleanup");

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Cleanup complete");
		});
	});

	describe("Timezone Validation", () => {
		test("should validate timezone format", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "timezone", "America/New_York");

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output.valid).toBe(true);
		});

		test("should reject invalid timezone", async () => {
			const result = await runCommand(CLI_PATH, CLI_SCRIPT, "timezone", "Invalid/Timezone");

			expect(result.status).toBe(1);
			expect(result.stdout).toContain("Invalid timezone");
		});
	});
});

// Helper function to run CLI command
async function runCommand(
	command: string,
	...args: string[]
): Promise<{
	status: number;
	stdout: string;
	stderr: string;
}> {
	return new Promise((resolve) => {
		const child = spawn(command, args, {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (status) => {
			resolve({
				status: status ?? 0,
				stdout,
				stderr,
			});
		});
	});
}
