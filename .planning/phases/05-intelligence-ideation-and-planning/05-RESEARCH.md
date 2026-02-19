# Phase 5: Intelligence, Ideation, and Planning - Research

**Researched:** 2026-02-19
**Domain:** Trend intelligence collection, idea lifecycle management, weekly content planning, content series, bilingual support
**Confidence:** HIGH

## Summary

Phase 5 is the largest phase yet, spanning four major feature domains: (1) trend intelligence collection from external sources, (2) an idea bank with maturity pipeline, (3) weekly content planning with collaborative back-and-forth, and (4) content series with cadence management. It also extends existing systems with bilingual (EN/ES) support and per-language analytics.

The codebase already has strong foundations to build on: the existing `topic-suggest.ts` has a `checkIdeaBank()` stub ready for Phase 5, the `generate.ts` content pipeline already supports language parameters, the voice profile schema (`voice/types.ts`) already has `languages.en` and `languages.es` sections, and the `strategy.yaml` config already has `languages.primary` and `languages.secondary` fields defined in the schema. The Trigger.dev scheduled task pattern is well-established (analytics-collector, token-refresher, monthly-analysis) and should be replicated for trend collection tasks.

The intelligence layer requires integrating with multiple external APIs (HN, Reddit, Product Hunt, Google Trends RSS, plus on-demand search via Perplexity/Exa/Tavily/Brave). All of these are BYOK -- no single API is critical, and the system should gracefully handle missing keys by skipping those sources.

**Primary recommendation:** Build this phase in 5 sub-plans: (1) DB schema + migrations for ideas/series/trends/weekly_plans tables, (2) trend intelligence collection tasks, (3) idea bank + `/psn:capture` command, (4) series management + `/psn:series` command, (5) weekly planning + `/psn:plan` command with bilingual extensions and content remixing/recycling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Idea Lifecycle:**
- Capture via `/psn:capture` with sentence + optional inline tags
- Maturity pipeline: spark -> seed -> ready -> claimed -> developed -> used/killed
- Auto-promote with override (trend match, notes added, related post performance)
- Staleness warning after N days, user decides to keep or kill, no auto-deletion
- Killed ideas move to killed state (queryable, out of active views)
- Storage: Database only (Neon Postgres), RLS per user + hub

**Weekly Planning:**
- Hybrid output: calendar outline + key drafts (2-3 actual drafts, rest outlined)
- Collaborative back-and-forth (system proposes, user reacts iteratively)
- Series episodes auto-slotted first, then pillar-balanced trend-informed content
- Finish-then-schedule model: only approved posts get Trigger.dev delayed runs
- Plan persists as reference (planned vs published)

**Content Series:**
- Named + cadence + format template + branding
- Episode tracking customizable per series: none, auto-increment, custom format string
- Missed episodes: suggest from idea bank + warn
- Storage: Database only (Neon Postgres), RLS per hub

**Bilingual Content:**
- Default language from profile + inferred override
- "Both" languages: Claude suggests approach (separate posts vs combined), user confirms
- EN/ES relationship: user controls per post ("same idea, adapt" vs "fresh take")
- Voice profiles: base profile + language-specific overrides in `es:` section

