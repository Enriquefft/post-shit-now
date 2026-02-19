# Roadmap: Post Shit Now

## Overview

Post Shit Now delivers a Claude Code-first social media growth system in 8 phases. Phase 1 lays infrastructure (hub architecture, DB, migrations). Phase 2 adds OAuth and the X posting pipeline. Phase 3 builds voice profiling and content generation — the core differentiator. Phase 4 adds analytics and the learning loop that makes content improve over time. Phase 5 brings intelligence gathering, idea management, weekly planning, content series, and bilingual support. Phase 6 extends to LinkedIn with multi-platform adaptation. Phase 7 adds Company Hubs, team coordination, approval workflows, and WhatsApp notifications. Phase 8 completes platform coverage with Instagram, TikTok, and the engagement engine.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Infrastructure** - Project scaffolding, @psn/core package, Personal Hub provisioning, Drizzle migrations, BYOK setup
- [x] **Phase 2: X Platform Pipeline** - OAuth for X, token management with race condition protection, post scheduling, media uploads (completed 2026-02-19)
- [x] **Phase 3: Voice Profiling and Content Generation** - Voice interviews, content import, calibration, post generation in user's voice, image generation, draft management (completed 2026-02-19)
- [x] **Phase 4: Analytics and Learning Loop** - X analytics collection, engagement scoring, performance review, 3-channel learning loop, preference model
- [x] **Phase 5: Intelligence, Ideation, and Planning** - Trend collection, idea bank, weekly batch planning, content series, bilingual support, content recycling (completed 2026-02-19)
- [x] **Phase 6: LinkedIn and Multi-Platform** - LinkedIn OAuth and posting, multi-platform content adaptation, partial failure isolation (completed 2026-02-19)
- [x] **Phase 7: Team Coordination and Notifications** - Company Hub provisioning, invite codes, approval workflows, WhatsApp notifications, brand personas (completed 2026-02-19)
- [x] **Phase 8: Instagram, TikTok, and Engagement** - Instagram and TikTok posting, engagement engine with semi-automated replies (completed 2026-02-19)
- [ ] **Phase 9: Integration Wiring Fixes** - Wire notification dispatcher, fix idea bank args, fix unified calendar, add preference lock checks (gap closure)
- [x] **Phase 10: Milestone Documentation Closure** - VERIFICATION.md for Phase 1 and 6, REQUIREMENTS.md checkbox updates, SUMMARY frontmatter (completed 2026-02-19)

## Phase Details

### Phase 1: Foundation Infrastructure
**Goal**: User can provision a working Personal Hub and the project has a solid technical foundation for all future phases
**Depends on**: Nothing (first phase). External dependency: submit LinkedIn partner API and TikTok audit applications immediately (multi-week lead times).
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, CONFIG-01, CONFIG-04, CONFIG-07
**Success Criteria** (what must be TRUE):
  1. User can run `/psn:setup` and have a working Personal Hub (Neon DB provisioned, Trigger.dev project connected, API keys configured)
  2. Drizzle migrations generate and apply correctly without destroying RLS policies (never `push` in production)
  3. Hub connector establishes typed database connections and CLI scripts can read/write to the Hub
  4. Post watchdog task detects stuck Trigger.dev runs and re-triggers them
  5. All secrets are gitignored and the project builds with TypeScript 5.7+, pnpm, Biome, and Vitest
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffolding, Drizzle schema with RLS, connection factory, migration infra, crypto utils
- [x] 01-02-PLAN.md — Hub provisioning setup flow (/psn:setup wizard with neonctl + trigger CLI)
- [x] 01-03-PLAN.md — Trigger.dev tasks (post watchdog cron, health check)

### Phase 2: X Platform Pipeline
**Goal**: User can authenticate with X, schedule posts, and have them reliably published at the scheduled time
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-05, AUTH-06, AUTH-07, AUTH-08, PLAT-01, PLAT-05, SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, CONTENT-05
**Success Criteria** (what must be TRUE):
  1. User can authenticate with X via OAuth 2.0 PKCE and tokens are stored encrypted in Hub DB
  2. Token refresher runs daily and proactively refreshes tokens before expiry, using row-level locking to prevent race conditions
  3. User can schedule a post for a specific date/time and it publishes via Trigger.dev delayed run with retry and rate limit handling
  4. Multi-step media uploads (register, upload, attach) work for X images and threads
  5. Failed posts notify the user and scheduled/published posts are tracked in the Hub DB content queue
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — DB schema expansion, X OAuth 2.0 PKCE module, API types, setup integration
- [x] 02-02-PLAN.md — Thread auto-splitter and timezone utilities (TDD)
- [x] 02-03-PLAN.md — X API client with rate limits, media upload, token refresher cron
- [x] 02-04-PLAN.md — Publish-post task, post CLI, /psn:post command, watchdog update

