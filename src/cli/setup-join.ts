import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod/v4";
import { createHubConnection } from "../core/db/connection.ts";
import type { SetupResult } from "../core/types/index.ts";
import { redeemInviteCode } from "../team/invite.ts";
import type { HubConnection } from "../team/types.ts";

const inviteBundleSchema = z.object({
	code: z.string(),
	slug: z.string(),
	displayName: z.string(),
	databaseUrl: z.string(),
	triggerProjectId: z.string(),
	encryptionKey: z.string().optional(),
});

type InviteBundle = z.infer<typeof inviteBundleSchema>;

interface SetupJoinParams {
	/** Base64-encoded JSON invite bundle from admin */
	inviteBundle: string;
	userId?: string;
	displayName?: string;
	email?: string;
	projectRoot?: string;
}

/**
 * CLI flow for joining a Company Hub with an invite code.
 * JSON output for Claude to interpret.
 *
 * The invite bundle is a base64-encoded JSON containing:
 * - code: the invite code
 * - slug: hub slug
 * - displayName: hub display name
 * - databaseUrl: Company Hub database URL
 * - triggerProjectId: Trigger.dev project reference
 * - encryptionKey: (optional) hub encryption key
 *
 * Steps:
 * 1. Decode invite bundle
 * 2. Connect to Company Hub DB
 * 3. Redeem invite code (validates + creates team_members record)
 * 4. Save connection file to .hubs/
 */
export async function setupJoinHub(params: SetupJoinParams): Promise<SetupResult> {
	const { inviteBundle, userId = "default", displayName, email, projectRoot = "." } = params;

	// Decode the invite bundle
	let bundle: InviteBundle;
	try {
		const decoded = Buffer.from(inviteBundle, "base64").toString("utf-8");
		bundle = inviteBundleSchema.parse(JSON.parse(decoded));
	} catch {
		return {
			step: "join-hub",
			status: "error",
			message: "Invalid invite bundle. Please check the code provided by the hub admin.",
		};
	}

	// Validate bundle has required fields
	if (!bundle.code || !bundle.slug || !bundle.databaseUrl || !bundle.displayName) {
		return {
			step: "join-hub",
			status: "error",
			message: "Invite bundle is missing required fields (code, slug, databaseUrl, displayName).",
		};
	}

	// Connect to Company Hub DB and redeem the invite code
	let hubId: string;
	try {
		const db = createHubConnection(bundle.databaseUrl);
		const result = await redeemInviteCode(db, {
			code: bundle.code,
			userId,
			displayName,
			email,
		});

		if (!result.success) {
			return {
				step: "join-hub",
				status: "error",
				message: result.error ?? "Failed to redeem invite code",
			};
		}

		hubId = result.hubId;
	} catch (err) {
		return {
			step: "join-hub",
			status: "error",
			message: `Failed to connect to Company Hub: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	// Save connection file to .hubs/
	const connection: HubConnection = {
		hubId,
		slug: bundle.slug,
		displayName: bundle.displayName,
		databaseUrl: bundle.databaseUrl,
		triggerProjectId: bundle.triggerProjectId ?? "",
		role: "member",
		joinedAt: new Date().toISOString(),
		encryptionKey: bundle.encryptionKey,
	};

	try {
		const hubsDir = join(projectRoot, ".hubs");
		await mkdir(hubsDir, { recursive: true });
		const connectionFile = join(hubsDir, `company-${bundle.slug}.json`);
		await writeFile(connectionFile, JSON.stringify(connection, null, 2), "utf-8");
	} catch (err) {
		return {
			step: "join-hub",
			status: "error",
			message: `Joined hub but failed to save connection file: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	return {
		step: "join-hub",
		status: "success",
		message: `Joined Company Hub "${bundle.displayName}" as member`,
		data: {
			hubId,
			slug: bundle.slug,
			role: "member",
			connectionFile: `.hubs/company-${bundle.slug}.json`,
		},
	};
}
