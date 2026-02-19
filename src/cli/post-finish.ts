import { copyFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { loadDraft, updateDraft } from "../content/drafts.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FinishDraftParams {
	draftId: string;
	mediaPath: string;
	databaseUrl?: string;
	userId?: string;
}

export interface FinishDraftResult {
	draftId: string;
	status: "approved";
	mediaPath: string;
	hub: "personal" | "company";
	persona: string;
}

// ─── Hub Routing ────────────────────────────────────────────────────────────

/**
 * Determine which hub a post routes to based on persona.
 *
 * - personal / brand-ambassador -> "personal" (Personal Hub)
 * - brand-operator -> "company" (Company Hub, Phase 7)
 */
export function resolveHub(persona: string): "personal" | "company" {
	if (persona === "brand-operator") return "company";
	return "personal";
}

// ─── Finish Draft ───────────────────────────────────────────────────────────

/**
 * Finish a semi-automated draft by attaching user-recorded media.
 *
 * Flow:
 * 1. Load draft, verify status is "awaiting-recording"
 * 2. Verify media file exists
 * 3. Copy media to content/media/
 * 4. Update draft: status -> "approved", attach mediaPath, set hub
 */
export async function finishDraft(params: FinishDraftParams): Promise<FinishDraftResult> {
	const { draftId, mediaPath } = params;

	// 1. Load draft
	const { frontmatter } = await loadDraft(draftId);

	// 2. Verify status
	if (frontmatter.status !== "awaiting-recording") {
		throw new Error(
			`Draft ${draftId} has status "${frontmatter.status}" -- expected "awaiting-recording". ` +
				"Only semi-automated drafts (video-script, tiktok-stitch) can be finished.",
		);
	}

	// 3. Verify media exists
	try {
		await stat(mediaPath);
	} catch {
		throw new Error(`Media file not found: ${mediaPath}`);
	}

	// 4. Copy media to content/media/
	const mediaFilename = `${draftId}-${basename(mediaPath)}`;
	const destPath = join("content", "media", mediaFilename);
	const { mkdir } = await import("node:fs/promises");
	await mkdir(join("content", "media"), { recursive: true });
	await copyFile(mediaPath, destPath);

	// 5. Determine hub routing
	const hub = resolveHub(frontmatter.persona);

	// 6. Update draft
	await updateDraft(draftId, {
		status: "approved",
		hub,
		metadata: {
			mediaPath: destPath,
			finishedAt: new Date().toISOString(),
		},
	});

	return {
		draftId,
		status: "approved",
		mediaPath: destPath,
		hub,
		persona: frontmatter.persona,
	};
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const draftId = args[0];
	const mediaFlag = args.indexOf("--media");
	const mediaPath = mediaFlag !== -1 ? args[mediaFlag + 1] : undefined;

	if (!draftId || !mediaPath) {
		console.log(JSON.stringify({ error: "Usage: post-finish.ts <draft-id> --media <path>" }));
		process.exit(1);
	}

	finishDraft({ draftId, mediaPath })
		.then((result) => console.log(JSON.stringify(result, null, 2)))
		.catch((err) =>
			console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) })),
		);
}