### Phase 3: Voice Profiling and Content Generation
**Goal**: User can generate posts in their authentic voice with image support, review and edit them, and manage drafts
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04, VOICE-05, VOICE-06, VOICE-07, VOICE-08, VOICE-09, VOICE-10, POST-01, POST-05, POST-06, POST-09, POST-10, POST-11, POST-12, POST-14, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, VID-01, VID-02, VID-03, VID-04, VID-05, CONTENT-01, CONTENT-02, CONFIG-02, CONFIG-03
**Success Criteria** (what must be TRUE):
  1. User can complete a voice profiling interview (or shorter blank-slate version) and get a personal.yaml voice profile with language-specific sections
  2. User can import existing content (X history, LinkedIn posts, blogs) to bootstrap voice patterns
  3. User can generate a post for X via `/psn:post` that sounds like them, not like generic AI, with format picked per platform
  4. User can generate images using GPT Image, Ideogram 3, or Flux 2, and generate videos using Kling, Runway, or Pika, with Claude picking the best tool for the job and media processed to meet platform specs
  5. Every post goes through human review, edits are tracked, and drafts are stored locally with auto-pruning
**Plans**: 7 plans

Plans:
- [x] 03-01-PLAN.md — Voice profile schema, YAML operations, strategy generation
- [x] 03-02-PLAN.md — Image generation (GPT Image, Ideogram 3, Flux 2) with platform processing
- [x] 03-03-PLAN.md — Video generation (Kling, Runway, Pika) with provider selection
- [x] 03-04-PLAN.md — Voice interview engine and content import
- [x] 03-05-PLAN.md — Content brain, format picker, topic suggestions, draft management
- [x] 03-06-PLAN.md — Calibration engine, edit tracking, brand voice profiles
- [x] 03-07-PLAN.md — Slash commands (/psn:post, /psn:voice, /psn:config voice)

### Phase 4: Analytics and Learning Loop
**Goal**: User can see what content is working, and the system learns from engagement data and edit patterns to improve future content
**Depends on**: Phase 3 (needs published posts with engagement data)
**Requirements**: ANLYT-01, ANLYT-05, ANLYT-06, ANLYT-07, ANLYT-08, ANLYT-09, LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, LEARN-06, LEARN-07, LEARN-08, POST-13, SCHED-06
**Success Criteria** (what must be TRUE):
  1. Analytics collector pulls X metrics daily and each post gets a composite engagement score (saves > shares > comments > likes)
  2. User can run `/psn:review` and see per-post breakdown of what worked, what didn't, and actionable recommendations
  3. Weekly review updates the preference model with engagement signals, edit patterns, and explicit feedback
  4. System makes autonomous adjustments (pillar weights, posting times, format preferences) and shows a transparent changelog
  5. User overrides are permanent and the system respects locked settings; content fatigue tracker cools down overused topics
**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — DB schema (metrics, preferences, adjustments), XClient GET methods, engagement scoring engine (TDD)
- [x] 04-02-PLAN.md — Analytics collector Trigger.dev task with tiered cadence, content fatigue detection
- [x] 04-03-PLAN.md — Preference model, autonomous adjustments engine, user override locks, strategy changelog
- [x] 04-04-PLAN.md — Weekly review generator (/psn:review), monthly deep analysis task, report saving
- [x] 04-05-PLAN.md — Preference model wiring into content generation, semi-automated draft finish, hub routing

### Phase 5: Intelligence, Ideation, and Planning
**Goal**: User can capture ideas, get trend-informed suggestions, plan a full week of content, create recurring series, and post in both English and Spanish
**Depends on**: Phase 4 (learning loop informs ideation quality; analytics inform planning)
**Requirements**: INTEL-01, INTEL-02, INTEL-03, INTEL-04, INTEL-05, INTEL-06, IDEA-01, IDEA-02, IDEA-03, IDEA-04, IDEA-05, IDEA-06, IDEA-07, IDEA-08, PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08, PLAN-09, PLAN-10, SERIES-01, SERIES-02, SERIES-03, SERIES-04, SERIES-05, SERIES-06, POST-07, POST-08, ANLYT-10, CONTENT-03, CONTENT-04
**Success Criteria** (what must be TRUE):
  1. Trend collector pulls daily from HN, Reddit, Product Hunt, Google Trends RSS, and RSS feeds; lighter polls every 2-4 hours for breaking news
  2. User can capture ideas in under 30 seconds via `/psn:capture` and ideas flow through the maturity pipeline (spark to used/killed)
  3. User can run `/psn:plan` for weekly batch ideation showing calendar state, generating ideas mixed with ready ideas from the bank, and scheduling a full week
  4. User can create content series with cadence and format templates that auto-slot into weekly plans
  5. User can choose language (en/es/both) per post with bilingual posts independently crafted, not translated
