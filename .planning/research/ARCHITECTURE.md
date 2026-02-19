# Architecture Research

**Domain:** CLI-first social media automation with background task processing
**Researched:** 2026-02-18
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER'S MACHINE (Claude Code)                      │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐   │
│  │  Slash Commands   │    │  Local Workspace (Git)               │   │
│  │  .claude/commands │────│  config/, content/, analytics/       │   │
│  │  /psn:post        │    │  Voice profiles, drafts, media       │   │
│  │  /psn:plan        │    └──────────────────────────────────────┘   │
│  │  /psn:review      │                                               │
│  │  /psn:setup       │    ┌──────────────────────────────────────┐   │
│  │  /psn:engage      │    │  Shared Library (@psn/core)          │   │
│  │  /psn:capture     │────│  DB schemas, API clients, types      │   │
│  │  /psn:approve     │    │  Hub connector, token manager        │   │
│  │  /psn:series      │    └─────────────┬────────────────────────┘   │
│  │  /psn:config      │                  │                            │
│  │  /psn:calendar    │                  │ import shared code         │
│  └────────┬─────────┘                  │                            │
│           │                             │                            │
│           │ Claude reads commands,      │                            │
│           │ executes TS scripts         │                            │
│           │ via tool_use / Bash         │                            │
│           ▼                             ▼                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CLI Scripts (src/cli/)                                      │   │
│  │  Thin wrappers that commands invoke via `npx tsx`            │   │
│  │  ├── queue-post.ts      # Insert post into hub DB            │   │
│  │  ├── trigger-task.ts    # Fire Trigger.dev task via SDK      │   │
│  │  ├── query-analytics.ts # Read analytics from hub DB         │   │
│  │  ├── manage-ideas.ts    # CRUD on idea bank                  │   │
│  │  └── hub-status.ts      # Check hub connectivity             │   │
│  └──────────┬──────────────────────────────┬────────────────────┘   │
│             │                              │                         │
└─────────────┼──────────────────────────────┼─────────────────────────┘
              │                              │
              │ Trigger.dev SDK              │ Drizzle ORM
              │ (tasks.trigger())            │ (direct DB queries)
              │                              │
   ┌──────────▼─────────────┐    ┌──────────▼─────────────────────┐
   │  Trigger.dev Cloud      │    │  Neon Postgres                  │
   │                         │    │                                  │
   │  Personal Project:      │    │  Personal Hub DB:                │
   │  ├── post-scheduler     │◄──►│  ├── posts (content queue)      │
   │  ├── analytics-collector│    │  ├── analytics                   │
   │  ├── trend-collector    │    │  ├── ideas                       │
   │  ├── trend-alerter      │    │  ├── preference_models           │
   │  ├── engagement-monitor │    │  ├── series                      │
   │  ├── token-refresher    │    │  ├── oauth_tokens (encrypted)    │
   │  ├── notifier           │    │  ├── trends                      │
   │  └── whatsapp-handler   │    │  └── whatsapp_sessions           │
   │                         │    │                                  │
   │  Company Project(s):    │    │  Company Hub DB(s):              │
   │  (same task set minus   │◄──►│  (same schema + team_members     │
   │   whatsapp, plus        │    │   + brand_preferences)           │
   │   approval workflow)    │    │  RLS enforced per team member    │
   └────────────┬────────────┘    └──────────────────────────────────┘
                │
                │ Platform API calls
                ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  Social Media APIs + Intelligence APIs                       │
   │  ├── X (Twitter) API          ├── Perplexity Sonar          │
   │  ├── LinkedIn API             ├── Exa API                    │
   │  ├── Instagram Graph API      ├── Tavily API                 │
   │  ├── TikTok API               ├── HN Algolia, Reddit API    │
   │  └── WhatsApp (WAHA/Twilio)   └── RSS feeds, Google Trends  │
   └─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Slash Commands** (.md files) | Prompt templates that guide Claude through workflows (post creation, planning, review). They instruct Claude to read local files, call CLI scripts, and present results. | Markdown files with structured prompts. Claude interprets and orchestrates. |
