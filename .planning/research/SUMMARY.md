# Project Research Summary

**Project:** Post Shit Now (PSN)
**Domain:** CLI-first social media automation system (Claude Code + Trigger.dev + Neon Postgres)
**Researched:** 2026-02-18
**Confidence:** HIGH (stack and architecture), MEDIUM-HIGH (features), MEDIUM (social platform API specifics)

## Executive Summary

Post Shit Now is a Claude Code-native social media growth system that replaces the web dashboard paradigm with slash commands in the terminal, Trigger.dev Cloud for async task execution, and Neon Postgres as shared state. The architecture has a clear three-boundary design: local Claude Code commands for human-in-the-loop content creation, Trigger.dev Cloud tasks for all automated backend work (scheduling, analytics, token refresh, notifications), and Neon Postgres as the bridge between them. The recommended stack is highly consistent across sources — Node.js 22, TypeScript 5.5+, pnpm, Trigger.dev SDK v4, Drizzle ORM 0.45.x, and arctic for OAuth — with versions verified against official npm and documentation sources.

The core thesis is differentiated: deep voice profiling (not a tone toggle), a learning loop that accumulates feedback from edits and engagement, and an intelligence layer that surfaces ideas from external signals rather than asking users to start from a blank page. Competitors like Buffer and SocialBee offer AI writing; none offer the compounding preference model or content atoms pattern. The defensible moat is the system getting smarter with every post while competitors stay stateless. The human-in-the-loop requirement — all posts go through review before scheduling — is not a limitation but a core quality mechanism, since AI-generated content without review is actively suppressed by platform algorithms in 2026.

The critical risks are front-loaded: LinkedIn requires Marketing Developer Platform partner approval (weeks), TikTok requires a Content Posting API audit, OAuth token refresh failures are silent and catastrophic, and Postgres RLS implemented incorrectly with the wrong database role creates a security incident rather than a bug. These risks must be addressed at Phase 0 and in the foundation layer before any product features are built. The architecture research provides explicit mitigation patterns for all of them, so execution risk is low given the research depth available.

## Key Findings

### Recommended Stack

The stack is well-defined and internally consistent. Trigger.dev SDK v4 (now GA) is the scheduling backbone — its delayed runs handle post scheduling since no social platform offers native API scheduling. Drizzle ORM 0.45.x (not the v1 beta, which has breaking changes) with `@neondatabase/serverless` in HTTP mode is the data layer. The arctic library provides OAuth 2.0 flows for all four platforms, with Instagram handled via the Facebook provider. For Instagram and TikTok, where no production-grade TypeScript SDK exists, thin Zod-validated fetch wrappers are the right approach. The `twitter-api-v2` library is the clear winner for X — it handles OAuth complexity, media chunking, and pagination in ways that would take weeks to reimplement.

**Core technologies:**
- **Node.js 22 LTS + TypeScript 5.5+**: Runtime and language — required by Trigger.dev v4 and Zod 4 strict mode
- **pnpm 9.x**: Package manager — strict dependency resolution; Trigger.dev examples use it; better than Bun for native modules like sharp
- **@trigger.dev/sdk ^4.3.3**: Task scheduling — delayed runs for post scheduling, crons for analytics/token refresh, waitpoints for human-in-the-loop
- **drizzle-orm ^0.45.1 + @neondatabase/serverless ^1.0.2**: ORM + DB driver — type-safe, Neon HTTP mode for serverless tasks, RLS support via `pgTable.withRLS()`
- **zod ^4.3.6**: Validation — API response validation, config parsing, command input validation
- **arctic ^3.x**: OAuth 2.0 — 70+ providers including X, LinkedIn, TikTok, Facebook (for Instagram)
- **twitter-api-v2 ^1.29.0**: X API client — only mature TypeScript client, handles all complexity
- **sharp ^0.34.5**: Image processing — resize for platform specs, strip AI metadata before upload
- **vitest ^3.x + tsx ^4.x**: Testing and scripting — fast, ESM-native, no ts-jest overhead

**Critical version constraint:** Do NOT use drizzle-orm v1 beta. Breaking changes to relational queries, migration folder structure, and validator packages. Stick to 0.45.x stable.

