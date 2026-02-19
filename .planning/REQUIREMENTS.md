# Requirements: Post Shit Now

**Defined:** 2026-02-18
**Core Value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Developer can set up project with Node.js 22 LTS, pnpm, TypeScript 5.7+, Biome linting, Vitest testing
- [ ] **INFRA-02**: Shared `@psn/core` package contains Drizzle schemas, API clients, types, and hub connection logic
- [ ] **INFRA-03**: User can provision a Personal Hub (Neon Postgres database + Trigger.dev Cloud project) via `/psn:setup`
- [ ] **INFRA-04**: Hub connector (`createHubConnection()`) establishes typed database connections with proper error handling
- [ ] **INFRA-05**: Drizzle Kit migration infrastructure generates and applies migrations (never `push` in production)
- [ ] **INFRA-06**: Post watchdog task detects stuck Trigger.dev runs (scheduled posts that missed their window) and re-triggers them
- [ ] **INFRA-07**: All secrets (API keys, hub credentials, connection files) are gitignored and never committed

### Authentication & Tokens

- [x] **AUTH-01**: User can authenticate with X via OAuth 2.0 PKCE flow using Arctic library
- [ ] **AUTH-02**: User can authenticate with LinkedIn via OAuth 2.0 3-legged flow using Arctic library
- [ ] **AUTH-03**: User can authenticate with Instagram via Facebook OAuth flow using Arctic library
- [ ] **AUTH-04**: User can authenticate with TikTok via OAuth 2.0 flow using Arctic library
- [x] **AUTH-05**: Token refresher task runs daily and proactively refreshes tokens within 7 days of expiry
- [x] **AUTH-06**: OAuth token refresh uses Postgres row-level locking (`SELECT FOR UPDATE SKIP LOCKED`) to prevent race conditions
- [x] **AUTH-07**: User is notified when token refresh fails and manual re-authorization is needed
- [x] **AUTH-08**: OAuth tokens are stored encrypted in Hub DB `oauth_tokens` table, not in environment variables

### Voice Profiling

- [ ] **VOICE-01**: User can complete a voice profiling interview that captures identity, voice patterns, boundaries, and platform preferences
- [ ] **VOICE-02**: User can import existing content (X history, LinkedIn posts, blog posts) to bootstrap voice patterns
- [ ] **VOICE-03**: System generates a `personal.yaml` voice profile with language-agnostic traits and language-specific sections
- [ ] **VOICE-04**: Calibration mode tracks edit rates over first 10-15 posts and presents calibration reports
- [ ] **VOICE-05**: Blank-slate users (no existing content) get a shorter personality-first interview with starter archetypes
- [ ] **VOICE-06**: Bilingual users complete voice interview in both English and Spanish with language-specific voice sections
- [ ] **VOICE-07**: User can create brand-operator voice profiles per connected company
- [ ] **VOICE-08**: User can create brand-ambassador voice profiles that inherit from personal with company guardrails
- [ ] **VOICE-09**: User can do quick voice tweaks via `/psn:config voice` (add banned words, adjust formality)
- [ ] **VOICE-10**: User can trigger full voice recalibration via `/psn:setup voice`

### Content Creation

- [ ] **POST-01**: User can generate a post for X in their voice using `/psn:post`
- [ ] **POST-02**: User can generate a post for LinkedIn in their voice using `/psn:post`
- [ ] **POST-03**: User can generate a post for Instagram in their voice using `/psn:post`
- [ ] **POST-04**: User can generate a post for TikTok in their voice using `/psn:post`
- [ ] **POST-05**: Content brain picks optimal format per platform (text, thread, carousel, reel script, TikTok concept)
- [ ] **POST-06**: User can choose posting persona (personal, brand operator, brand ambassador) per post
- [ ] **POST-07**: User can choose language (en, es, both) per post with platform-specific defaults
- [ ] **POST-08**: Bilingual posts (`both`) are independently crafted per language, not translated
- [ ] **POST-09**: User reviews and edits every generated post before scheduling (human-in-the-loop)
- [ ] **POST-10**: Every edit is tracked with edit distance and edit patterns for the learning loop
- [ ] **POST-11**: System checks idea bank for ready ideas before asking for a topic
- [ ] **POST-12**: System offers 3 quick topic suggestions when no topic provided and no ready ideas exist
- [ ] **POST-13**: Semi-automated formats (video scripts, TikTok stitches) save script + talking points to drafts; user records then runs `/psn:post finish`
- [ ] **POST-14**: Generated content reflects learnings from preference model (best hooks, formats, fatigued topics)

