# Domain Pitfalls

**Domain:** CLI-first social media automation (multi-platform posting, analytics, AI content generation)
**Researched:** 2026-02-18

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or project-killing blockers.

---

### Pitfall 1: OAuth Token Refresh Fails Silently, Posts Never Go Out

**What goes wrong:** LinkedIn tokens expire every 60 days. Instagram tokens expire similarly. The token-refresher task fails (Trigger.dev downtime, Neon cold start, network blip) and nobody notices until scheduled posts silently fail because the stored token is stale. Worse: the refresh token itself expires after 365 days (LinkedIn) if never exercised, requiring full re-authorization.

**Why it happens:** Token refresh is a background task that runs infrequently. No human is watching it. The failure mode is silent -- the token just stops working, and the posting task gets a 401, which may be retried but will keep failing.

**Consequences:** Scheduled posts for an entire company hub silently fail. Users discover days later that nothing was posted. For LinkedIn specifically, if the refresh token also expires, the user must re-authenticate through the full OAuth flow again -- which for company pages means an admin must do it.

**Prevention:**
- Token health check: a scheduled task that proactively tests tokens (lightweight API call) at least weekly, not just when posting.
- Alert immediately on any 401 from a platform API -- this is a P0 notification, not a digest item.
- Store `token_expires_at` in the `oauth_tokens` table and refresh at 50% lifetime (30 days for LinkedIn), not at expiry.
- WhatsApp notification on token health failures with a direct link/command to re-authorize.
- Log last successful refresh timestamp. Alert if refresh hasn't succeeded in >7 days.

**Detection:** Posts stuck in "pending" status with no published confirmation. 401 errors in Trigger.dev run logs.

**Phase relevance:** Phase 1 (token-refresher must ship with LinkedIn support). This is not a "nice to have" -- it is load-bearing infrastructure.

---

### Pitfall 2: RLS Policies Tested with Superuser, False Security in Production

**What goes wrong:** During development, you test RLS policies using the database owner or superuser role. Everything "works" -- you can see the right rows. But superusers and table owners bypass RLS by default. In production, if tasks connect as the table owner (common with Drizzle migrations using the same connection string), RLS is silently bypassed and all data is visible to all queries.

**Why it happens:** PostgreSQL's `BYPASSRLS` privilege is implicit for superusers and table owners. Developers test with the same credentials used for migrations. Neon's default connection role is often the database owner.

**Consequences:** Complete multi-tenant data leak. User A's posts, analytics, and OAuth tokens visible to User B's queries. This is a security incident, not a bug.

**Prevention:**
- Create separate Postgres roles: one for migrations (owner), one for application queries (restricted). Drizzle migrations use the owner role; Trigger.dev tasks and commands use the restricted role.
- Add `FORCE ROW LEVEL SECURITY` on every table with RLS. This forces policies even for the table owner.
- Use `SET LOCAL` with session variables (e.g., `app.current_hub_id`) for tenant context, not `current_user` (which is meaningless with connection pooling).
- Integration tests that verify RLS: connect as the restricted role, set tenant context to Hub A, verify Hub B data is invisible. Run these in CI.
- Never use `drizzle-kit push` in production -- always use generated migration files applied by the owner role.

**Detection:** Write a test that connects as the app role, sets context to one hub, and queries for another hub's data. If it returns rows, RLS is broken.

**Phase relevance:** Phase 1a (database setup). RLS architecture decisions made here are nearly impossible to change later without a full data migration.

---

### Pitfall 3: Platform API Approval Blocks the Entire Roadmap

**What goes wrong:** LinkedIn requires Marketing Developer Platform (MDP) partner approval. TikTok requires a Content Posting API audit. Both take weeks (2-6 weeks reported). You build the integration, demo it to users, and then discover you cannot actually post to production because approval is pending or denied.

**Why it happens:** Developers treat API access as a technical problem. It is actually a business/compliance problem with unpredictable timelines and no guaranteed approval.

**Consequences:** LinkedIn integration sits unusable for weeks. TikTok integration is limited to 5 users posting private-only content until audit passes. Users lose confidence in the product. Roadmap slips.