| **CLI Scripts** (src/cli/) | Thin executable scripts that commands invoke via `npx tsx`. Bridge between Claude's tool_use and the hub infrastructure. Each script does ONE thing. | TypeScript files using shared library. Invoked by Claude via Bash tool. |
| **Shared Library** (@psn/core) | Single source of truth for DB schemas, API clients, types, and hub connection logic. Used by both CLI scripts and Trigger.dev tasks. | pnpm workspace package. Drizzle schemas, Zod validators, typed API wrappers. |
| **Trigger.dev Tasks** | Background automation: scheduled posting, analytics collection, trend monitoring, token refresh, notifications. Run on Trigger.dev Cloud. | TypeScript tasks using @trigger.dev/sdk/v3. Import shared library for DB access and API calls. |
| **Neon Postgres** | Persistent storage for all queryable data: content queue, analytics, ideas, preferences, tokens, trends. | Managed Postgres with Drizzle ORM. RLS on company hubs for team member isolation. |
| **Local Workspace** (Git) | User-specific files that don't need to be queryable: drafts, media, voice profiles, strategy config, series definitions. | YAML/Markdown files in the cloned repo. Gitignored secrets in config/*.env. |

## Recommended Project Structure

```
post-shit-now/
├── .claude/
│   ├── commands/
│   │   └── psn/                    # All slash commands
│   │       ├── post.md
│   │       ├── plan.md
│   │       ├── capture.md
│   │       ├── engage.md
│   │       ├── review.md
│   │       ├── approve.md
│   │       ├── series.md
│   │       ├── config.md
│   │       ├── setup.md
│   │       └── calendar.md
│   └── settings.json
│
├── packages/
│   └── core/                       # @psn/core — shared library
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts            # Public API barrel export
│       │   ├── db/
│       │   │   ├── schema.ts       # All Drizzle table definitions
│       │   │   ├── schema-personal.ts  # Personal hub-only tables
│       │   │   ├── schema-company.ts   # Company hub-only tables
│       │   │   ├── schema-shared.ts    # Tables in both hubs
│       │   │   ├── rls.ts          # RLS policy definitions
│       │   │   ├── migrate.ts      # Migration runner
│       │   │   └── connection.ts   # Hub connector (reads env, returns db client)
│       │   ├── api/
│       │   │   ├── x.ts            # X (Twitter) API client
│       │   │   ├── linkedin.ts     # LinkedIn API client
│       │   │   ├── instagram.ts    # Instagram API client
│       │   │   ├── tiktok.ts       # TikTok API client
│       │   │   ├── intelligence.ts # Perplexity, Exa, Tavily wrappers
│       │   │   └── notifications.ts # WhatsApp/notification dispatch
│       │   ├── types/
│       │   │   ├── post.ts         # Post types, status enums
│       │   │   ├── idea.ts         # Idea types, stage enums
│       │   │   ├── analytics.ts    # Analytics types
│       │   │   └── hub.ts          # Hub connection types
│       │   ├── oauth/
│       │   │   ├── manager.ts      # Token encrypt/decrypt, storage
│       │   │   └── refresh.ts      # Platform-specific refresh logic
│       │   └── utils/
│       │       ├── platform.ts     # Platform-aware helpers
│       │       └── rate-limit.ts   # Rate limiter with backoff
│       └── drizzle/
│           └── migrations/         # Generated migration files
│
├── src/
│   ├── cli/                        # CLI scripts (commands invoke these)
│   │   ├── queue-post.ts           # Insert/update post in hub DB
│   │   ├── trigger-task.ts         # Trigger a Trigger.dev task
│   │   ├── query-analytics.ts      # Read analytics, generate reports
│   │   ├── manage-ideas.ts         # CRUD operations on idea bank
│   │   ├── hub-status.ts           # Check connectivity, run migrations
│   │   ├── manage-series.ts        # Series CRUD
│   │   ├── oauth-flow.ts           # Interactive OAuth (open browser, receive callback)
│   │   └── setup-hub.ts            # Hub provisioning (Neon + Trigger.dev)
│   │
│   └── trigger/                    # Trigger.dev task definitions
│       ├── trigger.config.ts       # Trigger.dev project config
│       ├── tasks/
│       │   ├── post-scheduler.ts   # Execute scheduled posts via platform APIs
│       │   ├── analytics-collector.ts  # Cron: fetch analytics from platforms
│       │   ├── trend-collector.ts  # Cron: gather trends from intelligence sources
│       │   ├── trend-alerter.ts    # Evaluate trends against pillars, notify
│       │   ├── engagement-monitor.ts   # Monitor replies, mentions
│       │   ├── token-refresher.ts  # Cron: refresh expiring OAuth tokens
│       │   ├── notifier.ts         # Dispatch notifications (WhatsApp, etc.)
│       │   └── whatsapp-handler.ts # Inbound WhatsApp message processing
│       └── shared/
│           ├── middleware.ts        # DB connection middleware for tasks
│           └── hub-context.ts      # Resolve which hub a task operates on
│
├── config/                         # User's local configuration
│   ├── keys.env                    # API keys (gitignored)
│   ├── hub.env                     # Personal Hub credentials (gitignored)
│   ├── connections/                # Company Hub connections (gitignored)
│   │   └── <company>.env
│   ├── strategy.yaml               # Content pillars, frequency, goals
│   ├── voice-profiles/
│   │   ├── personal.yaml
│   │   ├── brand-operator-<company>.yaml
│   │   └── brand-ambassador-<company>.yaml
│   ├── series/
│   │   └── <series-name>.yaml
│   └── company/
│       └── <company>.yaml
│
├── content/
│   ├── drafts/                     # Work in progress
│   ├── media/                      # Images, videos, assets
│   └── intelligence/
│       └── competitive-intel.yaml
│
├── analytics/
│   └── reports/                    # Generated markdown reports
│
├── pnpm-workspace.yaml            # Workspace: packages/core
├── package.json                    # Root package.json
├── tsconfig.json                   # Root TypeScript config
├── drizzle.config.ts               # Drizzle Kit config (points to packages/core)
├── CLAUDE.md                       # Project instructions for Claude
└── .gitignore                      # Ignores *.env, .trigger/, node_modules/
```

