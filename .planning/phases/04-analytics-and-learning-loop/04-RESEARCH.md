# Phase 4: Analytics and Learning Loop - Research

**Researched:** 2026-02-19
**Domain:** X API analytics, engagement scoring, preference modeling, Trigger.dev scheduled tasks
**Confidence:** HIGH

## Summary

Phase 4 builds the analytics collection pipeline, engagement scoring engine, preference model, and the `/psn:review` command. The core technical challenge is integrating the X API v2 tweet metrics endpoints with a Trigger.dev scheduled task that collects engagement data daily, scoring posts with a composite metric, and building a learning loop that autonomously adjusts strategy parameters within bounded constraints.

The X API v2 provides all needed metrics via `public_metrics` (likes, retweets, replies, quotes, bookmarks, impressions) and `non_public_metrics` (URL clicks, profile clicks) on the tweet lookup endpoint. Rate limits are generous for this use case (900 requests/15min with user auth for single tweet lookup). The existing `XClient` class needs extension to support GET requests with field parameters. The existing schema needs new tables for `post_metrics`, `preference_model`, and `strategy_adjustments`.

**Primary recommendation:** Build the analytics collector as a Trigger.dev `schedules.task` that runs daily, fetches metrics for all published posts from the last 30 days (X API constraint), computes composite scores, and stores results. The preference model is a JSON document in the DB updated weekly during `/psn:review`. Strategy adjustments use a tiered auto-apply/queue-for-approval model stored in `strategy.yaml` (git-tracked, single source of truth).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Review Experience (/psn:review)**
- Default time range: last 7 days (weekly cadence per ANLYT-07)
- Post presentation: ranked list with highlights (top 3 / bottom 3 get full breakdown) PLUS compact score + one-line verdict for remaining posts -- combine both approaches
- Recommendations backed by evidence: each suggestion cites specific posts that support it (e.g., "Threads outperformed singles by 2x -- see posts #4, #7")
- Comparison mode: both time comparison (this week vs last) AND cross-pillar breakdown in the same review
- Reports saved to `analytics/reports/` (ANLYT-09)

**Learning Loop Autonomy**
- Tiered apply model: small adjustments (+/-5% pillar weight, posting time shifts, format preference tweaks) auto-apply; large changes (new pillar, dropping a format entirely, significant frequency changes) queue for user approval during /psn:review
- Adjustment speed limits: Claude's discretion -- pick appropriate speed based on data confidence
- Explicit feedback prompts: at key moments only -- 3x above average, significant underperformance, high/low edit streaks (LEARN-03). No friction-adding "rate every post" flow
- User overrides: permanent via explicit lock. Unlocking requires an explicit unlock command -- no auto-expiry
- Transparent changelog (LEARN-06): weekly review shows "what the brain changed this week" section

**Engagement Scoring**
- Two metrics shown: engagement score (absolute, saves > shares > comments > likes) AND engagement rate (per impression). Both visible, kept separate
- Format normalization: Claude's discretion on whether to normalize by format or show raw with format context
- Analytics collection cadence: Claude's discretion on timing (balance API costs vs data freshness)
- Follower tracking: track weekly/monthly trend, show in /psn:review as context. Do NOT correlate follower changes with specific posts -- too noisy for reliable attribution

**Content Fatigue Detection**
- Detection method: declining engagement trend -- if last 3 posts on a topic each scored lower than previous, flag as fatigued
- Cooldown action: deprioritize in suggestions. Topic still available if user chooses manually, but content brain won't suggest it
- Format fatigue: Claude's discretion on whether to track format fatigue separately from the format picker (Phase 3)
- Visibility: warn during /psn:post too -- if user is about to post on a fatigued topic, suggest alternatives. Don't just wait for /psn:review

