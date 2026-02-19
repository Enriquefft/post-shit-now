import { and, eq, isNull } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { teamMembers } from "../core/db/schema.ts";
import type { HubRole, TeamMember } from "./types.ts";

// ─── Add Member ────────────────────────────────────────────────────────────

/**
 * Add a team member to a Company Hub.
 * Throws if unique constraint (userId, hubId) is violated (already a member).
 */
export async function addTeamMember(
	db: HubDb,
	params: {
		userId: string;
		hubId: string;
		role: HubRole;
		displayName?: string;
		email?: string;
	},
): Promise<TeamMember> {
	const { userId, hubId, role, displayName, email } = params;

	const rows = await db
		.insert(teamMembers)
		.values({
			userId,
			hubId,
			role,
			displayName,
			email,
		})
		.returning();

	const row = rows[0];
	if (!row) {
		throw new Error("Failed to insert team member");
	}

	return {
		id: row.id,
		userId: row.userId,
		hubId: row.hubId,
		role: row.role as HubRole,
		displayName: row.displayName ?? undefined,
		email: row.email ?? undefined,
		joinedAt: row.joinedAt,
		leftAt: row.leftAt ?? undefined,
	};
}

// ─── Remove Member (Soft Delete) ───────────────────────────────────────────

/**
 * Soft-delete a team member by setting leftAt timestamp.
 * Preserves record for attribution (content stays with attribution per CONTEXT.md).
 * Does NOT delete posts or analytics by this member.
 */
export async function removeTeamMember(
	db: HubDb,
	params: { userId: string; hubId: string },
): Promise<void> {
	await db
		.update(teamMembers)
		.set({ leftAt: new Date(), updatedAt: new Date() })
		.where(
			and(
				eq(teamMembers.userId, params.userId),
				eq(teamMembers.hubId, params.hubId),
				isNull(teamMembers.leftAt),
			),
		);
}

// ─── Role Management ───────────────────────────────────────────────────────

/**
 * Promote a member to admin role.
 * Throws if member not found or already left.
 */
export async function promoteToAdmin(
	db: HubDb,
	params: { userId: string; hubId: string },
): Promise<void> {
	const result = await db
		.update(teamMembers)
		.set({ role: "admin", updatedAt: new Date() })
		.where(
			and(
				eq(teamMembers.userId, params.userId),
				eq(teamMembers.hubId, params.hubId),
				isNull(teamMembers.leftAt),
			),
		)
		.returning({ id: teamMembers.id });

	if (result.length === 0) {
		throw new Error("Member not found or already left the hub");
	}
}

/**
 * Demote an admin to member role.
 * Guards against demoting the last admin (hub must always have at least one admin).
 */
export async function demoteToMember(
	db: HubDb,
	params: { userId: string; hubId: string },
): Promise<void> {
	// Count current active admins
	const admins = await db
		.select({ id: teamMembers.id })
		.from(teamMembers)
		.where(
			and(
				eq(teamMembers.hubId, params.hubId),
				eq(teamMembers.role, "admin"),
				isNull(teamMembers.leftAt),
			),
		);

	if (admins.length <= 1) {
		throw new Error("Cannot demote the last admin. Promote another member first.");
	}

	const result = await db
		.update(teamMembers)
		.set({ role: "member", updatedAt: new Date() })
		.where(
			and(
				eq(teamMembers.userId, params.userId),
				eq(teamMembers.hubId, params.hubId),
				isNull(teamMembers.leftAt),
			),
		)
		.returning({ id: teamMembers.id });

	if (result.length === 0) {
		throw new Error("Member not found or already left the hub");
	}
}

// ─── Queries ───────────────────────────────────────────────────────────────

/**
 * List all active team members in a hub (leftAt IS NULL).
 * Ordered by joinedAt ascending.
 */
export async function listTeamMembers(db: HubDb, hubId: string): Promise<TeamMember[]> {
	const rows = await db
		.select()
		.from(teamMembers)
		.where(and(eq(teamMembers.hubId, hubId), isNull(teamMembers.leftAt)))
		.orderBy(teamMembers.joinedAt);

	return rows.map((row) => ({
		id: row.id,
		userId: row.userId,
		hubId: row.hubId,
		role: row.role as HubRole,
		displayName: row.displayName ?? undefined,
		email: row.email ?? undefined,
		joinedAt: row.joinedAt,
		leftAt: row.leftAt ?? undefined,
	}));
}

/**
 * Get a specific active team member by userId and hubId.
 * Returns null if not found or already left.
 */
export async function getTeamMember(
	db: HubDb,
	params: { userId: string; hubId: string },
): Promise<TeamMember | null> {
	const rows = await db
		.select()
		.from(teamMembers)
		.where(
			and(
				eq(teamMembers.userId, params.userId),
				eq(teamMembers.hubId, params.hubId),
				isNull(teamMembers.leftAt),
			),
		)
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	return {
		id: row.id,
		userId: row.userId,
		hubId: row.hubId,
		role: row.role as HubRole,
		displayName: row.displayName ?? undefined,
		email: row.email ?? undefined,
		joinedAt: row.joinedAt,
		leftAt: row.leftAt ?? undefined,
	};
}

/**
 * Quick check: is the user an active admin of the specified hub?
 * Used as guard in approval workflow and invite code generation.
 */
export async function isAdmin(
	db: HubDb,
	params: { userId: string; hubId: string },
): Promise<boolean> {
	const rows = await db
		.select({ id: teamMembers.id })
		.from(teamMembers)
		.where(
			and(
				eq(teamMembers.userId, params.userId),
				eq(teamMembers.hubId, params.hubId),
				eq(teamMembers.role, "admin"),
				isNull(teamMembers.leftAt),
			),
		)
		.limit(1);

	return rows.length > 0;
}
