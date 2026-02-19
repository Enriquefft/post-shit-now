---
phase: 11-tech-debt-remediation
plan: 03
subsystem: media-image-generation
tags: [image-providers, db-key-lookup, hub-scoped, getApiKey]

# Dependency graph
requires:
  - phase: 11-tech-debt-remediation-01
    provides: getApiKey(), setApiKey(), listKeys() functions
provides:
  - Hub-scoped image provider key retrieval (GPT Image, Ideogram, Flux)
  - DB-only key lookups (no process.env fallbacks)
affects: [11-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [hub-scoped provider key retrieval, getApiKey() pattern for image providers]

key-files:
  created: []
  modified: [src/media/image-gen.ts, src/media/providers/gpt-image.ts, src/media/providers/ideogram.ts, src/media/providers/flux.ts]

key-decisions:
  - "DB-only approach: no process.env fallbacks for image provider keys"
  - "All image providers accept required db and hubId parameters"
  - "Ideogram tries fal key first, then ideogram key (fallback pattern)"
  - "ImageProvider interface updated to accept required db + hubId"

patterns-established:
  - "getApiKey(db, hubId, service) pattern for provider key retrieval"
  - "Provider-specific service names: openai, fal, ideogram"
  - "Empty key check throws error (not silent return) for missing keys"

requirements-completed: [IMG-01, IMG-02, IMG-03, IMG-04, IMG-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 11 Plan 3: Migrate image providers to DB key lookup Summary

**GPT Image, Ideogram, Flux image providers migrated to hub-scoped getApiKey() function with db + hubId parameters**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-19T23:55:04Z
- **Completed:** 2026-02-19T23:59:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Migrated all 3 image providers (GPT Image, Ideogram, Flux) from process.env to getApiKey()
- Updated ImageProvider interface to accept required db and hubId parameters
- Updated generateImage() function to require db and hubId in options
- Removed all process.env API_KEY references from image provider files
- Implemented fallback pattern for Ideogram (fal key first, then ideogram key)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update image provider interfaces and implementations** - `4c9b94e` (feat)

## Files Created/Modified

- `src/media/image-gen.ts` - Updated ImageProvider interface and generateImage() to accept db + hubId
- `src/media/providers/gpt-image.ts` - Updated to use getApiKey() for openai service
- `src/media/providers/ideogram.ts` - Updated to use getApiKey() for fal and ideogram services with fallback
- `src/media/providers/flux.ts` - Updated to use getApiKey() for fal service

## Decisions Made

- DB-only approach: no process.env fallbacks for image provider keys (strict)
- All image providers require db and hubId parameters (no optional parameters)
- Ideogram provider tries fal key first (preferred), then ideogram key (fallback)
- Service names in getApiKey calls: openai, fal, ideogram
- Empty key check throws error (not silent return) for missing keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-06 (search and media generation wiring) can now call image providers with db + hubId
- All image providers are ready for hub-scoped key lookup in multi-tenant architecture
- No blockers or concerns

---
*Phase: 11-tech-debt-remediation*
*Completed: 2026-02-19*
