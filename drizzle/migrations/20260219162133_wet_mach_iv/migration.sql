CREATE TABLE "engagement_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"niche_keywords" jsonb,
	"platform_toggles" jsonb,
	"daily_caps" jsonb,
	"cooldown_minutes" jsonb,
	"blocklist" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "engagement_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "engagement_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"engagement_type" text NOT NULL,
	"content" text NOT NULL,
	"external_reply_id" text,
	"outcome" jsonb,
	"engaged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "engagement_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"author_handle" text NOT NULL,
	"author_follower_count" integer,
	"post_snippet" text NOT NULL,
	"post_url" text,
	"posted_at" timestamp with time zone,
	"composite_score_bps" integer NOT NULL,
	"relevance_score_bps" integer NOT NULL,
	"recency_score_bps" integer NOT NULL,
	"reach_score_bps" integer NOT NULL,
	"potential_score_bps" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"suggested_type" text,
	"draft_content" text,
	"engaged_at" timestamp with time zone,
	"detected_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engagement_opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"hub_id" text,
	"title" text NOT NULL,
	"notes" text,
	"tags" jsonb,
	"status" text DEFAULT 'spark' NOT NULL,
	"urgency" text DEFAULT 'evergreen' NOT NULL,
	"pillar" text,
	"platform" text,
	"format" text,
	"claimed_by" text,
	"kill_reason" text,
	"expires_at" timestamp with time zone,
	"last_touched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_type" text,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" text NOT NULL,
	"code" text NOT NULL,
	"created_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_by" text,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "monitored_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"account_handle" text NOT NULL,
	"account_name" text,
	"last_checked_at" timestamp with time zone,
	"last_post_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitored_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"tier" text NOT NULL,
	"provider" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"message_id" text,
	"error" text,
	"dedup_key" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'waha' NOT NULL,
	"push_enabled" integer DEFAULT 1 NOT NULL,
	"digest_enabled" integer DEFAULT 1 NOT NULL,
	"digest_frequency" text DEFAULT 'daily' NOT NULL,
	"digest_time" text DEFAULT '08:00' NOT NULL,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"max_push_per_day" integer DEFAULT 3 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"hub_id" text,
	"name" text NOT NULL,
	"description" text,
	"platform" text NOT NULL,
	"template" jsonb,
	"cadence" text NOT NULL,
	"cadence_custom_days" integer,
	"tracking_mode" text DEFAULT 'auto-increment' NOT NULL,
	"tracking_format" text,
	"episode_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_published_at" timestamp with time zone,
	"pillar" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "series" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"hub_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"display_name" text,
	"email" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"source" text NOT NULL,
	"source_score" integer,
	"pillar_relevance" jsonb,
	"overall_score" integer DEFAULT 0 NOT NULL,
	"suggested_angles" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"used_in_idea_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"week_end" timestamp with time zone NOT NULL,
	"slots" jsonb,
	"total_slots" integer DEFAULT 0 NOT NULL,
	"completed_slots" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "whatsapp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"phone" text NOT NULL,
	"provider" text NOT NULL,
	"session_state" text DEFAULT 'inactive' NOT NULL,
	"conversation_context" jsonb,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_sessions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "whatsapp_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "approval_status" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewer_id" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "review_comment" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preference_model" ADD COLUMN "killed_idea_patterns" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "engagement_opp_ext_platform_idx" ON "engagement_opportunities" USING btree ("external_post_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_user_hub_idx" ON "team_members" USING btree ("user_id","hub_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trends_user_title_source_idx" ON "trends" USING btree ("user_id","title","source");--> statement-breakpoint
CREATE UNIQUE INDEX "post_metrics_post_platform_idx" ON "post_metrics" USING btree ("post_id","platform");--> statement-breakpoint
CREATE POLICY "engagement_config_isolation" ON "engagement_config" AS PERMISSIVE FOR ALL TO "hub_user" USING ("engagement_config"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("engagement_config"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "engagement_log_isolation" ON "engagement_log" AS PERMISSIVE FOR ALL TO "hub_user" USING ("engagement_log"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("engagement_log"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "engagement_opportunities_isolation" ON "engagement_opportunities" AS PERMISSIVE FOR ALL TO "hub_user" USING ("engagement_opportunities"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("engagement_opportunities"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "ideas_isolation" ON "ideas" AS PERMISSIVE FOR ALL TO "hub_user" USING ("ideas"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("ideas"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "monitored_accounts_isolation" ON "monitored_accounts" AS PERMISSIVE FOR ALL TO "hub_user" USING ("monitored_accounts"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("monitored_accounts"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "notification_log_isolation" ON "notification_log" AS PERMISSIVE FOR ALL TO "hub_user" USING ("notification_log"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("notification_log"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "notification_preferences_isolation" ON "notification_preferences" AS PERMISSIVE FOR ALL TO "hub_user" USING ("notification_preferences"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("notification_preferences"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "series_isolation" ON "series" AS PERMISSIVE FOR ALL TO "hub_user" USING ("series"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("series"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "team_members_isolation" ON "team_members" AS PERMISSIVE FOR ALL TO "hub_user" USING ("team_members"."user_id" = current_setting('app.current_user_id') OR "team_members"."hub_id" IN (SELECT hub_id FROM team_members WHERE user_id = current_setting('app.current_user_id') AND left_at IS NULL)) WITH CHECK ("team_members"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "trends_isolation" ON "trends" AS PERMISSIVE FOR ALL TO "hub_user" USING ("trends"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("trends"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "weekly_plans_isolation" ON "weekly_plans" AS PERMISSIVE FOR ALL TO "hub_user" USING ("weekly_plans"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("weekly_plans"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "whatsapp_sessions_isolation" ON "whatsapp_sessions" AS PERMISSIVE FOR ALL TO "hub_user" USING ("whatsapp_sessions"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("whatsapp_sessions"."user_id" = current_setting('app.current_user_id'));