### Claude's Discretion
- Adjustment speed limits (within tiered model constraints)
- Analytics collection cadence and API cost optimization
- Format normalization approach in scoring
- Whether format fatigue needs separate tracking beyond the format picker
- Monthly deep analysis format and depth (ANLYT-08)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLYT-01 | Analytics collector task pulls metrics from X API daily and writes to Hub DB | X API v2 `public_metrics` + `non_public_metrics` fields; Trigger.dev `schedules.task` for daily cron; new `post_metrics` table |
| ANLYT-05 | Each post receives a composite engagement score (saves > shares > comments > likes) | Weighted scoring formula using bookmark_count, retweet_count+quote_count, reply_count, like_count; stored per-post |
| ANLYT-06 | User can view performance analysis via `/psn:review` | Slash command reads from `post_metrics`, computes rankings, generates markdown report |
| ANLYT-07 | Weekly review includes per-platform performance, per-post breakdown, and recommendations | 7-day window query, cross-pillar aggregation, time comparison with previous period |
| ANLYT-08 | Monthly deep analysis auto-escalates: voice drift detection, audience model update, risk budget recalibration | Monthly `schedules.task`, cross-reference edit_history trends with engagement trends |
| ANLYT-09 | Reports saved to `analytics/reports/` for reference | Write markdown report to git-tracked directory |
| LEARN-01 | System tracks engagement signals (saves, shares, comments, follows) weighted by quality | Engagement scoring weights in `post_metrics`; follower tracking via user `public_metrics` |
| LEARN-02 | System tracks edit signals (edit distance, patterns, categories) from every post review | Already built: `editHistory` table + `calibration.ts`. Wire into preference model |
| LEARN-03 | System prompts explicit feedback at key moments | Threshold detection during `/psn:review`: 3x avg, significant underperformance, edit streak detection |
| LEARN-04 | Preference model updates weekly during `/psn:review` with platform learnings | `preference_model` table updated during review; aggregates engagement + edit signals |
| LEARN-05 | Autonomous adjustments: pillar weights (+/-5%/cycle), posting times, format preferences, topic fatigue, frequency (+/-1/week) | Tiered apply model; auto-apply small changes to `strategy.yaml`; queue large changes |
| LEARN-06 | Transparent changelog shows all autonomous changes in weekly review | `strategy_adjustments` log table; rendered in review output |
| LEARN-07 | User overrides are permanent -- system will not re-adjust locked settings | `locked_settings` field in preference model; checked before any autonomous adjustment |
| LEARN-08 | Content fatigue tracker cools down overused topics and formats | Declining trend detection on per-topic engagement; cooldown flag in preference model |
| POST-13 | Semi-automated formats (video scripts, TikTok stitches) save script + talking points to drafts; user records then runs `/psn:post finish` | New draft status "awaiting-recording"; `/psn:post finish` command picks up and publishes |
| SCHED-06 | Personal posts write to Personal Hub content queue; company posts write to Company Hub | Route based on persona field in post; separate queue logic in publish pipeline |

</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trigger.dev/sdk` | ^4.3.3 | Scheduled tasks (analytics collector, monthly analysis) | Already used for watchdog + publish; `schedules.task` for cron |
| `drizzle-orm` | ^0.45.1 | DB schema + queries for new analytics tables | Already used throughout; Neon HTTP driver |
| `@neondatabase/serverless` | ^1.0.2 | Neon Postgres connection | Already used; stateless HTTP for Trigger tasks |
| `zod` | ^4.3.6 | Schema validation for API responses + preference model | Already used for all schemas |
| `yaml` | ^2.8.2 | Read/write strategy.yaml | Already used for voice profiles |
| `diff` | ^8.0.3 | Edit distance computation | Already used in calibration.ts |

### Supporting (no new dependencies needed)
| Library | Purpose | Notes |
|---------|---------|-------|
| `XClient` (internal) | Extended for GET requests with field parameters | Currently only supports POST; needs `getTweet()` and `getUser()` methods |
| `fs/promises` (built-in) | Write reports to `analytics/reports/` | Same pattern as drafts module |

**No new npm dependencies required.** All functionality builds on the existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom scoring | Third-party analytics service | Unnecessary cost; our scoring is simple math on known metrics |
| DB-stored preference model | Git-stored YAML preference model | DB is better -- preference model changes frequently, needs atomic updates, and is per-user (RLS) |
| Complex ML for learning | Simple weighted averages + trend detection | ML is overkill for the data volumes (1-2 posts/day); simple math is interpretable and debuggable |

## Architecture Patterns

### Recommended Project Structure
```
src/
  analytics/
    collector.ts          # Trigger.dev scheduled task - fetches X metrics daily
    scoring.ts            # Engagement score computation (composite + rate)
    review.ts             # /psn:review logic - generates weekly report
    monthly.ts            # Monthly deep analysis (ANLYT-08)
    fatigue.ts            # Content fatigue detection + cooldown
    types.ts              # Analytics-specific types + Zod schemas
  learning/
    preference-model.ts   # Preference model CRUD + update logic
    adjustments.ts        # Autonomous adjustment engine (tiered apply)
    feedback.ts           # Explicit feedback prompt detection
    locks.ts              # User override lock management
  platforms/x/
    client.ts             # Extended with getTweet(), getTweets(), getMe()
    types.ts              # Extended with TweetMetrics, UserMetrics schemas
