# Architecture Patterns

**Domain:** CLI-first social media automation system (Claude Code commands + Trigger.dev Cloud + Neon Postgres)
**Researched:** 2026-02-18

## Recommended Architecture

The system has three execution contexts with distinct boundaries:

```
LOCAL (Claude Code)                    CLOUD (Trigger.dev)              DATABASE (Neon Postgres)
========================              ========================          ========================
.claude/commands/psn/*.md             trigger/tasks/*.ts                Personal Hub DB
config/*.yaml, *.env                  (deployed per Hub)                Company Hub DB(s)
content/drafts/, media/
trigger/ (source, not runtime)        Runs in Trigger.dev Cloud         Accessed by both contexts
                                      workers                           via connection string
```

### The Three Boundaries

**1. Command Context (Local, Synchronous)**
Claude Code reads `.md` prompt templates and executes them. Commands read local config files, query Hub databases directly (via Drizzle ORM over Neon's HTTP driver), call AI APIs, present information to the user, and write results back to DB or local files. Commands are the human-in-the-loop layer -- nothing posts without user approval here.

**2. Task Context (Cloud, Asynchronous)**
Trigger.dev tasks run in the cloud on scheduled crons or delayed runs. They have no access to the local filesystem. They read config from environment variables and the database. Tasks handle the automated backend: posting to platform APIs, collecting analytics, refreshing tokens, monitoring engagement, sending notifications.

**3. Database Context (Shared State)**
Neon Postgres is the bridge between local commands and cloud tasks. Commands write posts to the DB; tasks read them and publish. Tasks write analytics; commands read them for reports. The DB is the single source of truth for all operational data.

### Key Insight: Same Codebase, Multiple Deployments

The `trigger/` directory contains task definitions deployed to **each Hub's Trigger.dev project** with different environment variables. Personal Hub and Company Hub run the same task code but connect to different databases and platform credentials. This is a deployment concern, not a code concern.

```
trigger/
  tasks/
    post-scheduler.ts        # Delayed run: publish post at scheduled time
    analytics-collector.ts   # Cron: daily metrics pull
    trend-collector.ts       # Cron: daily + periodic intelligence gathering
    trend-alerter.ts         # Event: fires after trend-collector
    engagement-monitor.ts    # Cron: every 5-15 min during active hours
    token-refresher.ts       # Cron: daily OAuth token check
    notifier.ts              # Event: send WhatsApp/email notifications
    whatsapp-handler.ts      # Webhook: incoming WhatsApp messages
  lib/
    platforms/               # Platform abstraction layer
      types.ts               # Shared interfaces
      x.ts                   # X/Twitter adapter
      linkedin.ts            # LinkedIn adapter
      instagram.ts           # Instagram adapter
      tiktok.ts              # TikTok adapter
      index.ts               # Factory: getPlatformAdapter(platform)
    db/
      schema.ts              # Drizzle schema (shared between commands and tasks)
      connection.ts          # Database connection factory
      queries/               # Reusable query functions
        posts.ts
        analytics.ts
        ideas.ts
        tokens.ts
        trends.ts
    oauth/
      manager.ts             # Token read/refresh/encrypt logic
      providers/             # Per-platform OAuth specifics
    notifications/
      whatsapp.ts            # WAHA/Twilio client
      scoring.ts             # Relevance scoring for alerts
    media/
      uploader.ts            # Platform-specific media upload flows
  trigger.config.ts          # Trigger.dev project configuration
```

## Component Boundaries

### Component Map

| Component | Responsibility | Communicates With | Runs In |
|-----------|---------------|-------------------|---------|
| **Slash Commands** (`.claude/commands/psn/`) | User interaction, AI generation, human-in-the-loop approval | DB (read/write), local files (read/write), AI APIs | Local (Claude Code) |
| **Platform Adapters** (`trigger/lib/platforms/`) | Normalize posting, analytics, and engagement APIs across X/LinkedIn/IG/TikTok | Platform APIs, OAuth Manager | Both (imported by tasks AND commands) |
| **Database Layer** (`trigger/lib/db/`) | Schema definition, connection management, reusable queries | Neon Postgres | Both (imported by tasks AND commands) |
| **OAuth Manager** (`trigger/lib/oauth/`) | Token storage, encryption/decryption, refresh logic | DB (oauth_tokens table), Platform OAuth endpoints | Both |
| **Trigger.dev Tasks** (`trigger/tasks/`) | Automated backend: posting, analytics, monitoring, notifications | DB, Platform Adapters, OAuth Manager, Notifier | Cloud (Trigger.dev) |
| **Notification System** (`trigger/lib/notifications/`) | WhatsApp/email delivery, relevance scoring | WAHA/Twilio, DB (whatsapp_sessions) | Cloud (Trigger.dev) |
| **Local Config** (`config/`) | Strategy, voice profiles, series definitions, credentials | Read by commands (local), credentials used by DB/Trigger.dev connections | Local |

### Critical Boundary Rule

**Commands NEVER call platform APIs directly for posting.** Commands write to the `posts` table in DB, then trigger a delayed run on Trigger.dev. The task reads the post from DB and calls the platform API. This ensures:
- Consistent error handling and retry logic
- Rate limit management in one place
- Audit trail of all API calls
- Posts can be scheduled for the future

**Exception:** Commands CAN call platform APIs for read-only operations during interactive sessions (e.g., `/psn:engage` fetching trending content in real-time, `/psn:review` triggering analytics collection).

## Data Flow

### Flow 1: Content Creation and Publishing

```
User runs /psn:post
        |
        v
[Claude Code reads voice profile, preference model, analytics from DB]
        |
        v
[AI generates post, user reviews/edits]
        |
        v
[Command writes post to Hub DB `posts` table (status: scheduled)]
        |
        v
[Command calls tasks.trigger("post-scheduler", { postId }, { delay: scheduledTime })]
        |
        v
... time passes ...
        |
        v
[Trigger.dev fires post-scheduler task]
        |
        v
[Task reads post from DB, reads OAuth token from DB]
        |
        v
[Task calls Platform Adapter -> upload media -> create post via API]
        |
        v
[Task updates post in DB (status: published, platform_post_id)]
        |
        v
[Task triggers notifier -> WhatsApp: "Your post is live"]
```

### Flow 2: Analytics Collection (Cron)

```
[analytics-collector cron fires daily at 6 AM]
        |
        v
[Task reads all posts with status:published from DB where analytics_last_collected < 24h ago]
        |
        v
[For each platform: read OAuth tokens from DB -> call Platform Adapter -> fetch metrics]
        |
        v
[Write metrics to `analytics` table, update post composite engagement score]
        |
        v
[Score outlier posts (5x above average) -> trigger notifier if viral]
```

### Flow 3: Company Post Approval

```
User runs /psn:post targeting company account
        |
        v
[Command writes post to Company Hub DB (status: pending-approval)]
        |
        v
[Command triggers notifier task on Company Hub -> WhatsApp to approvers]
        |
        v
... approver runs /psn:approve ...
        |
        v
[Command reads pending posts from Company Hub DB]
        |
        v
[Approver approves -> Command updates post status to "approved"]
        |
        v
[Command calls tasks.trigger("post-scheduler", { postId }, { delay: scheduledTime })
 on the Company Hub's Trigger.dev project]
```

### Flow 4: Cross-Hub Read (Brand Ambassador)

```
User runs /psn:post as Brand Ambassador for Acme
        |
        v
[Command reads personal voice profile from local config/voice-profiles/brand-ambassador-acme.yaml]
        |
        v
[Command reads personal preference model from Personal Hub DB]
        |
        v
[Command reads company brand model from Company Hub DB (cross-hub read)]
        |
        v
[AI generates post using combined context]
        |
        v
[Post submitted to Company Hub DB (it is company content)]
```

### Flow 5: Engagement Monitoring

```
[engagement-monitor cron fires every 5-15 min during active hours]
        |
        v
[Task reads user strategy.yaml config from DB (pillars, targeting, caps)]
        |
        v
[For each enabled platform: call Platform Adapter search/trending endpoints]
        |
        v
[Score opportunities: relevance x author_influence x velocity x time_window]
        |
        v
[Score 70+: draft reply options, trigger notifier with push alert]
[Score 60-69: queue for digest or /psn:engage sessions]
[Score <40: discard]
```

## Shared Code Strategy

### The Monorepo Question

This project is NOT a traditional monorepo with multiple apps. It is a single repo with two code consumers:

1. **Claude Code commands** -- read `.md` templates that reference TypeScript library code
2. **Trigger.dev tasks** -- TypeScript files deployed to Trigger.dev Cloud

Both consume the same library code in `trigger/lib/`. The `trigger/` directory is both:
- The Trigger.dev project root (detected by `trigger.config.ts`)
- The shared library for database access, platform adapters, and OAuth management

### How Commands Access Shared Code

Claude Code commands (`.md` files) instruct Claude to use the library code. Claude reads the TypeScript files and uses them as context for generating correct database queries, API calls, etc. The commands do NOT execute TypeScript directly -- Claude interprets the schema and query patterns, then generates the correct operations.

**This means:** The shared library code in `trigger/lib/` serves double duty:
- **For tasks:** Imported and executed at runtime in Trigger.dev Cloud
- **For commands:** Read by Claude as reference for generating correct DB operations and API calls

### Schema as Single Source of Truth

The Drizzle schema in `trigger/lib/db/schema.ts` defines all tables. Both Trigger.dev tasks and Claude Code commands use this same schema definition. Drizzle Kit generates migrations from this schema, and `/psn:setup` runs them.

```typescript
// trigger/lib/db/schema.ts
import { pgTable, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';
import { pgPolicy } from 'drizzle-orm/pg-core';

// Same schema used for both Personal Hub and Company Hub
// The database itself is the isolation boundary, not the schema

export const posts = pgTable.withRLS('posts', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  platform: text('platform').notNull(), // x | linkedin | instagram | tiktok
  status: text('status').notNull(), // draft | scheduled | pending-approval | approved | published | failed
  content: jsonb('content').notNull(), // platform-specific content structure
  mediaUrls: jsonb('media_urls'),
  scheduledFor: timestamp('scheduled_for'),
  publishedAt: timestamp('published_at'),
  platformPostId: text('platform_post_id'),
  triggerRunId: text('trigger_run_id'),
  language: text('language').default('en'), // en | es | both
  persona: text('persona'), // personal | brand_operator | brand_ambassador
  seriesId: text('series_id'),
  compositeScore: integer('composite_score'),
  editDistance: integer('edit_distance'), // tracking for learning loop
});

export const analytics = pgTable.withRLS('analytics', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
  platform: text('platform').notNull(),
  metrics: jsonb('metrics').notNull(), // platform-specific metrics blob
  compositeScore: integer('composite_score'),
});

// ... other tables follow the same pattern
```

## Patterns to Follow

### Pattern 1: Platform Adapter Interface

**What:** A unified interface that each platform implements, hiding API-specific details.
**When:** Any code that interacts with a social media platform's API.
**Why:** Platform APIs are wildly different (multi-step media upload everywhere, different auth flows, different rate limits). The adapter pattern keeps this complexity contained.

```typescript
// trigger/lib/platforms/types.ts
export interface PlatformAdapter {
  readonly platform: 'x' | 'linkedin' | 'instagram' | 'tiktok';

  // Publishing
  createPost(params: CreatePostParams): Promise<PlatformPostResult>;
  uploadMedia(params: UploadMediaParams): Promise<MediaUploadResult>;
  deletePost(platformPostId: string): Promise<void>;

  // Analytics
  getPostMetrics(platformPostId: string): Promise<PostMetrics>;
  getAccountMetrics(dateRange: DateRange): Promise<AccountMetrics>;

  // Engagement (optional -- not all platforms support search)
  searchTrending?(query: TrendingQuery): Promise<TrendingPost[]>;

  // Auth
  refreshToken(refreshToken: string): Promise<TokenPair>;

  // Rate limiting
  getRateLimitStatus(): Promise<RateLimitInfo>;
}

export interface CreatePostParams {
  content: PlatformContent;    // Platform-specific content structure
  mediaIds?: string[];         // Pre-uploaded media references
  scheduledFor?: Date;         // Some platforms support native scheduling (none currently do)
}

// Factory function
export function getPlatformAdapter(
  platform: string,
  credentials: PlatformCredentials
): PlatformAdapter {
  switch (platform) {
    case 'x': return new XAdapter(credentials);
    case 'linkedin': return new LinkedInAdapter(credentials);
    case 'instagram': return new InstagramAdapter(credentials);
    case 'tiktok': return new TikTokAdapter(credentials);
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

**Confidence:** HIGH -- this is standard adapter pattern, well-established in the ecosystem.

### Pattern 2: Database Connection Factory (Multi-Hub)

**What:** A factory that creates Drizzle database instances on-demand for any Hub.
**When:** Tasks and commands need to connect to Personal Hub and/or Company Hub(s).
**Why:** A single user can have 1 Personal Hub + N Company Hubs. Connection strings come from env vars (tasks) or local `.env` files (commands). The factory abstracts this.

```typescript
// trigger/lib/db/connection.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionCache = new Map<string, ReturnType<typeof drizzle>>();

export function getDb(connectionString: string) {
  if (!connectionCache.has(connectionString)) {
    const sql = neon(connectionString);
    connectionCache.set(connectionString, drizzle(sql, { schema }));
  }
  return connectionCache.get(connectionString)!;
}

// For Trigger.dev tasks: reads from env vars
export function getHubDb() {
  return getDb(process.env.DATABASE_URL!);
}

// For commands: reads from local .env files
// Claude reads the appropriate .env file and passes the connection string
export function getPersonalDb(connectionString: string) {
  return getDb(connectionString);
}

export function getCompanyDb(companyName: string, connectionString: string) {
  return getDb(connectionString);
}
```

**Confidence:** HIGH -- Drizzle's `neon-http` driver is designed for this. Multiple `drizzle()` instances with different connection strings is explicitly supported.

### Pattern 3: Trigger.dev Task with Hub-Scoped Configuration

**What:** Tasks that read their configuration from the database, not from local files.
**When:** All Trigger.dev tasks that need strategy config, user preferences, or platform settings.
**Why:** Cloud tasks cannot access the local filesystem. Strategy config needed at runtime must be stored in DB (or env vars for static config).

```typescript
// trigger/tasks/analytics-collector.ts
import { schedules } from "@trigger.dev/sdk/v3";
import { getHubDb } from "../lib/db/connection";
import { getPlatformAdapter } from "../lib/platforms";
import { posts, analytics, oauthTokens } from "../lib/db/schema";
import { eq, and, lt } from "drizzle-orm";

export const analyticsCollector = schedules.task({
  id: "analytics-collector",
  cron: {
    pattern: "0 6 * * *", // Daily at 6 AM
    timezone: "America/New_York",
  },
  run: async () => {
    const db = getHubDb();

    // Get published posts needing analytics update
    const postsToCollect = await db.select()
      .from(posts)
      .where(and(
        eq(posts.status, 'published'),
        lt(posts.analyticsLastCollected, new Date(Date.now() - 24 * 60 * 60 * 1000))
      ));

    for (const post of postsToCollect) {
      // Read token from DB, not env var
      const [token] = await db.select()
        .from(oauthTokens)
        .where(eq(oauthTokens.platform, post.platform));

      const adapter = getPlatformAdapter(post.platform, {
        accessToken: decrypt(token.encryptedAccessToken),
      });

      const metrics = await adapter.getPostMetrics(post.platformPostId!);

      await db.insert(analytics).values({
        id: generateId(),
        postId: post.id,
        platform: post.platform,
        metrics: metrics,
        compositeScore: calculateCompositeScore(metrics),
      });
    }
  },
});
```

**Confidence:** HIGH -- this is how Trigger.dev tasks are designed to work per official documentation.

### Pattern 4: Delayed Run for Post Scheduling

**What:** Using Trigger.dev's `delay` option to schedule posts for future publication.
**When:** User schedules a post through any command.
**Why:** No social media platform offers native scheduling via API. Trigger.dev's delayed runs are the scheduling layer.

```typescript
// Triggered by commands when user schedules a post
import { tasks } from "@trigger.dev/sdk/v3";
import type { postScheduler } from "../tasks/post-scheduler";

// From command context (or another task):
await tasks.trigger<typeof postScheduler>("post-scheduler", {
  postId: "post_abc123",
}, {
  delay: scheduledDate, // Date object or ISO string
});
```

```typescript
// trigger/tasks/post-scheduler.ts
import { task } from "@trigger.dev/sdk/v3";
import { getHubDb } from "../lib/db/connection";
import { getPlatformAdapter } from "../lib/platforms";
import { posts, oauthTokens } from "../lib/db/schema";

export const postScheduler = task({
  id: "post-scheduler",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 60000,
    factor: 2,
  },
  run: async ({ postId }: { postId: string }) => {
    const db = getHubDb();

    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    if (!post || post.status === 'published') return;

    const [token] = await db.select()
      .from(oauthTokens)
      .where(eq(oauthTokens.platform, post.platform));

    const adapter = getPlatformAdapter(post.platform, {
      accessToken: decrypt(token.encryptedAccessToken),
    });

    // Multi-step: upload media first, then create post
    let mediaIds: string[] = [];
    if (post.mediaUrls?.length) {
      for (const url of post.mediaUrls) {
        const result = await adapter.uploadMedia({ url });
        mediaIds.push(result.mediaId);
      }
    }

    const result = await adapter.createPost({
      content: post.content,
      mediaIds,
    });

    await db.update(posts)
      .set({
        status: 'published',
        publishedAt: new Date(),
        platformPostId: result.platformPostId,
      })
      .where(eq(posts.id, postId));
  },
});
```

**Confidence:** HIGH -- `tasks.trigger()` with `delay` is the documented pattern for one-off future execution in Trigger.dev v3.

### Pattern 5: OAuth Token Management

**What:** Encrypted token storage in DB with automatic refresh via cron task.
**When:** Any platform API call that requires authentication.
**Why:** OAuth tokens expire (LinkedIn every 60 days, Instagram tokens expire too). Tokens must be encrypted at rest and refreshed proactively.

```typescript
// trigger/lib/oauth/manager.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptToken(token: string, key: Buffer): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptToken(data: { encrypted: string; iv: string; tag: string }, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(data.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

