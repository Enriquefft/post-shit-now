# Project Research Summary

**Project:** Post Shit Now (PSN)
**Domain:** CLI-first social media automation and growth system
**Researched:** 2026-02-18
**Confidence:** HIGH

## Executive Summary

Post Shit Now is a Claude Code-first social media automation system where every interaction happens through slash commands — no web dashboard. Users clone a git repo that becomes their workspace. Background automation runs on Trigger.dev Cloud, data persists in Neon Postgres, and all API costs are BYOK (bring your own keys). The system targets developers who live in the terminal and want to grow on social media without the workflow interruption of browser-based tools like Buffer or Hootsuite. The recommended approach is a staged build: foundation infrastructure first (hub architecture, DB, token management), then the core posting loop (voice profiling, X posting, scheduling), then intelligence and learning features, then team coordination.

The deepest competitive moat is the voice learning loop — a 3-channel feedback system (engagement signals, edit signals, explicit feedback) that evolves the generation model over time. No competitor does this; they all have static "brand voice" uploads. This feature is also the highest-risk: without good voice profiling output, the product is just an inferior Buffer. Voice profiling must be in the Phase 1 critical path and must deliver quality content before any other features are validated. The secondary moat is the BYOK cost model — at scale, PSN costs each user $20-30/month in infrastructure vs $2,000-4,000/month for Sprout Social on a 10-person team.

The biggest risks are external: LinkedIn requires partner API approval (2-6 weeks), TikTok requires an audit for public posting access (1-2 weeks), and Instagram's rate limit dropped 96% to 200 requests/hour in 2025. All three API applications must be submitted in Phase 0 before any platform-specific code is written. Internally, the critical risk is OAuth token refresh race conditions — multiple concurrent Trigger.dev tasks attempting to refresh the same expired token can permanently invalidate refresh tokens, requiring manual re-authentication. This must be solved with a Postgres row-level lock in Phase 1 before any task automation is built.

---

## Key Findings

### Recommended Stack

The stack is well-defined and most decisions are already locked. TypeScript 5.7+ with Node.js 22 LTS is the runtime. Trigger.dev v4 (GA) handles all background automation — delayed runs for scheduled posts, cron tasks for analytics/tokens/trends, and wait-for-token waitpoints for human-in-the-loop approval workflows. Neon Postgres with Drizzle ORM handles persistence, with RLS policies defined declaratively in the schema (not raw SQL). The key Drizzle constraint: always use `drizzle-kit generate` + `drizzle-kit migrate` — never `drizzle-kit push` in production, which silently deletes RLS policies.

For platform clients: `twitter-api-v2` for X (actively maintained, official SDK); raw typed fetch wrappers for LinkedIn, Instagram, and TikTok (no maintained SDK exists for these). OAuth is handled by the `arctic` 3.x library. Instagram OAuth goes through Facebook, so uses the `arctic` Facebook provider with Instagram-specific scopes. Intelligence gathering uses Tavily (quick searches), Exa (semantic search), and Perplexity via the OpenAI-compatible API. Image generation uses GPT Image (versatile), Flux 2 via `@fal-ai/client` (photorealistic), and Ideogram 3.0 via raw REST (text in images). WhatsApp notifications use WAHA (self-hosted Docker, free but ToS risk) with Twilio as the production fallback.

**Core technologies:**
- TypeScript 5.7+ / Node.js 22 LTS: Type safety across CLI scripts, Trigger.dev tasks, Drizzle schemas
- `@trigger.dev/sdk` 4.1.x: Delayed runs, cron tasks, waitpoints — all background automation
- Drizzle ORM 0.45.x + Neon Postgres: SQL-native ORM with declarative RLS, zero query overhead
- `arctic` 3.x: Stateless OAuth 2.0 flows for all 4 platforms (no session-based auth needed)
- `twitter-api-v2` 1.29.x: Only platform with a maintained official SDK
- `zod` 4.x: Validation for task payloads, config files, API inputs (built into drizzle-orm core)
- `sharp`: Image processing/resizing before platform-specific uploads
- `date-fns-tz`: Timezone-correct scheduling (critical — users schedule in local time, platforms need UTC)

