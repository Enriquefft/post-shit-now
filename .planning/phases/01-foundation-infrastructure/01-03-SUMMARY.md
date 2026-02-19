---
phase: 01-foundation-infrastructure
plan: 03
subsystem: infra
tags: [trigger-dev, cron, watchdog, health-check, scheduled-tasks]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Drizzle schema (posts table), connection factory"
provides:
  - "Post watchdog cron task (detects stuck posts)"
  - "Health check on-demand task"
  - "Trigger.dev task pattern for future phases"
affects: [phase-2, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns: [trigger-dev-schedules-task, trigger-dev-regular-task, vitest-mock-db]

key-files:
  created:
    - src/trigger/watchdog.ts
    - src/trigger/health.ts
    - src/trigger/watchdog.test.ts
  modified: []

key-decisions:
  - "Watchdog marks stuck scheduled posts as 'retry' — actual re-publish in Phase 2"
  - "Watchdog marks stuck publishing posts as 'failed' with watchdog_timeout reason"
  - "Health check is on-demand (not cron) — triggered during setup or monitoring"

patterns-established:
  - "Trigger.dev task pattern: load env -> create connection -> query -> return result"
  - "Testing pattern: mock createHubConnection, test query logic independently"
  - "Cron pattern: schedules.task with cron property for recurring tasks"

requirements-completed: [INFRA-06]

# Metrics
duration: ~10min
completed: 2026-02-18
---

# Plan 01-03: Trigger.dev Tasks Summary

**Post watchdog cron (15-min cycle) detecting stuck scheduled/publishing posts, plus on-demand health check for Hub connectivity verification**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created post watchdog scheduled task running every 15 minutes
- Watchdog detects posts stuck in "scheduled" (>5 min past due) and "publishing" (>10 min) states
- Built health check task verifying DB connectivity and env vars
- Added 5 unit tests with mocked DB for watchdog detection logic

## Task Commits

1. **Task 1: Watchdog cron** - `d563137` (feat)
2. **Task 2: Health check + tests** - `d563137` (feat, same commit)

## Files Created/Modified
- `src/trigger/watchdog.ts` - Post watchdog cron task (every 15 min)
- `src/trigger/health.ts` - On-demand health check task
- `src/trigger/watchdog.test.ts` - 5 unit tests for stuck post detection

## Decisions Made
- Exported query functions (findStuckScheduled, findStuckPublishing) for testability
- Used spread operator for logger calls to satisfy Record<string, unknown> type constraint

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
- Trigger.dev SDK logger type requires `Record<string, unknown>`, not typed interfaces -- resolved with spread operator

## User Setup Required
None - tasks will be deployed when Trigger.dev is configured.

## Next Phase Readiness
- Watchdog ready to detect stuck posts once publishing tasks exist (Phase 2)
- Health check available for setup validation
- Task patterns established for all future Trigger.dev tasks

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-18*