### Structure Rationale

- **packages/core/:** Single shared library consumed by both CLI scripts and Trigger.dev tasks. This is the critical design decision -- without it, you duplicate DB schemas, API clients, and types across two separate codebases. Trigger.dev v3 bundles all dependencies automatically, so importing from a workspace package works seamlessly in deployed tasks.

- **src/cli/:** Thin scripts that Claude commands invoke via `npx tsx src/cli/<script>.ts`. Each script does exactly one thing (queue a post, query analytics, trigger a task). Commands compose these scripts into workflows. This keeps commands (markdown) declarative and scripts (TypeScript) imperative.

- **src/trigger/:** Trigger.dev task definitions. These are the background workers. They import from @psn/core for all DB and API access. Deployed to Trigger.dev Cloud via `npx trigger.dev deploy`.

- **config/:** All user-specific configuration. YAML over JSON because voice profiles and strategy configs are human-edited. Environment files are gitignored.

## Architectural Patterns

### Pattern 1: Command-Script-Hub Pipeline

**What:** Commands (markdown) instruct Claude to invoke CLI scripts (TypeScript) that interact with hubs (Neon + Trigger.dev). Commands never talk to infrastructure directly.

**When to use:** Every command interaction.

**Trade-offs:** Adds a script layer, but keeps commands declarative and testable. Claude can read script output and make decisions. Scripts are deterministic while commands are flexible.

**Example:**
```markdown
<!-- .claude/commands/psn/calendar.md -->
Read the user's hub configuration from config/hub.env.
Run `npx tsx src/cli/query-analytics.ts --hub personal --query upcoming-posts`
to get the next 7 days of scheduled posts.
Present the results as a formatted calendar.
If the user wants to reschedule, run
`npx tsx src/cli/queue-post.ts --hub personal --action reschedule --post-id <id> --new-time <time>`
```

