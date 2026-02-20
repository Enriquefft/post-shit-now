CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entity_slug" text NOT NULL,
	"entity_display_name" text,
	"entity_description" text,
	"last_used_at" timestamp with time zone,
	"profile_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "voice_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "voice_profiles_user_entity_idx" ON "voice_profiles" USING btree ("user_id","entity_slug");--> statement-breakpoint
CREATE POLICY "voice_profiles_isolation" ON "voice_profiles" AS PERMISSIVE FOR ALL TO "hub_user" USING ("voice_profiles"."user_id" = current_setting('app.current_user_id')) WITH CHECK ("voice_profiles"."user_id" = current_setting('app.current_user_id'));