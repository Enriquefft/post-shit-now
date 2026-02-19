# Post Shit Now

## What This Is

A Claude Code-first social media growth system where users interact entirely through slash commands in their terminal. Trigger.dev Cloud handles the automation layer (scheduling, posting, analytics collection, intelligence gathering, notifications). No web app, no dashboard — just commands + a thin automation backend. Distributed as a git repo that users clone as their personal "social media workspace."

## Core Value

Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently — one command to generate, review, and schedule a post.

## Requirements

### Validated

- ✓ Neon Postgres + Drizzle ORM with migration infrastructure — Phase 1
- ✓ BYOK for all APIs — Phase 1
- ✓ Postgres RLS for per-user data isolation — Phase 1
- ✓ X OAuth 2.0 PKCE with encrypted token storage — Phase 2
- ✓ Token auto-refresh with race-condition-safe row-level locking — Phase 2
- ✓ Post scheduling via Trigger.dev delayed runs — Phase 2
- ✓ Thread auto-splitting with boundary respect — Phase 2
- ✓ Voice profiling with adaptive interview and content import — Phase 3
- ✓ Three voice profile types: personal, brand-operator, brand-ambassador — Phase 3
- ✓ Image generation (GPT Image, Ideogram 3, Flux 2) with smart provider selection — Phase 3
- ✓ Video generation (Kling, Runway, Pika) with content-hint scoring — Phase 3
- ✓ Calibration engine with edit tracking and convergence detection — Phase 3
- ✓ Content brain: format picker, topic suggestions, draft management — Phase 3
- ✓ `/psn:post` voice-matched workflow and `/psn:voice` management command — Phase 3
- ✓ X analytics collection with tiered cadence and composite engagement scoring — Phase 4
- ✓ Preference model with weekly updates from engagement + edit + feedback signals — Phase 4
- ✓ Autonomous strategy adjustments (tiered auto/approval) with transparent changelog — Phase 4
- ✓ `/psn:review` weekly review with per-post breakdown, recommendations, fatigue warnings — Phase 4
- ✓ Content fatigue detection and deprioritization in suggestions — Phase 4
- ✓ Semi-automated draft finish flow for video scripts — Phase 4
- ✓ Hub routing (personal/company) in draft metadata — Phase 4

### Active

- [ ] Two-Hub architecture: mandatory Personal Hub (Neon Postgres + Trigger.dev) for every user, optional Company Hubs for teams
- [ ] Intelligence layer: scheduled trend collection (HN, Reddit, PH, RSS, Google Trends) + on-demand research (Perplexity, Exa, Tavily, Brave)
- [ ] Idea bank with maturity pipeline: spark → seed → ready → claimed → developed → used/killed
- [ ] Content series system: recurring formats with cadence, format templates, and performance tracking
- [ ] Engagement engine: semi-automated replies to viral/trending posts with human-in-the-loop approval
- [ ] 4 platform support: X, LinkedIn, Instagram, TikTok (incremental rollout starting with X)
- [ ] Bilingual content creation: English + Spanish, per-post language choice, language-specific voice sections
- [ ] WhatsApp notifications via WAHA (push, digest, standard tiers) with structured command interaction
- [ ] Company coordination: approval workflows, content calendar, invite code onboarding, team idea surfacing
- [ ] Remaining slash commands: `/psn:plan`, `/psn:capture`, `/psn:engage`, `/psn:approve`, `/psn:series`, `/psn:config`, `/psn:calendar`

### Out of Scope

- Web app / dashboard / frontend — CLI-only by design
- Self-hosted Trigger.dev — Cloud-only for simplicity
- Real-time chat features — not core to content creation
- Languages beyond English and Spanish — two is enough for v1
- Offline/degraded mode — managed services have 99.9%+ uptime, not worth the complexity
- Claude-powered WhatsApp chatbot — future upgrade, structured commands first
- Cloud media storage (S3/R2) — future, local git for now

## Context

### Target Users
- **Primary:** Individual team members (30+) who have Claude Code, basic CLI comfort, want to grow personal social media but rarely post
- **Secondary:** Company account managers (3-10/company) who post on behalf of company accounts with coordination needs
- **Tertiary:** Company owners/social media leads who define strategy, review posts, analyze performance