content/
  strategy.yaml           # Git-tracked strategy config (pillars, frequencies, times)
analytics/
  reports/                # Git-tracked weekly/monthly reports (ANLYT-09)
.claude/commands/psn/
  review.md               # /psn:review slash command
```

### Pattern 1: Analytics Collector (Trigger.dev Scheduled Task)
**What:** Daily cron task that fetches engagement metrics for all published posts
**When to use:** ANLYT-01 -- the core data pipeline
**Example:**
```typescript
// Source: Trigger.dev docs + X API v2 docs
import { schedules } from "@trigger.dev/sdk";

export const analyticsCollector = schedules.task({
  id: "analytics-collector",
  cron: "0 6 * * *", // 6am UTC daily
  maxDuration: 300,
  run: async (payload) => {
    const db = createHubConnection(process.env.DATABASE_URL!);

    // Fetch all published posts from last 30 days (X API metric limit)
    const recentPosts = await db.select()
      .from(posts)
      .where(and(
        eq(posts.status, "published"),
        eq(posts.platform, "x"),
        gt(posts.publishedAt, sql`NOW() - INTERVAL '30 days'`)
      ));

    // Batch fetch metrics (up to 100 tweet IDs per request)
    const tweetIds = recentPosts
      .map(p => p.externalPostId)
      .filter(Boolean);

    // GET /2/tweets?ids=...&tweet.fields=public_metrics,non_public_metrics
    const metrics = await client.getTweets(tweetIds, {
      tweetFields: ["public_metrics", "non_public_metrics"]
    });

    // Compute scores and upsert
    for (const tweet of metrics) {
      const score = computeEngagementScore(tweet.public_metrics);
      const rate = computeEngagementRate(tweet.public_metrics);
      await upsertPostMetrics(db, tweet.id, score, rate, tweet.public_metrics);
    }

    // Track follower count
    const me = await client.getMe({ userFields: ["public_metrics"] });
    await trackFollowerCount(db, me.public_metrics.followers_count);
  },
});
```

### Pattern 2: Composite Engagement Scoring
**What:** Weighted score formula: saves > shares > comments > likes
**When to use:** ANLYT-05, LEARN-01
**Example:**
```typescript
// Weights reflect user decision: saves > shares > comments > likes
// bookmark_count = saves, retweet_count + quote_count = shares, reply_count = comments
const ENGAGEMENT_WEIGHTS = {
  bookmark_count: 4,    // saves - highest signal
  retweet_count: 3,     // shares
  quote_count: 3,       // shares (quote tweets are high-quality shares)
  reply_count: 2,       // comments
  like_count: 1,        // likes - lowest signal
} as const;

