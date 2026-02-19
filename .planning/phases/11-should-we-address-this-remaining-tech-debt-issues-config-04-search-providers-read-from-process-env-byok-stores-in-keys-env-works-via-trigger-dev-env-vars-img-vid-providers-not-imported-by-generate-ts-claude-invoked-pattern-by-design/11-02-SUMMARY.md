---
phase: 11-tech-debt-remediation
plan: 02
subsystem: intelligence-search
tags: [search-providers, db-key-lookup, hub-scoped, getApiKey]

# Dependency graph
requires:
  - phase: 11-tech-debt-remediation-01
    provides: getApiKey(), setApiKey(), listKeys() functions
provides:
  - Hub-scoped search provider key retrieval (Perplexity, Brave, Tavily, Exa)
  - DB-only key lookups (no process.env fallbacks)
affects: [11-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [hub-scoped provider key retrieval, getApiKey() pattern for search providers]

key-files:
  created: []
  modified: [src/intelligence/search/perplexity.ts, src/intelligence/search/brave-search.ts, src/intelligence/search/tavily.ts, src/intelligence/search/exa.ts]

key-decisions:
  - "DB-only approach: no process.env fallbacks for search provider keys"
  - "All search functions accept required db and hubId parameters"
  - "Functions throw clear errors with hubId when key not found"

patterns-established:
  - "getApiKey(db, hubId, service) pattern for provider key retrieval"
  - "Empty key check throws error (not silent return) for missing keys"

requirements-completed: [CONFIG-04]

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 11 Plan 2: Migrate search providers to DB key lookup Summary

**Perplexity, Brave, Tavily, Exa search providers migrated to hub-scoped getApiKey() function with db + hubId parameters**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T23:42:34Z
- **Completed:** 2026-02-19T23:45:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Migrated all 4 search providers (Perplexity, Brave, Tavily, Exa) from process.env to getApiKey()
- Added db and hubId parameters to all search functions for hub-scoped key retrieval
- Removed all process.env API_KEY references from search provider files
- Implemented clear error messages with hubId when key not found

## Task Commits

Each task was committed atomically:

1. **Task 1: Update search provider signatures and implementations** - `bc39fdf` (feat)

## Files Created/Modified

- `src/intelligence/search/perplexity.ts` - Updated to use getApiKey() with db + hubId parameters
- `src/intelligence/search/brave-search.ts` - Updated to use getApiKey() with db + hubId parameters
- `src/intelligence/search/tavily.ts` - Updated to use getApiKey() with db + hubId parameters
- `src/intelligence/search/exa.ts` - Updated to use getApiKey() with db + hubId parameters

## Decisions Made

- DB-only approach: no process.env fallbacks for search provider keys (strict)
- All search functions require db and hubId parameters (no optional parameters)
- Empty key check throws error (not silent return) for missing keys
- Service names in getApiKey calls: perplexity, brave, tavily, exa

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-06 (search and media generation wiring) can now call search providers with db + hubId
- All search providers are ready for hub-scoped key lookup in multi-tenant architecture
- No blockers or concerns

---
*Phase: 11-tech-debt-remediation*
*Completed: 2026-02-19*