**Prevention:**
- Apply for LinkedIn MDP and TikTok Content Posting API audit on day one of the project, before writing any integration code. The approval process is independent of your code.
- Build X integration first (pay-per-use API has no approval gate beyond signup).
- Design the platform abstraction layer so disabled platforms cost zero effort. Never block features on "all platforms ready."
- Document the approval status in a visible place (`config/platform-status.yaml` or similar). Commands should check this and show clear messages like "LinkedIn: awaiting API approval" instead of cryptic errors.
- For TikTok: plan for the audit restrictions. Unaudited clients can only allow 5 users to post in a 24-hour window, and only with `SELF_ONLY` viewership (private posts).

**Detection:** If you haven't applied for LinkedIn MDP and TikTok audit within the first week of the project, you are already behind.

**Phase relevance:** Phase 0 (pre-development). This is a blocking dependency that runs in parallel with all development.

---

### Pitfall 4: Instagram 200 req/hr Rate Limit Exhausted by Analytics, Blocking Posting

**What goes wrong:** Instagram's rate limit is 200 API calls per hour per connected account. Analytics collection, trend monitoring, engagement checks, and actual posting all share this budget. A single analytics sweep that checks 50 posts burns 25% of the hourly budget. Add engagement monitoring and you have no room left for the actual posting workflow (create container, check status, publish = 3+ calls minimum).

**Why it happens:** Developers think of rate limits as "per endpoint" but Instagram's limit is global across all API calls for an account. The analytics collector runs on a cron and doesn't coordinate with the posting scheduler.

**Consequences:** Posting fails with rate limit errors during peak hours. Analytics data is incomplete because the collector backs off. Users see inconsistent data and failed posts.

**Prevention:**
- Implement a per-account API budget tracker. Each Trigger.dev task checks remaining budget before making calls. Store call counts in the database with hourly windows.
- Priority system: posting > engagement > analytics. If budget is low, defer analytics to off-peak hours.
- Batch analytics collection: fetch multiple post insights in a single API call where the API supports it.
- Failed API calls count against the rate limit too. Implement circuit breakers -- after 2 consecutive failures, stop retrying for that account until the next hour window.
- For accounts with heavy usage, space analytics collection across multiple hours rather than one burst.

**Detection:** Monitor rate limit headers (`x-app-usage`) from Instagram API responses. Alert when usage exceeds 70% of hourly budget.

**Phase relevance:** Phase 2 (analytics collector) and Phase 5 (Instagram platform addition). The budget tracker must exist before Instagram goes live.

---

### Pitfall 5: AI Content Gets Flagged as "AI Slop" and Suppressed by Algorithms

**What goes wrong:** Platform algorithms increasingly detect and suppress AI-generated content. As of 2026, AI content accounts for 57% of online material and platforms are actively separating it. Meta uses invisible watermarking. Pinterest applies AI-generated labels automatically via metadata and image classifiers. Content that reads like generic AI output gets reduced reach or explicit labeling.

**Why it happens:** The voice profile is undertrained (Path B: no existing content to calibrate from). The learning loop hasn't accumulated enough edit history. Users skip the review step and auto-approve AI drafts. Generated images carry EXIF metadata or C2PA provenance markers from the AI generator.

**Consequences:** Posts get dramatically reduced reach. Some platforms add visible "AI-generated" labels. Followers disengage because content feels generic. The system's value proposition ("grow your social media") is undermined.

**Prevention:**
- Human-in-the-loop is non-negotiable. Never allow fully automated posting without explicit user review and edit. The `/psn:post` flow must always show the draft and wait for confirmation.
- Voice profile calibration: Path A (existing content) should require minimum 10 posts analyzed. Path B should require feedback every 3 posts for the first 15 posts.
- Track edit distance between AI draft and final posted version. If users consistently make heavy edits, surface this in `/psn:review` as a signal to retrain the voice profile.
- Strip EXIF metadata and C2PA provenance markers from AI-generated images before uploading. This is a technical step in the media upload pipeline.
- Never use AI-generated hashtags without human review. Generic hashtag sets are a strong AI signal.
- For AI-generated images: use platform-appropriate styles. Photorealistic AI images get the most scrutiny; illustrated/designed styles get less.

