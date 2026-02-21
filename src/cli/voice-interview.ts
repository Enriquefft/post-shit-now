import process from "node:process";
import * as readline from "node:readline/promises";
import { loadKeysEnv } from "../core/utils/env.ts";
import type { ContentAnalysis } from "../voice/import.ts";
import {
	analyzeImportedContent,
	type ImportedContent,
	importBlogContent,
	importRawText,
	importXHistory,
} from "../voice/import.ts";
import {
	cleanupOldInterviews,
	createInterviewState,
	deleteInterviewState as deleteState,
	ensureVoiceDirectories,
	finalizeProfile,
	generateInterviewId,
	generateQuestions,
	type InterviewQuestion,
	type InterviewState,
	listInterviews,
	loadInterviewState as loadState,
	processAnswer,
	saveInterviewState as saveState,
} from "../voice/interview.ts";
import { generateStrategy, loadProfile, saveProfile, saveStrategy } from "../voice/profile.ts";
import type { VoiceProfile } from "../voice/types.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASE_ORDER = ["identity", "style", "platforms", "language", "review"] as const;

// ─── State Persistence (using interview.ts functions) ─────────────────────────────────

/**
 * Load interview state (defaults to default interview)
 */
async function loadInterviewState(interviewId?: string): Promise<InterviewState | null> {
	return await loadState(interviewId);
}

/**
 * Save interview state (defaults to default interview)
 */
async function saveInterviewState(state: InterviewState, interviewId?: string): Promise<void> {
	await saveState(state, interviewId);
}

/**
 * Delete interview state (defaults to default interview)
 */
async function deleteInterviewState(interviewId?: string): Promise<void> {
	await deleteState(interviewId);
}

// ─── Interactive Prompting ───────────────────────────────────────────────────

async function promptForAnswer(
	rl: readline.Interface,
	question: InterviewQuestion,
	_phaseIndex: number,
): Promise<string> {
	const _totalPhases = PHASE_ORDER.length;
	const currentPhase = question.phase;
	const _phaseOrderIndex = PHASE_ORDER.indexOf(currentPhase);

	let prompt = `\n${currentPhase.toUpperCase()} PHASE\n`;
	prompt += `${question.text}`;

	if (question.hint) {
		prompt += `\n(Hint: ${question.hint})`;
	}

	if (question.options) {
		prompt += "\nOptions:";
		question.options.forEach((opt, idx) => {
			prompt += `\n  ${idx + 1}. ${opt}`;
		});
	}

	const answer = await rl.question(`${prompt}\n\n${question.text}\n> `);
	return answer.trim();
}

// ─── Start Interview ────────────────────────────────────────────────────────

export async function startInterview(options?: {
	recalibration?: boolean;
	profilePath?: string;
}): Promise<{ state: InterviewState; questions: InterviewQuestion[]; interviewId: string }> {
	// Ensure directories exist before collecting answers
	await ensureVoiceDirectories();

	let existingProfile: VoiceProfile | undefined;

	if (options?.recalibration && options?.profilePath) {
		try {
			existingProfile = await loadProfile(options.profilePath);
		} catch {
			// No existing profile — start fresh
		}
	}

	const state = createInterviewState({
		recalibration: options?.recalibration,
		existingProfile,
	});

	const questions = generateQuestions(state);

	// Generate interview ID and save initial state
	const interviewId = generateInterviewId();
	await saveInterviewState(state, interviewId);

	return { state, questions, interviewId };
}

// ─── Submit Answers ─────────────────────────────────────────────────────────

export function submitAnswers(
	state: InterviewState,
	answers: Record<string, string>,
): { state: InterviewState; questions: InterviewQuestion[]; complete: boolean } {
	let updated = state;

	for (const [questionId, answer] of Object.entries(answers)) {
		updated = processAnswer(updated, questionId, answer);
	}

	const questions = generateQuestions(updated);
	const complete = updated.phase === "review";

	return { state: updated, questions, complete };
}

// ─── Interactive Submit ─────────────────────────────────────────────────────