### Scheduling

- [x] **SCHED-01**: User can schedule a post for a specific date and time
- [x] **SCHED-02**: Post scheduler task publishes content at scheduled time via Trigger.dev delayed run
- [x] **SCHED-03**: Scheduler handles multi-step media upload (register → upload → attach) per platform
- [x] **SCHED-04**: Scheduler retries 3x with exponential backoff on failure; respects platform rate limit windows
- [x] **SCHED-05**: Failed posts notify the user and are tagged `status:failed`
- [ ] **SCHED-06**: Personal posts write to Personal Hub content queue; company posts write to Company Hub

### Image Generation

- [ ] **IMG-01**: User can generate images for posts using GPT Image (versatile)
- [ ] **IMG-02**: User can generate images using Ideogram 3 (best text rendering)
- [ ] **IMG-03**: User can generate images using Flux 2 via fal.ai (photorealistic)
- [ ] **IMG-04**: Images are processed via sharp to meet platform-specific format and size requirements
- [ ] **IMG-05**: Claude picks the best image generation tool based on content type

### Video Generation

- [ ] **VID-01**: User can generate animated text/quote videos for posts (fully automated, no recording needed)
- [ ] **VID-02**: User can generate b-roll with voiceover using TTS for posts (fully automated, no recording needed)
- [ ] **VID-03**: User can generate short video clips using Kling (realistic motion, product demos), Runway (stylized, image-to-video), or Pika (animated clips, text-to-video)
- [ ] **VID-04**: Claude picks the best video generation tool based on content type (matching IMG-05 pattern for images)
- [ ] **VID-05**: Generated video meets platform-specific format and length requirements (X: under 15s optimal, TikTok: 60s+ favored, Instagram Reels: watch-time optimized)

### Analytics

- [ ] **ANLYT-01**: Analytics collector task pulls metrics from X API daily and writes to Hub DB
- [ ] **ANLYT-02**: Analytics collector pulls metrics from LinkedIn API daily
- [ ] **ANLYT-03**: Analytics collector pulls metrics from Instagram API daily (within 200 req/hr budget)
- [ ] **ANLYT-04**: Analytics collector pulls metrics from TikTok API daily
- [ ] **ANLYT-05**: Each post receives a composite engagement score (saves > shares > comments > likes)
- [ ] **ANLYT-06**: User can view performance analysis via `/psn:review` showing what worked and what didn't
- [ ] **ANLYT-07**: Weekly review includes per-platform performance, per-post breakdown, and recommendations
- [ ] **ANLYT-08**: Monthly deep analysis auto-escalates: voice drift detection, audience model update, risk budget recalibration
- [ ] **ANLYT-09**: Reports saved to `analytics/reports/` for reference
- [ ] **ANLYT-10**: Per-language performance tracking (engagement by en/es/both)

### Learning Loop

- [ ] **LEARN-01**: System tracks engagement signals (saves, shares, comments, follows) weighted by quality
- [ ] **LEARN-02**: System tracks edit signals (edit distance, patterns, categories) from every post review
- [ ] **LEARN-03**: System prompts explicit feedback at key moments (3x above average, significant underperformance, high/low edit streaks)
- [ ] **LEARN-04**: Preference model updates weekly during `/psn:review` with platform learnings, archetype performance, edit patterns
- [ ] **LEARN-05**: Autonomous adjustments: pillar weights (±5%/cycle), posting times, format preferences, topic fatigue, frequency (±1/week)
- [ ] **LEARN-06**: Transparent changelog shows all autonomous changes in weekly review ("what the brain changed this week")
- [ ] **LEARN-07**: User overrides are permanent — system will not re-adjust locked settings
- [ ] **LEARN-08**: Content fatigue tracker cools down overused topics and formats
- [ ] **LEARN-09**: Company brand preference model in Company Hub DB shared across team members

### Idea Bank

