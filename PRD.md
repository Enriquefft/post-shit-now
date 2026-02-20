# PRD: Post Shit Now

## Product Overview

**Post Shit Now** is a Claude Code-first social media growth system. Users interact with it through slash commands in their terminal. A Trigger.dev project handles the automation layer (scheduling, posting, analytics collection, intelligence gathering, notifications). There is no web app, no dashboard, no frontend — just commands + a thin automation backend.

The system is distributed as a git repo that users clone. It becomes their personal "social media workspace" containing commands, configuration, content drafts, analytics data, and media assets. Each user brings their own API keys (BYOK).

### Two-Hub Architecture

Every user has a **Personal Hub** — their own lightweight backend for personal data. Companies have separate **Company Hubs** that team members connect to. Both consist of:

1. **Trigger.dev Cloud project** — task scheduling, execution, and delayed run timers for scheduled posts
2. **Neon Postgres database** — persistent storage. Postgres RLS (Row-Level Security) enforces data isolation. Drizzle ORM for the query layer.

**The Personal Hub is mandatory for all users** — analytics, learning loop, idea bank, and personal content queue all depend on it. `/psn:setup` always creates a Personal Hub first (Neon free tier, one command), then optionally connects to Company Hubs.

**Company Hubs** are set up once by a company admin. Team members connect via invite codes during `/psn:setup`. The Company Hub is the single source of truth for all company-level data — no shared git repo needed.

| Scenario | Personal Hub | Company Hub(s) | Connection files |
|---|---|---|---|
| Standalone individual | Own Neon DB + Trigger.dev | None | `hub.env` only |
| Team member at 1 company | Own Neon DB + Trigger.dev | Company's | `hub.env` + `connections/acme.env` |
| Team member at 2+ companies | Own Neon DB + Trigger.dev | Each company's | `hub.env` + `connections/*.env` |
| Admin of company + personal | Own Neon DB + Trigger.dev | Company's (they created it) | `hub.env` + `connections/acme.env` |
| Solo founder, 2 companies | Own Neon DB + Trigger.dev | 1 per company (they own both) | `hub.env` + `connections/*.env` |

Your personal data never touches a company Hub. Leaving a company = delete one connection file. Your analytics, idea bank, preference model, and voice history are untouched.

### Hub Separation

Personal and company data live in separate databases by design. No mixing.

Each Company Hub has:
- Its own OAuth tokens (per platform per brand, stored in `oauth_tokens` DB table)
- Its own content queue, analytics, published archive
- Its own brand preference model
- Its own idea bank (company-scoped)
- Team member registry with roles

Voice profiles remain local: `personal.yaml`, `brand-operator-<company>.yaml`, `brand-ambassador-<company>.yaml`.

`/psn:post` asks "posting as?" → lists personal + all connected company brands. If only personal is configured, it skips the question.

**Agency model:** An agency creates one Company Hub per client. The agency team members each have their own Personal Hub and connect to all client Company Hubs via `connections/*.env`.

### Data Split: Local vs. Personal Hub vs. Company Hub

Data lives in one of three places. Personal data never touches a Company Hub. Company data never touches a Personal Hub.

| Data | Where it lives | Why |
|---|---|---|
| **LOCAL GIT** | | |
| Personal drafts & media | `content/drafts/`, `content/media/` | Your workspace. Auto-pruned: drafts 14 days after publishing, media 7 days after posting. |
| Personal strategy config | `config/strategy.yaml` | Your voice, your rules |
| Personal voice profiles | `config/voice-profiles/` | Your voice, your style, your personas |
| Content series config (personal) | `config/series/` | Series templates and history |
| Company strategy/config | `config/company/<name>.yaml` | Rarely changes, git is fine |
| Hub connection files | `config/hub.env` + `config/connections/` | Credentials for all Hubs (gitignored) |
| **PERSONAL HUB DB** | | |
| Personal content queue | `posts` table (scheduled, pending, published) | Queryable by your Trigger.dev tasks |
| Personal preference model | `preference_models` table | Queryable, survives device changes |
| Personal idea bank | `ideas` table | Queryable, same schema as company ideas |
| Personal analytics history | `analytics` table | Queryable, aggregatable, trend analysis |
| Personal published archive | `posts` table | Avoid repeats, track what worked |
| Personal series (operational) | `series` table | Installment tracking, performance data |
| Personal trend intelligence | `trends` table | Personal-pillar-scored trend snapshots. DB retention: 30 days. |
| Personal OAuth tokens | `oauth_tokens` table (encrypted) | Personal account tokens. `token-refresher` updates at runtime. |
| **COMPANY HUB DB** (1 per company) | | |
| Company content queue | `posts` table (scheduled, pending-approval, approved, published) | All team members see it. Trigger.dev delayed runs reference post IDs as timers. |
| Company analytics history | `analytics` table | Queryable, aggregatable |
| Company published archive | `posts` table | Avoid repeats, track what worked |
| Company OAuth tokens | `oauth_tokens` table (encrypted) | Tasks read tokens from DB before API calls. `token-refresher` updates them at runtime. |
| Team member registry | `team_members` table | Who can post, who can approve |
| Company idea bank | `ideas` table | All team members contribute and consume |
| Company brand preference model | `brand_preferences` table | Shared brand learnings across team |
| Company series (shared) | `series` table | Coordinated recurring content |
| Company trend intelligence | `trends` table | Company-scoped trend snapshots + competitor monitoring |

### Why This Architecture

| Decision | Rationale |
|---|---|
| Claude Code commands, not an app | Users are Claude Code users. Commands are infinitely flexible for a domain where strategy is still being figured out. No maintenance burden. |
| Personal Hub (always exists) | Your data is always yours. Leaving a company = delete a connection file. No migration, no data loss, no asking an admin to export your history. |
| Company Hub (separate, per company) | Fills the gaps commands can't: scheduled posting, shared state across team members, company analytics, company intelligence gathering, notifications. Personal data never touches it. |
| Local git for personal data | Content drafts, strategy, voice profiles, media — only you need it. Version-controlled, no sync issues. |
| BYOK (Bring Your Own Keys) | Each user/company controls their own costs, API access, and rate limits. No central billing complexity. |
| Platform-aware by default | Every feature (posting, monitoring, analytics, engagement, notifications) is scoped to platforms enabled in `strategy.yaml`. Disabled platforms cost nothing — no API calls, no tasks, no noise. A user on X-only gets an X-only experience. A brand on LinkedIn + Instagram gets exactly that. |
| No offline/degraded mode | Neon and Trigger.dev are managed services with 99.9%+ uptime. If the Hub is unreachable, commands show a clear error and ask the user to retry. No local fallback or sync layer — not worth the complexity for a rare edge case. |
| Local file pruning | Git repos grow indefinitely. Auto-prune: published drafts after 14 days, generated media after posting + 7 days. Trend data: 30-day DB retention policy (both hubs). Future phase: move media to cloud storage (S3/R2). |
| Database migrations | Drizzle Kit generates migration files, bundled with repo updates. `/psn:setup` runs pending migrations on all connected hubs automatically. No manual SQL needed. |

---

## Target Users

### Primary: Individual team members (30+)
- Have Claude Code installed
- Basic CLI comfort
- Want to grow their personal social media but rarely post
- Need low-friction workflows: one command to generate, review, and schedule a post

### Secondary: Company account managers (3-10 per company)
- Post on behalf of the company account
- Need coordination (content calendar, approval workflows)
- May also post to their personal accounts

### Tertiary: Company owners / social media leads
- Define content strategy and brand voice
- Review and approve company posts
- Analyze what's working across all accounts

---

## Platforms

All four platforms supported, rolled out incrementally — starting with X (easiest API access), then LinkedIn, then Instagram and TikTok:

| Platform | Auth Flow | Post as User | Post as Company | Media | Key Barrier |
|---|---|---|---|---|---|
| **X (Twitter)** | OAuth 2.0 PKCE | Yes | N/A (no pages) | Images, video | Pay-per-use API (Jan 2026): $0.01/post, $0.005/read. Full analytics including impressions. ~$2-5/mo for typical usage. |
| **LinkedIn** | OAuth 2.0 (3-legged) | Yes (`w_member_social`) | Yes (`w_organization_social`) | Images, video, PDFs/carousels | Partner approval required (weeks). Token expires every 60 days. |
| **Instagram** | OAuth 2.0 via Facebook | Yes (Business/Creator only) | Via linked Facebook Page | Images, carousels (up to 10), Reels, Stories | Must be Business/Creator account linked to FB Page. Rate limit cut to 200 req/hr in 2025. |
| **TikTok** | OAuth 2.0 | Yes | N/A | Video, photos | Audit required for public posting. Unaudited = 5 users, private-only. Takes weeks. |

### Critical API Constraints
- **No platform offers native scheduling.** All scheduling must be implemented application-side (Trigger.dev).
- **Media upload is multi-step everywhere.** Register upload → upload binary → attach to post.
- **Token refresh is mandatory.** LinkedIn and Instagram tokens expire (60 days). Build automatic refresh into Trigger.dev tasks.
- **Rate limits are the real constraint.** Instagram's 200 req/hr (down from 5,000) means batching and backoff are essential.

### Multi-Language Support (English + Spanish)

The system supports bilingual content creation (English and Spanish). Language is a flexible, per-post choice — not a rigid per-platform rule.

**How language works across the system:**

| Component | How it handles language |
|---|---|
| **Voice profiles** | Language-agnostic base traits (formality, humor, assertiveness) + language-specific sections (vocabulary, sentence patterns, opening/closing patterns, signature phrases). Your voice in Spanish is not a translation of your English voice. |
| **Each post** | Tagged `en`, `es`, or `both`. User chooses at creation time. Default comes from platform config. |
| **`both` (bilingual posts)** | Both language versions in one post. Each section independently crafted, not translated. Format varies by platform norms. |
| **Idea bank** | Ideas have a `suggested_language` field (nullable — `null` means language-agnostic). |
| **Content series** | Each series has a fixed language. A bilingual creator might run "Monday Myths" in English and "Mitos del Lunes" in Spanish as separate series. |
| **Preference model** | Tracks performance per language. The learning loop knows which hooks, formats, and topics work better in each language. |
| **`/psn:plan`** | Suggests language per slot based on platform config and recent language mix. User can override any. |
| **Onboarding** | Voice interview covers both languages — Claude switches languages mid-conversation to capture voice in each. |
| **Analytics** | Engagement tracked per language. Weekly reports show language-level performance. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  USER'S MACHINE (Claude Code)                           │
│                                                         │
│  post-shit-now/                                         │
│  ├── .claude/                                           │
│  │   ├── commands/          # Slash commands             │
│  │   │   └── psn/            # All commands namespaced    │
│  │   │       │               #   as /psn:<command>       │
│  │   │       ├── post.md     # Create + schedule content │
│  │   │       ├── plan.md     # Weekly ideation + batch   │
│  │   │       ├── capture.md  # Quick-capture: save/post  │
│  │   │       ├── engage.md   # Reply to viral posts      │
│  │   │       ├── review.md   # Performance + strategy    │
│  │   │       ├── approve.md  # Review pending co. posts  │
│  │   │       ├── series.md   # Manage content series     │
│  │   │       ├── config.md   # Adjust preferences        │
│  │   │       ├── setup.md    # Initial setup (one-time)  │
│  │   │       └── calendar.md # Optional: view queue      │
│  │   └── settings.json                                  │
│  ├── config/                                            │
│  │   ├── keys.env           # API keys (gitignored)     │
│  │   ├── hub.env            # Personal Hub: DB URL +     │
│  │   │                      #   Trigger.dev key          │
│  │   ├── connections/       # Company Hub connections    │
│  │   │   ├── acme-corp.env  #   (gitignored)            │
│  │   │   └── other-co.env   #   1 file per company      │
│  │   ├── strategy.yaml      # Content pillars, posting  │
│  │   │                      #   frequency, goals        │
│  │   ├── voice-profiles/    # Voice profiles per persona│
│  │   │   ├── personal.yaml  # Your authentic voice      │
│  │   │   ├── brand-operator-acme.yaml  # Company voice  │
│  │   │   └── brand-ambassador-acme.yaml # You + company │
│  │   ├── series/            # Content series definitions │
│  │   │   └── <series-name>.yaml                         │
│  │   └── company/                                       │
│  │       └── <company>.yaml # Company-specific config   │
│  ├── content/                                           │
│  │   ├── drafts/            # Work in progress          │
│  │   ├── media/             # Images, videos, assets    │
│  │   └── intelligence/      # The Creative Brain        │
│  │       └── competitive-intel.yaml # Competitor data   │
│  ├── analytics/                                         │
│  │   └── reports/           # Generated analysis (MD)   │
│  ├── CLAUDE.md              # Project instructions for  │
│  │                          #   Claude                  │
│  └── trigger/               # Trigger.dev task defs     │
│      ├── post-scheduler.ts                              │
│      ├── analytics-collector.ts                         │
│      ├── trend-collector.ts                             │
│      ├── trend-alerter.ts                               │
│      ├── engagement-monitor.ts                          │
│      ├── token-refresher.ts                             │
│      ├── notifier.ts                                    │
│      └── whatsapp-handler.ts                            │
│                                                         │
└──────┬──────────────────────────────┬───────────────────┘
       │                              │
       │ Personal tasks               │ Company tasks
       │ (Trigger.dev SDK / MCP)      │ (Trigger.dev SDK / MCP)
       │                              │