export async function submitAnswersInteractive(interviewId?: string): Promise<{
	complete: boolean;
	phase: string;
	questions: InterviewQuestion[];
}> {
	// Load existing state or start fresh
	let state = await loadInterviewState(interviewId);
	if (!state) {
		state = createInterviewState();
		// Save initial state if we're creating it fresh
		const newId = interviewId ?? generateInterviewId();
		await saveInterviewState(state, newId);
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	try {
		// Loop through phases until all questions answered
		while (state.phase !== "review") {
			const questions = generateQuestions(state);
			const unansweredQuestions = questions.filter((q) => !state.answers.has(q.id));

			if (unansweredQuestions.length === 0) {
				// All questions in this phase answered, auto-advance
				const currentIndex = PHASE_ORDER.indexOf(state.phase);
				const nextPhase = PHASE_ORDER[currentIndex + 1];
				if (nextPhase) {
					state = { ...state, phase: nextPhase, questionIndex: 0 };
					await saveInterviewState(state, interviewId);
					console.log(`\n--- Moving to ${nextPhase.toUpperCase()} phase ---\n`);
					continue;
				}
				break;
			}

			// Get phase info for progress display
			const phaseOrderIndex = PHASE_ORDER.indexOf(state.phase);
			const totalPhases = PHASE_ORDER.length;

			// Prompt for each unanswered question
			for (const question of unansweredQuestions) {
				const phaseLabel = `${phaseOrderIndex + 1}/${totalPhases}`;
				const questionNumber = questions.indexOf(question) + 1;
				const totalQuestions = questions.length;

				console.log(`Phase ${phaseLabel} • Question ${questionNumber}/${totalQuestions}`);

				let answer: string;
				let attempts = 0;
				const maxAttempts = 3;

				// Validation loop
				while (attempts < maxAttempts) {
					answer = await promptForAnswer(rl, question, phaseOrderIndex);

					// Validate required answers
					if (question.required && !answer.trim()) {
						attempts++;
						console.log(
							`This field is required. Please try again.${attempts < maxAttempts ? "" : " (Skipping question.)"}`,
						);
						if (attempts >= maxAttempts) {
							answer = "";
							break;
						}
						continue;
					}

					break;
				}

				state.answers.set(question.id, answer);

				// Process answer (handles auto-advance logic)
				state = processAnswer(state, question.id, answer);
				// Save state after each answer submission
				await saveInterviewState(state, interviewId);
			}
		}

		// Get final questions for review phase
		const finalQuestions = generateQuestions(state);
		const complete = state.phase === "review";

		return { complete, phase: state.phase, questions: finalQuestions };
	} finally {
		rl.close();
	}
}

// ─── Complete Interview ─────────────────────────────────────────────────────

export async function completeInterview(
	state: InterviewState,
	options?: { profilePath?: string; strategyPath?: string },
): Promise<{
	profile: VoiceProfile;
	profilePath: string;
	strategyPath?: string;
}> {
	// Ensure directories exist before saving
	await ensureVoiceDirectories();

	const profile = finalizeProfile(state);
	const profilePath = options?.profilePath ?? "content/voice/personal.yaml";

	await saveProfile(profile, profilePath);

	let strategyPath: string | undefined;
	if (profile.identity.pillars.length > 0) {
		const strategy = generateStrategy(profile);
		strategyPath = options?.strategyPath ?? "content/voice/strategy.yaml";
		await saveStrategy(strategy, strategyPath);
	}

	return { profile, profilePath, strategyPath };
}

// ─── Interactive Complete ───────────────────────────────────────────────────

export async function completeInterviewInteractive(interviewId?: string): Promise<{
	profilePath: string;
	strategyPath: string | undefined;
}> {
	const state = await loadInterviewState(interviewId);
	if (!state) {
		throw new Error("No interview in progress. Run 'start' to begin.");
	}

	// Validate interview is complete
	if (state.phase !== "review") {
		throw new Error("Interview not complete. Run 'submit' to finish answering questions.");
	}

	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

	try {
		// Prompt for save path
		const defaultProfilePath = "content/voice/personal.yaml";
		console.log(`Save voice profile to [${defaultProfilePath}]:`);
		const profilePathInput = await rl.question("> ");
		const profilePath = profilePathInput.trim() || defaultProfilePath;

		// Complete interview and save
		const result = await completeInterview(state, { profilePath });

		console.log(`\n=== Success ===`);
		console.log(`Voice profile saved to: ${result.profilePath}`);
		if (result.strategyPath) {
			console.log(`Strategy saved to: ${result.strategyPath}`);
		}

		// Clean up interview state
		await deleteInterviewState(interviewId);
		console.log("Interview state cleaned up.");

		return {
			profilePath: result.profilePath,
			strategyPath: result.strategyPath,
		};
	} finally {
		rl.close();
	}
}

// ─── Import Content ─────────────────────────────────────────────────────────

export async function importContent(sources: {
	xHistory?: boolean;
	blogUrls?: string[];
	rawTexts?: string[];
}): Promise<{ imported: ImportedContent[]; analysis: ContentAnalysis }> {
	const allImported: ImportedContent[] = [];

	if (sources.xHistory) {
		const keysResult = await loadKeysEnv();
		if (keysResult.success && keysResult.data.X_ACCESS_TOKEN) {
			try {
				const xContent = await importXHistory(keysResult.data.X_ACCESS_TOKEN);
				allImported.push(...xContent);
			} catch {
				// X import failed — continue with other sources
			}
		}
	}

	if (sources.blogUrls?.length) {
		const blogContent = await importBlogContent(sources.blogUrls);
		allImported.push(...blogContent);
	}

	if (sources.rawTexts?.length) {
		const rawContent = await importRawText(sources.rawTexts);
		allImported.push(...rawContent);
	}

	const analysis = analyzeImportedContent(allImported);
	return { imported: allImported, analysis };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	try {
		switch (command) {
			case "start": {
				await ensureVoiceDirectories();
				const recalibration = args.includes("--recalibrate");
				const result = await startInterview({ recalibration });
				console.log(
					JSON.stringify({
						phase: result.state.phase,
						questions: result.questions,
						isBlankSlate: result.state.isBlankSlate,
						interviewId: result.interviewId,
					}),
				);
				break;
			}
			case "import": {
				const blogUrls = args.filter((a) => a.startsWith("http"));
				const result = await importContent({
					xHistory: args.includes("--x"),
					blogUrls: blogUrls.length > 0 ? blogUrls : undefined,
				});
				console.log(
					JSON.stringify({
						importedCount: result.imported.length,
						analysis: result.analysis,
					}),
				);
				break;
			}
			case "submit": {
				const result = await submitAnswersInteractive();
				if (result.complete) {
					console.log("\n=== Interview Complete ===");
					console.log("All questions answered. Run 'complete' to save your voice profile.");
				} else {
					console.log(`\n=== Current Phase: ${result.phase.toUpperCase()} ===`);
					if (result.questions.length > 0) {
						console.log("\nNext questions:");
						for (const q of result.questions) {
							console.log(`  - ${q.text}`);
						}
					}
					console.log("\nRun 'submit' again to continue.");
				}
				break;
			}
			case "complete": {
				// Check if there are multiple interviews
				const interviews = await listInterviews();
				let interviewId: string | undefined;

				if (interviews.length === 0) {
					throw new Error("No interview in progress. Run 'start' to begin.");
				}

				if (interviews.length > 1) {
					console.log("\nMultiple interviews in progress:");
					interviews.forEach((interview, idx) => {
						const ageHours = interview.ageMs / 1000 / 60 / 60;
						const idDisplay = interview.id === "default" ? "default" : interview.id;
						console.log(`  ${idx + 1}. ${idDisplay} (${ageHours.toFixed(1)}h old)`);
					});

					const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
					try {
						const selectionInput = await rl.question("\nWhich interview to complete? [id or number]: ");
						rl.close();

						const trimmed = selectionInput.trim();
						// Check if it's a number
						const num = Number.parseInt(trimmed, 10);
						if (!Number.isNaN(num) && num >= 1 && num <= interviews.length) {
							const selected = interviews[num - 1];
							interviewId = selected.id === "default" ? undefined : selected.id;
						} else {
							// Use as ID
							const selected = interviews.find((interview) => interview.id === trimmed);
							if (!selected) {
								throw new Error(`Invalid interview ID: ${trimmed}`);
							}
							interviewId = selected.id === "default" ? undefined : selected.id;
						}
					} finally {
						rl.close();
					}
				}

				const result = await completeInterviewInteractive(interviewId);
				console.log(`\nProfile: ${result.profilePath}`);
				if (result.strategyPath) {
					console.log(`Strategy: ${result.strategyPath}`);
				}
				break;
			}
			case "cleanup": {
				console.log("Cleaning up old interview files (older than 7 days)...");
				await cleanupOldInterviews();
				console.log("Cleanup complete.");
				break;
			}
			case "list": {
				const interviews = await listInterviews();
				if (interviews.length === 0) {
					console.log("No interviews in progress.");
				} else {
					console.log(`\n${interviews.length} interview(s) in progress:\n`);
					interviews.forEach((interview) => {
						const ageHours = interview.ageMs / 1000 / 60 / 60;
						const ageDays = ageHours / 24;
						const ageDisplay = ageDays >= 1 ? `${ageDays.toFixed(1)}d` : `${ageHours.toFixed(1)}h`;
						const idDisplay = interview.id === "default" ? "default" : interview.id;
						console.log(`  • ${idDisplay}: ${interview.path} (${ageDisplay} old)`);
					});
				}
				break;
			}
			default:
				console.log(
					JSON.stringify({
						error: "Unknown command. Use: start, submit, import, complete, cleanup, list",
					}),
				);
		}
	} catch (err) {
		console.error(JSON.stringify({ error: String(err) }));
		process.exit(1);
	}
}