The encryption key is stored as an environment variable in Trigger.dev (per Hub) and in the local `hub.env`/`connections/*.env` files. The key never goes in the database.

**Confidence:** HIGH -- AES-256-GCM is standard for token encryption at rest.

### Pattern 6: RLS for Multi-Tenant Company Hubs

**What:** Postgres Row-Level Security policies on Company Hub tables so team members only see/modify their own drafts but can read shared data.
**When:** Company Hub database setup.
**Why:** Multiple team members connect to the same Company Hub DB. RLS prevents unauthorized access without application-level access control.

```typescript
// Drizzle schema with RLS policies for Company Hub
import { pgTable, pgPolicy, pgRole, text } from 'drizzle-orm/pg-core';
import { crudPolicy } from 'drizzle-orm/neon';
import { sql } from 'drizzle-orm';

// Role per team member, set via connection parameter
export const teamMember = pgRole('team_member').existing();

export const posts = pgTable.withRLS('posts', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').notNull(),
  status: text('status').notNull(),
  // ... other columns
}, (t) => [
  // Everyone can read all posts (needed for calendar view, duplicate prevention)
  pgPolicy('posts-select-all', {
    for: 'select',
    to: teamMember,
    using: sql`true`,
  }),
  // Only creator can update their own posts (before approval)
  pgPolicy('posts-update-own', {
    for: 'update',
    to: teamMember,
    using: sql`created_by = current_setting('app.user_id')`,
    withCheck: sql`created_by = current_setting('app.user_id')`,
  }),
  // Approvers can update any post (for approval workflow)
  pgPolicy('posts-update-approver', {
    for: 'update',
    to: pgRole('approver').existing(),
    using: sql`true`,
  }),
]);
```