**Plans**: 6 plans

Plans:
- [x] 05-01-PLAN.md — DB schema (ideas, series, trends, weekly_plans, monitored_accounts) + posts/metrics extensions
- [x] 05-02-PLAN.md — Intelligence source adapters, scoring engine, search clients, competitive intelligence
- [x] 05-03-PLAN.md — Idea bank with capture, lifecycle state machine, /psn:capture command
- [x] 05-04-PLAN.md — Trigger.dev tasks (trend collector, breaking news poller, idea expiry)
- [x] 05-05-PLAN.md — Content series management, episode tracking, pattern detection, /psn:series command
- [x] 05-06-PLAN.md — Weekly planning engine, content recycling/remixing, bilingual support, /psn:plan command

### Phase 6: LinkedIn and Multi-Platform
**Goal**: User can post to LinkedIn in addition to X, with content adapted per platform and failures isolated
**Depends on**: Phase 5. External dependency: LinkedIn partner API approval (submitted in Phase 1).
**Requirements**: AUTH-02, PLAT-02, PLAT-06, PLAT-07, ANLYT-02, POST-02
**Success Criteria** (what must be TRUE):
  1. User can authenticate with LinkedIn via OAuth and tokens refresh automatically with 60-day expiry tracking
  2. User can generate and post LinkedIn content (text, carousels, images) adapted to LinkedIn's format strengths
  3. Analytics collector pulls LinkedIn metrics daily and shows them in `/psn:review`
  4. Multi-platform posting works with partial failure isolation (LinkedIn failure does not block X posting)
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — LinkedIn OAuth, typed API client, image/document media upload, carousel PDF generation, token-refresher extension
- [x] 06-02-PLAN.md — Multi-platform publish dispatch with partial failure isolation, LinkedIn format picker, content adaptation, LinkedIn analytics collection

### Phase 7: Team Coordination and Notifications
**Goal**: Teams can coordinate content through Company Hubs with approval workflows and WhatsApp notifications
**Depends on**: Phase 6 (multi-platform infrastructure must be stable before adding team complexity)
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06, TEAM-07, TEAM-08, TEAM-09, NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, LEARN-09, SERIES-07, CONFIG-05, CONFIG-06
**Success Criteria** (what must be TRUE):
  1. Admin can create a Company Hub and generate invite codes; team members can join via `/psn:setup join`
  2. Postgres RLS enforces per-user data isolation in Company Hub and team member leaving is clean (delete connection file)
  3. Company posts go through approval workflow (submit, notify approvers, approve/reject, schedule/cancel) via `/psn:approve`
  4. WhatsApp notifications work across all 3 tiers (push, digest, standard) with fatigue prevention and structured command interaction
  5. `/psn:calendar` merges Personal Hub and all connected Company Hubs into a unified view with slot claiming
**Plans**: 5 plans

Plans:
- [ ] 07-01-PLAN.md — DB schema extensions (team_members, invite_codes, notification tables, posts approval columns), team/approval/notification type definitions
- [ ] 07-02-PLAN.md — Company Hub provisioning, invite code flow, team member management, setup CLI extensions (hub/join/disconnect)
- [ ] 07-03-PLAN.md — Approval workflow state machine, multi-hub calendar with slot claiming, publish-post approval gate, company brand preference model
- [ ] 07-04-PLAN.md — WhatsApp provider abstraction (WAHA/Twilio), notification dispatcher with fatigue prevention, structured commands, digest compiler
- [ ] 07-05-PLAN.md — Slash commands (/psn:approve, /psn:calendar, /psn:setup extensions for hub/join/disconnect/invite/team/notifications)

