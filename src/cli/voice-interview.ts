import { readFile, unlink, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
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
	createInterviewState,
	ensureVoiceDirectories,
	finalizeProfile,
	generateQuestions,
	type InterviewQuestion,
	type InterviewState,
	processAnswer,
} from "../voice/interview.ts";
import { generateStrategy, loadProfile, saveProfile, saveStrategy } from "../voice/profile.ts";
import type { VoiceProfile } from "../voice/types.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const INTERVIEW_STATE_FILE = ".interview.json";
const PHASE_ORDER = ["identity", "style", "platforms", "language", "review"] as const;

// ─── State Persistence ───────────────────────────────────────────────────────

interface SerializedInterviewState {
	phase: string;
	answers: Record<string, string>;
	detectedExperience: string | null;
	maturityLevel: string | null;
	languages: ("en" | "es")[];
	isBlankSlate: boolean;
	isRecalibration: boolean;
}

function serializeState(state: InterviewState): SerializedInterviewState {
	return {
		phase: state.phase,
		answers: Object.fromEntries(state.answers),
		detectedExperience: state.detectedExperience,
		maturityLevel: state.maturityLevel,
		languages: state.languages,
		isBlankSlate: state.isBlankSlate,
		isRecalibration: state.isRecalibration,
	};
}

function deserializeState(serialized: SerializedInterviewState): InterviewState {
	return {
		phase: serialized.phase as InterviewState["phase"],
		questionIndex: 0,
		answers: new Map(Object.entries(serialized.answers)),
		detectedExperience: serialized.detectedExperience,
		maturityLevel: serialized.maturityLevel,
		languages: serialized.languages,
		importedContent: null,
		isBlankSlate: serialized.isBlankSlate,
		isRecalibration: serialized.isRecalibration,
	};
}

async function loadInterviewState(): Promise<InterviewState | null> {
	try {
		const raw = await readFile(INTERVIEW_STATE_FILE, "utf-8");
		const data = JSON.parse(raw) as SerializedInterviewState;
		return deserializeState(data);
	} catch {
		return null;
	}
}

async function saveInterviewState(state: InterviewState): Promise<void> {
	const serialized = serializeState(state);
	await writeFile(INTERVIEW_STATE_FILE, JSON.stringify(serialized, null, 2), "utf-8");
}

async function deleteInterviewState(): Promise<void> {
	try {
		await unlink(INTERVIEW_STATE_FILE);
	} catch {
		// File doesn't exist — ignore
	}
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
}): Promise<{ state: InterviewState; questions: InterviewQuestion[] }> {
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
	return { state, questions };
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

export async function submitAnswersInteractive(): Promise<{
	complete: boolean;
	phase: string;
	questions: InterviewQuestion[];
}> {
	// Load existing state or start fresh
	let state = await loadInterviewState();
	if (!state) {
		state = createInterviewState();
	}

	const rl = readline.createInterface({ input, output });

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
					await saveInterviewState(state);
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
				await saveInterviewState(state);
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

export async function completeInterviewInteractive(): Promise<{
	profilePath: string;
	strategyPath: string | undefined;
}> {
	const state = await loadInterviewState();
	if (!state) {
		throw new Error("No interview in progress. Run 'start' to begin.");
	}

	// Validate interview is complete
	if (state.phase !== "review") {
		throw new Error("Interview not complete. Run 'submit' to finish answering questions.");
	}

	const rl = readline.createInterface({ input, output });

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
		await deleteInterviewState();
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
				await ensureVoiceDirectories(); // Ensure dirs before starting interview
				const recalibration = args.includes("--recalibrate");
				const result = await startInterview({ recalibration });
				console.log(
					JSON.stringify({
						phase: result.state.phase,
						questions: result.questions,
						isBlankSlate: result.state.isBlankSlate,
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
				const result = await completeInterviewInteractive();
				console.log(`\nProfile: ${result.profilePath}`);
				if (result.strategyPath) {
					console.log(`Strategy: ${result.strategyPath}`);
				}
				break;
			}
			default:
				console.log(
					JSON.stringify({
						error: "Unknown command. Use: start, submit, import, complete",
					}),
				);
		}
	} catch (err) {
		console.error(JSON.stringify({ error: String(err) }));
		process.exit(1);
	}
}