### Claude's Discretion
No explicit discretion areas were listed -- all major decisions were locked in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)
No items were explicitly deferred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-01 | Trend collector daily at 6 AM from HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds | HN API (free, no auth), Reddit API (OAuth required), Product Hunt GraphQL API (token required), Google Trends RSS endpoint, standard RSS parser |
| INTEL-02 | Lighter poll every 2-4 hours for breaking news (HN front page + X trending) | HN topstories endpoint (free), X API user timeline/trends (existing XClient) |
| INTEL-03 | Trends scored by pillar relevance, stored in Hub DB | New `trends` table with pillar scoring logic, TF-IDF or keyword matching against strategy.yaml pillars |
| INTEL-04 | On-demand research during /psn:plan via Perplexity, Exa, Tavily, Brave | BYOK for each service, all have HTTP REST APIs, graceful degradation when keys missing |
| INTEL-05 | Competitive intelligence tracks monitored accounts | X API user lookup + recent tweets for monitored accounts, new `monitored_accounts` table |
| INTEL-06 | Trend alerter generates 2-3 suggested angles for high-score trends | Angle generation using existing ANGLES template pattern from topic-suggest.ts |
| IDEA-01 | Capture ideas via /psn:capture in under 30 seconds | New slash command, CLI script outputting JSON, single DB insert |
| IDEA-02 | Ideas flow through maturity pipeline | `ideas` table with status enum, transition logic in idea-bank.ts |
| IDEA-03 | Urgency classification: timely, seasonal, evergreen | `urgency` column on ideas table, expiry logic for timely ideas |
| IDEA-04 | Timely ideas auto-killed on expiry | Scheduled task or check during /psn:plan to kill expired timely ideas |
| IDEA-05 | Personal ideas in Personal Hub, company ideas in Company Hub | Hub routing based on capture context, same schema different DB |
| IDEA-06 | Team members can claim company ideas | Status transition ready -> claimed with userId lock, RLS enforcement |
| IDEA-07 | /psn:capture distinguishes timely vs evergreen | Inline tag parsing or inference from content |
| IDEA-08 | Killed ideas record reasoning, feed preference model | `kill_reason` column, preference model update on kill |
| PLAN-01 | /psn:plan for weekly batch ideation + generation + scheduling | New slash command orchestrating trend data + idea bank + series + generation |
| PLAN-02 | Shows current week's calendar state | Query posts table for scheduled posts, series due dates |
| PLAN-03 | Ideation checks trends, fires searches, reviews analytics, checks ideas | Aggregation of trend data + on-demand search + preference model + idea bank |
| PLAN-04 | System generates 10-15 ideas mixed with ready ideas | Topic suggestion engine enhanced with trend data and idea bank integration |
| PLAN-05 | User rates ideas: love/maybe/kill | Interactive flow in slash command, status transitions |
| PLAN-06 | Series auto-slotted first, ready ideas fill gaps | Series cadence check, slot allocation algorithm |
| PLAN-07 | Language suggestion per slot | Strategy.yaml language config + recent language mix analysis |
| PLAN-08 | User can bail at any phase | Multi-phase command design with early exit support |
| PLAN-09 | Pillar distribution per strategy.yaml weights | Weighted random or round-robin based on pillar weights |
| PLAN-10 | Content archetype balancing | Track recent formats, ensure variety across the week |
| SERIES-01 | Create series via /psn:series create | New slash command + CLI script + DB insert |
| SERIES-02 | Series config: format, platform, cadence, branding (jsonb) | `series` table with jsonb template column |
| SERIES-03 | Series installments auto-slot into weekly plans | Query series for due episodes during /psn:plan |
| SERIES-04 | Pause, resume, retire series | Status field on series table (active/paused/retired) |
| SERIES-05 | Per-series analytics in /psn:review | Join postMetrics with series_id on posts, aggregate |
| SERIES-06 | System suggests formalizing recurring patterns as series | Pattern detection in review: same pillar+format combination appearing 3+ times |
| POST-07 | Language choice per post (en/es/both) | Extend DraftFrontmatter, generatePost options already support language param |
| POST-08 | Bilingual posts independently crafted | Two separate generation passes with language-specific voice context |
| ANLYT-10 | Per-language performance tracking | Add `language` column to postMetrics, aggregate by language in review |
| CONTENT-03 | Content remixing suggestions | Query top performers, suggest platform adaptation during /psn:plan |
| CONTENT-04 | Content recycling with fresh angles | Surface posts older than N days with high engagement scores during /psn:plan |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | DB schema, queries, migrations | Already used for all DB operations |
| @trigger.dev/sdk | 4.3.3 | Scheduled tasks, delayed runs | Already used for analytics-collector, publish-post, etc. |
| zod | 4.3.6 | Schema validation | Already used for voice profile types |
| yaml | 2.8.2 | YAML parsing/serialization | Already used for strategy.yaml, voice profiles |
| @neondatabase/serverless | 1.0.2 | Postgres connection | Already used via createHubConnection |

### New Dependencies Needed
| Library | Purpose | When to Use |
|---------|---------|-------------|
| rss-parser | Parse RSS/Atom feeds from Google Trends, custom RSS sources | INTEL-01: trend collection from RSS feeds |

