import type { SetupResult } from "../core/types/index.ts";
import { getHubConnection, getHubDb, removeHubConnection } from "../team/hub.ts";
import { removeTeamMember } from "../team/members.ts";

interface SetupDisconnectParams {
	slug: string;
	userId?: string;
	projectRoot?: string;
}

/**
 * CLI flow for disconnecting from a Company Hub.
 * JSON output for Claude to interpret.
 *
 * Steps:
 * 1. Find connection file in .hubs/
 * 2. Connect to Company Hub DB
 * 3. Soft-delete team_members record (leftAt = now)
 * 4. Delete local connection file
 */
export async function setupDisconnect(params: SetupDisconnectParams): Promise<SetupResult> {
	const { slug, userId = "default", projectRoot = "." } = params;

	// Find the connection file
	const connection = await getHubConnection(projectRoot, slug);
	if (!connection) {
		return {
			step: "disconnect",
			status: "error",
			message: `No connection found for hub "${slug}". Check .hubs/ directory.`,
		};
	}

	// Connect to Company Hub DB and soft-delete membership
	try {
		const db = getHubDb(connection);
		await removeTeamMember(db, {
			userId,
			hubId: connection.hubId,
		});
	} catch (err) {
		// Log but continue -- still remove local connection file
		// Member may already have been removed server-side
		console.error(
			`Warning: Could not update server record: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Remove local connection file
	await removeHubConnection(projectRoot, slug);

	return {
		step: "disconnect",
		status: "success",
		message: `Disconnected from Company Hub "${connection.displayName}"`,
		data: {
			slug,
			hubId: connection.hubId,
			disconnected: true,
		},
	};
}