### Data Architecture
- **Local git:** content drafts, media, strategy config, voice profiles, series config, company config
- **Personal Hub DB:** content queue, preference model, idea bank, analytics, published archive, series, trends, OAuth tokens, WhatsApp sessions
- **Company Hub DB:** content queue, analytics, published archive, OAuth tokens, team registry, idea bank, brand preferences, series, trends

### Platform API Landscape
- X: pay-per-use API (Jan 2026), $0.01/post, $0.005/read — easiest access
- LinkedIn: partner approval required (weeks), tokens expire 60 days, NO content discovery API
- Instagram: 200 req/hr rate limit, 30 hashtags/week for search, Business account required
- TikTok: audit required for public posting, EnsembleData (~$100/mo) for real-time monitoring optional

### Three Posting Personas
- **Personal:** your opinions, your voice, unfiltered within comfort zone
- **Brand Operator:** you disappear, the brand speaks, polished and consistent
- **Brand Ambassador:** hybrid — your face + voice with company context

### Content Intelligence
- 12 content archetypes (reaction, story, framework, behind-the-scenes, observation, question, data/research, curation, prediction, celebration, contrarian, tutorial)
- Content remixing: one core idea → 5-10 pieces across platforms/formats
- Content recycling: high-performing past content surfaced with fresh angles
- Competitive intelligence: track competitors to find gaps, not to copy

## Constraints

- **Tech stack:** Neon Postgres (Drizzle ORM) + Trigger.dev Cloud — no alternatives
- **Distribution:** Git repo clone model — no package manager, no installer
- **API access:** LinkedIn partner approval and TikTok audit take weeks — start with X
- **Cost:** Free tiers for light usage; ~$30/mo per Hub for active Trigger.dev usage
- **Platform APIs:** No native scheduling on any platform — all via Trigger.dev delayed runs
- **Media uploads:** Multi-step everywhere (register → upload → attach)
- **Token refresh:** Mandatory for LinkedIn (60 days) and Instagram — `token-refresher` task required
- **Rate limits:** Instagram 200 req/hr is the real bottleneck — batching and backoff essential

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code commands, not a web app | Users are Claude Code users. Commands are infinitely flexible. No maintenance burden. | — Pending |
| Personal Hub mandatory for all users | Your data is always yours. Leaving company = delete a connection file. | — Pending |
| BYOK for all APIs | Each user/company controls own costs and rate limits. No central billing. | ✓ Validated Phase 1-2 |
| Neon Postgres + Drizzle ORM | Full Postgres ecosystem, RLS for isolation, zero vendor lock-in. | ✓ Validated Phase 1 |
| Trigger.dev Cloud (not self-hosted) | Free tier for light usage, warm starts, auto-scaling, no infra maintenance. | ✓ Validated Phase 1-2 |
| Semi-automated engagement only | Fully automated replies get accounts banned. Human approves every reply. | — Pending |
| Incremental platform rollout | X first (easiest API), then LinkedIn, then IG/TikTok. Matches approval timelines. | ✓ X complete |
| Bilingual (en/es) not translation | Each language independently crafted. Voice profiles have language-specific sections. | — Pending |
| Invite code flow for team onboarding | No raw credential sharing. One-time use, time-limited codes. | — Pending |
| Learning loop mostly autonomous | System is a social media manager, not a consultant. Makes tactical decisions, reports back. | — Pending |
| Voice profiles as YAML files (git-stored) | Version-controlled, human-readable, portable. Zod validation on load/save. | ✓ Validated Phase 3 |
| fal.ai as unified gateway for media gen | One API for Ideogram, Flux, Kling, Pika. Direct SDK for GPT Image and Runway. | ✓ Validated Phase 3 |
| Content-hint keyword scoring for provider selection | Deterministic, no ML needed. Lets Claude pick best tool per content. | ✓ Validated Phase 3 |
| Edit distance for calibration convergence | 10 consecutive posts below 15% edit ratio = calibrated. Dual signals (edits + explicit). | ✓ Validated Phase 3 |

---
*Last updated: 2026-02-19 after Phase 3*
