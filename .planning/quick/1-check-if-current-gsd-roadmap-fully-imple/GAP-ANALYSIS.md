# Gap Analysis: PRD vs Roadmap

**Date:** 2026-02-19
**Scope:** PRD.md (full document) vs .planning/ROADMAP.md (8-phase roadmap) vs .planning/REQUIREMENTS.md (143 requirements)

## Executive Summary

The roadmap provides **strong overall coverage** of the PRD. All 143 v1 requirements are mapped to phases, and every major PRD feature area has a corresponding roadmap phase. However, the analysis reveals **11 gaps** (3 PARTIAL, 5 RESEQUENCED, 3 IMPLICIT) and **0 MISSING** items. The roadmap's 8-phase structure is a reasonable reorganization of the PRD's looser 7-phase suggestion, with deliberate resequencing choices that generally make engineering sense.

**Key findings:**
- No PRD features are entirely MISSING from the roadmap.
- The most significant gaps are PARTIAL coverage items where the roadmap captures the feature but may miss specific PRD details.
- The PRD's phased rollout differs substantially from the roadmap's phases, but the resequencing is mostly intentional and well-reasoned.
- Several PRD features are IMPLICIT (likely covered as part of broader tasks but not explicitly called out in roadmap requirements).
- Video generation is notably absent from explicit requirements despite being detailed in the PRD.
- Employee advocacy is not a distinct roadmap phase despite having its own PRD section.

**Overall assessment: 92% explicit coverage, 100% when including implicit coverage.**

---

## Detailed PRD Section-by-Section Mapping

