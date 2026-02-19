# Pitfalls Research

**Domain:** CLI-first social media automation (X, LinkedIn, Instagram, TikTok)
**Researched:** 2026-02-18
**Confidence:** HIGH (verified against official docs, developer forums, and incident reports)

## Critical Pitfalls

### Pitfall 1: OAuth Token Refresh Race Conditions

**What goes wrong:**
Multiple Trigger.dev tasks (analytics collector, post scheduler, engagement monitor) attempt to refresh the same expired OAuth token simultaneously. The last process to complete overwrites the valid new token with a stale one. Worse: if the provider invalidates the old refresh token on use (as X does), you permanently lose the ability to refresh -- forcing the user to manually re-authenticate.

**Why it happens:**
Developers treat token refresh as a simple if-expired-then-refresh check. In a concurrent task runner like Trigger.dev, multiple tasks wake up at similar times and all see the same expired token. X's OAuth 2.0 has documented bugs where refresh tokens randomly fail with 401, compounding the issue.

**How to avoid:**
- Implement a token refresh lock in Postgres using `SELECT ... FOR UPDATE SKIP LOCKED` on the `oauth_tokens` row. Only one task refreshes; others wait or retry with the new token.
- Store `expires_at` timestamp and refresh proactively (e.g., 5 minutes before expiry) via a dedicated `token-refresher` scheduled task -- not inline during API calls.
- On refresh failure, retry with exponential backoff (X's API has intermittent 401s that resolve on retry). After 3 failures, mark the token as `needs_reauth` and notify the user via WhatsApp.
- Never store the refresh token in multiple places. Single source of truth in the DB.

**Warning signs:**
- Intermittent "401 Unauthorized" errors on API calls that previously worked
- Users reporting they need to re-authenticate more than once per refresh token lifetime
- Two tasks logging "token refreshed" within seconds of each other

**Phase to address:**
Phase 1 (Foundation/Setup). Token management is the backbone of every subsequent feature. Get this wrong and nothing works reliably.

---

### Pitfall 2: LinkedIn's 60-Day Token Cliff and Partner API Gatekeeping

**What goes wrong:**
LinkedIn access tokens expire after 60 days. Refresh tokens last 365 days but require programmatic refresh before the access token expires. If the refresh window is missed (server downtime, task failure, Trigger.dev incident), the user must manually re-authorize via browser. For a CLI-first system, this is a brutal UX failure -- there is no browser flow to redirect to.

Additionally, LinkedIn's Community Management API (required for posting) needs partner program approval that takes weeks-to-months. Building LinkedIn features without approval in hand means the entire LinkedIn path is blocked.

**Why it happens:**
Developers assume OAuth refresh is "set and forget." LinkedIn's 60-day window feels generous but is actually a ticking bomb in a system where tasks can silently fail. The partner approval timeline is not documented prominently -- developers discover it only when they try to go to production.

**How to avoid:**
- Run token health checks daily (not just on use). A scheduled Trigger.dev task checks all tokens' `expires_at` and refreshes anything expiring within 7 days.
- Alert users at 14 days, 7 days, and 3 days before token expiry if automated refresh fails. WhatsApp notification: "Your LinkedIn token expires in 3 days. Run `/psn:auth linkedin` to reconnect."
- Apply for LinkedIn partner program immediately during project setup, before writing any LinkedIn-specific code. Document the expected 2-6 week wait. Build LinkedIn features behind a feature flag that only activates when API access is confirmed.
- Have a graceful degradation path: if LinkedIn token is expired, skip LinkedIn in the posting flow rather than failing the entire multi-platform post.

**Warning signs:**
- LinkedIn API returning 401s that don't resolve with retry
- No LinkedIn partner approval confirmation email after 3 weeks
- Users not running `/psn:auth` commands when notified

**Phase to address:**
Phase 1 for token infrastructure. LinkedIn partner application should start in Phase 0 (pre-development). LinkedIn-specific features gated until approval received.

---

### Pitfall 3: Instagram's 200 req/hr Rate Limit Starvation

**What goes wrong:**
Instagram slashed API rate limits from 5,000 to 200 requests/hour in 2025 -- a 96% reduction. A system that posts, collects analytics, monitors engagement, and checks hashtags for a single account can easily burn through 200 requests in minutes. For a company hub with multiple team members triggering analytics refreshes, the budget is exhausted almost immediately.

**Why it happens:**
Developers build features in isolation (posting works, analytics works, hashtag research works) and never test the combined request budget. Each feature seems reasonable on its own; together they starve each other.

**How to avoid:**
- Implement a per-platform rate limit budget tracker in the database. Each API call decrements from a shared hourly budget. When budget hits 20%, only critical operations (posting, token refresh) proceed.
- Batch analytics collection into a single daily or twice-daily sweep rather than per-post polling.
- Cache hashtag search results aggressively (30 hashtags/week limit anyway).
- Never let user-initiated commands (like `/psn:analytics`) trigger real-time API calls to Instagram. Always serve from cached DB data, with background refresh.
- Use webhooks where available instead of polling (Instagram supports webhooks for comments and mentions).

**Warning signs:**
- Instagram API returning HTTP 429 responses
- Analytics data gaps during high-activity periods
- Posts failing to publish because the rate limit was consumed by analytics collection

**Phase to address:**
Phase 1 for the rate limit budget system. Every subsequent phase that adds Instagram API calls must deduct from the budget.

---

### Pitfall 4: TikTok Audit Bottleneck -- Building on Quicksand

**What goes wrong:**
TikTok's Content Posting API requires an audit to unlock public posting. Without the audit, your app is limited to 5 users posting privately in a 24-hour window. Developers build full TikTok posting flows, demo them, and then discover the audit takes "several days to two weeks" -- and can be rejected, requiring resubmission. Meanwhile, all TikTok code sits unusable.

**Why it happens:**
TikTok's developer docs bury the audit requirement. The API works in sandbox (private posting), giving a false sense of completion. In 2025, TikTok tightened the approval process further, requiring more details about app usage and data handling.

**How to avoid:**
- Apply for TikTok API audit in Phase 0, alongside LinkedIn partner approval.
- Build TikTok features with an explicit "sandbox mode" that works with private posts during development. Test the full flow (upload, status check, publish) against the sandbox.
- Design the platform abstraction layer so TikTok can be enabled/disabled without affecting other platforms. This is already in the architecture (platform-aware by default) -- enforce it rigorously.
- Have a backup analytics path via EnsembleData or TikTok Creative Center for analytics even if posting API approval is delayed.

**Warning signs:**
- No audit submission within first week of development
- TikTok API returning `SELF_ONLY` viewership on all posts
- Audit feedback requesting changes to your data handling description

**Phase to address:**
Phase 0 (application submission). Phase 1 builds TikTok features in sandbox mode. TikTok public posting unlocked when audit passes.

---

### Pitfall 5: Drizzle ORM RLS Policies Silently Failing

**What goes wrong:**
Drizzle ORM has documented bugs with Row-Level Security (RLS). Using `drizzle-kit push` does not apply RLS policies correctly -- only `generate` + `migrate` works. Worse: if you don't explicitly declare RLS in your Drizzle schema, `drizzle-kit push` will delete all existing RLS policies and disable RLS on your tables without warning. And RLS is completely bypassed when connecting as the `postgres` superuser role, which is the default for most ORMs.

**Why it happens:**
RLS in Postgres is powerful but operates at the connection role level, not the query level. ORMs default to superuser connections. Drizzle's RLS support is relatively new and has known edge cases. Developers test with the superuser role, see data correctly isolated (because their application logic filters it), and never realize RLS is not actually enforcing anything.

**How to avoid:**
- Never use `drizzle-kit push` in production. Always use `drizzle-kit generate` followed by `drizzle-kit migrate`.
- Create a dedicated non-superuser database role for application connections. RLS only applies to non-superuser roles.
- Use Drizzle's `crudPolicy` helper from `drizzle-orm/neon` rather than raw `pgPolicy` definitions -- it reduces boilerplate and error surface.
- Write integration tests that connect as the application role and verify that User A cannot see User B's data. Run these tests in CI.
- Audit RLS policies after every migration by querying `pg_policies` system catalog.

**Warning signs:**
- All queries returning all rows regardless of user context
- `drizzle-kit push` output showing "dropping policy" statements
- Application connecting as `postgres` role in production

**Phase to address:**
Phase 1 (database setup). RLS must be verified working before any multi-user data is stored. The integration test suite for RLS should be in place before Phase 2.

---

### Pitfall 6: AI Content Getting Algorithmically Suppressed

**What goes wrong:**
Instagram launched "authenticity detection" AI in August 2025 that identifies and demotes content appearing "algorithmically optimized." Pinterest lets users "see fewer" AI-generated posts. Meta labels AI content with "Made with AI" tags. Content that reads like AI slop -- even if factually good -- gets buried in feeds. The entire value proposition of an AI-assisted posting system is undermined if the AI assistance makes content less visible.

**Why it happens:**
AI-generated text has detectable patterns: consistent sentence length, hedging language, list-heavy structure, lack of personal anecdotes or specific details. Voice profiles help but still produce text that trained classifiers can flag. The temptation is to generate-and-post with minimal editing, which is exactly what platforms penalize.

**How to avoid:**
- Human-in-the-loop is non-negotiable. The system generates drafts; humans edit before posting. Never auto-publish AI-generated content without review.
- Voice profiles must include "anti-patterns" -- things the AI should NOT do (e.g., "never start with 'In today's fast-paced world'", "never use more than one list per post").
- Include a "naturalness score" in the content review step. Flag posts that have telltale AI markers: consistent paragraph lengths, no contractions, generic conclusions.
- Vary content structure deliberately. Not every LinkedIn post should be a carousel. Not every X thread should follow hook-value-CTA. Randomize formats.
- Mix AI-assisted posts with fully human posts. The learning loop should track which posts get suppressed and feed that back into the voice profile.

**Warning signs:**
- Posts getting significantly lower impressions than historical baseline
- High "reach" but zero engagement (sign of being shown but perceived as spam)
- Instagram "Made with AI" labels appearing on your content
- Declining engagement rate over time despite consistent posting

**Phase to address:**
Continuous, but voice profile calibration in Phase 2 (Content Engine). The learning loop in Phase 3 (Analytics/Intelligence) should specifically track suppression signals.

---

### Pitfall 7: Multi-Step Media Upload Failures Across Platforms

**What goes wrong:**
Every platform requires a different multi-step process for media uploads. Instagram requires: (1) create container with media URL, (2) wait for processing, (3) publish container. TikTok requires: (1) initialize upload, (2) upload chunks, (3) publish. LinkedIn requires: (1) register upload, (2) upload binary, (3) create post referencing the upload. Any step can fail silently (processing stuck, chunk upload timeout, URL inaccessible). A partial failure leaves orphaned uploads consuming quota.

**Why it happens:**
Developers implement the happy path and skip the status-check polling loop. Instagram containers can take 30+ seconds to process; TikTok video processing can take minutes. Without proper status polling with timeouts, the system either hangs or publishes before media is ready (resulting in broken posts).

**How to avoid:**
- Implement a state machine for each platform's upload flow: `INITIALIZED -> UPLOADING -> PROCESSING -> READY -> PUBLISHED`. Persist state in the DB so failed uploads can be retried.
- Poll processing status with exponential backoff and a hard timeout (5 minutes for images, 15 minutes for video). After timeout, mark as failed and notify user.
- Validate media format/dimensions/size BEFORE initiating upload. Each platform has different requirements (Instagram: max 8MB images; TikTok: specific aspect ratios; LinkedIn: 200MB video limit). Reject early rather than fail mid-upload.
- For cross-platform posts, upload to each platform independently. Never block Platform B's upload on Platform A's completion. If Instagram upload fails, LinkedIn and X should still succeed.

**Warning signs:**
- Posts appearing without their media attachments
- Upload tasks stuck in "processing" state for hours
- Orphaned media containers in platform APIs consuming quota

**Phase to address:**
Phase 2 (Content Engine / Posting). The media upload abstraction layer must be platform-specific with shared retry semantics.

---

### Pitfall 8: Trigger.dev Task State Inconsistency and Stuck Runs

**What goes wrong:**
Trigger.dev has documented production incidents where runs get dequeued from Redis but not transitioned to `PENDING_EXECUTING` in Postgres. These runs become permanently stuck -- never executing, never timing out. For a scheduling system where posts must go out at specific times, a stuck run means a missed post with no notification.

Additional gotchas: you cannot perform more than one `wait` in parallel (the task server suspends after a wait), and environment variables must be set in the Trigger.dev dashboard separately from your app.

**Why it happens:**
Trigger.dev is relatively young infrastructure. The Run Engine crash scenario (dequeued but not state-transitioned) is a distributed systems consistency problem. The "no parallel waits" limitation is architectural and not obvious from the docs.

**How to avoid:**
- Implement a "post watchdog" scheduled task that runs every 15 minutes: query `posts` table for entries with `scheduled_at` in the past and `status = 'scheduled'`. If found, the Trigger.dev run likely failed silently -- re-trigger the post and alert the user.
- Never use parallel waits in Trigger.dev tasks. Chain waits sequentially or split into separate tasks that trigger each other.
- Set TTL on all delayed runs. A post scheduled for 9:00 AM with a 30-minute TTL will auto-expire at 9:30 AM rather than executing hours late.
- Store Trigger.dev run IDs in the `posts` table so you can cross-reference stuck runs with missed posts.
- Mirror all environment variables from `.env` to Trigger.dev dashboard during setup. Add a `/psn:setup` verification step that checks env var parity.

**Warning signs:**
- Posts not publishing at scheduled times with no error logged
- Trigger.dev dashboard showing runs stuck in "queued" or "executing" state
- Increasing count of runs with no completion timestamp

**Phase to address:**
Phase 1 (Infrastructure). The watchdog task should be one of the first Trigger.dev tasks implemented. The TTL and run-ID tracking patterns should be established before any feature tasks are built.

---

### Pitfall 9: Two-Hub Architecture Data Consistency Nightmares

**What goes wrong:**
The Personal Hub and Company Hub are separate databases. Brand Ambassador posts require reading the company's brand voice while writing to the personal analytics. Cross-hub reads introduce latency, failure modes (one hub up, one down), and subtle consistency bugs. Example: user drafts a Brand Ambassador post, company admin changes brand guidelines, post publishes with stale guidelines.

**Why it happens:**
The two-hub split is architecturally sound for data ownership but creates a distributed system. Developers underestimate the complexity of cross-database reads and the staleness window for cached data.

**How to avoid:**
- Accept eventual consistency for cross-hub data. Brand voice profiles are local YAML files (already in the architecture). This is the right call -- keep it local, sync manually when company guidelines change.
- Never perform real-time cross-hub database queries during the posting flow. All data needed for posting must be available locally or in the user's personal hub.
- For company posting (not Brand Ambassador), the Trigger.dev task runs against the Company Hub directly. No cross-hub needed.
- Brand Ambassador scenario: company brand config is synced to local YAML during `/psn:company sync`. The local file is the source of truth for content generation. Analytics go to both hubs via separate Trigger.dev tasks (fire-and-forget to company hub).
- If a hub is unreachable, fail fast with a clear error. No retry queue, no local fallback (per PRD). This is correct -- keep it simple.

**Warning signs:**
- Trigger.dev tasks making API calls to two different Neon databases in a single run
- Brand Ambassador posts using stale company voice guidelines
- Users confused about which hub owns what data

**Phase to address:**
Phase 1 (Architecture). The hub boundary rules must be established before any cross-hub features are built. Phase 3 (Brand Ambassador) needs explicit cross-hub data flow documentation.

---

### Pitfall 10: WAHA/WhatsApp Notification Fragility

**What goes wrong:**
WAHA's WEBJS engine runs a headless Chromium browser per session, consuming significant RAM. The NOWEB engine is lighter but WhatsApp can detect and block it. Sessions disconnect after idle periods. If the notification system goes down, users miss approval requests, engagement alerts, and token expiry warnings -- silently.

**Why it happens:**
WAHA is an unofficial WhatsApp API. It works by automating WhatsApp Web or reverse-engineering the WebSocket protocol. Both approaches are inherently fragile. WhatsApp actively combats unofficial API usage.

**How to avoid:**
- Treat WhatsApp notifications as best-effort, not guaranteed delivery. Every critical notification must have a fallback: CLI output on next command run, or a `/psn:notifications` command that shows pending notifications from the DB.
- Use WAHA's WEBJS engine (most stable) and allocate sufficient RAM (500MB+ per session).
- Implement health checks: a Trigger.dev scheduled task pings WAHA every 5 minutes. If 3 consecutive pings fail, log a warning and switch to "notification backlog" mode.
- Consider Twilio WhatsApp as the production fallback for users who need reliable notifications. WAHA for cost-conscious users who accept occasional drops.
- Store all notifications in the DB regardless of delivery status. The notification is the record; WhatsApp is just the transport.

**Warning signs:**
- WAHA container restarting frequently (check Docker logs)
- WhatsApp sessions disconnecting and requiring QR code re-scan
- Users not responding to approval requests (they might not be receiving them)
- RAM usage spiking on the WAHA host

**Phase to address:**
Phase 3 (Notifications). Build the notification storage layer first, WhatsApp delivery second. The DB-backed notification queue ensures nothing is lost even if WhatsApp delivery fails.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding platform-specific logic instead of abstraction layer | Faster initial development | Every new platform feature requires changes in 4 places. Bug fixes missed on 1 platform. | Never. The abstraction layer is Phase 1. |
| Storing OAuth tokens in `.env` files instead of encrypted DB | Simpler initial setup | Tokens can't be refreshed by Trigger.dev tasks. No token health monitoring. No multi-device support. | Only during initial local development (first week). |
| Skipping media format validation before upload | Faster posting flow | Failed uploads at platform API level, orphaned containers, wasted rate limit budget. | Never. Validate locally first. |
| Using `drizzle-kit push` in production | Faster iteration | Silent RLS policy deletion, data exposure risk. | Never in production. Only acceptable in local dev. |
| Polling for analytics instead of webhooks | Simpler implementation | Burns rate limit budget, especially on Instagram (200 req/hr). | MVP only, for platforms without webhook support. Replace with webhooks by Phase 3. |
| Single retry with no backoff | Less code | Rate limit exhaustion, token refresh failures, cascading failures during platform outages. | Never. Exponential backoff from day 1. |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| X API (OAuth 2.0) | Using refresh token without mutex, causing token invalidation | Postgres row-level lock on token refresh. Dedicated refresh task, not inline refresh. |
| X API (posting) | Not handling pay-per-use billing edge cases (payment method expired) | Check for 402/payment-related errors. Alert user immediately. |
| LinkedIn API | Assuming posting API is available without partner approval | Apply for partner program first. Gate all LinkedIn code behind feature flag. |
| LinkedIn API | Not refreshing tokens proactively before 60-day expiry | Daily token health check task. Alert at 14/7/3 days before expiry. |
| Instagram API | Treating 200 req/hr as "per endpoint" (it's per account, globally) | Centralized rate limit budget tracker shared across all Instagram operations. |
| Instagram API | Publishing container before processing completes | Poll container status with backoff. Only publish when status is `FINISHED`. |
| TikTok API | Building posting flow before audit approval | Submit audit application immediately. Build in sandbox mode (private posts). |
| TikTok API | Not handling chunked upload for videos > 64MB | Implement chunked upload from day 1. Non-chunked only works for small files. |
| Neon Postgres | Connecting as `postgres` superuser, bypassing RLS | Create dedicated `app_user` role. All application connections use this role. |
| Neon Postgres (free tier) | Not handling cold start latency (auto-suspend after 5 min idle) | Set connection timeout to 10 seconds. Cold starts are ~500ms-1s but can compound with DNS. |
| Trigger.dev | Setting environment variables only in `.env`, not in dashboard | `/psn:setup` must sync env vars to Trigger.dev dashboard. Verify with a test task. |
| Trigger.dev | Using parallel waits in a single task | Chain waits sequentially or split into separate tasks that trigger each other. |
| WAHA | Using NOWEB engine for reliability | Use WEBJS engine. Accept the higher RAM cost for stability. |
| Drizzle ORM | Using `drizzle-kit push` which silently drops RLS policies | Always use `drizzle-kit generate` + `drizzle-kit migrate` in production. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling all platform APIs for analytics on every `/psn:analytics` call | Slow command response, rate limits hit | Serve from DB cache. Background task refreshes periodically. | Immediately for Instagram (200 req/hr). Within weeks for X (pay-per-use costs add up). |
| Storing full media files in git repo without pruning | Git clone becomes multi-GB, slow operations | Auto-prune: published drafts after 14 days, media after 7 days post-publishing (per PRD). | After 1-2 months of active use with image/video content. |
| Running all Trigger.dev tasks on the same schedule (e.g., every 5 min) | Burst API usage, rate limit exhaustion, task queue congestion | Stagger task schedules. Analytics at :00, engagement at :15, trends at :30. | At 3+ connected platforms with active monitoring. |
| Querying analytics for "all time" without pagination | Slow DB queries, high Neon compute usage | Default to last 30 days. Paginate historical queries. Pre-aggregate weekly/monthly rollups. | After 3-6 months of data accumulation. |
| Generating AI content synchronously during `/psn:post` | Command blocks for 10-30 seconds during generation | Generate drafts asynchronously via `/psn:draft`. `/psn:post` only publishes ready content. | Immediately noticeable, but tolerable for single posts. Painful for batch operations. |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing OAuth tokens unencrypted in DB | Database breach exposes all connected social accounts | Encrypt tokens at rest using a key derived from user's master secret. Decrypt only at API call time. |
| Committing `hub.env` or `connections/*.env` to git | API keys and DB credentials exposed in repo history | `.gitignore` must include these from project initialization. `/psn:setup` verifies gitignore rules. |
| Using Neon connection string with superuser role in Trigger.dev env | Trigger.dev tasks bypass RLS, can access any user's data | Create a scoped `trigger_user` role with RLS enforcement. Never share superuser credentials with task runners. |
| Not validating invite codes server-side | Anyone with a valid-looking code format can join a company hub | Invite codes must be cryptographically random, single-use, and validated against the company hub DB before granting access. |
| Storing WhatsApp session tokens without encryption | WAHA session hijacking if server compromised | Encrypt WAHA session data at rest. Run WAHA in an isolated container with minimal permissions. |
| API keys in Claude Code command output | Keys visible in terminal scrollback, logs, or screen shares | Never echo full API keys. Mask to last 4 characters. `/psn:config show` should mask all secrets. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Voice profiling onboarding taking 15+ minutes | Users abandon setup before completing. Incomplete voice profiles produce generic content. | Progressive profiling: start with 3 core questions (2 min). Refine voice over first 5 posts based on edits. "Your voice profile improves as you use the system." |
| Showing raw API errors from platforms | Users see "Error 429" or "Invalid grant" with no actionable guidance. | Map every platform error to a human-readable message with a specific recovery action. "Instagram rate limit reached. Your post is queued and will retry in 1 hour." |
| Requiring platform-specific knowledge for posting | Users need to know Instagram carousel limits, X character counts, TikTok aspect ratios. | Validate content against platform requirements automatically. "This image is 2000x2000 but TikTok requires 9:16. Crop or choose a different image." |
| Notification fatigue from engagement alerts | Users disable notifications entirely, missing critical ones (token expiry, approval requests). | Tiered notification priority: CRITICAL (token expiry, failures) always delivered. ENGAGEMENT (likes, comments) delivered as daily digest. User controls the threshold. |
| No feedback on voice profile quality | Users don't know if their voice profile is actually producing better content. | After 10 posts, show a "voice accuracy" report: "Posts matching your voice profile get 2.3x more engagement than generic posts." |
| Multi-hub confusion for team members | Users don't understand which hub they're posting to, or where their data lives. | Always show context in prompts: "Posting as: [Your Name] for [Acme Corp] on LinkedIn". Color-code personal vs. company in CLI output. |

## "Looks Done But Isn't" Checklist

- [ ] **OAuth flow:** Often missing token refresh error handling -- verify that expired refresh tokens trigger re-auth notification (not silent failure)
- [ ] **Scheduled posting:** Often missing timezone handling -- verify posts schedule in the user's local timezone, not UTC
- [ ] **Analytics collection:** Often missing rate limit awareness -- verify that analytics collection respects the shared per-platform rate limit budget
- [ ] **Media upload:** Often missing format validation -- verify that unsupported formats are rejected before upload attempt, not after
- [ ] **RLS policies:** Often missing non-superuser testing -- verify queries return filtered data when connected as `app_user` role, not `postgres`
- [ ] **Cross-platform posting:** Often missing partial failure handling -- verify that if Instagram fails, X and LinkedIn still succeed and user is notified of the Instagram failure specifically
- [ ] **Voice profiles:** Often missing language-specific sections -- verify that bilingual users have independent EN and ES voice sections (not translations)
- [ ] **Company hub invites:** Often missing invite code expiration -- verify codes expire after 7 days and cannot be reused
- [ ] **Trigger.dev delayed runs:** Often missing TTL -- verify that scheduled posts have a TTL so they don't execute hours late
- [ ] **Notification delivery:** Often missing delivery confirmation -- verify that notification records in DB track whether WhatsApp delivery succeeded

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Token refresh race condition (lost refresh token) | LOW | User re-authenticates via `/psn:auth <platform>`. No data loss. Annoying but recoverable. |
| RLS policies silently deleted by `drizzle-kit push` | HIGH | Audit `pg_policies`. Regenerate and apply migrations. Audit access logs for any unauthorized data access during the exposure window. |
| Stuck Trigger.dev runs causing missed posts | MEDIUM | Watchdog task detects and re-triggers. Post goes out late. User notified. No data loss but timing damage. |
| Instagram rate limit exhaustion | LOW | Wait 1 hour for reset. No account ban when using official API. Queued operations resume automatically. |
| TikTok audit rejection | MEDIUM | Revise application based on feedback. Resubmit. 1-2 week delay. No code changes needed if sandbox mode was used. |
| WAHA session disconnected | LOW | Re-scan QR code. Notifications queued in DB are delivered on reconnection. |
| AI content suppressed by platform | MEDIUM | Revise voice profile anti-patterns. Increase human editing in the review step. Recovery takes 2-4 weeks of improved posting behavior. |
| Two-hub data inconsistency | LOW | `/psn:company sync` re-syncs brand config from company hub. No automated cross-hub writes means no complex conflict resolution. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth token refresh race conditions | Phase 1 (Foundation) | Integration test: two concurrent refresh attempts on same token. Only one succeeds. |
| LinkedIn 60-day token cliff | Phase 0 (pre-dev) + Phase 1 | Scheduled task runs daily. Token refreshed >7 days before expiry. Test by setting a fake short expiry. |
| Instagram rate limit starvation | Phase 1 (Foundation) | Load test: simulate posting + analytics + hashtag search within 200 req/hr budget. All operations complete. |
| TikTok audit bottleneck | Phase 0 (application) | Audit application submitted. Sandbox posting verified. Public posting tested post-approval. |
| Drizzle RLS silent failure | Phase 1 (Database) | CI test: connect as `app_user`, query for another user's data, assert empty result set. |
| AI content suppression | Phase 2 (Content) + Phase 3 (Analytics) | Track engagement rates per post. Flag posts with impressions >50% below 30-day average for review. |
| Multi-step media upload failures | Phase 2 (Posting) | Test upload flow for each platform with: valid image, valid video, oversized file, wrong format. All fail gracefully. |
| Trigger.dev stuck runs | Phase 1 (Infrastructure) | Watchdog task runs every 15 min. Test by manually stalling a run. Verify re-trigger within 15 min. |
| Two-hub data consistency | Phase 1 (Architecture) | Document and enforce: no real-time cross-hub DB queries in posting flow. Code review checklist item. |
| WAHA notification fragility | Phase 3 (Notifications) | Health check task pings WAHA every 5 min. Simulate WAHA downtime. Verify notifications queued and delivered on recovery. |

## Sources

- [X OAuth 2.0 refresh token failure thread](https://devcommunity.x.com/t/oauth-2-0-refresh-token-failure-continuing/177272)
- [Nango: Concurrency with OAuth token refreshes](https://nango.dev/blog/concurrency-with-oauth-token-refreshes)
- [LinkedIn: Programmatic Refresh Tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens)
- [Instagram API rate limit reduction analysis](https://www.marketingscoop.com/marketing/instagrams-api-rate-limits-a-deep-dive-for-developers-and-marketers-in-2024/)
- [TikTok Content Posting API guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
- [Drizzle ORM RLS documentation](https://orm.drizzle.team/docs/rls)
- [Drizzle RLS push vs migrate bug](https://github.com/drizzle-team/drizzle-orm/issues/3504)
- [Neon: Simplify RLS with Drizzle](https://neon.com/docs/guides/rls-drizzle)
- [Trigger.dev incident report Sep 26, 2025](https://trigger.dev/blog/incident-report-sep-26-2025)
- [Trigger.dev common problems](https://trigger.dev/docs/troubleshooting)
- [Neon connection latency docs](https://neon.com/docs/connect/connection-latency)
- [Instagram authenticity detection and AI content demotion](https://www.socialmediatoday.com/news/meta-announces-updates-for-the-instagram-marketing-api/807083/)
- [WAHA GitHub issues - session reliability](https://github.com/devlikeapro/waha/issues/1090)
- [X API v2 community posting 403 bug (Feb 2026)](https://devcommunity.x.com/t/api-v2-403-forbidden-on-community-posting-community-id-payload-despite-pay-per-use-tier-and-prior-functionality-feb-17-2026/257434)

---
*Pitfalls research for: CLI-first social media automation (Post Shit Now)*
*Researched: 2026-02-18*