**No other new dependencies needed.** All external API calls (HN, Reddit, Product Hunt, Perplexity, Exa, Tavily, Brave) are simple HTTP REST/GraphQL calls that can be made with native `fetch()` -- no SDK needed. The project already uses `fetch` for X API calls via XClient.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rss-parser | Custom XML parsing | rss-parser handles edge cases (Atom, RSS 2.0, encoding) that custom parsing misses |
| Native fetch for search APIs | SDK packages (perplexity-sdk, etc.) | SDKs add bundle size for simple REST calls; fetch is sufficient for BYOK pattern |

**Installation:**
```bash
bun add rss-parser
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── intelligence/
│   ├── types.ts                  # Trend, TrendSource, TrendScore types
│   ├── collector.ts              # Main trend collection orchestrator
│   ├── sources/
│   │   ├── hackernews.ts         # HN API client (free, no auth)
│   │   ├── reddit.ts             # Reddit API client (OAuth)
│   │   ├── producthunt.ts        # Product Hunt GraphQL client
│   │   ├── google-trends.ts      # Google Trends RSS parser
│   │   ├── rss.ts                # Generic RSS feed parser
│   │   └── x-trending.ts         # X trending via existing XClient
│   ├── search/
│   │   ├── perplexity.ts         # Perplexity Sonar API
│   │   ├── exa.ts                # Exa search API
│   │   ├── tavily.ts             # Tavily search API
│   │   └── brave-search.ts       # Brave Search API
│   ├── scoring.ts                # Pillar relevance scoring
│   └── competitive.ts            # Competitor monitoring (INTEL-05)
├── ideas/
│   ├── types.ts                  # Idea, IdeaStatus, Urgency types
│   ├── capture.ts                # Idea capture + tag parsing
│   ├── lifecycle.ts              # Status transitions, auto-promote, staleness
│   └── bank.ts                   # Query/filter/search ideas
├── series/
│   ├── types.ts                  # Series, SeriesConfig, EpisodeTracking types
│   ├── manager.ts                # CRUD, pause/resume/retire
│   ├── episodes.ts               # Episode tracking, due date calculation
│   └── detection.ts              # Pattern detection for SERIES-06
├── planning/
│   ├── types.ts                  # WeeklyPlan, PlanSlot types
│   ├── calendar.ts               # Current week state, gap detection
│   ├── ideation.ts               # Idea generation mixing trends + bank + pillars
│   ├── slotting.ts               # Series-first slot allocation + pillar balancing
│   ├── language.ts               # Language suggestion per slot
│   └── recycling.ts              # Content remixing + recycling (CONTENT-03, CONTENT-04)
├── cli/
│   ├── capture.ts                # CLI for /psn:capture
│   ├── series.ts                 # CLI for /psn:series
│   └── plan.ts                   # CLI for /psn:plan
├── trigger/
│   ├── trend-collector.ts        # Daily 6 AM trend collection task
│   ├── trend-poller.ts           # 2-4 hour breaking news poller
│   └── idea-expiry.ts            # Timely idea expiry checker
└── .claude/commands/psn/
    ├── capture.md                # /psn:capture slash command
    ├── series.md                 # /psn:series slash command
    └── plan.md                   # /psn:plan slash command
```

### Pattern 1: Source Adapter Pattern for Intelligence Collection
**What:** Each trend source implements a common interface, collected via an orchestrator.
**When to use:** Whenever adding new trend sources or search providers.
**Example:**
```typescript
// src/intelligence/types.ts
export interface TrendSource {
  name: string;
  fetch(pillars: string[]): Promise<RawTrend[]>;
}

export interface RawTrend {
  title: string;
  url?: string;
  source: string;
  sourceScore?: number;  // HN points, Reddit upvotes, etc.
  publishedAt?: Date;
  tags?: string[];
}

export interface ScoredTrend {
  id: string;
  title: string;
  url?: string;
  source: string;
  sourceScore: number;
  pillarRelevance: Record<string, number>;  // pillar -> 0-100 score
  overallScore: number;  // composite 0-100
  suggestedAngles?: string[];
  detectedAt: Date;
  expiresAt?: Date;  // for timely trends
}

// src/intelligence/sources/hackernews.ts
export async function fetchHNTopStories(limit = 30): Promise<RawTrend[]> {
  const ids = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    .then(r => r.json()) as number[];

  const stories = await Promise.all(
    ids.slice(0, limit).map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.json())
    )
  );

  return stories
    .filter(s => s && s.type === 'story')
    .map(s => ({
      title: s.title,
      url: s.url,
      source: 'hackernews',
      sourceScore: s.score,
      publishedAt: new Date(s.time * 1000),
    }));
}
```

