# Requirements: Post Shit Now

**Defined:** 2026-02-18
**Core Value:** Make posting so frictionless that people who rarely post become consistent creators — one command to generate, review, and schedule a post in their authentic voice.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Setup & Infrastructure

- [ ] **SETUP-01**: User can create a Personal Hub (Neon Postgres + Trigger.dev Cloud) via `/psn:setup` in under 10 minutes
- [ ] **SETUP-02**: User can connect personal social media accounts via OAuth2 flows during setup
- [ ] **SETUP-03**: User can configure API keys (image generation, intelligence APIs) during setup
- [ ] **SETUP-04**: User can deploy Trigger.dev tasks to their Personal Hub from the repo
- [ ] **SETUP-05**: Database migrations run automatically via Drizzle Kit during setup
- [ ] **SETUP-06**: Hub credentials stored in gitignored config files (hub.env, keys.env)
- [ ] **SETUP-07**: Strategy.yaml auto-generated from voice interview (content pillars, platform selection, posting frequency, engagement settings)

### Voice Profiling

- [ ] **VOICE-01**: User completes a voice profiling interview via `/psn:setup voice` that captures identity, expertise, audience, voice patterns, and platform preferences
- [ ] **VOICE-02**: System generates personal.yaml voice profile with language-agnostic traits and language-specific sections (en)
- [ ] **VOICE-03**: Voice profile includes reply_style section for engagement (shorter, more casual than posts)
- [ ] **VOICE-04**: System supports content import from existing social accounts (X history, LinkedIn posts, blog URLs) to bootstrap voice profile
- [ ] **VOICE-05**: Calibration mode runs for first 5-10 posts, tracking edit distance and presenting calibration report
- [ ] **VOICE-06**: Blank-slate users get personality-first interview (shorter, archetype suggestions, more aggressive calibration every 3 posts)

### Content Creation

- [ ] **POST-01**: User can create and schedule a post for X via `/psn:post`
- [ ] **POST-02**: User can create and schedule a post for LinkedIn via `/psn:post`
- [ ] **POST-03**: User can create and schedule a post for Instagram via `/psn:post`
- [ ] **POST-04**: User can create and schedule a post for TikTok via `/psn:post`
- [ ] **POST-05**: Generated content matches active persona's voice profile exactly, using correct language-specific voice section
- [ ] **POST-06**: Content is platform-specific (X threads vs LinkedIn carousels vs Instagram reel scripts vs TikTok concepts)
- [ ] **POST-07**: Content brain picks optimal format based on platform, topic, and preference model data
- [ ] **POST-08**: Before asking for topic, system checks idea bank for ready ideas matching platform + persona
- [ ] **POST-09**: If no topic and no ready ideas, system offers 3 quick suggestions (mini-ideation)
- [ ] **POST-10**: User can provide URL, screenshot, or raw thought as input material
- [ ] **POST-11**: Every user edit is tracked for the learning loop (tagged with language)
- [ ] **POST-12**: Semi-automated formats supported: video scripts, TikTok stitch concepts, podcast clip suggestions — saved to content/drafts/ with `/psn:post finish` to package and schedule
- [ ] **POST-13**: Personal posts write to Personal Hub DB and trigger Trigger.dev delayed run
- [ ] **POST-14**: Company posts submit to Company Hub as pending-approval Trigger.dev run
- [ ] **POST-15**: Posts include hashtags, timing recommendation, and media suggestion per voice profile preferences

### Scheduling & Calendar

- [ ] **SCHED-01**: Posts scheduled via Trigger.dev delayed runs at specific datetime
- [ ] **SCHED-02**: User can view upcoming posts across personal and all connected companies via `/psn:calendar`
- [ ] **SCHED-03**: Calendar shows series slots as recurring anchors
- [ ] **SCHED-04**: Empty calendar slots show matching ready ideas as suggestions
- [ ] **SCHED-05**: User can reschedule, edit, or delete scheduled posts
- [ ] **SCHED-06**: Company calendar shows who's posting when to avoid overlap
- [ ] **SCHED-07**: User can claim open company slots via `/psn:calendar claim`

### Weekly Planning

