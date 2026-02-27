---
phase: 25-trigger-env-var-delivery
plan: 01
subsystem: infra
tags: [trigger.dev, env-vars, deploy, build-extension]

requires: []
provides:
  - syncEnvVars build extension in trigger.config.ts
  - requireEnvVars() shared utility for runtime env validation
  - Env var group constants (CORE, CRYPTO, platform-specific)
affects: [25-02, trigger-tasks, deploy]

tech-stack:
  added: ["@trigger.dev/build@^4.3.3"]
  patterns: ["syncEnvVars for deploy-time credential sync", "env var group constants for per-task validation"]

key-files:
  created:
    - src/trigger/env-validation.ts
  modified:
    - trigger.config.ts
    - package.json

key-decisions:
  - "Used ^4.3.3 range for @trigger.dev/build to stay semver-compatible with SDK"
  - "TRIGGER_SECRET_KEY excluded from sync -- Cloud sets it automatically"

patterns-established:
  - "Env var groups: define readonly const arrays, spread to compose larger sets"
  - "requireEnvVars<T>(): generic validator that collects all missing vars before throwing"

requirements-completed: [DEPLOY-01, DEPLOY-03]

duration: 2min
completed: 2026-02-27
---

# Phase 25 Plan 01: Trigger.dev Env Var Delivery Summary

**syncEnvVars build extension + requireEnvVars() utility for deploy-time credential sync to Trigger.dev Cloud**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-27T16:16:17Z
- **Completed:** 2026-02-27T16:18:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Installed @trigger.dev/build for build extensions support
- Created env-validation.ts with 6 env var group constants covering all 16 required vars
- Wired syncEnvVars into trigger.config.ts to push credentials at deploy time
- Critical var validation aborts deploy if DATABASE_URL or HUB_ENCRYPTION_KEY missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Install @trigger.dev/build and create env-validation.ts** - `9d055b6` (feat)
2. **Task 2: Wire syncEnvVars into trigger.config.ts** - `496a407` (feat)

## Files Created/Modified
- `src/trigger/env-validation.ts` - Env var group constants + requireEnvVars() utility
- `trigger.config.ts` - syncEnvVars build extension for deploy-time credential sync
- `package.json` - Added @trigger.dev/build dependency

## Decisions Made
- Used ^4.3.3 version range for @trigger.dev/build to stay semver-compatible with SDK (resolved to 4.4.1 which is compatible)
- TRIGGER_SECRET_KEY intentionally excluded from all sync lists (Cloud sets it; overwriting causes auth failures)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- syncEnvVars extension ready -- `bunx trigger.dev deploy` will sync all env vars
- requireEnvVars() exported and ready for Plan 02 task adoption
- env var group constants available for per-task validation

## Self-Check: PASSED

- [x] src/trigger/env-validation.ts exists
- [x] trigger.config.ts exists
- [x] Commit 9d055b6 exists
- [x] Commit 496a407 exists

---
*Phase: 25-trigger-env-var-delivery*
*Completed: 2026-02-27*