### Expected Features

The feature research distinguishes clearly between table stakes (expected by any SMM tool user), differentiators (reasons to choose PSN over Buffer/SocialBee), and anti-features (explicitly out of scope).

**Must have (table stakes):**
- Multi-platform posting to X, LinkedIn, Instagram, TikTok — missing any means product feels incomplete
- Post scheduling via Trigger.dev delayed runs — no native API scheduling exists anywhere
- Content calendar view (`/psn:calendar`) — scheduling without visibility is a black box
- Analytics collection and performance review — fundamental "did it work?" question
- AI-assisted content generation — table stakes as of 2026; every major competitor has it
- OAuth/token management with proactive refresh — silent token failure breaks everything
- Content drafts with human review — non-negotiable; no auto-post without approval
- Setup/onboarding (`/psn:setup`) — highest-risk table stakes; BYOK complexity makes this hard

**Should have (differentiators that create the moat):**
- Deep voice profiling (100+ dimension model, language-specific sections, 3 persona types)
- RLHF-style learning loop (edit tracking + engagement signals + explicit feedback)
- Idea bank with 7-stage maturity pipeline (spark → used → killed)
- Intelligence layer with scheduled collection from free sources + on-demand research
- Content remixing / content atoms (one idea → 5-10 platform-specific pieces)
- Strategic engagement engine (`/psn:engage` — reply to trending posts for growth)
- Bilingual content with independent voice profiles (not translation)
- Content series as first-class concept
- Weekly planning workflow (`/psn:plan` — orchestrates all subsystems)

**Defer (v2+):**
- Company Hub multi-user features — until personal posting is validated
- Instagram and TikTok — audit requirements and rate limits make these harder; add after X + LinkedIn
- Full paid intelligence layer (Perplexity/Exa/Tavily) — start with free sources
- WhatsApp notifications — core loop works without them
- Strategic engagement (`/psn:engage`) — needs trend monitoring + calibrated reply voice first
- Bilingual content — ship English-only first, add Spanish once voice profiling is proven

**Anti-features (explicitly excluded):**
- Web dashboard or GUI — contradicts CLI-first value proposition
- Social inbox / DM management — better in native apps
- Auto-posting without review — causes algorithm suppression and brand risk
- Visual content editor — use external tools + `content/media/` drop-in
- Mobile app — WhatsApp integration is the mobile touchpoint

### Architecture Approach

The system has three strict execution contexts with defined communication protocols. Local Claude Code commands handle all human-in-the-loop work: reading config, generating content, presenting options, writing approved posts to DB, and triggering delayed Trigger.dev runs. Cloud Trigger.dev tasks handle all automated backend: posting to platform APIs, collecting analytics, refreshing tokens, monitoring engagement, sending notifications. Neon Postgres is the sole bridge — commands write; tasks read and write back. The critical boundary rule is that commands never call platform POST APIs directly; they write to DB and delegate to tasks. This gives consistent retry logic, rate limit management, and an audit trail in one place.

**Major components:**
1. **Slash Commands** (`.claude/commands/psn/`) — User interaction, AI generation, human-in-the-loop approval; runs locally in Claude Code
2. **Platform Adapters** (`trigger/lib/platforms/`) — Unified interface hiding X/LinkedIn/Instagram/TikTok API differences; used by both tasks and commands
3. **Database Layer** (`trigger/lib/db/`) — Drizzle schema as single source of truth; connection factory supporting Personal + Company Hub multiplicity
4. **Trigger.dev Tasks** (`trigger/tasks/`) — post-scheduler, analytics-collector, trend-collector, engagement-monitor, token-refresher, notifier; all cloud-executed
5. **OAuth Manager** (`trigger/lib/oauth/`) — AES-256-GCM encrypted token storage in DB; proactive refresh cron; never stores keys in payloads
6. **Notification System** (`trigger/lib/notifications/`) — WhatsApp via WAHA or Twilio; priority-tiered; relevance scoring before alerting