**Detection:** Engagement rate drops significantly compared to human-written posts. Platform-specific signals: reduced impressions on LinkedIn carousels, lower reach rate on Instagram Reels.

**Phase relevance:** Phase 1 (voice profile setup) and Phase 2 (learning loop). The learning loop is the core defense against AI slop -- it must ship early.

---

### Pitfall 6: Drizzle Migration State Diverges Between Personal Hub and Company Hubs

**What goes wrong:** The repo ships migration files. `/psn:setup` runs pending migrations on all connected hubs. But a user updates the repo (git pull) while a Company Hub admin hasn't. Now the user's local schema expectations don't match the Company Hub's actual schema. Queries fail or return wrong data. Worse: if two team members run migrations at the same time, they can corrupt the migration state.

**Why it happens:** Distributed database ownership. Personal Hub migrations are controlled by one user. Company Hub migrations might be run by any team member who pulls the latest repo. Drizzle Kit tracks migration state in a `__drizzle_migrations` table, but concurrent migration runs are not safe.

**Consequences:** Schema mismatches cause runtime errors. Data written with the wrong schema expectations can be silently corrupted. Rolling back is manual and error-prone (Drizzle does not have built-in rollback).

**Prevention:**
- Migration locking: before running migrations on a Company Hub, acquire an advisory lock (`pg_advisory_lock`). If another process holds the lock, wait or abort with a clear message.
- Version check: store a schema version in the database (separate from Drizzle's migration table). Commands check this version on startup and warn if the local schema version doesn't match the connected hub.
- Only admins run Company Hub migrations. Team members' `/psn:setup` should check for pending migrations but warn instead of auto-applying on Company Hubs.
- Never modify existing migration files. Always generate new migrations for changes. The fixes.md already documents this but it bears repeating as a runtime pitfall.
- JSONB columns with default values: known Drizzle Kit bug where `push` fails. Avoid `push` entirely; always use `generate` + `migrate`.

**Detection:** `/psn:setup` should compare local schema version against each connected hub and surface mismatches immediately.

**Phase relevance:** Phase 1a (migration infrastructure) and Phase 3 (Company Hub with multiple team members).

---

## Moderate Pitfalls

---

### Pitfall 7: Trigger.dev Free Tier Schedule Limit Hits Multi-Hub Users

**What goes wrong:** Trigger.dev free tier allows 10 schedules per project. A single hub needs at minimum: analytics-collector (daily), token-refresher (weekly per platform), trend-collector (daily), engagement-monitor (hourly), notification-digest (daily). That is 5 schedules for one hub. A user with a Personal Hub + 1 Company Hub = 10 schedules, hitting the limit exactly. Add a second company and you are over.

**Prevention:**
- Design schedules to be hub-aware: one `analytics-collector` schedule that iterates over all connected hubs, not one schedule per hub.
- Document the free tier ceiling honestly. Users with 2+ Company Hubs need the paid tier (~$30/mo per Trigger.dev project).
- Use delayed runs (one-off scheduled executions) for infrequent tasks instead of cron schedules. Delayed runs don't count against the schedule limit.
- Consolidate: one "maintenance" cron that triggers sub-tasks for token refresh, cleanup, and health checks.

**Phase relevance:** Phase 1a (Trigger.dev setup). Architecture decision about schedule design must account for this from day one.

---

### Pitfall 8: WhatsApp Account Ban from WAHA Usage

**What goes wrong:** WAHA is an unofficial WhatsApp API. WhatsApp actively bans accounts using unofficial clients. A user sets up WAHA for notifications, it works for weeks, then their WhatsApp number gets permanently banned. They lose their personal WhatsApp account.

**Prevention:**
- Use a dedicated WhatsApp number for WAHA, never a personal number.
- Offer Twilio as the default, safer alternative. WAHA should be documented as "power user, at your own risk."
- Implement rate limiting on outbound messages: max 10 notifications/hour, max 50/day. WhatsApp's anti-abuse detection triggers on burst messaging patterns.
- If the account gets banned, the system should fall back to another notification channel (email, Trigger.dev dashboard alerts) automatically.
- Consider making WhatsApp notifications optional and starting with simpler notification channels.

**Phase relevance:** Phase 4 (notifications). This is a design decision, not a bug -- choose the default notification channel carefully.

---

### Pitfall 9: X Pay-Per-Use API is Still Closed Beta

**What goes wrong:** The PRD assumes X pay-per-use API at $0.01/post. As of December 2025, this is a closed beta pilot program with no guarantee of becoming permanent. If the beta doesn't expand or gets canceled, X API access falls back to the $200/month Basic tier or the extremely limited Free tier (1,500 tweets read/month, 1 app).

**Prevention:**
- Build the X integration against the current Free tier as a baseline (limited but functional for low-volume users).
- Abstract the API client so switching from Free to Basic to pay-per-use requires only configuration changes, not code changes.
- Monitor the official @XDevelopers account for announcements about broader rollout.
- Budget documentation should note: "X costs depend on API tier. Free tier: limited. Pay-per-use: in beta. Basic: $200/mo."
- Do not promise specific per-post costs in user-facing documentation until the pricing is GA.

**Phase relevance:** Phase 1 (X integration). The abstraction should handle tier differences from the start.

---

### Pitfall 10: Connection Pooling Breaks RLS Session Variables

**What goes wrong:** Neon uses connection pooling by default. RLS policies that rely on `SET LOCAL` session variables (e.g., `app.current_hub_id`) are scoped to a transaction. If a query runs outside an explicit transaction, or if the connection is reused from the pool, the session variable from a previous request leaks into the next one -- potentially showing another tenant's data.

**Prevention:**
- Always wrap hub-scoped queries in an explicit transaction that sets the session variable first: `BEGIN; SET LOCAL app.current_hub_id = 'xxx'; SELECT ...; COMMIT;`.
- Use Neon's connection pooling in "transaction mode" (the default), which resets session state between transactions.
- Create a Drizzle helper function that automatically wraps queries with the correct session variable. Never let raw queries bypass this wrapper.
- Test for session variable leakage: run two concurrent queries for different hubs and verify isolation.

**Phase relevance:** Phase 1a (database layer). This must be baked into the query abstraction layer from the first query.

---

### Pitfall 11: Media Upload Pipeline Fails Mid-Upload with No Recovery

**What goes wrong:** Every platform uses multi-step media uploads: (1) register/create container, (2) upload binary, (3) check processing status, (4) attach to post. If step 2 fails (network timeout, large video), the container is orphaned. If step 3 takes too long (Instagram video processing can take minutes), the Trigger.dev task times out. Retrying from the beginning wastes API calls and rate limit budget.

**Prevention:**
- Idempotent upload tracking: store the upload state (`container_created`, `binary_uploaded`, `processing`, `ready`) in the database per media item. On retry, resume from the last successful step.
- For video processing polls: use Trigger.dev's `wait` functions (which don't consume concurrency) to poll status at intervals rather than busy-waiting.
- Set reasonable timeouts per platform: Instagram Reels processing can take 2-5 minutes. TikTok video processing is similar.
- Implement a cleanup task that detects orphaned containers (created >1 hour ago, never published) and cancels them.
- Compress and validate media locally before uploading: check dimensions, file size, codec compatibility. Reject unsupported formats with clear error messages before hitting the API.