export function computeEngagementScore(metrics: TweetPublicMetrics): number {
  return (
    metrics.bookmark_count * ENGAGEMENT_WEIGHTS.bookmark_count +
    metrics.retweet_count * ENGAGEMENT_WEIGHTS.retweet_count +
    metrics.quote_count * ENGAGEMENT_WEIGHTS.quote_count +
    metrics.reply_count * ENGAGEMENT_WEIGHTS.reply_count +
    metrics.like_count * ENGAGEMENT_WEIGHTS.like_count
  );
}

export function computeEngagementRate(metrics: TweetPublicMetrics): number {
  if (!metrics.impression_count || metrics.impression_count === 0) return 0;
  const totalEngagements = metrics.bookmark_count + metrics.retweet_count +
    metrics.quote_count + metrics.reply_count + metrics.like_count;
  return totalEngagements / metrics.impression_count;
}
```

### Pattern 3: Tiered Autonomous Adjustment
**What:** Auto-apply small changes, queue large changes for approval
**When to use:** LEARN-05
**Example:**
```typescript
interface StrategyAdjustment {
  type: "pillar_weight" | "posting_time" | "format_preference" | "frequency" | "new_pillar" | "drop_format";
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  evidence: string[]; // post IDs that support this
  tier: "auto" | "approval";
  appliedAt?: string;
  approvedAt?: string;
}