**Key patterns to implement:**
- Platform Adapter Interface — factory pattern hiding per-platform API complexity
- Database Connection Factory — supports 1 Personal Hub + N Company Hubs with different connection strings
- Trigger.dev delayed run for scheduling — `tasks.trigger("post-scheduler", { postId }, { delay: scheduledDate })`
- RLS with `FORCE ROW LEVEL SECURITY` + separate migration role vs. application role
- Idempotent media upload with state tracked in DB (container_created → binary_uploaded → processing → ready)

### Critical Pitfalls

1. **OAuth token refresh fails silently** — LinkedIn tokens expire every 60 days; refresh token expires in 365 days if never exercised. Prevention: store `token_expires_at`, refresh at 50% lifetime (30 days), WhatsApp P0 alert on any 401, weekly token health check task independent of posting.

2. **RLS tested with superuser bypasses all policies** — Postgres superusers and table owners bypass RLS by default. Prevention: create separate Postgres roles (owner for migrations, restricted for app queries); add `FORCE ROW LEVEL SECURITY` on every table; integration tests that verify isolation using the restricted role.

3. **Platform API approval gates block the roadmap** — LinkedIn MDP approval takes 2-6 weeks; TikTok Content Posting API audit has no guarantee. Prevention: apply on day one before writing integration code; build X first (no approval gate); design platform abstraction so disabled platforms cost zero.

4. **Instagram 200 req/hr rate limit shared across all operations** — Analytics collection, posting, and engagement monitoring all share one budget. Prevention: per-account API budget tracker in DB; priority system (posting > engagement > analytics); batch analytics calls; circuit breaker after consecutive failures.

5. **AI content suppressed by platform algorithms** — 57% of online content is AI-generated in 2026; platforms detect and suppress it. Prevention: human-in-the-loop mandatory (no auto-post); strip EXIF/C2PA metadata from AI images before upload; track edit distance to surface voice profile calibration needs; voice profile minimum sample sizes before first use.

6. **Drizzle migration state diverges between hub instances** — Concurrent migration runs corrupt state; team members on different repo versions break Company Hub. Prevention: `pg_advisory_lock` before migrations; version check on startup; only admins migrate Company Hubs; never modify existing migration files.

## Implications for Roadmap

Based on combined research, the architecture's build order maps directly to a phase structure. The dependencies are clear: nothing works without the database layer; nothing posts without OAuth tokens; nothing schedules without Trigger.dev tasks; nothing learns without analytics data.

### Phase 0: Pre-Development Blockers (Parallel Track)

**Rationale:** Two blocking dependencies run in parallel with all development and cannot be started late. LinkedIn MDP approval and TikTok Content Posting API audit each take 2-6 weeks. Starting these after code is written means weeks of delay before production use.
**Delivers:** Approved API access for LinkedIn and TikTok when integration code is ready
**Avoids:** Pitfall 3 (platform API approval blocking roadmap)
**Actions:** Apply for LinkedIn MDP; apply for TikTok Content Posting API audit; document approval status in `config/platform-status.yaml`

### Phase 1: Foundation + X Posting (Prove Core Loop)

**Rationale:** Everything depends on the database schema, connection factory, and OAuth token management. These must be correct from the first commit — RLS architecture and unique constraint design are nearly impossible to change without full data migration. X is the right first platform: no approval gate, pay-per-use API (or Free tier), fastest feedback loop.
**Delivers:** Working end-to-end posting to X with human review, voice profiling, and content drafts
**Addresses (from FEATURES.md):** Setup/onboarding, single-platform posting, content drafts, voice profiling foundation
**Avoids:** Pitfalls 2, 10, 16 (RLS with wrong role; session variable leakage; unique constraints leaking tenant data)
**Uses:** Node.js 22, TypeScript 5.5+, pnpm, drizzle-orm 0.45.x, @neondatabase/serverless, arctic, twitter-api-v2, Trigger.dev SDK v4
**Implements:** Database layer, OAuth manager, X Platform Adapter, post-scheduler task, /psn:setup command, /psn:post command
**Research flag:** Standard patterns — Trigger.dev task + Drizzle + Neon is well-documented

### Phase 2: Analytics + Learning Loop (Close the Feedback Cycle)

