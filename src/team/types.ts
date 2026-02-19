import { z } from "zod/v4";

// ─── Hub Roles ──────────────────────────────────────────────────────────────

export type HubRole = "admin" | "member";

// ─── Hub Connection ─────────────────────────────────────────────────────────

export interface HubConnection {
	hubId: string;
	slug: string;
	displayName: string;
	databaseUrl: string;
	triggerProjectId: string;
	role: HubRole;
	joinedAt: string;
	encryptionKey?: string;
}

export const HubConnectionSchema = z.object({
	hubId: z.string(),
	slug: z.string(),
	displayName: z.string(),
	databaseUrl: z.string(),
	triggerProjectId: z.string(),
	role: z.enum(["admin", "member"]),
	joinedAt: z.string(),
	encryptionKey: z.string().optional(),
});

// ─── Team Member ────────────────────────────────────────────────────────────

export interface TeamMember {
	id: string;
	userId: string;
	hubId: string;
	role: HubRole;
	displayName?: string;
	email?: string;
	joinedAt: Date;
	leftAt?: Date;
}

// ─── Invite Code ────────────────────────────────────────────────────────────

export interface InviteCode {
	id: string;
	hubId: string;
	code: string;
	createdBy: string;
	expiresAt: Date;
	usedBy?: string;
	usedAt?: Date;
}

export const InviteCodeSchema = z.object({
	id: z.string(),
	hubId: z.string(),
	code: z.string(),
	createdBy: z.string(),
	expiresAt: z.coerce.date(),
	usedBy: z.string().optional(),
	usedAt: z.coerce.date().optional(),
});
