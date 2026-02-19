# Post Shit Now

## What This Is

A Claude Code-first social media growth system where users interact through slash commands in their terminal. Trigger.dev Cloud handles automation (scheduling, posting, analytics, intelligence, notifications). No web app, no dashboard — just commands + a thin automation backend. Distributed as a git repo that users clone as their personal "social media workspace."

## Core Value

Make posting so frictionless that people who rarely post become consistent creators — one command to generate, review, and schedule a post in their authentic voice.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Personal Hub setup (Neon Postgres + Trigger.dev Cloud) via `/psn:setup`
- [ ] Voice profiling system (interview + content import + calibration)
- [ ] Content creation via `/psn:post` (X, LinkedIn, Instagram, TikTok)
- [ ] Weekly planning via `/psn:plan` (ideation + batch generation + scheduling)
- [ ] Quick capture via `/psn:capture` (save or post now)
- [ ] Engagement engine via `/psn:engage` (strategic replies to viral posts)
- [ ] Performance review via `/psn:review` (analytics + strategy adjustments)
- [ ] Company Hub setup with team coordination
- [ ] Approval workflow via `/psn:approve`
- [ ] Content series management via `/psn:series`
- [ ] Idea bank with maturity pipeline (spark → seed → ready → used/killed)
- [ ] Intelligence layer (trend collection, on-demand research, competitor monitoring)
- [ ] Learning loop (engagement signals, edit tracking, preference model)
- [ ] WhatsApp notifications (WAHA/Twilio) with structured command interaction
- [ ] Multi-language support (English + Spanish, per-post choice)
- [ ] Three voice profile types (personal, brand-operator, brand-ambassador)
- [ ] Content calendar with cross-hub coordination
- [ ] Image and video generation integration
- [ ] Employee advocacy features (team analytics, content remixing)
- [ ] OAuth token management with automatic refresh

### Out of Scope

- Web app / dashboard / frontend — CLI-only by design
- Self-hosted Trigger.dev or database — cloud managed services only
- Languages beyond English and Spanish — v1 bilingual only
- Automated posting without human review — human-in-the-loop always
- LinkedIn content discovery API scraping — walled garden, manual only
- Real-time chat features — not core to content creation
- Mobile app — terminal-first

## Context

**Architecture — Two-Hub model:**
- Every user has a mandatory **Personal Hub** (Neon Postgres + Trigger.dev Cloud) for personal data
- Companies have separate **Company Hubs** that team members connect to via invite codes
- Personal data never touches Company Hubs; company data never touches Personal Hubs
- Local git stores: content drafts, voice profiles, strategy config, media
- Hub DB stores: analytics, posts archive, ideas, preference models, series, OAuth tokens, trends

**Platform landscape:**
- X: Pay-per-use API (Jan 2026), $0.01/post, $0.005/read — easiest entry
- LinkedIn: Partner approval required (weeks), tokens expire 60 days, no content discovery API
- Instagram: 200 req/hr rate limit, Business account required
- TikTok: Audit required for public posting, weeks timeline
- No platform offers native scheduling — all via Trigger.dev delayed runs

**Intelligence sources:**
- Layer 1 (scheduled): HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds, competitor accounts
- Layer 2 (on-demand): Perplexity Sonar, Exa, Tavily, Brave Search
- Layer 3 (manual): `/psn:capture` for LinkedIn/TikTok (no public APIs)

**Content philosophy:**
- Three personas per user: Personal, Brand Operator, Brand Ambassador
- Content archetypes balanced (reaction, story, framework, BTS, observation, etc.)
- Content atoms: one idea → multiple platform-specific expressions
- Series are optional but first-class (recurring formats with audience expectation)

**Target users:**
- Primary: Individual team members (30+) who want to grow personal social media
- Secondary: Company account managers (3-10 per company)
- Tertiary: Company owners / social media leads

## Constraints

- **Tech stack**: Claude Code slash commands + Trigger.dev Cloud + Neon Postgres + Drizzle ORM
- **BYOK**: All API keys provided by users — no central billing
- **Platform-aware**: Features scoped to enabled platforms only — disabled platforms cost nothing
- **No offline mode**: Cloud services with 99.9%+ uptime, clear error on failure
- **Security**: Postgres RLS for per-user data isolation, OAuth tokens encrypted in DB, invite codes for team onboarding (no raw credential sharing)
- **Cost**: Free tier viable for light usage ($0/mo), ~$30/mo per hub for active users

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claude Code commands, not a web app | Users are Claude Code users. Commands are infinitely flexible. No maintenance burden. | — Pending |
| Personal Hub mandatory for all users | Your data is always yours. Leaving a company = delete a connection file. | — Pending |
| Neon Postgres + Drizzle ORM | RLS for isolation, standard Postgres (zero vendor lock-in), Drizzle for type-safe queries | — Pending |
| Trigger.dev Cloud (not self-hosted) | Free tier covers light usage, warm starts, auto-scaling, no infra maintenance | — Pending |
| BYOK for all APIs | Each user controls costs and access. No central billing complexity. | — Pending |
| Semi-automated engagement only | Fully automated replies get accounts banned. Human approves every reply. | — Pending |
| WhatsApp for notifications (WAHA/Twilio) | Interactive, not just notification-only. Structured commands for quick action. | — Pending |
| English + Spanish bilingual | Per-post language choice. Voice profiles have language-specific sections. Not translations. | — Pending |
| Phased rollout starting with X | Easiest API access, apply for LinkedIn/TikTok immediately, add when approved | — Pending |
| Learning loop mostly autonomous | System is your social media manager, not consultant. Tactical changes auto, identity changes confirm. | — Pending |

---
*Last updated: 2026-02-18 after initialization*