### Pattern 2: Graceful BYOK Degradation
**What:** Each external API checks for its key and skips silently if missing.
**When to use:** All intelligence and search operations.
**Example:**
```typescript
// src/intelligence/collector.ts
export async function collectTrends(pillars: string[]): Promise<RawTrend[]> {
  const allTrends: RawTrend[] = [];
  const errors: string[] = [];

  // Always available (no auth needed)
  try {
    allTrends.push(...await fetchHNTopStories());
  } catch (e) {
    errors.push(`HN: ${e instanceof Error ? e.message : String(e)}`);
  }

  // BYOK sources
  const redditToken = process.env.REDDIT_CLIENT_ID;
  if (redditToken) {
    try {
      allTrends.push(...await fetchRedditTrending(pillars));
    } catch (e) {
      errors.push(`Reddit: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ... same pattern for other sources
  return allTrends;
}
```

### Pattern 3: Multi-Phase Slash Command (for /psn:plan)
**What:** A slash command that operates in distinct phases, allowing the user to bail at any phase.
**When to use:** Complex interactive workflows like weekly planning.
**Example flow:**
```
Phase 1: Show calendar state (PLAN-02) -> user can stop here
Phase 2: Ideation (PLAN-03, PLAN-04) -> user rates ideas (PLAN-05) -> user can stop here
Phase 3: Slot allocation (PLAN-06, PLAN-07, PLAN-09, PLAN-10) -> user can stop here
Phase 4: Draft generation for selected slots -> user can stop here
Phase 5: Schedule approved posts via Trigger.dev delayed runs
```

### Pattern 4: Idea Status Machine
**What:** Finite state machine for idea maturity pipeline with defined transitions.
**When to use:** All idea status changes.
**Example:**
```typescript
// Valid transitions
const VALID_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  spark: ['seed', 'killed'],
  seed: ['ready', 'killed', 'spark'],     // can revert to spark
  ready: ['claimed', 'killed', 'seed'],    // can revert to seed
  claimed: ['developed', 'ready'],          // unclaim reverts to ready
  developed: ['used', 'killed', 'claimed'], // can revert to claimed
  used: [],                                 // terminal
  killed: ['spark'],                        // can resurrect to spark
};
```

### Anti-Patterns to Avoid
- **Polling without backoff:** HN API is free but hammering it wastes resources. Use Trigger.dev's cron for reliable intervals.
- **Storing raw trend data indefinitely:** The PRD specifies 30-day retention. Add `expiresAt` to the trends table and prune old records.
- **Generating all drafts during planning:** The CONTEXT.md says "hybrid: calendar outline + key drafts" -- only generate 2-3 drafts, outline the rest.
- **Translating content:** EN/ES posts must be "independently crafted, not translated." Two separate generation passes with language-specific voice context, not one generation + translation.
- **Blocking on missing search APIs:** If Perplexity/Exa/Tavily/Brave keys are missing, the plan should still work using stored trend data and the idea bank.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS parsing | Custom XML parser | `rss-parser` npm package | Handles RSS 1.0, 2.0, Atom, encoding edge cases, malformed feeds |
| Cron scheduling | Custom setInterval/setTimeout | Trigger.dev `schedules.task()` | Already used; handles retries, logging, zero-compute-cost waits |
| Pillar relevance scoring | Complex NLP pipeline | Simple keyword/TF-IDF matching | Content pillars are user-defined short phrases; keyword matching is sufficient for v1 |
| Idea search | Full-text search engine | Postgres `ILIKE` + `ts_vector` | Neon Postgres supports full-text search natively; idea count will be small enough |
| State machine validation | Custom if/else chains | Transition map lookup (as shown above) | Prevents invalid transitions, easy to extend |

**Key insight:** The intelligence layer's value comes from aggregating multiple simple sources, not from sophisticated NLP. Simple keyword matching against user-defined pillars (3-7 short phrases) is more than adequate for v1 relevance scoring.

## Common Pitfalls

### Pitfall 1: API Rate Limits on Trend Sources
**What goes wrong:** Reddit and Product Hunt have strict rate limits; hitting them causes temporary bans.
**Why it happens:** Collecting from too many subreddits or making too many Product Hunt queries in one run.
**How to avoid:** Batch requests efficiently. Reddit allows 60 req/min with OAuth. Product Hunt GraphQL allows batching queries. HN has no documented limits but be reasonable (~50 item fetches per run).
**Warning signs:** 429 responses, empty result sets after previously successful runs.

### Pitfall 2: Trend Data Staleness
**What goes wrong:** Trends stored days ago are presented as "current" during planning.
**Why it happens:** No staleness indicator on stored trends.
**How to avoid:** Add `detectedAt` timestamp to trends table. During /psn:plan, clearly label how old each trend is. Fire on-demand searches (INTEL-04) to supplement stored trends.
**Warning signs:** User sees the same trends week after week.

### Pitfall 3: Idea Bank Becoming a Graveyard
**What goes wrong:** Ideas accumulate in spark/seed state and are never promoted or killed.
**Why it happens:** No active staleness management or review prompts.
**How to avoid:** Implement staleness warnings (CONTEXT.md: "staleness warning after N days"). During /psn:plan, surface stale ideas and prompt the user to keep or kill. Default N = 14 days for sparks, 30 days for seeds.
**Warning signs:** Idea bank grows monotonically without corresponding idea usage.

### Pitfall 4: Series Cadence Drift
**What goes wrong:** A biweekly series slowly drifts because episodes are skipped without tracking.
**Why it happens:** Due date calculated from creation date rather than last published date.
**How to avoid:** Track `lastPublishedAt` on each series. Calculate next due from last published date, not creation date. If an episode is skipped, the next due date should still advance.
**Warning signs:** Series episodes bunching up after a skip.

### Pitfall 5: Bilingual Voice Inconsistency
**What goes wrong:** Spanish content reads like translated English rather than natural Spanish.
**Why it happens:** Using English voice patterns with Spanish vocabulary instead of genuinely separate voice contexts.
**How to avoid:** The voice profile already has separate `languages.es` section. Build the Spanish voice context from `es` section patterns, not by adapting `en` patterns. The `buildVoicePromptContext()` function already selects language-specific patterns correctly.
**Warning signs:** Spanish content uses English sentence structures, idioms feel forced.

### Pitfall 6: Weekly Plan Table Bloat
**What goes wrong:** Weekly plans accumulate in DB without cleanup.
**Why it happens:** Plans are created each week but never archived.
**How to avoid:** Add a retention policy. Plans older than 90 days can be archived or summarized. Keep the last 4-8 plans in detail for reference.
**Warning signs:** Slow queries on weekly_plans table.

## Code Examples

### New DB Schema Tables

```typescript
// Addition to src/core/db/schema.ts