- [ ] **IDEA-01**: User can capture ideas via `/psn:capture` in under 30 seconds (URL, screenshot, text, raw thought)
- [ ] **IDEA-02**: Ideas flow through maturity pipeline: spark → seed → ready → claimed → developed → used/killed
- [ ] **IDEA-03**: Ideas have urgency classification: timely (24-48h), seasonal (event-tied), evergreen (no expiry)
- [ ] **IDEA-04**: Timely ideas that expire without being claimed are auto-killed
- [ ] **IDEA-05**: Personal ideas live in Personal Hub DB; company ideas live in Company Hub DB
- [ ] **IDEA-06**: Team members can claim company ideas (status: ready → claimed, locked to prevent duplicates)
- [ ] **IDEA-07**: `/psn:capture` distinguishes timely vs evergreen and routes accordingly
- [ ] **IDEA-08**: Killed ideas record reasoning and feed back into preference model

### Weekly Planning

- [ ] **PLAN-01**: User can run `/psn:plan` for weekly batch ideation + generation + scheduling
- [ ] **PLAN-02**: Planning shows current week's calendar state (scheduled, series due dates, gaps)
- [ ] **PLAN-03**: Ideation phase checks stored trend data, fires real-time searches, reviews analytics, checks idea bank
- [ ] **PLAN-04**: System generates 10-15 ideas with angles mixed with existing ready ideas from Hub
- [ ] **PLAN-05**: User rates ideas: love it (→ ready) / maybe later (→ seed) / kill it (→ killed with reason)
- [ ] **PLAN-06**: Batch generation: series installments auto-slotted first, ready ideas fill gaps, new posts for remaining slots
- [ ] **PLAN-07**: Each slot gets a language suggestion based on platform config and recent language mix
- [ ] **PLAN-08**: User can bail at any phase (just ideate, just generate, or full plan+schedule)
- [ ] **PLAN-09**: Content pillar distribution balances across categories per strategy.yaml weights
- [ ] **PLAN-10**: Content archetype balancing prevents monotonous content patterns

### Content Series

- [ ] **SERIES-01**: User can create a content series via `/psn:series create` with format, cadence, branding
- [ ] **SERIES-02**: Series have YAML config defining format structure, platform, cadence, and branding
- [ ] **SERIES-03**: Series installments auto-slot into weekly plans and surface in `/psn:post`
- [ ] **SERIES-04**: User can pause, resume, and retire series via `/psn:series`
- [ ] **SERIES-05**: Per-series analytics tracked separately in `/psn:review`
- [ ] **SERIES-06**: System suggests formalizing as series when it detects recurring post patterns
- [ ] **SERIES-07**: Company-scoped series in Company Hub with contributor rotation support

### Intelligence

- [ ] **INTEL-01**: Trend collector task runs daily at 6 AM pulling from HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds
- [ ] **INTEL-02**: Lighter poll every 2-4 hours during business hours checks HN front page + X trending for breaking news
- [ ] **INTEL-03**: Trends scored by relevance to user's content pillars and stored in Hub DB
- [ ] **INTEL-04**: On-demand research during `/psn:plan` fires Perplexity, Exa, Tavily, Brave searches
- [ ] **INTEL-05**: Competitive intelligence tracks monitored accounts and surfaces gaps
- [ ] **INTEL-06**: Trend alerter generates 2-3 suggested angles for push-worthy trends (score 70+)

### Engagement Engine

- [ ] **ENGAGE-01**: Engagement monitor task checks for viral/trending posts in user's niche every 5-15 min during active hours
- [ ] **ENGAGE-02**: Opportunities scored: relevance × author influence × post velocity × time window remaining
- [ ] **ENGAGE-03**: Scores 60+: draft 2-3 reply options using voice profile's reply_style; 70+: push notify; 60-69: digest
- [ ] **ENGAGE-04**: User can run `/psn:engage` for proactive 15-minute engagement sessions
- [ ] **ENGAGE-05**: Human approves every reply — never auto-post
- [ ] **ENGAGE-06**: Daily caps, cooldowns, and blocklists per platform enforced
- [ ] **ENGAGE-07**: After engagement session, Claude bridges to content creation ("Any of these conversations spark a post idea?")

### Notifications

