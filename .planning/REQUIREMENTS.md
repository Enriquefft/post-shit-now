# Requirements: Post Shit Now

**Defined:** 2026-02-18
**Core Value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [x] **INFRA-01**: Developer can set up project with Node.js 22 LTS, pnpm, TypeScript 5.7+, Biome linting, Vitest testing
- [x] **INFRA-02**: Shared `@psn/core` package contains Drizzle schemas, API clients, types, and hub connection logic
- [x] **INFRA-03**: User can provision a Personal Hub (Neon Postgres database + Trigger.dev Cloud project) via `/psn:setup`
- [x] **INFRA-04**: Hub connector (`createHubConnection()`) establishes typed database connections with proper error handling
- [x] **INFRA-05**: Drizzle Kit migration infrastructure generates and applies migrations (never `push` in production)
- [x] **INFRA-06**: Post watchdog task detects stuck Trigger.dev runs (scheduled posts that missed their window) and re-triggers them
- [x] **INFRA-07**: All secrets (API keys, hub credentials, connection files) are gitignored and never committed

### Authentication & Tokens

- [x] **AUTH-01**: User can authenticate with X via OAuth 2.0 PKCE flow using Arctic library
- [x] **AUTH-02**: User can authenticate with LinkedIn via OAuth 2.0 3-legged flow using Arctic library
- [x] **AUTH-03**: User can authenticate with Instagram via Facebook OAuth flow using Arctic library
- [x] **AUTH-04**: User can authenticate with TikTok via OAuth 2.0 flow using Arctic library
- [x] **AUTH-05**: Token refresher task runs daily and proactively refreshes tokens within 7 days of expiry
- [x] **AUTH-06**: OAuth token refresh uses Postgres row-level locking (`SELECT FOR UPDATE SKIP LOCKED`) to prevent race conditions
- [x] **AUTH-07**: User is notified when token refresh fails and manual re-authorization is needed
- [x] **AUTH-08**: OAuth tokens are stored encrypted in Hub DB `oauth_tokens` table, not in environment variables

### Voice Profiling

- [x] **VOICE-01**: User can complete a voice profiling interview that captures identity, voice patterns, boundaries, and platform preferences
- [x] **VOICE-02**: User can import existing content (X history, LinkedIn posts, blog posts) to bootstrap voice patterns
- [x] **VOICE-03**: System generates a `personal.yaml` voice profile with language-agnostic traits and language-specific sections
- [x] **VOICE-04**: Calibration mode tracks edit rates over first 10-15 posts and presents calibration reports
- [x] **VOICE-05**: Blank-slate users (no existing content) get a shorter personality-first interview with starter archetypes
- [x] **VOICE-06**: Bilingual users complete voice interview in both English and Spanish with language-specific voice sections
- [x] **VOICE-07**: User can create brand-operator voice profiles per connected company
- [x] **VOICE-08**: User can create brand-ambassador voice profiles that inherit from personal with company guardrails
- [x] **VOICE-09**: User can do quick voice tweaks via `/psn:config voice` (add banned words, adjust formality)
- [x] **VOICE-10**: User can trigger full voice recalibration via `/psn:setup voice`

### Content Creation

- [x] **POST-01**: User can generate a post for X in their voice using `/psn:post`
- [x] **POST-02**: User can generate a post for LinkedIn in their voice using `/psn:post`
- [x] **POST-03**: User can generate a post for Instagram in their voice using `/psn:post`
- [x] **POST-04**: User can generate a post for TikTok in their voice using `/psn:post`
- [x] **POST-05**: Content brain picks optimal format per platform (text, thread, carousel, reel script, TikTok concept)
- [x] **POST-06**: User can choose posting persona (personal, brand operator, brand ambassador) per post
- [x] **POST-07**: User can choose language (en, es, both) per post with platform-specific defaults
- [x] **POST-08**: Bilingual posts (`both`) are independently crafted per language, not translated
- [x] **POST-09**: User reviews and edits every generated post before scheduling (human-in-the-loop)
- [x] **POST-10**: Every edit is tracked with edit distance and edit patterns for the learning loop
- [x] **POST-11**: System checks idea bank for ready ideas before asking for a topic
- [x] **POST-12**: System offers 3 quick topic suggestions when no topic provided and no ready ideas exist
- [x] **POST-13**: Semi-automated formats (video scripts, TikTok stitches) save script + talking points to drafts; user records then runs `/psn:post finish`
- [x] **POST-14**: Generated content reflects learnings from preference model (best hooks, formats, fatigued topics)