```typescript
// src/cli/query-analytics.ts
import { createHubConnection } from '@psn/core';
import { posts } from '@psn/core/db/schema';
import { gte } from 'drizzle-orm';

const hub = await createHubConnection(args.hub);
const upcoming = await hub.db
  .select()
  .from(posts)
  .where(gte(posts.scheduledAt, new Date()));

console.log(JSON.stringify(upcoming, null, 2));
// Claude reads this output and formats it for the user
```

### Pattern 2: Hub Connector with Environment Resolution

**What:** A single `createHubConnection()` function that reads the appropriate .env file and returns a typed Drizzle client. Personal hub reads `config/hub.env`. Company hubs read `config/connections/<company>.env`. The connection includes both the DB client and the Trigger.dev secret key for that hub.

**When to use:** Every script and task that needs hub access.

**Trade-offs:** Simple and predictable. One function, one responsibility. The alternative (passing connection strings everywhere) leads to credential sprawl.

**Example:**
```typescript
// packages/core/src/db/connection.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

export interface HubConnection {
  db: ReturnType<typeof drizzle>;
  triggerKey: string;
  hubType: 'personal' | 'company';
  hubName: string;
}

export async function createHubConnection(
  hubRef: string  // 'personal' or company name
): Promise<HubConnection> {
  const envPath = hubRef === 'personal'
    ? 'config/hub.env'
    : `config/connections/${hubRef}.env`;

  const env = await loadEnvFile(envPath);

  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  return {
    db,
    triggerKey: env.TRIGGER_SECRET_KEY,
    hubType: hubRef === 'personal' ? 'personal' : 'company',
    hubName: hubRef,
  };
}
```

### Pattern 3: Shared Schema, Separate Databases

**What:** Both personal and company hubs use the same Drizzle schema definitions from @psn/core, but each hub is a separate Neon database. Tables shared across both hubs (posts, analytics, ideas, series, oauth_tokens, trends) use identical schemas. Company hubs add extra tables (team_members, brand_preferences). RLS policies only apply to company hub tables.

**When to use:** Schema definition and migration.

**Trade-offs:** Schema duplication is avoided completely. The tradeoff is that company-only tables exist in the schema but are not migrated to personal hubs. Drizzle Kit handles this with separate migration configs.

**Example:**
```typescript
// packages/core/src/db/schema-shared.ts
// These tables exist in BOTH personal and company hubs
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').notNull(),
  platform: text('platform').notNull(),  // x|linkedin|instagram|tiktok
  status: text('status').notNull(),       // draft|scheduled|pending-approval|approved|published|failed
  content: jsonb('content').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  triggerRunId: text('trigger_run_id'),   // Links to Trigger.dev delayed run
  language: text('language'),              // en|es|both
  // ... more fields
});

// packages/core/src/db/schema-company.ts
// These tables ONLY exist in company hubs
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { pgPolicy } from 'drizzle-orm/pg-core';
import { authenticatedRole, crudPolicy, authUid } from 'drizzle-orm/neon';

export const teamMembers = pgTable('team_members', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(),         // admin|editor|contributor
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }),
});
```

### Pattern 4: Trigger.dev Task Middleware for Hub Context

**What:** Trigger.dev tasks receive a `hubId` in their payload. A middleware layer resolves the hub connection (reads DATABASE_URL from Trigger.dev environment variables) and injects the Drizzle client into the task context. Tasks never manage their own connections.

**When to use:** Every Trigger.dev task.

**Trade-offs:** Centralized connection management vs slightly more indirection. The benefit is tasks stay focused on business logic. The middleware also handles RLS context setting for company hubs.

**Example:**
```typescript
// src/trigger/shared/middleware.ts
import { createHubDbFromUrl } from '@psn/core';

export function withHubDb() {
  return task.middleware(async ({ ctx, next, payload }) => {
    const dbUrl = process.env.DATABASE_URL;
    const db = createHubDbFromUrl(dbUrl);

    // For company hubs with RLS, set the user context
    if (payload.userId && process.env.HUB_TYPE === 'company') {
      await db.execute(
        sql`SELECT set_config('app.current_user_id', ${payload.userId}, true)`
      );
    }

    return next({ ctx: { ...ctx, db } });
  });
}

// src/trigger/tasks/post-scheduler.ts
import { task } from '@trigger.dev/sdk/v3';
import { withHubDb } from '../shared/middleware';
import { posts } from '@psn/core/db/schema';

export const postScheduler = task({
  id: 'post-scheduler',
  middleware: [withHubDb()],
  run: async (payload, { ctx }) => {
    const post = await ctx.db
      .select()
      .from(posts)
      .where(eq(posts.id, payload.postId))
      .limit(1);

    // Call platform API to publish
    // Update post status to 'published'
  },
});
```

