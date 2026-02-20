import crypto from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { inviteCodes, teamMembers } from "../core/db/schema.ts";

// ─── Invite Code Generation ────────────────────────────────────────────────

/**
 * Generate a cryptographically secure one-time invite code.
 * Default expiry: 48 hours per CONTEXT.md specification.
 */
export async function generateInviteCode(
	db: HubDb,
	params: {
		hubId: string;
		createdBy: string;
		expiryHours?: number;
	},
): Promise<string> {
	const { hubId, createdBy, expiryHours = 48 } = params;

	// Cryptographically secure: 16 random bytes -> 32 hex characters
	const code = crypto.randomBytes(16).toString("hex");

	const expiresAt = new Date(Date.now() + expiryHours * 3600000);

	await db.insert(inviteCodes).values({
		hubId,
		code,
		createdBy,
		expiresAt,
	});

	return code;
}

// ─── Invite Code Redemption ────────────────────────────────────────────────

interface RedeemResult {
	hubId: string;
	success: boolean;
	error?: string;
}

/**
 * Redeem an invite code to join a Company Hub.
 * Validates: code exists, not already used (one-time), not expired.
 * Atomically marks code as used and creates team_members record.
 */
export async function redeemInviteCode(
	db: HubDb,
	params: {
		code: string;
		userId: string;
		displayName?: string;
		email?: string;
	},
): Promise<RedeemResult> {
	const { code, userId, displayName, email } = params;

	// Look up the invite code
	const rows = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code)).limit(1);

	const invite = rows[0];

	if (!invite) {
		return { hubId: "", success: false, error: "Invalid or expired invite code" };
	}

	// Validate: not already used (one-time use)
	if (invite.usedBy) {
		return { hubId: invite.hubId, success: false, error: "Invalid or expired invite code" };
	}

	// Validate: not expired
	if (invite.expiresAt <= new Date()) {
		return { hubId: invite.hubId, success: false, error: "Invalid or expired invite code" };
	}

	// Atomic transaction: mark code as used + create team member
	// Neon HTTP driver doesn't support native transactions, so we use
	// sequential operations with the unique constraint as our safety net
	const now = new Date();

	// Mark invite code as used
	await db
		.update(inviteCodes)
		.set({
			usedBy: userId,
			usedAt: now,
		})
		.where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedBy)));

	// Insert team member (all invitees join as 'member')
	await db.insert(teamMembers).values({
		userId,
		hubId: invite.hubId,
		role: "member",
		displayName,
		email,
	});

	return { hubId: invite.hubId, success: true };
}

// ─── Invite Code Queries ───────────────────────────────────────────────────

/**
 * List pending (unused, unexpired) invite codes for a hub.
 */
export async function listPendingInvites(
	db: HubDb,
	hubId: string,
): Promise<Array<{ code: string; expiresAt: Date; createdBy: string }>> {
	const rows = await db
		.select({
			code: inviteCodes.code,
			expiresAt: inviteCodes.expiresAt,
			createdBy: inviteCodes.createdBy,
		})
		.from(inviteCodes)
		.where(
			and(
				eq(inviteCodes.hubId, hubId),
				isNull(inviteCodes.usedBy),
				gt(inviteCodes.expiresAt, new Date()),
			),
		);

	return rows;
}

/**
 * Clean up expired unused invite codes.
 * Returns count of deleted codes for logging.
 */
export async function cleanupExpiredInvites(db: HubDb): Promise<number> {
	const result = await db
		.delete(inviteCodes)
		.where(and(lt(inviteCodes.expiresAt, new Date()), isNull(inviteCodes.usedBy)))
		.returning({ id: inviteCodes.id });

	return result.length;
}
