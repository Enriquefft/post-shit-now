# Post Shit Now

## What This Is

A Claude Code-first social media growth system where users interact entirely through slash commands in their terminal. Trigger.dev Cloud handles automation layer (scheduling, posting, analytics collection, intelligence gathering, notifications). No web app, no dashboard — just commands + a thin automation backend. Distributed as a git repo that users clone as their personal "social media workspace."

## Core Value

Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently — one command to generate, review, and schedule a post.

## Current State

### Shipped: v1.3 Real-World Reliability (February 28, 2026)

✅ **Complete** — 6 phases, 12 plans, 23 requirements

Fixed every friction point from a real-user 342-turn trial session: Trigger.dev credential delivery, tweet validation, OAuth callback automation, thread publishing resilience, testing infrastructure, and pre-commit quality gates.

**What shipped:**
- syncEnvVars build extension delivers credentials to Trigger.dev workers at deploy time
- Weighted tweet character counting with Intl.Segmenter (URLs=23, emoji=2, CJK=2)
- X OAuth callback server on 127.0.0.1:18923 with CSRF protection and manual fallback
- Thread checkpoint persistence with resume-from-checkpoint and duplicate detection (Jaccard 0.8)
- Vitest test infrastructure with class-boundary mocks for all 4 platform clients
- lefthook pre-commit hooks (biome + typecheck + circular dep detection in parallel)

### Shipped: v1.2 Architecture (February 27, 2026)

✅ **Complete** — 3 phases (21-22.1), 6 plans

Split monolithic publish-post.ts into PlatformPublisher interface + per-platform handlers. Established TypeScript path aliases (@psn/core, @psn/platforms, @psn/trigger/*), barrel exports, and CLAUDE.md documentation.

### Shipped: v1.1 Setup Fixes (February 25, 2026)

✅ **Complete** — 7 phases (1, 15-20), 31 plans

Fixed all 30 issues from trial run: setup wizard bugs, migration reliability, voice interview CLI, UX improvements, provider key configuration, health checks.

### Shipped: v1.0 MVP (February 20, 2026)

✅ **Complete** — 14 phases, 54 plans, 148 requirements

Full platform coverage (X, LinkedIn, Instagram, TikTok), voice profiling, intelligence layer, analytics, engagement, team coordination, notifications.

See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for complete milestone details

<details>
<summary>Validated Requirements</summary>

### Validated (v1.0)

- ✓ All 148 v1.0 requirements complete
- ✓ Complete platform coverage (X, LinkedIn, Instagram, TikTok)
- ✓ Voice profiling with calibration and bilingual support
- ✓ Intelligence layer with trend collection and research
- ✓ Learning loop with autonomous adjustments
- ✓ Team coordination with approval workflows
- ✓ Notification system with WhatsApp integration

### Validated (v1.1)

- ✓ All 30 trial-run issues resolved
- ✓ Setup completes end-to-end without manual workarounds
- ✓ Voice interview completable via CLI
- ✓ Database migrations reliable on Neon
- ✓ Recovery mechanisms functional (reset command)
- ✓ Security: credential masking in error messages

### Validated (v1.2)

- ✓ PlatformPublisher interface with per-platform handlers (<200 lines each)
- ✓ publish-post.ts refactored to orchestration-only (<200 lines)
- ✓ TypeScript path aliases (@psn/core, @psn/platforms, @psn/trigger/*)
- ✓ Barrel exports at all module boundaries
- ✓ CLAUDE.md documentation for AI-assisted development

### Validated (v1.3)

- ✓ Trigger.dev workers receive credentials at deploy time via syncEnvVars — v1.3
- ✓ Tweet validation with accurate weighted character counting — v1.3
- ✓ X OAuth callback server with automatic code capture — v1.3
- ✓ Thread checkpoint persistence with resume-from-checkpoint — v1.3
- ✓ Duplicate tweet detection via Jaccard similarity — v1.3
- ✓ Vitest test infrastructure with class-boundary mocks — v1.3
- ✓ Pre-commit hooks via lefthook (biome, typecheck, circular deps) — v1.3
- ✓ State consolidation process documented (PROJECT.md as single source of truth) — v1.3

</details>

## Context

### Codebase

- **36,878 LOC** TypeScript across 4 milestones
- **Tech stack:** Bun runtime, Neon Postgres (Drizzle ORM), Trigger.dev Cloud, Vitest
- **Quality gates:** lefthook pre-commit hooks (biome, typecheck, circular dep detection)
- **Test infrastructure:** Vitest with class-boundary mocks for all 4 platform API clients

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
| Pre-migration RLS role creation | RLS policies reference roles that must exist. Create role in migration 0000 before schema migration. | ✓ Validated v1.1 |
| Dual-layer API key validation | Fast prefix check for immediate feedback + API call for actual verification. Catch errors early. | ✓ Validated v1.1 |
| Unified hub storage (.hubs/*.json) | Personal Hub and Company Hubs use same storage format and API. Eliminates dual-API confusion. | ✓ Validated v1.1 |
| Extensible VALIDATORS mapping for keys | Add new provider validators to mapping, no routing logic changes. Graceful degradation for unknown providers. | ✓ Validated v1.1 |
| Intl.Segmenter for grapheme clustering | Built-in API for tweet character counting. No external dependencies. Handles emoji/CJK correctly. | ✓ Validated v1.3 |
| Custom tweet-validator.ts over twitter-text | ~60-line custom implementation vs unmaintained npm package. Single source of truth for char counting. | ✓ Validated v1.3 |
| Fixed port 18923 with 127.0.0.1 for OAuth | X rejects "localhost" — must use 127.0.0.1. Fixed port avoids registration changes. Manual fallback if port busy. | ✓ Validated v1.3 |
| lefthook over husky+lint-staged | Go binary, Biome-recommended, simpler config. Parallel hook execution with glob scoping. | ✓ Validated v1.3 |
| syncEnvVars for Trigger.dev credentials | Not deprecated resolveEnvVars. Reads from local hub config files at deploy time. | ✓ Validated v1.3 |
| Jaccard similarity for duplicate detection | 0.8 threshold on word sets over 7-day window. Soft warning only — never blocks publishing. | ✓ Validated v1.3 |
| Mock at class boundary (not HTTP layer) | Simpler, faster tests. Fixtures use real API response shapes for realism. | ✓ Validated v1.3 |
| PROJECT.md as single source of truth | MEMORY.md and CLAUDE.md synced at milestone boundaries via State Consolidation checklist. | ✓ Validated v1.3 |

---
*Last updated: 2026-02-28 after v1.3 completion*
