# Roadmap: Post Shit Now

## Overview

Post Shit Now delivers a Claude Code-first social media growth system in 8 phases. Phase 1 lays infrastructure (hub architecture, DB, migrations). Phase 2 adds OAuth and the X posting pipeline. Phase 3 builds voice profiling and content generation — the core differentiator. Phase 4 adds analytics and the learning loop that makes content improve over time. Phase 5 brings intelligence gathering, idea management, weekly planning, content series, and bilingual support. Phase 6 extends to LinkedIn with multi-platform adaptation. Phase 7 adds Company Hubs, team coordination, approval workflows, and WhatsApp notifications. Phase 8 completes platform coverage with Instagram, TikTok, and the engagement engine.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Infrastructure** - Project scaffolding, @psn/core package, Personal Hub provisioning, Drizzle migrations, BYOK setup
- [ ] **Phase 2: X Platform Pipeline** - OAuth for X, token management with race condition protection, post scheduling, media uploads
- [ ] **Phase 3: Voice Profiling and Content Generation** - Voice interviews, content import, calibration, post generation in user's voice, image generation, draft management
- [ ] **Phase 4: Analytics and Learning Loop** - X analytics collection, engagement scoring, performance review, 3-channel learning loop, preference model
- [ ] **Phase 5: Intelligence, Ideation, and Planning** - Trend collection, idea bank, weekly batch planning, content series, bilingual support, content recycling
- [ ] **Phase 6: LinkedIn and Multi-Platform** - LinkedIn OAuth and posting, multi-platform content adaptation, partial failure isolation
- [ ] **Phase 7: Team Coordination and Notifications** - Company Hub provisioning, invite codes, approval workflows, WhatsApp notifications, brand personas
- [ ] **Phase 8: Instagram, TikTok, and Engagement** - Instagram and TikTok posting, engagement engine with semi-automated replies

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
- [ ] 02-01-PLAN.md — DB schema expansion, X OAuth 2.0 PKCE module, API types, setup integration
- [ ] 02-02-PLAN.md — Thread auto-splitter and timezone utilities (TDD)
- [ ] 02-03-PLAN.md — X API client with rate limits, media upload, token refresher cron
- [ ] 02-04-PLAN.md — Publish-post task, post CLI, /psn:post command, watchdog update

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
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: LinkedIn and Multi-Platform
**Goal**: User can post to LinkedIn in addition to X, with content adapted per platform and failures isolated
**Depends on**: Phase 5. External dependency: LinkedIn partner API approval (submitted in Phase 1).
**Requirements**: AUTH-02, PLAT-02, PLAT-06, PLAT-07, ANLYT-02, POST-02
**Success Criteria** (what must be TRUE):
  1. User can authenticate with LinkedIn via OAuth and tokens refresh automatically with 60-day expiry tracking
  2. User can generate and post LinkedIn content (text, carousels, images) adapted to LinkedIn's format strengths
  3. Analytics collector pulls LinkedIn metrics daily and shows them in `/psn:review`
  4. Multi-platform posting works with partial failure isolation (LinkedIn failure does not block X posting)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

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

**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Infrastructure | 3/3 | Complete | 2026-02-18 |
| 2. X Platform Pipeline | 0/4 | Planned | - |
| 3. Voice Profiling and Content Generation | 0/3 | Not started | - |
| 4. Analytics and Learning Loop | 0/2 | Not started | - |
| 5. Intelligence, Ideation, and Planning | 0/3 | Not started | - |
| 6. LinkedIn and Multi-Platform | 0/2 | Not started | - |
| 7. Team Coordination and Notifications | 0/3 | Not started | - |
| 8. Instagram, TikTok, and Engagement | 0/3 | Not started | - |
