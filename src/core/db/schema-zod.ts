/**
 * Zod schemas generated from Drizzle ORM table definitions via drizzle-orm/zod.
 * Provides runtime validation + inferred TypeScript types from the single source of truth (schema.ts).
 *
 * Usage:
 *   import { userSelectSchema, type UserRow } from "./schema-zod.ts";
 *   const parsed = userSelectSchema.parse(row); // runtime-validated
 */
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod/v4";
import {
	apiKeys,
	editHistory,
	engagementConfig,
	engagementLog,
	engagementOpportunities,
	ideas,
	inviteCodes,
	monitoredAccounts,
	notificationLog,
	notificationPreferences,
	oauthTokens,
	postMetrics,
	posts,
	preferenceModel,
	series,
	strategyAdjustments,
	teamMembers,
	trends,
	users,
	voiceProfiles,
	weeklyPlans,
	whatsappSessions,
} from "./schema.ts";

// ─── Select Schemas (runtime validation for SELECT query results) ───────────

export const userSelectSchema = createSelectSchema(users);
export const oauthTokenSelectSchema = createSelectSchema(oauthTokens);
export const postSelectSchema = createSelectSchema(posts);
export const apiKeySelectSchema = createSelectSchema(apiKeys);
export const voiceProfileSelectSchema = createSelectSchema(voiceProfiles);
export const editHistorySelectSchema = createSelectSchema(editHistory);
export const postMetricSelectSchema = createSelectSchema(postMetrics);
export const preferenceModelSelectSchema = createSelectSchema(preferenceModel);
export const strategyAdjustmentSelectSchema = createSelectSchema(strategyAdjustments);
export const ideaSelectSchema = createSelectSchema(ideas);
export const seriesSelectSchema = createSelectSchema(series);
export const trendSelectSchema = createSelectSchema(trends);
export const weeklyPlanSelectSchema = createSelectSchema(weeklyPlans);
export const monitoredAccountSelectSchema = createSelectSchema(monitoredAccounts);
export const teamMemberSelectSchema = createSelectSchema(teamMembers);
export const inviteCodeSelectSchema = createSelectSchema(inviteCodes);
export const notificationPreferenceSelectSchema = createSelectSchema(notificationPreferences);
export const notificationLogSelectSchema = createSelectSchema(notificationLog);
export const engagementOpportunitySelectSchema = createSelectSchema(engagementOpportunities);
export const engagementConfigSelectSchema = createSelectSchema(engagementConfig);
export const engagementLogSelectSchema = createSelectSchema(engagementLog);
export const whatsappSessionSelectSchema = createSelectSchema(whatsappSessions);

// ─── Insert Schemas (runtime validation for INSERT values) ──────────────────

export const userInsertSchema = createInsertSchema(users);
export const postInsertSchema = createInsertSchema(posts);
export const teamMemberInsertSchema = createInsertSchema(teamMembers);

// ─── Row Types (inferred from Zod schemas) ──────────────────────────────────

export type UserRow = z.infer<typeof userSelectSchema>;
export type OauthTokenRow = z.infer<typeof oauthTokenSelectSchema>;
export type PostRow = z.infer<typeof postSelectSchema>;
export type ApiKeyRow = z.infer<typeof apiKeySelectSchema>;
export type VoiceProfileRow = z.infer<typeof voiceProfileSelectSchema>;
export type EditHistoryRow = z.infer<typeof editHistorySelectSchema>;
export type PostMetricRow = z.infer<typeof postMetricSelectSchema>;
export type PreferenceModelRow = z.infer<typeof preferenceModelSelectSchema>;
export type StrategyAdjustmentRow = z.infer<typeof strategyAdjustmentSelectSchema>;
export type IdeaRow = z.infer<typeof ideaSelectSchema>;
export type SeriesRow = z.infer<typeof seriesSelectSchema>;
export type TrendRow = z.infer<typeof trendSelectSchema>;
export type WeeklyPlanRow = z.infer<typeof weeklyPlanSelectSchema>;
export type MonitoredAccountRow = z.infer<typeof monitoredAccountSelectSchema>;
export type TeamMemberRow = z.infer<typeof teamMemberSelectSchema>;
export type InviteCodeRow = z.infer<typeof inviteCodeSelectSchema>;
export type NotificationPreferenceRow = z.infer<typeof notificationPreferenceSelectSchema>;
export type NotificationLogRow = z.infer<typeof notificationLogSelectSchema>;
export type EngagementOpportunityRow = z.infer<typeof engagementOpportunitySelectSchema>;
export type EngagementConfigRow = z.infer<typeof engagementConfigSelectSchema>;
export type EngagementLogRow = z.infer<typeof engagementLogSelectSchema>;
export type WhatsappSessionRow = z.infer<typeof whatsappSessionSelectSchema>;

// ─── Insert Types ───────────────────────────────────────────────────────────

export type NewUser = z.infer<typeof userInsertSchema>;
export type NewPost = z.infer<typeof postInsertSchema>;
export type NewTeamMember = z.infer<typeof teamMemberInsertSchema>;

// ─── Re-exports ─────────────────────────────────────────────────────────────

export type {
	HubRole,
	OAuthTokenMetadata,
	Platform,
	PostMetadata,
	SeriesCadence,
} from "./schema.ts";
