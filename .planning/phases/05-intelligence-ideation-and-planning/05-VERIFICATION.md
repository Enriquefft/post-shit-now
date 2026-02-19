---
phase: 05-intelligence-ideation-and-planning
verified: 2026-02-19T23:45:00Z
status: passed
score: 5/5 must-haves verified
gaps: []
human_verification:
  - test: "Run /psn:capture with a one-liner idea and verify it completes in under 30 seconds"
    expected: "Idea is stored in DB with correct status (spark), urgency inferred, and tags parsed"
    why_human: "Timing and UX feel cannot be verified programmatically"
  - test: "Run /psn:plan and walk through all 5 phases (calendar, ideation, slotting, drafting, scheduling)"
    expected: "Each phase produces meaningful output; bailing at any phase works cleanly"
    why_human: "Multi-step interactive workflow requires human judgment on flow quality"
  - test: "Generate a bilingual post with language='both' and verify two independent versions"
    expected: "English and Spanish versions use language-specific voice patterns, not translations"
    why_human: "Content quality and language independence require human evaluation"
  - test: "Verify Trigger.dev tasks deploy and run on schedule (trend-collector at 6AM, trend-poller every 3h, idea-expiry at 7AM)"
    expected: "Tasks appear in Trigger.dev dashboard with correct cron schedules"
    why_human: "Requires access to Trigger.dev Cloud dashboard"
---

# Phase 5: Intelligence, Ideation, and Planning Verification Report