### Expected Features

The CLI-first constraint fundamentally changes what counts as "table stakes." Visual drag-and-drop calendars and unified social inboxes are competitors' terrain — PSN must not try to compete there. Text-based structured output for calendar, sequential approval workflows, and git-based draft management are the right CLI-native equivalents.

**Must have for v1 (table stakes for target audience):**
- Voice profiling + content generation in user's voice — without this, users just use ChatGPT directly
- X platform posting and scheduling via Trigger.dev delayed runs — single platform MVP
- Basic analytics collection and `/psn:review` — engagement per post, what worked
- Quick idea capture (`/psn:capture`) — must be under 30 seconds or users won't use it
- Calendar view (`/psn:calendar`) — text-based scheduled post visibility
- Image generation via at least one provider (GPT Image) — visual content is table stakes
- OAuth token management with automatic refresh — broken auth = silent post failures
- Trigger.dev infrastructure: post-scheduler, analytics-collector, token-refresher tasks

**Should have for v1.x (competitive differentiation):**
- Voice learning loop (3-channel: edit signals, engagement signals, explicit feedback)
- Weekly batch planning (`/psn:plan`) with ideation support
- Idea bank with maturity pipeline (spark → seed → ready → claimed → developed → used)
- LinkedIn platform support (after partner API approval)
- Content series system for recurring formats
- Intelligence layer: trend collection from HN, Reddit, Product Hunt, RSS
- Bilingual support (English + Spanish, independently crafted — not translations)
- Content archetypes and pillar balancing

**Defer to v2+:**
- Company Hub and team features (approval workflow, invite codes, RLS team isolation)
- Instagram and TikTok platform support (rate limits and audit make these high-complexity)
- Engagement engine (semi-automated strategic replies with WhatsApp alerts)
- Full WhatsApp interactive notification system (conversation state machine)
- Content remixing and recycling (needs months of published archive first)
- Autonomous learning loop (needs months of preference model data first)
- Brand Ambassador persona (requires both Personal and Company Hubs mature)
- On-demand research Layer 2 (Perplexity/Exa during `/psn:plan`)

**Deliberate non-features (anti-features):**
- Web dashboard or visual calendar — competes on competitors' home turf, always worse
- Social inbox / unified DM management — different product category, API restrictions
- Fully automated posting without human review — AI slop gets algorithmically suppressed in 2026
- Paid ad management — entirely different domain
- Engagement pods / reciprocal liking — ToS violation on all platforms

### Architecture Approach

The architecture follows a strict Command → Script → Hub pipeline. Slash commands (markdown files) are declarative prompts that instruct Claude to invoke thin TypeScript CLI scripts via `npx tsx`. Scripts do exactly one thing each and communicate exclusively through stdout JSON. Scripts interact with hubs — each hub is a Neon Postgres database + a Trigger.dev project with per-hub environment variables. A shared `@psn/core` library contains all Drizzle schemas, API clients, types, and hub connection logic — consumed by both CLI scripts and Trigger.dev tasks, preventing duplication. Personal and Company hubs are always separate databases; never mixed.