**Rationale:** The learning loop is the core competitive differentiator. It cannot be retrofitted late — the schema must have language fields, edit distance tracking, and composite score columns from day one. Without analytics data, the preference model is empty; without the preference model, content generation is generic.
**Delivers:** Analytics collection, edit-distance learning signal, preference model v1, content calendar view
**Addresses (from FEATURES.md):** Analytics, post scheduling (delayed runs wired up), content calendar, learning loop v1, quick capture
**Avoids:** Pitfalls 4 (Instagram rate limit — budget tracker built before IG added), 5 (AI slop — edit tracking surfaces calibration needs), 12 (learning loop overfitting — minimum sample sizes), 13 (language not a first-class field)
**Implements:** analytics-collector task, idea bank schema + queries, /psn:review command, preference model structure
**Research flag:** Learning loop model design needs validation — minimum sample sizes, decay factors, and normalization logic are well-reasoned but unproven in this specific context

### Phase 3: LinkedIn + Multi-Platform Planning

**Rationale:** LinkedIn is the second platform (approval will have been running since Phase 0). Token refresh becomes critical the moment LinkedIn is added — 60-day expiry is unforgiving. Content remixing and weekly planning require at least two platforms to be meaningful.
**Delivers:** LinkedIn posting, cross-platform content atoms, weekly planning workflow, intelligence layer v1 (free sources)
**Addresses (from FEATURES.md):** LinkedIn support, content remixing, /psn:plan, intelligence layer with free sources (HN, Reddit, Product Hunt, RSS), content series
**Avoids:** Pitfall 1 (token refresh silent failure — token-refresher task with health checks), Pitfall 3 (LinkedIn approval already in progress)
**Implements:** LinkedIn Platform Adapter, token-refresher task, trend-collector task (free sources), /psn:plan command, /psn:series command
**Research flag:** LinkedIn API is Rest.li-based with quirky encoding — the official beta client has known reliability concerns; build wrapping error handling before shipping

### Phase 4: Company Hub + Team Workflows

**Rationale:** Personal Hub must be proven before multi-user complexity is introduced. Company Hub adds team_members table, RLS approval-tier policies, invite codes, brand-operator/brand-ambassador voice profiles, and cross-hub reads. This is a significant architecture surface increase that should only happen once the core loop is stable.
**Delivers:** Company Hub setup, team onboarding via invite codes, approval workflow, brand-ambassador persona
**Addresses (from FEATURES.md):** Company posts with approval workflow, employee advocacy without a separate tool, multi-account support
**Avoids:** Pitfall 6 (migration state divergence — advisory locks, admin-only migrations), Pitfall 2 (RLS for approver role)
**Implements:** team_members schema, brand_preferences schema, /psn:approve command, cross-hub read patterns, invite code flow
**Research flag:** RLS for multi-role approval workflow (member/approver/admin) needs implementation validation — the `current_setting('app.user_id')` pattern with connection pooling is MEDIUM confidence

### Phase 5: Notifications + Engagement

**Rationale:** WhatsApp notifications depend on the WAHA or Twilio infrastructure being set up, which requires a dedicated number and priority-tier design before any notification code is written. Engagement monitoring requires notifications to be useful. Both are independent of posting quality and can be deferred until the core loop is solid.
**Delivers:** WhatsApp notifications with priority tiers, engagement monitoring, /psn:engage command
**Addresses (from FEATURES.md):** WhatsApp notifications with structured commands, strategic engagement engine
**Avoids:** Pitfall 8 (WhatsApp account ban — dedicated number, rate limiting), Pitfall 15 (notification fatigue — P0/P1/P2 tiers with quiet hours)
**Implements:** notifier task, engagement-monitor task, WAHA/Twilio client, relevance scoring, priority notification system
**Research flag:** WAHA is unofficial and carries ban risk — evaluate Twilio as default before implementing WAHA path

### Phase 6: Instagram + TikTok + Advanced Intelligence

