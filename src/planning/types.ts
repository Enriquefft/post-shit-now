import type { PostFormat } from "../content/format-picker.ts";

// ─── Plan Slot Status ────────────────────────────────────────────────────────

export type PlanSlotStatus =
	| "outlined"
	| "drafted"
	| "approved"
	| "scheduled"
	| "published"
	| "skipped";

// ─── Plan Slot ──────────────────────────────────────────────────────────────

export interface PlanSlot {
	day: string; // ISO date string
	platform: string;
	topic: string;
	format: string;
	pillar: string;
	language: string;
	seriesId?: string;
	seriesEpisode?: string;
	ideaId?: string;
	postId?: string;
	status: PlanSlotStatus;
}

// ─── Weekly Plan ────────────────────────────────────────────────────────────

export interface WeeklyPlan {
	id?: string;
	userId: string;
	weekStart: Date;
	weekEnd: Date;
	slots: PlanSlot[];
	totalSlots: number;
	completedSlots: number;
}

// ─── Calendar State ─────────────────────────────────────────────────────────

export interface CalendarState {
	weekStart: Date;
	weekEnd: Date;
	scheduledPosts: Array<{
		id: string;
		platform: string;
		content: string;
		scheduledAt: Date;
		status: string;
		language?: string | null;
		seriesId?: string | null;
	}>;
	seriesDue: Array<{
		seriesId: string;
		seriesName: string;
		platform: string;
		nextDueDate: Date;
		nextEpisodeLabel?: string;
		pillar?: string | null;
	}>;
	gaps: string[]; // ISO date strings where no content is scheduled
	totalCapacity: number;
}

// ─── Plan Idea ──────────────────────────────────────────────────────────────

export type PlanIdeaSource = "trend" | "bank" | "generated" | "remix" | "recycle";

export interface PlanIdea {
	topic: string;
	pillar: string;
	angle: string;
	format: PostFormat | string;
	source: PlanIdeaSource;
	sourceId?: string;
	language?: string;
	score?: number;
}

// ─── Plan Phase ─────────────────────────────────────────────────────────────

export type PlanPhase = "calendar" | "ideation" | "slotting" | "drafting" | "scheduling";

// ─── Strategy Config ────────────────────────────────────────────────────────

export interface StrategyConfig {
	pillars: Array<{ name: string; weight: number }>;
	platforms: Array<{
		name: string;
		frequency: number; // posts per week
		defaultLanguage?: string;
	}>;
	languages?: {
		primary: string;
		secondary?: string;
		default: string;
	};
}
