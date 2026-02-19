CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"service" text NOT NULL,
	"key_name" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "edit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"original_content" text NOT NULL,
	"edited_content" text NOT NULL,
	"edit_distance" integer NOT NULL,
	"edit_ratio" integer NOT NULL,
	"edit_patterns" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edit_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "post_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"post_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_post_id" text NOT NULL,
	"impression_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"retweet_count" integer DEFAULT 0 NOT NULL,
	"quote_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"bookmark_count" integer DEFAULT 0 NOT NULL,
	"url_link_clicks" integer,
	"user_profile_clicks" integer,
	"engagement_score" integer DEFAULT 0 NOT NULL,
	"engagement_rate_bps" integer DEFAULT 0 NOT NULL,
	"post_format" text,
	"post_topic" text,
	"post_pillar" text,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"content" text NOT NULL,
	"media_urls" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"sub_status" text,
	"parent_post_id" text,
	"thread_position" integer,
	"trigger_run_id" text,
	"fail_reason" text,
	"platform_post_ids" jsonb,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"external_post_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preference_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"top_formats" jsonb,
	"top_pillars" jsonb,
	"best_posting_times" jsonb,
	"hook_patterns" jsonb,
	"common_edit_patterns" jsonb,
	"avg_edit_ratio" integer,
	"fatigued_topics" jsonb,
	"locked_settings" jsonb,
	"follower_history" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "preference_model_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "preference_model" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "strategy_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"adjustment_type" text NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text NOT NULL,
	"evidence" jsonb,
	"tier" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strategy_adjustments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE POLICY "api_keys_isolation" ON "api_keys" AS PERMISSIVE FOR ALL TO "hub_user" USING ("api_keys"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("api_keys"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "edit_history_isolation" ON "edit_history" AS PERMISSIVE FOR ALL TO "hub_user" USING ("edit_history"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("edit_history"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "oauth_tokens_isolation" ON "oauth_tokens" AS PERMISSIVE FOR ALL TO "hub_user" USING ("oauth_tokens"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("oauth_tokens"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "post_metrics_isolation" ON "post_metrics" AS PERMISSIVE FOR ALL TO "hub_user" USING ("post_metrics"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("post_metrics"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "posts_isolation" ON "posts" AS PERMISSIVE FOR ALL TO "hub_user" USING ("posts"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("posts"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "preference_model_isolation" ON "preference_model" AS PERMISSIVE FOR ALL TO "hub_user" USING ("preference_model"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("preference_model"."user_id" = current_setting('app.current_user_id'));--> statement-breakpoint
CREATE POLICY "strategy_adjustments_isolation" ON "strategy_adjustments" AS PERMISSIVE FOR ALL TO "hub_user" USING ("strategy_adjustments"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("strategy_adjustments"."user_id" = current_setting('app.current_user_id'));