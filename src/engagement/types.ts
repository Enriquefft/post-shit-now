import { z } from "zod/v4";

// ─── Opportunity Status ─────────────────────────────────────────────────────

export type OpportunityStatus =
	| "pending"
	| "triaged_yes"
	| "triaged_no"
	| "drafted"
	| "engaged"
	| "expired";

export const opportunityStatusSchema = z.enum([
	"pending",
	"triaged_yes",
	"triaged_no",
	"drafted",
	"engaged",
	"expired",
]);

// ─── Suggested Engagement Types ─────────────────────────────────────────────

export type SuggestedEngagement = "reply" | "quote" | "repost" | "duet" | "stitch" | "comment";

export const suggestedEngagementSchema = z.enum([
	"reply",
	"quote",
	"repost",
	"duet",
	"stitch",
	"comment",
]);

// ─── Platform-Specific Engagement Types ─────────────────────────────────────

export const PLATFORM_ENGAGEMENT_TYPES: Record<string, SuggestedEngagement[]> = {
	x: ["reply", "quote", "repost"],
	linkedin: ["comment", "repost"],
	instagram: ["comment"],
	tiktok: ["comment", "duet", "stitch"],
} as const;

// ─── Opportunity Score ──────────────────────────────────────────────────────

export interface OpportunityScore {
	relevance: number; // 0-100
	recency: number; // 0-100
	reach: number; // 0-100
	potential: number; // 0-100
	composite: number; // 0-100
}

export const opportunityScoreSchema = z.object({
	relevance: z.number().min(0).max(100),
	recency: z.number().min(0).max(100),
	reach: z.number().min(0).max(100),
	potential: z.number().min(0).max(100),
	composite: z.number().min(0).max(100),
});

// ─── Engagement Opportunity ─────────────────────────────────────────────────

export interface EngagementOpportunity {
	id?: string;
	userId: string;
	platform: string;
	externalPostId: string;
	authorHandle: string;
	authorFollowerCount?: number;
	postSnippet: string;
	postUrl?: string;
	postedAt?: Date;
	score: OpportunityScore;
	status: OpportunityStatus;
	suggestedType?: SuggestedEngagement;
	draftContent?: string;
	engagedAt?: Date;
	detectedAt?: Date;
}

export const engagementOpportunitySchema = z.object({
	id: z.string().uuid().optional(),
	userId: z.string(),
	platform: z.string(),
	externalPostId: z.string(),
	authorHandle: z.string(),
	authorFollowerCount: z.number().int().optional(),
	postSnippet: z.string(),
	postUrl: z.string().url().optional(),
	postedAt: z.date().optional(),
	score: opportunityScoreSchema,
	status: opportunityStatusSchema,
	suggestedType: suggestedEngagementSchema.optional(),
	draftContent: z.string().optional(),
	engagedAt: z.date().optional(),
	detectedAt: z.date().optional(),
});

// ─── Engagement Config ──────────────────────────────────────────────────────

export interface EngagementConfig {
	userId: string;
	nicheKeywords: string[];
	platformToggles: Record<string, boolean>;
	dailyCaps: Record<string, number>;
	cooldownMinutes: Record<string, number>;
	blocklist: string[];
}

export const engagementConfigSchema = z.object({
	userId: z.string(),
	nicheKeywords: z.array(z.string()),
	platformToggles: z.record(z.string(), z.boolean()),
	dailyCaps: z.record(z.string(), z.number()),
	cooldownMinutes: z.record(z.string(), z.number()),
	blocklist: z.array(z.string()),
});

// ─── Engagement Log ─────────────────────────────────────────────────────────

export interface EngagementLogEntry {
	id?: string;
	userId: string;
	opportunityId: string;
	platform: string;
	engagementType: SuggestedEngagement;
	content: string;
	externalReplyId?: string;
	outcome?: { impressions?: number; likes?: number; replies?: number };
	engagedAt?: Date;
}

export const engagementLogSchema = z.object({
	id: z.string().uuid().optional(),
	userId: z.string(),
	opportunityId: z.string().uuid(),
	platform: z.string(),
	engagementType: suggestedEngagementSchema,
	content: z.string(),
	externalReplyId: z.string().optional(),
	outcome: z
		.object({
			impressions: z.number().optional(),
			likes: z.number().optional(),
			replies: z.number().optional(),
		})
		.optional(),
	engagedAt: z.date().optional(),
});

// ─── Daily Cap Check Result ─────────────────────────────────────────────────

export interface DailyCapResult {
	allowed: boolean;
	remaining: number;
	cap: number;
}

// ─── Cooldown Check Result ──────────────────────────────────────────────────

export interface CooldownResult {
	allowed: boolean;
	waitMinutes: number;
}

// ─── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_DAILY_CAPS: Record<string, number> = {
	x: 20,
	linkedin: 10,
	instagram: 15,
	tiktok: 10,
};

export const DEFAULT_COOLDOWN_MINUTES: Record<string, number> = {
	x: 5,
	linkedin: 5,
	instagram: 5,
	tiktok: 5,
};