**Phase relevance:** Phase 1 (media posting) and Phase 5 (Instagram/TikTok with video-heavy formats).

---

### Pitfall 12: Learning Loop Creates Feedback Loops Instead of Improvement

**What goes wrong:** The preference model tracks engagement metrics and adjusts recommendations. But social media engagement is noisy: a post goes viral because of external factors (trending topic, algorithm change), not because of the content format. The learning loop latches onto that format and over-recommends it. Conversely, a great post gets low engagement because of bad timing, and the loop deprioritizes that style.

**Prevention:**
- Normalize engagement metrics: compare against the account's baseline, not absolute numbers. A post with 2x normal engagement is noteworthy regardless of absolute count.
- Minimum sample size: don't adjust the preference model based on fewer than 10 posts in a category. Flag categories with small samples as "insufficient data."
- Decay factor: recent posts weighted more heavily than old ones. Platform algorithms change; what worked 6 months ago may not work now.
- Human override: `/psn:config` must be able to pin preferences regardless of what the learning loop suggests. The loop recommends; the user decides.
- Track confounding variables: posting time, platform algorithm changes, external events. Store these alongside engagement data.

**Phase relevance:** Phase 2 (learning loop design) and Phase 4 (advanced learning). Getting the model design right in Phase 2 prevents a rewrite in Phase 4.

