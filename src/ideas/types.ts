// ─── Idea Status & Urgency ──────────────────────────────────────────────────
// Canonical definitions are in core/db/schema.ts — re-exported here for convenience.

export type { IdeaSourceType, IdeaStatus, Urgency } from "../core/db/schema.ts";

import type { IdeaSourceType, IdeaStatus, Urgency } from "../core/db/schema.ts";

// ─── Idea Interface ─────────────────────────────────────────────────────────

export interface Idea {
	id: string;
	userId: string;
	hubId: string | null;
	title: string;
	notes: string | null;
	tags: string[] | null;
	status: IdeaStatus;
	urgency: Urgency;
	pillar: string | null;
	platform: string | null;
	format: string | null;
	claimedBy: string | null;
	killReason: string | null;
	expiresAt: Date | null;
	lastTouchedAt: Date;
	sourceType: IdeaSourceType | null;
	sourceId: string | null;
	createdAt: Date;
	updatedAt: Date;
}

// ─── Capture Input ──────────────────────────────────────────────────────────

export interface CaptureInput {
	text: string;
	tags?: Record<string, string>;
	urgency?: Urgency;
	hub?: string;
	pillar?: string;
	platform?: string;
	format?: string;
}

// ─── State Machine ──────────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
	spark: ["seed", "killed"],
	seed: ["ready", "killed", "spark"],
	ready: ["claimed", "killed", "seed"],
	claimed: ["developed", "ready"],
	developed: ["used", "killed", "claimed"],
	used: [], // terminal
	killed: ["spark"], // can resurrect
};

// ─── Staleness Thresholds ───────────────────────────────────────────────────

export const STALENESS_DAYS: Partial<Record<IdeaStatus, number>> = {
	spark: 14,
	seed: 30,
};