**Phase Goal:** User can capture ideas, get trend-informed suggestions, plan a full week of content, create recurring series, and post in both English and Spanish
**Verified:** 2026-02-19T23:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Trend collector pulls daily from HN, Reddit, Product Hunt, Google Trends RSS, and RSS feeds; lighter polls every 2-4 hours for breaking news | VERIFIED | `src/intelligence/collector.ts` orchestrates all 6 sources with BYOK degradation. `src/trigger/trend-collector.ts` runs at `0 6 * * *` (daily 6AM). `src/trigger/trend-poller.ts` runs at `0 8-20/3 * * *` (every 3h, 8AM-8PM) using `collectBreakingNews()` (HN top 10 + X trending only). All sources are substantive (534 total lines across adapters). |
| 2 | User can capture ideas in under 30 seconds via `/psn:capture` and ideas flow through the maturity pipeline (spark to used/killed) | VERIFIED | `src/ideas/capture.ts` exports `captureIdea()` with inline tag parsing (`parseInlineTags`), urgency inference, and DB insert. `src/ideas/types.ts` defines `VALID_TRANSITIONS` state machine: spark->seed->ready->claimed->developed->used/killed. `src/ideas/lifecycle.ts` exports `transitionIdea()`, `autoPromoteIdeas()`, `expireTimelyIdeas()`. `.claude/commands/psn/capture.md` provides full slash command with capture, list, ready, search, stats, stale, expire, killed subcommands. CLI entry point at `src/cli/capture.ts` wires everything together. |
| 3 | User can run `/psn:plan` for weekly batch ideation showing calendar state, generating ideas mixed with ready ideas from the bank, and scheduling a full week | VERIFIED | `src/planning/calendar.ts` builds `CalendarState` with scheduled posts, due series, gaps, and capacity. `src/planning/ideation.ts` generates 10-15 ideas mixing ~30% trends, ~30% idea bank, ~20% generated, with fatigue filtering. `src/planning/slotting.ts` allocates slots with series-first priority, pillar weight distribution, and angle balancing (max 2 per week). `src/cli/plan.ts` exposes calendar, ideate, rate, slot, languages, remix, recycle, save, status subcommands. `.claude/commands/psn/plan.md` defines 5-phase interactive flow with bail-at-any-phase support. |
| 4 | User can create content series with cadence and format templates that auto-slot into weekly plans | VERIFIED | `src/series/manager.ts` exports full CRUD: `createSeries`, `updateSeries`, `pauseSeries`, `resumeSeries`, `retireSeries`, `getSeries`, `listSeries`, `getSeriesAnalytics`. `src/series/episodes.ts` calculates due dates from `lastPublishedAt + cadence` and supports 3 tracking modes (none, auto-increment, custom format). `src/series/detection.ts` detects recurring patterns (3+ posts with same pillar+format). `src/planning/slotting.ts` lines 49-69 auto-slots series episodes first before filling remaining slots. `src/trigger/publish-post.ts` calls `recordEpisodePublished()` on publish. Schema has `series` table with jsonb template, cadence, episode tracking. |
| 5 | User can choose language (en/es/both) per post with bilingual posts independently crafted, not translated | VERIFIED | `src/content/generate.ts` accepts `language: "en" | "es" | "both"`. Two-pass generation for "both" at line 188: generates English draft, then Spanish draft independently, returns `bilingualPair: { en, es }`. `buildVoicePromptContext()` uses language-specific voice patterns (`profile.languages[language]`). `src/planning/language.ts` suggests languages per slot based on strategy config and recent mix (60/40 target). Schema has `language` column on both `posts` (line 77) and `postMetrics` (line 163). `.claude/commands/psn/post.md` includes language selection step (3b) with platform-specific guidance. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/db/schema.ts` | 5 new tables + post extensions | VERIFIED | ideas (line 289), series (line 340), trends (line 378), weekly_plans (line 431), monitored_accounts (line 461) tables. posts extended with seriesId (line 76) and language (line 77). postMetrics extended with language (line 163). All 5 new tables have pgPolicy isolation. |
| `src/intelligence/collector.ts` | Trend orchestrator with BYOK | VERIFIED | 165 lines. Exports `collectTrends()` and `collectBreakingNews()`. Calls all 6 source adapters conditionally based on env vars. |
| `src/intelligence/scoring.ts` | Pillar relevance scoring | VERIFIED | 145 lines. Exports `scorePillarRelevance()`, `computeOverallScore()`, `generateAngleStubs()`, `scoreTrends()`. High-scoring trends (70+) get 2-3 angle stubs. |
| `src/intelligence/search/index.ts` | Unified search aggregator | VERIFIED | 42 lines. Exports `searchAll()`. Aggregates Perplexity, Exa, Tavily, Brave with deduplication. |
| `src/intelligence/competitive.ts` | Competitor monitoring | VERIFIED | 194 lines. Exports `checkCompetitors()`. Queries monitoredAccounts, fetches X tweets, extracts topics, suggests content gaps. |
| `src/ideas/types.ts` | Status, urgency, transitions | VERIFIED | 62 lines. IdeaStatus (7 states), Urgency (3 types), VALID_TRANSITIONS map, STALENESS_DAYS thresholds. |
| `src/ideas/capture.ts` | Idea capture with tag parsing | VERIFIED | 138 lines. Exports `captureIdea()`, `parseInlineTags()`, `inferUrgency()`. DB insert with urgency-based expiry calculation. |
| `src/ideas/lifecycle.ts` | State machine transitions | VERIFIED | 234 lines. Exports `transitionIdea()`, `autoPromoteIdeas()`, `getStaleIdeas()`, `expireTimelyIdeas()`, `recordKillFeedback()`. |
| `src/ideas/bank.ts` | Query/filter/search ideas | VERIFIED | 183 lines. Exports `getReadyIdeas()`, `searchIdeas()`, `getIdeasByStatus()`, `getIdeaStats()`, `listIdeas()`, `getKilledIdeasSince()`. |
| `src/series/manager.ts` | Series CRUD | VERIFIED | 204 lines. Full CRUD + lifecycle (pause/resume/retire) + per-series analytics with joined posts/metrics. |
| `src/series/episodes.ts` | Episode tracking and due dates | VERIFIED | 131 lines. Calculates from lastPublishedAt + cadence. Three tracking modes. `recordEpisodePublished()` increments count. |
| `src/series/detection.ts` | Pattern detection | VERIFIED | 93 lines. Groups postMetrics by (pillar, format), flags 3+ occurrences as series candidates. |
| `src/planning/calendar.ts` | Calendar state builder | VERIFIED | 158 lines. Queries scheduled posts, due series, identifies gaps, calculates capacity from strategy.yaml. |
| `src/planning/ideation.ts` | Multi-source idea generation | VERIFIED | 184 lines. Mixes trends (~30%), idea bank (~30%), generated (~20%) with fatigue filtering and preference model. |
| `src/planning/slotting.ts` | Slot allocation with balancing | VERIFIED | 132 lines. Series-first priority, pillar weight distribution, angle limit (max 2 per week). |
| `src/planning/language.ts` | Language suggestion engine | VERIFIED | 98 lines. 60/40 primary/secondary balance target. Recent post language distribution analysis. |
| `src/planning/recycling.ts` | Remix and recycle suggestions | VERIFIED | 163 lines. Remix: top performers adapted to other platforms. Recycle: 60+ day old top performers with rotated angles. |
| `src/cli/capture.ts` | Capture CLI entry point | VERIFIED | 205 lines. 8 subcommands: capture, list, ready, search, stats, stale, expire, killed. All wired to bank/capture/lifecycle. |
| `src/cli/series.ts` | Series CLI entry point | VERIFIED | 227 lines. 8 subcommands: create, list, pause, resume, retire, analytics, due, detect. |
| `src/cli/plan.ts` | Plan CLI entry point | VERIFIED | 256 lines. 8 subcommands: calendar, ideate, rate, slot, languages, remix, recycle, save, status. |
| `.claude/commands/psn/capture.md` | Capture slash command | VERIFIED | 99 lines. Detailed flow for capture, list, ready, search, stats, stale, expire, killed modes. |
| `.claude/commands/psn/series.md` | Series slash command | VERIFIED | 67 lines. Create, list, due, pause/resume/retire, analytics, detect subcommands. |
| `.claude/commands/psn/plan.md` | Plan slash command | VERIFIED | 158 lines. 5-phase flow: calendar, ideation, slotting, drafting, scheduling with bail-at-any-phase. |
| `src/trigger/trend-collector.ts` | Daily trend cron task | VERIFIED | 218 lines. Cron `0 6 * * *`. Collects, scores, stores, prunes expired trends. |
| `src/trigger/trend-poller.ts` | Breaking news poller task | VERIFIED | 192 lines. Cron `0 8-20/3 * * *`. Lighter collector (HN + X only). |
| `src/trigger/idea-expiry.ts` | Idea expiry cron task | VERIFIED | 39 lines. Cron `0 7 * * *`. Calls `expireTimelyIdeas()`. |
| `src/content/generate.ts` | Bilingual two-pass generation | VERIFIED | 306 lines. `language: "both"` triggers recursive two-pass (en then es). `bilingualPair` field on GeneratedDraft. Language-specific voice context. |
| `src/trigger/publish-post.ts` | Series episode wiring | VERIFIED | `advanceSeriesState()` at line 404 calls `recordEpisodePublished()` on publish when post has seriesId. |
| `src/learning/preference-model.ts` | Killed idea feedback | VERIFIED | `computeWeeklyUpdate()` imports `getKilledIdeasSince`, queries killed ideas from last 7 days, extracts rejected pillars and common kill reasons, stores as `killedIdeaPatterns`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `collector.ts` | `sources/*.ts` | import + call each adapter | WIRED | Imports all 6 source functions and calls them in `collectTrends()` |
| `scoring.ts` | `types.ts` | Pillar, RawTrend, ScoredTrend types | WIRED | Imports and uses all types for scoring logic |
| `trend-collector.ts` | `collector.ts` + `scoring.ts` | import collectTrends, scoreTrends | WIRED | Lines 4-5 import, lines 137 + 146 call |
| `trend-collector.ts` | `schema.ts` (trends table) | raw SQL insert with upsert | WIRED | Lines 154-179 INSERT INTO trends with ON CONFLICT |
| `trend-poller.ts` | `collector.ts` | import collectBreakingNews | WIRED | Line 3 import, line 125 call |
| `idea-expiry.ts` | `lifecycle.ts` | import expireTimelyIdeas | WIRED | Line 3 import, line 26 call |
| `capture.ts` | `schema.ts` (ideas table) | db.insert(ideas) | WIRED | Line 97-112 insert into ideas table |
| `lifecycle.ts` | `types.ts` | VALID_TRANSITIONS state machine | WIRED | Line 5 import, line 46 usage in transitionIdea |
| `cli/plan.ts` | planning modules | import calendar, ideation, slotting, language, recycling | WIRED | Lines 6-10 imports, all used in subcommands |
| `slotting.ts` | CalendarState.seriesDue | series-first slot allocation | WIRED | Lines 50-69 iterate seriesDue first |
| `publish-post.ts` | `series/episodes.ts` | import recordEpisodePublished | WIRED | Line 11 import, line 411 call in advanceSeriesState |
| `generate.ts` | voice profile languages | buildVoicePromptContext with language param | WIRED | Line 248 call, lines 90-108 language-specific patterns |
| `preference-model.ts` | `ideas/bank.ts` | import getKilledIdeasSince | WIRED | Line 4 import, line 251 call in computeWeeklyUpdate |
| `search/index.ts` | individual search clients | import + parallel call | WIRED | Lines 2-5 imports, lines 13-18 Promise.allSettled |
| `competitive.ts` | `schema.ts` (monitoredAccounts) | db.select from monitoredAccounts | WIRED | Line 3 import, line 128 query |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| INTEL-01 | 05-02, 05-04 | Daily trend collector from HN, Reddit, PH, Google Trends, RSS | SATISFIED | trend-collector.ts cron task + collector.ts with all 5+ sources |
| INTEL-02 | 05-04 | Lighter poll every 2-4 hours for breaking news | SATISFIED | trend-poller.ts at `0 8-20/3 * * *` with collectBreakingNews (HN+X) |
| INTEL-03 | 05-01, 05-02 | Trends scored by pillar relevance, stored in Hub DB | SATISFIED | scoring.ts scorePillarRelevance + trends table with pillarRelevance jsonb |
| INTEL-04 | 05-02 | On-demand search via Perplexity, Exa, Tavily, Brave | SATISFIED | search/index.ts searchAll() aggregates 4 providers |
| INTEL-05 | 05-02 | Competitive intelligence tracks monitored accounts | SATISFIED | competitive.ts checkCompetitors() + monitoredAccounts table |
| INTEL-06 | 05-02 | Angle stubs for high-scoring trends (70+) | SATISFIED | scoring.ts generateAngleStubs() called when overallScore >= 70 |
| IDEA-01 | 05-03 | Capture ideas in under 30 seconds via /psn:capture | SATISFIED | capture.md + cli/capture.ts with inline tag parsing |
| IDEA-02 | 05-01, 05-03 | Maturity pipeline: spark -> seed -> ready -> claimed -> developed -> used/killed | SATISFIED | types.ts VALID_TRANSITIONS + lifecycle.ts transitionIdea() |
| IDEA-03 | 05-01, 05-03 | Urgency: timely (24-48h), seasonal, evergreen | SATISFIED | Urgency type + inferUrgency() + 48h/30d expiry calc |
| IDEA-04 | 05-03, 05-04 | Timely ideas auto-killed on expiry | SATISFIED | lifecycle.ts expireTimelyIdeas() + idea-expiry.ts cron |
| IDEA-05 | 05-01 | Personal ideas in Personal Hub, company in Company Hub | SATISFIED | ideas.hubId column + hub parameter in captureIdea |
| IDEA-06 | 05-03 | Team members can claim company ideas | SATISFIED | transitionIdea("claimed", { claimedBy }) in lifecycle.ts |
| IDEA-07 | 05-03 | /psn:capture distinguishes timely vs evergreen | SATISFIED | inferUrgency() keyword matching + #urgency:timely inline tag |
| IDEA-08 | 05-03 | Killed ideas feed back into preference model | SATISFIED | preference-model.ts computeWeeklyUpdate queries getKilledIdeasSince |
| PLAN-01 | 05-06 | /psn:plan for weekly batch ideation + generation + scheduling | SATISFIED | plan.md 5-phase flow + cli/plan.ts with all subcommands |
| PLAN-02 | 05-06 | Calendar state shows scheduled posts, series due dates, gaps | SATISFIED | calendar.ts getCalendarState() returns scheduledPosts, seriesDue, gaps |
| PLAN-03 | 05-06 | Ideation checks trends, search, analytics, idea bank | SATISFIED | ideation.ts generatePlanIdeas() queries trends, readyIdeas, searchAll, preferenceModel |
| PLAN-04 | 05-06 | System generates 10-15 ideas mixed with ready ideas | SATISFIED | generatePlanIdeas() with targetCount=12, mixing 4 sources |
| PLAN-05 | 05-06 | User rates ideas: love/maybe/kill | SATISFIED | plan.ts rateCommand() transitions to ready/seed/killed |
| PLAN-06 | 05-06 | Series auto-slotted first, ready ideas fill gaps | SATISFIED | slotting.ts lines 49-69 series first, 100-126 ideas fill remaining |
| PLAN-07 | 05-06 | Language suggestion per slot | SATISFIED | language.ts suggestLanguages() with 60/40 balance target |
| PLAN-08 | 05-06 | User can bail at any phase | SATISFIED | plan.md explicitly documents bail points at each phase transition |
| PLAN-09 | 05-06 | Pillar distribution by strategy.yaml weights | SATISFIED | slotting.ts lines 72-97 weighted round-robin sorting |
| PLAN-10 | 05-06 | Content archetype balancing | SATISFIED | slotting.ts lines 104-109 maxAngleRepeat=2 limit |
| SERIES-01 | 05-05 | Create series via /psn:series with format, cadence, branding | SATISFIED | manager.ts createSeries() + cli/series.ts create subcommand |
| SERIES-02 | 05-01, 05-05 | Series with jsonb template config | SATISFIED | Schema SeriesTemplate interface + jsonb("template") column |
| SERIES-03 | 05-05, 05-06 | Series auto-slot into weekly plans | SATISFIED | slotting.ts series-first allocation + publish-post.ts episode wiring |
| SERIES-04 | 05-05 | Pause, resume, retire series | SATISFIED | manager.ts pauseSeries/resumeSeries/retireSeries with validation |
| SERIES-05 | 05-05 | Per-series analytics | SATISFIED | manager.ts getSeriesAnalytics() joins posts+postMetrics by seriesId |
| SERIES-06 | 05-05 | Pattern detection for series suggestions | SATISFIED | detection.ts detectSeriesPatterns() flags 3+ pillar+format combos |
| POST-07 | 05-06 | Language choice per post (en/es/both) | SATISFIED | generate.ts accepts language option + post.md step 3b language selection |
| POST-08 | 05-06 | Bilingual "both" independently crafted | SATISFIED | generate.ts two-pass at line 188: en then es with bilingualPair |
| ANLYT-10 | 05-01, 05-06 | Per-language performance tracking | SATISFIED | postMetrics.language column + plan.md documents language tracking |
| CONTENT-03 | 05-06 | Content remixing suggestions | SATISFIED | recycling.ts getRemixSuggestions() with PLATFORM_REMIX_MAP |
| CONTENT-04 | 05-06 | Content recycling top performers with fresh angles | SATISFIED | recycling.ts getRecycleSuggestions() with ANGLE_ROTATION map |

**35/35 requirements SATISFIED. 0 orphaned requirements.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/content/generate.ts` | 267 | Comment: "placeholder for Claude to fill in via slash command" | Info | By design -- content generation is a shell for Claude to fill via /psn:post slash command interaction. Not a stub. |

No blockers or warnings found. The single info-level comment is intentional architecture (Claude Code fills content via conversation, not programmatically).

### Human Verification Required

1. **Capture Speed Test**
   **Test:** Run `/psn:capture AI agents are replacing junior devs #pillar:ai #format:thread` and time it.
   **Expected:** Idea captured with spark status, pillar=ai, format=thread, urgency=evergreen, in under 30 seconds.
   **Why human:** Timing and UX feel cannot be verified programmatically.

2. **Full Planning Workflow**
   **Test:** Run `/psn:plan` and walk through all 5 phases with real data.
   **Expected:** Calendar shows current state, ideation produces 10-15 mixed ideas, slotting respects series-first and pillar weights, language suggestions appear, bail-at-any-phase works.
   **Why human:** Multi-step interactive workflow quality requires human judgment.

3. **Bilingual Content Quality**
   **Test:** Generate a post with `language: "both"` and compare the two versions.
   **Expected:** English and Spanish versions use different voice patterns, vocabulary, and sentence structures -- not translations of each other.
   **Why human:** Language quality and independence evaluation requires human assessment.

4. **Trigger.dev Task Deployment**
   **Test:** Deploy and verify tasks appear in Trigger.dev dashboard.
   **Expected:** trend-collector (daily 6AM), trend-poller (every 3h 8AM-8PM), idea-expiry (daily 7AM) visible with correct schedules.
   **Why human:** Requires access to Trigger.dev Cloud dashboard.

### Gaps Summary

No gaps found. All 5 success criteria are verified with substantive implementations. All 35 requirements have implementation evidence. All key links between modules are wired and functional. No blocking anti-patterns detected.

The phase delivers a complete intelligence-to-planning pipeline: trend collection from 6 sources with BYOK degradation, idea capture with lifecycle management, series management with episode tracking, weekly planning with multi-source ideation, and bilingual content support. The system is Claude Code-first with slash commands driving interactive workflows.

---

_Verified: 2026-02-19T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