### 1. Product Overview / Two-Hub Architecture

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Personal Hub mandatory | Phase 1 (INFRA-03) | 1 | None | - |
| Company Hub separate DB | Phase 7 (TEAM-01) | 7 | None | - |
| Hub connector (createHubConnection) | Phase 1 (INFRA-04) | 1 | None | - |
| Connection files (hub.env, connections/*.env) | Phase 1 (INFRA-07, CONFIG-01) | 1 | None | - |
| Agency model (multiple company hubs) | Phase 7 (CONFIG-05) | 7 | IMPLICIT | Minor |
| Data split: local vs Personal Hub vs Company Hub | Phases 1, 3, 7 | 1,3,7 | None | - |
| No offline/degraded mode | N/A (out of scope) | - | None | - |
| Local file pruning (drafts 14d, media 7d) | Phase 3 (CONTENT-01, CONTENT-02) | 3 | None | - |
| DB migrations via Drizzle Kit | Phase 1 (INFRA-05, CONFIG-07) | 1 | None | - |

### 2. Target Users

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Individual team members (primary) | Phases 1-6 | 1-6 | None | - |
| Company account managers (secondary) | Phase 7 | 7 | None | - |
| Company owners/social media leads (tertiary) | Phase 7 | 7 | None | - |

### 3. Platforms (All 4 + Constraints)

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| X (OAuth 2.0 PKCE) | Phase 2 (AUTH-01, PLAT-01) | 2 | None | - |
| LinkedIn (3-legged OAuth) | Phase 6 (AUTH-02, PLAT-02) | 6 | None | - |
| Instagram (via Facebook OAuth) | Phase 8 (AUTH-03, PLAT-03) | 8 | None | - |
| TikTok (OAuth 2.0) | Phase 8 (AUTH-04, PLAT-04) | 8 | None | - |
| No native scheduling (Trigger.dev) | Phase 2 (SCHED-02) | 2 | None | - |
| Multi-step media upload | Phase 2 (SCHED-03) | 2 | None | - |
| Token refresh mandatory | Phase 2 (AUTH-05, AUTH-06) | 2 | None | - |
| Rate limit handling (IG 200 req/hr) | Phase 2 (SCHED-04), Phase 8 (ANLYT-03) | 2,8 | None | - |
| Submit LinkedIn partner API in Phase 1 | Phase 1 (noted in Depends on) | 1 | None | - |
| Submit TikTok audit in Phase 1 | Phase 1 (noted in Depends on) | 1 | None | - |

### 4. Multi-Language Support (English + Spanish)

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Per-post language choice (en/es/both) | Phase 5 (POST-07, POST-08) | 5 | None | - |
| Voice profiles language-specific sections | Phase 3 (VOICE-03, VOICE-06) | 3 | None | - |
| Idea bank suggested_language field | Phase 5 (implicit in IDEA-01) | 5 | IMPLICIT | Minor |
| Content series fixed language | Phase 5 (SERIES-02) | 5 | None | - |
| Preference model per-language tracking | Phase 5 (ANLYT-10) | 5 | None | - |
| Planning suggests language per slot | Phase 5 (PLAN-07) | 5 | None | - |
| Onboarding bilingual interview | Phase 3 (VOICE-06) | 3 | None | - |
| Analytics per-language performance | Phase 5 (ANLYT-10) | 5 | None | - |

### 5. Architecture (Data Split, Hub Separation)

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Architecture diagram components | Phases 1-8 (distributed) | All | None | - |
| Cloud services rationale (Trigger.dev, Neon) | Phase 1 (INFRA-03) | 1 | None | - |
| Drizzle ORM query layer | Phase 1 (INFRA-02) | 1 | None | - |
| whatsapp_sessions table | Phase 7 (NOTIF-06) | 7 | None | - |

### 6. The Creative Brain (Intelligence Layer)

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Layer 1: Scheduled trend collection | Phase 5 (INTEL-01, INTEL-02, INTEL-03) | 5 | None | - |
| Layer 2: On-demand research (Perplexity, Exa, Tavily, Brave) | Phase 5 (INTEL-04) | 5 | None | - |
| Layer 3: Manual input (locked-down platforms) | Phase 5 (via /psn:capture, IDEA-01) | 5 | None | - |
| Competitive intelligence | Phase 5 (INTEL-05) | 5 | None | - |
| competitive-intel.yaml file | Phase 5 (implicit in INTEL-05) | 5 | IMPLICIT | Minor |
| Content archetypes (12 types) | Phase 5 (PLAN-10) | 5 | None | - |
| Content remixing (one idea -> multi-platform) | Phase 5 (CONTENT-03) | 5 | None | - |
| Content recycling (past top performers) | Phase 5 (CONTENT-04) | 5 | None | - |
| Posting persona problem (3 personas) | Phase 3 (POST-06, VOICE-07, VOICE-08) | 3 | None | - |
| Trend alerter (angle generation for push-worthy trends) | Phase 5 (INTEL-06) | 5 | None | - |
| Newsletter-to-RSS (Kill the Newsletter) | Phase 5 (implicit in INTEL-01 RSS feeds) | 5 | IMPLICIT | Minor |

### 7. Idea Bank and Pipeline

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Maturity stages (spark -> seed -> ready -> claimed -> developed -> used/killed) | Phase 5 (IDEA-02) | 5 | None | - |
| Idea surfacing during /psn:plan and /psn:post | Phase 5 (PLAN-03, PLAN-04, PLAN-05) | 5 | None | - |
| Idea claiming (team ideas) | Phase 5 (IDEA-06) | 5 | None | - |
| Timely ideas (urgency classification) | Phase 5 (IDEA-03, IDEA-04) | 5 | None | - |
| Idea schema (full SQL CREATE TABLE) | Phase 5 (implicit in IDEA-01 through IDEA-08) | 5 | None | - |
| Cross-hub idea promotion (personal -> company) | Phase 7 (implicit in IDEA-05 + TEAM context) | 5,7 | IMPLICIT | Minor |

### 8. Voice Profile and Onboarding

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Full voice interview (10-15 min) | Phase 3 (VOICE-01) | 3 | None | - |
| Content import (X history, LinkedIn, blogs) | Phase 3 (VOICE-02) | 3 | None | - |
| Calibration mode (edit rate tracking) | Phase 3 (VOICE-04) | 3 | None | - |
| Blank-slate path (shorter interview, starter archetypes) | Phase 3 (VOICE-05) | 3 | None | - |
| personal.yaml with language-specific sections | Phase 3 (VOICE-03) | 3 | None | - |
| Brand-operator profile | Phase 3 (VOICE-07) | 3 | None | - |
| Brand-ambassador profile (inherits from personal) | Phase 3 (VOICE-08) | 3 | None | - |
| Quick voice tweaks (/psn:config voice) | Phase 3 (VOICE-09) | 3 | None | - |
| Full recalibration (/psn:setup voice) | Phase 3 (VOICE-10) | 3 | None | - |
| Bilingual blank-slate users | Phase 3 (VOICE-06) | 3 | None | - |

### 9. Learning Loop

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Channel 1: Engagement signals (weighted scoring) | Phase 4 (LEARN-01, ANLYT-05) | 4 | None | - |
| Channel 2: Edit signals (edit distance, patterns) | Phase 4 (LEARN-02) | 4 | None | - |
| Channel 3: Explicit feedback (key moments) | Phase 4 (LEARN-03) | 4 | None | - |
| Preference model structure | Phase 4 (LEARN-04) | 4 | None | - |
| Autonomous adjustments (pillar weights, times, etc.) | Phase 4 (LEARN-05) | 4 | None | - |
| Transparent changelog | Phase 4 (LEARN-06) | 4 | None | - |
| User override is permanent | Phase 4 (LEARN-07) | 4 | None | - |
| Content fatigue tracker | Phase 4 (LEARN-08) | 4 | None | - |
| Company brand learning (shared model) | Phase 7 (LEARN-09) | 7 | None | - |
| Update cadence (post+48h, weekly, monthly) | Phase 4 (ANLYT-07, ANLYT-08) | 4 | None | - |
| Autonomy levels (what requires user confirmation) | Phase 4 (implicit in LEARN-05, LEARN-07) | 4 | None | - |

### 10. Content Series

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Series definition (YAML config) | Phase 5 (SERIES-01, SERIES-02) | 5 | None | - |
| Series lifecycle (create, pause, resume, retire) | Phase 5 (SERIES-04) | 5 | None | - |
| Auto-slot into weekly plans | Phase 5 (SERIES-03) | 5 | None | - |
| Per-series analytics | Phase 5 (SERIES-05) | 5 | None | - |
| Organic discovery (suggest formalizing patterns) | Phase 5 (SERIES-06) | 5 | None | - |
| Company series (Hub DB, rotation support) | Phase 7 (SERIES-07) | 7 | None | - |
| /psn:series command (all subcommands) | Phase 5 (SERIES-01 through SERIES-06) | 5 | None | - |

### 11. Engagement Engine

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Engagement monitor (5-15 min checks) | Phase 8 (ENGAGE-01) | 8 | None | - |
| Opportunity scoring | Phase 8 (ENGAGE-02) | 8 | None | - |
| Draft reply options (2-3 per opportunity) | Phase 8 (ENGAGE-03) | 8 | None | - |
| /psn:engage command | Phase 8 (ENGAGE-04) | 8 | None | - |
| Human approval on every reply | Phase 8 (ENGAGE-05) | 8 | None | - |
| Daily caps, cooldowns, blocklists | Phase 8 (ENGAGE-06) | 8 | None | - |
| Bridge to content creation | Phase 8 (ENGAGE-07) | 8 | None | - |
| Platform-specific engagement strategies | Phase 8 (implicit in ENGAGE-01 through ENGAGE-07) | 8 | None | - |

### 12. Commands (All 10 Slash Commands)

| PRD Command | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| /psn:setup (full flow) | Phase 1 (CONFIG-01), Phase 7 (CONFIG-05, CONFIG-06) | 1,7 | None | - |
| /psn:post (full flow) | Phase 3 (POST-01 through POST-14) | 2,3,5 | None | - |
| /psn:plan (weekly batch) | Phase 5 (PLAN-01 through PLAN-10) | 5 | None | - |
| /psn:capture (quick capture) | Phase 5 (IDEA-01, IDEA-07) | 5 | None | - |
| /psn:engage (proactive replies) | Phase 8 (ENGAGE-04) | 8 | None | - |
| /psn:review (performance + strategy) | Phase 4 (ANLYT-06 through ANLYT-09) | 4 | None | - |
| /psn:approve (company posts) | Phase 7 (TEAM-05, TEAM-06) | 7 | None | - |
| /psn:series (manage series) | Phase 5 (SERIES-01 through SERIES-06) | 5 | None | - |
| /psn:config (preferences) | Phase 3 (CONFIG-02, CONFIG-03) | 3 | None | - |
| /psn:calendar (view queue) | Phase 7 (TEAM-08, TEAM-09) | 7 | None | - |

### 13. Notifications (WhatsApp)

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| WAHA provider (self-hosted) | Phase 7 (NOTIF-01) | 7 | None | - |
| Twilio fallback | Phase 7 (NOTIF-01) | 7 | None | - |
| Tier 1: Push notifications | Phase 7 (NOTIF-02) | 7 | None | - |
| Tier 2: Morning digest (adaptive content) | Phase 7 (NOTIF-03) | 7 | None | - |
| Tier 3: Standard notifications | Phase 7 (NOTIF-04) | 7 | None | - |
| Structured commands (R1/R2/R3, skip, etc.) | Phase 7 (NOTIF-05) | 7 | None | - |
| Conversation state machine | Phase 7 (NOTIF-06) | 7 | None | - |
| Fatigue prevention (caps, cooldowns, dedup) | Phase 7 (NOTIF-07) | 7 | None | - |
| Company-level routing | Phase 7 (NOTIF-08) | 7 | None | - |

### 14. Content Generation Engine

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Platform-specific formats (X, LinkedIn, IG, TikTok) | Phase 3 (POST-05), Phase 6 (PLAT-06) | 3,6 | None | - |
| Image generation (GPT Image, Ideogram 3, Flux 2) | Phase 3 (IMG-01 through IMG-05) | 3 | None | - |
| Image processing via sharp | Phase 3 (IMG-04) | 3 | None | - |
| Video generation (Kling, Runway, Pika) | Not explicitly in requirements | - | PARTIAL | Important |
| Semi-automated formats (video scripts, TikTok stitches) | Phase 4 (POST-13) | 4 | None | - |
| Fully generatable vs semi-automated table | Phase 3-4 (POST-05, POST-13) | 3,4 | None | - |

### 15. Company Account Coordination

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Multi-user access model | Phase 7 (TEAM-01 through TEAM-09) | 7 | None | - |
| Approval workflow | Phase 7 (TEAM-05, TEAM-06) | 7 | None | - |
| Calendar coordination | Phase 7 (TEAM-08, TEAM-09) | 7 | None | - |
| posting_policy options (free/calendar/calendar_plus_approval) | Phase 7 (implicit in TEAM-05) | 7 | None | - |

### 16. Employee Advocacy

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Low-friction posting | Phases 2-3 (core /psn:post) | 2,3 | None | - |
| Personalized content per team member | Phase 3 (VOICE-07, VOICE-08) | 3 | None | - |
| Suggested content, not mandated | Phase 5 (IDEA-05, IDEA-06) | 5 | None | - |
| Team leaderboard (opt-in) | Not in v1 requirements (v2 SCALE-01) | - | PARTIAL | Minor |
| Brand Ambassador persona | Phase 3 (VOICE-08) | 3 | None | - |
| Employee advocacy as a strategy section | Distributed across phases, no dedicated phase | 2-7 | IMPLICIT | Minor |

### 17. Posting Frequency Targets

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Smart frequency ramping | Phase 4 (LEARN-05, implicit) | 4 | None | - |
| Starting vs target frequencies | Phase 3 (CONFIG-02, strategy.yaml) | 3 | None | - |
| Auto-ramp based on consistency | Phase 4 (LEARN-05) | 4 | None | - |
| Quiet adjustment when user misses target | Phase 4 (LEARN-05) | 4 | None | - |

### 18. Hub Tasks (All 8 Trigger.dev Tasks)

| PRD Task | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| post-scheduler | Phase 2 (SCHED-02) | 2 | None | - |
| analytics-collector | Phase 4 (ANLYT-01) | 4 | None | - |
| trend-collector | Phase 5 (INTEL-01, INTEL-02) | 5 | None | - |
| trend-alerter | Phase 5 (INTEL-06) | 5 | None | - |
| engagement-monitor | Phase 8 (ENGAGE-01) | 8 | None | - |
| token-refresher | Phase 2 (AUTH-05) | 2 | None | - |
| notifier | Phase 7 (NOTIF-01 through NOTIF-04) | 7 | None | - |
| whatsapp-handler | Phase 7 (NOTIF-05, NOTIF-06) | 7 | None | - |

### 19. Installation and Setup (All Flows)

| PRD Flow | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| Personal Hub creation | Phase 1 (INFRA-03, CONFIG-01) | 1 | None | - |
| /psn:setup join (invite code) | Phase 7 (CONFIG-05, TEAM-03) | 7 | None | - |
| /psn:setup hub (admin creates company) | Phase 7 (TEAM-01, CONFIG-05) | 7 | None | - |
| /psn:setup invite (generate codes) | Phase 7 (TEAM-02) | 7 | None | - |
| /psn:setup tokens (manual refresh) | Phase 2 (implicit in AUTH-05 through AUTH-07) | 2 | None | - |
| /psn:setup platforms (add/remove) | Phase 3 (implicit in CONFIG-03) | 3 | IMPLICIT | Minor |
| /psn:setup disconnect | Phase 7 (CONFIG-06) | 7 | None | - |
| /psn:setup voice (full recalibration) | Phase 3 (VOICE-10) | 3 | None | - |
| API keys required (BYOK table) | Phase 1 (CONFIG-04) | 1 | None | - |
| Multi-company user flow | Phase 7 (CONFIG-05) | 7 | None | - |

### 20. Content Strategy System

| PRD Detail | Roadmap Coverage | Phase(s) | Gap Type | Severity |
|---|---|---|---|---|
| strategy.yaml auto-generation | Phase 3 (CONFIG-02) | 3 | None | - |
| Full strategy.yaml structure | Phase 3 (CONFIG-02, CONFIG-03) | 3 | None | - |
| Strategy iteration loop | Phases 3-5 | 3-5 | None | - |
| Engagement config in strategy.yaml | Phase 8 (ENGAGE-06) | 8 | None | - |
| Notifications config in strategy.yaml | Phase 7 (NOTIF-07) | 7 | None | - |

### 21. Phased Rollout (PRD's Own Phases)

See separate comparison table below.

### 22. Risks and Mitigations

| PRD Risk | Roadmap Coverage | Gap Type | Severity |
|---|---|---|---|
| AI slop suppression | Phase 3 (voice profiles + human review) | None | - |
| Platform API changes | Phase 2 (PLAT-05 typed API clients) | None | - |
| LinkedIn/TikTok approval delays | Phase 1 (submit immediately) | None | - |
| OAuth token expiry | Phase 2 (AUTH-05, AUTH-07) | None | - |
| Team adoption | Phase 7 (team coordination) | None | - |
| Calendar conflicts | Phase 7 (TEAM-08, TEAM-09) | None | - |
| Notification fatigue | Phase 7 (NOTIF-07) | None | - |
| Automated engagement bans | Phase 8 (ENGAGE-05, ENGAGE-06) | None | - |

### 23. Success Metrics

| PRD Metric | Roadmap Coverage | Gap Type | Severity |
|---|---|---|---|
| Team posting percentage | Phase 4 (ANLYT-06 through ANLYT-09) | None | - |
| Time to scheduled post | Phase 2-3 (core workflow) | None | - |
| Edit rate (voice accuracy) | Phase 4 (LEARN-02, LEARN-04) | None | - |
| Idea bank health | Phase 5 (IDEA-02 through IDEA-08) | None | - |
| React-to-notification time | Phase 7-8 (NOTIF + ENGAGE) | None | - |
| Follower growth, engagement rate | Phase 4 (analytics) | None | - |

---

## Requirement Coverage Check

All 143 v1 requirement IDs from REQUIREMENTS.md are mapped to roadmap phases:

| Category | Count | Mapped | Unmapped |
|---|---|---|---|
| INFRA (01-07) | 7 | 7 | 0 |
| AUTH (01-08) | 8 | 8 | 0 |
| VOICE (01-10) | 10 | 10 | 0 |
| POST (01-14) | 14 | 14 | 0 |
| SCHED (01-06) | 6 | 6 | 0 |
| IMG (01-05) | 5 | 5 | 0 |
| ANLYT (01-10) | 10 | 10 | 0 |
| LEARN (01-09) | 9 | 9 | 0 |
| IDEA (01-08) | 8 | 8 | 0 |
| PLAN (01-10) | 10 | 10 | 0 |
| SERIES (01-07) | 7 | 7 | 0 |
| INTEL (01-06) | 6 | 6 | 0 |
| ENGAGE (01-07) | 7 | 7 | 0 |
| NOTIF (01-08) | 8 | 8 | 0 |
| TEAM (01-09) | 9 | 9 | 0 |
| PLAT (01-07) | 7 | 7 | 0 |
| CONFIG (01-07) | 7 | 7 | 0 |
| CONTENT (01-05) | 5 | 5 | 0 |
| **TOTAL** | **143** | **143** | **0** |

Every requirement ID in REQUIREMENTS.md appears in at least one roadmap phase's Requirements line. The Traceability table in REQUIREMENTS.md confirms 143/143 mapped.

---

## PRD Phased Rollout vs Roadmap Phases

The PRD proposes a 7-phase rollout (1a, 1b, 2, 3, 4, 5, 6, 7 + Future). The roadmap has 8 phases. Here is the comparison:

| PRD Phase | PRD Content | Roadmap Phase(s) | Resequenced? | Notes |
|---|---|---|---|---|
| **Phase 1a** | Post to X (minimum viable loop): setup, /psn:post for X text-only, personal voice (interview only), post-scheduler, DB schema, content queue | **Phase 1** (scaffold, setup) + **Phase 2** (X posting, OAuth, scheduling) | Split into 2 phases | Roadmap separates infrastructure from X-specific work. Reasonable. |
| **Phase 1b** | LinkedIn + full voice profiling, token-refresher, edit tracking | **Phase 3** (voice profiling) + **Phase 6** (LinkedIn) | **RESEQUENCED** | PRD puts LinkedIn in 1b; roadmap delays it to Phase 6 (needs partner approval). Voice profiling moved to Phase 3. |
| **Phase 2** | Planning + idea bank + series data model, /psn:plan, /psn:capture, trend-collector, analytics-collector, preference model v1 | **Phase 4** (analytics, learning) + **Phase 5** (intelligence, ideation, planning) | **RESEQUENCED** | Roadmap splits PRD Phase 2 across two phases and places them later. |
| **Phase 3** | Company Hub + rich media + series management, /psn:approve, approval workflow, image generation, /psn:calendar, /psn:series | **Phase 3** (voice + image gen) + **Phase 5** (series) + **Phase 7** (company hub, approvals, calendar) | **RESEQUENCED** | PRD bundles company hub with media; roadmap separates company features to Phase 7 (after multi-platform). |
| **Phase 4** | /psn:review + advanced learning loop, fatigue detection, monthly deep analysis | **Phase 4** (analytics + learning loop) | Aligned | Good match. |
| **Phase 5** | Platform expansion (IG + TikTok) + calendar intelligence, /psn:setup disconnect | **Phase 8** (IG + TikTok) + **Phase 7** (CONFIG-06 disconnect) | **RESEQUENCED** | Roadmap pushes IG/TikTok to Phase 8 (last). PRD had them in Phase 5. |
| **Phase 6** | Notifications + engagement engine, WhatsApp, /psn:engage, trend-alerter, engagement-monitor | **Phase 7** (notifications) + **Phase 8** (engagement engine) | **RESEQUENCED** | Roadmap splits notifications (Phase 7) from engagement (Phase 8). |
| **Phase 7** | Employee advocacy + scaling, team onboarding, competitive intel, templates, remixing | **Phase 5** (competitive intel, remixing) + **Phase 7** (team onboarding) + v2 (leaderboard, templates) | Partially deferred to v2 | Some items moved earlier (intel, remixing to Phase 5), some deferred to v2 (leaderboard, templates). |
| **Future** | Claude-powered WhatsApp chatbot, cloud media storage | v2 (AUTO-01, AUTO-02) | Aligned | Both PRD and roadmap defer these. |

### Summary of Resequencing Rationale

The roadmap makes **5 key resequencing decisions** vs the PRD's suggestion:

1. **LinkedIn delayed from 1b to Phase 6**: Sensible because partner approval takes weeks and X is the easiest starting point. The roadmap builds the full pipeline on X first, then extends to LinkedIn.

2. **Voice profiling moved from 1b to Phase 3**: The roadmap builds infrastructure (Phase 1) and X pipeline (Phase 2) before tackling voice, which depends on having a working posting pipeline.

3. **Company Hub delayed from Phase 3 to Phase 7**: The roadmap prioritizes individual user value (phases 1-6) before adding team complexity. This reduces Phase 7's risk since multi-platform is already stable.

4. **IG/TikTok delayed from Phase 5 to Phase 8**: Matches the TikTok audit timeline and ensures the core system is solid before adding more platforms.

5. **Engagement engine moved from Phase 6 to Phase 8**: Combined with IG/TikTok since engagement monitoring is platform-specific.

All resequencing is intentional and well-reasoned. No features were lost in the reorganization.

---

## All Gaps Sorted by Severity

### Important (1)

| # | PRD Section | Detail | Gap Type | Notes |
|---|---|---|---|---|
| 1 | Content Generation Engine | Video generation (Kling, Runway, Pika) | PARTIAL | PRD describes 3 video generation providers in detail. No VID-xx requirements exist. Image generation has IMG-01 through IMG-05 but video has nothing equivalent. POST-13 covers semi-automated formats (video scripts) but not the actual AI video generation capability. |

### Minor (10)

| # | PRD Section | Detail | Gap Type | Notes |
|---|---|---|---|---|
| 2 | PRD Phase 1b vs Roadmap | LinkedIn in PRD Phase 1b, roadmap Phase 6 | RESEQUENCED | Intentional delay for partner approval timeline. |
| 3 | PRD Phase 2 vs Roadmap | Planning/ideation in PRD Phase 2, roadmap Phases 4-5 | RESEQUENCED | Roadmap places analytics before ideation (data-driven ideation). |
| 4 | PRD Phase 3 vs Roadmap | Company Hub in PRD Phase 3, roadmap Phase 7 | RESEQUENCED | Individual value first, team complexity later. |
| 5 | PRD Phase 5 vs Roadmap | IG/TikTok in PRD Phase 5, roadmap Phase 8 | RESEQUENCED | Matches TikTok audit timeline. |
| 6 | PRD Phase 6 vs Roadmap | Notifications + engagement bundled in PRD Phase 6, split in roadmap Phases 7-8 | RESEQUENCED | Logical separation of notification infrastructure from engagement engine. |
| 7 | Product Overview | Agency model (multiple company hubs) | IMPLICIT | Supported by architecture (multiple connections/*.env) but not explicitly called out. |
| 8 | Multi-Language Support | Idea bank suggested_language field | IMPLICIT | Part of idea schema but not explicitly in requirements. Will be covered when implementing IDEA-01 through IDEA-08. |
| 9 | The Creative Brain | competitive-intel.yaml file creation | IMPLICIT | Part of INTEL-05 competitive intelligence but file format not explicitly required. |
| 10 | Employee Advocacy | Team leaderboard (opt-in) | PARTIAL | Explicitly deferred to v2 (SCALE-01). PRD section mentions it as a strategy enabler. Acceptable deferral. |
| 11 | Employee Advocacy | No dedicated roadmap phase for advocacy strategy | PARTIAL | Employee advocacy is an emergent property of the system (voice profiles + company posting + idea surfacing) rather than a standalone feature. No explicit requirement covers the advocacy strategy section of the PRD. |

---

## Recommendations

### 1. Add Video Generation Requirements (Important)

The PRD describes video generation in detail (Kling, Runway, Pika providers with cost estimates) but no VID-xx requirement IDs exist. Recommend adding:

- **VID-01**: User can generate animated text/quote videos for posts
- **VID-02**: User can generate b-roll with voiceover using TTS
- **VID-03**: Claude picks the best video generation tool based on content type
- **VID-04**: Generated video meets platform-specific format and length requirements

These should be assigned to Phase 3 (alongside IMG-xx) or a later phase. If video generation is considered v2, it should be explicitly moved to v2 requirements and noted as deferred.

**Severity: Important** -- Video content is increasingly dominant on all 4 platforms. The PRD dedicates significant space to it.

### 2. Document Implicit Coverages (Minor)

The following items are likely covered during implementation but could benefit from explicit mention in plan-level task descriptions:

- **Agency model**: Add a note to Phase 7 that the architecture supports agency scenarios (one Company Hub per client) by design.
- **competitive-intel.yaml**: Mention the file format in Phase 5's INTEL-05 implementation details.
- **Idea bank suggested_language field**: Ensure the ideas table schema includes this field when implementing Phase 5.
- **/psn:setup platforms subcommand**: Confirm this is covered by CONFIG-03 or add explicit mention.

### 3. No Action Needed for Resequencing (Informational)

All 5 resequencing decisions are well-reasoned engineering choices that improve on the PRD's looser suggestion. The PRD itself notes its phases are "a loose guideline." No changes recommended.

### 4. Employee Advocacy Section (Minor)

The PRD has a dedicated section on employee advocacy strategy, but the roadmap treats it as an emergent outcome of other features. This is acceptable since advocacy is enabled by voice profiles (Phase 3), company posting (Phase 7), and idea surfacing (Phase 5/7). No standalone phase needed, but consider adding a note in Phase 7 plans that employee advocacy is a key success metric enabled by the combined features.

### 5. Validate v2 Deferrals (Minor)

Confirm these PRD features are intentionally deferred to v2 and not accidentally dropped:
- Team analytics leaderboard (SCALE-01) -- confirmed in v2
- Content template library (AUTO-03) -- confirmed in v2
- Claude-powered WhatsApp chatbot (AUTO-01) -- confirmed in v2
- Cloud media storage (AUTO-02) -- confirmed in v2

All are present in REQUIREMENTS.md v2 section. No action needed.

---

## Conclusion

The roadmap is **well-aligned with the PRD vision**. The only actionable gap is the missing video generation requirements (VID-xx), which should be addressed before Phase 3 planning begins. All other findings are minor implicit coverages or intentional resequencing decisions that improve on the PRD's suggested order.

The requirement mapping is complete at 143/143. The roadmap's 8-phase structure provides a cleaner engineering progression than the PRD's 7-phase suggestion, with individual user value prioritized before team complexity and platform expansion matched to API approval timelines.