┌──────▼──────────────────────┐ ┌─────▼───────────────────────┐
│  PERSONAL HUB (1 per user)  │ │  COMPANY HUB (0..N)         │
│                              │ │  (1 per company connected)  │
│  ┌─ Trigger.dev (Cloud) ──┐ │ │                             │
│  │  Scheduled Tasks:       │ │ │  ┌─ Trigger.dev (Cloud) ──┐│
│  │  ├── Post personal      │ │ │  │  Scheduled Tasks:      ││
│  │  │   content → APIs     │ │ │  │  ├── Post company      ││
│  │  ├── Collect personal   │ │ │  │  │   content → APIs    ││
│  │  │   analytics (cron)   │ │ │  │  ├── Collect company   ││
│  │  ├── Collect trends     │ │ │  │  │   analytics (cron)  ││
│  │  │   (cron + polls)     │ │ │  │  ├── Company calendar  ││
│  │  ├── Alert on trends    │ │ │  │  │   coordination      ││
│  │  ├── Monitor engagement │ │ │  │  ├── Refresh company   ││
│  │  ├── Refresh personal   │ │ │  │  │   OAuth tokens      ││
│  │  │   OAuth tokens       │ │ │  │  ├── Collect trends    ││
│  │  ├── Send notifications │ │ │  │  │   (cron + polls)    ││
│  │  └── WhatsApp handler   │ │ │  │  └── Send notifications││
│  │                         │ │ │  │                        ││
│  │  Content Queue:         │ │ │  │  Content Queue:        ││
│  │  └── posts table +      │ │ │  │  └── posts table +     ││
│  │      delayed run timers │ │ │  │      delayed run timers││
│  │                         │ │ │  │                        ││
│  │  Env Vars:              │ │ │  │  Env Vars:             ││
│  │  └── DB URL,            │ │ │  │  └── DB URL,           ││
│  │      Trigger.dev keys   │ │ │  │      Trigger.dev keys  ││
│  └─────────────────────────┘ │ │  └────────────────────────┘│
│                              │ │                             │
│  ┌─ Neon Postgres (RLS) ──┐ │ │  ┌─ Neon Postgres (RLS) ──┐│
│  │  Tables:                │ │ │  │  Tables:               ││
│  │  ├── analytics          │ │ │  │  ├── analytics         ││
│  │  ├── posts              │ │ │  │  ├── posts             ││
│  │  ├── ideas              │ │ │  │  ├── team_members      ││
│  │  ├── preference_models  │ │ │  │  ├── ideas             ││
│  │  ├── series             │ │ │  │  ├── brand_preferences ││
│  │  ├── oauth_tokens       │ │ │  │  ├── series            ││
│  │  ├── trends             │ │ │  │  ├── oauth_tokens      ││
│  │  └── whatsapp_sessions  │ │ │  │  └── trends            ││
│  └─────────────────────────┘ │ │  └────────────────────────┘│
│                              │ │                             │
│                              │ │  (Repeat for each company) │
└──────────────────────────────┘ └─────────────────────────────┘
```

### Why Cloud Services (not self-hosted)

Both Personal and Company Hubs use two managed services with generous free tiers:

**Trigger.dev Cloud:**

| Factor | Cloud | Self-hosted |
|---|---|---|
| Setup | Create account + `npx trigger.dev@latest init` | Docker: 3+ vCPU, 6+ GB RAM (webapp) + 4+ vCPU, 8+ GB RAM (worker) |
| Maintenance | Managed | You handle updates, security, scaling |
| Cost | Free tier for light usage; ~$30/mo per hub for active users | Server costs ($40-80/mo minimum) |
| Features | Warm starts, auto-scaling, checkpoints | No warm starts, no auto-scaling, no checkpoints |

The free tier (10 schedules, 20 concurrent runs) covers light usage (1-2 platforms, a few posts/week). Active users posting across multiple platforms will need the Hobby or Pro tier (~$30/mo per hub).

**Neon Postgres:**

| Factor | Details |
|---|---|
| Setup | `neonctl databases create post-shit-now` (one command) |
| Free tier | 512 MB storage, 100 compute hours/mo |
| Access | Standard Postgres connection string |
| ORM | Drizzle ORM (postgres dialect) |
| Security | Row-Level Security (RLS) for per-user data isolation |
| Ecosystem | Full Postgres — extensions, tooling, familiar to most devs |
| Cost | Free for most teams. $19/mo for Scale if needed. |

Cost per Hub: **$0/month for light usage** on free tiers. Active users should expect ~$30/mo per hub for Trigger.dev Hobby/Pro. Neon can be replaced with any Postgres provider (Supabase, Railway, self-hosted) — Drizzle ORM + standard Postgres means zero vendor lock-in.

---

## The Creative Brain (Ideation & Intelligence System)

The ideation system is the engine that makes everything else work. Without great ideas, perfect scheduling and analytics are worthless. The system has three layers: an intelligence layer that gathers signals, an idea pipeline that matures raw signals into actionable content briefs, and a learning loop that makes everything smarter over time.

### The Posting Persona Problem

The same person produces radically different content depending on which hat they're wearing. The ideation engine must know the active persona before generating ideas, because it changes everything downstream.

**Persona A: You, personal account**
- Your opinions, your voice, your face
- Hot takes, personal stories, failures, lessons
- Can be controversial, funny, vulnerable
- Goal: build personal brand, thought leadership

**Persona B: You, on the company account, as the company voice (Brand Operator)**
- You disappear — the brand speaks
- Product updates, case studies, industry insights
- Polished, consistent, on-brand, can't be too personal
- Goal: company authority, lead generation

**Persona C: You, on the company account, as a face of the company (Brand Ambassador)**
- The hybrid — your face, your voice, but company context
- "I just shipped this feature and here's why it matters"
- Personal authenticity + company relevance
- Goal: humanize the brand, employee advocacy

Each persona has different acceptable topics, tone boundaries, risk tolerance, content formats, and audiences. Content about others (customer stories, team spotlights) is a topic choice under the active persona — not a separate persona. The ideation engine asks which persona is active first, and it changes everything downstream.

### Intelligence Layer (Research Brain)

Ideas don't come from nowhere. The system runs ongoing intelligence gathering across two layers:

#### Layer 1: Scheduled Collection (Trigger.dev `trend-collector` task)

Daily background jobs that build a trend database over time. This is the brain's passive memory.

| Source | API | Cost | What it captures |
|---|---|---|---|
| **Hacker News** | Algolia HN Search API | Free, no auth | Top stories >50 points in user's industry |
| **Reddit** | Official API (free tier, 100 req/min) | Free | Top posts from 5-10 relevant subreddits |
| **Product Hunt** | GraphQL API | Free | Daily top launches, new tools |
| **Google Trends** | RSS feed (`trends.google.com/trending/rss`) | Free | Daily trending searches by country |
| **RSS feeds** | Feedparser + curated OPML file | Free | 50-100 industry blogs, publications |
| **Newsletters** | Kill the Newsletter (email→RSS conversion) | Free | Industry newsletters as RSS items |
| **Instagram competitors** | Official Business Discovery API | Free | Competitor posts + engagement metrics |
| **X competitors** | TwitterAPI.io (third-party) | ~$5-20/mo | Competitor tweets, engagement data |
| **Your own analytics** | Platform APIs | Already paying | What's working, what's not |

Runs at 6-7 AM daily. Results scored by relevance to user's content pillars and stored in Hub DB `trends` table. A lighter poll runs every 2-4 hours during business hours for breaking news detection (HN front page + X trending only).

#### Layer 2: On-Demand Research (at `/psn:plan` time)

When a user runs `/psn:plan`, the system fires real-time searches:

| Tool | Cost | Purpose |
|---|---|---|
| **Perplexity API (Sonar)** | ~$1-5/mo | "What's trending in [industry] right now?" — synthesized, cited answers |
| **Exa API** | Free (1K/mo) | Semantic search: "find content similar to my best post." Unique findSimilar capability. |
| **Tavily API** | Free (1K/mo) | Agent-friendly search, filtered by recency. News in last 48h. |
| **Brave Search API** | Free (2K/mo) | Breaking news, budget fallback. |

Perplexity is the Swiss Army knife — instead of building and maintaining scrapers for every edge case, fire a Perplexity query. Cheaper, more reliable, always current.

#### Layer 3: Manual Input (for locked-down platforms)

LinkedIn has no public content API — third-party scrapers like Proxycurl face legal risk and are unreliable. TikTok's Research API is academic-only. For these platforms:

- `/psn:capture` command to paste a URL, screenshot, or text observation into the idea bank
- Manual observation + capture is more reliable than brittle scrapers
- TikTok's own algorithm is honestly better at surfacing niche trends than any API

#### Intelligence Cost Estimates

| Level | Monthly cost | Coverage |
|---|---|---|
| **Free tier** | $0 | HN, Reddit, PH, Google Trends RSS, RSS feeds, newsletters, Exa, Tavily, Brave, IG hashtag search (official API) |
| **Basic** | ~$12-30/mo | Add Perplexity Sonar + TwitterAPI.io for X competitor monitoring + X pay-per-use API (~$2-5 for posting + analytics + engagement search) |
| **Full** | ~$110-175/mo | Add SerpApi for Google Trends + more Perplexity usage + EnsembleData for TikTok real-time monitoring (~$100/mo) |

**Engagement monitoring cost breakdown (included above):** See [`engagement-monitor` task](#engagement-monitor) for per-platform API details. Summary: X ~$2-5/mo (Basic tier), Instagram free, TikTok ~$100/mo optional (Full tier), LinkedIn manual only.

### Competitive Intelligence

The brain tracks competitors and peers to find gaps, not to copy:

```yaml
# content/intelligence/competitive-intel.yaml

monitored_accounts:
  - handle: "@competitor_a"
    platform: x
    their_strengths: "great hooks, consistent thread format"
    their_weaknesses: "too promotional, no personal stories"
    gaps_we_can_fill: "they never talk about [specific subtopic]"
    content_to_react_to: []  # populated by trend-collector

  - handle: "competitor-b"
    platform: linkedin
    their_strengths: "excellent carousels, strong data"
    their_weaknesses: "no personality, reads like a brand"
    gaps_we_can_fill: "humanize the same topics with personal experience"

industry_content_patterns:
  oversaturated_topics: []
  underserved_topics: []
  rising_formats: []
```

### Content Archetypes

Beyond pillars, every post fits an archetype that determines its structure. The ideation engine should balance these, not just pillars:

| Archetype | Example | Best Persona |
|---|---|---|
| **Reaction** | "Everyone's saying X. Here's why they're wrong." | Personal |
| **Story** | "Last year I failed at X. Here's what I learned." | Personal / Ambassador |
| **Framework** | "The 3-step process I use for X" | Any |
| **Behind-the-scenes** | "Here's how we actually built X" | Ambassador |
| **Observation** | "I noticed that every successful X does Y" | Personal |
| **Question** | "What's your biggest challenge with X?" | Any |
| **Data/Research** | "We analyzed 1,000 X and found Y" | Brand Operator |
| **Curation** | "5 tools/resources/ideas I found this week" | Personal |
| **Prediction** | "Here's what I think happens next with X" | Personal |
| **Celebration** | "We just hit X milestone. Here's the real story." | Any |
| **Contrarian** | "Unpopular opinion: X is overrated because Y" | Personal |
| **Tutorial** | "Step-by-step: how to do X" | Any |

A week of all frameworks is boring. A week of all hot takes is exhausting. The system balances archetypes alongside pillars.

### Content Remixing

A single strong idea should become 5-10 pieces of content across platforms and formats:

```
Core idea: "Most companies measure the wrong social media metrics"

→ X thread: "Stop tracking followers. Here's what actually matters (thread)"
→ LinkedIn carousel: "7 Metrics That Actually Predict Growth (with data)"
→ Instagram reel: 60s talking head explaining the #1 mistake
→ TikTok: Quick "POV: your boss asks about follower count" humor
→ X poll: "Which metric matters most?"
→ LinkedIn text: personal story about when you realized followers don't matter
→ Follow-up thread a week later responding to comments from the first
```

The ideation system thinks in **content atoms** — one core idea expressed differently per platform, persona, and format. This is how prolific creators seem to post constantly without burning out.

### Content Recycling

High-performing past content is a goldmine. The system proactively surfaces recycling opportunities during `/psn:plan` (both ideation and batch generation phases):

- **Re-angle for a different platform**: A LinkedIn carousel that crushed → X thread version
- **Update with new data**: "6 months ago I said X. Here's what actually happened."
- **Reframe for a different persona**: Personal hot take → company case study version
- **Seasonal replay**: Content that performed well at the same time last year
- **Follow-up content**: "My post about X got 200 comments. Here are the best takes."
- **Evergreen refresh**: Top-performing tutorials/frameworks re-shared with minor updates

The system uses the published archive (Hub DB `posts` table) + preference model to identify candidates. The content fatigue tracker prevents recycling too-recent content. Recycling suggestions are woven into `/psn:plan` alongside fresh ideas — not a separate workflow. The user always chooses whether to reuse, and the recycled version always gets a fresh angle (never a verbatim repost).

---

## Idea Bank & Pipeline

### Idea Maturity Stages

Ideas aren't binary. They go through stages of development, and each stage has different treatment:

```
Spark → Seed → Ready → Claimed → Developed → Used
                ↘ Killed    ↘ Abandoned (→ back to Ready)
