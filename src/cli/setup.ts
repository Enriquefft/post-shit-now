import type { SetupResult, ValidationSummary } from "../core/types/index.ts";
import { setupCompanyHub } from "./setup-company-hub.ts";
import { setupDatabase } from "./setup-db.ts";
import { setupDisconnect } from "./setup-disconnect.ts";
import { setupJoinHub } from "./setup-join.ts";
import { setupKeys } from "./setup-keys.ts";
import { setupInstagramOAuth } from "./setup-instagram-oauth.ts";
import { setupLinkedInOAuth } from "./setup-linkedin-oauth.ts";
import { setupTikTokOAuth } from "./setup-tiktok-oauth.ts";
import { setupTrigger } from "./setup-trigger.ts";
import { setupXOAuth } from "./setup-x-oauth.ts";
import { validateAll } from "./validate.ts";
import { getHubConnection, getHubDb } from "../team/hub.ts";
import { generateInviteCode } from "../team/invite.ts";
import { isAdmin, listTeamMembers, promoteToAdmin } from "../team/members.ts";

interface SetupOutput {
	steps: SetupResult[];
	validation: ValidationSummary | null;
	completed: boolean;
}

// ─── Subcommand Types ──────────────────────────────────────────────────────

type SetupSubcommand = "hub" | "join" | "disconnect" | "invite" | "team" | "promote" | "notifications";

interface SubcommandParams {
	hub: { slug: string; displayName: string; adminUserId?: string };
	join: { inviteBundle: string; userId?: string; displayName?: string; email?: string };
	disconnect: { slug: string; userId?: string };
	invite: { slug: string; userId?: string };
	team: { slug: string };
	promote: { slug: string; userId: string; targetUserId: string };
	notifications: { provider?: string; phone?: string };
}

/**
 * Route setup subcommands to their handlers.
 * Returns null if the subcommand is not recognized (falls through to default setup).
 */
export async function runSetupSubcommand(
	subcommand: string,
	params: Record<string, string>,
	configDir = "config",
	projectRoot = ".",
): Promise<SetupOutput | null> {
	switch (subcommand) {
		case "hub": {
			const result = await setupCompanyHub({
				slug: params.slug ?? "",
				displayName: params.displayName ?? params.slug ?? "",
				adminUserId: params.adminUserId,
				configDir,
				projectRoot,
			});
			return { steps: [result], validation: null, completed: result.status === "success" };
		}
		case "join": {
			const result = await setupJoinHub({
				inviteBundle: params.inviteBundle ?? "",
				userId: params.userId,
				displayName: params.displayName,
				email: params.email,
				projectRoot,
			});
			return { steps: [result], validation: null, completed: result.status === "success" };
		}
		case "disconnect": {
			const result = await setupDisconnect({
				slug: params.slug ?? "",
				userId: params.userId,
				projectRoot,
			});
			return { steps: [result], validation: null, completed: result.status === "success" };
		}
		default:
			return null; // Not a recognized subcommand — fall through to default setup
	}
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

	// Step 5: X OAuth setup
	const xOAuthResult = await setupXOAuth(configDir);
	steps.push(xOAuthResult);
	if (xOAuthResult.status === "error") {
		return { steps, validation: null, completed: false };
	}
	if (xOAuthResult.status === "need_input") {
		return { steps, validation: null, completed: false };
	}

	// Step 6: LinkedIn OAuth setup (optional — skips if no credentials)
	const linkedInOAuthResult = await setupLinkedInOAuth(configDir);
	steps.push(linkedInOAuthResult);
	if (linkedInOAuthResult.status === "error") {
		return { steps, validation: null, completed: false };
	}
	if (linkedInOAuthResult.status === "need_input") {
		return { steps, validation: null, completed: false };
	}

	// Step 7: Instagram OAuth setup (optional — skips if no credentials)
	const instagramOAuthResult = await setupInstagramOAuth(configDir);
	steps.push(instagramOAuthResult);
	if (instagramOAuthResult.status === "error") {
		return { steps, validation: null, completed: false };
	}
	if (instagramOAuthResult.status === "need_input") {
		return { steps, validation: null, completed: false };
	}

	// Step 8: TikTok OAuth setup (optional — skips if no credentials)
	const tiktokOAuthResult = await setupTikTokOAuth(configDir);
	steps.push(tiktokOAuthResult);
	if (tiktokOAuthResult.status === "error") {
		return { steps, validation: null, completed: false };
	}
	if (tiktokOAuthResult.status === "need_input") {
		return { steps, validation: null, completed: false };
	}

	// Step 9: Validate all connections
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