### Phase 8: Instagram, TikTok, and Engagement
**Goal**: User can post to all 4 platforms and proactively engage with trending content in their niche
**Depends on**: Phase 7. External dependency: TikTok audit approval (submitted in Phase 1).
**Requirements**: AUTH-03, AUTH-04, PLAT-03, PLAT-04, ANLYT-03, ANLYT-04, POST-03, POST-04, ENGAGE-01, ENGAGE-02, ENGAGE-03, ENGAGE-04, ENGAGE-05, ENGAGE-06, ENGAGE-07
**Success Criteria** (what must be TRUE):
  1. User can authenticate with Instagram (via Facebook OAuth) and TikTok, with tokens managed automatically
  2. User can generate and post Instagram content (feed images, carousels, Reels) within the 200 req/hr rate limit budget
  3. User can generate and post TikTok content (video, photos) with chunked upload support
  4. Engagement monitor surfaces trending posts in user's niche with scored opportunities and draft reply options
  5. User can run `/psn:engage` for proactive engagement sessions with human approval on every reply and daily caps enforced

**Plans**: 5 plans

Plans:
- [x] 08-01-PLAN.md — Instagram OAuth (direct login), Graph API client, container-based media publishing, hashtag pool management
- [x] 08-02-PLAN.md — TikTok OAuth (Arctic PKCE), Content Posting API client, chunked video upload, photo posting, Creative Center
- [x] 08-03-PLAN.md — Instagram/TikTok analytics collection, multi-platform publish dispatch, content generation and format picker extensions
- [x] 08-04-PLAN.md — Engagement DB schema (opportunities, config, log), composite scoring engine, cross-platform monitor, Trigger.dev cron
- [x] 08-05-PLAN.md — Voice-matched reply drafting, triage-then-draft session, /psn:engage command, outcome tracking, content bridge
- [x] 08-06-PLAN.md — Gap closure: ENGAGE-01 text alignment, engagement tracker → learning loop wire

### Phase 9: Integration Wiring Fixes
**Goal**: All notification events fire correctly, idea bank surfaces during content generation, calendar shows all hubs, and preference locks are respected
**Depends on**: Phase 8 (all code exists, just needs wiring)
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06, NOTIF-07, NOTIF-08, TEAM-05, AUTH-07, POST-11, TEAM-07, TEAM-08, ENGAGE-03, LEARN-07
**Gap Closure:** Closes integration gaps 1-4 and flow gaps 1-3 from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. notificationDispatcherTask is triggered by approval workflow (submit, approve, reject), publish-post failures, and token-refresher failures
  2. Engagement monitor triggers notification dispatcher for push-tier opportunities (score 70+)
  3. checkIdeaBank() in generate.ts receives db and userId — ready ideas surface during `/psn:post`
  4. calendarCommand in plan.ts uses getUnifiedCalendar — company hub posts visible during weekly planning
  5. generate.ts checks lockedSettings from locks.ts before applying preference model adjustments

**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md — Wire notification dispatcher into publish-post, token-refresher, approval workflow, and engagement monitor
- [ ] 09-02-PLAN.md — Fix checkIdeaBank args, switch to unified calendar, add locked settings checks in generate.ts

### Phase 10: Milestone Documentation Closure
**Goal**: All v1.0 requirements have verification artifacts and REQUIREMENTS.md reflects actual completion status
**Depends on**: Phase 9 (integration fixes must be done before final verification)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, CONFIG-01, CONFIG-04, CONFIG-07, AUTH-02, PLAT-02, PLAT-06, PLAT-07, ANLYT-02, POST-02
**Gap Closure:** Closes 16 partial/unsatisfied requirements from v1.0 audit (documentation gaps)
**Success Criteria** (what must be TRUE):
  1. VERIFICATION.md exists for Phase 1 confirming all 10 requirements are satisfied
  2. VERIFICATION.md exists for Phase 6 confirming all 6 requirements are satisfied
  3. Phase 6 SUMMARY files have requirements-completed frontmatter
  4. All 16 requirement checkboxes in REQUIREMENTS.md are checked with status "Complete"
  5. CONFIG-04: search providers read API keys from api_keys DB table (not just process.env)

Plans:
- [x] 10-01-PLAN.md — Create verification artifacts, update REQUIREMENTS.md, add Phase 6 SUMMARY frontmatter

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Infrastructure | 3/3 | Complete | 2026-02-18 |
| 2. X Platform Pipeline | 4/4 | Complete | 2026-02-19 |
| 3. Voice Profiling and Content Generation | 7/7 | Complete | 2026-02-19 |
| 4. Analytics and Learning Loop | 5/5 | Complete | 2026-02-19 |
| 5. Intelligence, Ideation, and Planning | 6/6 | Complete | 2026-02-19 |
| 6. LinkedIn and Multi-Platform | 2/2 | Complete | 2026-02-19 |
| 7. Team Coordination and Notifications | 5/5 | Complete | 2026-02-19 |
| 8. Instagram, TikTok, and Engagement | 6/6 | Complete | 2026-02-19 |
| 9. Integration Wiring Fixes | 2/2 | Complete | 2026-02-19 |
| 10. Milestone Documentation Closure | 1/1 | Complete | 2026-02-19 |
| 11. Tech Debt Remediation | 3/6 | In Progress|  |
| 12. Solo Founder Experience | 0/3 | Pending | — |
| 13. Academic Content Support | 0/1 | Pending | — |

