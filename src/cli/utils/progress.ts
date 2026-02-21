import ora from "ora";

/**
 * Progress step status and metadata
 */
export interface StepProgress {
	name: string;
	status: "pending" | "running" | "completed" | "failed";
	duration?: string;
}

/**
 * Display full step list at the start of setup
 * Shows all steps upfront (not sequential reveal)
 *
 * @param steps - Array of step names to display
 */
export function createProgressStep(steps: string[]): void {
	console.log("\nSetup Steps:");
	console.log("=".repeat(50));
	steps.forEach((step) => {
		console.log(`[ ] ${step}`);
	});
	console.log("=".repeat(50));
}

/**
 * Execute a step with progress indicator and timing
 * Shows spinner during execution, then success/failure with duration
 *
 * @param stepName - Human-readable step name
 * @param fn - Async function to execute for this step
 * @returns Result of the function execution
 *
 * @throws Original error if fn fails (with spinner.fail() called first)
 */
export async function runStep<T>(stepName: string, fn: () => Promise<T>): Promise<T> {
	const spinner = ora(`Running: ${stepName}...`).start();
	const startTime = Date.now();

	try {
		const result = await fn();
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		spinner.succeed(`✓ ${stepName} [${duration}s]`);
		return result;
	} catch (error) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		spinner.fail(`✗ ${stepName} [${duration}s]`);
		throw error;
	}
}
