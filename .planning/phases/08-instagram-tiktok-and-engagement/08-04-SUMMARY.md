---
phase: 08-instagram-tiktok-and-engagement
plan: 04
subsystem: engagement
tags: [scoring, monitoring, trigger-dev, cron, engagement, tiktok-creative-center, instagram-hashtag, x-search]

# Dependency graph
requires:
  - phase: 08-01
    provides: Instagram client with hashtag search API
  - phase: 08-02
    provides: TikTok Creative Center trending content discovery
provides:
  - Engagement opportunities DB schema with RLS (opportunities, config, log)
  - Composite opportunity scoring engine (relevance 40%, recency 30%, reach 20%, potential 10%)
  - Cross-platform engagement monitor (X search, Instagram hashtags, TikTok Creative Center)
  - Per-platform enforcement (daily caps, cooldowns, blocklists)
  - Niche keyword derivation from voice profile pillars
  - Scheduled Trigger.dev task for engagement monitoring every 3 hours
affects: [08-05-engagement-session, engagement-commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [composite-scoring-with-basis-points, per-platform-error-isolation, upsert-on-conflict]

key-files:
  created:
    - src/engagement/types.ts
    - src/engagement/scoring.ts
    - src/engagement/config.ts
    - src/engagement/monitor.ts
    - src/trigger/engagement-monitor.ts
    - drizzle/migrations/0001_wet_mach_iv.sql
  modified:
    - src/core/db/schema.ts
    - src/platforms/x/client.ts

key-decisions:
  - "X searchRecent method added to XClient for engagement discovery (missing from existing client)"
  - "Instagram hashtag budget limited to 2 searches per run to preserve 30/week budget"
  - "Notification routing uses existing notification_log table with dedup keys"
  - "NeonHttpQueryResult uses .rows[0] pattern for SELECT queries (not destructuring)"

patterns-established:
  - "Engagement scoring: basis points for DB storage, 0-100 for display/API"
  - "Platform monitoring toggle: default true if not set in config"
  - "Opportunity upsert: ON CONFLICT keeps higher composite score"

requirements-completed: [ENGAGE-01, ENGAGE-02, ENGAGE-06]

# Metrics
duration: 6min
completed: 2026-02-19
---

# Phase 8 Plan 4: Engagement Engine Summary

**Cross-platform engagement monitor with composite scoring (relevance/recency/reach/potential), DB schema with RLS, and 3-hour Trigger.dev cron for X/Instagram/TikTok discovery**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T16:17:59Z
- **Completed:** 2026-02-19T16:24:34Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Three engagement tables (opportunities, config, log) with RLS and migration
- Composite scoring engine with weighted formula and basis points conversion
- Cross-platform monitor: X search API, Instagram hashtag search, TikTok Creative Center
- Per-platform enforcement: daily caps, cooldowns, blocklists, platform toggles
- Scheduled Trigger.dev task with notification routing (push for 70+, digest for 60-69)

## Task Commits

Each task was committed atomically:

1. **Task 1: Engagement DB schema, types, and config management** - `328fc15` (feat)
2. **Task 2: Opportunity scoring engine and cross-platform monitor** - `9033244` (feat)

## Files Created/Modified
- `src/core/db/schema.ts` - Added engagementOpportunities, engagementConfig, engagementLog tables with RLS
- `src/engagement/types.ts` - Zod schemas, interfaces, platform-specific engagement types, defaults
- `src/engagement/config.ts` - Config loading/saving, daily caps, cooldowns, blocklists, niche keywords
- `src/engagement/scoring.ts` - Composite scoring, basis points conversion, engagement type suggestion
- `src/engagement/monitor.ts` - Cross-platform discovery orchestrator with per-platform error isolation
- `src/trigger/engagement-monitor.ts` - Scheduled Trigger.dev task running every 3 hours
- `src/platforms/x/client.ts` - Added searchRecent method for engagement discovery
- `drizzle/migrations/0001_wet_mach_iv.sql` - Migration for 3 engagement tables

## Decisions Made
- Added searchRecent method to XClient -- the existing client had no search capability needed for engagement discovery
- Instagram hashtag searches limited to 2 per monitoring run to preserve the 30 searches/week budget
- Notification routing reuses existing notification_log table with dedup keys to prevent duplicate alerts
- NeonHttpQueryResult SELECT pattern uses .rows[0] (not array destructuring) per established codebase pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added searchRecent method to XClient**
- **Found during:** Task 2 (Cross-platform monitor)
- **Issue:** XClient had no search/recent endpoint method needed for engagement discovery
- **Fix:** Added searchRecent() method with author expansion, user field mapping, and rate limit tracking
- **Files modified:** src/platforms/x/client.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** 9033244 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for X platform engagement discovery. No scope creep.

## Issues Encountered
- NeonHttpQueryResult type does not support array destructuring for SELECT queries -- used .rows[0] pattern consistent with existing notification/digest code

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Engagement engine foundation complete for Plan 08-05 (interactive engagement session)
- Scoring engine, config management, and DB tables ready for session-based triage and drafting
- Notification integration wired for high-score opportunity alerts

---
*Phase: 08-instagram-tiktok-and-engagement*
*Completed: 2026-02-19*