```

**Spark** — a raw signal, barely an idea. A URL, a screenshot, a sentence. No thesis, no angle. Examples: "Competitor just launched feature X", "Saw a great thread about Y."

**Seed** — has a thesis but isn't actionable yet. You know what you want to say but haven't figured out how or for whom. Example: "Our Rust migration saved 40% on infra — the 'Rust is hard' narrative is overblown."

**Ready** — a complete content brief. Has thesis, suggested platform(s), format, persona, hook, key points, and relevance context. Someone could pick this up and turn it into a post with minimal thinking.

**Claimed** — a team member is developing it into an actual post. Locked to prevent duplicate work.

**Developed** — turned into a post draft (sitting in content queue or pending approval). Links back to the original idea.

**Used** — published. Archived. Engagement data feeds back into the preference model.

**Killed** — rejected. The reason is recorded and feeds back into the preference model (learns what NOT to suggest).

### Where Ideas Live

| Idea type | Where | Why |
|---|---|---|
| For your personal account | Personal Hub DB (`ideas` table) | Your data, your database |
| For the company brand | Company Hub DB (`ideas` table) | Any team member could develop it |
| Started personal, promoted to company | Copy from Personal Hub → Company Hub, mark original as `developed` | Cross-Hub transfer, original preserved |
| "Could go either way" | Personal Hub DB | Default to personal. Promote by copying to Company Hub when ready. |

### Idea Surfacing (How Team Ideas Flow Naturally)

Company ideas surface **contextually** — they appear only when the user is at a step where they're relevant. No separate feed, no "check the idea board" workflow.

**During `/psn:plan` (targeting company):** Company ideas from the Hub are mixed into suggestions alongside freshly generated ideas, attributed to their creator: *(suggested by Alice 3 days ago)*. During batch generation, series installments are slotted first, then `ready` ideas from the bank fill gaps, then new ideas are generated for remaining slots. Calendar gaps show matching ready ideas as suggestions.

**During `/psn:post` (targeting company):** Before asking for a topic, Claude checks for `ready` ideas matching the target platform + persona. "You have 3 ready ideas for LinkedIn. Pick one, or start fresh?"

**During `/psn:approve`:** Related ideas in the bank are shown as context to prevent duplicate topic development.

### Idea Claiming

When someone develops a team idea, it's claimed (status: `ready` → `claimed`, `claimed_by` set). Others see: "Alice is working on this." If they abandon it, status returns to `ready`.

### Timely Ideas

Ideas have an urgency classification:

| Urgency | Time to develop | Time to use or kill |
|---|---|---|
| **Timely** (trending topic, news reaction) | Same session | 24-48 hours before expiry |
| **Seasonal** (conference, product launch, event) | Days | Tied to event date |
| **Evergreen** (framework, story, tutorial) | Weeks, no rush | No expiry |

Timely ideas that expire without being claimed are auto-killed. The system flags timely sparks: "This is time-sensitive. Develop it now or it'll lose relevance."

### Idea Schema (same schema in both Personal Hub and Company Hub DBs)

The `ideas` table exists in both databases with the same schema. In the Personal Hub, all ideas are personal. In a Company Hub, all ideas are company-scoped. No `scope` column needed — the database itself is the scope boundary.

```sql
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Maturity
  stage TEXT NOT NULL DEFAULT 'spark',  -- spark|seed|ready|claimed|developed|used|killed
  stage_history JSONB,  -- timestamps of each transition
  killed_reason TEXT,

  -- Ownership
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,

  -- Timing
  urgency TEXT DEFAULT 'evergreen',  -- timely|seasonal|evergreen
  expires_at TIMESTAMPTZ,
  relevant_event TEXT,

  -- Content (grows with maturity)
  title TEXT NOT NULL,
  reference_url TEXT,
  context TEXT,
  thesis TEXT,
  suggested_platforms JSONB,  -- e.g. ["x", "linkedin"]
  suggested_format TEXT,
  suggested_persona TEXT,  -- personal|brand_operator|brand_ambassador
  suggested_language TEXT,  -- en|es|both|null (null = any)
  hook TEXT,
  key_points JSONB,  -- e.g. ["point 1", "point 2"]
  pillar TEXT,
  tags JSONB,  -- e.g. ["ai", "startups"]

  -- Lineage
  resulting_post_id TEXT,
  parent_idea_id TEXT
);
```

---

## Voice Profile & Onboarding

The voice profile is the foundation everything else builds on. If it's wrong, every post feels off, the user edits everything, and they stop using it.

### What Voice Really Means

Most tools ask "Professional or casual?" — that's useless. Real voice is a hundred small decisions: contractions, swearing, emojis, analogies, sentence length, how you open and close posts, what words you'd never use, how you handle humor and vulnerability. The voice profile captures all of this.

### Three Profiles Per User

Every user has up to three voice profile *types* stored in `config/voice-profiles/` — one personal, plus one brand-operator and one brand-ambassador per connected company:

**`personal.yaml`** — how you write as yourself. Unfiltered within your comfort zone. Your opinions, your voice, your personality.

**`brand-operator-<company>.yaml`** — how you write as the company. You disappear. The brand speaks. Constrained by brand guidelines, more formal, consistent. Multiple people must write interchangeably in this voice.

**`brand-ambassador-<company>.yaml`** — the hybrid. Your face, your voice, company context. Inherits from your personal voice with company guardrails. "I just shipped..." not "We are pleased to announce..."

### Voice Profile Structure

Voice profiles are **language-aware**. The base `voice` section defines language-agnostic traits (formality level, humor frequency, assertiveness). The `languages` section holds language-specific overrides — vocabulary, sentence patterns, opening/closing patterns, and signature phrases that differ between English and Spanish. You're not the same writer in both languages.

```yaml
# config/voice-profiles/personal.yaml

meta:
  owner: "Your Name"
  created: 2026-02-18
  last_calibrated: 2026-02-18
  calibration_status: initial  # initial|calibrating|calibrated|recalibrating
  posts_generated: 0
  current_edit_rate: null

identity:
  name: "Your Name"
  role: "CTO at Acme Corp"
  expertise: ["distributed systems", "developer tools", "team building"]
  audience: "senior engineers and technical founders"
  positioning: "the practical builder, not the thought-leader pontificator"

voice:
  # Language-agnostic traits (apply to both en and es)
  formality: 0.3          # 0=very casual, 1=very formal
  humor_frequency: 0.4
  humor_style: "dry, self-deprecating, never forced"
  vulnerability: 0.6       # willingness to share failures/doubts
  assertiveness: 0.8       # states opinions firmly vs hedges
  jargon_tolerance: 0.1
  emojis: rare             # never|rare|moderate|heavy
  swearing: light          # none|light|moderate|heavy

  perspective:
    default_pov: "first person singular"
    company_references: "'we' only when genuinely collective"
    reader_address: "direct 'you' when giving advice"

  # Auto-populated by the learning loop
  learned:
    confirmed: []
    rejected: []
    experimental: []

  # Reply-specific voice (for /engage)
  reply_style:
    length: "1-3 sentences max"
    tone_shift: "+0.2 casual vs posts"
    patterns_that_work:
      - "Add a concrete data point or personal experience"
      - "Respectfully disagree with a specific reason"
      - "Ask a follow-up question that makes OP respond"
    patterns_that_fail:
      - "'Great point!' (adds nothing)"
      - "Long-winded explanations"
      - "Self-promotional links without context"

  # Language-specific voice (overrides/extends base voice)
  languages:
    en:
      sentence_style: "short and punchy, rarely more than 15 words, fragments are fine"
      paragraph_style: "one idea per paragraph, lots of line breaks"
      contractions: always
      opening_patterns:
        preferred:
          - "Personal anecdote ('I just...' / 'Last week I...')"
          - "Bold assertion ('Most people are wrong about...')"
          - "Specific observation ('I noticed that every...')"
        avoid:
          - "Questions ('Did you know...?')"
          - "Statistics without context"
          - "Generic statements ('In today's world...')"
      closing_patterns:
        preferred:
          - "Let the last point land, no CTA"
          - "Open-ended thought that invites reflection"
        avoid:
          - "'Follow for more'"
          - "Emoji strings"
      vocabulary:
        signature_phrases: ["here's the thing", "the real question is"]
        never_use: ["leverage", "synergy", "optimize", "game-changer", "utilize"]
      hashtags:
        x: never
        linkedin: "1-2 relevant, never trending/generic"
        instagram: "5-10 in first comment, not caption"

    es:
      sentence_style: "directo y conciso, oraciones cortas, fragmentos están bien"
      paragraph_style: "una idea por párrafo, muchos saltos de línea"
      contractions: natural   # Spanish contractions (al, del) are always used
      formality_shift: -0.1   # slightly more casual in Spanish (relative to base)
      opening_patterns:
        preferred:
          - "Anécdota personal ('Acabo de...' / 'La semana pasada...')"
          - "Afirmación directa ('La mayoría se equivoca sobre...')"
          - "Observación específica ('Me di cuenta de que...')"
        avoid:
          - "Preguntas retóricas genéricas"
          - "Estadísticas sin contexto"
          - "Frases de relleno ('En el mundo actual...')"
      closing_patterns:
        preferred:
          - "Dejar que el último punto aterrice, sin CTA"
          - "Pensamiento abierto que invite a la reflexión"
        avoid:
          - "'Sígueme para más'"
          - "Cadenas de emojis"
      vocabulary:
        signature_phrases: ["la clave está en", "la pregunta real es"]
        never_use: ["sinergia", "optimizar", "disruptivo", "apalancamiento"]
      hashtags:
        x: never
        linkedin: "1-2 relevantes, nunca genéricos"
        instagram: "5-10 en primer comentario, no en caption"

persona_boundaries:
  topics_on_limits: ["politics", "religion"]
  controversy_budget: 0.35   # 35% of content can be edgy
  personal_disclosure: "professional failures yes, personal life rarely, family never"
  competitor_mentions: "reference respectfully, disagree with ideas not people"

platform_adaptations:
  x:
    max_length_preference: 240
    thread_style: "numbered, 4-6 tweets, each stands alone"
  linkedin:
    opening_hook: "strong first line — it's the 'see more' threshold"
    formatting: "heavy line breaks, short paragraphs"
    tone_shift: "+0.1 formality vs X"
  instagram:
    caption_style: "short, punchy, let the visual work"
    reel_script_style: "conversational, like explaining to a friend"
```

### Brand Operator Profile Additions

```yaml
# config/voice-profiles/brand-operator-acme.yaml

brand_constraints:
  approved_adjectives: ["innovative", "reliable", "developer-first"]
  banned_adjectives: ["cheap", "disruptive", "revolutionary"]
  legal_disclaimers: []
  competitor_policy: "never mention by name, compare on features only"
  claim_policy: "no unsubstantiated claims, always cite data"

# More prescriptive, less personality-driven
voice:
  formality: 0.6
  humor_frequency: 0.1
  humor_style: "light wordplay only, nothing risky"
  vulnerability: 0.2
  assertiveness: 0.7
```

### Brand Ambassador Profile

```yaml
# config/voice-profiles/brand-ambassador-acme.yaml

inherits_from: personal
overrides:
  controversy_budget: 0.15  # lower than personal
  personal_disclosure: "professional stories yes, especially involving the company"
  topics_on_limits: ["politics", "religion", "competitor drama"]
  framing: "personal experiences that illuminate company values/mission"
```

### Onboarding Flow (`/psn:setup voice`)

Runs during initial `/psn:setup` or anytime as `/psn:setup voice`. Three phases:

**Phase 1: The Interview (10-15 minutes)**

The interview detects whether the user has existing content and branches:

**Path A: Has existing content** → Current flow (full interview + import + calibration)

**Path B: No content history (blank slate)** → Personality-first interview:
- Shorter: ~5-7 min instead of 10-15
- Focuses on personality traits, not writing patterns: "How do you explain your work to a friend at dinner?", "Do you lean toward data or stories when making a point?", "Comfortable being wrong publicly?"
- Claude suggests 2-3 "starter voice archetypes" based on answers (e.g., "The Practical Builder", "The Opinionated Expert", "The Transparent Learner") — user picks the closest fit
- Explicit framing: "This voice will evolve fast over your first 10-15 posts. I'll learn from your edits."
- Calibration mode is more aggressive — feedback check every 3 posts (vs. 5-10 for users with existing content)
- Phase 2 (Content Import) is skipped entirely
- Phase 3 (Calibration Posts) runs the same but with a lower bar — the system expects higher edit rates and treats every edit as high-signal training data

**For bilingual blank-slate users:** Claude runs the personality questions in both languages to capture natural expression patterns even without existing content.

Claude has a conversation — not a questionnaire — to extract voice patterns organically:

- Identity & context: role, audience, expertise, company relationship
- **Languages**: which languages they post in (en, es, or both). If bilingual, the interview covers both — Claude switches languages mid-conversation to capture voice in each.
- Voice discovery: "Who are 3-5 creators whose style you admire?" (Claude analyzes their content). "Show me a post you're proud of." "How would your best friend describe how you talk?"
- **For bilingual users**: "Show me a post you're proud of in English. Now one in Spanish." — because voice patterns differ by language.
- Platform preferences: what you already use, what you engage with as a consumer
- Company voice (if applicable): brand guidelines, examples of good/bad company content
- Boundaries: comfort with controversy, humor, vulnerability, personal disclosure

After the interview, Claude generates draft voice profiles (with language-specific sections for each configured language) and reads them back: "Based on our conversation, here's how I understand your voice..." The user corrects and adjusts.

**Phase 2: Content Import (5-10 minutes)**

If the user has existing content, import it to bootstrap the learning loop:

| Source | How | What we learn |
|---|---|---|
| X/Twitter history | API pull or export file | Writing patterns, voice, topics, engagement data |
| LinkedIn posts | API (own posts) or manual paste | Professional voice, format preferences |
| Instagram captions | API pull | Visual content style, caption voice |
| Blog posts | RSS feed URL or paste URLs | Long-form voice, depth of expertise |
| Newsletter archive | RSS or paste URLs | Communication style with engaged audience |
| Brand guidelines | Upload PDF/doc | Company voice constraints |
| "Posts I admire" | Paste URLs | Aspirational voice patterns |

Claude analyzes imported content and presents insights:
- Average sentence length, vocabulary patterns, opening/closing habits
- Tone markers (formal↔casual spectrum, humor frequency)
- Topic distribution (what they actually talk about vs. what they think they do)
- Engagement correlation (which voice patterns got the most engagement)
- Platform-specific differences in existing writing

**Phase 3: Calibration Posts (First Week)**

The voice profile is a hypothesis after onboarding. First week runs in **calibration mode**:

1. Claude generates posts using the voice profile
2. User reviews and edits (heavier editing expected initially)
3. Every edit is tracked and analyzed
4. After 5-10 posts (Path A) or every 3 posts (Path B / blank slate), Claude presents a calibration report with specific adjustments
5. Target: under 20% edit rate within 2-3 weeks

Path B users start with higher expected edit rates — every edit is treated as high-signal training data. If edit rate stays high, the system prompts a recalibration conversation.

---

## Learning Loop (RLHF for Your Brand)

The system gets smarter over time through three feedback channels, creating a personalized content optimization loop.

### Feedback Channel 1: Engagement Signals (Quantitative)

The audience votes through behavior. Not all signals are equal:

| Signal | What it means | Weight |
|---|---|---|
| **Saves** | "This is valuable, I want to reference it" | Highest |
| **Shares/Reposts** | "Worth my reputation to amplify" | Very high |
| **Comments (quality)** | "Made me think/feel enough to respond" | High |
| **Comment threads (depth)** | "Sparked real discussion" | Very high |
| **Follows from post** | "I want more of this" | Very high |
| **Non-follower impressions** | "Algorithm is pushing this" | High |
| **Click-through rate** | "Hook worked AND content delivered" | High |
| **Watch time / retention** | "People stayed" | Highest for video |
| **Likes** | "I acknowledged this" | Low (vanity metric) |
| **Impressions without engagement** | "Saw it and scrolled past" | Negative signal |

The system computes a **composite engagement score** per post — a weighted score reflecting actual quality. This score is attached to every post in the archive.

### Feedback Channel 2: Edit Signals (Implicit)

Every edit the user makes to generated content is training data:

| Edit pattern | What the system learns |
|---|---|
| Rewrites hook/opening | System's hooks don't match user's instinct |
| Removes jargon/buzzwords | Voice calibration is off — too corporate |
| Adds personal anecdote | System isn't being personal enough |
| Shortens significantly | Too verbose for this platform |
| Changes tone | Voice model needs adjustment |
| Removes hashtags | User's audience doesn't respond to hashtags |
| Approves with zero edits | System nailed it — reinforce everything |
| Rejects entirely and rewrites | Strong negative signal — analyze what went wrong |

The system tracks **edit distance** and **edit patterns** over time. Decreasing edit rate = brain getting smarter. Increasing rate = something shifted, needs recalibration.

### Feedback Channel 3: Explicit Feedback (Direct)

The system prompts for explicit feedback at key moments:

- **Post performed 3x above average:** "What do you think made this work?"
- **Post significantly underperformed:** "Was it the topic, the angle, the timing, or bad luck?"
- **10 posts with low edit rate:** "I've been generating content you approve with minimal edits. Should I push boundaries — try new formats or edgier takes?"
- **10 posts with high edit rate:** "You've been editing a lot. Has something changed in your voice, audience, or goals?"

### The Preference Model

A structured, evolving knowledge base that Claude reads before every generation. Personal preference model lives in the Personal Hub DB (`preference_models` table). Company brand preference model lives in the Company Hub DB (`brand_preferences` table).

```yaml
# Personal Hub DB preference_models table (shown as YAML for readability)