### Scheduling

- [x] **SCHED-01**: User can schedule a post for a specific date and time
- [x] **SCHED-02**: Post scheduler task publishes content at scheduled time via Trigger.dev delayed run
- [x] **SCHED-03**: Scheduler handles multi-step media upload (register → upload → attach) per platform
- [x] **SCHED-04**: Scheduler retries 3x with exponential backoff on failure; respects platform rate limit windows
- [x] **SCHED-05**: Failed posts notify the user and are tagged `status:failed`
- [x] **SCHED-06**: Personal posts write to Personal Hub content queue; company posts write to Company Hub

### Image Generation

- [x] **IMG-01**: User can generate images for posts using GPT Image (versatile)
- [x] **IMG-02**: User can generate images using Ideogram 3 (best text rendering)
- [x] **IMG-03**: User can generate images using Flux 2 via fal.ai (photorealistic)
- [x] **IMG-04**: Images are processed via sharp to meet platform-specific format and size requirements
- [x] **IMG-05**: Claude picks the best image generation tool based on content type

### Video Generation

- [x] **VID-01**: User can generate animated text/quote videos for posts (fully automated, no recording needed)
- [x] **VID-02**: User can generate b-roll with voiceover using TTS for posts (fully automated, no recording needed)
- [x] **VID-03**: User can generate short video clips using Kling (realistic motion, product demos), Runway (stylized, image-to-video), or Pika (animated clips, text-to-video)
- [x] **VID-04**: Claude picks the best video generation tool based on content type (matching IMG-05 pattern for images)
- [x] **VID-05**: Generated video meets platform-specific format and length requirements (X: under 15s optimal, TikTok: 60s+ favored, Instagram Reels: watch-time optimized)

### Analytics

- [x] **ANLYT-01**: Analytics collector task pulls metrics from X API daily and writes to Hub DB
- [x] **ANLYT-02**: Analytics collector pulls metrics from LinkedIn API daily
- [x] **ANLYT-03**: Analytics collector pulls metrics from Instagram API daily (within 200 req/hr budget)
- [x] **ANLYT-04**: Analytics collector pulls metrics from TikTok API daily
- [x] **ANLYT-05**: Each post receives a composite engagement score (saves > shares > comments > likes)
- [x] **ANLYT-06**: User can view performance analysis via `/psn:review` showing what worked and what didn't
- [x] **ANLYT-07**: Weekly review includes per-platform performance, per-post breakdown, and recommendations
- [x] **ANLYT-08**: Monthly deep analysis auto-escalates: voice drift detection, audience model update, risk budget recalibration
- [x] **ANLYT-09**: Reports saved to `analytics/reports/` for reference
- [x] **ANLYT-10**: Per-language performance tracking (engagement by en/es/both)

### Learning Loop

- [x] **LEARN-01**: System tracks engagement signals (saves, shares, comments, follows) weighted by quality
- [x] **LEARN-02**: System tracks edit signals (edit distance, patterns, categories) from every post review
- [x] **LEARN-03**: System prompts explicit feedback at key moments (3x above average, significant underperformance, high/low edit streaks)
- [x] **LEARN-04**: Preference model updates weekly during `/psn:review` with platform learnings, archetype performance, edit patterns
- [x] **LEARN-05**: Autonomous adjustments: pillar weights (±5%/cycle), posting times, format preferences, topic fatigue, frequency (±1/week)
- [x] **LEARN-06**: Transparent changelog shows all autonomous changes in weekly review ("what the brain changed this week")
- [x] **LEARN-07**: User overrides are permanent — system will not re-adjust locked settings
- [x] **LEARN-08**: Content fatigue tracker cools down overused topics and formats
- [x] **LEARN-09**: Company brand preference model in Company Hub DB shared across team members