- [ ] **NOTIF-01**: WhatsApp notifications via WAHA (self-hosted) with Twilio as configurable fallback
- [ ] **NOTIF-02**: Tier 1 push notifications: trending topics (70+), engagement opportunities, content going viral, timely ideas expiring, approvals needed
- [ ] **NOTIF-03**: Tier 2 morning digest at configurable time with adaptive content based on user journey stage
- [ ] **NOTIF-04**: Tier 3 standard notifications: post scheduled/published, approval results, weekly digest, token expiring
- [ ] **NOTIF-05**: WhatsApp structured commands: R1/R2/R3 (reply selection), skip, approve, reject, edit, post, time, list, help
- [ ] **NOTIF-06**: Conversation state machine tracks active notification context per user in `whatsapp_sessions` table
- [ ] **NOTIF-07**: Notification fatigue prevention: hard caps (3 push/day), cooldowns (2hr), dedup, feedback loop, quiet hours
- [ ] **NOTIF-08**: Company-level notification routing based on team member expertise

### Company Coordination

- [ ] **TEAM-01**: Admin can create a Company Hub via `/psn:setup hub` (separate Neon DB + Trigger.dev project)
- [ ] **TEAM-02**: Admin can generate one-time invite codes (7-day expiry) for team members
- [ ] **TEAM-03**: Team member can join a Company Hub via `/psn:setup join` with invite code
- [ ] **TEAM-04**: Postgres RLS enforces per-user data isolation in Company Hub
- [ ] **TEAM-05**: Company posts follow approval workflow: submit → notify approvers → approve/reject → schedule/cancel
- [ ] **TEAM-06**: `/psn:approve` shows pending posts with calendar context and related ideas
- [ ] **TEAM-07**: Team member leaving = delete connection file; personal data unaffected
- [ ] **TEAM-08**: `/psn:calendar` merges Personal Hub + all connected Company Hubs into unified view
- [ ] **TEAM-09**: Calendar slot claiming with Company Hub conflict checking

### Platform Support

