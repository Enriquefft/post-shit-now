import type { SetupResult, ValidationSummary } from "../core/types/index.ts";
import { setupCompanyHub } from "./setup-company-hub.ts";
import { setupDatabase } from "./setup-db.ts";
import { setupDisconnect } from "./setup-disconnect.ts";
import { setupJoinHub } from "./setup-join.ts";
import { setupKeys, setupProviderKeys, listProviderKeys } from "./setup-keys.ts";
import { setupInstagramOAuth } from "./setup-instagram-oauth.ts";
import { setupLinkedInOAuth } from "./setup-linkedin-oauth.ts";
import { setupTikTokOAuth } from "./setup-tiktok-oauth.ts";
import { setupTrigger } from "./setup-trigger.ts";
import { setupXOAuth } from "./setup-x-oauth.ts";
import { getSetupStatus, setupVoice, type SetupStatus } from "./setup-voice.ts";
import { validateAll } from "./validate.ts";
import { getHubConnection, getHubDb } from "../team/hub.ts";
import { generateInviteCode } from "../team/invite.ts";
import { isAdmin, listTeamMembers, promoteToAdmin } from "../team/members.ts";
import { listEntities, createEntity } from "../voice/entity-profiles.ts";

interface SetupOutput {
	steps: SetupResult[];
	validation: ValidationSummary | null;
	completed: boolean;
}

// ─── Subcommand Types ──────────────────────────────────────────────────────

type SetupSubcommand = "hub" | "join" | "disconnect" | "invite" | "team" | "promote" | "notifications" | "keys" | "voice" | "entity" | "status";