**Major components:**
1. **Slash Commands** (`.claude/commands/psn/*.md`) — Declarative prompts guiding Claude through workflows. No logic, no API calls — orchestration only.
2. **CLI Scripts** (`src/cli/*.ts`) — Thin executables: one script, one action. Invoked by commands via `npx tsx`. Return JSON to stdout for Claude to interpret.
3. **`@psn/core` package** — Single source of truth for DB schemas (Drizzle), API clients (typed wrappers), types, and hub connection logic. Shared between CLI scripts and Trigger.dev tasks.
4. **Trigger.dev Tasks** (`src/trigger/tasks/*.ts`) — Background automation: post-scheduler, analytics-collector, trend-collector, token-refresher, notifier, whatsapp-handler. Each hub gets its own Trigger.dev project deployment.
5. **Neon Postgres** — One database per hub. Personal hub: no RLS (single user). Company hubs: RLS via `set_config('app.current_user_id')` per transaction, enforced through non-superuser `app_user` role.
6. **Local Workspace** (git) — Voice profiles (YAML), strategy config, content drafts, generated media. Files that don't need to be queryable live in git, not the database.

### Critical Pitfalls

1. **OAuth token refresh race conditions** — Multiple Trigger.dev tasks refreshing the same expired token simultaneously can permanently invalidate X refresh tokens. Prevention: `SELECT ... FOR UPDATE SKIP LOCKED` row-level lock on `oauth_tokens` table. Dedicated `token-refresher` cron task handles all refreshes proactively (7 days before expiry). Never refresh inline during API calls. Must be solved in Phase 1 before any task automation.

2. **Drizzle RLS silent deletion** — `drizzle-kit push` silently drops all RLS policies in production. The application role connecting to Postgres must be a non-superuser (`app_user`) or RLS is bypassed entirely. Prevention: always use `drizzle-kit generate` + `drizzle-kit migrate`. CI integration tests connect as `app_user` and assert cross-user data isolation. RLS must be verified before any multi-user data is stored.

3. **LinkedIn 60-day token cliff + partner API gatekeeping** — LinkedIn access tokens expire in 60 days. Missing the refresh window requires manual browser re-authorization. LinkedIn's posting API also requires partner program approval (2-6 weeks). Prevention: apply for partner program in Phase 0, build LinkedIn features behind a feature flag, run daily token health checks alerting at 14/7/3 days before expiry.

4. **Instagram 200 req/hr rate limit starvation** — Instagram reduced limits 96% in 2025. A single account's combined posting, analytics, and hashtag operations can exhaust this in minutes. Prevention: centralized per-platform rate limit budget tracker in the database. All analytics served from DB cache, never from real-time API calls. User-initiated commands never trigger Instagram API calls directly.

5. **Trigger.dev stuck runs causing missed posts** — Documented Trigger.dev incidents where runs are dequeued but never transition to executing state — permanently stuck, no notification. Prevention: a "post watchdog" scheduled task runs every 15 minutes querying for posts with `scheduled_at` in the past and `status = 'scheduled'`. On detection, re-triggers the post and alerts the user. All delayed runs must have a TTL.

6. **AI content algorithmic suppression** — Instagram launched authenticity detection in 2025; Meta labels AI content. Generic AI output gets buried. Prevention: human-in-the-loop review is non-negotiable. Voice profiles must include explicit anti-patterns. Learning loop tracks engagement suppression signals and feeds them back into profile calibration.

---

## Implications for Roadmap

Based on the architecture's dependency chain and feature priority research, the suggested phase structure is:

### Phase 0: Pre-Development (Approvals and Setup)
**Rationale:** External API approvals have multi-week lead times that block feature development. These must run in parallel with development, not after it.
**Delivers:** Unblocked platform access paths, infrastructure accounts provisioned.
**Actions:**
- Submit LinkedIn Marketing API partner program application
- Submit TikTok Content Posting API audit application
- Create Neon Postgres project, Trigger.dev Cloud account
- Set up git repo structure, gitignore secrets patterns
- Establish development environment (Node 22 LTS, pnpm, biome, vitest)

**Research flag:** None — straightforward setup work, no research needed.

---