### Idea Bank

- [x] **IDEA-01**: User can capture ideas via `/psn:capture` in under 30 seconds (URL, screenshot, text, raw thought)
- [x] **IDEA-02**: Ideas flow through maturity pipeline: spark → seed → ready → claimed → developed → used/killed
- [x] **IDEA-03**: Ideas have urgency classification: timely (24-48h), seasonal (event-tied), evergreen (no expiry)
- [x] **IDEA-04**: Timely ideas that expire without being claimed are auto-killed
- [x] **IDEA-05**: Personal ideas live in Personal Hub DB; company ideas live in Company Hub DB
- [x] **IDEA-06**: Team members can claim company ideas (status: ready → claimed, locked to prevent duplicates)
- [x] **IDEA-07**: `/psn:capture` distinguishes timely vs evergreen and routes accordingly
- [x] **IDEA-08**: Killed ideas record reasoning and feed back into preference model

### Weekly Planning

- [x] **PLAN-01**: User can run `/psn:plan` for weekly batch ideation + generation + scheduling
- [x] **PLAN-02**: Planning shows current week's calendar state (scheduled, series due dates, gaps)
- [x] **PLAN-03**: Ideation phase checks stored trend data, fires real-time searches, reviews analytics, checks idea bank
- [x] **PLAN-04**: System generates 10-15 ideas with angles mixed with existing ready ideas from Hub
- [x] **PLAN-05**: User rates ideas: love it (→ ready) / maybe later (→ seed) / kill it (→ killed with reason)
- [x] **PLAN-06**: Batch generation: series installments auto-slotted first, ready ideas fill gaps, new posts for remaining slots
- [x] **PLAN-07**: Each slot gets a language suggestion based on platform config and recent language mix
- [x] **PLAN-08**: User can bail at any phase (just ideate, just generate, or full plan+schedule)
- [x] **PLAN-09**: Content pillar distribution balances across categories per strategy.yaml weights
- [x] **PLAN-10**: Content archetype balancing prevents monotonous content patterns

### Content Series

- [x] **SERIES-01**: User can create a content series via `/psn:series create` with format, cadence, branding
- [x] **SERIES-02**: Series have YAML config defining format structure, platform, cadence, and branding
- [x] **SERIES-03**: Series installments auto-slot into weekly plans and surface in `/psn:post`
- [x] **SERIES-04**: User can pause, resume, and retire series via `/psn:series`
- [x] **SERIES-05**: Per-series analytics tracked separately in `/psn:review`
- [x] **SERIES-06**: System suggests formalizing as series when it detects recurring post patterns
- [x] **SERIES-07**: Company-scoped series in Company Hub with contributor rotation support

### Intelligence

- [x] **INTEL-01**: Trend collector task runs daily at 6 AM pulling from HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds
- [x] **INTEL-02**: Lighter poll every 2-4 hours during business hours checks HN front page + X trending for breaking news
- [x] **INTEL-03**: Trends scored by relevance to user's content pillars and stored in Hub DB
- [x] **INTEL-04**: On-demand research during `/psn:plan` fires Perplexity, Exa, Tavily, Brave searches
- [x] **INTEL-05**: Competitive intelligence tracks monitored accounts and surfaces gaps
- [x] **INTEL-06**: Trend alerter generates 2-3 suggested angles for push-worthy trends (score 70+)

### Engagement Engine

