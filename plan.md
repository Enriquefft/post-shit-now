  Summary of the Plan:

  Core Strategy:
  1. Add drizzle-zod package to generate Zod schemas from Drizzle ORM definitions
  2. Use TypeScript inference from return values instead of manual type definitions
  3. Eliminate manual type interfaces that duplicate the database schema
  4. Use as const satisfies for compile-time validation (only where appropriate)

  Key Improvements:
  - Single Source of Truth: Drizzle schema becomes the authoritative type source
  - TypeScript Inference: Let the compiler infer types automatically
  - Runtime Validation: Zod schemas provide runtime type checking
  - No Duplicate Work: Schema changes auto-propagate to types

  Implementation Phases:
  1. Setup drizzle-zod and generate schemas
  2. Replace manual type imports with schema-zod imports
  3. Fix database schema (add enum types where missing)
  4. Update code to use inferred types instead of casts

 ╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
 │ Plan: Fix Type Casts (as) with Robust Solutions                                                                                    │
 │                                                                                                                                    │
 │ Context                                                                                                                            │
 │                                                                                                                                    │
 │ The codebase contains 134 type casts using the as keyword across 31 files. These casts are primarily used for:                     │
 │ 1. Database row casting - Converting Drizzle ORM query results to TypeScript types                                                 │
 │ 2. API response casting - Casting JSON API responses to defined types                                                              │
 │ 3. Optional property casting - Handling potentially undefined database fields                                                      │
 │ 4. String literal to enum - Converting string values to TypeScript enums                                                           │
 │ 5. Array casting - Converting arrays from different sources                                                                        │
 │                                                                                                                                    │
 │ User Requirements:                                                                                                                 │
 │ - Enable single source of truth for type definitions                                                                               │
 │ - Leverage TypeScript inference power - avoid manually creating types/interfaces when inference works                              │
 │ - For DB-related types, use drizzle-zod to infer types from schema (single source of truth)                                        │
 │                                                                                                                                    │
 │ Strategy Overview                                                                                                                  │
 │                                                                                                                                    │
 │ Instead of manually creating type definitions and casting, we will:                                                                │
 │ 1. Use TypeScript inference wherever possible - let the compiler infer types from return values                                    │
 │ 2. Add drizzle-zod for schema-based type inference - generate Zod schemas from Drizzle definitions                                 │
 │ 3. Eliminate unnecessary type definitions - remove manual interfaces that duplicate schema                                         │
 │ 4. Use return types - leverage function return types instead of redefining                                                         │
 │                                                                                                                                    │
 │ Phase 1: Add drizzle-zod for Schema-Based Types                                                                                    │
 │                                                                                                                                    │
 │ 1.1 Install and Configure drizzle-zod                                                                                              │
 │                                                                                                                                    │
 │ File: package.json                                                                                                                 │
 │                                                                                                                                    │
 │ Add dependency:                                                                                                                    │
 │ "devDependencies": {                                                                                                               │
 │   "drizzle-zod": "^0.8.3",                                                                                                         │
 │   // ... existing                                                                                                                  │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ 1.2 Generate Zod Schemas from Drizzle                                                                                              │
 │                                                                                                                                    │
 │ Action: Run generation command after schema changes                                                                                │
 │ bun run db:generate  # This should also generate Zod schemas                                                                       │
 │                                                                                                                                    │
 │ Add script if needed:                                                                                                              │
 │ "scripts": {                                                                                                                       │
 │   "db:schema:generate": "drizzle-zod"                                                                                              │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ Generated schema file location: src/core/db/schema-zod.ts                                                                          │
 │                                                                                                                                    │
 │ 1.3 Update Type Imports                                                                                                            │
 │                                                                                                                                    │
 │ Replace manual type imports with schema-inferred types:                                                                            │
 │                                                                                                                                    │
 │ Pattern A - Database Row Types:                                                                                                    │
 │ // Instead of: interface User { id: string; displayName: string; ... }                                                             │
 │ // Use drizzle-zod:                                                                                                                │
 │ import { users, posts, ... } from "./schema-zod";                                                                                  │
 │                                                                                                                                    │
 │ // Query returns already-typed result:                                                                                             │
 │ const userRows = await db.select().from(users);                                                                                    │
 │ // userRows is typed as UserRow[] from schema-zod                                                                                  │
 │                                                                                                                                    │
 │ Pattern B - Insert/Update Types:                                                                                                   │
 │ // drizzle-zod provides both row types and insertion types:                                                                        │
 │ import { users, type NewUser } from "./schema-zod";                                                                                │
 │                                                                                                                                    │
 │ const newUser: NewUser = {                                                                                                         │
 │   displayName: "Alice",                                                                                                            │
 │   email: "alice@example.com",                                                                                                      │
 │   // Type-safe - only valid columns allowed                                                                                        │
 │ };                                                                                                                                 │
 │ await db.insert(users).values(newUser);                                                                                            │
 │                                                                                                                                    │
 │ Phase 2: Fix High Impact Areas                                                                                                     │
 │                                                                                                                                    │
 │ 2.1 Platform Client API Response Casting                                                                                           │
 │                                                                                                                                    │
 │ Files:                                                                                                                             │
 │ - src/platforms/x/client.ts - Lines 59, 95                                                                                         │
 │ - src/platforms/linkedin/client.ts - Lines 72, 74, 100                                                                             │
 │ - src/platforms/instagram/client.ts - Lines 66, 95                                                                                 │
 │ - src/platforms/tiktok/client.ts - Lines 99, 192                                                                                   │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ const json = await response.json();                                                                                                │
 │ data = schema ? schema.parse(json) : (json as T);                                                                                  │
 │                                                                                                                                    │
 │ Solution - Use Conditional Return Type:                                                                                            │
 │                                                                                                                                    │
 │ private async request<T>(                                                                                                          │
 │   endpoint: string,                                                                                                                │
 │   options: RequestInit,                                                                                                            │
 │   schema?: ZodType<T>,                                                                                                             │
 │ ): Promise<T> {                                                                                                                    │
 │   const response = await fetch(url, { ...options, headers });                                                                      │
 │                                                                                                                                    │
 │   if (!response.ok) {                                                                                                              │
 │     const bodyText = await response.text();                                                                                        │
 │     throw new PlatformApiError(response.status, bodyText, rateLimit);                                                              │
 │   }                                                                                                                                │
 │                                                                                                                                    │
 │   const contentType = response.headers.get("content-type");                                                                        │
 │                                                                                                                                    │
 │   // TypeScript infers the correct union type                                                                                      │
 │   if (contentType?.includes("application/json")) {                                                                                 │
 │     const json = await response.json();                                                                                            │
 │     return schema ? schema.parse(json) : json;                                                                                     │
 │   }                                                                                                                                │
 │                                                                                                                                    │
 │   // Empty body (e.g., 201 Created) - return type that satisfies T constraints                                                     │
 │   // The actual type T should be flexible to handle empty responses                                                                │
 │   return {} as T satisfies Record<string, never>;                                                                                  │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ Additional Fix: Update API response types to handle empty bodies:                                                                  │
 │                                                                                                                                    │
 │ For endpoints that return empty responses, the type T should be optional or have empty object variant:                             │
 │ interface CreatePostResponse {                                                                                                     │
 │   id: string;                                                                                                                      │
 │   url?: string;                                                                                                                    │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ interface EmptyResponse extends Record<string, never> {}                                                                           │
 │ // Then use: Promise<CreatePostResponse | EmptyResponse>                                                                           │
 │                                                                                                                                    │
 │ 2.2 Metadata Object Casting                                                                                                        │
 │                                                                                                                                    │
 │ Files:                                                                                                                             │
 │ - src/analytics/collector.ts - Lines 180, 374, 546, 723, 759                                                                       │
 │ - src/approval/calendar.ts - Line 308                                                                                              │
 │ - src/trigger/publish-post.ts - Lines 293, 463, 698, 898                                                                           │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ const metadata = (post.metadata ?? {}) as Record<string, unknown>;                                                                 │
 │ const postFormat = (metadata.format as string) ?? null;                                                                            │
 │                                                                                                                                    │
 │ Solution A - Use drizzle-zod Schema Type:                                                                                          │
 │                                                                                                                                    │
 │ After running drizzle-zod, use the inferred row type:                                                                              │
 │ import { posts, type PostRow } from "./schema-zod";                                                                                │
 │                                                                                                                                    │
 │ // The metadata field is already typed correctly in the row                                                                        │
 │ const post = postRows[0];                                                                                                          │
 │ const metadata = post.metadata; // Properly typed as Record<string, unknown>                                                       │
 │ const postFormat = metadata?.format ?? null; // Optional chaining                                                                  │
 │                                                                                                                                    │
 │ Solution B - Define Proper Metadata Type (if schema isn't sufficient):                                                             │
 │                                                                                                                                    │
 │ If we need stronger typing than Record<string, unknown>, define in schema:                                                         │
 │ // In src/core/db/schema.ts                                                                                                        │
 │ export const posts = pgTable("posts", {                                                                                            │
 │   // ... existing columns                                                                                                          │
 │   metadata: jsonb("metadata").$type<PostMetadata>(),                                                                               │
 │ });                                                                                                                                │
 │                                                                                                                                    │
 │ // In types file                                                                                                                   │
 │ export interface PostMetadata {                                                                                                    │
 │   format?: string;                                                                                                                 │
 │   topic?: string;                                                                                                                  │
 │   pillar?: string;                                                                                                                 │
 │   platformPostIds?: Record<string, string>;                                                                                        │
 │   hookPatterns?: string[];                                                                                                         │
 │   seriesEpisodeId?: string;                                                                                                        │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ // drizzle-zod will then generate the correct PostRow type with typed metadata                                                     │
 │                                                                                                                                    │
 │ 2.3 String Literal to Enum Casts                                                                                                   │
 │                                                                                                                                    │
 │ File: src/content/format-picker.ts                                                                                                 │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ export const FORMAT_CONSTRAINTS: Record<PostFormat, { ... }> = {                                                                   │
 │   "short-post" as PostFormat: { ... },                                                                                             │
 │   // ...                                                                                                                           │
 │ };                                                                                                                                 │
 │                                                                                                                                    │
 │ Solution - Use satisfies Assertion:                                                                                                │
 │ export const FORMAT_CONSTRAINTS = {                                                                                                │
 │   "short-post": { maxChars: 280, description: "Single short text post" },                                                          │
 │   "long-post": { maxChars: 3000, description: "Long-form LinkedIn text post" },                                                    │
 │   // ... all other entries                                                                                                         │
 │ } satisfies Record<PostFormat, { maxChars?: number; description: string }>;                                                        │
 │                                                                                                                                    │
 │ export const PLATFORM_FORMAT_SUPPORT = {                                                                                           │
 │   x: ["short-post", "thread", "image-post", "video-post", "quote-image"],                                                          │
 │   linkedin: ["short-post", "long-post", "carousel", "image-post", "linkedin-article", "video-post", "quote-image", "infographic"], │
 │   instagram: ["image-post", "carousel", "reel-script", "video-post", "quote-image"],                                               │
 │   tiktok: ["video-post", "reel-script"],                                                                                           │
 │ } satisfies Record<Platform, PostFormat[]>;                                                                                        │
 │                                                                                                                                    │
 │ This validates at compile-time that all values are valid PostFormat values without runtime casts.                                  │
 │                                                                                                                                    │
 │ 2.4 Database Row Casting for Enums                                                                                                 │
 │                                                                                                                                    │
 │ File: src/team/members.ts - Lines 44, 160, 195                                                                                     │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ const role = row.role as HubRole;                                                                                                  │
 │                                                                                                                                    │
 │ Solution - Use drizzle-zod Inferred Type:                                                                                          │
 │ import { users, type UserRow } from "../../core/db/schema-zod";                                                                    │
 │                                                                                                                                    │
 │ const userRow: UserRow = rows[0];                                                                                                  │
 │ const role = userRow.role; // Type inferred from schema, no cast needed                                                            │
 │                                                                                                                                    │
 │ If the schema role column is not using an enum type, fix it in schema:                                                             │
 │ // In src/core/db/schema.ts                                                                                                        │
 │ export const users = pgTable("users", {                                                                                            │
 │   id: uuid("id").defaultRandom().primaryKey(),                                                                                     │
 │   externalId: text("external_id").unique().notNull(),                                                                              │
 │   displayName: text("display_name"),                                                                                               │
 │   email: text("email"),                                                                                                            │
 │   role: text("role").notNull(), // Should reference HubRole type                                                                   │
 │   // ...                                                                                                                           │
 │ });                                                                                                                                │
 │                                                                                                                                    │
 │ And define enum in same file for drizzle-zod to pick up:                                                                           │
 │ export enum HubRole {                                                                                                              │
 │   admin = "admin",                                                                                                                 │
 │   member = "member",                                                                                                               │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ Phase 3: Fix Medium Impact Areas                                                                                                   │
 │                                                                                                                                    │
 │ 3.1 Array Casting with Empty Defaults                                                                                              │
 │                                                                                                                                    │
 │ Files:                                                                                                                             │
 │ - src/learning/feedback.ts - Lines 148, 149                                                                                        │
 │ - src/learning/preference-model.ts - Line 227                                                                                      │
 │ - src/analytics/review.ts - Lines 315, 316, 317                                                                                    │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ const topFormats = (existing.topFormats ?? []) as Array<{ format: string; avgScore: number }>;                                     │
 │                                                                                                                                    │
 │ Solution - Use Type Inference from Return Values:                                                                                  │
 │                                                                                                                                    │
 │ Let TypeScript infer the array type from the source:                                                                               │
 │                                                                                                                                    │
 │ // If existing.topFormats is typed correctly, ?? [] is already the right type                                                      │
 │ const topFormats = existing.topFormats ?? [];                                                                                      │
 │ // TypeScript infers: Array<{ format: string; avgScore: number }> | undefined                                                      │
 │                                                                                                                                    │
 │ // If you need a guaranteed non-empty array, use default value pattern:                                                            │
 │ const formats = existing.topFormats ?? [] satisfies { format: string; avgScore: number }[];                                        │
 │                                                                                                                                    │
 │ Or define default arrays with as const if they're truly constants:                                                                 │
 │ const EMPTY_FORMATS = [] as const satisfies { format: string; avgScore: number }[];                                                │
 │ const topFormats = existing.topFormats ?? EMPTY_FORMATS;                                                                           │
 │                                                                                                                                    │
 │ 3.2 Media URL Array Casting                                                                                                        │
 │                                                                                                                                    │
 │ File: src/trigger/publish-post.ts - Lines 293, 463, 698, 898                                                                       │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ post.mediaUrls as string[] | null                                                                                                  │
 │                                                                                                                                    │
 │ Solution - Use Optional Chaining:                                                                                                  │
 │ const mediaUrls = post.mediaUrls ?? []; // TypeScript infers string[][]                                                            │
 │                                                                                                                                    │
 │ 3.3 Series Data Casting                                                                                                            │
 │                                                                                                                                    │
 │ File: src/series/episodes.ts                                                                                                       │
 │                                                                                                                                    │
 │ Current Pattern: Multiple casts for series data                                                                                    │
 │                                                                                                                                    │
 │ Solution - Use drizzle-zod Inferred Types:                                                                                         │
 │ import { series, type SeriesRow } from "../../core/db/schema-zod";                                                                 │
 │                                                                                                                                    │
 │ const seriesRow: SeriesRow = await db.select().from(series).limit(1);                                                              │
 │ const cadence = seriesRow.cadence; // Already typed correctly                                                                      │
 │ const template = seriesRow.template; // Already typed correctly                                                                    │
 │                                                                                                                                    │
 │ If series table schema is using text for enum fields, update schema:                                                               │
 │ export const series = pgTable("series", {                                                                                          │
 │   id: uuid("id").defaultRandom().primaryKey(),                                                                                     │
 │   slug: text("slug").notNull(),                                                                                                    │
 │   cadence: text("cadence").$type<SeriesCadence>().notNull(),                                                                       │
 │   // ... other fields                                                                                                              │
 │ });                                                                                                                                │
 │                                                                                                                                    │
 │ Phase 4: Fix Low Impact / Minor Areas                                                                                              │
 │                                                                                                                                    │
 │ 4.1 JSON Parsing with Type Safety                                                                                                  │
 │                                                                                                                                    │
 │ Files:                                                                                                                             │
 │ - src/cli/post.ts - Line 435                                                                                                       │
 │ - src/platforms/instagram/hashtags.ts - Line 35                                                                                    │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ JSON.parse(tweetsJson) as string[]                                                                                                 │
 │                                                                                                                                    │
 │ Solution - Use Zod for Runtime Validation:                                                                                         │
 │ import { z } from "zod";                                                                                                           │
 │                                                                                                                                    │
 │ const tweetsSchema = z.array(z.string());                                                                                          │
 │ const parsed = tweetsSchema.safeParse(JSON.parse(tweetsJson));                                                                     │
 │                                                                                                                                    │
 │ if (!parsed.success) {                                                                                                             │
 │   throw new Error(`Invalid tweets JSON: ${parsed.error.message}`);                                                                 │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ const tweets = parsed.data; // string[], type-safe with error handling                                                             │
 │                                                                                                                                    │
 │ 4.2 Enum Array Access with Bounds                                                                                                  │
 │                                                                                                                                    │
 │ File: src/voice/interview.ts - Lines 366, 379                                                                                      │
 │                                                                                                                                    │
 │ Current Pattern:                                                                                                                   │
 │ const nextPhase = PHASE_ORDER[currentIndex + 1] as InterviewPhase;                                                                 │
 │                                                                                                                                    │
 │ Solution - Add Bounds Check:                                                                                                       │
 │ const nextIndex = currentIndex + 1;                                                                                                │
 │ if (nextIndex < PHASE_ORDER.length) {                                                                                              │
 │   const nextPhase = PHASE_ORDER[nextIndex]; // Type inferred correctly                                                             │
 │ } else {                                                                                                                           │
 │   // Handle end of flow                                                                                                            │
 │ }                                                                                                                                  │
 │                                                                                                                                    │
 │ Or use array at() method which supports bounds:                                                                                    │
 │ const nextPhase = PHASE_ORDER.at(currentIndex + 1);                                                                                │
 │                                                                                                                                    │
 │ 4.3 Notification and Analytics Row Casting                                                                                         │
 │                                                                                                                                    │
 │ Files:                                                                                                                             │
 │ - src/notifications/digest.ts - Line 47                                                                                            │
 │ - src/notifications/commands.ts - Lines 277, 294                                                                                   │
 │ - src/engagement/tracker.ts - Multiple row casts                                                                                   │
 │ - src/engagement/config.ts - Multiple row casts                                                                                    │
 │                                                                                                                                    │
 │ Solution - Use drizzle-zod Inferred Types:                                                                                         │
 │                                                                                                                                    │
 │ Replace all rows as unknown as SomeType with proper schema types:                                                                  │
 │ import { notifications, type NotificationRow } from "../../core/db/schema-zod";                                                    │
 │                                                                                                                                    │
 │ // Query result is already typed                                                                                                   │
 │ const notificationRows = await db.select().from(notifications);                                                                    │
 │ // Type is NotificationRow[], no cast needed                                                                                       │
 │                                                                                                                                    │
 │ Implementation Order                                                                                                               │
 │                                                                                                                                    │
 │ 1. Setup Phase:                                                                                                                    │
 │   - Add drizzle-zod to dependencies                                                                                                │
 │   - Generate Zod schemas from Drizzle                                                                                              │
 │   - Verify generated types                                                                                                         │
 │ 2. Type Imports Migration:                                                                                                         │
 │   - Replace manual type imports with schema-zod imports                                                                            │
 │   - Update function signatures to use inferred types                                                                               │
 │ 3. Schema Fixes:                                                                                                                   │
 │   - Fix enum column types in schema (where missing)                                                                                │
 │   - Define proper metadata type if needed                                                                                          │
 │   - Run drizzle-zod regeneration after schema changes                                                                              │
 │ 4. Code Updates by File:                                                                                                           │
 │   - Platform clients (API response handling)                                                                                       │
 │   - Analytics/learning (row types, array defaults)                                                                                 │
 │   - Series/engagement (inferred types)                                                                                             │
 │   - Minor fixes (JSON parsing, array access)                                                                                       │
 │ 5. Cleanup:                                                                                                                        │
 │   - Remove unused manual type definitions                                                                                          │
 │   - Remove now-unnecessary casts                                                                                                   │
 │                                                                                                                                    │
 │ Critical Files to Modify                                                                                                           │
 │                                                                                                                                    │
 │ Configuration:                                                                                                                     │
 │                                                                                                                                    │
 │ 1. package.json - Add drizzle-zod dependency                                                                                       │
 │                                                                                                                                    │
 │ Schema:                                                                                                                            │
 │                                                                                                                                    │
 │ 2. src/core/db/schema.ts - Fix enum types, define proper metadata type                                                             │
 │                                                                                                                                    │
 │ Generated (Phase 1):                                                                                                               │
 │                                                                                                                                    │
 │ 3. src/core/db/schema-zod.ts - Auto-generated by drizzle-zod                                                                       │
 │                                                                                                                                    │
 │ Core Types (Phase 2):                                                                                                              │
 │                                                                                                                                    │
 │ 4. src/platforms/x/client.ts - API response handling                                                                               │
 │ 5. src/platforms/linkedin/client.ts - API response handling                                                                        │
 │ 6. src/platforms/instagram/client.ts - API response handling                                                                       │
 │ 7. src/platforms/tiktok/client.ts - API response handling                                                                          │
 │ 8. src/content/format-picker.ts - Use satisfies assertion                                                                          │
 │ 9. src/team/members.ts - Use inferred types                                                                                        │
 │                                                                                                                                    │
 │ Analytics & Learning (Phase 3):                                                                                                    │
 │                                                                                                                                    │
 │ 10. src/analytics/collector.ts - Use PostMetadata type                                                                             │
 │ 11. src/analytics/review.ts - Use inferred types                                                                                   │
 │ 12. src/learning/feedback.ts - Use inferred types                                                                                  │
 │ 13. src/learning/preference-model.ts - Use inferred types                                                                          │
 │ 14. src/learning/locks.ts - Use inferred types                                                                                     │
 │ 15. src/engagement/tracker.ts - Use inferred types                                                                                 │
 │ 16. src/engagement/config.ts - Use inferred types                                                                                  │
 │                                                                                                                                    │
 │ Other (Phase 4):                                                                                                                   │
 │                                                                                                                                    │
 │ 17. src/series/episodes.ts - Use inferred types                                                                                    │
 │ 18. src/approval/calendar.ts - Use PostMetadata type                                                                               │
 │ 19. src/trigger/publish-post.ts - Use PostMetadata type                                                                            │
 │ 20. src/notifications/digest.ts - Use inferred types                                                                               │
 │ 21. src/notifications/commands.ts - Use inferred types                                                                             │
 │ 22. src/notifications/dispatcher.ts - Use inferred types                                                                           │
 │ 23. src/cli/post.ts - Use Zod for JSON parsing                                                                                     │
 │ 24. src/voice/interview.ts - Fix phase array access                                                                                │
 │ 25. src/learning/adjustments.ts - Use Zod schema for YAML                                                                          │
 │                                                                                                                                    │
 │ Verification                                                                                                                       │
 │                                                                                                                                    │
 │ 1. Install dependencies and generate schema:                                                                                       │
 │ bun install                                                                                                                        │
 │ bun run db:schema:generate                                                                                                         │
 │ 2. Run bun typecheck - should pass with zero errors                                                                                │
 │ 3. Run bun lint - ensure no new linting issues                                                                                     │
 │ 4. Verify type safety:                                                                                                             │
 │   - No as casts remain except as const satisfies                                                                                   │
 │   - All database operations use inferred types from schema-zod                                                                     │
 │   - API responses use proper Zod validation                                                                                        │
 │                                                                                                                                    │
 │ Benefits                                                                                                                           │
 │                                                                                                                                    │
 │ - Single Source of Truth: Drizzle schema is the authoritative type source                                                          │
 │ - TypeScript Inference: Compiler infers correct types automatically                                                                │
 │ - Runtime Validation: Zod schemas provide runtime type checking                                                                    │
 │ - Maintainability: Schema changes propagate to types automatically                                                                 │
 │ - Safety: No more "trust me" casts - all types are verified                                                                        │
 │                                                                                                                                    │
 │ Notes                                                                                                                              │
 │                                                                                                                                    │
 │ - drizzle-zod generates Zod schemas from Drizzle table definitions                                                                 │
 │ - This eliminates the need for manual type duplication                                                                             │
 │ - When schema changes, regenerate types - everything stays in sync                                                                 │
 │ - Using as const satisfies for compile-time validation where needed                                                                │
 │ - Avoiding manual interface definitions that duplicate schema                                                                      │
 │                                                                                                                                    │
 │ Acceptable Type Assertions (Keep These)                                                                                            │
 │                                                                                                                                    │
 │ The following as const or as const satisfies assertions are acceptable and should NOT be changed:                                  │
 │ - Any as const satisfies patterns (compile-time only, no runtime cast)                                                             │
 │ - Any const definitions where the value is truly known at compile time                                                             │
 │                                                                                                                                    │
 │ Excluded Files (Low Priority / Intentional)                                                                                        │
 │                                                                                                                                    │
 │ - src/content/topic-suggest.ts - String literal to enum casts (may be intentional for type guard flexibility)