---

### Pitfall 13: Bilingual Content Doubles Complexity Everywhere

**What goes wrong:** Every feature that touches content (posting, analytics, learning loop, idea bank, series, voice profiles) must handle two languages independently. A "simple" feature like tracking best posting times now needs per-language analysis. The preference model needs per-language weights. Notification templates need both languages. The complexity is multiplicative, not additive.

**Prevention:**
- Language is a first-class field on every content-related table from day one. Do not retrofit it.
- Voice profiles already handle this well (language-specific sections). Ensure the preference model mirrors this structure.
- For MVP: support language tagging and per-language voice profiles, but defer per-language analytics breakdowns to Phase 4. Simple language tagging is cheap; language-specific analysis is expensive.
- "Both" (bilingual) posts are the hardest case. Define the rendering format per platform early and stick to it. Don't let each platform implement its own bilingual format.

**Phase relevance:** Phase 1 (schema design must include language fields) through all phases.

---

## Minor Pitfalls

---

### Pitfall 14: Git Repo Bloat from Generated Media

**What goes wrong:** AI-generated images (GPT Image, Flux 2) are large files (1-5MB each). Users generate multiple options, pick one, post it. The rejected images stay in the repo. After a few months, `git clone` takes minutes and the repo is hundreds of MB.

**Prevention:**
- Auto-prune: delete generated media 7 days after posting (already in the PRD). But also delete rejected media immediately after the user picks their choice.
- `.gitignore` the `content/media/` directory entirely. Media is transient -- it exists to be posted, not version-controlled.
- Future phase: move media to cloud storage (S3/R2) as referenced in the PRD.

**Phase relevance:** Phase 1 (directory structure setup). The `.gitignore` rule is a one-line decision with long-term impact.

---

### Pitfall 15: Notification Fatigue Drives Users to Disable All Notifications

**What goes wrong:** The system sends notifications for: scheduled posts going live, engagement opportunities, analytics milestones, token refresh warnings, approval requests, trend alerts. Within a week, users mute the WhatsApp thread and miss the one critical notification (token expired, post failed).

**Prevention:**
- Notification priority tiers: P0 (token failures, post failures) always send immediately. P1 (approval requests, engagement opportunities above threshold) go to digest. P2 (analytics, milestones) go to weekly summary only.
- Auto-calibrating thresholds: start with defaults, then adjust based on user interaction. If a user never acts on engagement notifications, reduce frequency automatically.
- Quiet hours: respect timezone, don't send non-P0 notifications outside 8am-8pm.
- Single daily digest for P1 items, not individual messages. Bundle engagement opportunities into one actionable message.

**Phase relevance:** Phase 4 (notifications). Design the priority system before implementing any notification channel.

---

### Pitfall 16: Unique Constraints in RLS Tables Leak Cross-Tenant Data

**What goes wrong:** A unique constraint on `posts(slug)` is global across all tenants. If User A creates a post with slug "monday-motivation" and User B tries the same slug, the database returns a unique violation error -- revealing that slug exists in another tenant's data.

**Prevention:**
- All unique constraints on RLS-protected tables must include the tenant discriminator column: `UNIQUE(hub_id, slug)` not `UNIQUE(slug)`.
- Audit every unique constraint and index during schema design. This applies to: post slugs, series names, idea titles, any user-facing identifier.

