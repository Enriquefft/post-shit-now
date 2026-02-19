import { sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	pgPolicy,
	pgRole,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

// Role for hub users — expected to exist in the database
export const hubUser = pgRole("hub_user").existing();

// ─── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	externalId: text("external_id").unique().notNull(),
	displayName: text("display_name"),
	email: text("email"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── OAuth Tokens ───────────────────────────────────────────────────────────

export const oauthTokens = pgTable(
	"oauth_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		platform: text("platform").notNull(), // x | linkedin | instagram | tiktok
		accessToken: text("access_token").notNull(), // encrypted
		refreshToken: text("refresh_token"), // encrypted, nullable (not all platforms use refresh)
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		scopes: text("scopes"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("oauth_tokens_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Posts ───────────────────────────────────────────────────────────────────

export const posts = pgTable(
	"posts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		platform: text("platform").notNull(), // x | linkedin | instagram | tiktok
		content: text("content").notNull(),
		mediaUrls: jsonb("media_urls").$type<string[]>(),
		status: text("status").notNull().default("draft"), // draft | scheduled | publishing | published | failed | retry
		subStatus: text("sub_status"), // retry_1, rate_limited, media_uploading, etc.
		parentPostId: text("parent_post_id"), // references parent post for thread tweets
		threadPosition: integer("thread_position"), // position in thread (0-indexed)
		triggerRunId: text("trigger_run_id"), // Trigger.dev run ID for cancel/reschedule
		failReason: text("fail_reason"), // human-readable failure reason
		platformPostIds: jsonb("platform_post_ids").$type<string[]>(), // array of platform-side post IDs (for threads)
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		externalPostId: text("external_post_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		seriesId: text("series_id"), // references series.id when post is part of a series
		language: text("language"), // "en" | "es" | "both" for bilingual tracking
		// Approval workflow columns (null for personal posts)
		approvalStatus: text("approval_status"), // draft | submitted | approved | rejected
		reviewerId: text("reviewer_id"), // admin who approved/rejected
		reviewComment: text("review_comment"), // rejection reason or approval note
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("posts_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── API Keys ───────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
	"api_keys",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		service: text("service").notNull(), // e.g., openai, perplexity, fal
		keyName: text("key_name").notNull(),
		encryptedValue: text("encrypted_value").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("api_keys_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Edit History ───────────────────────────────────────────────────────────

export interface EditPattern {
	type:
		| "tone-adjustment"
		| "word-choice"
		| "structure-change"
		| "length-change"
		| "addition"
		| "removal"
		| "rewrite";
	description: string;
	count: number;
}

export const editHistory = pgTable(
	"edit_history",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		postId: text("post_id").notNull(),
		originalContent: text("original_content").notNull(),
		editedContent: text("edited_content").notNull(),
		editDistance: integer("edit_distance").notNull(),
		editRatio: integer("edit_ratio").notNull(),
		editPatterns: jsonb("edit_patterns").$type<EditPattern[]>(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("edit_history_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Post Metrics ──────────────────────────────────────────────────────────

export const postMetrics = pgTable(
	"post_metrics",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		postId: uuid("post_id").notNull(),
		platform: text("platform").notNull(),
		language: text("language"), // "en" | "es" | "both" for per-language performance tracking
		externalPostId: text("external_post_id").notNull(),

		// Raw metrics snapshot
		impressionCount: integer("impression_count").default(0).notNull(),
		likeCount: integer("like_count").default(0).notNull(),
		retweetCount: integer("retweet_count").default(0).notNull(),
		quoteCount: integer("quote_count").default(0).notNull(),
		replyCount: integer("reply_count").default(0).notNull(),
		bookmarkCount: integer("bookmark_count").default(0).notNull(),
		urlLinkClicks: integer("url_link_clicks"),
		userProfileClicks: integer("user_profile_clicks"),

		// Computed scores
		engagementScore: integer("engagement_score").default(0).notNull(),
		engagementRateBps: integer("engagement_rate_bps").default(0).notNull(), // basis points (1 bps = 0.01%)

		// Context for fatigue tracking and cross-pillar analysis
		postFormat: text("post_format"),
		postTopic: text("post_topic"),
		postPillar: text("post_pillar"),

		collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("post_metrics_post_platform_idx").on(table.postId, table.platform),
		pgPolicy("post_metrics_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Preference Model ──────────────────────────────────────────────────────

export const preferenceModel = pgTable(
	"preference_model",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),

		// Engagement learnings
		topFormats: jsonb("top_formats").$type<Array<{ format: string; avgScore: number }>>(),
		topPillars: jsonb("top_pillars").$type<Array<{ pillar: string; avgScore: number }>>(),
		bestPostingTimes:
			jsonb("best_posting_times").$type<
				Array<{ hour: number; dayOfWeek: number; avgScore: number }>
			>(),
		hookPatterns: jsonb("hook_patterns").$type<string[]>(),

		// Edit learnings
		commonEditPatterns:
			jsonb("common_edit_patterns").$type<Array<{ type: string; frequency: number }>>(),
		avgEditRatio: integer("avg_edit_ratio"),

		// Fatigue tracking
		fatiguedTopics:
			jsonb("fatigued_topics").$type<
				Array<{ topic: string; cooldownUntil: string; lastScores: number[] }>
			>(),

		// Locked settings (user overrides — permanent until explicitly unlocked)
		lockedSettings:
			jsonb("locked_settings").$type<Array<{ field: string; value: unknown; lockedAt: string }>>(),

		// Killed idea feedback (rejection patterns from idea bank)
		killedIdeaPatterns:
			jsonb("killed_idea_patterns").$type<{
				rejectedPillars: Record<string, number>;
				commonReasons: string[];
				recentKills: number;
			}>(),

		// Follower tracking (weekly/monthly trend)
		followerHistory: jsonb("follower_history").$type<Array<{ count: number; date: string }>>(),

		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("preference_model_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Strategy Adjustments ──────────────────────────────────────────────────

export const strategyAdjustments = pgTable(
	"strategy_adjustments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		adjustmentType: text("adjustment_type").notNull(), // pillar_weight, posting_time, format_preference, frequency, new_pillar, drop_format
		field: text("field").notNull(),
		oldValue: jsonb("old_value"),
		newValue: jsonb("new_value"),
		reason: text("reason").notNull(),
		evidence: jsonb("evidence").$type<string[]>(), // post IDs supporting this adjustment
		tier: text("tier").notNull(), // "auto" | "approval"
		status: text("status").notNull().default("pending"), // "pending" | "applied" | "approved" | "rejected"
		appliedAt: timestamp("applied_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("strategy_adjustments_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Ideas ────────────────────────────────────────────────────────────────

export const ideas = pgTable(
	"ideas",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		hubId: text("hub_id"), // null = personal hub
		title: text("title").notNull(),
		notes: text("notes"),
		tags: jsonb("tags").$type<string[]>(),
		status: text("status").notNull().default("spark"), // spark | seed | ready | claimed | developed | used | killed
		urgency: text("urgency").notNull().default("evergreen"), // timely | seasonal | evergreen
		pillar: text("pillar"),
		platform: text("platform"),
		format: text("format"),
		claimedBy: text("claimed_by"),
		killReason: text("kill_reason"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		lastTouchedAt: timestamp("last_touched_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		sourceType: text("source_type"), // trend | capture | plan | remix | recycle
		sourceId: text("source_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("ideas_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Series ───────────────────────────────────────────────────────────────

export interface SeriesTemplate {
	formatStructure: string;
	sections: string[];
	introPattern?: string;
	outroPattern?: string;
	visualStyle?: string;
	hashtags?: string[];
}

export const series = pgTable(
	"series",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		hubId: text("hub_id"),
		name: text("name").notNull(),
		description: text("description"),
		platform: text("platform").notNull(),
		template: jsonb("template").$type<SeriesTemplate>(),
		cadence: text("cadence").notNull(), // weekly | biweekly | monthly | custom
		cadenceCustomDays: integer("cadence_custom_days"),
		trackingMode: text("tracking_mode").notNull().default("auto-increment"), // none | auto-increment | custom
		trackingFormat: text("tracking_format"), // e.g., "Season {s}, Ep {e}"
		episodeCount: integer("episode_count").notNull().default(0),
		status: text("status").notNull().default("active"), // active | paused | retired
		lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
		pillar: text("pillar"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("series_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Trends ───────────────────────────────────────────────────────────────

export const trends = pgTable(
	"trends",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		title: text("title").notNull(),
		url: text("url"),
		source: text("source").notNull(), // hackernews | reddit | producthunt | google-trends | rss | x
		sourceScore: integer("source_score"),
		pillarRelevance: jsonb("pillar_relevance").$type<Record<string, number>>(),
		overallScore: integer("overall_score").notNull().default(0),
		suggestedAngles: jsonb("suggested_angles").$type<string[]>(),
		detectedAt: timestamp("detected_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		usedInIdeaId: text("used_in_idea_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("trends_user_title_source_idx").on(
			table.userId,
			table.title,
			table.source,
		),
		pgPolicy("trends_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Weekly Plans ─────────────────────────────────────────────────────────

export interface PlanSlot {
	day: string;
	platform: string;
	topic: string;
	format: string;
	pillar: string;
	language: string;
	seriesId?: string;
	seriesEpisode?: number;
	ideaId?: string;
	postId?: string;
	status: string;
}

export const weeklyPlans = pgTable(
	"weekly_plans",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
		weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
		slots: jsonb("slots").$type<PlanSlot[]>(),
		totalSlots: integer("total_slots").notNull().default(0),
		completedSlots: integer("completed_slots").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("weekly_plans_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Monitored Accounts ───────────────────────────────────────────────────

export const monitoredAccounts = pgTable(
	"monitored_accounts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		platform: text("platform").notNull(),
		accountHandle: text("account_handle").notNull(),
		accountName: text("account_name"),
		lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
		lastPostCount: integer("last_post_count"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("monitored_accounts_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Team Members ────────────────────────────────────────────────────────────

export const teamMembers = pgTable(
	"team_members",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		hubId: text("hub_id").notNull(),
		role: text("role").notNull().default("member"), // admin | member
		displayName: text("display_name"),
		email: text("email"),
		joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
		leftAt: timestamp("left_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("team_members_user_hub_idx").on(table.userId, table.hubId),
		pgPolicy("team_members_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id') OR ${table.hubId} IN (SELECT hub_id FROM team_members WHERE user_id = current_setting('app.current_user_id') AND left_at IS NULL)`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Invite Codes ────────────────────────────────────────────────────────────

export const inviteCodes = pgTable("invite_codes", {
	id: uuid("id").defaultRandom().primaryKey(),
	hubId: text("hub_id").notNull(),
	code: text("code").notNull().unique(),
	createdBy: text("created_by").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	usedBy: text("used_by"),
	usedAt: timestamp("used_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Notification Preferences ────────────────────────────────────────────────

export const notificationPreferences = pgTable(
	"notification_preferences",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		provider: text("provider").notNull().default("waha"), // waha | twilio
		pushEnabled: integer("push_enabled").notNull().default(1),
		digestEnabled: integer("digest_enabled").notNull().default(1),
		digestFrequency: text("digest_frequency").notNull().default("daily"), // daily | twice_daily | weekly
		digestTime: text("digest_time").notNull().default("08:00"), // HH:MM in user's timezone
		quietHoursStart: text("quiet_hours_start"),
		quietHoursEnd: text("quiet_hours_end"),
		maxPushPerDay: integer("max_push_per_day").notNull().default(3),
		timezone: text("timezone").notNull().default("UTC"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("notification_preferences_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Notification Log ────────────────────────────────────────────────────────

export const notificationLog = pgTable(
	"notification_log",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		eventType: text("event_type").notNull(),
		tier: text("tier").notNull(), // push | digest | standard
		provider: text("provider").notNull(), // waha | twilio
		recipient: text("recipient").notNull(), // phone number
		status: text("status").notNull().default("pending"), // pending | sent | failed | skipped
		messageId: text("message_id"), // provider's message ID
		error: text("error"),
		dedupKey: text("dedup_key"), // for dedup within window
		sentAt: timestamp("sent_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("notification_log_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── WhatsApp Sessions ───────────────────────────────────────────────────────

// ─── Engagement Opportunities ────────────────────────────────────────────────

export const engagementOpportunities = pgTable(
	"engagement_opportunities",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		platform: text("platform").notNull(), // x | linkedin | instagram | tiktok
		externalPostId: text("external_post_id").notNull(),
		authorHandle: text("author_handle").notNull(),
		authorFollowerCount: integer("author_follower_count"),
		postSnippet: text("post_snippet").notNull(),
		postUrl: text("post_url"),
		postedAt: timestamp("posted_at", { withTimezone: true }),
		compositeScoreBps: integer("composite_score_bps").notNull(),
		relevanceScoreBps: integer("relevance_score_bps").notNull(),
		recencyScoreBps: integer("recency_score_bps").notNull(),
		reachScoreBps: integer("reach_score_bps").notNull(),
		potentialScoreBps: integer("potential_score_bps").notNull(),
		status: text("status").notNull().default("pending"), // pending | triaged_yes | triaged_no | drafted | engaged | expired
		suggestedType: text("suggested_type"), // reply | quote | repost | duet | stitch | comment
		draftContent: text("draft_content"),
		engagedAt: timestamp("engaged_at", { withTimezone: true }),
		detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("engagement_opp_ext_platform_idx").on(table.externalPostId, table.platform),
		pgPolicy("engagement_opportunities_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Engagement Config ──────────────────────────────────────────────────────

export const engagementConfig = pgTable(
	"engagement_config",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		nicheKeywords: jsonb("niche_keywords").$type<string[]>(),
		platformToggles: jsonb("platform_toggles").$type<Record<string, boolean>>(),
		dailyCaps: jsonb("daily_caps").$type<Record<string, number>>(),
		cooldownMinutes: jsonb("cooldown_minutes").$type<Record<string, number>>(),
		blocklist: jsonb("blocklist").$type<string[]>(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("engagement_config_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── Engagement Log ─────────────────────────────────────────────────────────

export const engagementLog = pgTable(
	"engagement_log",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull(),
		opportunityId: uuid("opportunity_id").notNull(),
		platform: text("platform").notNull(),
		engagementType: text("engagement_type").notNull(), // reply | quote | repost | duet | stitch | comment
		content: text("content").notNull(),
		externalReplyId: text("external_reply_id"),
		outcome: jsonb("outcome").$type<{ impressions?: number; likes?: number; replies?: number }>(),
		engagedAt: timestamp("engaged_at", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("engagement_log_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);

// ─── WhatsApp Sessions ───────────────────────────────────────────────────────

export const whatsappSessions = pgTable(
	"whatsapp_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		phone: text("phone").notNull(),
		provider: text("provider").notNull(), // waha | twilio
		sessionState: text("session_state").notNull().default("inactive"), // inactive | active | expired
		conversationContext: jsonb("conversation_context").$type<Record<string, unknown>>(),
		lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("whatsapp_sessions_isolation", {
			as: "permissive",
			to: hubUser,
			for: "all",
			using: sql`${table.userId} = current_setting('app.current_user_id')`,
			withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
		}),
	],
);