- [x] **ENGAGE-01**: Engagement monitor task checks for viral/trending posts in user's niche every 2-4 hours (locked decision — supersedes original 5-15 min for cost/rate-limit reasons)
- [x] **ENGAGE-02**: Opportunities scored: relevance × author influence × post velocity × time window remaining
- [x] **ENGAGE-03**: Scores 60+: draft 2-3 reply options using voice profile's reply_style; 70+: push notify; 60-69: digest
- [x] **ENGAGE-04**: User can run `/psn:engage` for proactive 15-minute engagement sessions
- [x] **ENGAGE-05**: Human approves every reply — never auto-post
- [x] **ENGAGE-06**: Daily caps, cooldowns, and blocklists per platform enforced
- [x] **ENGAGE-07**: After engagement session, Claude bridges to content creation ("Any of these conversations spark a post idea?")

### Notifications

- [x] **NOTIF-01**: WhatsApp notifications via WAHA (self-hosted) with Twilio as configurable fallback
- [x] **NOTIF-02**: Tier 1 push notifications: trending topics (70+), engagement opportunities, content going viral, timely ideas expiring, approvals needed
- [x] **NOTIF-03**: Tier 2 morning digest at configurable time with adaptive content based on user journey stage
- [x] **NOTIF-04**: Tier 3 standard notifications: post scheduled/published, approval results, weekly digest, token expiring
- [x] **NOTIF-05**: WhatsApp structured commands: R1/R2/R3 (reply selection), skip, approve, reject, edit, post, time, list, help
- [x] **NOTIF-06**: Conversation state machine tracks active notification context per user in `whatsapp_sessions` table
- [x] **NOTIF-07**: Notification fatigue prevention: hard caps (3 push/day), cooldowns (2hr), dedup, feedback loop, quiet hours
- [x] **NOTIF-08**: Company-level notification routing based on team member expertise

### Company Coordination

- [x] **TEAM-01**: Admin can create a Company Hub via `/psn:setup hub` (separate Neon DB + Trigger.dev project)
- [x] **TEAM-02**: Admin can generate one-time invite codes (7-day expiry) for team members
- [x] **TEAM-03**: Team member can join a Company Hub via `/psn:setup join` with invite code
- [x] **TEAM-04**: Postgres RLS enforces per-user data isolation in Company Hub
- [x] **TEAM-05**: Company posts follow approval workflow: submit → notify approvers → approve/reject → schedule/cancel
- [x] **TEAM-06**: `/psn:approve` shows pending posts with calendar context and related ideas
- [x] **TEAM-07**: Team member leaving = delete connection file; personal data unaffected
- [x] **TEAM-08**: `/psn:calendar` merges Personal Hub + all connected Company Hubs into unified view
- [x] **TEAM-09**: Calendar slot claiming with Company Hub conflict checking

### Platform Support