// ─── Ideas ──────────────────────────────────────────────────────────────────

export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    hubId: text("hub_id"),  // null = personal hub

    // Content
    title: text("title").notNull(),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>(),

    // Pipeline
    status: text("status").notNull().default("spark"),
    // spark | seed | ready | claimed | developed | used | killed
    urgency: text("urgency").notNull().default("evergreen"),
    // timely | seasonal | evergreen

    // Metadata
    pillar: text("pillar"),
    platform: text("platform"),
    format: text("format"),
    claimedBy: text("claimed_by"),
    killReason: text("kill_reason"),

    // Timing
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastTouchedAt: timestamp("last_touched_at", { withTimezone: true }).defaultNow().notNull(),

    // Lineage
    sourceType: text("source_type"),  // trend | capture | plan | remix | recycle
    sourceId: text("source_id"),      // trend ID, post ID, etc.

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

// ─── Series ─────────────────────────────────────────────────────────────────

export const series = pgTable(
  "series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    hubId: text("hub_id"),

    name: text("name").notNull(),
    description: text("description"),
    platform: text("platform").notNull(),

    // Template & branding
    template: jsonb("template").$type<{
      formatStructure: string;
      sections: string[];
      introPattern?: string;
      outroPattern?: string;
      visualStyle?: string;
      hashtags?: string[];
    }>(),

    // Cadence
    cadence: text("cadence").notNull(),  // weekly | biweekly | monthly | custom
    cadenceCustomDays: integer("cadence_custom_days"),

    // Episode tracking
    trackingMode: text("tracking_mode").notNull().default("auto-increment"),
    // none | auto-increment | custom
    trackingFormat: text("tracking_format"),  // e.g., "Season {s}, Ep {e}"
    episodeCount: integer("episode_count").notNull().default(0),

    // State
    status: text("status").notNull().default("active"),
    // active | paused | retired
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),

    // Pillar association
    pillar: text("pillar"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

// ─── Trends ─────────────────────────────────────────────────────────────────

export const trends = pgTable(
  "trends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    title: text("title").notNull(),
    url: text("url"),
    source: text("source").notNull(),  // hackernews | reddit | producthunt | google-trends | rss | x
    sourceScore: integer("source_score"),

    // Scoring
    pillarRelevance: jsonb("pillar_relevance").$type<Record<string, number>>(),
    overallScore: integer("overall_score").notNull().default(0),

    // Angles
    suggestedAngles: jsonb("suggested_angles").$type<string[]>(),

    // Lifecycle
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),  // 30-day retention
    usedInIdeaId: text("used_in_idea_id"),  // links to idea if used

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    pgPolicy("trends_isolation", {
      as: "permissive",
      to: hubUser,
      for: "all",
      using: sql`${table.userId} = current_setting('app.current_user_id')`,
      withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
    }),
  ],
);

