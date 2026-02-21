---
phase: 15-database-stability-recovery-p1
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, migrations, retry]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: drizzle migrations, schema tables, runMigrations function
provides:
  - Migration retry wrapper with 3-attempt retry and 2-second fixed delay
  - Table verification to confirm all 22 tables exist after migration
  - Error classification for retriable vs permanent errors
  - Detailed progress logging during migration attempts
affects: [16-voice-interview-cli-completion, 17-setup-ux-improvements, 18-provider-key-entity-configuration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Migration retry pattern with fixed 2s delay for transient network failures
    - Table verification pattern using sql.identifier() for safe interpolation
    - Error classification pattern: check non-retriable patterns first, then retriable
    - Console progress logging: [Migration attempt X/3] prefix for all messages

key-files:
  created: []
  modified:
    - src/core/db/migrate.ts - Added runMigrationsWithRetry, verifyTablesExist, isRetryableError, extractTableInfo
    - src/cli/setup-db.ts - Updated to use runMigrationsWithRetry
    - src/team/hub.ts - Updated to use runMigrationsWithRetry

key-decisions:
  - Fixed 2-second delay (not exponential backoff) — simpler for network hiccups
  - Keep partial migration state on failure (user can run /psn:setup reset --db to clean)
  - Retry limit: 3 attempts with detailed progress feedback
  - Check non-retriable patterns first (permission, syntax errors) to block them before retrying

patterns-established:
  - Migration retry pattern: for loop with attempt count, error classification, fixed delay
  - Table verification pattern: SELECT 1 FROM table LIMIT 1 for each required table
  - Error classification pattern: two arrays (non-retriable, retriable) with regex matching
  - Console logging pattern: structured [Migration attempt X/3] messages for user feedback

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-02-21T10:35:00Z
---

# Phase 15 Plan 01: Migration Retry Logic with Table Verification

**3-attempt migration retry with 2-second fixed delay, table verification for all 22 tables, and error classification distinguishing retriable vs permanent errors**

## Performance

- **Duration:** ~8min
- **Started:** 2026-02-21T10:27:12Z
- **Completed:** 2026-02-21T10:35:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added runMigrationsWithRetry() function with 3-attempt retry loop and 2-second fixed delay between retries
- Added verifyTablesExist() to confirm all 22 required tables exist after migration completes
- Added isRetryableError() to distinguish retriable (network, timeout) from permanent (permission, syntax) errors
- Added extractTableInfo() to parse error messages for table context in logging
- Updated setup-db.ts to use runMigrationsWithRetry() instead of runMigrations()
- Updated hub.ts to use runMigrationsWithRetry() for Company Hub migrations
- Preserved runMigrations() for backward compatibility

## Task Commits

1. **Task 1: Implement migration retry wrapper with table verification** - `25443c4` (feat)

**Plan metadata:** N/A (will be committed at end of phase)

## Files Created/Modified

- `src/core/db/migrate.ts` - Added runMigrationsWithRetry(), verifyTablesExist(), isRetryableError(), extractTableInfo(), and REQUIRED_TABLES constant (22 tables)
- `src/cli/setup-db.ts` - Updated import and call to use runMigrationsWithRetry()
- `src/team/hub.ts` - Updated import and call to use runMigrationsWithRetry()

## Decisions Made

None - followed plan as specified

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

None - no external service configuration required

## Next Phase Readiness

Migration retry logic is ready for use in setup-db.ts and hub.ts. Future plans (15-02, 15-03, 15-04) will add additional database stability features (hub ID generation, unified hub discovery, setup reset command). The retry wrapper is backward compatible - existing runMigrations() is preserved for any code paths that don't need retry logic.

---
*Phase: 15-database-stability-recovery-p1*
*Completed: 2026-02-21*