### Phase 1: Foundation Infrastructure
**Rationale:** Every feature depends on the hub architecture, database, and token management. The architecture's Build Order explicitly states "@psn/core" and "hub infrastructure" must come before anything else. Critical pitfalls #1 (token race), #2 (RLS silent failure), and #5 (stuck runs) must all be addressed here before they become embedded bugs.
**Delivers:** Working Personal Hub (Neon + Trigger.dev), OAuth for X, token management with race condition protection, post watchdog, RLS CI test suite.
**Addresses:** All table-stakes infrastructure; blocks nothing from being built on top.
**Avoids:** OAuth race condition (Pitfall 1), Drizzle RLS silent deletion (Pitfall 2), stuck Trigger.dev runs (Pitfall 5).

Key deliverables:
- `@psn/core` package: Drizzle schemas for personal hub, hub connector (`createHubConnection()`), typed X API client, OAuth manager with `SELECT FOR UPDATE SKIP LOCKED` token refresh lock
- `src/cli/` scripts: `queue-post.ts`, `hub-status.ts`, `oauth-flow.ts`, `setup-hub.ts`
- Trigger.dev tasks: `token-refresher` (daily cron, proactive refresh), `post-watchdog` (15-min cron)
- CI: RLS integration tests connecting as `app_user` role
- `/psn:setup` command: provisions Personal Hub end-to-end

**Research flag:** None — established patterns, high confidence.

---

### Phase 2: Core Posting Loop (X Platform, Personal Persona)
**Rationale:** Features research defines the MVP as "single user, single platform, core voice loop." Voice profiling is the make-or-break feature — without it, the product is just a worse Buffer. X is the right first platform: pay-per-use API with no approval gates, well-maintained SDK, highest API flexibility.
**Delivers:** End-to-end posting on X — voice-profiled content generation → scheduling → publishing → basic analytics.
**Addresses:** Voice profiling, `/psn:post`, `/psn:calendar`, `/psn:capture`, `/psn:review`, image generation (GPT Image minimum), draft management.
**Avoids:** AI content suppression (Pitfall 6) via human-in-the-loop review; multi-step media upload failures (Pitfall 7) via format validation before upload.
**Uses:** `twitter-api-v2`, Trigger.dev `post-scheduler` and `analytics-collector` tasks, Drizzle posts and analytics tables, `sharp` for media processing.

Key deliverables:
- Voice profiling interview + content import flow
- `post-scheduler` Trigger.dev task with TTL-set delayed runs
- `analytics-collector` cron task (X only, daily)
- `/psn:post`, `/psn:calendar`, `/psn:capture`, `/psn:review` commands
- Media upload state machine with format validation and polling

**Research flag:** Needs validation — voice profiling quality is the core product risk. The specific prompt structure for voice elicitation needs iteration. Plan for 2-3 calibration iterations before declaring voice profiling complete.

---

### Phase 3: Intelligence and Learning
**Rationale:** Once the core posting loop is proven (10-15 posts with engagement data), the learning loop becomes meaningful. Features research states "the learning loop requires 2-4 weeks of data" before autonomy is useful. Intelligence layer (trend collection) enhances ideation without blocking posting.
**Delivers:** 3-channel voice learning loop, idea bank maturity pipeline, weekly planning (`/psn:plan`), content series system, Layer 1 intelligence (HN, Reddit, RSS trend collection), content archetypes and pillar balancing.
**Addresses:** Learning loop, idea maturity pipeline, `/psn:plan`, content series, trend-collector task, trend-alerter task.
**Avoids:** Cold-start misuse of the learning loop (must degrade gracefully when data is insufficient).
**Uses:** Perplexity (Sonar), Exa, Tavily, Brave Search APIs for trend intelligence.

Key deliverables:
- Edit signal tracking: every edit during `/psn:post` review is recorded
- Preference model updates based on engagement × edit correlation
- Idea bank with six-stage maturity pipeline (spark → used)
- Content series YAML config with auto-slotting into `/psn:plan`
- Trend collector cron task (HN Algolia, Reddit, RSS feeds)
- `/psn:plan` weekly batch command
- Bilingual support: language-specific voice profile sections (English + Spanish independently)