**Confidence:** MEDIUM -- Drizzle's RLS support via `pgTable.withRLS()` and `pgPolicy` is documented. The `current_setting('app.user_id')` pattern requires setting this via `SET LOCAL` in a transaction at connection time, which adds complexity. Neon's `crudPolicy` helper simplifies common cases. Needs validation during implementation.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Operational Data in Local Files

**What:** Putting trends, analytics, post queue, or preference models in local git files.
**Why bad:** Trigger.dev tasks run in the cloud and cannot access local files. Any data that tasks need to read or write MUST be in the database. Local files are only for user-facing config that changes infrequently (strategy, voice profiles, series definitions).
**Instead:** Use the database for all operational data. Local files for configuration only.

### Anti-Pattern 2: Platform API Calls in Commands

**What:** Commands calling `POST` endpoints on platform APIs directly.
**Why bad:** No retry logic, no rate limit management, no audit trail, impossible to schedule for the future. If Claude Code crashes mid-post, there is no recovery.
**Instead:** Commands write to DB, trigger delayed runs. Tasks handle all platform writes.

### Anti-Pattern 3: Shared Trigger.dev Project for Personal + Company

**What:** Running personal and company tasks in the same Trigger.dev project.
**Why bad:** Environment variables would conflict (which DATABASE_URL? which OAuth tokens?). Rate limits and billing would be shared. A company admin leaving breaks personal automation.
**Instead:** Separate Trigger.dev project per Hub. Same task code, different deployment, different env vars.