last_updated: 2026-02-18
posts_analyzed: 147
average_edit_rate: 0.23  # down from 0.61 at start

voice_learnings:
  confirmed_patterns:
    - "Short punchy sentences outperform long complex ones"
    - "First-person stories get 3.2x more engagement than generic advice"
    - "User always removes 'leverage' — never use it"
  rejected_patterns:
    - "Listicle format — user rejected 8/10 times"
    - "Motivational tone — always edited to be more direct"

platform_learnings:
  x:
    best_performing_archetypes: ["contrarian", "observation", "story"]
    worst_performing: ["curation", "tutorial"]
    optimal_length: "180-240 chars for singles, 4-5 tweets for threads"
    best_hooks: ["'Unpopular opinion:'", "'Everyone is wrong about...'"]
    hashtags: "never — user always removes them"
  linkedin:
    best_performing_archetypes: ["story", "behind-the-scenes", "framework"]
    optimal_format: "carousel (8-12 slides) or text with line breaks"
    hooks_that_work: ["Personal failure opening", "'I changed my mind about...'"]

pillar_performance:
  "AI insights":
    target_percentage: 35
    actual_percentage: 42
    avg_engagement: 3.1
    trend: "declining — audience fatigued"
    recommendation: "reduce to 30%, try more specific sub-topics"
  "Founder journey":
    target_percentage: 30
    actual_percentage: 22
    avg_engagement: 5.7
    trend: "consistently strong"
    recommendation: "increase to 35% — this is the user's superpower"

archetype_performance:
  contrarian: { count: 18, avg_engagement: 4.8, trend: "stable" }
  story: { count: 23, avg_engagement: 5.2, trend: "rising" }
  framework: { count: 31, avg_engagement: 2.9, trend: "declining" }

language_performance:
  en:
    post_count: 98
    avg_engagement: 3.8
    best_platforms: [x, linkedin]
    notes: "stronger for technical content and hot takes"
  es:
    post_count: 49
    avg_engagement: 4.1
    best_platforms: [linkedin, instagram]
    notes: "higher engagement per post, especially personal stories"
  both:
    post_count: 12
    avg_engagement: 3.2
    notes: "bilingual posts slightly lower — audience split"

audience_model:
  core_audience: "mid-senior developers and technical founders"
  what_they_respond_to:
    - "Practical, implementable insights (not theory)"
    - "Honest failure stories with specific lessons"
  what_they_ignore:
    - "Motivational content"
    - "Generic industry commentary"

content_fatigue_tracker:
  topics_cooling_down:
    - topic: "AI agents"
      reason: "posted 6 times in 2 weeks, engagement dropping"
      resume_after: "2026-03-01"
  formats_cooling_down:
    - format: "numbered list thread"
      reason: "last 3 below average"
```

### Update Cadence

| When | What updates | How |
|---|---|---|
| **Post published + 48h** | Individual post scored, compared to averages, outliers flagged | Automatic (analytics-collector) |
| **Weekly** (during `/psn:review`) | Platform learnings, archetype performance, edit patterns, fatigue tracker | Claude analyzes + updates |
| **Monthly** (during `/psn:review`, auto-escalated) | Pillar performance trends, voice drift detection, audience model, risk budget recalibration | Deep analysis + updates |

### Learning Loop Autonomy

The learning loop is **mostly autonomous** — it can make any tactical adjustment without asking. The mental model: the system is your social media manager, not your consultant. A manager makes tactical decisions and reports back. A consultant asks permission for everything.

**Fully autonomous (no permission needed):**
- Preference model updates (what works, what doesn't, voice patterns, audience behavior) — these are observations of reality
- Pillar percentage adjustments (capped at ±5% per cycle to prevent wild swings)
- Posting time optimization
- Topic fatigue management (cooling down overused topics)
- Hook/format preferences (retire underperforming patterns, reinforce strong ones)
- Archetype balance adjustments
- Hashtag strategy changes
- Content length calibration
- Posting frequency adjustments (±1/week per cycle)
- Risk budget micro-adjustments (±0.05 per cycle)

**Requires user confirmation (identity-level decisions):**
- Enabling or disabling an entire platform
- Changing persona boundaries (controversy budget limits, personal disclosure limits)
- Modifying the never-use vocabulary
- Retiring a content series
- Changes to the brand-operator voice profile (affects all team members)
- Adding new content pillars or removing existing ones entirely

**Transparent changelog:** Every autonomous change is logged. The weekly `/psn:review` report includes a "what the brain changed this week" section — not asking permission, just informing. Example:

```
This week's auto-adjustments:
- AI insights pillar: 35% → 32% (engagement declining, audience fatigued)
- Founder journey pillar: 30% → 33% (consistently top performer)
- LinkedIn posting time: 8:00 AM → 8:30 AM (last 4 posts at 8:30 outperformed)
- Added "AI agents" to cooling-down topics (6 posts in 2 weeks, diminishing returns)
- Retired hook pattern "Did you know..." (0/4 performed above average)
```

**User override is permanent:** If the user disagrees with any change and reverts it, the system respects that override and will not re-adjust that specific setting unless the user explicitly unlocks it. "No, put AI insights back to 35%" means 35% is now a hard floor until further notice.

**Rate limiting prevents wild swings:** The system makes gradual adjustments, never dramatic pivots. If the data strongly suggests a major strategic shift (e.g., "you should stop posting on X entirely and focus on LinkedIn"), the system flags it as a recommendation in the analytics report rather than acting autonomously. Gradual drift is autonomous; step changes are conversational.

All changes are version-controlled (strategy.yaml in git for personal, timestamped records in Hub DB for company brand) — any change can be reviewed or rolled back.

### Company Brand Learning

The company brand preference model lives in the Company Hub DB so all team members benefit. When Bob's company post gets 5x engagement, Alice's next company post reflects that learning. New team members inherit months of accumulated brand intelligence — no cold start for company content.

When posting, Claude reads from the appropriate Hub(s):

| Posting as... | What Claude reads | Source Hub(s) |
|---|---|---|
| Personal account | Personal preference model only | Personal Hub |
| Brand Operator (company voice) | Company brand model | Company Hub |
| Brand Ambassador (your face + company) | Personal model + company brand model | Personal Hub + Company Hub (cross-Hub read) |

---

## Content Series

Content series are recurring formats with a recognizable identity that the audience expects. They reduce ideation friction (format is fixed, just need fresh content), build audience habits, and compound over time.

### Series Are Optional But First-Class

The system:
- **Never requires** a series — some people post best as free-form
- **Suggests** creating one when it detects a pattern ("you've posted 5 similar myth-busting threads — formalize as a series?")
- **Fully supports** series for users who want them

### Series Definition

```yaml
# config/series/monday-myths.yaml

series:
  name: "Monday Myths"
  slug: "monday-myths"
  tagline: "Busting one industry myth every Monday"
  owner: "alice"
  scope: personal          # personal|company
  persona: personal

  language: en               # en|es|both — fixed per series

  platforms:
    primary: x
    cross_post: [linkedin]

  cadence:
    frequency: weekly
    day: monday
    time: "09:00"
    timezone: "America/New_York"
    flexible: false

  format:
    type: thread
    structure:
      - "Hook: state the myth as if it's true"
      - "Pivot: 'Actually, this is wrong. Here's why.'"
      - "Evidence: 2-3 concrete examples or data points"
      - "Reframe: what's actually true instead"
      - "Close: one-line takeaway, no CTA"
    length: "4-5 tweets for X, single long post for LinkedIn"

  branding:
    hashtag: "#MondayMyths"
    numbering: true
    opening_template: "Myth #{number}: \"{myth_statement}\""

  content:
    pillar: "Educational"
    topic_pool:
      - "You need 10x engineers"
      - "Microservices are always better"
    topic_constraints:
      - "Must be a genuinely held belief, not a strawman"
      - "Should be debatable — not obviously wrong"

  history:
    installments_published: 13
    last_published: "2026-02-10"
    next_due: "2026-02-17"
    best_performing: "#8: 'Product-market fit before building'"
    avg_engagement: 4.2
    trend: "rising"

  status: active           # active|paused|retired
```

### Series Integration With Commands

Series are woven into the core commands — see [`/psn:plan`](#psnplan--weekly-ideation--batch-generation--scheduling) (auto-slotting, due date surfacing), [`/psn:post`](#psnpost--create-and-schedule-content) (installment nudges), and [`/psn:review`](#psnreview--performance-analysis--strategy-adjustments) (per-series analytics).

### Series Lifecycle

**Creation** — three paths:
1. Intentional: `/psn:series create` → interview about format, cadence, branding
2. Organic discovery: learning loop notices a pattern → suggests formalizing
3. From idea bank: an idea tagged as "recurring format potential"

**Pausing**: `/psn:series pause <name>` — no more nudges, not auto-slotted, calendar slot freed. Optional resume date.

**Retiring**: `/psn:series retire <name>` — archived, analytics preserved, back-catalog remains.

**Evolving**: After 10-20 installments, the system suggests format refreshes, scope shifts, or graceful retirement based on engagement trends.

### Company Series

Company-scoped series live in the Hub DB so all team members see them:

```yaml
scope: company
owner: null              # no single owner
contributors:
  - alice: 8
  - bob: 5
rotation: round_robin    # auto-assign next installment
```

### Series Management (via `/psn:series`)

Series CRUD operations have their own command since they're creative architecture decisions. Writing a series installment goes through `/psn:post` (which auto-detects due installments) or `/psn:plan` (which auto-slots them). See [Commands](#commands-slash-commands) for the full `/psn:series` subcommand list.

---

## Engagement Engine (Replying to Viral Posts)

Strategic replies to viral/high-engagement posts are one of the highest-impact organic growth tactics. Data shows:

- Replies within 15 minutes on X get **300% more impressions** than later replies
- X Premium replies get **algorithmically placed at the top** of threads
- On LinkedIn, comments count **2x likes** in the algorithm during the golden hour (first 60 min)
- On TikTok, stitching viral content gets **32% more views** than standalone posts
- A single good reply on a viral tweet can drive more profile visits than 5 of your own posts
- Being the replier drives more sustained growth than going viral yourself

### Why Semi-Automated Only

Fully automated replies will get accounts banned. All platforms explicitly prohibit automated keyword-based replies. The semi-automated approach:

| AI does | Human does |
|---|---|
| Monitors feeds 24/7 for viral posts in your niche | Final approval of every reply |
| Scores opportunities by relevance, timing, author influence | Tone judgment for specific context |
| Drafts 2-3 reply options matched to your voice | The actual posting (from their own session) |
| Alerts via WhatsApp with drafts ready | Following up on conversations that develop |
| Tracks which replies performed | Relationship building |

### The Engagement Flow

```
1. DETECT — engagement-monitor task (every 5-15 min during active hours)
   Finds trending posts matching niche criteria

