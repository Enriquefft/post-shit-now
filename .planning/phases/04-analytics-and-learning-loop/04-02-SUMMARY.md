---
phase: 04-analytics-and-learning-loop
plan: 02
subsystem: analytics
tags: [trigger.dev, x-api, engagement-metrics, fatigue-detection, cron, upsert]

# Dependency graph
requires:
  - phase: 04-analytics-and-learning-loop
    provides: postMetrics/preferenceModel tables, XClient.getTweets/getMe, scoring engine
  - phase: 02-scheduling-and-publishing
    provides: posts table, OAuth token pattern, XClient, publish-post.ts token refresh pattern
provides:
  - Daily analytics collector Trigger.dev cron task with tiered cadence
  - collectAnalytics function for fetching X metrics and upserting to postMetrics
  - Content fatigue detection (detectTopicFatigue, isTopicFatigued, updateFatiguedTopics)
  - Follower count tracking in preferenceModel.followerHistory
  - Unique index on postMetrics (postId, platform) for upsert support
affects: [04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [tiered-collection-cadence, per-post-error-isolation, fatigue-declining-trend]

key-files:
  created:
    - src/analytics/collector.ts
    - src/trigger/analytics-collector.ts
    - src/analytics/fatigue.ts
    - src/analytics/fatigue.test.ts
  modified:
    - src/core/db/schema.ts

key-decisions:
  - "Tiered cadence: 0-7 day posts every run, 8-30 day posts only if not collected in 3 days"
  - "Per-post error isolation: catch and continue, never let one post failure stop collection"
  - "Fatigue requires strictly declining scores across last 3 posts (not just lower average)"
  - "Added unique index on postMetrics (postId, platform) to enable ON CONFLICT upsert"

patterns-established:
  - "Tiered collection: filter by post age and last-collected date for API cost optimization"
  - "Fatigue detection: group by topic, sort by date, check last N for trend"

requirements-completed: [ANLYT-01, LEARN-08]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 4 Plan 02: Analytics Collector and Fatigue Detection Summary

**Daily Trigger.dev cron collecting X engagement metrics with tiered cadence, plus content fatigue detection flagging declining-trend topics with cooldown management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T08:59:24Z
- **Completed:** 2026-02-19T09:03:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Analytics collector as Trigger.dev scheduled task (6am UTC daily) with tiered collection cadence based on post age
- Thread metrics aggregated from all tweet IDs, follower count tracked per run, per-post error isolation
- Content fatigue detection with 3-consecutive-declining-scores algorithm, cooldown management with expiry
- 15 tests covering fatigue detection, status checks, and cooldown management

## Task Commits

Each task was committed atomically:

1. **Task 1: Analytics collector (Trigger.dev task + core logic)** - `043757e` (feat)
2. **Task 2: Content fatigue detection with tests** - `d627718` (feat)

## Files Created/Modified
- `src/analytics/collector.ts` - Core collection logic: tiered cadence, batch fetch, upsert, follower tracking
- `src/trigger/analytics-collector.ts` - Trigger.dev daily cron task with env loading and token refresh
- `src/analytics/fatigue.ts` - detectTopicFatigue, isTopicFatigued, updateFatiguedTopics
- `src/analytics/fatigue.test.ts` - 15 tests for fatigue detection and cooldown management
- `src/core/db/schema.ts` - Added uniqueIndex on postMetrics (postId, platform) for upsert

## Decisions Made
- Tiered cadence: 0-7 day posts collected every run; 8-30 day posts only if last collected 3+ days ago (API cost optimization)
- Per-post error isolation: individual post failures caught and logged, never stop entire collection
- Fatigue detection requires strictly declining scores (each < previous) across last 3 posts, not just lower average
- Added unique index on postMetrics (postId, platform) to enable Drizzle ON CONFLICT upsert

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added unique index on postMetrics for upsert support**
- **Found during:** Task 1 (Analytics collector)
- **Issue:** Plan specifies ON CONFLICT upsert on postId+platform, but postMetrics table had no unique constraint on these columns
- **Fix:** Added uniqueIndex("post_metrics_post_platform_idx") on (postId, platform) to schema.ts
- **Files modified:** src/core/db/schema.ts
- **Verification:** Typecheck passes, upsert target is valid
- **Committed in:** 043757e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for correctness -- upsert requires unique constraint. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analytics collector pipeline complete: daily cron fetches, scores, and stores X metrics
- Fatigue detection ready for use by content brain (/psn:post warnings) and review command
- 04-03 (review command) can query postMetrics and use fatigue detection for insights
- 04-04 (preference model) can build on follower tracking and fatigue data

## Self-Check: PASSED

All 5 files verified present. All 2 task commits verified in git log.

---
*Phase: 04-analytics-and-learning-loop*
*Completed: 2026-02-19*
