import { sql } from "drizzle-orm";
import {
	integer,
	jsonb,
	pgPolicy,
	pgRole,
	pgTable,
	text,
	timestamp,
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