2. SCORE — relevance × author influence × post velocity × time window remaining
   Threshold: 60+ = draft replies, 70+ = push notify, 60-69 = digest or `/psn:engage`

3. DRAFT — AI generates 2-3 reply options using voice profile's reply_style section

4. ALERT — WhatsApp: viral post link + reply drafts + urgency

5. ACT — User responds via WhatsApp structured commands (see below) or Claude Code

6. TRACK — Monitor reply performance over 24h, feed back into model
```

### Platform-Specific Engagement

**Note:** The engagement engine only runs on platforms where the user/brand is active. All tasks, monitoring, and caps are scoped to enabled platforms in `strategy.yaml`.

| Platform | Strategy | Target |
|---|---|---|
| **X** | Speed is everything. 15-min reply window. X Premium nearly mandatory for ranking. | 5-10 strategic replies/day |
| **LinkedIn** | Manual `/psn:engage` sessions. 60-min golden hour. Comments >10 words get preference. | 3-5 thoughtful comments/day |
| **TikTok** | Stitching/dueting primary (32% more views). System finds viral video → generates reaction script → you record. | 1-2 stitches/week |
| **Instagram** | Build "interaction history" for ranking. Monitor niche hashtags. | 3-5 genuine comments/day |

For per-platform API details and monitoring behavior, see [`engagement-monitor` task](#engagement-monitor).

### Safety & Caps

See the full `engagement` config in [`strategy.yaml`](#content-strategy-system).

### `/psn:engage` Command

For proactive engagement sessions (instead of waiting for notifications):

1. Claude scans current trending content in your niche (real-time)
2. Shows top 5-10 opportunities ranked by score
3. For each: the post, why it's relevant, 2-3 reply drafts
4. You pick which to reply to, edit if needed, approve
5. A focused 15-minute engagement session

---

## Commands (Slash Commands)

These are the core user-facing interactions. Each is a `.md` file in `.claude/commands/` that acts as a prompt template.

The system has 10 commands organized by intent. This is intentionally minimal — each command maps to a distinct user need.

| | Command | What it does | Frequency |
|---|---|---|---|
| **Workflow** | `/psn:post` | Create + schedule one piece of content | Multiple times/week |
| | `/psn:plan` | Weekly ideation + batch generation + scheduling | Once/week |
| | `/psn:capture` | Something caught your eye — save or post now | Ad-hoc |
| | `/psn:engage` | Reply to others' trending content | 1-3 times/week |
| | `/psn:review` | Performance analysis + strategy adjustments | Once/week |
| | `/psn:approve` | Review pending company posts | Ad-hoc (company only) |
| **Creative** | `/psn:series` | Manage recurring content formats | Ad-hoc |
| **Preferences** | `/psn:config` | Adjust how the system works for you | Occasional |
| **Infrastructure** | `/psn:setup` | Initial setup: accounts, keys, Hub, voice interview | Once |
| **View** | `/psn:calendar` | Optional standalone view of content queue | Ad-hoc |

**`/psn:setup` includes `/psn:config`**: The initial `/psn:setup` walks users through all preferences (notifications, engagement, language, etc.) as part of onboarding — so day-1 users are fully configured. `/psn:config` exists for later adjustments. Most users never call `/psn:config` directly — the learning loop auto-tunes most settings, and `/psn:review` prompts changes when data warrants it.

### `/psn:post` — Create and schedule content

The primary content creation command. The content brain picks the optimal format — including formats that require human recording (video scripts, TikTok stitches). The user never chooses "text post vs. video" — the brain recommends based on platform, topic, and what formats are performing.

**Flow:**
1. Claude reads voice profile for the active persona and the preference model
2. Claude reads analytics data to understand what's been working
3. Claude asks: which platform? which persona (personal/brand operator/brand ambassador)? which language (`en`, `es`, or `both`)?
   - Language defaults to the platform's primary language from `strategy.yaml`
   - If platform has multiple languages, Claude asks — but the user can always override
4. **Before asking for a topic**, Claude checks the idea bank (see [Idea Surfacing](#idea-surfacing-how-team-ideas-flow-naturally)). If ready ideas match: pick one or start fresh.
   - If no topic provided and no ready ideas, Claude offers 3 quick suggestions (mini-ideation inline)
   - If the user provides a URL, screenshot, or raw thought, Claude treats it as input material (replaces the old `/spark` + `/react` split)
5. **Content brain picks format**: text post, thread, carousel, reel script, TikTok concept, etc. — based on platform, topic, and preference model data
6. Claude generates the post using the voice profile's language-specific section(s):
   - `en` or `es` → single-language post, uses that language's voice section
   - `both` → bilingual post (both versions in one post, formatted per platform norms)
7. User reviews, edits, approves. **Every edit is tracked** for the learning loop (tagged with language).
8. **If format requires recording** (video, podcast, etc.): Claude generates script + talking points + thumbnail + caption, saves to `content/drafts/`. User records when ready, then runs `/psn:post finish` to package and schedule.
9. **If fully generatable**: scheduled immediately.
10. **Personal account** → writes to Personal Hub DB content queue and triggers a scheduled task on the user's Personal Trigger.dev project
11. **Company account** → submits to the Company Hub as a pending Trigger.dev run (tagged `status:pending-approval`). Approvers are notified via WhatsApp.
12. **Brand Ambassador** (cross-Hub read) → Claude reads personal voice profile (local) + personal preference model (Personal Hub) + company brand model (Company Hub). Post is submitted to the Company Hub (it's company content).

**Post generation must:**
- Match the active persona's voice profile exactly, **using the correct language-specific voice section**
- Be platform-specific (X thread vs LinkedIn carousel vs Instagram reel script vs TikTok concept)
- Include hashtags (per voice profile's language-specific preferences), timing recommendation, and media suggestion
- Never feel like AI slop — Claude should write as the user, not as a generic AI
- Reflect learnings from the preference model (best hooks, best formats, fatigued topics to avoid — **tracked per language**)
- For bilingual posts (`both`): each language section is independently crafted for that language's voice, not a literal translation

**Semi-automated content types** (brain picks these when appropriate):
- Video of you talking (script + thumbnail → you record → `/psn:post finish`)
- TikTok stitch/duet (system finds viral video → generates reaction script → you record → `/psn:post finish`)
- Podcast clip extraction (long recording → Claude identifies key moments → you approve clips)
- Event live-posting (Claude prepares templates → you take photos/video → Claude posts with context)
- Interview/Q&A (Claude prepares questions → you record → Claude edits and captions)

### `/psn:plan` — Weekly ideation + batch generation + scheduling

The weekly content planning session. Combines ideation (what should we talk about?), generation (write the posts), and scheduling (slot them into the week) into one flow. Calendar context is shown throughout — no need to check `/psn:calendar` separately.

**Flow:**
1. Claude shows the current week's calendar state: what's already scheduled, series due dates, gaps
2. Claude asks: which persona? (personal / brand operator / brand ambassador)
3. **Ideation phase** — Claude runs the intelligence layer:
   - Checks stored trend data from daily collection (Layer 1)
   - Fires real-time searches: Perplexity, Exa, Tavily (Layer 2)
   - Reviews recent content + analytics (what's working, what's missing)
   - Checks competitor recent activity
   - Checks idea bank for maturing sparks and seeds
   - Considers calendar/events, series due dates
   - Checks content fatigue tracker (topics to avoid)
   - Surfaces recycling opportunities (high-performing past content with fresh angles)
4. Claude generates 10-15 ideas with angles (not full posts — concept + hook + format suggestion)
5. Ideas are mixed with existing `ready` ideas from the appropriate Hub (Personal Hub for personal, Company Hub for company targets) and team ideas (for company)
6. User rates: love it / maybe later / kill it
7. Loved → idea bank tagged `ready`. Maybe later → tagged `seed` (needs more development). Kill → killed with reason recorded.
8. Claude helps mature existing sparks and seeds: "You have 6 sparks from this week. Want to develop any?"
9. **Batch generation phase** — Claude plans the week:
   - **Series installments auto-slotted first**
   - **Ready ideas from the bank fill gaps** (personal or company, depending on target)
   - Claude generates new posts for remaining slots, balanced across content pillars and archetypes
   - For each post slot, Claude suggests a language (`en`, `es`, or `both`) based on the platform's config and recent language mix — user can override any
   - **Content brain picks format per slot** — some may be fully generated, others may need recording
10. User reviews each post, can edit/reject/approve
11. Approved posts scheduled across the week with optimal timing
12. Slots requiring recording are saved as drafts with scripts/thumbnails ready
13. Calendar view shown at the end confirming the full week

**Content pillar distribution** comes from `strategy.yaml` and is adjustable per user/company. Default:
- 35-40% Educational (how-tos, insights, frameworks)
- 25-30% Personal/Authentic (stories, behind-the-scenes, opinions)
- 15-20% Engagement (polls, questions, discussions)
- 10-15% Promotional (launches, case studies, CTAs)
- 5-10% Entertainment (memes, trend participation, humor)

**The user can bail at any phase.** Just ideate without generating? Fine — ideas are banked. Just generate without scheduling? Fine — posts are drafted. The command adapts to how much time you have.

### `/psn:capture` — Something caught your eye

For when something catches your eye — a URL, screenshot, trending topic, or raw thought. Replaces the old split between "save for later" and "react now" — the user provides input and the system helps them decide.

**Flow:**
1. User pastes a URL, screenshot, text snippet, or just describes a raw thought
2. Claude analyzes: is this timely (needs action now) or evergreen (save for later)?
3. **If timely** (trending topic, breaking news, time-sensitive): Claude says "This is time-sensitive. Want to post about it now?" If yes → generates post using voice profile + platform best practices, user reviews and approves. Target: under 3 minutes. If no → saved to idea bank with urgency tag and expiry.
4. **If evergreen**: Claude creates a spark in the idea bank with minimal metadata (title, reference, context, suggested platform/persona)
5. Optionally: Claude asks "personal or company?" to route it correctly
6. If pre-loaded context exists from a WhatsApp notification (trend-alerter), Claude uses it to skip research and go straight to post generation with suggested angles.
7. Done in under 30 seconds for saves, under 3 minutes for timely posts.

### `/psn:engage` — Reply to others' trending content

Proactive engagement session for strategic replies. At the end, Claude bridges to content creation: "Any of these conversations spark a post idea?"

**Flow:**
1. Claude scans current trending content in your niche (real-time)
2. Shows top 5-10 opportunities ranked by relevance score
3. For each: the post, why it's relevant, 2-3 reply drafts (from voice profile's reply_style)
4. User picks which to reply to, edits if needed, approves
5. Designed as a focused 15-minute session
6. **Bridge to creation**: After the session, Claude asks if any conversation sparked a post idea — if yes, transitions to `/psn:post` flow with context pre-loaded

### `/psn:review` — Performance analysis + strategy adjustments

Combines analytics and strategy into one session. The system shows what happened, what it auto-adjusted, and asks if anything needs overriding. Weekly use for performance, with automatic escalation to deep strategic analysis when enough data accumulates (monthly).

**Flow:**
1. Claude triggers the `analytics-collector` task on the Hub, which pulls latest metrics from all connected platform APIs
2. Metrics saved to the Hub DB (`analytics` table) for historical tracking
3. Claude queries the DB and generates a human-readable report
4. Report includes: what's working, what's not, specific recommendations, trends vs. previous periods
5. **Updates the preference model** with weekly learnings (platform learnings, archetype performance, edit patterns, fatigue tracker)
6. **Per-series analytics** tracked separately
7. **Shows autonomous adjustments**: "What the brain changed this week" — transparent changelog of all auto-adjustments made by the learning loop
8. **Strategy discussion**: Claude proposes adjustments if data warrants it — change pillar ratios, try new content types, shift posting times, focus on a platform that's working
9. **Monthly deep analysis** (triggered automatically when a month of data has accumulated since last deep review): voice drift detection, audience model update, risk budget recalibration
10. User discusses, agrees/disagrees, overrides if needed
11. Claude updates strategy.yaml and preference model
12. Report saved locally to `analytics/reports/` for reference

**Metrics to track (meaningful, not vanity):**

| Metric | Why | Platform |
|---|---|---|
| Engagement rate | Relative performance per post | All |
| Comments | Signal of genuine interest | All |
| Shares/Reposts | Content resonance beyond followers | All |
| Saves | High-value content indicator | Instagram, LinkedIn |
| Click-through rate | Action taken | All |
| Follower growth rate | Momentum, not raw count | All |
| Watch time / retention | #1 algorithm signal for video | Instagram Reels, TikTok |
| Impressions from non-followers | Discovery/reach | Instagram, TikTok |

**Analysis cadence:**
- Weekly: Post-level performance (what got engagement, what flopped) + auto-adjustment review
- Monthly: Pillar-level performance, voice drift, audience model (auto-escalated)

### `/psn:calendar` — View content queue (optional standalone)

Calendar context is woven into `/psn:plan`, `/psn:post`, and `/psn:approve` automatically — most users never need this as a standalone command. It exists for users who want a pure view of their schedule without starting a workflow.

**Flow:**
1. **Personal posts:** Claude queries the Personal Hub (Trigger.dev `list_runs` for personal scheduled posts)
2. **Company posts:** Claude queries each connected Company Hub (Trigger.dev `list_runs` filtered by company tags)
3. **Series slots** shown as recurring anchors (personal from Personal Hub, company from Company Hub)
4. Displays a unified view of upcoming posts across personal and all connected companies
5. **Empty slots show matching ready ideas** from the appropriate idea bank as suggestions
6. User can reschedule, edit, delete, or add posts
7. For company accounts: shows who's posting when to avoid overlap
8. **Company slot claiming**: `/psn:calendar claim <date> <platform>` — Claude checks the Company Hub for conflicts, then reserves the slot for you. Other team members see the claim immediately.

### `/psn:approve` — Review pending company posts

For users with approval permissions. Calendar context and idea bank context are shown automatically.

**Flow:**
1. Claude queries the Company Hub for runs tagged `status:pending-approval`
2. Shows each with context (who created it, for which platform, scheduled when, content preview)
3. **Shows calendar** to check for conflicts or clustering
4. **Shows related ideas in the bank** to prevent duplicate topic development
5. Reviewer can approve → run rescheduled to target datetime, tagged `status:approved`
6. Reviewer can reject → run cancelled, feedback stored in metadata
7. Notification sent to the author via WhatsApp with the result

### `/psn:series` — Manage recurring content formats

Content series are creative architecture — creating, evolving, and retiring recurring formats. See [Content Series](#content-series) for full details on series definitions, lifecycle, and integration with other commands.

| Subcommand | What it does |
|---|---|
| `/psn:series create` | Interactive series creation |
| `/psn:series list` | Show active, paused, and retired series |
| `/psn:series status` | Dashboard: due dates, overdue, performance |
| `/psn:series pause <name>` | Pause with optional resume date |
| `/psn:series resume <name>` | Resume a paused series |
| `/psn:series retire <name>` | Archive a series |
| `/psn:series edit <name>` | Modify format, cadence, branding |

### `/psn:config` — Adjust preferences

Preferences and tuning knobs that evolve with use. Most of these are auto-configured during `/psn:setup` and auto-tuned by the learning loop — `/psn:config` is for manual overrides and adjustments.

**What `/psn:config` manages:**

| Setting | Examples |
|---|---|
| **Notifications** | Push sensitivity (low/medium/high), quiet hours, daily caps, provider (WhatsApp/email/both), enable/disable notification types (trend alerts, engagement opportunities, digests) |
| **Engagement** | Daily reply caps per platform, monitoring hours, check frequency, targeting (min author followers, max post age), blocklist |
| **Language** | Default language per platform, bilingual preferences |
| **Posting frequency** | Override `current_frequency` and `target_frequency` per platform |
| **Content pillars** | Manual weight overrides (learning loop adjusts these automatically, but user can lock a value) |
| **Platform preferences** | Posting times, content focus per platform |
| **Competitor monitoring** | Add/remove monitored accounts, gap analysis notes |
| **Voice tweaks** | Quick adjustments without a full recalibration: "stop using 'leverage'", "be more casual on X", add/remove signature phrases |
| **Approval workflow** (company) | Who can approve, posting policy |

**`/psn:config voice`** is for quick tweaks (add a banned word, adjust formality). **`/psn:setup voice`** is for a full recalibration interview (15 min deep session when the voice model needs significant rework).

`/psn:review` prompts `/psn:config` changes when data warrants it: "You ignored 8/10 alerts — lower notification sensitivity?" The user can also run `/psn:config` directly anytime.

### `/psn:setup` — Initial setup (one-time)

Infrastructure setup: accounts, API keys, Hub connection, and voice profiling. Run once during onboarding. **`/psn:setup` includes the full `/psn:config` flow** — all preferences are configured as part of initial setup, so day-1 users are fully configured without ever running `/psn:config` separately.

**All flows start by creating a Personal Hub** — this is mandatory and happens first. Then optionally connect to company Hubs.

**Flow (any user — Personal Hub creation is always step 1):**
1. Create Personal Hub: Neon Postgres database + Trigger.dev Cloud project (free tier, automated)
2. Deploy personal automation tasks (post-scheduler, analytics-collector, trend-collector, etc.)
3. Credentials saved to `config/hub.env` (gitignored)
4. Connect personal social media accounts (OAuth flows)
5. Configure personal API keys (image generation, intelligence APIs)
6. **Voice profiling** (interview + content import + calibration) — see [Voice Profile & Onboarding](#voice-profile--onboarding)
7. **Preferences** — walks through all `/psn:config` settings (notifications, engagement, language, etc.) with sensible defaults
8. Writes all config to `config/` directory (keys.env, hub.env, and connections/*.env are gitignored)

**Flow (team member joining a company — after Personal Hub exists):** `/psn:setup join`
1. Enter invite code (short string like `acme-7x9k2m`, provided by admin)
2. `/psn:setup` calls the Company Hub's registration webhook (Trigger.dev) → validates code → registers member in `team_members` → returns Company Hub credentials (`DATABASE_URL` + `TRIGGER_API_KEY`)
3. Credentials saved to `config/connections/acme-corp.env` (gitignored). Invite code marked as used.
4. Configure brand voice profiles for this company (or schedule for later via `/psn:setup voice`)

**Flow (admin creating a Company Hub):** `/psn:setup hub`
1. Create Trigger.dev Cloud project (separate from personal)
2. Create Neon Postgres database (with RLS policies for per-user data isolation)
3. Deploy company automation tasks (post-scheduler, analytics-collector, calendar coordination, etc.)
4. Configure company social accounts + approval workflow
5. Generate invite codes for team distribution (one-time use, time-limited — default 7 days)
6. Save Company Hub credentials to `config/connections/<company>.env`

**Invite code management:**
- Admin generates codes: `/psn:setup invite <company>` → creates one or batch of codes
- Codes are one-time use and expire after 7 days (configurable)
- Admin can list active codes and revoke them
- When a member is removed from `team_members`, RLS immediately blocks all their DB queries — no credential rotation needed

**Flow (user with multiple companies):**
1. Personal Hub already exists (from initial setup)
2. Run `/psn:setup join` per company → each creates a `config/connections/<company>.env`
3. Run `/psn:setup hub` per company they admin → creates Company Hub, then saves connection
4. Voice profiling runs for personal first, brand voices added via `/psn:setup voice` per company

**Subcommands (rare infrastructure actions):**
- **`/psn:setup voice`** — full voice recalibration interview (not quick tweaks — those go through `/psn:config voice`)
- **`/psn:setup hub`** — create a new Company Hub
- **`/psn:setup join`** — join an existing Company Hub via invite code
- **`/psn:setup invite <company>`** — generate/manage invite codes for a company you admin
- **`/psn:setup tokens`** — manually refresh expiring OAuth tokens
- **`/psn:setup platforms`** — add or remove a platform
- **`/psn:setup disconnect <company>`** — remove a Company Hub connection (deletes connection file, your personal data is unaffected)

---

## Notifications (WhatsApp)

### Provider: WAHA (WhatsApp HTTP API)

WAHA is a self-hosted, open-source WhatsApp API via Docker. It's the simplest option for notifications without paying per-message costs.

| Feature | WAHA Core (Free) | WAHA Plus |
|---|---|---|
| Sessions | 1 | Multiple |
| Send text/media | Yes | Yes |
| Dashboard | No | Yes |
| Proxy support | No | Yes |

**Alternative:** For users who prefer official channels, WhatsApp Business API via Twilio is supported as a configurable option. Cost: $0.004-0.025 per message depending on type.

### WhatsApp Interaction Model

WhatsApp is **fully interactive**, not just notification-only. Users can take action directly from WhatsApp using structured commands. This avoids the "saw the alert but forgot to open Claude Code" problem.

**Architecture:**
1. WAHA receives incoming WhatsApp message → webhook to Trigger.dev `whatsapp-handler` task
2. Task loads user's conversation state from Hub DB (`whatsapp_sessions` table — tracks active notification, pending items, last interaction)
3. Parse structured command → execute action (approve, post, skip, edit, etc.)
4. Send response back via WAHA
5. Update conversation state in DB

**Structured commands (v1):**

| Command | Context | Action |
|---|---|---|
| `R1`, `R2`, `R3` | Engagement alert | Post the selected reply draft |
| `skip` | Any actionable notification | Dismiss, move to next pending item |
| `approve` | Approval request | Approve the pending company post |
| `reject [reason]` | Approval request | Reject with feedback sent to author |
| `edit [new text]` | After selecting R1/R2/R3 or viewing a post | Replace content with provided text, then confirm |
| `post` | After editing | Confirm and post the edited content |
| `time [HH:MM]` | After approve/select | Change posting time |
| `list` | Any time | Show all pending actionable items |
| `help` | Any time | Show available commands |

**Conversation state machine:**

```
IDLE → (notification arrives) → AWAITING_ACTION
AWAITING_ACTION → R1/R2/R3 → CONFIRM_POST → post → IDLE
AWAITING_ACTION → R1/R2/R3 → CONFIRM_POST → edit [text] → CONFIRM_EDIT → post → IDLE
AWAITING_ACTION → skip → IDLE (or next pending)
AWAITING_ACTION → approve → IDLE
AWAITING_ACTION → reject [reason] → IDLE
```

**Error handling:**
- Unrecognized input → "Didn't understand. Reply `help` for commands or `skip` to dismiss."
- Stale context (replying to old notification) → "This notification expired. Reply `list` to see current items."
- Multiple pending → most recent notification is active. `list` shows all. User can reference by number: `#2 approve`.