interface SubcommandParams {
	hub: { slug: string; displayName: string; adminUserId?: string };
	join: { inviteBundle: string; userId?: string; displayName?: string; email?: string };
	disconnect: { slug: string; userId?: string };
	invite: { slug: string; userId?: string };
	team: { slug: string };
	promote: { slug: string; userId: string; targetUserId: string };
	notifications: { provider?: string; phone?: string };
	keys: { service?: string; list?: boolean };
	voice: { entity?: string; userId?: string };
	entity: { list?: boolean; create?: string; description?: string; userId?: string };
	status: { userId?: string };
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
		case "invite": {
			const slug = params.slug ?? "";
			const userId = params.userId ?? "default";

			const connection = await getHubConnection(projectRoot, slug);
			if (!connection) {
				return {
					steps: [{ step: "invite", status: "error", message: `No connection found for hub "${slug}"` }],
					validation: null,
					completed: false,
				};
			}

			const db = getHubDb(connection);
			const adminCheck = await isAdmin(db, { userId, hubId: connection.hubId });
			if (!adminCheck) {
				return {
					steps: [{ step: "invite", status: "error", message: "Only hub admins can generate invite codes" }],
					validation: null,
					completed: false,
				};
			}

			const code = await generateInviteCode(db, { hubId: connection.hubId, createdBy: userId });

			// Build invite bundle (base64 JSON with connection details + code)
			const bundle = Buffer.from(
				JSON.stringify({
					code,
					slug: connection.slug,
					displayName: connection.displayName,
					databaseUrl: connection.databaseUrl,
					triggerProjectId: connection.triggerProjectId,
					encryptionKey: connection.encryptionKey,
				}),
			).toString("base64");

			return {
				steps: [{
					step: "invite",
					status: "success",
					message: `Invite code generated for ${connection.displayName}`,
					data: { bundle, expiresIn: "48 hours", oneTimeUse: true },
				}],
				validation: null,
				completed: true,
			};
		}
		case "team": {
			const slug = params.slug ?? "";
			const connection = await getHubConnection(projectRoot, slug);
			if (!connection) {
				return {
					steps: [{ step: "team", status: "error", message: `No connection found for hub "${slug}"` }],
					validation: null,
					completed: false,
				};
			}

			const db = getHubDb(connection);
			const members = await listTeamMembers(db, connection.hubId);

			return {
				steps: [{
					step: "team",
					status: "success",
					message: `${members.length} members in ${connection.displayName}`,
					data: {
						hubName: connection.displayName,
						members: members.map((m) => ({
							userId: m.userId,
							role: m.role,
							displayName: m.displayName,
							email: m.email,
							joinedAt: m.joinedAt.toISOString(),
						})),
					},
				}],
				validation: null,
				completed: true,
			};
		}
		case "promote": {
			const slug = params.slug ?? "";
			const userId = params.userId ?? "default";
			const targetUserId = params.targetUserId ?? "";

			if (!targetUserId) {
				return {
					steps: [{ step: "promote", status: "error", message: "Target userId is required" }],
					validation: null,
					completed: false,
				};
			}

			const connection = await getHubConnection(projectRoot, slug);
			if (!connection) {
				return {
					steps: [{ step: "promote", status: "error", message: `No connection found for hub "${slug}"` }],
					validation: null,
					completed: false,
				};
			}

			const db = getHubDb(connection);
			const adminCheck = await isAdmin(db, { userId, hubId: connection.hubId });
			if (!adminCheck) {
				return {
					steps: [{ step: "promote", status: "error", message: "Only hub admins can promote members" }],
					validation: null,
					completed: false,
				};
			}

			try {
				await promoteToAdmin(db, { userId: targetUserId, hubId: connection.hubId });
			} catch (err) {
				return {
					steps: [{
						step: "promote",
						status: "error",
						message: err instanceof Error ? err.message : String(err),
					}],
					validation: null,
					completed: false,
				};
			}

			return {
				steps: [{
					step: "promote",
					status: "success",
					message: `${targetUserId} promoted to admin of ${connection.displayName}`,
				}],
				validation: null,
				completed: true,
			};
		}
		case "notifications": {
			// Notification setup is guided by Claude through the slash command.
			// This handler returns the current state so Claude can walk the user through configuration.
			return {
				steps: [{
					step: "notifications",
					status: "need_input",
					message: "WhatsApp notification setup requires interactive configuration",
					data: {
						providers: ["waha", "twilio"],
						preferences: ["pushEnabled", "digestFrequency", "quietHoursStart", "quietHoursEnd"],
						instructions: {
							waha: "Provide WAHA server URL and session name",
							twilio: "Provide Account SID, Auth Token, and From number",
						},
					},
				}],
				validation: null,
				completed: false,
			};
		}
		case "keys": {
			// Provider key management: list or add specific key
			if (params.keys?.list) {
				const listResult = await listProviderKeys(configDir);
				return { steps: [listResult], validation: null, completed: listResult.status === "success" };
			}

			// Add specific key (requires --service flag)
			const service = params.keys?.service;
			if (!service) {
				return {
					steps: [{
						step: "keys",
						status: "error",
						message: "Missing required flag: --service <provider-name>",
						data: {
							availableServices: ["perplexity", "brave", "tavily", "exa", "openai", "ideogram", "fal", "runway"],
						},
					}],
					validation: null,
					completed: false,
				};
			}

			// Prompt user for key value (Claude handles this in slash command context)
			return {
				steps: [{
					step: "keys",
					status: "need_input",
					message: `Provide API key for ${service}`,
					data: { service, instructions: "Use /psn:setup keys --service <name> --key <value>" },
				}],
				validation: null,
				completed: false,
			};
		}
		case "voice": {
			// Voice profile setup - absorbs /psn:voice interview
			// Get Personal Hub connection for DB access
			const connection = await getHubConnection(projectRoot, "personal");
			if (!connection) {
				return {
					steps: [{ step: "voice", status: "error", message: "Personal Hub not configured. Run /psn:setup first." }],
					validation: null,
					completed: false,
				};
			}

			const db = getHubDb(connection);
			const result = await setupVoice({
				userId: params.userId ?? "default",
				entitySlug: params.entity,
				db,
				configDir,
			});
			return { steps: [result], validation: null, completed: result.status === "success" };
		}
		case "entity": {
			// Entity management - list or create entities
			const connection = await getHubConnection(projectRoot, "personal");
			if (!connection) {
				return {
					steps: [{ step: "entity", status: "error", message: "Personal Hub not configured. Run /psn:setup first." }],
					validation: null,
					completed: false,
				};
			}

			const db = getHubDb(connection);
			const userId = params.userId ?? "default";

			if (params.list) {
				const entities = await listEntities(db, userId);
				return {
					steps: [{
						step: "entity",
						status: "success",
						message: `${entities.length} entities found`,
						data: {
							entities: entities.map((e) => ({
								slug: e.slug,
								displayName: e.displayName,
								description: e.description,
								lastUsedAt: e.lastUsedAt?.toISOString(),
							})),
						},
					}],
					validation: null,
					completed: true,
				};
			}

			if (params.create) {
				const slug = await createEntity(db, userId, params.create, params.description);
				return {
					steps: [{
						step: "entity",
						status: "success",
						message: `Entity created: ${slug}`,
						data: { entitySlug: slug, displayName: params.create },
					}],
					validation: null,
					completed: true,
				};
			}

			// Return need_input for entity creation prompt
			return {
				steps: [{
					step: "entity",
					status: "need_input",
					message: "Entity name required",
					data: { hint: "e.g., 'My Side Project' or 'PSN Founder'", usage: "/psn:setup entity --create \"Name\" [--description \"Description\"]" },
				}],
				validation: null,
				completed: false,
			};
		}
		case "status": {
			// Show setup status with what's configured and what's missing
			const connection = await getHubConnection(projectRoot, "personal");
			let db: ReturnType<typeof getHubDb> | undefined;
			if (connection) {
				db = getHubDb(connection);
			}

			const status = await getSetupStatus(configDir, db, params.userId ?? "default");
			return {
				steps: [{
					step: "status",
					status: "success",
					message: status.incompleteSteps.length === 0
						? "Setup complete"
						: `${status.incompleteSteps.length} steps remaining`,
					data: {
						...status,
						checkmarks: {
							hub: status.hasHub ? "[x]" : "[ ]",
							voice: status.hasVoiceProfile ? "[x]" : "[ ]",
							platforms: status.hasPlatforms ? "[x]" : "[ ]",
						},
						suggestions: status.incompleteSteps.map((step) => {
							if (step === "hub") return "Run /psn:setup to configure your Personal Hub";
							if (step === "voice") return "Run /psn:setup voice to create your voice profile";
							if (step === "platforms") return "Connect a platform with /psn:setup (X, LinkedIn, Instagram, or TikTok)";
							return `Complete: ${step}`;
						}),
					},
				}],
				validation: null,
				completed: status.incompleteSteps.length === 0,
			};
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

	// Step 1.5: Collect provider keys (DB-based)
	const providerKeysResult = await setupProviderKeys(configDir);
	if (Array.isArray(providerKeysResult)) {
		// Missing provider keys — return them so Claude can prompt user
		return {
			steps: [...steps, ...providerKeysResult],
			validation: null,
			completed: false,
		};
	}
	steps.push(providerKeysResult);

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

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseCliArgs(args: string[]): { subcommand: string | null; params: Record<string, string> } {
	const subcommand = args[0] && !args[0].startsWith("--") ? args[0] : null;
	const params: Record<string, string> = {};
	const flagArgs = subcommand ? args.slice(1) : args;

	for (let i = 0; i < flagArgs.length; i++) {
		const arg = flagArgs[i];
		if (arg?.startsWith("--") && i + 1 < flagArgs.length) {
			const key = arg.slice(2);
			const value = flagArgs[i + 1] ?? "";
			params[key] = value;
			i++; // skip value
		}
	}

	// Positional args for subcommands that need them
	if (subcommand === "join" && !params.inviteBundle && flagArgs[0] && !flagArgs[0].startsWith("--")) {
		params.inviteBundle = flagArgs[0];
	}
	if (subcommand === "disconnect" && !params.slug && flagArgs[0] && !flagArgs[0].startsWith("--")) {
		params.slug = flagArgs[0];
	}
	if (subcommand === "invite" && !params.slug && flagArgs[0] && !flagArgs[0].startsWith("--")) {
		params.slug = flagArgs[0];
	}
	if (subcommand === "team" && !params.slug && flagArgs[0] && !flagArgs[0].startsWith("--")) {
		params.slug = flagArgs[0];
	}
	if (subcommand === "promote" && flagArgs.length >= 2) {
		if (!params.slug) params.slug = flagArgs[0] ?? "";
		if (!params.targetUserId) params.targetUserId = flagArgs[1] ?? "";
	}

	// Handle --list flag for keys subcommand
	if (subcommand === "keys" && flagArgs.includes("--list")) {
		params.keys = { list: true };
	}

	// Handle --list flag for entity subcommand
	if (subcommand === "entity" && flagArgs.includes("--list")) {
		params.list = "true";
	}

	// Handle --entity flag for voice subcommand
	if (subcommand === "voice" && params.entity) {
		params.entity = params.entity;
	}

	return { subcommand, params };
}

// Entry point when run directly
if (import.meta.main) {
	const { subcommand, params } = parseCliArgs(process.argv.slice(2));

	const run = async () => {
		if (subcommand) {
			const result = await runSetupSubcommand(subcommand, params);
			if (result) return result;
			// Fall through to default setup if subcommand not recognized
		}
		return runSetup();
	};

	run()
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
