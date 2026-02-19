---
phase: 11-tech-debt-remediation
plan: 01
subsystem: database
tags: [api-keys, encryption, drizzle, postgres, hub-scoped]

# Dependency graph
requires:
  - phase: 07-team-coordination-and-notifications
    provides: api_keys table with RLS policy
provides:
  - getApiKey() function for encrypted key retrieval
  - setApiKey() function for encrypted key storage
  - listKeys() function for hub key listing
  - Unique index on api_keys table for efficient lookups
affects: [11-02, 11-03, 11-04, 11-05, 11-06]

# Tech tracking
tech-stack:
  added: [src/core/db/api-keys.ts, drizzle migration 0002]
  patterns: [hub-scoped key lookup, encrypted API key storage, HUB_ENCRYPTION_KEY pattern]

key-files:
  created: [src/core/db/api-keys.ts, drizzle/migrations/0002_lyrical_the_hood.sql]
  modified: [src/core/db/schema.ts]

key-decisions:
  - "HUB_ENCRYPTION_KEY environment variable used for all encryption/decryption"
  - "Hub-scoped keys: userId = hubId (user ID for Personal Hub, hub ID for Company Hub)"
  - "listKeys() does NOT decrypt values (security best practice)"
  - "Unique index on (userId, service) for O(1) key lookups"

patterns-established:
  - "getApiKey() throws clear error messages with hubId when key not found"
  - "setApiKey() uses upsert pattern (insert if new, update if existing)"
  - "Drizzle migrations use placeholder DATABASE_URL for generation without live DB"

requirements-completed: [CONFIG-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, VID-01, VID-02, VID-03, VID-04, VID-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 11 Plan 1: Create getApiKey/setApiKey/listKeys functions Summary

**Encrypted hub-scoped API key storage with get/set/list functions and database index for O(1) lookups**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T23:37:22Z
- **Completed:** 2026-02-19T23:42:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created src/core/db/api-keys.ts with getApiKey(), setApiKey(), and listKeys() functions for managing encrypted hub-scoped API keys
- Added unique index on api_keys table for efficient O(1) lookups by userId + service
- Established encryption pattern using HUB_ENCRYPTION_KEY environment variable for all API key operations
- Enabled multi-tenant architecture with hub-scoped key isolation (Personal Hub uses user's keys, Company Hubs use company keys)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create getApiKey/setApiKey/listKeys functions** - `d8f3287` (feat)
2. **Task 2: Add schema index for efficient key lookups** - `6214922` (feat)

## Files Created/Modified

- `src/core/db/api-keys.ts` - API key management functions (getApiKey, setApiKey, listKeys) with HUB_ENCRYPTION_KEY encryption/decryption
- `src/core/db/schema.ts` - Added uniqueIndex on api_keys table for efficient lookups
- `drizzle/migrations/0002_lyrical_the_hood.sql` - Migration to create api_keys_user_service_idx

## Decisions Made

- Used HUB_ENCRYPTION_KEY environment variable for all encryption/decryption operations (single source of truth)
- Hub-scoped key lookup: userId field stores hub owner (user ID for Personal Hub, hub ID for Company Hub)
- listKeys() returns service/keyName pairs without decrypting values (security best practice - avoid exposing secrets)
- setApiKey() uses upsert pattern (check exists, update if present, insert if new)
- Unique index on (userId, service) for O(1) lookups in getApiKey() function

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Drizzle-kit generate command deprecated - used updated `generate` command instead (non-blocking, informational)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-02 (search providers) can now use getApiKey() for hub-scoped key retrieval
- Plan 11-03 (image providers) can now use getApiKey() for hub-scoped key retrieval
- Plan 11-04 (video providers) can now use getApiKey() for hub-scoped key retrieval
- Plan 11-05 (setup-keys.ts extension) can now use setApiKey() to store provider keys
- No blockers or concerns - all dependent plans can proceed

---
*Phase: 11-tech-debt-remediation*
*Completed: 2026-02-19*
