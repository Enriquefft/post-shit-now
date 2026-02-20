---
phase: 11-tech-debt-remediation
plan: 05
subsystem: cli-setup
tags: [setup-keys, db-key-lookup, provider-management, hub-scoped]

# Dependency graph
requires:
  - phase: 11-tech-debt-remediation-01
    provides: getApiKey(), setApiKey(), listKeys() functions
provides:
  - Provider key management via DB (perplexity, brave, tavily, exa, openai, ideogram, fal, runway)
  - /psn:setup keys subcommand for key management
affects: [11-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [hub-scoped provider keys, DB-only key storage, backward-compatible Phase 1 keys]

key-files:
  created: []
  modified: [src/cli/setup-keys.ts, src/cli/setup.ts]

key-decisions:
  - "Provider keys stored in DB via setApiKey() (not keys.env)"
  - "Phase 1 keys (NEON_API_KEY, TRIGGER_SECRET_KEY) still use keys.env for backward compatibility"
  - "Hub ID extracted from hub.env for provider key operations"
  - "/psn:setup keys subcommand supports --list and --service flags"

patterns-established:
  - "setupProviderKeys() checks DB before prompting for missing keys"
  - "writeProviderKey() stores keys encrypted in api_keys table"
  - "listProviderKeys() returns configured services without decrypting values"

requirements-completed: [CONFIG-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, VID-01, VID-02, VID-03, VID-04, VID-05]

# Metrics
duration: 8min
completed: 2026-02-20
---

# Phase 11 Plan 5: Extend /psn:setup to collect and store all provider API keys Summary

**Provider key management wizard for all 9 providers (perplexity, brave, tavily, exa, openai, ideogram, fal, runway) stored encrypted in api_keys table**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-20T01:02:56Z
- **Completed:** 2026-02-20T01:10:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Extended setup-keys.ts with provider key management functions (setupProviderKeys, writeProviderKey, listProviderKeys)
- Integrated provider key collection into /psn:setup workflow
- Added keys subcommand with --list and --service flags for key management
- Provider keys stored in encrypted api_keys table via setApiKey()
- Backward compatible with existing Phase 1 keys (still use keys.env)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend setup-keys.ts for full provider collection** - `5664e6e` (feat)
2. **Task 2: Integrate provider key wizard into /psn:setup** - `5664e6e` (feat)

## Files Created/Modified

- `src/cli/setup-keys.ts` - Extended with provider key management functions (setupProviderKeys, writeProviderKey, listProviderKeys)
- `src/cli/setup.ts` - Integrated provider key collection and keys subcommand support

## Decisions Made

- Provider keys stored in DB via setApiKey() (not keys.env) for hub-scoped access
- Phase 1 keys (NEON_API_KEY, TRIGGER_SECRET_KEY) still use keys.env for backward compatibility
- Hub ID extracted from hub.env for provider key operations (falls back to "default" for Personal Hub)
- /psn:setup keys subcommand supports --list (show all keys) and --service (add specific key) flags
- Provider list includes all 9 services: perplexity, brave, tavily, exa, openai, ideogram, fal, runway

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-06 (search and media generation wiring) can use provider key management
- All provider keys can be configured via /psn:setup keys subcommand
- No blockers or concerns

---
*Phase: 11-tech-debt-remediation*
*Completed: 2026-02-20*