- [x] **PLAT-01**: X posting: text posts, threads (3-7 tweets), images, scheduling via Trigger.dev delayed runs
- [x] **PLAT-02**: LinkedIn posting: text posts, carousels (PDF), images, scheduling
- [x] **PLAT-03**: Instagram posting: feed images, carousels (up to 10), Reels, scheduling
- [x] **PLAT-04**: TikTok posting: video, photos, scheduling
- [x] **PLAT-05**: Each platform has its own typed API client with rate limit awareness
- [x] **PLAT-06**: Platform-specific content adaptation (thread structure for X, carousel for LinkedIn, reel script for IG)
- [x] **PLAT-07**: Multi-platform posting with partial failure isolation (one platform failure doesn't block others)

### Configuration & Setup

- [x] **CONFIG-01**: `/psn:setup` walks through full onboarding: Hub creation, OAuth, API keys, voice profiling, preferences
- [x] **CONFIG-02**: Strategy.yaml auto-generated from voice interview with content pillars, platform config, posting frequency
- [x] **CONFIG-03**: `/psn:config` allows manual overrides for notifications, engagement, language, frequency, pillars, voice tweaks
- [x] **CONFIG-04**: BYOK model: user provides all API keys (platform APIs, image gen, intelligence, Trigger.dev, Neon)
- [x] **CONFIG-05**: `/psn:setup join` connects to Company Hub; `/psn:setup hub` creates Company Hub
- [x] **CONFIG-06**: `/psn:setup disconnect` cleanly removes a Company Hub connection
- [x] **CONFIG-07**: Database migrations run automatically during setup via Drizzle Kit

### Content Management

- [x] **CONTENT-01**: Drafts stored in `content/drafts/` with auto-pruning 14 days after publishing
- [x] **CONTENT-02**: Generated media stored in `content/media/` with auto-pruning 7 days after posting
- [x] **CONTENT-03**: Content remixing: system suggests re-angling high-performing content for different platforms
- [x] **CONTENT-04**: Content recycling: system surfaces past top performers with fresh angles during `/psn:plan`
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
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| INFRA-06 | Phase 1 | Complete |
| INFRA-07 | Phase 1 | Complete |
| CONFIG-01 | Phase 1 | Complete |
| CONFIG-04 | Phase 1 | Complete |
| CONFIG-07 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 9 | Complete |
| AUTH-08 | Phase 2 | Complete |
| PLAT-01 | Phase 2 | Complete |
| PLAT-05 | Phase 2 | Complete |
| SCHED-01 | Phase 2 | Complete |
| SCHED-02 | Phase 2 | Complete |
| SCHED-03 | Phase 2 | Complete |
| SCHED-04 | Phase 2 | Complete |
| SCHED-05 | Phase 2 | Complete |
| CONTENT-05 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Complete |
| VOICE-02 | Phase 3 | Complete |
| VOICE-03 | Phase 3 | Complete |
| VOICE-04 | Phase 3 | Complete |
| VOICE-05 | Phase 3 | Complete |
| VOICE-06 | Phase 3 | Complete |
| VOICE-07 | Phase 3 | Complete |
| VOICE-08 | Phase 3 | Complete |
| VOICE-09 | Phase 3 | Complete |
| VOICE-10 | Phase 3 | Complete |
| POST-01 | Phase 3 | Complete |
| POST-05 | Phase 3 | Complete |
| POST-06 | Phase 3 | Complete |
| POST-09 | Phase 3 | Complete |
| POST-10 | Phase 3 | Complete |
| POST-11 | Phase 9 | Complete |
| POST-12 | Phase 3 | Complete |
| POST-14 | Phase 3 | Complete |
| IMG-01 | Phase 3 | Complete |
| IMG-02 | Phase 3 | Complete |
| IMG-03 | Phase 3 | Complete |
| IMG-04 | Phase 3 | Complete |
| IMG-05 | Phase 3 | Complete |
| VID-01 | Phase 3 | Complete |
| VID-02 | Phase 3 | Complete |
| VID-03 | Phase 3 | Complete |
| VID-04 | Phase 3 | Complete |
| VID-05 | Phase 3 | Complete |
| CONTENT-01 | Phase 3 | Complete |
| CONTENT-02 | Phase 3 | Complete |
| CONFIG-02 | Phase 3 | Complete |
| CONFIG-03 | Phase 3 | Complete |
| ANLYT-01 | Phase 4 | Complete |
| ANLYT-05 | Phase 4 | Complete |
| ANLYT-06 | Phase 4 | Complete |
| ANLYT-07 | Phase 4 | Complete |
| ANLYT-08 | Phase 4 | Complete |
| ANLYT-09 | Phase 4 | Complete |
| LEARN-01 | Phase 4 | Complete |
| LEARN-02 | Phase 4 | Complete |
| LEARN-03 | Phase 4 | Complete |
| LEARN-04 | Phase 4 | Complete |
| LEARN-05 | Phase 4 | Complete |
| LEARN-06 | Phase 4 | Complete |
| LEARN-07 | Phase 9 | Complete |
| LEARN-08 | Phase 4 | Complete |
| POST-13 | Phase 4 | Complete |
| SCHED-06 | Phase 4 | Complete |
| INTEL-01 | Phase 5 | Complete |
| INTEL-02 | Phase 5 | Complete |
| INTEL-03 | Phase 5 | Complete |
| INTEL-04 | Phase 5 | Complete |
| INTEL-05 | Phase 5 | Complete |
| INTEL-06 | Phase 5 | Complete |
| IDEA-01 | Phase 5 | Complete |
| IDEA-02 | Phase 5 | Complete |
| IDEA-03 | Phase 5 | Complete |
| IDEA-04 | Phase 5 | Complete |
| IDEA-05 | Phase 5 | Complete |
| IDEA-06 | Phase 5 | Complete |
| IDEA-07 | Phase 5 | Complete |
| IDEA-08 | Phase 5 | Complete |
| PLAN-01 | Phase 5 | Complete |
| PLAN-02 | Phase 5 | Complete |
| PLAN-03 | Phase 5 | Complete |
| PLAN-04 | Phase 5 | Complete |
| PLAN-05 | Phase 5 | Complete |
| PLAN-06 | Phase 5 | Complete |
| PLAN-07 | Phase 5 | Complete |
| PLAN-08 | Phase 5 | Complete |
| PLAN-09 | Phase 5 | Complete |
| PLAN-10 | Phase 5 | Complete |
| SERIES-01 | Phase 5 | Complete |
| SERIES-02 | Phase 5 | Complete |
| SERIES-03 | Phase 5 | Complete |
| SERIES-04 | Phase 5 | Complete |
| SERIES-05 | Phase 5 | Complete |
| SERIES-06 | Phase 5 | Complete |
| POST-07 | Phase 5 | Complete |
| POST-08 | Phase 5 | Complete |
| ANLYT-10 | Phase 5 | Complete |
| CONTENT-03 | Phase 5 | Complete |
| CONTENT-04 | Phase 5 | Complete |
| AUTH-02 | Phase 6 | Complete |
| PLAT-02 | Phase 6 | Complete |
| PLAT-06 | Phase 6 | Complete |
| PLAT-07 | Phase 6 | Complete |
| ANLYT-02 | Phase 6 | Complete |
| POST-02 | Phase 6 | Complete |
| TEAM-01 | Phase 7 | Complete |
| TEAM-02 | Phase 7 | Complete |
| TEAM-03 | Phase 7 | Complete |
| TEAM-04 | Phase 7 | Complete |
| TEAM-05 | Phase 9 | Complete |
| TEAM-06 | Phase 7 | Complete |
| TEAM-07 | Phase 9 | Complete |
| TEAM-08 | Phase 9 | Complete |
| TEAM-09 | Phase 7 | Complete |
| NOTIF-01 | Phase 9 | Complete |
| NOTIF-02 | Phase 9 | Complete |
| NOTIF-03 | Phase 9 | Complete |
| NOTIF-04 | Phase 9 | Complete |
| NOTIF-05 | Phase 9 | Complete |
| NOTIF-06 | Phase 9 | Complete |
| NOTIF-07 | Phase 9 | Complete |
| NOTIF-08 | Phase 9 | Complete |
| LEARN-09 | Phase 7 | Complete |
| SERIES-07 | Phase 7 | Complete |
| CONFIG-05 | Phase 7 | Complete |
| CONFIG-06 | Phase 7 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 8 | Complete |
| PLAT-03 | Phase 8 | Complete |
| PLAT-04 | Phase 8 | Complete |
| ANLYT-03 | Phase 8 | Complete |
| ANLYT-04 | Phase 8 | Complete |
| POST-03 | Phase 8 | Complete |
| POST-04 | Phase 8 | Complete |
| ENGAGE-01 | Phase 8 | Complete |
| ENGAGE-02 | Phase 8 | Complete |
| ENGAGE-03 | Phase 9 | Complete |
| ENGAGE-04 | Phase 8 | Complete |
| ENGAGE-05 | Phase 8 | Complete |
| ENGAGE-06 | Phase 8 | Complete |
| ENGAGE-07 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 148 total
- Mapped to phases: 148
- Unmapped: 0
- Complete: 148/148

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-19 after gap closure phase creation*