const AUTO_APPLY_RULES = {
  pillar_weight: (delta: number) => Math.abs(delta) <= 0.05,  // +/-5%
  posting_time: (shift: number) => Math.abs(shift) <= 2,       // +/-2 hours
  format_preference: () => true,                                // always auto
  frequency: (delta: number) => Math.abs(delta) <= 1,           // +/-1/week
  new_pillar: () => false,                                      // always approval
  drop_format: () => false,                                     // always approval
};
```

### Pattern 4: Content Fatigue Detection
**What:** Declining engagement trend on a topic triggers cooldown
**When to use:** LEARN-08
**Example:**
```typescript
export function detectTopicFatigue(
  topicPosts: Array<{ topic: string; score: number; publishedAt: Date }>
): FatigueResult[] {
  // Group by topic, sort by date
  const byTopic = groupBy(topicPosts, p => p.topic);
  const results: FatigueResult[] = [];

  for (const [topic, posts] of Object.entries(byTopic)) {
    const sorted = posts.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
    if (sorted.length < 3) continue;

    // Check last 3 posts for declining trend
    const last3 = sorted.slice(-3);
    const isDecline = last3[1].score < last3[0].score && last3[2].score < last3[1].score;

    if (isDecline) {
      results.push({
        topic,
        status: "fatigued",
        lastScores: last3.map(p => p.score),
        suggestion: `Topic "${topic}" shows declining engagement. Consider cooling down.`,
      });
    }
  }

  return results;
}
```

### Anti-Patterns to Avoid
- **Polling X API per-post individually:** Use batch `GET /2/tweets?ids=` (up to 100 IDs per request) to minimize API calls
- **Storing computed scores only:** Store raw metrics alongside scores -- allows recalculating if weights change
- **Strategy file as sole state:** Strategy config (git) for human-readable settings + DB for operational state (scores, model, locks)
- **Over-automating:** The tiered model exists for a reason -- never auto-apply structural changes like adding pillars
- **Correlating follower changes with posts:** User explicitly excluded this -- too noisy for attribution

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom setInterval/setTimeout | Trigger.dev `schedules.task` | Already in stack; handles failures, retries, observability |
| Rate limit backoff | Custom retry loops | XClient's existing rate limit tracking + Trigger.dev `wait.until()` | Pattern already established in publish-post.ts |
| Edit distance | Custom diff algorithm | `diff` library (already used) | Already proven in calibration.ts |
| Report formatting | Custom template engine | Markdown string templates | Reports are consumed by Claude Code and humans -- markdown is perfect |
| Data aggregation | Custom SQL aggregation library | Drizzle's SQL builder + raw SQL for complex aggregates | Drizzle handles 90%; raw SQL for window functions |

**Key insight:** This phase is data pipeline + business logic. No new infrastructure needed -- everything builds on Phase 1-3 foundations.

## Common Pitfalls

### Pitfall 1: X API 30-Day Metric Window
**What goes wrong:** Non-public metrics (URL clicks, profile clicks) are only available for posts created within the last 30 days. Attempting to fetch older metrics returns null/empty.
**Why it happens:** X API limitation -- organic and non-public metrics expire after 30 days.
**How to avoid:** Collector must snapshot and persist ALL metrics on each run. Historical data comes from our DB, not re-fetched from X. Public metrics (likes, retweets, replies) remain available indefinitely but values are point-in-time.
**Warning signs:** Null values for `non_public_metrics` fields on older posts.

### Pitfall 2: Impression Count of Zero
**What goes wrong:** Division by zero when computing engagement rate, or misleading rates on posts with very few impressions.
**Why it happens:** New posts may have 0 impressions briefly, or impressions may not be tracked for some post types.
**How to avoid:** Guard against zero impressions in rate calculation. Consider minimum impression threshold (e.g., 100) before including in aggregate analyses.
**Warning signs:** Engagement rates of Infinity or unrealistic percentages (500%+).

### Pitfall 3: Thread Metrics Aggregation
**What goes wrong:** A thread has multiple tweet IDs (`platformPostIds` array in posts table). Each tweet has its own metrics. Reporting per-"post" requires aggregation.
**Why it happens:** X API treats each tweet in a thread as a separate entity.
**How to avoid:** Fetch metrics for ALL tweet IDs in `platformPostIds`, aggregate (sum for absolute score, weighted average for rate using first tweet's impressions as primary).
**Warning signs:** Threads showing artificially low scores because only the first tweet's metrics were fetched.

### Pitfall 4: Batch Tweet Lookup Limits
**What goes wrong:** The `GET /2/tweets` batch endpoint accepts up to 100 IDs per request. With many published posts, a single request won't suffice.
**Why it happens:** API limitation on batch size.
**How to avoid:** Chunk tweet IDs into batches of 100. With 900 requests/15min rate limit (user auth), this handles up to 90,000 tweets per collection run -- more than enough.
**Warning signs:** API errors with "too many IDs" or truncated results.

### Pitfall 5: Strategy YAML Merge Conflicts
**What goes wrong:** Autonomous adjustments modify strategy.yaml, which is git-tracked. If user also manually edits, merge conflicts occur.
**Why it happens:** Two writers (system + user) modifying the same file.
**How to avoid:** Autonomous adjustments use a structured update function that reads, modifies, writes atomically. Adjustments are also logged to DB (`strategy_adjustments` table) so the YAML can be regenerated. Keep adjustments granular -- modify specific fields, not rewrite entire file.
**Warning signs:** Git conflicts on strategy.yaml after running /psn:review.

### Pitfall 6: Cost Accumulation on X API
**What goes wrong:** Daily collection of metrics for all posts over 30 days could accumulate read costs.
**Why it happens:** X pay-per-use: $0.005/read. If collecting metrics for 60 posts daily = $0.30/day = ~$9/month.
**How to avoid:** Optimize collection: (1) batch requests reduce call count, (2) skip posts whose metrics haven't changed (use `updatedAt` heuristic -- engagement stabilizes after ~72 hours), (3) collect more frequently for recent posts (first 3 days), less for older posts. Recommended cadence: daily for posts < 7 days old, every 3 days for 7-30 day old posts.
**Warning signs:** Unexpectedly high API costs in X developer dashboard.

## Code Examples

### X API v2 Tweet Metrics Response Schema
```typescript
// Source: https://docs.x.com/x-api/fundamentals/metrics
import { z } from "zod/v4";

export const TweetPublicMetricsSchema = z.object({
  retweet_count: z.number(),
  reply_count: z.number(),
  like_count: z.number(),
  quote_count: z.number(),
  bookmark_count: z.number(),
  impression_count: z.number(),
});