- [ ] **PLAN-01**: User can run weekly planning session via `/psn:plan` combining ideation, generation, and scheduling
- [ ] **PLAN-02**: System shows current week's calendar state (scheduled, series due, gaps) at start
- [ ] **PLAN-03**: Ideation phase checks stored trend data, fires real-time searches, reviews recent analytics, checks competitor activity, checks idea bank, considers series due dates, checks content fatigue tracker
- [ ] **PLAN-04**: System generates 10-15 ideas with angles (concept + hook + format suggestion)
- [ ] **PLAN-05**: Ideas mixed with existing ready ideas from appropriate Hub and team ideas (for company)
- [ ] **PLAN-06**: User rates ideas: love it / maybe later / kill it — with reasons recorded for killed ideas
- [ ] **PLAN-07**: Series installments auto-slotted first, then ready ideas fill gaps, then new posts generated
- [ ] **PLAN-08**: Content balanced across pillars and archetypes for the week
- [ ] **PLAN-09**: User can bail at any phase (ideate only, generate without scheduling, etc.)

### Quick Capture

- [ ] **CAPT-01**: User can save URLs, screenshots, text snippets, or raw thoughts via `/psn:capture`
- [ ] **CAPT-02**: System analyzes input and classifies as timely (needs action now) or evergreen (save for later)
- [ ] **CAPT-03**: Timely items offer immediate post generation (target: under 3 minutes)
- [ ] **CAPT-04**: Evergreen items saved as sparks in idea bank with minimal metadata
- [ ] **CAPT-05**: System asks personal or company to route correctly

### Idea Bank

- [ ] **IDEA-01**: Ideas stored in Hub DB with 7-stage maturity pipeline (spark/seed/ready/claimed/developed/used/killed)
- [ ] **IDEA-02**: Ideas have urgency classification (timely/seasonal/evergreen) with expiry dates
- [ ] **IDEA-03**: Timely ideas that expire auto-killed
- [ ] **IDEA-04**: Ideas surface contextually during `/psn:plan`, `/psn:post`, and `/psn:approve`
- [ ] **IDEA-05**: Team members can claim company ideas (locked to prevent duplicate work)
- [ ] **IDEA-06**: Ideas can be promoted from Personal Hub to Company Hub
- [ ] **IDEA-07**: Killed ideas with reasons feed back into preference model

### Intelligence Layer

- [ ] **INTEL-01**: Daily scheduled collection from free sources: HN, Reddit, Product Hunt, Google Trends RSS, RSS feeds, newsletters (trend-collector task)
- [ ] **INTEL-02**: Lighter poll every 2-4 hours during business hours for breaking news (HN front page + X trending)
- [ ] **INTEL-03**: On-demand research via Perplexity, Exa, Tavily, Brave during `/psn:plan`
- [ ] **INTEL-04**: Trends scored by relevance to user's content pillars and stored in Hub DB
- [ ] **INTEL-05**: Competitor account monitoring with gap analysis (competitive-intel.yaml)
- [ ] **INTEL-06**: Instagram competitor monitoring via official Business Discovery API
- [ ] **INTEL-07**: X competitor monitoring via pay-per-use search API

### Analytics & Review

- [ ] **ANLYT-01**: Daily analytics collection from platform APIs via analytics-collector cron task
- [ ] **ANLYT-02**: Posts scored with composite engagement score (weighted: saves > shares > quality comments > follows > CTR > likes)
- [ ] **ANLYT-03**: User can run performance review via `/psn:review` showing what's working, what's not, trends vs previous periods
- [ ] **ANLYT-04**: Weekly review updates preference model (platform learnings, archetype performance, edit patterns, fatigue tracker)
- [ ] **ANLYT-05**: Monthly deep analysis auto-escalated: voice drift detection, audience model update, risk budget recalibration
- [ ] **ANLYT-06**: Per-series analytics tracked separately
- [ ] **ANLYT-07**: Reports saved to analytics/reports/ for reference

### Learning Loop

- [ ] **LEARN-01**: Edit distance and patterns tracked for every generated post
- [ ] **LEARN-02**: Preference model stored in Personal Hub DB (preference_models table) updated weekly
- [ ] **LEARN-03**: Company brand preference model stored in Company Hub DB (brand_preferences table)
- [ ] **LEARN-04**: Autonomous tactical adjustments: pillar percentages (capped ±5%/cycle), posting times, topic fatigue, hook/format preferences, archetype balance, hashtag strategy, content length, posting frequency (±1/week), risk budget (±0.05/cycle)
- [ ] **LEARN-05**: Identity-level changes require user confirmation: enabling/disabling platforms, persona boundaries, never-use vocabulary, retiring series, brand-operator voice changes, adding/removing pillars
- [ ] **LEARN-06**: Transparent changelog shown in weekly review ("what the brain changed this week")
- [ ] **LEARN-07**: User override is permanent — system respects reverted settings until user explicitly unlocks
- [ ] **LEARN-08**: Content fatigue tracker: topics and formats on cooldown with resume dates
- [ ] **LEARN-09**: Content recycling suggestions during `/psn:plan` for high-performing past content with fresh angles