### Anti-Pattern 4: Passing Secrets in Task Payloads

**What:** Including API keys, tokens, or credentials in the `trigger()` payload.
**Why bad:** Trigger.dev logs payloads and shows them in the dashboard. Secrets become visible.
**Instead:** Tasks read secrets from environment variables or from the database (encrypted tokens).

### Anti-Pattern 5: Monolithic Platform Module

**What:** One giant `platforms.ts` file with if/else chains for each platform.
**Why bad:** Grows uncontrollably as platforms are added. Each platform has radically different media upload flows, rate limits, and content formats.
**Instead:** Adapter pattern with one module per platform implementing a shared interface.

### Anti-Pattern 6: Direct Cross-Hub Database Writes

**What:** A command connected to Company Hub writing to the Personal Hub in the same transaction (or vice versa).
**Why bad:** Cross-database transactions are not supported. Data integrity issues if one write succeeds and the other fails.
**Instead:** Sequential writes with idempotency. Write to one hub, then the other. If the second fails, retry or flag for manual resolution.

## Project Structure (Full)

```
post-shit-now/
  .claude/
    commands/psn/               # Slash command prompt templates (.md)
      setup.md
      post.md
      plan.md
      capture.md
      engage.md
      review.md
      approve.md
      series.md
      config.md
      calendar.md
    settings.json

  config/                       # User configuration (partially gitignored)
    strategy.yaml               # Content strategy, pillars, frequency
    voice-profiles/             # Voice profile YAML files
      personal.yaml
      brand-operator-<company>.yaml
      brand-ambassador-<company>.yaml
    series/                     # Content series definitions
      <series-name>.yaml
    company/                    # Company-specific config
      <company>.yaml
    keys.env                    # API keys (GITIGNORED)
    hub.env                     # Personal Hub credentials (GITIGNORED)
    connections/                # Company Hub credentials (GITIGNORED)
      <company>.env

  content/                      # User content workspace
    drafts/                     # Work in progress (auto-pruned 14d after publish)
    media/                      # Images, videos (auto-pruned 7d after posting)
    intelligence/               # Competitive intel YAML

  analytics/
    reports/                    # Generated analysis reports (Markdown)

  trigger/                      # Trigger.dev project root
    trigger.config.ts           # Trigger.dev configuration
    package.json                # Dependencies for tasks + shared lib
    tsconfig.json

    tasks/                      # Trigger.dev task definitions
      post-scheduler.ts
      analytics-collector.ts
      trend-collector.ts
      trend-alerter.ts
      engagement-monitor.ts
      token-refresher.ts
      notifier.ts
      whatsapp-handler.ts

    lib/                        # Shared library (used by tasks + read by commands)
      platforms/
        types.ts                # PlatformAdapter interface + shared types
        x.ts                    # X/Twitter implementation
        linkedin.ts             # LinkedIn implementation
        instagram.ts            # Instagram implementation
        tiktok.ts               # TikTok implementation
        index.ts                # Factory: getPlatformAdapter()
        rate-limiter.ts         # Per-platform rate limit tracking

      db/
        schema.ts               # Drizzle schema (all tables)
        connection.ts           # Database connection factory
        migrate.ts              # Migration runner (for /psn:setup)
        queries/                # Reusable query modules
          posts.ts              # CRUD + status transitions
          analytics.ts          # Metrics insert + aggregate queries
          ideas.ts              # Idea pipeline operations
          tokens.ts             # OAuth token CRUD (encrypted)
          trends.ts             # Trend storage + retrieval
          series.ts             # Series operational data
          preferences.ts        # Preference model read/write
          team.ts               # Team member management (company only)
          whatsapp.ts           # WhatsApp session state

      oauth/
        manager.ts              # Token encrypt/decrypt, refresh orchestration
        providers/
          x.ts                  # X OAuth2 PKCE specifics
          linkedin.ts           # LinkedIn OAuth2 (60-day expiry)
          instagram.ts          # Instagram/Meta OAuth2
          tiktok.ts             # TikTok OAuth2

      notifications/
        whatsapp.ts             # WAHA/Twilio client abstraction
        email.ts                # Email fallback (future)
        scoring.ts              # Relevance scoring engine
        state-machine.ts        # WhatsApp conversation state management

      media/
        uploader.ts             # Multi-step media upload orchestration
        generators/             # AI media generation wrappers
          image.ts              # GPT Image, Ideogram, Flux
          video.ts              # Kling, Runway, Pika

      scoring/
        engagement.ts           # Composite engagement score calculator
        opportunity.ts          # Engagement opportunity scorer

      utils/
        id.ts                   # ID generation (nanoid or similar)
        retry.ts                # Generic retry with backoff
        encryption.ts           # AES-256-GCM encrypt/decrypt

    drizzle/                    # Generated migration files
      0000_initial.sql
      meta/

  CLAUDE.md                     # Project instructions for Claude Code
  .gitignore                    # keys.env, hub.env, connections/*.env, node_modules/
  package.json                  # Root package.json (workspace config if needed)
```