### Pattern 5: Deploy Same Tasks to Multiple Trigger.dev Projects

**What:** The same task codebase in `src/trigger/` deploys to both personal and company Trigger.dev projects. The difference is environment variables (DATABASE_URL, HUB_TYPE, platform API keys). Deploy with different `--project-ref` flags.

**When to use:** Deployment.

**Trade-offs:** One codebase, multiple deploys. Simple but requires discipline -- tasks must be hub-agnostic and derive behavior from environment variables, not hardcoded assumptions. Company-only tasks (like approval workflows) gracefully no-op in personal hubs.

**Example:**
```bash
# Deploy to personal hub's Trigger.dev project
npx trigger.dev deploy --project-ref proj_personal_abc123

# Deploy to company hub's Trigger.dev project
npx trigger.dev deploy --project-ref proj_company_xyz789

# Each project has its own env vars set in the Trigger.dev dashboard:
# - DATABASE_URL (pointing to the correct Neon DB)
# - HUB_TYPE (personal|company)
# - Platform API keys for that hub's accounts
```

### Pattern 6: RLS for Company Hubs Only

**What:** Personal hubs skip RLS entirely -- there is only one user, so row-level isolation is unnecessary overhead. Company hubs use Postgres RLS to isolate team member data. The RLS context is set per-transaction using `set_config()` with the team member's user ID.

**When to use:** Company hub database access.

**Trade-offs:** RLS adds latency per query (minimal on Neon). The benefit is airtight data isolation without application-level filtering. Company hubs without RLS risk one team member seeing another's drafts or tokens.

**Example:**
```typescript
// packages/core/src/db/rls.ts
import { sql } from 'drizzle-orm';
import { pgPolicy } from 'drizzle-orm/pg-core';

// Custom RLS using set_config (no Neon Authorize needed -- simpler)
// Tasks set: SELECT set_config('app.current_user_id', '<user-id>', true)
// Policies check: current_setting('app.current_user_id')

export const teamMemberPolicy = pgPolicy('team_member_isolation', {
  as: 'permissive',
  for: 'all',
  using: sql`created_by = current_setting('app.current_user_id', true)`,
  withCheck: sql`created_by = current_setting('app.current_user_id', true)`,
});

// Applied to posts, ideas, etc. in company hub schema
// team_members and brand_preferences are NOT RLS'd (shared across team)
// oauth_tokens are RLS'd to admin role only
```

## Data Flow

### Command-to-Hub Flow (Interactive)

```
User types /psn:post
    ↓
Claude reads post.md command template
    ↓
Claude reads config/strategy.yaml + voice profile
    ↓
Claude generates content options, user picks one
    ↓
Claude runs: npx tsx src/cli/queue-post.ts \
    --hub personal \
    --platform x \
    --content '{"text":"..."}' \
    --schedule "2026-02-19T09:00:00-06:00"
    ↓
queue-post.ts:
    1. Connects to personal hub DB via createHubConnection('personal')
    2. Inserts row into posts table (status: 'scheduled')
    3. Calls tasks.trigger() on post-scheduler with delay option
       matching the scheduled time
    4. Stores the Trigger.dev run ID in the posts row
    5. Outputs JSON confirmation
    ↓
Claude reads output, confirms to user:
"Scheduled for X at 9:00 AM CST. Run /psn:calendar to see your queue."
```

### Background Task Flow (Automated)