### Engagement Engine

- [ ] **ENGAGE-01**: Engagement monitor task runs every 5-15 minutes during active hours, scoped to enabled platforms
- [ ] **ENGAGE-02**: Opportunities scored: relevance × author influence × post velocity × time window remaining
- [ ] **ENGAGE-03**: Score 70+: generate 2-3 reply drafts using voice profile's reply_style, push notify via WhatsApp
- [ ] **ENGAGE-04**: Score 60-69: queue for digest or surface during `/psn:engage`
- [ ] **ENGAGE-05**: User can run proactive engagement session via `/psn:engage` (top 5-10 opportunities, 15-minute focused session)
- [ ] **ENGAGE-06**: After engagement session, system bridges to content creation ("Any conversations spark a post idea?")
- [ ] **ENGAGE-07**: Safety: daily caps, cooldowns, blocklist, never auto-post, min 5 min between replies

### Content Series

- [ ] **SERIES-01**: User can create content series via `/psn:series create` with format, cadence, branding, platform, language
- [ ] **SERIES-02**: Series auto-slotted during `/psn:plan` and nudged during `/psn:post`
- [ ] **SERIES-03**: Series can be paused, resumed, and retired with analytics preserved
- [ ] **SERIES-04**: Company series support shared ownership with round-robin contributor rotation
- [ ] **SERIES-05**: System suggests formalizing a series when it detects recurring patterns

### Company Hub & Team

- [ ] **TEAM-01**: Admin can create a Company Hub via `/psn:setup hub` (separate Trigger.dev + Neon DB)
- [ ] **TEAM-02**: Admin can generate one-time, time-limited invite codes via `/psn:setup invite`
- [ ] **TEAM-03**: Team member can join a Company Hub via `/psn:setup join` with invite code
- [ ] **TEAM-04**: Brand-operator voice profile: company speaks, team member disappears
- [ ] **TEAM-05**: Brand-ambassador voice profile: personal voice + company context (cross-Hub read)
- [ ] **TEAM-06**: Approval workflow: submit → notify → approve/reject → reschedule/cancel via `/psn:approve`
- [ ] **TEAM-07**: RLS policies enforce per-user data isolation in Company Hub
- [ ] **TEAM-08**: Removing team member via RLS immediately blocks all their DB queries
- [ ] **TEAM-09**: User can disconnect from Company Hub via `/psn:setup disconnect` (personal data unaffected)

### Notifications

- [ ] **NOTIF-01**: WhatsApp notifications via WAHA (self-hosted) or Twilio, configurable per user
- [ ] **NOTIF-02**: Tier 1 push notifications (WhatsApp): trending topics 70+, engagement opportunities, content going viral, timely idea expiring, approval needed — max 3/day
- [ ] **NOTIF-03**: Tier 2 morning digest (WhatsApp): rising topics, series due, content gaps, stale sparks, competitor activity — adaptive to user journey stage
- [ ] **NOTIF-04**: Tier 3 standard notifications: post scheduled/published, approval results, weekly digest, token expiring
- [ ] **NOTIF-05**: Structured WhatsApp commands: R1/R2/R3, skip, approve, reject, edit, post, time, list, help
- [ ] **NOTIF-06**: Conversation state machine: IDLE → AWAITING_ACTION → CONFIRM_POST → IDLE
- [ ] **NOTIF-07**: Notification fatigue prevention: hard caps, 2-hour cooldowns, deduplication, feedback loop, smart throttling, focus modes

### OAuth & Token Management

- [ ] **AUTH-01**: OAuth2 flows for X, LinkedIn, Instagram (via Facebook), TikTok using Arctic library
- [ ] **AUTH-02**: Tokens stored encrypted (AES-256-GCM) in Hub DB oauth_tokens table
- [ ] **AUTH-03**: token-refresher task runs daily, refreshes tokens within 7 days of expiry
- [ ] **AUTH-04**: User notified via WhatsApp if token refresh fails
- [ ] **AUTH-05**: `/psn:setup tokens` for manual token refresh