## Database Schema Design

### Personal Hub Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `posts` | Content queue + published archive | id, status, platform, content, scheduled_for, published_at, composite_score |
| `analytics` | Per-post metrics history | post_id, platform, metrics (JSONB), composite_score, collected_at |
| `ideas` | Personal idea bank | id, stage, urgency, title, thesis, suggested_platforms, expires_at |
| `preference_models` | Learning loop state | id, updated_at, voice_learnings, platform_learnings, pillar_performance (all JSONB) |
| `series` | Series operational data | id, slug, installments_published, last_published, next_due, avg_engagement |
| `oauth_tokens` | Encrypted platform tokens | platform, encrypted_access_token, encrypted_refresh_token, expires_at |
| `trends` | Trend intelligence snapshots | id, source, title, relevance_score, content_angles, collected_at, expires_at |
| `whatsapp_sessions` | Conversation state | user_id, state, active_notification, pending_items, last_interaction |

### Company Hub Tables (Same Schema + Additions)

All tables above (except `whatsapp_sessions` and `preference_models`) plus:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `team_members` | Who can post/approve | user_id, role (member/approver/admin), joined_at, invite_code_used |
| `brand_preferences` | Shared brand learning | Same structure as preference_models but company-scoped |

### Schema Sharing Strategy

One schema definition, two deployment targets. The schema file defines all tables. During migration:
- Personal Hub runs migrations but skips `team_members` and `brand_preferences` tables
- Company Hub runs all migrations

