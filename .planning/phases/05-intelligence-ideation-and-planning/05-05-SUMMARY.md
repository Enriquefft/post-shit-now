---
phase: 05-intelligence-ideation-and-planning
plan: 05
subsystem: series
tags: [series, episodes, cadence, pattern-detection, cli, slash-command]

# Dependency graph
requires:
  - phase: 05-intelligence-ideation-and-planning
    provides: "series table with template, cadence, episode tracking columns"
provides:
  - "Series CRUD with create, update, pause, resume, retire lifecycle"
  - "Episode tracking with due date calculation from lastPublishedAt"
  - "Episode labels: none, auto-increment, custom format strings"
  - "Pattern detection for recurring pillar+format combos (3+ occurrences)"
  - "Series CLI with all lifecycle subcommands"
  - "/psn:series slash command for guided series management"
affects: [05-06]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Series lifecycle state machine: active->paused->active, active->retired (terminal)", "Due date calculation from lastPublishedAt not createdAt"]

key-files:
  created: ["src/series/types.ts", "src/series/manager.ts", "src/series/episodes.ts", "src/series/detection.ts", "src/cli/series.ts", ".claude/commands/psn/series.md"]
  modified: []

key-decisions:
  - "SeriesTemplate re-exported from schema.ts as single source of truth"
  - "Pattern detection uses pure SQL+JS aggregation, no ML"
  - "Custom tracking format supports {e} for episode and {s} for season"
  - "Retired status is terminal -- cannot un-retire a series"

patterns-established:
  - "Series lifecycle guards: check current status before state transitions"
  - "Due episode calculation: always from lastPublishedAt, fallback to createdAt"

requirements-completed: [SERIES-01, SERIES-02, SERIES-03, SERIES-04, SERIES-05, SERIES-06]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 5 Plan 05: Content Series Summary

**Series CRUD with pause/resume/retire lifecycle, episode tracking with customizable numbering, pattern detection for recurring content, and /psn:series slash command**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T11:08:48Z
- **Completed:** 2026-02-19T11:12:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete series CRUD with lifecycle state machine (active/paused/retired) and state guards
- Episode tracking calculates due dates from lastPublishedAt with auto-increment, custom format, or no-label modes
- Pattern detection flags pillar+format combinations with 3+ occurrences in 30 days as series candidates
- Full CLI with create/list/pause/resume/retire/analytics/due/detect subcommands
- /psn:series slash command guides users through series creation and management

## Task Commits

Each task was committed atomically:

1. **Task 1: Series types, CRUD manager, and episode tracking** - `a24cc7d` (feat)
2. **Task 2: Pattern detection, series CLI, and /psn:series slash command** - `cf621b1` (feat)

## Files Created/Modified
- `src/series/types.ts` - SeriesStatus, SeriesCadence, TrackingMode types, CADENCE_DAYS, Series/CreateSeriesInput/SeriesWithAnalytics interfaces
- `src/series/manager.ts` - CRUD operations with pause/resume/retire lifecycle guards, per-series analytics
- `src/series/episodes.ts` - getDueEpisodes (from lastPublishedAt), getNextEpisodeLabel, recordEpisodePublished
- `src/series/detection.ts` - detectSeriesPatterns grouping postMetrics by pillar+format
- `src/cli/series.ts` - CLI entry point with all series subcommands, JSON output
- `.claude/commands/psn/series.md` - Slash command for guided series management UX

## Decisions Made
- Re-export SeriesTemplate from schema.ts rather than redefining (single source of truth)
- Pattern detection is pure SQL aggregation + JS processing -- no ML needed for 3+ occurrence detection
- Custom tracking format uses {e} for episode number and {s} for season (stored in template metadata)
- Retired is terminal state -- enforced by state guard throwing error on un-retire attempt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Series system complete and ready for weekly plan integration (Plan 06)
- Due episodes feed directly into weekly plan slot generation
- Pattern detection available for proactive series suggestions

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