// ─── Weekly Plans ───────────────────────────────────────────────────────────

export const weeklyPlans = pgTable(
  "weekly_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),

    // Plan slots as jsonb array
    slots: jsonb("slots").$type<Array<{
      day: string;           // ISO date
      platform: string;
      topic: string;
      format: string;
      pillar: string;
      language: string;
      seriesId?: string;
      seriesEpisode?: string;
      ideaId?: string;
      postId?: string;       // linked when draft created
      status: "outlined" | "drafted" | "approved" | "scheduled" | "published" | "skipped";
    }>>(),

    // Summary
    totalSlots: integer("total_slots").notNull().default(0),
    completedSlots: integer("completed_slots").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

// ─── Monitored Accounts (INTEL-05) ──────────────────────────────────────────

export const monitoredAccounts = pgTable(
  "monitored_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),

    platform: text("platform").notNull(),
    accountHandle: text("account_handle").notNull(),
    accountName: text("account_name"),

    // Tracking
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastPostCount: integer("last_post_count"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
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
```

### Posts Table Extension (for series + language tracking)

```typescript
// The existing posts table needs two new columns:
// - seriesId: uuid reference to series table
// - language: text field for en/es/both tracking (for ANLYT-10, POST-07)
// These should be added via a Drizzle migration, not by modifying the existing schema definition inline
// (add them to the posts table definition in schema.ts)
```

### Trigger.dev Trend Collector Task

```typescript
// src/trigger/trend-collector.ts
// Following the exact pattern from analytics-collector.ts and monthly-analysis.ts

import { logger, schedules } from "@trigger.dev/sdk";
import { collectTrends } from "../intelligence/collector.ts";
import { scoreTrends } from "../intelligence/scoring.ts";
import { createHubConnection } from "../core/db/connection.ts";

export const trendCollector = schedules.task({
  id: "trend-collector",
  cron: "0 6 * * *",  // Daily at 6 AM UTC
  maxDuration: 300,
  run: async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.error("DATABASE_URL not set");
      return { status: "error", reason: "missing_env" };
    }

    const db = createHubConnection(databaseUrl);
    const userId = "default";

    // Load pillars from strategy.yaml
    const pillars = await loadPillars();

    // Collect from all available sources
    const rawTrends = await collectTrends(pillars);

    // Score by pillar relevance
    const scored = scoreTrends(rawTrends, pillars);

    // Store in DB (with 30-day expiry)
    const stored = await storeTrends(db, userId, scored);

    // Generate angles for high-score trends (INTEL-06)
    const highScoreTrends = scored.filter(t => t.overallScore >= 70);
    // Angle generation happens at query time in /psn:plan, not here

    logger.info("Trend collection complete", {
      totalCollected: rawTrends.length,
      stored: stored,
      highScore: highScoreTrends.length,
    });

    return { status: "success", collected: rawTrends.length, stored };
  },
});
```

### Pillar Relevance Scoring

```typescript
// src/intelligence/scoring.ts
// Simple keyword matching -- sufficient for user-defined pillars (3-7 short phrases)

export function scorePillarRelevance(
  trendTitle: string,
  pillars: Array<{ name: string; weight: number }>,
): Record<string, number> {
  const scores: Record<string, number> = {};
  const titleLower = trendTitle.toLowerCase();

  for (const pillar of pillars) {
    const pillarWords = pillar.name.toLowerCase().split(/\s+/);
    let matchScore = 0;

    for (const word of pillarWords) {
      if (word.length < 3) continue;  // skip short words
      if (titleLower.includes(word)) {
        matchScore += 30;  // direct keyword match
      }
    }

    // Full phrase match bonus
    if (titleLower.includes(pillar.name.toLowerCase())) {
      matchScore += 40;
    }

    scores[pillar.name] = Math.min(100, matchScore);
  }

  return scores;
}

export function computeOverallScore(
  pillarScores: Record<string, number>,
  sourceScore: number,
  pillars: Array<{ name: string; weight: number }>,
): number {
  // Weighted average of pillar relevance (60%) + source popularity (40%)
  let weightedRelevance = 0;
  let totalWeight = 0;

  for (const pillar of pillars) {
    const score = pillarScores[pillar.name] ?? 0;
    weightedRelevance += score * pillar.weight;
    totalWeight += pillar.weight;
  }

  const relevance = totalWeight > 0 ? weightedRelevance / totalWeight : 0;
  const popularity = Math.min(100, sourceScore);  // normalize source score to 0-100

  return Math.round(relevance * 0.6 + popularity * 0.4);
}
```

### Idea Capture CLI

```typescript
// src/cli/capture.ts
// Outputs JSON for Claude to interpret (established pattern)

interface CaptureInput {
  text: string;
  tags?: string[];
  urgency?: "timely" | "seasonal" | "evergreen";
  hub?: "personal" | "company";
  pillar?: string;
  platform?: string;
  format?: string;
}

// Tag parsing from inline text: "AI agents replacing SaaS #pillar:ai #format:thread"
export function parseInlineTags(input: string): { text: string; tags: Record<string, string> } {
  const tagRegex = /#(\w+):(\S+)/g;
  const tags: Record<string, string> = {};
  const cleanText = input.replace(tagRegex, (_, key, value) => {
    tags[key] = value;
    return '';
  }).trim();

  return { text: cleanText, tags };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Trends scraping | Google Trends API (alpha) | July 2025 | Proper API access, but requires application for alpha; use RSS feed as primary fallback |
| Reddit free API | Reddit OAuth required + stricter rate limits | 2023-2024 | Need Reddit OAuth app registration, 60 req/min limit |
| Brave Search free tier | Brave Search $5/mo credit (covers ~1000 queries) | Feb 2026 | Still effectively free for this use case; attribution required |
| Per-library SDKs for search | Native fetch() for simple REST APIs | Ongoing | Reduces dependencies; all search APIs are simple HTTP POST |

**Deprecated/outdated:**
- Google Trends RSS may be deprecated in favor of the new API alpha -- but RSS still works as of Feb 2026
- Product Hunt API v1 (REST) is replaced by v2 (GraphQL)
- Reddit API without OAuth is no longer viable for any programmatic access

## External API Reference

### Free APIs (No Auth)
| API | Endpoint | Rate Limit | Data |
|-----|----------|------------|------|
| HN Top Stories | `https://hacker-news.firebaseio.com/v0/topstories.json` | No documented limit | Top 500 story IDs |
| HN Item | `https://hacker-news.firebaseio.com/v0/item/{id}.json` | No documented limit | Individual story details |
| Google Trends RSS | `https://trends.google.com/trending/rss?geo=US` | No documented limit | Daily trending searches |

### BYOK APIs (User Provides Keys)
| API | Auth Method | Cost | Use Case |
|-----|-------------|------|----------|
| Reddit | OAuth 2.0 (client_id + secret) | Free | Trending posts from relevant subreddits |
| Product Hunt | Bearer token (GraphQL) | Free (non-commercial) | Daily featured products |
| Perplexity Sonar | API key | $5/1000 searches | On-demand research during /psn:plan |
| Exa | API key | $5/1000 requests (Instant) | On-demand semantic search |
| Tavily | API key | Free tier: 1000 credits/mo | On-demand web search |
| Brave Search | API key | $5/1000 requests ($5 free credit) | On-demand web search |

### Already Available (Existing Codebase)
| API | Available Via | Use Case |
|-----|---------------|----------|
| X API | XClient (src/platforms/x/client.ts) | X trending topics, competitor monitoring |

## Open Questions

1. **Staleness Warning Threshold**
   - What we know: CONTEXT.md says "staleness warning after N days"
   - What's unclear: Exact value of N for sparks vs seeds
   - Recommendation: Default to 14 days for sparks, 30 days for seeds. Make configurable in strategy.yaml.

2. **Series YAML vs DB for Templates**
   - What we know: CONTEXT.md says "Database only" for series storage
   - What's unclear: REQUIREMENTS.md (SERIES-02) says "YAML config" -- there's a mismatch
   - Recommendation: Follow CONTEXT.md (user's later, more specific decision). Store everything in DB with jsonb template column. The PRD's data split table also lists series as DB.

3. **Competitive Intelligence Depth (INTEL-05)**
   - What we know: "Tracks monitored accounts and surfaces gaps"
   - What's unclear: How deep should competitor analysis go? Just post frequency/topics, or engagement analysis too?
   - Recommendation: Start simple -- track competitor post frequency and topics. Surface gaps ("they posted about X, you haven't"). Engagement analysis of competitors requires additional API calls and may not be cost-effective.

4. **Content Archetype Taxonomy (PLAN-10)**
   - What we know: "Prevents monotonous content patterns"
   - What's unclear: What archetypes to track beyond format (which is already tracked)
   - Recommendation: Track both format and angle (from the ANGLES list in topic-suggest.ts): hot-take, how-to, story, trend, myth-busting, comparison, prediction, behind-the-scenes, tool-recommendation, quick-tip. Ensure no more than 2 of the same angle per week.

5. **Google Trends API Alpha Access**
   - What we know: Launched July 2025, rolling access
   - What's unclear: Whether access is broadly available yet
   - Recommendation: Use RSS feed as primary. Add Google Trends API as an upgrade path if/when user gets access.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/core/db/schema.ts`, `src/content/topic-suggest.ts`, `src/content/generate.ts`, `src/voice/types.ts`, `src/trigger/analytics-collector.ts` -- established patterns for DB schema with RLS, Trigger.dev scheduled tasks, content generation pipeline
- Codebase analysis: `src/learning/preference-model.ts`, `src/analytics/review.ts`, `src/learning/adjustments.ts` -- learning loop and strategy adjustment patterns
- Codebase analysis: `package.json` -- current dependency versions

### Secondary (MEDIUM confidence)
- [HN API documentation](https://github.com/HackerNews/API) - Firebase-based REST API, no auth required
- [Reddit API rate limits](https://painonsocial.com/blog/reddit-api-rate-limits-guide) - 60 req/min with OAuth
- [Product Hunt API v2](https://api.producthunt.com/v2/docs) - GraphQL API with bearer token
- [Perplexity API pricing](https://docs.perplexity.ai/getting-started/pricing) - $5/1000 searches for Sonar
- [Exa AI pricing](https://exa.ai/pricing) - $5/1000 requests for Instant
- [Tavily pricing](https://docs.tavily.com/documentation/api-credits) - Free tier 1000 credits/mo
- [Brave Search API](https://brave.com/search/api/) - $5/1000 requests with $5 free credit
- [Google Trends API alpha](https://developers.google.com/search/blog/2025/07/trends-api) - Announced July 2025

### Tertiary (LOW confidence)
- Google Trends RSS endpoint availability -- confirmed working but may be deprecated in favor of API alpha

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Building on established codebase patterns, only 1 new dependency
- Architecture: HIGH - Source adapter pattern is well-understood, slash command patterns established
- DB schema: HIGH - Follows exact same RLS/pgPolicy patterns as existing tables
- External APIs: MEDIUM - API availability and pricing confirmed via web search, but may change
- Pitfalls: HIGH - Based on domain experience with content management systems and API integrations

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days - stable domain, external API pricing may shift)