Implementation: use a migration flag or separate migration configs per hub type.

**Alternative (simpler):** Run all migrations on both hubs. Personal Hub has empty `team_members` and `brand_preferences` tables that are never used. Simpler code, negligible storage cost.

**Recommendation:** Use the simpler approach (all tables everywhere). The cost of empty tables is zero, and the complexity of conditional migrations is not worth it.

## Trigger.dev Configuration

```typescript
// trigger/trigger.config.ts
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF!, // Different per Hub
  dirs: ["./tasks"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 60000,
      factor: 2,
    },
  },
  build: {
    // Neon serverless driver is bundled automatically
    // No external packages needed for this setup
  },
});
```

### Environment Variables Per Hub

| Variable | Personal Hub | Company Hub |
|----------|-------------|-------------|
| `DATABASE_URL` | Personal Neon connection string | Company Neon connection string |
| `TRIGGER_PROJECT_REF` | Personal project ref | Company project ref |
| `ENCRYPTION_KEY` | Personal encryption key | Company encryption key |
| `WAHA_URL` | WAHA endpoint (if configured) | WAHA endpoint (if configured) |
| `WHATSAPP_NUMBER` | User's number | Company notification number |

Platform API keys (X, LinkedIn, etc.) are NOT stored as env vars. They live encrypted in the `oauth_tokens` table, managed by the `token-refresher` task.