export const TweetNonPublicMetricsSchema = z.object({
  url_link_clicks: z.number().optional(),
  user_profile_clicks: z.number().optional(),
});

export const TweetWithMetricsSchema = z.object({
  id: z.string(),
  text: z.string(),
  public_metrics: TweetPublicMetricsSchema,
  non_public_metrics: TweetNonPublicMetricsSchema.optional(),
});

export const TweetsLookupResponseSchema = z.object({
  data: z.array(TweetWithMetricsSchema),
});

export type TweetPublicMetrics = z.infer<typeof TweetPublicMetricsSchema>;
```

### XClient Extension for GET Requests
```typescript
// Extend existing XClient in src/platforms/x/client.ts
async getTweets(
  ids: string[],
  fields?: { tweetFields?: string[]; userFields?: string[] }
): Promise<{ data: TweetWithMetrics[]; rateLimit: RateLimitInfo }> {
  const params = new URLSearchParams();
  params.set("ids", ids.join(","));
  if (fields?.tweetFields) {
    params.set("tweet.fields", fields.tweetFields.join(","));
  }

  return this.request(
    `/2/tweets?${params.toString()}`,
    { method: "GET" },
    TweetsLookupResponseSchema
  );
}

async getMe(
  fields?: { userFields?: string[] }
): Promise<{ data: UserWithMetrics; rateLimit: RateLimitInfo }> {
  const params = new URLSearchParams();
  if (fields?.userFields) {
    params.set("user.fields", fields.userFields.join(","));
  }

  return this.request(
    `/2/users/me?${params.toString()}`,
    { method: "GET" },
    UserLookupResponseSchema
  );
}
```

### New DB Schema Tables
```typescript
// New tables for src/core/db/schema.ts