### Media & Generation

- [ ] **MEDIA-01**: Image generation via GPT Image (versatile), Ideogram 3 (best text), Flux 2 (photorealistic)
- [ ] **MEDIA-02**: Multi-step media upload to all platforms (register → upload binary → attach to post)
- [ ] **MEDIA-03**: AI-generated image metadata stripped (EXIF/C2PA) before upload to avoid algorithm suppression
- [ ] **MEDIA-04**: Video generation via Kling, Runway, Pika for automated video content
- [ ] **MEDIA-05**: Sharp for image processing (resize for platform specs)

### Bilingual Support

- [ ] **LANG-01**: Per-post language choice: en, es, or both
- [ ] **LANG-02**: Voice profiles have language-specific sections (vocabulary, sentence patterns, opening/closing patterns, signature phrases)
- [ ] **LANG-03**: Bilingual posts (both) are independently crafted, not translations
- [ ] **LANG-04**: Preference model tracks performance per language
- [ ] **LANG-05**: Series have fixed language; bilingual creators run separate series per language

### Hub Tasks (Trigger.dev)

- [ ] **TASK-01**: post-scheduler: delayed run per post, reads from DB, uploads media, calls platform API, archives, notifies
- [ ] **TASK-02**: analytics-collector: daily cron, pulls metrics from platform APIs, writes to analytics table, scores posts
- [ ] **TASK-03**: trend-collector: daily cron + periodic polls, pulls from Layer 1 sources, scores by pillar relevance
- [ ] **TASK-04**: trend-alerter: after trend-collector, generates angles for high-scoring trends, triggers notifications
- [ ] **TASK-05**: engagement-monitor: every 5-15 min, platform-aware, finds viral posts, drafts replies, alerts user
- [ ] **TASK-06**: token-refresher: daily cron, checks token expiry, refreshes proactively, notifies on failure
- [ ] **TASK-07**: notifier: sends WhatsApp/email via configured provider, respects quiet hours and caps
- [ ] **TASK-08**: whatsapp-handler: webhook, parses structured commands, manages conversation state, executes actions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Claude-powered WhatsApp chatbot (natural language replacing structured commands)
- **ADV-02**: Cloud media storage (S3/Cloudflare R2) replacing local git media
- **ADV-03**: Content template library (formalized winning structures as reusable templates)
- **ADV-04**: Team analytics leaderboard (opt-in)
- **ADV-05**: Podcast clip extraction from long recordings
- **ADV-06**: Event live-posting templates
- **ADV-07**: Interview/Q&A preparation and editing

### Platform Expansion

- **PLAT-01**: Pinterest support
- **PLAT-02**: YouTube support
- **PLAT-03**: Facebook (organic) support

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / GUI | Contradicts CLI-first value proposition. Would split dev effort and compete on competitors' turf. |
| Social inbox / DM management | Massive complexity, better done in native apps. `/psn:engage` covers public replies. |
| Social listening / brand monitoring | Enterprise feature ($199-500+/mo). Intelligence layer provides targeted niche monitoring instead. |
| Auto-posting without review | Algorithm suppression of AI content + brand risk. Human-in-the-loop is the feature, not a limitation. |
| Visual content editor | Absurd in CLI. Use Canva/Figma + drop files into content/media/. |
| Link-in-bio / landing pages | Tangential to content creation. Users can use Linktree etc. |
| Ad management | Different domain (paid media vs organic). Different APIs and expertise. |
| Mobile app | CLI-first. WhatsApp integration is the mobile touchpoint. |
| Gamification / leaderboards for advocacy | Incentivizes volume over quality, creates "advocacy theater." |
| Chatbot / auto-DM sequences | Spammy, often violates platform ToS. |
| Languages beyond en/es | v1 is bilingual English + Spanish only. |
| Self-hosted database/Trigger.dev | Cloud managed services only for simplicity. |
| Offline/degraded mode | Not worth complexity for 99.9%+ uptime services. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated during roadmap creation) | | |

**Coverage:**
- v1 requirements: 99 total
- Mapped to phases: 0
- Unmapped: 99

---
*Requirements defined: 2026-02-18*
*Last updated: 2026-02-18 after initial definition*