## Scalability Considerations

| Concern | 1 User | 10 Users (Small Team) | 100+ Users (Agency) |
|---------|--------|----------------------|---------------------|
| **Database** | Neon free tier (512MB) | Neon free tier still fine | Neon Scale ($19/mo per Hub) |
| **Trigger.dev** | Free tier (10 schedules) | Hobby tier (~$30/mo per Hub) | Pro tier per Hub |
| **API Rate Limits** | No concern | Per-platform limits apply | Instagram 200 req/hr is the bottleneck; batch + backoff |
| **Cross-Hub Reads** | N/A | 1-2 Company Hubs per user | Many connection strings to manage |
| **Media Storage** | Local git, auto-prune | Local git works | Future: S3/R2 migration needed |

## Suggested Build Order (Dependencies)

The build order is dictated by component dependencies:

### Foundation Layer (Must Build First)

1. **Database schema + connection factory** -- Everything depends on this
2. **Drizzle migrations infrastructure** -- Needed by `/psn:setup`
3. **OAuth token management** (encrypt/decrypt/store) -- Needed before any platform API call

### Core Layer (Build Second)

4. **Platform adapter: X** -- Simplest API, first platform. Just the posting + analytics subset.
5. **post-scheduler task** -- The core delayed-run publishing mechanism
6. **`/psn:setup` command** -- Creates Personal Hub, deploys tasks, runs migrations
7. **`/psn:post` command** -- The primary user workflow