```
Trigger.dev cron fires analytics-collector (daily at 11 PM)
    ↓
Task middleware injects DB connection from DATABASE_URL env var
    ↓
analytics-collector.ts:
    1. Reads all posts published in last 24h from posts table
    2. For each post, calls platform API to fetch metrics
       (impressions, engagements, clicks, shares)
    3. Upserts analytics rows in analytics table
    4. If any post crosses engagement threshold,
       triggers notifier task to send WhatsApp alert
    ↓
User runs /psn:review next day
    ↓
Claude runs: npx tsx src/cli/query-analytics.ts --hub personal --period 7d
    ↓
Script queries analytics table, aggregates, returns JSON
    ↓
Claude presents performance summary, suggests strategy adjustments
```

### Cross-Hub Flow (Company Posting)

```
User types /psn:post, selects "Acme Corp" company account
    ↓
Claude reads config/company/acme-corp.yaml + brand-operator voice
    ↓
Claude generates company content, user approves
    ↓
Claude runs: npx tsx src/cli/queue-post.ts \
    --hub acme-corp \
    --platform linkedin \
    --content '{"text":"...","media":"..."}' \
    --schedule "2026-02-20T10:00:00-06:00" \
    --status pending-approval    # Company posts need approval
    ↓
queue-post.ts:
    1. Connects to Acme Corp's hub DB via createHubConnection('acme-corp')
    2. Inserts row into posts table (status: 'pending-approval')
    3. Does NOT trigger post-scheduler yet (needs approval first)
    4. Triggers notifier to alert approvers via WhatsApp
    ↓
Approver runs /psn:approve
    ↓
Claude runs: npx tsx src/cli/manage-ideas.ts --hub acme-corp --action list-pending
    ↓
Approver reviews, approves post
    ↓
Claude runs: npx tsx src/cli/queue-post.ts \
    --hub acme-corp \
    --action approve \
    --post-id <id>
    ↓
Script updates status to 'approved', triggers post-scheduler with delay
```

### Token Refresh Flow (Background)

```
Trigger.dev cron fires token-refresher (every 12 hours)
    ↓
token-refresher.ts:
    1. Queries oauth_tokens table for tokens expiring within 7 days
    2. For each expiring token, calls platform refresh endpoint
    3. Encrypts new token, updates oauth_tokens row
    4. If refresh fails (e.g., LinkedIn revoked), triggers notifier
       with "Re-authorize your LinkedIn account" message
    ↓
User gets WhatsApp notification if action needed
```

## Key Data Flows Summary

1. **Content creation:** Command -> Claude generates -> CLI script -> Hub DB (posts table) -> Trigger.dev delayed run -> Platform API
2. **Analytics:** Trigger.dev cron -> Platform APIs -> Hub DB (analytics table) -> CLI script query -> Claude formats for user
3. **Trend intelligence:** Trigger.dev cron -> Intelligence APIs -> Hub DB (trends table) -> Used during /psn:plan
4. **Token management:** Trigger.dev cron -> Check expiry -> Platform refresh APIs -> Hub DB (oauth_tokens) -> Notify if failed
5. **Notifications:** Any task -> notifier task -> WhatsApp (WAHA/Twilio) or future channels
6. **Idea pipeline:** /psn:capture -> CLI script -> Hub DB (ideas table) -> Surfaced during /psn:plan and /psn:post

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users (solo/small team) | Current architecture as-is. Neon free tier, Trigger.dev free/hobby. Single personal hub per user, 0-1 company hubs. No performance concerns. |
| 10-100 users (agency model) | Agency creates many company hubs. Each is still isolated (separate DB + Trigger.dev project). Main concern is deployment automation -- `/psn:setup` must reliably provision hubs. Consider a hub provisioning script that automates Neon DB creation + Trigger.dev project setup. |
| 100+ concurrent users per company hub | RLS performance on frequently-queried tables. Add indexes on `created_by` columns. Consider connection pooling (Neon has built-in). Analytics queries may need materialized views for dashboards. |

### Scaling Priorities

1. **First bottleneck: Rate limits.** Instagram's 200 req/hr is the hard ceiling. When multiple team members schedule analytics collection for the same company, batch requests and share rate limit state. The rate limiter in @psn/core must be hub-scoped, not per-task.

2. **Second bottleneck: Trigger.dev free tier limits.** 10 schedules covers one hub's cron jobs. Each additional hub needs its own Trigger.dev project with its own schedule allocation. At scale, company hubs should use Trigger.dev Hobby ($30/mo) or Pro tier.

