---
phase: 25-trigger-env-var-delivery
plan: 02
subsystem: infra
tags: [trigger.dev, env-vars, validation, runtime-checks]

requires:
  - phase: 25-01
    provides: requireEnvVars() utility and env var group constants
provides:
  - All 12 trigger tasks using standardized env var validation
  - Consistent actionable error messages on missing env vars
affects: [trigger-tasks, deploy, monitoring]

tech-stack:
  added: []
  patterns: ["requireEnvVars() at top of every task run() for upfront validation", "env var group constants composed per-task (CORE, CRYPTO, platform-specific)"]

key-files:
  created: []
  modified:
    - src/trigger/publish-post.ts
    - src/trigger/health.ts
    - src/trigger/engagement-monitor.ts
    - src/trigger/trend-poller.ts
    - src/trigger/trend-collector.ts
    - src/trigger/watchdog.ts
    - src/trigger/analytics-collector.ts
    - src/trigger/token-refresher.ts
    - src/trigger/notification-dispatcher.ts
    - src/trigger/digest-compiler.ts
    - src/trigger/monthly-analysis.ts
    - src/trigger/idea-expiry.ts

key-decisions:
  - "Notification provider vars (WAHA/Twilio) remain conditionally checked -- not forced via requireEnvVars since provider is user-configurable"
  - "Per-platform vars in analytics-collector and token-refresher use requireEnvVars with platform-specific task IDs (e.g. analytics-collector/x) for clear error attribution"

patterns-established:
  - "Every trigger task calls requireEnvVars() as first line of run() -- no raw process.env reads for core/crypto vars"
  - "Platform-specific env var groups validated per-section with scoped task IDs"

requirements-completed: [DEPLOY-02]

duration: 6min
completed: 2026-02-27
---

# Phase 25 Plan 02: Trigger Task Env Var Adoption Summary

**All 12 trigger tasks migrated to requireEnvVars() with grouped constants -- zero raw process.env.DATABASE_URL or HUB_ENCRYPTION_KEY reads remain**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T16:20:09Z
- **Completed:** 2026-02-27T16:26:10Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Migrated all 12 trigger tasks from ad-hoc process.env checks to requireEnvVars()
- Removed 3+ inconsistent validation patterns (throw, return error, log+skip) in favor of single standardized approach
- Every task now validates ALL required env vars upfront with a single actionable error listing all missing vars
- Platform-specific tasks (analytics-collector, token-refresher) use per-section requireEnvVars for granular error attribution

## Task Commits

Each task was committed atomically:

1. **Task 1: Update core tasks to use requireEnvVars** - `9734667` (feat)
2. **Task 2: Update platform and notification tasks to use requireEnvVars** - `7f0286c` (feat)

## Files Created/Modified
- `src/trigger/publish-post.ts` - CRYPTO_ENV_VARS validation
- `src/trigger/health.ts` - CORE_ENV_VARS validation
- `src/trigger/engagement-monitor.ts` - CRYPTO_ENV_VARS validation
- `src/trigger/trend-poller.ts` - CRYPTO_ENV_VARS validation
- `src/trigger/trend-collector.ts` - CRYPTO_ENV_VARS validation
- `src/trigger/watchdog.ts` - CORE_ENV_VARS validation
- `src/trigger/analytics-collector.ts` - CRYPTO_ENV_VARS core + per-platform groups
- `src/trigger/token-refresher.ts` - CRYPTO_ENV_VARS core + per-platform groups
- `src/trigger/notification-dispatcher.ts` - CORE_ENV_VARS (WAHA/Twilio conditional)
- `src/trigger/digest-compiler.ts` - CORE_ENV_VARS (WAHA/Twilio conditional)
- `src/trigger/monthly-analysis.ts` - CORE_ENV_VARS
- `src/trigger/idea-expiry.ts` - CORE_ENV_VARS

## Decisions Made
- Notification provider vars (WAHA_BASE_URL, TWILIO_ACCOUNT_SID, etc.) remain conditionally checked via raw process.env in helper functions. These are optional based on which provider the user configured -- forcing them via requireEnvVars would break users who only use one provider.
- Per-platform sections in analytics-collector and token-refresher use scoped task IDs (e.g. "analytics-collector/x", "token-refresher/linkedin") so error messages pinpoint exactly which platform section is missing vars.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 trigger tasks now use requireEnvVars() -- env var delivery pipeline complete
- Phase 25 (Trigger.dev Env Var Delivery) fully complete
- Ready for deployment with `bunx trigger.dev deploy`

## Self-Check: PASSED

- [x] All 12 task files modified
- [x] Commit 9734667 exists
- [x] Commit 7f0286c exists
- [x] 0 raw process.env.DATABASE_URL reads remain in task files
- [x] 0 raw process.env.HUB_ENCRYPTION_KEY reads remain in task files
- [x] 21 requireEnvVars calls across task files (12 core + 9 per-platform)

---
*Phase: 25-trigger-env-var-delivery*
*Completed: 2026-02-27*
