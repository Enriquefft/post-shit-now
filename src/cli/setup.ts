import type { SetupResult, ValidationSummary } from "../core/types/index.ts";
import { setupDatabase } from "./setup-db.ts";
import { setupKeys } from "./setup-keys.ts";
import { setupTrigger } from "./setup-trigger.ts";
import { validateAll } from "./validate.ts";

interface SetupOutput {
	steps: SetupResult[];
	validation: ValidationSummary | null;
	completed: boolean;
}

/**
 * Main setup orchestrator for /psn:setup.
 * Runs each provisioning step in order with resume-from-failure support.
 * All output is JSON to stdout for Claude to interpret.
 */
export async function runSetup(configDir = "config"): Promise<SetupOutput> {
	const steps: SetupResult[] = [];

	// Step 1: Collect API keys
	const keysResult = await setupKeys(configDir);
	if (Array.isArray(keysResult)) {
		// Missing keys — return them all so Claude can prompt user
		return {
			steps: keysResult,
			validation: null,
			completed: false,
		};
	}
	steps.push(keysResult);

	// Step 2: Create database (includes Step 3: migrations)
	const dbResult = await setupDatabase(configDir);
	steps.push(dbResult);
	if (dbResult.status === "error") {
		return { steps, validation: null, completed: false };
	}

	// Step 4: Set up Trigger.dev
	const triggerResult = await setupTrigger(configDir);
	steps.push(triggerResult);
	if (triggerResult.status === "error") {
		return { steps, validation: null, completed: false };
	}
	if (triggerResult.status === "need_input") {
		return { steps, validation: null, completed: false };
	}

	// Step 5: Validate all connections
	const validation = await validateAll(configDir);
	steps.push({
		step: "validation",
		status: validation.allPassed ? "success" : "error",
		message: validation.allPassed
			? "All validation checks passed"
			: `${validation.results.filter((r) => r.status === "fail").length} checks failed`,
		data: { results: validation.results as unknown as Record<string, unknown>[] },
	});

	return {
		steps,
		validation,
		completed: validation.allPassed,
	};
}

// Entry point when run directly
if (import.meta.main) {
	runSetup()
		.then((result) => {
			console.log(JSON.stringify(result, null, 2));
			process.exit(result.completed ? 0 : 1);
		})
		.catch((err) => {
			console.log(
				JSON.stringify({
					steps: [
						{
							step: "setup",
							status: "error",
							message: err instanceof Error ? err.message : String(err),
						},
					],
					validation: null,
					completed: false,
				}),
			);
			process.exit(1);
		});
}