### Intelligence Layer (Build Third)

8. **analytics-collector task** -- Daily cron for metrics
9. **Idea bank (DB schema + queries)** -- Needed by `/psn:plan`
10. **trend-collector task** -- Intelligence gathering
11. **Platform adapter: LinkedIn** -- Second platform (requires token-refresher)
12. **token-refresher task** -- Needed as soon as LinkedIn is added

### Company Layer (Build Fourth)

13. **Company Hub setup flow** (invite codes, team_members, RLS policies)
14. **Brand voice profiles** (brand-operator, brand-ambassador)
15. **Approval workflow** (`/psn:approve`, notification to approvers)
16. **Cross-Hub reads** for Brand Ambassador posting

### Engagement + Notifications Layer (Build Fifth)

17. **Notification system** (WAHA/Twilio client, relevance scoring)
18. **engagement-monitor task** -- Requires notification system
19. **whatsapp-handler task** -- Requires notification system + state machine
20. **Platform adapters: Instagram, TikTok** -- Later platforms

### Refinement Layer (Build Last)

21. **Advanced learning loop** (fatigue detection, autonomous adjustments)
22. **`/psn:review` command** -- Needs analytics data to exist first
23. **Content series management** (`/psn:series`)
24. **Employee advocacy features**

## Sources

- [Trigger.dev trigger.config.ts reference](https://trigger.dev/docs/config/config-file) -- HIGH confidence
- [Trigger.dev manual setup and project structure](https://trigger.dev/docs/manual-setup) -- HIGH confidence
- [Trigger.dev scheduled tasks and cron](https://trigger.dev/docs/tasks/scheduled) -- HIGH confidence
- [Trigger.dev task triggering with delay](https://trigger.dev/docs/triggering) -- HIGH confidence
- [Trigger.dev environment variables](https://trigger.dev/docs/deploy-environment-variables) -- HIGH confidence
- [Trigger.dev monorepo discussion](https://github.com/triggerdotdev/trigger.dev/discussions/1279) -- MEDIUM confidence
- [Drizzle ORM with Neon Postgres](https://orm.drizzle.team/docs/connect-neon) -- HIGH confidence
- [Drizzle ORM RLS documentation](https://orm.drizzle.team/docs/rls) -- HIGH confidence
- [Neon RLS with Drizzle guide](https://neon.com/docs/guides/rls-drizzle) -- HIGH confidence
- [Neon RLS authorization modeling](https://neon.com/blog/modelling-authorization-for-a-social-network-with-postgres-rls-and-drizzle-orm) -- MEDIUM confidence
- [Drizzle multi-database connections](https://orm.drizzle.team/docs/connect-overview) -- HIGH confidence
- [Drizzle schema migrations with Neon](https://neon.com/docs/guides/drizzle-migrations) -- HIGH confidence
