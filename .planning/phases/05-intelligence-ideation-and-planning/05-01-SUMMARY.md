---
phase: 05-intelligence-ideation-and-planning
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, jsonb, schema]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "pgTable, pgPolicy, hubUser role, existing schema patterns"
provides:
  - "ideas table with maturity pipeline and urgency classification"
  - "series table with jsonb template, cadence, episode tracking"
  - "trends table with pillar relevance scoring and expiry"
  - "weeklyPlans table with jsonb PlanSlot array"
  - "monitoredAccounts table for competitive intelligence"
  - "posts.seriesId and posts.language columns"
  - "postMetrics.language column for per-language analytics"
affects: [05-02, 05-03, 05-04, 05-05, 05-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SeriesTemplate interface for typed jsonb", "PlanSlot interface for typed jsonb arrays"]

key-files:
  created: []
  modified: ["src/core/db/schema.ts"]

key-decisions:
  - "SeriesTemplate and PlanSlot exported as interfaces for reuse in downstream modules"
  - "EditPattern interface pattern reused for SeriesTemplate and PlanSlot typed jsonb columns"

patterns-established:
  - "Typed jsonb with exported interface: define interface, then .$type<Interface>() on jsonb column"

requirements-completed: [IDEA-02, IDEA-03, IDEA-05, SERIES-02, INTEL-03, ANLYT-10, POST-07]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 5 Plan 01: Database Schema Summary

**Ideas, series, trends, weekly plans, and monitored accounts tables with RLS policies plus bilingual/series columns on posts and postMetrics**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T10:56:10Z
- **Completed:** 2026-02-19T10:58:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added 5 new tables (ideas, series, trends, weeklyPlans, monitoredAccounts) with full RLS policies
- Extended posts table with seriesId and language columns for series tracking and bilingual support
- Extended postMetrics table with language column for per-language analytics
- Exported SeriesTemplate and PlanSlot interfaces for typed jsonb usage in downstream plans

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ideas, series, trends, weeklyPlans, and monitoredAccounts tables** - `2bbb184` (feat)
2. **Task 2: Extend posts and postMetrics with seriesId and language columns** - `3433aae` (feat)

## Files Created/Modified
- `src/core/db/schema.ts` - Added 5 new tables, 2 interfaces, 3 new columns on existing tables

## Decisions Made
- SeriesTemplate and PlanSlot defined as exported interfaces (not inline types) for reuse across downstream plans
- Followed existing EditPattern interface pattern for typed jsonb columns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `src/intelligence/sources/x-trending.ts` (untracked file, not caused by this plan) -- ignored as out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 tables defined and ready for migration generation
- Downstream plans can import ideas, series, trends, weeklyPlans, monitoredAccounts from schema.ts
- Posts and postMetrics extensions ready for bilingual analytics and series tracking

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