3. **Third bottleneck: Token management.** LinkedIn's 60-day token expiry + Instagram's token rotation means the token-refresher task is a critical path. If it fails silently, scheduled posts fail days later. Build alerting into the refresh flow, not just the posting flow.

## Anti-Patterns

### Anti-Pattern 1: Commands Calling Platform APIs Directly

**What people do:** Have the slash command instruct Claude to call the X API directly via `curl` or a script, bypassing the hub entirely.
**Why it's wrong:** No scheduling, no analytics tracking, no audit trail, no retry on failure. The post exists only in the API response. If the user closes their terminal, scheduled posts are lost.
**Do this instead:** Always route through the hub. Commands insert into the DB, Trigger.dev executes at the scheduled time. Even "post now" goes through the queue with zero delay.

### Anti-Pattern 2: Fat Commands

**What people do:** Put complex logic in the markdown command file -- conditionals, error handling, retry logic.
**Why it's wrong:** Markdown commands are prompts, not programs. Claude interprets them non-deterministically. Complex logic in prompts leads to inconsistent behavior, hard-to-debug failures, and prompt bloat.
**Do this instead:** Keep commands declarative ("read this, run this script, present this"). Put all logic in CLI scripts and the shared library. Commands orchestrate; scripts execute.

### Anti-Pattern 3: Shared Database for Personal and Company Data

**What people do:** Use one database with a `hub_type` column to distinguish personal vs company data.
**Why it's wrong:** Data isolation violations are one WHERE clause away. Leaving a company requires data migration instead of deleting a connection file. RLS complexity explodes.
**Do this instead:** Separate databases. The hub boundary IS the data boundary. No mixing, no migration, no risk.

### Anti-Pattern 4: Storing OAuth Tokens Locally

**What people do:** Put platform tokens in `config/keys.env` alongside API keys.
**Why it's wrong:** Tokens expire and need automatic refresh. If they're in a local file, the background Trigger.dev task can't update them. You'd need a sync mechanism between local files and the cloud worker.
**Do this instead:** Store tokens in the hub DB (encrypted). Trigger.dev tasks read fresh tokens before every API call. The token-refresher task updates them in place.

### Anti-Pattern 5: One Trigger.dev Project for All Hubs

**What people do:** Deploy all tasks to a single Trigger.dev project and route hub-specific work via task payloads.
**Why it's wrong:** Environment variables (DATABASE_URL, API keys) would need to be per-invocation, not per-project. Trigger.dev Cloud sets env vars at the project level. You'd have to pass credentials in task payloads, which is a security risk and breaks the env var model.
**Do this instead:** One Trigger.dev project per hub. Same codebase, different deploys, different env vars. Clean separation.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Neon Postgres** | `@neondatabase/serverless` driver + Drizzle ORM | Use HTTP driver for CLI scripts (serverless), WebSocket for long-running Trigger.dev tasks. Connection string in hub .env files. |
| **Trigger.dev Cloud** | `@trigger.dev/sdk/v3` | CLI scripts use `tasks.trigger()` with `TRIGGER_SECRET_KEY`. Tasks use `task()` definitions. Deploy via `npx trigger.dev deploy`. |
| **X API** | OAuth 2.0 PKCE + REST API | Pay-per-use since Jan 2026. Token stored in hub DB. |
| **LinkedIn API** | OAuth 2.0 3-legged + REST API | Partner approval required (weeks). 60-day token expiry. No content discovery API. |
| **Instagram Graph API** | OAuth 2.0 via Facebook + REST API | 200 req/hr rate limit. Business account required. Multi-step media upload. |
| **TikTok API** | OAuth 2.0 + REST API | Audit required for public posting. Unaudited = 5 users, private-only. |
| **WhatsApp (WAHA/Twilio)** | Webhook for inbound + REST API for outbound | WAHA is self-hosted (Docker), Twilio is managed. Future: Claude-powered chatbot. |
| **Intelligence APIs** | REST APIs (Perplexity, Exa, Tavily, Brave, HN Algolia, Reddit) | Mostly free tiers. Rate limits vary. Results stored in trends table. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Commands <-> CLI Scripts | Bash tool_use (`npx tsx`) | Commands pass args via CLI flags. Scripts return JSON to stdout. Claude reads and interprets. |
| CLI Scripts <-> Hub DB | Drizzle ORM queries | Direct database access. Scripts construct queries using shared schema. |
| CLI Scripts <-> Trigger.dev | `tasks.trigger()` SDK call | Requires TRIGGER_SECRET_KEY. Returns run handle for status tracking. |
| Trigger.dev Tasks <-> Hub DB | Drizzle ORM queries (via middleware) | Same schema, same queries. Connection injected by middleware. |
| Trigger.dev Tasks <-> Platform APIs | REST HTTP via shared API clients | All API clients in @psn/core. Rate limiting built into clients. |
| Trigger.dev Tasks <-> Other Tasks | `task.trigger()` chaining | e.g., post-scheduler triggers notifier on success/failure. |