**Rationale:** Instagram and TikTok are the hardest platforms — TikTok requires a passed audit (running since Phase 0), Instagram has the 200 req/hr budget constraint requiring a per-account tracker. Both require the media upload pipeline with idempotent state tracking. Advanced intelligence (paid APIs) follows the same phase since it's additive to the existing trend-collector.
**Delivers:** All 4 platforms live, video/carousel media support, paid intelligence sources, bilingual content v1
**Addresses (from FEATURES.md):** Instagram, TikTok, full intelligence layer with Perplexity/Exa/Tavily, bilingual content
**Avoids:** Pitfall 4 (Instagram rate budget exhausted), Pitfall 11 (media upload mid-process failure), Pitfall 3 (TikTok audit — already approved by now)
**Implements:** Instagram Platform Adapter, TikTok Platform Adapter, idempotent media upload state machine, per-account API budget tracker, paid intelligence wrappers
**Research flag:** TikTok video processing timeouts require Trigger.dev wait functions — well-documented pattern but platform-specific timing needs empirical measurement

### Phase 7: Refinement + Advanced Learning

**Rationale:** Once all platforms are live and the learning loop has real data, advanced features become meaningful rather than speculative. Content recycling requires a published archive with engagement history. Spanish voice profiles require English voice profiling to be proven first.
**Delivers:** Advanced learning loop, content recycling with fresh angles, bilingual content in Spanish, competitive intelligence analysis
**Addresses (from FEATURES.md):** Content recycling, advanced preference model, bilingual content (Spanish), competitive positioning features
**Avoids:** Pitfall 12 (learning loop overfitting — now has sufficient data for proper normalization)
**Research flag:** Standard patterns by this phase — the architecture and data model are proven

### Phase Ordering Rationale

- **Foundation before features:** RLS and schema constraints that are wrong in Phase 1 require a full data migration to fix. The cost of correctness is zero at schema design time and enormous afterward.
- **Approval gates run parallel to development:** LinkedIn MDP and TikTok audit are business/compliance processes with unpredictable timelines. Starting them at Phase 0 means they are resolved by Phase 3 and Phase 6 respectively, when the integrations are ready.
- **X before LinkedIn before Instagram/TikTok:** Increasing API complexity and approval requirements. X has no gate; LinkedIn has a gate but a clean API; Instagram has rate limit complexity; TikTok has an audit gate plus video complexity.
- **Learning loop in Phase 2, not later:** The preference model is empty until data exists, but the model schema must be right from the start. Retrofitting language fields and composite score columns into existing tables after posts are live is a painful migration.
- **Company Hub after Personal Hub:** Multi-tenant RLS, approval workflows, and cross-hub reads add significant complexity. Personal Hub validation first prevents building Company Hub on an unstable foundation.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (learning loop):** Minimum sample sizes, decay factors, normalization against account baseline — well-reasoned but implementation-specific; plan a research-phase pass before implementation
- **Phase 4 (Company Hub RLS with multi-role):** `current_setting` with connection pooling in transaction mode — MEDIUM confidence; validate with a spike implementation before full build
- **Phase 5 (WhatsApp):** WAHA ban risk is real; evaluate Twilio vs. WAHA default decision with concrete cost analysis during phase planning

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation + X):** Trigger.dev + Drizzle + Neon is HIGH confidence with official documentation; X API via twitter-api-v2 is straightforward
- **Phase 3 (token refresh):** AES-256-GCM token encryption and Trigger.dev cron patterns are well-established
- **Phase 6 (media upload state machine):** Idempotent upload pattern is standard; Trigger.dev wait functions for polling are documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack (Trigger.dev v4, Drizzle 0.45.x, Neon, arctic, twitter-api-v2) verified against official npm and documentation sources. Social platform clients rated MEDIUM where no official SDK exists (Instagram, TikTok). |
| Features | MEDIUM-HIGH | Market research based on publicly available competitor analysis and platform API documentation. Feature dependency tree is well-reasoned. MVP recommendation matches the learning loop thesis. |
| Architecture | HIGH | Three-boundary design (local/cloud/database) is clean and well-documented against Trigger.dev, Drizzle, and Neon official docs. Build order is dictated by hard technical dependencies. |
| Pitfalls | HIGH | Pitfalls sourced from official platform documentation (LinkedIn OAuth, TikTok audit requirements, Instagram rate limits, Trigger.dev limits), Postgres RLS footgun research, and verified API behavior. Pay-per-use X API status is MEDIUM (closed beta). |

**Overall confidence:** HIGH

### Gaps to Address