**Future upgrade (post-launch):** Migrate from structured commands to Claude-powered natural language parsing. The conversation state machine and DB schema remain the same — only the parsing layer changes. This enables free-form interaction like "go with the second one but make it punchier" instead of `R2` then `edit [text]`.

### Notification Tiers

**Tier 1: Push immediately (WhatsApp)**

High-urgency, justifies interrupting your day. Hard cap: 3 per day per user (configurable).

| Event | Message |
|---|---|
| Trending topic in niche (score 70+) | "React Now — [topic] trending. 3 angles ready. Reply 1/2/3 or 'skip'" |
| Engagement opportunity (viral post in niche) | "Viral post by @bigaccount (4 min old). 3 reply drafts ready. Reply R1/R2/R3 or 'skip'" |
| Your content going viral (5x+ average) | "Your [platform] post is getting 5x normal engagement. Engage in comments now." |
| Timely idea expiring (12h left) | "Timely company idea expiring soon. Run `/psn:post` to develop it or `/psn:capture` to save context." |
| Approval needed | "New company post pending your approval. Run `/psn:approve` to review." |

**Tier 2: Morning digest (WhatsApp, daily)**

Interesting but not urgent. Sent at configurable time (default 7:30 AM).

The morning digest adapts to where the user is in their journey. It's a coach, not just a report.

**New user (first 2 weeks, < 10 posts):**

| Content | Example |
|---|---|
| One clear action with a command | "You have 0 posts this week. Run `/psn:post` — I'll suggest a topic. Takes ~3 min." |
| Encouragement after posting | "You posted 3 times last week. Your post about [X] got the most engagement." |
| Gentle introduction to next workflow | "Want to try planning your whole week at once? Run `/psn:plan` — I'll handle ideas and scheduling." |
| First analytics prompt (after 2 weeks) | "You have enough data for your first performance review. Run `/psn:review`." |

**Established user (2+ weeks, 10+ posts):**

| Content |
|---|
| Rising topics in your space (not yet trending) |
| Series installments due today |
| Content gaps (no posts scheduled for platform) |
| Stale sparks needing development or killing |
| Competitor notable posts worth responding to |
| "What the brain changed this week" summary (after autonomous adjustments) |

The digest never lists all available commands — it surfaces the ONE most useful action for today. Frequency of coaching nudges decreases as the user demonstrates consistent usage patterns.

**Tier 3: Standard notifications**

| Event | Message |
|---|---|
| Post scheduled | "Your post for @handle on LinkedIn is scheduled for Tue 8:00 AM" |
| Post published | "Posted to @handle on X. Track it: [link]" |
| Approval result | "Your post was approved/rejected by Alice. Feedback: ..." |
| Weekly digest | "This week: 5 posts, 2.3K impressions, 180 engagements. Run `/psn:review` for details." |
| Token expiring | "Your LinkedIn token expires in 7 days. Run `/psn:setup tokens` to renew." |
| Idea picked up | "Bob is developing your idea about [topic] into a LinkedIn post." |

### Relevance Scoring (for React/Engage alerts)

```yaml
scoring:
  pillar_match: 0-30 points
  expertise_match: 0-25 points
  trend_velocity: 0-20 points
  audience_relevance: 0-15 points
  competitor_activity: 0-10 points

thresholds:
  push_notification: 70+
  morning_digest: 40-69
  ignore: below 40
```

> **Note:** These weights and thresholds are initial defaults. The notification fatigue system auto-calibrates based on user action rates — if a user acts on most alerts, thresholds lower; if they ignore alerts, thresholds raise. Exact values are tuned through usage, not upfront.

### Notification Configuration

