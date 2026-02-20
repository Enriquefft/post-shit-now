import type { SeriesTemplate } from "../core/db/schema.ts";
import { SeriesCadence } from "../core/db/schema.ts";

// Re-export SeriesTemplate from schema (single source of truth)
export type { SeriesTemplate };

// ─── Series Status & Tracking Mode ─────────────────────────────────────────────

export type SeriesStatus = "active" | "paused" | "retired";
export type TrackingMode = "none" | "auto-increment" | "custom";
export type { SeriesCadence };

// ─── Cadence Constants ───────────────────────────────────────────────────────

export const CADENCE_DAYS: Record<string, number> = {
	[SeriesCadence.weekly]: 7,
	[SeriesCadence.biweekly]: 14,
	[SeriesCadence.monthly]: 30,
};

// ─── Input/Output Interfaces ─────────────────────────────────────────────────

export interface CreateSeriesInput {
	name: string;
	description?: string;
	platform: string;
	template: SeriesTemplate;
	cadence: SeriesCadence;
	cadenceCustomDays?: number;
	trackingMode?: TrackingMode;
	trackingFormat?: string;
	pillar?: string;
	hubId?: string;
}

export interface Series {
	id: string;
	userId: string;
	hubId: string | null;
	name: string;
	description: string | null;
	platform: string;
	template: SeriesTemplate | null;
	cadence: string;
	cadenceCustomDays: number | null;
	trackingMode: string;
	trackingFormat: string | null;
	episodeCount: number;
	status: string;
	lastPublishedAt: Date | null;
	pillar: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface SeriesWithAnalytics extends Series {
	totalEpisodes: number;
	avgEngagement: number;
	lastEpisodeDate?: Date;
}
