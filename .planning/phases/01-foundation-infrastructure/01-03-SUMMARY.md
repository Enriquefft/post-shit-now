---
phase: 01-foundation-infrastructure
plan: 03
subsystem: database
tags: [hub, migration, neon, json-storage]

# Dependency graph
requires:
  - phase: 01-01
    provides: database RLS migration setup
  - phase: 01-02
    provides: Neon API key validation
provides:
  - Unified hub storage in .hubs/ directory (personal.json and company-*.json)
  - Automatic migration from legacy config/hub.env to .hubs/personal.json
  - Single getHubConnection() API for both Personal and Company hubs
affects: [02-x-platform-pipeline, 03-voice-profiling-and-content-generation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Idempotent migration utility with graceful degradation
    - Unified file-based hub discovery using glob pattern matching
    - Schema validation with Zod for hub connection files

key-files:
  created: []
  modified:
    - src/core/utils/env.ts
    - src/team/hub.ts
    - src/cli/setup-db.ts

key-decisions:
  - "Hub discovery loads all .json files in .hubs/, not just company-*.json"
  - "Migration is idempotent: safe to call multiple times, handles all edge cases"
  - "Hub ID generated with crypto.randomUUID() if not present in hub.env during migration"
  - "setup-db writes to .hubs/personal.json instead of config/hub.env"

patterns-established:
  - Idempotent migration pattern: check existing state before making changes
  - Graceful degradation: return empty arrays/defaults when files don't exist
  - Schema validation at migration boundary ensures data integrity

requirements-completed: [C1]

# Metrics
duration: 0min
completed: 2026-02-21
---

# Phase 01-03: Unify Hub Storage Summary

**Personal Hub migrated from config/hub.env to .hubs/personal.json with unified getHubConnection() API for both Personal and Company hubs**

## Performance

- **Duration:** 0 min (work previously completed)
- **Started:** 2026-02-21T06:37:43Z
- **Completed:** 2026-02-21T06:37:43Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added migratePersonalHubToHubsDir() function to env.ts for automatic migration from config/hub.env to .hubs/personal.json
- Updated discoverCompanyHubs() in hub.ts to load ALL .json files in .hubs/ (not just company-*.json)
- Updated setup-db.ts to write Personal Hub connection to .hubs/personal.json and call migration on startup
- Unified getHubConnection() API now handles both "personal" and company hub slugs

## Task Commits

Work was previously completed in these commits:

1. **Task 1: Add Personal Hub migration utility to env.ts** - `d7888f7` (feat)
2. **Task 2: Update getHubConnection() to handle Personal Hub** - `6c57ab7` (feat)
3. **Task 3: Update setup-db.ts to write .hubs/personal.json** - `f1f1ee7` (feat)

## Files Created/Modified

- `src/core/utils/env.ts` - Added migratePersonalHubToHubsDir() function (lines 277-341) for automatic hub migration
- `src/team/hub.ts` - Updated discoverCompanyHubs() to load all .json files, not just company-*.json
- `src/cli/setup-db.ts` - Updated to write to .hubs/personal.json and call migration on startup

## Decisions Made

- Hub discovery pattern: Load ALL .json files in .hubs/ directory using simple iteration, not filename pattern matching - more flexible for future hub types
- Migration idempotence: Check both personal.json and hub.env existence before migrating, with multiple graceful return paths
- Hub ID generation: Use crypto.randomUUID().slice(0, 12) for missing HUB_ID in hub.env - ensures every migrated hub has unique identifier
- No backward compatibility for config/hub.env - migration deletes old file after successful migration (follows CONTEXT.md decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks implemented according to plan specifications.

## User Setup Required

None - automatic migration runs on first setup.

## Next Phase Readiness

- Personal Hub now uses same storage format as Company Hubs (.hubs/*.json)
- setup.ts voice/entity subcommands can now use getHubConnection('personal') successfully
- Ready for Phase 2 (Database Stability & Recovery)

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-21*