- **X pay-per-use API availability:** Currently a closed beta pilot as of December 2025. Budget documentation must not promise specific per-post costs until GA. Build against Free tier baseline and make tier switchable via config. Monitor @XDevelopers for rollout announcements.
- **LinkedIn API beta client reliability:** The official `linkedin-api-js-client` is in beta. It is the only official option, but wrap all calls in error handling and prepare a direct HTTP fallback for Rest.li endpoints if the client proves too buggy.
- **WAHA vs. Twilio default:** The ban risk for WAHA is documented but hard to quantify without production data. Make this decision explicit during Phase 5 planning — potentially default to Twilio and document WAHA as advanced/at-your-own-risk.
- **Learning loop sample size thresholds:** The minimum sample sizes before the preference model adjusts recommendations are well-reasoned but not empirically validated for this specific domain. Plan a research-phase spike during Phase 2 planning.
- **RLS session variable leakage with connection pooling:** The `SET LOCAL` in transaction mode pattern is documented as correct, but needs an integration test written and validated before Company Hub ships.

## Sources

### Primary (HIGH confidence)
- [@trigger.dev/sdk npm](https://www.npmjs.com/package/@trigger.dev/sdk) — v4.3.3, GA, task patterns, delayed runs, scheduled tasks
- [Trigger.dev v4 GA announcement](https://trigger.dev/changelog/trigger-v4-ga) — migration guide, breaking changes from v3
- [Trigger.dev Limits Documentation](https://trigger.dev/docs/limits) — free tier: 10 schedules, 10 concurrent runs
- [drizzle-orm npm](https://www.npmjs.com/drizzle-orm) — v0.45.1, verified Feb 2026
- [Drizzle ORM RLS documentation](https://orm.drizzle.team/docs/rls) — pgTable.withRLS, pgPolicy patterns
- [Neon serverless driver docs](https://neon.com/docs/serverless/serverless-driver) — HTTP vs. WebSocket modes
- [Neon + Drizzle Migrations Guide](https://neon.com/docs/guides/drizzle-migrations) — migration safety, advisory locks
- [Arctic v3 docs](https://arcticjs.dev/) — 70+ OAuth providers, Twitter/LinkedIn/TikTok/Facebook confirmed
- [twitter-api-v2 GitHub](https://github.com/PLhery/node-twitter-api-v2) — TypeScript, zero dependencies
- [LinkedIn OAuth Refresh Tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens) — 60-day access, 365-day refresh
- [TikTok Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started) — audit required, 5-user limit unaudited
- [sharp npm](https://www.npmjs.com/package/sharp) — v0.34.5, built-in TypeScript types

### Secondary (MEDIUM confidence)
- [Instagram API Rate Limits](https://www.getphyllo.com/post/navigating-instagram-api-rate-limit-errors-a-comprehensive-guide) — 200 req/hr per account
- [X API Pay-Per-Use Announcement](https://devcommunity.x.com/t/announcing-the-x-api-pay-per-use-pricing-pilot/250253) — closed beta as of Dec 2025
- [Meta AI Content Watermarking](https://www.socialmediatoday.com/news/meta-outlines-invisible-watermarking-ai-generated-content/804700/) — C2PA provenance markers
- [Common Postgres RLS Footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) — 16 specific RLS pitfalls
- [WAHA GitHub](https://github.com/devlikeapro/waha) — unofficial WhatsApp API, ban risk documented
- [linkedin-api-js-client GitHub](https://github.com/linkedin-developers/linkedin-api-js-client) — official, beta status
- [Blogging Wizard: Best Social Media Management Tools 2026](https://bloggingwizard.com/best-social-media-management-tools/) — feature landscape
- [AI Content Detection Trends 2025](https://wellows.com/blog/ai-detection-trends/) — 57% of online content is AI-generated

### Tertiary (LOW confidence)
- [Trigger.dev monorepo discussion](https://github.com/triggerdotdev/trigger.dev/discussions/1279) — shared lib pattern between tasks and commands; community discussion, not official docs
- [NoimosAI: Top AI Agents for Social Media 2026](https://noimosai.com/en/blog/top-10-ai-agents-for-social-media-to-explode-your-brand-growth-in-2026) — AI brand voice market trend, directional only

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
