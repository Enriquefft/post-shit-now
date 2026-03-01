---
phase: 01-fix-instagram-integration-bugs
plan: 01
subsystem: auth
tags: [instagram, oauth, metadata, callback-url]

requires: []
provides:
  - "Fixed Instagram OAuth token metadata key (accountId) matching downstream consumers"
  - "Local callback URL for Instagram OAuth flow"
affects: [instagram-handler, analytics-collector, engagement-monitor]

tech-stack:
  added: []
  patterns: ["Shared OAuth callback constants from x/oauth.ts"]

key-files:
  created: []
  modified:
    - src/cli/setup-instagram-oauth.ts

key-decisions:
  - "Reuse X OAuth callback constants rather than duplicating values"
  - "No migration shim for old tokens -- users re-run setup to get correct key"

patterns-established:
  - "All platform OAuth setups use shared OAUTH_CALLBACK_HOSTNAME/PORT constants"

requirements-completed: []

duration: 2min
completed: 2026-03-01
---

# Phase 01 Plan 01: Fix Instagram OAuth Setup Summary

**Fixed Instagram OAuth metadata key from userId to accountId and replaced example.com callback with local OAuth server URL**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T03:09:00Z
- **Completed:** 2026-03-01T03:11:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed metadata key mismatch that silently broke all Instagram publish, analytics, and engagement flows
- Replaced hardcoded example.com callback URL with local OAuth callback server (127.0.0.1:18923)
- Updated setup instructions to reference the correct callback URL

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix accountId metadata key and callback URL** - `7a7cff3` (fix)

## Files Created/Modified
- `src/cli/setup-instagram-oauth.ts` - Fixed accountId key, callback URL, and setup instructions

## Decisions Made
- Reused `OAUTH_CALLBACK_HOSTNAME` and `OAUTH_CALLBACK_PORT` from `src/platforms/x/oauth.ts` rather than hardcoding values -- single source of truth
- No migration shim needed for existing tokens with wrong key -- users re-run setup which writes the correct key

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Instagram OAuth now writes correct metadata key, unblocking handler, analytics, and engagement flows
- Plans 02 and 03 in this phase can proceed to fix related Instagram integration issues

---
*Phase: 01-fix-instagram-integration-bugs*
*Completed: 2026-03-01*