**Research flag:** Needs research — the preference model learning algorithm (how to weight edit signals vs engagement signals vs explicit feedback) is not fully specified in research. Needs design work during phase planning.

---

### Phase 4: LinkedIn and Multi-Platform Core
**Rationale:** LinkedIn is the second platform by priority (features research P2), highest-value for the developer/professional audience. Dependent on partner API approval from Phase 0. Carousels are LinkedIn's highest-performing format (11.2x impressions vs text), making image generation quality critical here. Instagram and TikTok defer to Phase 5 due to rate limit complexity and audit requirements.
**Delivers:** LinkedIn posting + analytics, multi-platform content adaptation (same idea, different expression per platform), carousel generation via GPT Image/Ideogram.
**Addresses:** LinkedIn partner API integration, LinkedIn carousel format, cross-platform posting with partial failure isolation.
**Avoids:** LinkedIn 60-day token cliff (Pitfall 2) via proactive token refresh infrastructure already in place from Phase 1; partial multi-platform failures by handling each platform independently.
**Uses:** LinkedIn REST API typed client, `arctic` LinkedIn OAuth, `@fal-ai/client` Flux 2 + Ideogram 3.0 for carousel image generation.

Key deliverables:
- LinkedIn REST API typed client (`src/clients/linkedin.ts`)
- LinkedIn OAuth flow with 60-day refresh tracking
- Multi-step media upload state machine for LinkedIn (register → upload → post)
- Cross-platform content adaptation in `/psn:post` (format picker by platform)
- Partial failure isolation: if LinkedIn fails, X still succeeds

**Research flag:** Conditional on LinkedIn partner approval. If approval is delayed past Phase 3 completion, build Instagram instead (despite rate limit complexity). Do not idle.

---

### Phase 5: Team Features and Company Hubs
**Rationale:** Team features are architecturally separate (separate Neon database, separate Trigger.dev project, RLS-enforced data isolation) and represent a 3x complexity multiplier. Features research explicitly defers these to v2+ for individuals, but the architecture is designed for them. Phase 5 implements the Company Hub schema extension, invite codes, approval workflows, and the brand operator posting persona.
**Delivers:** Company Hub provisioning, team member invite codes, approval workflow (`/psn:approve`), brand operator persona, RLS team data isolation.
**Addresses:** Company Hub schema (team_members, brand_preferences tables), Trigger.dev company project deployment, RLS policies for team member isolation, WhatsApp approval notification flow.
**Avoids:** Two-hub data consistency nightmares (Pitfall 9) by accepting eventual consistency for cross-hub data, keeping brand config in local YAML, no real-time cross-hub DB queries during posting flow.
**Uses:** Company hub Neon DB, Drizzle `crudPolicy` for RLS, Trigger.dev waitpoints for human-in-the-loop approval, WAHA/Twilio for approval notifications.

Key deliverables:
- Company hub schema: `team_members`, `brand_preferences` tables with RLS
- `/psn:setup --company` provisioning command
- Invite code system (cryptographically random, single-use, 7-day expiry)
- Approval workflow: `pending-approval` → Trigger.dev waitpoint → WhatsApp → approve/reject → schedule
- Brand operator voice profile (company voice, not personal)
- `/psn:approve` command

**Research flag:** Needs research — WhatsApp structured command interaction (approve via R1/R2/R3 commands in chat) requires designing a conversation state machine. The WAHA webhook processing architecture needs detailed design before implementation.

---