**Phase relevance:** Phase 1a (schema design). Must be correct from the first migration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 0: Pre-development | Platform API approvals block later phases | Apply for LinkedIn MDP + TikTok audit immediately (Pitfall 3) |
| Phase 1a: Database setup | RLS tested with wrong role; unique constraints leak data | Separate migration/app roles; composite unique keys (Pitfalls 2, 10, 16) |
| Phase 1a: Trigger.dev setup | Schedule limit hit with 2+ hubs | Hub-aware consolidated schedules (Pitfall 7) |
| Phase 1: X integration | Pay-per-use API may not be available | Build against Free tier as baseline (Pitfall 9) |
| Phase 1: LinkedIn integration | Token refresh fails silently; approval may be pending | Token health checks, proactive refresh at 50% lifetime (Pitfall 1) |
| Phase 1: Media uploads | Multi-step upload fails mid-process | Idempotent upload state tracking in DB (Pitfall 11) |
| Phase 2: Analytics + learning loop | Instagram rate budget exhausted; learning loop overfits | API budget tracker; minimum sample sizes (Pitfalls 4, 12) |
| Phase 2: Schema design | Language not a first-class field | Add language column to every content table from day one (Pitfall 13) |
| Phase 3: Company Hub + teams | Migration state diverges between team members | Advisory locks, version checks, admin-only migrations (Pitfall 6) |
| Phase 4: Notifications | WhatsApp ban; notification fatigue | Dedicated number, priority tiers, auto-calibration (Pitfalls 8, 15) |
| Phase 5: Instagram/TikTok | Video processing timeouts; rate limits | Use Trigger.dev wait functions; per-account budgets (Pitfalls 4, 11) |
| All phases: AI content | Algorithm suppression; AI detection | Human-in-the-loop mandatory; strip metadata; train voice profiles (Pitfall 5) |

---

## Sources

- [Trigger.dev Limits Documentation](https://trigger.dev/docs/limits) - FREE tier: 10 schedules, 10 concurrent runs, 1-day log retention
- [Trigger.dev Cloud Pricing](https://trigger.dev/pricing)
- [Common Postgres RLS Footguns - Bytebase](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) - 16 specific RLS pitfalls
- [Postgres RLS Implementation Guide - Permit.io](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Neon RLS Documentation](https://neon.com/docs/guides/row-level-security)
- [Drizzle ORM RLS Support](https://orm.drizzle.team/docs/rls)
- [3 Biggest Mistakes with Drizzle ORM](https://medium.com/@lior_amsalem/3-biggest-mistakes-with-drizzle-orm-1327e2531aff)
- [Neon + Drizzle Migrations Guide](https://neon.com/docs/guides/drizzle-migrations)
- [LinkedIn OAuth Refresh Tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens) - 60-day access, 365-day refresh
- [LinkedIn OAuth Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) - Audit required, 5-user limit unaudited
- [Instagram API Rate Limits - Phyllo](https://www.getphyllo.com/post/navigating-instagram-api-rate-limit-errors-a-comprehensive-guide) - 200 req/hr per account
- [X API Pay-Per-Use Announcement](https://devcommunity.x.com/t/announcing-the-x-api-pay-per-use-pricing-pilot/250253) - Closed beta as of Dec 2025
- [OAuth 2.0 Pitfalls - Treblle](https://treblle.com/blog/oauth-2.0-for-apis)
- [Meta AI Content Watermarking](https://www.socialmediatoday.com/news/meta-outlines-invisible-watermarking-ai-generated-content/804700/)
- [AI Content Detection Trends 2025](https://wellows.com/blog/ai-detection-trends/) - 57% of online content is AI-generated
- [Social Media API Integration Complexity - Cloud Campaign](https://www.cloudcampaign.com/blog/social-media-api-integration)
- [WAHA GitHub Repository](https://github.com/devlikeapro/waha) - Unofficial WhatsApp API, ban risk documented
