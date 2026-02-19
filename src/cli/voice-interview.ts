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
	finalizeProfile,
	generateQuestions,
	type InterviewQuestion,
	type InterviewState,
	processAnswer,
} from "../voice/interview.ts";
import { generateStrategy, loadProfile, saveProfile, saveStrategy } from "../voice/profile.ts";
import type { VoiceProfile } from "../voice/types.ts";

// ─── Start Interview ────────────────────────────────────────────────────────

export async function startInterview(options?: {
	recalibration?: boolean;
	profilePath?: string;
}): Promise<{ state: InterviewState; questions: InterviewQuestion[] }> {
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

// ─── Complete Interview ─────────────────────────────────────────────────────

export async function completeInterview(
	state: InterviewState,
	options?: { profilePath?: string; strategyPath?: string },
): Promise<{
	profile: VoiceProfile;
	profilePath: string;
	strategyPath?: string;
}> {
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
			default:
				console.log(
					JSON.stringify({
						error: "Unknown command. Use: start, import",
					}),
				);
		}
	} catch (err) {
		console.error(JSON.stringify({ error: String(err) }));
		process.exit(1);
	}
}