### Phase 6: Instagram, TikTok, and Engagement Engine
**Rationale:** Instagram and TikTok are intentionally deferred to this phase due to rate limit complexity (Instagram) and audit requirements (TikTok). By Phase 6, the rate limit budget system from Phase 1 is mature, TikTok audit should have resolved, and the engagement engine (semi-automated strategic replies) can be built on top of the monitoring infrastructure.
**Delivers:** Instagram Graph API posting, TikTok Content Posting API (post-audit), engagement engine (trending post reply drafts with WhatsApp alerts), EnsembleData TikTok analytics.
**Addresses:** Instagram multi-step media upload (2-step container flow with status polling), TikTok video chunked upload, engagement-monitor cron task, semi-automated reply workflow.
**Avoids:** Instagram rate limit starvation (Pitfall 3) via the rate limit budget tracker and DB-cached analytics; TikTok audit bottleneck (Pitfall 4) by building against sandbox first, unlocking public posting after approval.
**Uses:** Instagram Graph API typed client, TikTok Content Posting API client, EnsembleData for TikTok analytics, engagement-monitor Trigger.dev task, notifier task for engagement alerts.

**Research flag:** Needs research — TikTok video chunked upload (>64MB files) needs detailed implementation design. Instagram webhook integration (comments, mentions) to replace polling needs design work.

---

### Phase Ordering Rationale

The ordering follows the dependency chain surfaced in ARCHITECTURE.md's "Build Order" section:
- Phase 1 must precede everything because `@psn/core` and hub infrastructure are hard dependencies
- Phase 2 (posting loop) gates all learning features — you need posts to learn from
- Phase 3 (learning/intelligence) requires 2-4 weeks of Phase 2 data before it's meaningful
- Phase 4 (LinkedIn) requires Phase 0's partner application to have resolved; fits naturally after Phase 3
- Phase 5 (team) is architecturally additive, not foundational — can be deferred without blocking individual users
- Phase 6 (Instagram/TikTok/engagement) is deliberately last because it has the highest external dependency risk (rate limits, audit) and requires the most mature infrastructure

This ordering also maps cleanly to the FEATURES.md priority matrix: P1 features land in Phases 1-2, P2 features in Phases 3-4, P3 features in Phases 5-6.

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- **Phase 2:** Voice profiling prompt engineering — the specific interview structure and content import analysis approach for voice elicitation needs design-level research before implementation
- **Phase 3:** Preference model algorithm — how to weight edit signals vs engagement signals vs explicit feedback in the learning loop is not specified and needs research
- **Phase 5:** WhatsApp conversation state machine — structured command interaction (R1/R2/R3 approval commands) and WAHA webhook architecture needs detailed design
- **Phase 6:** TikTok chunked video upload implementation, Instagram webhook architecture

**Standard patterns (skip `/gsd:research-phase`):**
- **Phase 0:** Account/project provisioning — straightforward setup
- **Phase 1:** Hub architecture, Drizzle RLS, Trigger.dev tasks — all well-documented patterns confirmed in research
- **Phase 4:** LinkedIn REST API integration — documented endpoints, standard OAuth patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against official docs and npm. Version compatibility confirmed. No conflicting information. |
| Features | HIGH | Competitor analysis grounded in current (2026) pricing and feature sets. Feature dependencies mapped explicitly. |
| Architecture | HIGH | Patterns sourced from Trigger.dev, Drizzle, and Neon official docs. Build order derived from hard dependency graph. |
| Pitfalls | HIGH | Pitfalls verified against official docs, developer forums, and confirmed Trigger.dev incident reports. |

**Overall confidence:** HIGH

### Gaps to Address

- **Voice profiling quality:** Research identifies this as the core differentiator and biggest risk, but doesn't specify the prompt engineering approach. This is a design/iteration gap, not a research gap — needs empirical calibration during Phase 2.
- **Preference model learning algorithm:** The 3-channel feedback system is architecturally described, but the weighting function (how edit signals vs engagement signals vs explicit feedback combine to update the model) is unspecified. Needs design-level research before Phase 3.
- **LinkedIn partner approval timeline:** The 2-6 week estimate is documented but the actual approval is an external dependency. If approval takes longer than 6 weeks, Phase 4 scope needs adjustment (defer LinkedIn, pull Instagram forward despite rate limit complexity).
- **TikTok EnsembleData pricing at scale:** The ~$100/mo estimate is for a single account. Multi-account (team) scenarios need pricing validation before Phase 6 commitment.
- **WAHA production reliability:** Research flags WhatsApp session disconnects as a known issue. The Twilio fallback is identified but not designed. For Phase 5's approval workflow (which is time-critical), notification reliability needs a more robust design than currently specified.

