---
phase: 05-intelligence-ideation-and-planning
plan: 04
subsystem: automation
tags: [trigger.dev, cron, trends, intelligence, scheduling]

# Dependency graph
requires:
  - phase: 05-01
    provides: "DB schema with trends and ideas tables"
  - phase: 05-02
    provides: "collectTrends, collectBreakingNews, scoreTrends, generateAngleStubs"
  - phase: 05-03
    provides: "expireTimelyIdeas from ideas/lifecycle.ts"
provides:
  - "Daily trend collector cron task (6 AM UTC)"
  - "Breaking news poller cron task (every 3 hours business hours)"
  - "Idea expiry cron task (7 AM UTC)"
affects: [05-05, 05-06, planning, intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Trigger.dev schedules.task with upsert ON CONFLICT pattern", "YAML pillar loading for cron context"]

key-files:
  created:
    - src/trigger/trend-collector.ts
    - src/trigger/trend-poller.ts
    - src/trigger/idea-expiry.ts
  modified:
    - src/core/db/schema.ts

key-decisions:
  - "Added unique index on trends (user_id, title, source) for upsert support"
  - "ON CONFLICT updates score only if new score is higher (GREATEST)"
  - "Poller does NOT prune old trends -- daily collector handles that"
  - "Lightweight YAML parsing reused from collector pattern for pillar loading"

patterns-established:
  - "Upsert with GREATEST for score-based deduplication in trends table"
  - "Cron task chain: collector at 6 AM, expiry at 7 AM (1-hour gap for fresh data)"

requirements-completed: [INTEL-01, INTEL-02, INTEL-06, IDEA-04]

# Metrics
duration: 2min
completed: 2026-02-19
---

# Phase 5 Plan 4: Scheduled Tasks Summary

**Three Trigger.dev cron tasks for daily trend collection, breaking news polling, and idea expiry cleanup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T11:08:43Z
- **Completed:** 2026-02-19T11:11:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Daily trend collector at 6 AM UTC pulls from all available sources, scores against pillars, stores with 30-day expiry, and prunes expired entries
- Breaking news poller every 3 hours during business hours (8 AM-8 PM UTC) for fast HN + X trending detection
- Both tasks generate angle stubs for high-scoring trends (70+) per INTEL-06
- Idea expiry task at 7 AM UTC auto-kills timely ideas past their expiration date

## Task Commits

Each task was committed atomically:

1. **Task 1: Create trend collector and breaking news poller** - `a24cc7d` (feat)
2. **Task 2: Create idea expiry task** - `069f031` (feat)

## Files Created/Modified
- `src/trigger/trend-collector.ts` - Daily 6 AM trend collection from all sources with scoring and pruning
- `src/trigger/trend-poller.ts` - 3-hour breaking news poller (HN + X only)
- `src/trigger/idea-expiry.ts` - Daily 7 AM idea expiry checker
- `src/core/db/schema.ts` - Added unique index on trends (user_id, title, source) for upsert

## Decisions Made
- Added unique index on trends table (user_id, title, source) -- required for ON CONFLICT upsert pattern
- ON CONFLICT uses GREATEST to keep the higher score and only updates angles/relevance when new score wins
- Poller intentionally omits pruning -- daily collector handles cleanup to avoid race conditions
- Lightweight YAML pillar parsing reused from collector.ts pattern (no yaml dependency)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added unique index on trends table for upsert support**
- **Found during:** Task 1 (trend collector)
- **Issue:** ON CONFLICT on (user_id, title, source) requires a unique index, but trends table had none
- **Fix:** Added uniqueIndex("trends_user_title_source_idx") to schema.ts
- **Files modified:** src/core/db/schema.ts
- **Verification:** TypeScript compiles, schema is correct
- **Committed in:** a24cc7d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for the upsert pattern specified in the plan. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three background tasks ready to be deployed to Trigger.dev Cloud
- Trend data will accumulate daily once deployed
- Breaking news captured every 3 hours during business hours
- Idea bank stays clean with daily expiry checks
- Ready for 05-05 (planning engine) which consumes stored trends

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