- [x] **PLAT-01**: X posting: text posts, threads (3-7 tweets), images, scheduling via Trigger.dev delayed runs
- [ ] **PLAT-02**: LinkedIn posting: text posts, carousels (PDF), images, scheduling
- [ ] **PLAT-03**: Instagram posting: feed images, carousels (up to 10), Reels, scheduling
- [ ] **PLAT-04**: TikTok posting: video, photos, scheduling
- [x] **PLAT-05**: Each platform has its own typed API client with rate limit awareness
- [ ] **PLAT-06**: Platform-specific content adaptation (thread structure for X, carousel for LinkedIn, reel script for IG)
- [ ] **PLAT-07**: Multi-platform posting with partial failure isolation (one platform failure doesn't block others)

### Configuration & Setup

- [ ] **CONFIG-01**: `/psn:setup` walks through full onboarding: Hub creation, OAuth, API keys, voice profiling, preferences
- [ ] **CONFIG-02**: Strategy.yaml auto-generated from voice interview with content pillars, platform config, posting frequency
- [ ] **CONFIG-03**: `/psn:config` allows manual overrides for notifications, engagement, language, frequency, pillars, voice tweaks
- [ ] **CONFIG-04**: BYOK model: user provides all API keys (platform APIs, image gen, intelligence, Trigger.dev, Neon)
- [ ] **CONFIG-05**: `/psn:setup join` connects to Company Hub; `/psn:setup hub` creates Company Hub
- [ ] **CONFIG-06**: `/psn:setup disconnect` cleanly removes a Company Hub connection
- [ ] **CONFIG-07**: Database migrations run automatically during setup via Drizzle Kit

### Content Management

- [ ] **CONTENT-01**: Drafts stored in `content/drafts/` with auto-pruning 14 days after publishing
- [ ] **CONTENT-02**: Generated media stored in `content/media/` with auto-pruning 7 days after posting
- [ ] **CONTENT-03**: Content remixing: system suggests re-angling high-performing content for different platforms
- [ ] **CONTENT-04**: Content recycling: system surfaces past top performers with fresh angles during `/psn:plan`
- [x] **CONTENT-05**: Content queue in Hub DB `posts` table is source of truth for scheduled/published posts

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Automation

- **AUTO-01**: Claude-powered WhatsApp chatbot replacing structured commands with natural language
- **AUTO-02**: Cloud media storage (S3/Cloudflare R2) replacing local git for media assets
- **AUTO-03**: Content template library formalized from winning structures (if preference model tracking proves insufficient)

### Scaling

- **SCALE-01**: Team analytics leaderboard (opt-in)
- **SCALE-02**: Streamlined team onboarding workflows for new members at scale
- **SCALE-03**: Suggested content based on company milestones

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / visual calendar | Competes on competitors' home turf (Buffer, Hootsuite). CLI-first by design. Always inferior to purpose-built web tools. |
| Social inbox / unified DM management | Different product category (customer support, not growth). API access heavily restricted. |
| Fully automated posting (no human review) | AI slop is actively suppressed by all platforms in 2026. One bad auto-post can damage a brand permanently. |
| Paid ad management / boosting | Entirely different domain requiring budget management, audience targeting, conversion tracking. |
| Social listening / brand monitoring at scale | Enterprise feature ($1000+/mo category). Narrow competitive intelligence (5-10 accounts) is sufficient. |
| Real-time collaboration / shared editing | Requires CRDT/OT engineering. Sequential approval workflow handles the use case. |
| Content library / asset management (DAM) | Scope creep into a different product. Git-based media + external tools suffice. |
| Platform-native preview rendering | Each platform's rendering changes constantly. Character counts + media specs are sufficient. |
| Engagement pods / reciprocal liking | Violates every platform's TOS. Accounts get shadowbanned. |
| Languages beyond English and Spanish | Two is enough for v1. Additional languages add complexity to every feature. |
| Offline/degraded mode | Managed services have 99.9%+ uptime. Local fallback/sync layer not worth the complexity. |
| Self-hosted Trigger.dev | Cloud-only for simplicity and features (warm starts, auto-scaling, checkpoints). |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| INFRA-07 | Phase 1 | Pending |
| CONFIG-01 | Phase 1 | Pending |
| CONFIG-04 | Phase 1 | Pending |
| CONFIG-07 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 2 | Complete |
| AUTH-08 | Phase 2 | Complete |
| PLAT-01 | Phase 2 | Complete |
| PLAT-05 | Phase 2 | Complete |
| SCHED-01 | Phase 2 | Complete |
| SCHED-02 | Phase 2 | Complete |
| SCHED-03 | Phase 2 | Complete |
| SCHED-04 | Phase 2 | Complete |
| SCHED-05 | Phase 2 | Complete |
| CONTENT-05 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Pending |
| VOICE-02 | Phase 3 | Pending |
| VOICE-03 | Phase 3 | Pending |
| VOICE-04 | Phase 3 | Pending |
| VOICE-05 | Phase 3 | Pending |
| VOICE-06 | Phase 3 | Pending |
| VOICE-07 | Phase 3 | Pending |
| VOICE-08 | Phase 3 | Pending |
| VOICE-09 | Phase 3 | Pending |
| VOICE-10 | Phase 3 | Pending |
| POST-01 | Phase 3 | Pending |
| POST-05 | Phase 3 | Pending |
| POST-06 | Phase 3 | Pending |
| POST-09 | Phase 3 | Pending |
| POST-10 | Phase 3 | Pending |
| POST-11 | Phase 3 | Pending |
| POST-12 | Phase 3 | Pending |
| POST-14 | Phase 3 | Pending |
| IMG-01 | Phase 3 | Pending |
| IMG-02 | Phase 3 | Pending |
| IMG-03 | Phase 3 | Pending |
| IMG-04 | Phase 3 | Pending |
| IMG-05 | Phase 3 | Pending |
| VID-01 | Phase 3 | Pending |
| VID-02 | Phase 3 | Pending |
| VID-03 | Phase 3 | Pending |
| VID-04 | Phase 3 | Pending |
| VID-05 | Phase 3 | Pending |
| CONTENT-01 | Phase 3 | Pending |
| CONTENT-02 | Phase 3 | Pending |
| CONFIG-02 | Phase 3 | Pending |
| CONFIG-03 | Phase 3 | Pending |
| ANLYT-01 | Phase 4 | Pending |
| ANLYT-05 | Phase 4 | Pending |
| ANLYT-06 | Phase 4 | Pending |
| ANLYT-07 | Phase 4 | Pending |
| ANLYT-08 | Phase 4 | Pending |
| ANLYT-09 | Phase 4 | Pending |
| LEARN-01 | Phase 4 | Pending |
| LEARN-02 | Phase 4 | Pending |
| LEARN-03 | Phase 4 | Pending |
| LEARN-04 | Phase 4 | Pending |
| LEARN-05 | Phase 4 | Pending |
| LEARN-06 | Phase 4 | Pending |
| LEARN-07 | Phase 4 | Pending |
| LEARN-08 | Phase 4 | Pending |
| POST-13 | Phase 4 | Pending |
| SCHED-06 | Phase 4 | Pending |
| INTEL-01 | Phase 5 | Pending |
| INTEL-02 | Phase 5 | Pending |
| INTEL-03 | Phase 5 | Pending |
| INTEL-04 | Phase 5 | Pending |
| INTEL-05 | Phase 5 | Pending |
| INTEL-06 | Phase 5 | Pending |
| IDEA-01 | Phase 5 | Pending |
| IDEA-02 | Phase 5 | Pending |
| IDEA-03 | Phase 5 | Pending |
| IDEA-04 | Phase 5 | Pending |
| IDEA-05 | Phase 5 | Pending |
| IDEA-06 | Phase 5 | Pending |
| IDEA-07 | Phase 5 | Pending |
| IDEA-08 | Phase 5 | Pending |
| PLAN-01 | Phase 5 | Pending |
| PLAN-02 | Phase 5 | Pending |
| PLAN-03 | Phase 5 | Pending |
| PLAN-04 | Phase 5 | Pending |
| PLAN-05 | Phase 5 | Pending |
| PLAN-06 | Phase 5 | Pending |
| PLAN-07 | Phase 5 | Pending |
| PLAN-08 | Phase 5 | Pending |
| PLAN-09 | Phase 5 | Pending |
| PLAN-10 | Phase 5 | Pending |
| SERIES-01 | Phase 5 | Pending |
| SERIES-02 | Phase 5 | Pending |
| SERIES-03 | Phase 5 | Pending |
| SERIES-04 | Phase 5 | Pending |
| SERIES-05 | Phase 5 | Pending |
| SERIES-06 | Phase 5 | Pending |
| POST-07 | Phase 5 | Pending |
| POST-08 | Phase 5 | Pending |
| ANLYT-10 | Phase 5 | Pending |
| CONTENT-03 | Phase 5 | Pending |
| CONTENT-04 | Phase 5 | Pending |
| AUTH-02 | Phase 6 | Pending |
| PLAT-02 | Phase 6 | Pending |
| PLAT-06 | Phase 6 | Pending |
| PLAT-07 | Phase 6 | Pending |
| ANLYT-02 | Phase 6 | Pending |
| POST-02 | Phase 6 | Pending |
| TEAM-01 | Phase 7 | Pending |
| TEAM-02 | Phase 7 | Pending |
| TEAM-03 | Phase 7 | Pending |
| TEAM-04 | Phase 7 | Pending |
| TEAM-05 | Phase 7 | Pending |
| TEAM-06 | Phase 7 | Pending |
| TEAM-07 | Phase 7 | Pending |
| TEAM-08 | Phase 7 | Pending |
| TEAM-09 | Phase 7 | Pending |
| NOTIF-01 | Phase 7 | Pending |
| NOTIF-02 | Phase 7 | Pending |
| NOTIF-03 | Phase 7 | Pending |
| NOTIF-04 | Phase 7 | Pending |
| NOTIF-05 | Phase 7 | Pending |
| NOTIF-06 | Phase 7 | Pending |
| NOTIF-07 | Phase 7 | Pending |
| NOTIF-08 | Phase 7 | Pending |
| LEARN-09 | Phase 7 | Pending |
| SERIES-07 | Phase 7 | Pending |
| CONFIG-05 | Phase 7 | Pending |
| CONFIG-06 | Phase 7 | Pending |
| AUTH-03 | Phase 8 | Pending |
| AUTH-04 | Phase 8 | Pending |
| PLAT-03 | Phase 8 | Pending |
| PLAT-04 | Phase 8 | Pending |
| ANLYT-03 | Phase 8 | Pending |
| ANLYT-04 | Phase 8 | Pending |
| POST-03 | Phase 8 | Pending |
| POST-04 | Phase 8 | Pending |
| ENGAGE-01 | Phase 8 | Pending |
| ENGAGE-02 | Phase 8 | Pending |
| ENGAGE-03 | Phase 8 | Pending |
| ENGAGE-04 | Phase 8 | Pending |
| ENGAGE-05 | Phase 8 | Pending |
| ENGAGE-06 | Phase 8 | Pending |
| ENGAGE-07 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 148 total
- Mapped to phases: 148
- Unmapped: 0

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after roadmap creation*
