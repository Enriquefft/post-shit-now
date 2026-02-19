---
phase: 09-integration-wiring-fixes
plan: 02
subsystem: content
tags: [idea-bank, locked-settings, unified-calendar, hub-discovery, preference-model]

# Dependency graph
requires:
  - phase: 05-intelligence-ideation-and-planning
    provides: "Idea bank with checkIdeaBank function and ready ideas lifecycle"
  - phase: 07-team-coordination-and-notifications
    provides: "Company hub discovery, getUnifiedCalendar, locked settings"
provides:
  - "checkIdeaBank in generate.ts receives db+userId so ready ideas surface during /psn:post"
  - "calendarCommand returns UnifiedCalendar with personal + company hub posts"
  - "Locked settings enforced before preference model learnings affect content generation"
affects: [content-generation, weekly-planning, calendar-commands]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB connection reuse: create once, pass to multiple functions in same scope"
    - "Locked settings filter pattern: check isSettingLocked before applying preference learnings"

key-files:
  created: []
  modified:
    - src/content/generate.ts
    - src/cli/plan.ts

key-decisions:
  - "Reuse single DB connection for both checkIdeaBank and getLockedSettings in generate.ts"
  - "calendarCommand returns UnifiedCalendar type (not CalendarState) — breaking return type change"
  - "Inline type imports for HubConnection and HubDb in calendarCommand to avoid top-level type pollution"

patterns-established:
  - "Locked settings filter: check isSettingLocked per field before applying preference model adjustments"

requirements-completed: [POST-11, TEAM-08, LEARN-07]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 9 Plan 2: Content Flow Integration Wiring Summary

**Idea bank receives db+userId in generate.ts, calendarCommand uses getUnifiedCalendar with hub discovery, and locked settings filter preference model learnings**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T17:38:53Z
- **Completed:** 2026-02-19T17:40:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- checkIdeaBank in generate.ts now receives db and userId so ready ideas from the idea bank surface during /psn:post
- calendarCommand in plan.ts calls getUnifiedCalendar with hub discovery so company posts are visible in /psn:calendar
- generate.ts checks lockedSettings from locks.ts before applying preference model hook and format suggestions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix checkIdeaBank arguments and add locked settings checks in generate.ts** - `ee102b5` (feat)
2. **Task 2: Switch calendarCommand to use getUnifiedCalendar with hub discovery** - `90f9129` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/content/generate.ts` - Added db connection reuse, checkIdeaBank args, locked settings import and filtering
- `src/cli/plan.ts` - Added getUnifiedCalendar import, discoverCompanyHubs, rewrote calendarCommand

## Decisions Made
- Reuse single DB connection created for checkIdeaBank for locked settings fetch (avoids duplicate connections)
- calendarCommand return type changed from CalendarState to UnifiedCalendar (callers must handle new shape)
- Used inline type imports in calendarCommand for HubConnection and HubDb to keep top-level imports clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three content flow integration gaps are now wired
- TypeScript compilation passes with zero errors
- Graceful fallback maintained for all DB-dependent operations

---
*Phase: 09-integration-wiring-fixes*
*Completed: 2026-02-19*
