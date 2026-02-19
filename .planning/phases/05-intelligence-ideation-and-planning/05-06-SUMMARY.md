---
phase: 05-intelligence-ideation-and-planning
plan: 06
subsystem: planning
tags: [weekly-planning, ideation, slotting, bilingual, series, recycling, language-suggestion]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Intelligence types and schema (trends, weekly_plans tables)"
  - phase: 05-02
    provides: "Trend collector and search aggregator (searchAll, collectTrends)"
  - phase: 05-03
    provides: "Idea bank CRUD, lifecycle, state machine (getReadyIdeas, transitionIdea)"
  - phase: 05-04
    provides: "Trend poller and daily collector pipeline"
  - phase: 05-05
    provides: "Content series CRUD, episodes, detection (getDueEpisodes, recordEpisodePublished)"
provides:
  - "Weekly planning engine: calendar state, ideation, slot allocation, language suggestion"
  - "Content remixing and recycling from top performers"
  - "/psn:plan multi-phase slash command for full weekly planning sessions"
  - "Plan CLI with calendar, ideate, rate, slot, languages, remix, recycle, save, status subcommands"
  - "Bilingual two-pass generation (language 'both') in generate.ts"
  - "Series state advancement on publish in publish-post.ts"
  - "Due series episode surfacing in /psn:post topic gathering"
  - "Language selection step in /psn:post"
  - "Real checkIdeaBank wired to idea bank (no longer stub)"
affects: [phase-06-multi-platform, phase-07-team-company, phase-08-growth]

# Tech tracking
tech-stack:
  added: []
  patterns: [planning-engine-modules, multi-phase-slash-command, bilingual-two-pass, series-publish-hook]

key-files:
  created:
    - src/planning/types.ts
    - src/planning/calendar.ts
    - src/planning/ideation.ts
    - src/planning/slotting.ts
    - src/planning/language.ts
    - src/planning/recycling.ts
    - src/cli/plan.ts
    - .claude/commands/psn/plan.md
  modified:
    - src/content/topic-suggest.ts
    - src/content/generate.ts
    - src/trigger/publish-post.ts
    - .claude/commands/psn/post.md

key-decisions:
  - "PlanSlot.seriesEpisode stored as string in planning types but converted to number for DB schema compatibility"
  - "Language balance targets 60/40 primary/secondary with recent post history analysis"
  - "Bilingual 'both' uses recursive generatePost calls for truly independent generation passes"
  - "Series state advancement in publish-post.ts wrapped in try/catch to never roll back successful publishes"
  - "checkIdeaBank remains backward-compatible: returns empty when no DB provided"

patterns-established:
  - "Planning engine modules: separate files for each planning concern (calendar, ideation, slotting, language, recycling)"
  - "Multi-phase slash command: bail-at-any-phase pattern with save between phases"
  - "Bilingual two-pass: recursive call with language override for independent crafting"
  - "Series publish hook: non-blocking post-publish side effect with graceful error handling"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, PLAN-06, PLAN-07, PLAN-08, PLAN-09, PLAN-10, POST-07, POST-08, ANLYT-10, CONTENT-03, CONTENT-04, SERIES-03]

# Metrics
duration: 7min
completed: 2026-02-19
---

# Phase 5 Plan 6: Weekly Planning Engine Summary

**Weekly planning engine with calendar state, trend-informed ideation, series-first slot allocation, pillar/archetype balancing, bilingual two-pass generation, and /psn:plan multi-phase slash command**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-19T11:13:57Z
- **Completed:** 2026-02-19T11:21:45Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Complete planning engine: calendar state builder, multi-source ideation (trends + bank + search + generated), series-first slot allocation with pillar-weighted round-robin and angle diversity limits
- /psn:plan multi-phase slash command guiding users through calendar -> ideation -> slotting -> drafting -> scheduling with bail-at-any-phase support
- Bilingual "both" language support via two independent generation passes (not translations) with bilingualPair in GeneratedDraft
- Series state advancement wired into publish-post.ts so getDueEpisodes and getNextEpisodeLabel always reflect real publish history
- Content remixing (top performers -> different platforms) and recycling (old performers -> fresh angles)
- checkIdeaBank stub replaced with real idea bank query wired to getReadyIdeas

## Task Commits

Each task was committed atomically:

1. **Task 1: Create planning engine modules** - `e964b83` (feat)
2. **Task 2: Create plan CLI, /psn:plan slash command, wire checkIdeaBank** - `4b59eaa` (feat)
3. **Task 3: Wire bilingual and series features into /psn:post, generate.ts, publish-post.ts** - `4512891` (feat)

## Files Created/Modified
- `src/planning/types.ts` - PlanSlot, WeeklyPlan, CalendarState, PlanIdea, PlanPhase, StrategyConfig types
- `src/planning/calendar.ts` - getCalendarState with strategy.yaml capacity and gap detection
- `src/planning/ideation.ts` - generatePlanIdeas mixing trends, bank, search, and generated ideas
- `src/planning/slotting.ts` - allocateSlots with series-first, pillar-weighted round-robin, angle limits
- `src/planning/language.ts` - suggestLanguages with recent mix analysis and 60/40 balance target
- `src/planning/recycling.ts` - getRemixSuggestions and getRecycleSuggestions from top performers
- `src/cli/plan.ts` - Plan CLI with calendar, ideate, rate, slot, languages, remix, recycle, save, status
- `.claude/commands/psn/plan.md` - Multi-phase planning slash command
- `src/content/topic-suggest.ts` - checkIdeaBank wired to real getReadyIdeas, ANGLES exported
- `src/content/generate.ts` - language "both" support with bilingualPair two-pass generation
- `src/trigger/publish-post.ts` - recordEpisodePublished called after successful publish when seriesId set
- `.claude/commands/psn/post.md` - Language selection step and due series episode check added

## Decisions Made
- PlanSlot.seriesEpisode stored as string in planning types (e.g., "#3") but converted to number for DB schema compatibility via parseInt
- Language balance targets 60/40 primary/secondary split with analysis of last 14 days of posts
- Bilingual "both" uses recursive generatePost calls -- each pass gets language-specific voice context for truly independent crafting
- Series state advancement wrapped in try/catch so publish never fails due to series state errors
- checkIdeaBank maintains backward compatibility (returns empty when no DB provided) to avoid breaking existing callers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 is now complete: intelligence, ideation, series, and planning systems all wired together
- Ready for Phase 6 (Multi-Platform) which will extend these systems to LinkedIn, Instagram, and TikTok
- The planning engine's platform-aware slot allocation and language suggestions are designed to support multi-platform from day one

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