### Phase 11: Tech Debt Remediation - CONFIG-04 + IMG/VID Provider Migration

**Goal:** All external API keys (search, image, video providers) stored encrypted in api_keys table with hub-scoped access for multi-tenant architecture. Search providers read from DB (not process.env), and media generation providers accept hub context via --hub-id CLI flag.
**Depends on:** Phase 10
**Requirements:** CONFIG-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, VID-01, VID-02, VID-03, VID-04, VID-05
**Success Criteria** (what must be TRUE):
  1. getApiKey/setApiKey/listKeys functions manage encrypted keys in api_keys table
  2. All search providers (Perplexity, Brave, Tavily, Exa) use getApiKey() for hub-scoped keys
  3. All image providers (GPT Image, Ideogram, Flux) use getApiKey() when db + hubId provided
  4. All video providers (Kling, Runway, Pika) use getApiKey() when db + hubId provided
  5. /psn:setup collects and stores provider keys per hub (encrypted in DB)
  6. Hub context flows from CLI/Trigger tasks to providers via db + hubId parameters
**Plans:** 3/6 plans executed

Plans:
- [ ] 11-01-PLAN.md — Create getApiKey/setApiKey/listKeys functions for encrypted key storage
- [ ] 11-02-PLAN.md — Migrate search providers (Perplexity, Brave, Tavily, Exa) to DB keys
- [ ] 11-03-PLAN.md — Migrate image providers (GPT Image, Ideogram, Flux) to DB keys
- [ ] 11-04-PLAN.md — Migrate video providers (Kling, Runway, Pika) to DB keys
- [ ] 11-05-PLAN.md — Extend /psn:setup to collect and store provider keys per hub
- [ ] 11-06-PLAN.md — Wire search and media generation calls with hub context passing

### Phase 12: Solo Founder Experience

**Goal:** Solo founders with multiple projects can maintain distinct voices per entity without Company Hub overhead, and new users get maturity-appropriate guidance through unified setup flow.
**Depends on:** Phase 11
**Requirements:** VOICE-11 (new), SETUP-01 (new), PLAN-11 (new)
**Success Criteria** (what must be TRUE):
  1. User can create entity-scoped voice profiles (e.g., `psn-founder.yaml`, `side-project.yaml`) without creating Company Hubs
  2. `/psn:setup` absorbs voice interview functionality — single command for all configuration (infrastructure, voice, connections)
  3. Voice interview captures social maturity level (never posted / sporadic / consistent / very active)
  4. `/psn:plan` adapts prescriptiveness based on user maturity: more hand-holding for cold-start users, more autonomous for mature users
  5. `/psn:setup` detects what's already configured and offers targeted updates (voice only, add platform, manage connections)
**Plans:** 3 plans

Plans:
- [ ] 12-01-PLAN.md — Entity-scoped voice profiles: schema extension, profile selection during `/psn:post`, persona routing without Company Hub dependency
- [ ] 12-02-PLAN.md — Merge `/psn:voice` into `/psn:setup`: unified configuration flow, smart detection of existing config, targeted update prompts
- [ ] 12-03-PLAN.md — Social maturity capture and maturity-aware planning: maturity field in voice profile, `/psn:plan` behavior adaptation, progressive autonomy

### Phase 13: Academic Content Support

**Goal:** Users publishing papers or research content have purpose-built archetypes and templates for academic-style posts across platforms.
**Depends on:** Phase 12 (voice system extensions)
**Requirements:** CONTENT-06 (new), ARCHETYPE-01 (new)
**Success Criteria** (what must be TRUE):
  1. `paper` or `research` content archetype exists with templates for paper announcements, thread breakdowns, and "what this means" translations
  2. Format picker recognizes research content and suggests appropriate formats per platform (LinkedIn carousel for findings, X thread for breakdowns)
  3. Templates include citation-ready formatting and hooks optimized for academic communities
  4. Archetype balances technical accuracy with accessibility for broader audiences
**Plans:** 1 plan

Plans:
- [ ] 13-01-PLAN.md — Academic archetype: template definitions, format picker integration, hook patterns for research content