See the full `notifications` config in [`strategy.yaml`](#content-strategy-system).

### Notification Fatigue Prevention

- **Hard caps**: max 3 push notifications/day (configurable). 4th becomes digest-only.
- **Cooldowns**: 2-hour gap between pushes (unless score >90).
- **Deduplication**: same topic can't trigger twice.
- **Feedback loop**: track action rate. If user ignores 5 in a row → auto-reduce sensitivity. Monthly calibration prompt.
- **Smart throttling**: suppress non-critical on Monday mornings and Friday afternoons.
- **Focus modes**: "hold all notifications until 4 PM."

### Company-Level Routing

React/engage notifications route to relevant team members based on expertise:

```yaml
react_routing:
  "AI insights": [alice, bob]
  "Product updates": [carol, dave]
  "Industry news": [alice]
  "Competitor moves": [alice, carol]
```

First person to claim locks it — others see: "Alice is reacting to the GPT-5 news."

---

## Content Generation Engine

### Platform-Specific Formats

Claude must generate differently for each platform:

**X (Twitter):**
- Single tweets (< 280 chars), threads (3-7 tweets), quote-tweet-worthy takes
- Hot takes get engagement; threads demonstrate expertise (3x more engagement than singles)
- Short video (< 15s) gets 10x more engagement than text
- First 15 minutes of engagement are critical for algorithmic boost

**LinkedIn:**
- Carousels dominate (11.2x more impressions than text-only, 278% higher engagement than video)
- Personal failure stories massively outperform success stories
- "Build in public" and behind-the-scenes content works
- Generic "10 tips" carousels with stock photos are now penalized — specificity wins

**Instagram:**
- Reels for discovery: 30.81% average reach rate, 55% of views come from non-followers
- Carousels for engagement: higher engagement rate, more saves, up to 10 images
- Watch time is the #1 ranking factor (confirmed by Adam Mosseri, Jan 2025)
- First 3 seconds of video are critical

**TikTok:**
- Long-form (60+ seconds) now favored over short clips
- Authenticity over polish — 86% of consumers say authenticity drives decisions
- Niche community focus beats chasing broad virality
- Companion-style ("get ready with me"), POV format, voice-based content work well

### What AI Can Fully Generate vs. Needs Human Touch

| Fully automatable | Semi-automatable | Must be human |
|---|---|---|
| Text posts (with voice profile calibration) | Video scripts (AI writes, human records) | Face-to-camera video |
| Hashtag optimization | Thumbnails (AI generates, human approves) | Live streams |
| Content repurposing (blog → tweets → carousel) | Carousel design (AI creates, human reviews) | Hot takes on current events |
| Scheduling optimization | Podcast show notes | Personal stories |
| Caption drafting | Image selection/generation | Relationship-building replies |
| Analytics reports | Thread structure | Reading the room (when not to post) |
| Reply drafts for /engage | TikTok stitch scripts | Final reply approval and posting |

### Media Generation

#### Image Generation

| Provider | Best For | Text Rendering | Cost |
|---|---|---|---|
| **GPT Image (via OpenAI API)** | Versatile social media posts, editing | Excellent | ~$0.04-0.08/image |
| **Ideogram 3 (via API)** | Typography-heavy content, logos | Best (99% accuracy) | ~$0.05/image |
| **Flux 2 (via Replicate)** | Photorealistic backgrounds | Good | ~$0.03/image |
| **Stable Diffusion (via ComfyUI API)** | Custom pipelines, self-hosted option | Moderate | Self-hosted or ~$0.01-0.03/image |

#### Video Generation

| Provider | Best For | Cost |
|---|---|---|
| **Kling (via API)** | Realistic motion, product demos, b-roll | ~$0.10-0.30/video |
| **Runway (via API)** | Stylized video, image-to-video, transitions | ~$0.10-0.50/video |
| **Pika (via API)** | Short animated clips, text-to-video | ~$0.10-0.20/video |

#### What Can Be Fully Generated vs. Semi-Automated

| Fully generated (no human needed) | Semi-automated (human records, AI assists) |
|---|---|
| Animated text/quote videos | Face-to-camera talking head |
| B-roll with voiceover (TTS) | Podcast/interview recordings |
| Product demo from screenshots | Live event coverage |
| Before/after comparisons | Personal story vlogs |
| Data visualization animations | Reaction/commentary videos |
| Carousel/slideshow videos | Behind-the-scenes footage |
| AI avatar explainers | Q&A sessions |

The user configures which providers to use in `config/keys.env`. Claude picks the best tool for the job based on content type.

---

## Company Account Coordination

### Multi-User Access Model

```yaml
# config/company/acme.yaml
company: Acme Corp
accounts:
  x: "@AcmeCorp"
  linkedin: "company/acme-corp"
  instagram: "@acmecorp"

posting_policy: calendar_plus_approval  # Options: free, calendar, calendar_plus_approval

approvers:
  - user: alice
    can_approve: true
    can_post_as_company: true
  - user: bob
    can_approve: false
    can_post_as_company: true

calendar:
  slots_per_week: 5
  platforms:
    x: [mon, wed, fri]        # 9:00 AM
    linkedin: [tue, thu]       # 8:00 AM
    instagram: [mon, wed, fri] # 12:00 PM
```

### Approval Workflow

1. Team member runs `/psn:post` targeting company account
2. Post is submitted to the Company Hub as a Trigger.dev run with metadata (content, platform, author, requested time) and tagged `status:pending-approval`
3. Hub triggers the `notifier` task → WhatsApp message to approvers: "New post pending for @AcmeCorp on LinkedIn by Bob"
4. Approver runs `/psn:approve` → Claude queries Hub for pending runs, shows them for review
5. If approved → run is rescheduled to target datetime, tagged `status:approved`
6. If rejected → run is cancelled, author notified with feedback

### Calendar Coordination

- Personal calendar lives in the Personal Hub (scheduled Trigger.dev runs for personal posts)
- Company calendar lives in the Company Hub (scheduled Trigger.dev runs for company posts — single source of truth for the team)
- `/psn:calendar` merges both into a unified view — any team member sees the same company data in real-time
- Users can claim open company slots via `/psn:calendar claim <date> <platform>` — Claude checks the Company Hub for conflicts before submitting
- No git sync needed — each Hub is always current

---

## Employee Advocacy Strategy

Research shows employee-shared content gets **561% more reach** than company-shared content, and **60% of consumers trust individuals over brands**.

### How the System Enables This

1. **Low friction**: One command (`/psn:post`) generates a ready-to-review post. The barrier goes from "think of something to post, write it, find an image, figure out hashtags, decide when to post" to "run a command and approve."

2. **Personalized content**: Claude reads each user's voice profile to generate content that matches their voice, role, and interests — not generic corporate copy.

3. **Suggested content, not mandated**: The idea bank surfaces relevant ideas. Users customize before posting.

4. **Leadership goes first**: If founders/executives are using the system and posting regularly, the team follows.

5. **Recognition via analytics**: `/psn:review` can show a team leaderboard (opt-in) of who's posting and what's performing.

6. **Voice profiles eliminate the blank page**: The Brand Ambassador persona lets team members post company content in their own voice — authentic, not corporate.

---

## Posting Frequency Targets

Frequency ramps up as the user builds consistency. New users start conservative — the system increases automatically.

**Target frequencies** (long-term goals in `strategy.yaml`, auto-generated during setup):

| Platform | Target | Notes |
|---|---|---|
| X | 1-2 posts/day + strategic replies | Including threads. Replies via `/psn:engage` count toward engagement goals. |
| LinkedIn | 3-5 posts/week | Consistency matters more than volume |
| Instagram | 3-5 feed posts/week + Stories | Reels for growth, carousels for engagement |
| TikTok | 3-5 posts/week | Quality over quantity; long-form trending |

**Starting frequencies** (what new users actually begin with):

| User state | Total posts/week | Ramp trigger |
|---|---|---|
| Brand new (0-2 weeks) | 2-3 across all platforms | Hit target consistently for 2 weeks |
| Building habit (2-6 weeks) | 4-6 across all platforms | Hit target consistently for 2 weeks |
| Established (6+ weeks) | Per-platform targets above | Learning loop fine-tunes |

These fields are configured per-platform in `strategy.yaml` — see the full example in [Content Strategy System](#content-strategy-system).

- `current_frequency` is what `/psn:plan` generates for and what the calendar expects
- The learning loop ramps `current_frequency` toward `target_frequency` when the user consistently meets their current level for 2+ weeks
- Ramp increments are small: +1-2 posts/week per cycle
- If the user misses their target for 2 weeks, the system **does not nag** — it quietly adjusts `current_frequency` down and mentions it in the next analytics report
- User can manually override either value at any time via `/psn:config`

---

## Hub Tasks (Trigger.dev)

Tasks run on the appropriate Hub's Trigger.dev project. Personal tasks (personal posting, personal analytics, trend collection, engagement monitoring, notifications) run on the Personal Hub. Company tasks (company posting, company analytics, company calendar coordination) run on the Company Hub. Task definitions are the same codebase — deployed to each Hub's Trigger.dev project with different env vars.

### `post-scheduler`
- **Trigger:** Delayed run (specific datetime per post)
- **Action:** Read post content from Hub DB `posts` table → upload media to platform → call platform API → write to Hub DB `posts` table (archive) → notify user
- **Error handling:** Retry 3x with exponential backoff. On rate limit (429), retry after platform reset window. If all fail, notify user and tag run `status:failed`.

### `analytics-collector`
- **Trigger:** Cron (daily at 6:00 AM, configurable timezone)
- **Runs on:** Personal Hub (for personal accounts) and Company Hub (for company accounts)
- **Action:** For each connected account → pull metrics from platform API → write to the Hub's `analytics` table → score posts with composite engagement score
- **Note:** X uses pay-per-use pricing ($0.005/read). Analytics collector uses "post then lookup" pattern: fetch metrics 24-48h after posting for $0.005 per tweet. Instagram limited to 200 req/hr. TikTok data lags 24-48h.

### `trend-collector`
- **Trigger:** Cron (daily at 6:00 AM) + lighter poll every 2-4 hours during business hours
- **Runs on:** Personal Hub (scores against personal pillars, stores in `trends` table) and Company Hub (scores against company pillars + competitor monitoring, stores in `trends` table)
- **Action:** Pull from all Layer 1 intelligence sources (HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds, newsletters, competitor accounts) → score by relevance per hub's content pillars → store as structured trend snapshots
- **Breaking news detection:** The periodic poll checks HN front page + X trending only. If a new topic scores above push threshold, triggers `trend-alerter` immediately.

### `trend-alerter`
- **Trigger:** Runs after `trend-collector`, or triggered mid-day for breaking news
- **Action:** Check relevance scores against each user's notification thresholds → for push-worthy trends (score 70+): generate 2-3 suggested angles, pre-gather context, store as "react opportunity" → trigger `notifier` with WhatsApp push. For digest-worthy (40-69): queue for morning digest.

### `engagement-monitor`
- **Trigger:** Runs every 5-15 minutes during active hours (configurable per user)
- **Scope:** Only monitors platforms where the user/brand is active (enabled in `strategy.yaml`). Skips disabled platforms entirely — no wasted API calls.
- **Action per platform:**
  - **X:** Official pay-per-use search API ($0.005/read). Search for viral posts matching niche keywords + monitored accounts. Best real-time discovery — speed matters most here (15-min reply window).
  - **Instagram:** Official Graph API hashtag search (free, 200 req/hr, 30 unique hashtags/week). Monitor a focused set of niche hashtags + competitor accounts via Business Discovery API. Limited but functional.
  - **TikTok:** Free baseline via trend-collector (Creative Center trending data). Optional: EnsembleData API (~$100/mo) for real-time niche video discovery and hashtag monitoring. Without paid add-on, TikTok engagement opportunities surface via `/psn:engage` sessions instead.
  - **LinkedIn:** No automated monitoring — LinkedIn has no public content discovery API. Engagement opportunities surface through general intelligence (HN, Reddit, Perplexity picking up LinkedIn-discussed topics) and manual `/psn:engage` sessions.
- **Scoring:** relevance × author influence × post velocity × time window remaining → opportunities scoring 60+: draft 2-3 reply options using user's voice profile. Scores 70+: trigger `notifier` with WhatsApp push. Scores 60-69: queue for morning digest or surface during `/psn:engage` sessions.
- **Safety:** Respects daily caps, cooldowns, and blocklists per user configuration

### `token-refresher`
- **Trigger:** Cron (daily check)
- **Action:** Check OAuth token expiry for all accounts → refresh if within 7 days of expiry → update `oauth_tokens` table → notify if refresh fails

### `notifier`
- **Trigger:** Called by other tasks, or event-based
- **Action:** Send WhatsApp/email notification via configured provider (WAHA or Twilio)
- **Configurable:** Users can disable notifications or change provider in their config
- **Respects:** Quiet hours, daily caps, cooldowns, sensitivity settings, company-level routing

### `whatsapp-handler`
- **Trigger:** Webhook (WAHA forwards incoming WhatsApp messages)
- **Action:** Load user's conversation state from Hub DB (`whatsapp_sessions` table) → parse structured command → execute action (approve post, post reply, edit content, skip, etc.) → send response via WAHA → update conversation state
- **State:** Tracks active notification context, pending items, last interaction timestamp per user
- **Error handling:** Unrecognized input gets help message. Stale context (>2h) auto-expires to IDLE.

---

## Installation & Setup

### For any user (Personal Hub is always first)

```bash
# 1. Clone the repo
git clone <repo-url> my-social-media
cd my-social-media

# 2. Run setup (always creates your Personal Hub first)
claude /psn:setup

# This walks through (~20-25 minutes for full onboarding):
# - Creates your Personal Hub (Neon DB + Trigger.dev project, free tier)
# - Deploys personal automation tasks
# - Connect your personal social accounts (OAuth)
# - Configure your API keys (image gen, intelligence APIs)
# - Voice profiling interview (10-15 min)
# - Content import from existing accounts (optional, 5-10 min)
# - Configure your content strategy + preferences
# - Generate first sample post for calibration
```

### Joining a company (after Personal Hub exists)

```bash
# Team member received invite code from admin
claude /psn:setup join

# - Enter invite code (e.g., acme-7x9k2m)
# - System validates code, registers you in company team_members
# - Company Hub credentials saved to config/connections/acme-corp.env
# - Configure brand voice profiles (or defer to later)
```

### Creating a Company Hub (admin)

```bash
claude /psn:setup hub

# This walks through (one-time, ~10 minutes):
# - Create a Trigger.dev Cloud project (separate from personal)
# - Create a Neon Postgres database (free tier, one command)
# - Deploy company automation tasks
# - Configure company social accounts (OAuth flows)
# - Set up approval workflow and calendar settings
# - Creates config/company/<name>.yaml
# - Saves connection to config/connections/<name>.env
# - Generates invite codes for the team (one-time use, 7-day expiry)
#   Share the code, not raw credentials. e.g.: acme-7x9k2m
```

### User with multiple companies

```bash
# Personal Hub already exists from initial /psn:setup

# Join Company A (as team member)
claude /psn:setup join
# → enter acme invite code → config/connections/acme-corp.env created

# Create Company B (as admin)
claude /psn:setup hub
# → creates Company B Hub → config/connections/my-startup.env created

# Result: hub.env (personal) + connections/acme-corp.env + connections/my-startup.env
# Voice profiling runs for personal first, brand voices added via /psn:setup voice later
```

### API Keys Required (BYOK)

| Key | Purpose | Required? | Who provides it |
|---|---|---|---|
| Claude API key | Content generation (used by Claude Code) | Yes (already have it) | User |
| X API key + secret | Post to X, read analytics | Yes for X | User or company admin |
| LinkedIn client ID + secret | Post to LinkedIn | Yes for LinkedIn | User or company admin |
| Meta app ID + secret | Post to Instagram | Yes for Instagram | User or company admin |
| TikTok client key + secret | Post to TikTok | Yes for TikTok | User or company admin |
| Image generation API key | Generate images for posts | Optional | User |
| Video generation API key | Generate video for posts | Optional | User |
| Trigger.dev API key | Connect to Company Hub tasks | Yes | Company admin (or self-created) |
| Database connection string | Connect to Hub database (Neon Postgres) | Yes | Company admin (or self-created) |
| WAHA URL or Twilio credentials | WhatsApp notifications | Optional | Company admin |
| Perplexity API key | On-demand trend research | Optional (enhances ideation) | User |
| Exa API key | Semantic content search | Optional (enhances ideation) | User |
| Tavily API key | Agent-friendly web search | Optional (enhances ideation) | User |

---

## Content Strategy System

### Strategy Auto-Generation (during `/psn:setup`)

`/psn:setup` generates a complete `strategy.yaml` based on the voice interview — users don't configure it manually.

Claude infers from the interview:
- **Content pillars**: derived from expertise, industry, and audience. "You build developer tools → Technical Insights, Building in Public, Industry Commentary." User sees the result and can adjust, but never fills in percentages from scratch.
- **Platform selection**: recommended based on audience + industry. "B2B SaaS audience → X + LinkedIn are your highest-ROI platforms. Instagram and TikTok can be enabled later." Disabled platforms have `enabled: false` — zero cost, zero noise.
- **Posting frequency**: starts conservative (see Smart Frequency Ramping below). Never starts at target frequency.
- **Pillar percentages, archetype mix, posting times**: all auto-generated with sensible defaults for the industry.
- **Engagement settings**: conservative defaults (lower caps, wider cooldowns).

User sees a strategy summary: "Here's your starting strategy based on our conversation." They can tweak any value or accept as-is. `/psn:review` is where they revisit and adjust over time — not `/psn:setup`.

### `config/strategy.yaml` (per user)

```yaml
identity:
  name: "Your Name"
  role: "CEO at Acme Corp"
  topics: ["AI", "startups", "product development"]
  audience: "developers and technical founders"
  languages: [en, es]           # Supported: en, es. First = default.

platforms:
  x:
    enabled: true
    handle: "@yourhandle"
    account_type: personal
    target_frequency: "1-2/day"
    current_frequency: "3/week"     # auto-managed, starts conservative
    ramp_rate: auto
    content_focus: ["hot takes", "threads", "engagement"]
    languages: [en, es]          # Languages available on this platform
    default_language: en         # Default when not specified
  linkedin:
    enabled: true
    handle: "company/your-company"
    account_type: company
    target_frequency: "4/week"
    current_frequency: "2/week"     # auto-managed, starts conservative
    ramp_rate: auto
    content_focus: ["carousels", "personal stories", "build in public"]
    languages: [en, es]
    default_language: en
  instagram:
    enabled: true
    handle: "@yourhandle"
    account_type: business
    target_frequency: "3/week"
    current_frequency: "1/week"     # auto-managed, starts conservative
    ramp_rate: auto
    content_focus: ["reels", "carousels"]
    languages: [en]
    default_language: en
  tiktok:
    enabled: false
    handle: "@yourhandle"
    languages: [en]
    default_language: en

content_pillars:
  - name: "AI insights"
    percentage: 35
    description: "Technical insights about AI, practical applications, myth-busting"
  - name: "Founder journey"
    percentage: 30
    description: "Behind-the-scenes, failures, lessons learned, build in public"
  - name: "Engagement"
    percentage: 20
    description: "Questions, polls, debates, responding to trends"
  - name: "Product"
    percentage: 15
    description: "Product updates, case studies, customer stories"

goals:
  primary: "Establish thought leadership in AI dev tools space"
  follower_target: "10K across platforms in 6 months"
  engagement_target: "3% average engagement rate"

engagement:
  enabled: true
  daily_caps:
    x_replies: 10
    linkedin_comments: 5
    tiktok_stitches: 1
    instagram_comments: 5
  monitoring:
    active_hours: "08:00-20:00"
    check_frequency: "10min"
  safety:
    never_auto_post: true
    min_seconds_between_replies: 300
    never_reply_to_same_account_twice_daily: true
    blocklist: []
  targeting:
    min_author_followers: 5000
    max_post_age_minutes: 30
    prefer_debatable_takes: true

notifications:
  enabled: true
  provider: whatsapp
  push_sensitivity: medium
  quiet_hours:
    start: "22:00"
    end: "07:00"
    timezone: "America/New_York"
  morning_digest:
    enabled: true
    time: "07:30"
  react_now_alerts:
    enabled: true
    max_per_day: 3
    min_relevance_score: 70
  engage_alerts:
    enabled: true
    max_per_day: 3
```

### Strategy Iteration Loop

1. User runs `/psn:plan` weekly → ideation fills idea bank with trend-aware, voice-calibrated ideas, then batch generation pulls from idea bank + series + generates for gaps
2. Hub's `trend-collector` gathers intelligence daily → `analytics-collector` collects metrics daily
3. User runs `/psn:review` weekly → Claude analyzes what worked, updates preference model, proposes adjustments, generates report
4. Strategy.yaml + voice profiles updated → next cycle reflects new approach
5. **The system gets smarter every cycle** — edit rates decrease, engagement increases, content feels more "you"

---

## Phased Rollout

These phases are a loose guideline — scope and ordering will be refined during planning. The goal is to ship something usable fast and iterate.

### Phase 1a: Post to X (minimum viable loop)
- `/psn:setup` — creates Personal Hub (Neon DB + Trigger.dev), connects X account, basic voice profile (interview only, no import)
- `/psn:post` command for X (text-only)
- Personal voice profile only (no brand-operator/ambassador yet)
- Basic `strategy.yaml` configuration
- `post-scheduler` task (Personal Hub Trigger.dev)
- Personal Hub Neon Postgres DB setup + Drizzle ORM schema
- Drizzle Kit migration infrastructure (migration files bundled with repo, `/psn:setup` runs pending migrations)
- Content queue in Personal Hub DB

### Phase 1b: LinkedIn + full voice profiling
- `/psn:post` extended to LinkedIn
- Full personal voice profile (interview + content import + calibration mode)
- `token-refresher` task (daily cron — LinkedIn tokens expire every 60 days)
- Edit tracking (foundation for learning loop)

### Phase 2: Planning + idea bank + series data model
- `/psn:plan` command: ideation phase with on-demand research (Perplexity, Exa, Tavily, Brave) + batch generation phase
- `/psn:capture` command for quick idea capture (save or post now)
- Idea bank in Personal Hub DB
- Idea maturity stages (spark → seed → ready → used/killed)
- `/psn:post` pulls from idea bank, offers mini-ideation when no topic provided
- `trend-collector` task (daily cron — HN, Reddit, PH, RSS, Google Trends)
- `analytics-collector` task (daily cron — pulls metrics from platform APIs, writes to Hub DB `analytics` table, scores posts)
- Preference model v1 (engagement scoring, edit pattern tracking)
- Series DB table + config schema (`config/series/*.yaml`) — data model only, so `/psn:plan` and `/psn:post` can be series-aware from the start

### Phase 3: Company Hub + rich media + series management
- Company Hub setup (`/psn:setup hub`) — separate Trigger.dev + Neon DB + invite code flow
- `/psn:setup join` — connect to existing Company Hub via invite code, saves to `config/connections/<company>.env`
- Company content queue via Company Hub (`posts` table + delayed run timers)
- Brand-operator and brand-ambassador voice profiles (requires company context)
- `/psn:approve` command querying Company Hub for pending posts (with calendar context)
- Approval workflow (submit → notify → approve/reject → reschedule/cancel)
- Company idea bank (Company Hub DB `ideas` table) with team surfacing
- Company brand preference model (Company Hub DB `brand_preferences` table)
- RLS policies for per-user data isolation in Company Hub
- Cross-Hub reads for Brand Ambassador posting (personal model + company model)
- `/psn:calendar` command (merges Personal Hub + all connected Company Hubs)
- `/psn:series` command (create, manage, pause, retire)
- Company series via Company Hub (shared, rotation support)
- Image generation integration
- `/psn:post` gains semi-automated format support (brain picks video/recording formats when appropriate)

### Phase 4: Review command + advanced learning loop
- `/psn:review` command: Claude-powered performance analysis + strategy adjustments in one session
- Advanced learning loop: fatigue detection, monthly deep analysis (auto-escalated), explicit feedback prompts, autonomous adjustment engine
- Preference model auto-updates (weekly during `/psn:review`, monthly deep analysis auto-escalated)
- Content fatigue detection
- Weekly/monthly report generation

### Phase 5: Platform expansion + calendar intelligence
- Instagram and TikTok platform support
- Calendar conflict detection (across Personal + Company Hubs)
- `/psn:setup disconnect` — cleanly remove a Company Hub connection

### Phase 6: Notifications + engagement engine
- WhatsApp notifications via WAHA (all tiers: push, digest, standard)
- `/psn:config` for notification and engagement preferences
- `whatsapp-handler` task (structured command parsing, conversation state machine)
- `trend-alerter` task (relevance scoring, angle generation, push notifications)
- `engagement-monitor` task (platform-aware: X search API, IG hashtags, optional TikTok via EnsembleData)
- `/psn:capture` gains WhatsApp notification context (pre-loaded trends for fast reaction)
- `/psn:engage` command (proactive reply sessions with bridge to `/psn:post`)
- Notification fatigue prevention (caps, cooldowns, feedback loop)
- Company-level notification routing

### Phase 7: Employee advocacy + scaling
- Team onboarding workflows (streamlined `/psn:setup` for new members)
- Competitive intelligence learning (monitored accounts, gap analysis)
- Suggested content based on company milestones
- Team analytics and leaderboard (opt-in, from Hub DB)
- Content template library (if preference model structural tracking proves insufficient, formalize winning structures as reusable templates)
- Content remixing pipeline (one idea → multi-platform content atoms)

### Future: Claude-powered WhatsApp chatbot
- Replace structured WhatsApp commands with Claude natural language parsing
- Same state machine and DB schema — only parsing layer changes
- Enables free-form interaction ("go with the second one but punchier")

### Future: Cloud media storage
- Move media from local git to cloud storage (S3/Cloudflare R2)
- Git repo stays lightweight (text-only)
- Media referenced by URL in post metadata

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI-generated content feels like "AI slop" | Audience ignores/unfollows, algorithms suppress | Voice profiles capture real voice patterns. Learning loop reduces edit rate over time. Human-in-the-loop review on every post. Content import bootstraps voice from existing writing. |
| Platform API changes (rate limits, pricing, deprecations) | Posts fail, analytics break | Abstract platform APIs behind a unified interface. Monitor platform changelogs. Graceful degradation. |
| LinkedIn/TikTok approval takes weeks | Can't use these platforms at launch | Start X first (easiest API access), apply for LinkedIn/TikTok immediately, add them when approved. |
| OAuth tokens expire silently | Scheduled posts fail | `token-refresher` Trigger.dev task checks daily, notifies 7 days before expiry. |
| Team members don't actually use it | No growth | Keep friction absurdly low. Voice profiling makes content feel personal. Idea bank pre-loads ideas. Leadership uses it first. |
| Content calendar conflicts for company accounts | Duplicate/overlapping posts | Company calendar lives in the Hub (single source of truth). Conflict detection before scheduling. Idea claiming prevents duplicate work. |
| X pay-per-use API costs | Minor cost (~$2-5/mo) | Pay-per-use launched Jan 2026. Post + read analytics for fractions of a cent each. Budget-friendly for all users. |
| Notification fatigue | Users disable all notifications | Hard caps, cooldowns, feedback loop, configurable sensitivity. System auto-reduces if user ignores notifications. |
| Automated engagement gets account banned | Account restricted or suspended | Semi-automated only — human approves every reply. Volume caps. Natural timing (min 5 min between). Never auto-post. |
| Voice profile doesn't capture real voice | Content feels generic, high edit rate | Deep interview + content import + calibration period. Learning loop continuously refines. Explicit recalibration when edit rate rises. |
| Intelligence APIs change pricing or shut down | Ideation quality degrades | Multiple redundant sources (Perplexity, Exa, Tavily, Brave). Free tier sources (HN, Reddit, RSS) work as baseline. System degrades gracefully. |
| Idea bank becomes a graveyard | Stale ideas nobody looks at | Maturity stages force ideas to move forward or die. System nudges development. Timely ideas auto-expire. Killed ideas feed learning. |

---

## Success Metrics

### For the system itself
- Percentage of team members who post at least 1x/week
- Time from "I should post" to "post is scheduled" (target: < 2 minutes for `/psn:post`, < 20 minutes for `/psn:plan`)
- Post generation quality (measured by user edit rate — target: < 20% after calibration)
- Voice profile accuracy (edit rate trend over time — should decrease)
- Idea bank health (ratio of ideas matured vs. killed, time-to-development)
- React-to-notification time (target: < 10 minutes for timely content)

### For social media growth
- Follower growth rate per platform per account
- Engagement rate trend (should increase as learning loop iterates)
- Content pillar performance distribution
- Non-follower reach percentage (discovery metric)
- Reply/engagement-driven profile visits and follows
- Series performance vs. non-series content