export const postMetrics = pgTable("post_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  postId: uuid("post_id").notNull(),  // references posts.id
  platform: text("platform").notNull(),
  externalPostId: text("external_post_id").notNull(),

  // Raw metrics snapshot
  impressionCount: integer("impression_count").default(0),
  likeCount: integer("like_count").default(0),
  retweetCount: integer("retweet_count").default(0),
  quoteCount: integer("quote_count").default(0),
  replyCount: integer("reply_count").default(0),
  bookmarkCount: integer("bookmark_count").default(0),
  urlLinkClicks: integer("url_link_clicks"),
  userProfileClicks: integer("user_profile_clicks"),

  // Computed scores
  engagementScore: integer("engagement_score").default(0),
  engagementRate: integer("engagement_rate_bps").default(0), // basis points (0.01%)

  // Context
  postFormat: text("post_format"),   // format used (thread, short-post, etc.)
  postTopic: text("post_topic"),     // topic/pillar for fatigue tracking
  postPillar: text("post_pillar"),   // content pillar

  collectedAt: timestamp("collected_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("post_metrics_isolation", {
    as: "permissive", to: hubUser, for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);

export const preferenceModel = pgTable("preference_model", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),

  // Engagement learnings
  topFormats: jsonb("top_formats").$type<Array<{ format: string; avgScore: number }>>(),
  topPillars: jsonb("top_pillars").$type<Array<{ pillar: string; avgScore: number }>>(),
  bestPostingTimes: jsonb("best_posting_times").$type<Array<{ hour: number; dayOfWeek: number; avgScore: number }>>(),
  hookPatterns: jsonb("hook_patterns").$type<string[]>(),

  // Edit learnings
  commonEditPatterns: jsonb("common_edit_patterns").$type<Array<{ type: string; frequency: number }>>(),
  avgEditRatio: integer("avg_edit_ratio"),

  // Fatigue tracking
  fatiguedTopics: jsonb("fatigued_topics").$type<Array<{ topic: string; cooldownUntil: string; lastScores: number[] }>>(),

  // Locked settings (user overrides)
  lockedSettings: jsonb("locked_settings").$type<Array<{ field: string; value: unknown; lockedAt: string }>>(),

  // Follower tracking
  followerHistory: jsonb("follower_history").$type<Array<{ count: number; date: string }>>(),

  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("preference_model_isolation", {
    as: "permissive", to: hubUser, for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);

export const strategyAdjustments = pgTable("strategy_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  adjustmentType: text("adjustment_type").notNull(), // pillar_weight, posting_time, etc.
  field: text("field").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason").notNull(),
  evidence: jsonb("evidence").$type<string[]>(),     // post IDs supporting this
  tier: text("tier").notNull(),                       // auto | approval
  status: text("status").notNull().default("pending"), // pending | applied | approved | rejected
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("strategy_adjustments_isolation", {
    as: "permissive", to: hubUser, for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);
```

### Trigger.dev Scheduled Task Pattern (existing in codebase)
```typescript
// Source: existing src/trigger/watchdog.ts pattern
// The project already uses schedules.task for the post-watchdog cron
export const postWatchdog = schedules.task({
  id: "post-watchdog",
  maxDuration: 60,
  run: async () => { /* ... */ },
});

// Analytics collector follows the same pattern:
export const analyticsCollector = schedules.task({
  id: "analytics-collector",
  cron: "0 6 * * *",   // daily at 6am UTC
  maxDuration: 300,     // 5 minutes
  run: async (payload) => { /* ... */ },
});

// Monthly analysis:
export const monthlyAnalysis = schedules.task({
  id: "monthly-analysis",
  cron: "0 8 1 * *",   // 1st of each month at 8am UTC
  maxDuration: 600,
  run: async (payload) => { /* ... */ },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X API v1.1 fixed rate limits | X API v2 tiered rate limits | 2023+ | More generous read limits; pay-per-use in beta |
| $200/mo X API Basic tier | Pay-per-use ($0.01/post, $0.005/read) | Jan 2026 | Dramatically cheaper for low-volume analytics |
| Trigger.dev v2 `cronTrigger()` | Trigger.dev v3/v4 `schedules.task()` | 2024 | Declarative cron on task definition; timezone support |
| Manual token refresh | Inline refresh in task (already built) | Phase 2 | publish-post.ts already handles token refresh mid-task |

**Deprecated/outdated:**
- X API v1.1 endpoints: Still functional but v2 is the standard. This project uses v2 exclusively.
- Trigger.dev v2 `cronTrigger()`: Replaced by `schedules.task()` in v3+.

## Discretion Recommendations

### Analytics Collection Cadence
**Recommendation:** Tiered collection frequency based on post age.
- Posts 0-3 days old: collect every 6 hours (engagement is volatile early)
- Posts 4-7 days old: collect daily
- Posts 8-30 days old: collect every 3 days
- Posts 30+ days: stop collecting (X API drops non-public metrics anyway)

**Implementation:** Single daily cron task that internally decides which posts to fetch based on age. This keeps the Trigger.dev schedule simple while optimizing API costs.

**Estimated cost:** With 10 posts/week cadence, about 40 active posts in the 30-day window. Tiered collection = ~20 fetches/day average. At $0.005/read = $0.10/day = ~$3/month. Well within budget.

### Format Normalization
**Recommendation:** Show raw scores with format context annotations, not normalized scores. Normalization obscures the actual performance signal. Instead, show format averages as reference: "This thread scored 45 (threads avg: 38)".

### Format Fatigue
**Recommendation:** Do NOT track format fatigue separately from the existing format picker. The format picker already has preference-based logic. Simply feed engagement data back into the format picker's preferences. If threads consistently underperform, the preference model will naturally deprioritize them in suggestions.

### Adjustment Speed Limits
**Recommendation:** Maximum one adjustment per field per week. Require at least 5 posts of data before making any adjustment. Require at least 3 weeks of data before auto-applying pillar weight changes. This prevents oscillation on thin data.

### Monthly Deep Analysis (ANLYT-08)
**Recommendation:** The monthly analysis should be a Trigger.dev scheduled task that generates a comprehensive markdown report covering:
1. Voice drift: compare recent edit patterns to baseline (is calibration regressing?)
2. Audience signals: which topics/formats are growing vs declining over 30 days
3. Risk budget: are autonomous adjustments improving or degrading performance?
4. Strategic recommendations: proposed large changes that need approval
Save to `analytics/reports/monthly-YYYY-MM.md`.

## Open Questions

1. **Post topic/pillar extraction**
   - What we know: Posts need topic/pillar labels for fatigue tracking and cross-pillar analysis
   - What's unclear: How to tag posts with their topic/pillar. The current post schema has `metadata` jsonb but no explicit topic field.
   - Recommendation: Add `topic` and `pillar` fields to the `posts` table metadata during content generation (Phase 3's `generatePost` already has topic context). Alternatively, add explicit columns to posts table. For Phase 4, tag during generation and backfill published posts by matching content against pillar keywords.

2. **Hub routing for SCHED-06 (personal vs company)**
   - What we know: Posts have a `persona` field (personal/brand-operator/brand-ambassador). Company posts need approval workflow.
   - What's unclear: What "writing to Personal Hub vs Company Hub content queue" means in practice -- is it separate DB tables, separate Trigger.dev queues, or just a status flag?
   - Recommendation: Use the existing posts table with a `hub` column ("personal" | "company"). Company posts get `status: "pending_approval"` instead of "scheduled". Separate approval step before publishing. Simplest approach that achieves the requirement.

3. **POST-13: Semi-automated format finish flow**
   - What we know: Video scripts and TikTok stitches save as drafts; user records video, then runs `/psn:post finish`
   - What's unclear: How does the user associate their recorded video file with the draft? Where is the video stored?
   - Recommendation: `/psn:post finish <draft-id> --media <path>` attaches the user's recorded media to the existing draft, then proceeds with normal publish flow. Video stored in `content/media/` like other media.

## Sources

### Primary (HIGH confidence)
- X API v2 Metrics documentation: https://docs.x.com/x-api/fundamentals/metrics -- all available metrics fields, public vs non-public distinction, 30-day limit
- X API v2 Rate Limits: https://docs.x.com/x-api/fundamentals/rate-limits -- exact rate limits per endpoint (GET /2/tweets: 900/15min user auth, GET /2/tweets batch: 5000/15min)
- Trigger.dev Scheduled Tasks: https://trigger.dev/docs/tasks/scheduled -- `schedules.task()` API, cron syntax, timezone support, imperative schedules
- Existing codebase: `src/trigger/watchdog.ts` -- proven `schedules.task` pattern already in use
- Existing codebase: `src/voice/calibration.ts` -- edit tracking already built (LEARN-02 foundation)
- Existing codebase: `src/content/generate.ts` -- `getPreferenceModelLearnings()` stub ready for Phase 4

### Secondary (MEDIUM confidence)
- X API Data Dictionary: https://docs.x.com/x-api/fundamentals/data-dictionary -- `bookmark_count` confirmed in public_metrics
- X API pay-per-use pricing: https://www.socialmediatoday.com/news/x-formerly-twitter-launches-usage-based-api-access-charges/803315/ -- $0.01/post, $0.005/read (closed beta as of Dec 2025)

### Tertiary (LOW confidence)
- Pay-per-use tier availability: Reported as "closed beta" as of late 2025. The project memory states it's available. If not in the pay-per-use tier, the Basic tier ($200/mo) or Free tier (500 posts/100 reads per month) would apply. The free tier's 100 reads/month is too low for daily analytics collection. **Validate tier access before building.**

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all patterns verified in existing codebase
- Architecture: HIGH -- follows existing project patterns (Trigger.dev tasks, Drizzle schema, git-stored YAML)
- X API metrics: HIGH -- verified via official documentation; all needed fields confirmed available
- Pitfalls: HIGH -- based on documented API constraints (30-day window, batch limits) and existing code patterns
- Cost estimates: MEDIUM -- based on stated pay-per-use pricing which may change; depends on tier access

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days -- X API docs are stable; Trigger.dev SDK is stable at v4)
