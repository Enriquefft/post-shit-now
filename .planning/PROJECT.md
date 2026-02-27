# Post Shit Now

## What This Is

A Claude Code-first social media growth system where users interact entirely through slash commands in their terminal. Trigger.dev Cloud handles automation layer (scheduling, posting, analytics collection, intelligence gathering, notifications). No web app, no dashboard — just commands + a thin automation backend. Distributed as a git repo that users clone as their personal "social media workspace."

## Core Value

Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently — one command to generate, review, and schedule a post.

## Current State

### Shipped: v1.0 (February 20, 2026)

✅ **Complete** — 14 phases, 54 plans, 148 requirements

Post Shit Now v1.0 is production-ready with comprehensive feature coverage:

**Platform Support:**
- Full support for X, LinkedIn, Instagram, and TikTok
- OAuth authentication with encrypted token storage
- Platform-specific content adaptation (threads, carousels, Reels, videos)
- Multi-platform posting with partial failure isolation

**Voice & Content:**
- Adaptive voice profiling with content import and calibration
- Entity-scoped profiles for multi-project solo founders
- Bilingual support (English/Spanish) with language-specific voice sections
- Three posting personas (personal, brand-operator, brand-ambassador)
- Academic content support with research archetypes

**Intelligence & Planning:**
- Daily trend collection from HN, Reddit, Product Hunt, RSS, Google Trends
- On-demand research (Perplexity, Exa, Tavily, Brave)
- Idea bank with maturity pipeline (spark → ready → used/killed)
- Content series with automatic slotting and cadence management
- Weekly planning engine with pillar balancing and content recycling

**Analytics & Learning:**
- Multi-platform analytics collection
- Composite engagement scoring (saves > shares > comments > likes)
- Weekly performance review with actionable recommendations
- Autonomous strategy adjustments with transparent changelog
- Content fatigue detection and deprioritization

**Engagement & Notifications:**
- Engagement monitor with opportunity scoring
- Semi-automated reply drafting with human approval
- Three-tier WhatsApp notifications (push, digest, standard)
- Notification fatigue prevention with caps and cooldowns

**Team Coordination:**
- Two-Hub architecture (mandatory Personal Hub, optional Company Hubs)
- Postgres RLS for per-user data isolation
- Approval workflows with notification routing
- Unified calendar with cross-hub slot claiming
- Invite code onboarding for team members

**Infrastructure:**
- BYOK model for all APIs (encrypted storage in DB)
- Trigger.dev Cloud for automation (scheduling, tasks, jobs)
- Neon Postgres with Drizzle ORM and migration infrastructure
- Comprehensive error handling with retry logic and backoff

See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for complete milestone details

## Current Milestone: v1.3 (Real-World Reliability)

**Goal:** Fix every friction point a real user hit during first PSN session — setup, OAuth, publishing, and Trigger.dev integration

**Context:** v1.2 completed architecture cleanup (Phases 21–22.1). Remaining v1.2 phases (Testing, Context Management) carried into v1.3. A real-user trial session (342 turns, 29 hours) exposed 7 product-level issues through log analysis. None are cosmetic — each one either blocks setup, loses data, or makes retries impossible.

**Focus areas:**
- Trigger.dev env var delivery — workers get no credentials without manual `.env` hacking
- X OAuth flow — placeholder callback URL, no callback server, manual code capture
- Thread publishing resilience — partial failures unrecoverable, tweet IDs lost
- Tweet validation — X returns misleading 403 for oversized tweets
- Testing infrastructure — carried from v1.2 (Vitest, mocks, compliance tests)
- Context management — carried from v1.2 (state consolidation, pre-commit hooks)

<details>
<summary>v1.0 Archived Requirements</summary>

### Validated (v1.0)

- ✓ All 148 v1.0 requirements complete
- ✓ Complete platform coverage (X, LinkedIn, Instagram, TikTok)
- ✓ Voice profiling with calibration and bilingual support
- ✓ Intelligence layer with trend collection and research
- ✓ Learning loop with autonomous adjustments
- ✓ Team coordination with approval workflows
- ✓ Notification system with WhatsApp integration

</details>

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
| Claude Code commands, not a web app | Users are Claude Code users. Commands are infinitely flexible. No maintenance burden. | ✓ Validated v1.0 |
| Personal Hub mandatory for all users | Your data is always yours. Leaving company = delete a connection file. | ✓ Validated v1.0 |
| BYOK for all APIs | Each user/company controls own costs and rate limits. No central billing. | ✓ Validated v1.0 |
| Neon Postgres + Drizzle ORM | Full Postgres ecosystem, RLS for isolation, zero vendor lock-in. | ✓ Validated v1.0 |
| Trigger.dev Cloud (not self-hosted) | Free tier for light usage, warm starts, auto-scaling, no infra maintenance. | ✓ Validated v1.0 |
| Semi-automated engagement only | Fully automated replies get accounts banned. Human approves every reply. | ✓ Validated v1.0 |
| Incremental platform rollout | X first (easiest API), then LinkedIn, then IG/TikTok. Matches approval timelines. | ✓ Validated v1.0 |
| Bilingual (en/es) not translation | Each language independently crafted. Voice profiles have language-specific sections. | ✓ Validated v1.0 |
| Invite code flow for team onboarding | No raw credential sharing. One-time use, time-limited codes. | ✓ Validated v1.0 |
| Learning loop mostly autonomous | System is a social media manager, not a consultant. Makes tactical decisions, reports back. | ✓ Validated v1.0 |
| Voice profiles as YAML files (git-stored) | Version-controlled, human-readable, portable. Zod validation on load/save. | ✓ Validated v1.0 |
| fal.ai as unified gateway for media gen | One API for Ideogram, Flux, Kling, Pika. Direct SDK for GPT Image and Runway. | ✓ Validated v1.0 |
| Content-hint keyword scoring for provider selection | Deterministic, no ML needed. Lets Claude pick best tool per content. | ✓ Validated v1.0 |
| Edit distance for calibration convergence | 10 consecutive posts below 15% edit ratio = calibrated. Dual signals (edits + explicit). | ✓ Validated v1.0 |
| Pre-migration RLS role creation | RLS policies reference roles that must exist. Create role in migration 0000 before schema migration. | ✓ Validated Phase 1 |
| Dual-layer API key validation | Fast prefix check for immediate feedback + API call for actual verification. Catch errors early. | ✓ Validated Phase 1 |
| Unified hub storage (.hubs/*.json) | Personal Hub and Company Hubs use same storage format and API. Eliminates dual-API confusion. | ✓ Validated Phase 1 |
| Extensible VALIDATORS mapping for keys | Add new provider validators to mapping, no routing logic changes. Graceful degradation for unknown providers. | ✓ Validated Phase 1 |

---
*Last updated: 2026-02-21 after Phase 1 completion*