---

## Sources

### Primary (HIGH confidence — official docs)
- [Trigger.dev v4 GA announcement](https://trigger.dev/changelog/trigger-v4-ga) — v4 features, waitpoints, warm starts, breaking changes
- [Trigger.dev v3 to v4 migration guide](https://trigger.dev/docs/migrating-from-v3) — import path changes, queue predefinition
- [Trigger.dev incident report Sep 26, 2025](https://trigger.dev/blog/incident-report-sep-26-2025) — stuck runs production incident
- [Drizzle ORM RLS docs](https://orm.drizzle.team/docs/rls) — pgPolicy, pgRole, crudPolicy, push-vs-migrate behavior
- [Neon + Drizzle RLS guide](https://neon.com/docs/guides/rls-drizzle) — authenticated/anonymous roles, crudPolicy helper
- [LinkedIn Marketing API overview](https://learn.microsoft.com/en-us/linkedin/marketing/overview?view=li-lms-2026-02) — current API version, partner program
- [TikTok Content Posting API reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) — audit requirement, sandbox limitations
- [Arctic v3 docs](https://arcticjs.dev/) — OAuth providers: LinkedIn, Twitter, TikTok, Facebook
- [twitter-api-v2 npm](https://www.npmjs.com/package/twitter-api-v2) — v1.29.x, X developer docs listing
- [OpenAI image generation docs](https://platform.openai.com/docs/guides/image-generation) — gpt-image-1, gpt-image-1.5
- [@fal-ai/client npm](https://www.npmjs.com/package/@fal-ai/client) — FLUX.2 variants and pricing
- [Ideogram API overview](https://developer.ideogram.ai/ideogram-api/api-overview) — REST API, pricing
- [WAHA GitHub](https://github.com/devlikeapro/waha) — engines, Docker setup, session reliability issues

### Secondary (HIGH confidence — community consensus and cross-verified)
- [Nango: Concurrency with OAuth token refreshes](https://nango.dev/blog/concurrency-with-oauth-token-refreshes) — race condition patterns and prevention
- [X OAuth 2.0 refresh token failure thread](https://devcommunity.x.com/t/oauth-2-0-refresh-token-failure-continuing/177272) — documented X API refresh token bugs
- [Drizzle RLS push vs migrate bug](https://github.com/drizzle-team/drizzle-orm/issues/3504) — GitHub issue confirming silent policy deletion
- [Instagram API rate limit analysis](https://www.marketingscoop.com/marketing/instagrams-api-rate-limits-a-deep-dive-for-developers-and-marketers-in-2024/) — 200 req/hr limit documented
- [Sprout Social employee advocacy pricing](https://sproutsocial.com/features/employee-advocacy/) — $249/seat pricing for competitive comparison
- [Social Insider benchmarks 2026](https://www.socialinsider.io/social-media-benchmarks) — engagement rate benchmarks, carousel performance data
- [Buffer/Backlinko: Best social media management tools 2026](https://backlinko.com/best-social-media-management-tools) — competitor feature matrix

### Tertiary (MEDIUM confidence — third-party services, pricing subject to change)
- [EnsembleData TikTok API](https://ensembledata.com/tiktok-api) — ~$100/mo pricing, real-time scraping claims
- [Perplexity API changelog](https://docs.perplexity.ai/changelog/changelog) — sonar model pricing, citation token status
- [Tavily SDK reference](https://docs.tavily.com/sdk/javascript/reference) — @tavily/core, 1000 free searches/month

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