## Build Order (Dependency Chain)

The components must be built in this order due to hard dependencies:

```
Phase 1: Foundation
    @psn/core (schemas, types, connection)
    └── Nothing works without shared schemas and DB connection

Phase 2: Hub Infrastructure
    Hub provisioning (Neon DB + Trigger.dev project setup)
    └── Depends on: @psn/core schemas for migrations
    OAuth flow (interactive browser-based token acquisition)
    └── Depends on: @psn/core oauth module, hub DB for token storage

Phase 3: Core Command Loop
    CLI scripts (queue-post, query-analytics, manage-ideas)
    └── Depends on: @psn/core, hub DB (running + migrated)
    First command: /psn:post (create and schedule a post)
    └── Depends on: CLI scripts, voice profiles, hub DB

Phase 4: Background Automation
    Trigger.dev tasks (post-scheduler first, then analytics-collector)
    └── Depends on: @psn/core, deployed hub, env vars configured
    Token-refresher task
    └── Depends on: oauth module, hub DB with tokens

Phase 5: Intelligence + Planning
    Trend-collector, trend-alerter
    └── Depends on: intelligence API clients, hub DB trends table
    /psn:plan command (weekly batch planning)
    └── Depends on: trends data, idea bank, analytics history

Phase 6: Team Features
    Company hub schema (RLS, team_members, brand_preferences)
    └── Depends on: core schema, RLS policy definitions
    /psn:approve workflow
    └── Depends on: company hub, notification system

Phase 7: Notifications + Engagement
    WhatsApp integration, /psn:engage
    └── Depends on: notifier task, engagement-monitor task
```

## Sources

- [Trigger.dev Manual Setup](https://trigger.dev/docs/manual-setup) -- project structure, trigger.config.ts, monorepo patterns
- [Trigger.dev Task Overview](https://trigger.dev/docs/tasks/overview) -- task definition, lifecycle hooks, middleware
- [Trigger.dev Scheduled Tasks](https://trigger.dev/docs/tasks/scheduled) -- declarative vs imperative cron, delayed runs
- [Trigger.dev Triggering](https://trigger.dev/docs/triggering) -- tasks.trigger() from backend, delay option, TRIGGER_SECRET_KEY
- [Trigger.dev Environment Variables](https://trigger.dev/docs/deploy-environment-variables) -- per-project env var management
- [Trigger.dev Monorepo Guide](https://trigger.dev/changelog/monorepo-turborepo-guide) -- shared tasks package pattern
- [Drizzle ORM RLS](https://orm.drizzle.team/docs/rls) -- pgPolicy, pgRole, enabling RLS on tables
- [Neon + Drizzle RLS Guide](https://neon.com/docs/guides/rls-drizzle) -- crudPolicy, authUid, JWT-based user context
- [Drizzle + Neon Connection](https://orm.drizzle.team/docs/connect-neon) -- serverless driver setup
- [Neon Row-Level Security](https://neon.com/docs/guides/row-level-security) -- RLS fundamentals on Neon

---
*Architecture research for: Post Shit Now -- CLI-first social media automation*
*Researched: 2026-02-18*
