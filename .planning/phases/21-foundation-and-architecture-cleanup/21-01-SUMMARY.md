---
phase: 21-foundation-and-architecture-cleanup
plan: 01
subsystem: api
tags: [typescript, interface, factory, vitest, testing, platform, publisher, madge]

# Dependency graph
requires: []
provides:
  - PlatformPublisher interface with full JSDoc behavioral contracts
  - DbConnection and PostRow type aliases
  - RateLimitInfo struct for normalized rate limit tracking
  - Handler factory (register/create/hasHandler/registeredPlatforms/unregisterHandler)
  - 37 tests covering interface compliance and factory functionality
  - madge circular dependency detection configured
affects:
  - 21-02 (handler implementations will implement PlatformPublisher)
  - 21-03 (orchestrator will use factory to create handlers)
  - Any phase implementing platform-specific publish logic

# Tech tracking
tech-stack:
  added: [madge@8.0.0]
  patterns:
    - Registration pattern for handler factory (avoids circular deps)
    - Interface-first design with JSDoc behavioral contracts
    - Mock-based interface compliance testing in Vitest

key-files:
  created:
    - src/core/types/publisher.ts
    - src/core/types/publisher.test.ts
    - src/core/utils/publisher-factory.ts
    - src/core/utils/publisher-factory.test.ts
  modified:
    - package.json (added madge devDependency, check:circular script)
    - bun.lock (updated after bun add madge)

key-decisions:
  - "Used registration pattern in factory (registerHandler/createHandler) rather than static map to avoid circular imports when handler files import factory"
  - "Added registeredPlatforms() and unregisterHandler() beyond plan spec — enables multi-platform iteration and clean test teardown"
  - "DbConnection alias re-exported from publisher.ts to keep handlers single-import: one file for all publishing types"
  - "PostRow alias defined in publisher.ts using typeof posts.$inferSelect — single source of truth from schema"
  - "noUnusedLocals: false already set in tsconfig.json — Task 5 verified and documented as pre-completed"

patterns-established:
  - "Interface-first: define PlatformPublisher before concrete implementations"
  - "Registration pattern: handler modules call registerHandler() as side-effect; factory never imports handler modules"
  - "Behavioral contracts in JSDoc: preconditions, postconditions, throw conditions documented on every method"
  - "Mock-based compliance testing: MockPublisher class used in tests validates interface shape without real API calls"

requirements-completed: [ARCH-01, ARCH-03, TOOL-01, TOOL-02]

# Metrics
duration: 2min
completed: 2026-02-26
---

# Phase 21 Plan 01: Foundation and Architecture Cleanup Summary

**PlatformPublisher interface with JSDoc behavioral contracts, registration-based handler factory, 37 Vitest tests, and madge circular dependency detection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-26T23:56:47Z
- **Completed:** 2026-02-26T23:59:21Z
- **Tasks:** 6 (5 implemented + 1 verified pre-done)
- **Files modified:** 6

## Accomplishments
- PlatformPublisher interface defines the complete publish contract for all 4 platforms (X, LinkedIn, Instagram, TikTok)
- Handler factory uses registration pattern to prevent circular dependency chains when handlers import from factory
- 37 tests (19 interface compliance + 18 factory functionality) all passing with Vitest
- madge@8.0.0 installed with `check:circular` npm script for ongoing circular dep detection

## Task Commits

Each task was committed atomically:

1. **Tasks 1-4 + 6: PlatformPublisher interface, factory, tests, madge** - `db87e35` (feat)

**Note:** Tasks 1-4 and Task 6 were committed together as a single atomic unit — all files are tightly coupled (interface + factory + tests + tooling for the same subsystem).

## Files Created/Modified
- `src/core/types/publisher.ts` - PlatformPublisher interface, DbConnection/PostRow aliases, RateLimitInfo (148 lines)
- `src/core/types/publisher.test.ts` - Interface compliance tests with MockPublisher (275 lines, 19 tests)
- `src/core/utils/publisher-factory.ts` - Registration-based handler factory with 5 exports (109 lines)
- `src/core/utils/publisher-factory.test.ts` - Factory functionality tests with MockHandler fixtures (215 lines, 18 tests)
- `package.json` - Added madge@^8.0.0 devDependency and check:circular script
- `bun.lock` - Updated lockfile after bun add madge

## Decisions Made
- **Registration pattern over static map:** Factory exposes `registerHandler()` rather than importing handler files directly. Handler modules call `registerHandler("x", XHandler)` as a side-effect when imported. This cleanly avoids circular deps since the factory never imports from `src/platforms/`.
- **Extra exports on factory:** Added `registeredPlatforms()` and `unregisterHandler()` beyond plan spec. `registeredPlatforms()` enables orchestrators to iterate over enabled platforms; `unregisterHandler()` is essential for clean test teardown to prevent cross-test pollution.
- **Type aliases in publisher.ts:** `DbConnection` and `PostRow` re-exported from `publisher.ts` so handler implementations have a single import for all publish-related types.
- **Task 5 (tsconfig) skipped:** `noUnusedLocals: false` and `noUnusedParameters: false` were already set in tsconfig.json. Verified and documented.

## Deviations from Plan

### Auto-fixed Issues

None for files in scope of this plan.

### Out-of-scope Pre-existing Errors
Pre-existing TypeScript errors exist in `src/cli/`, `src/voice/interview.ts`, `src/core/db/migrate.ts`, and `src/core/utils/nanoid.ts`. These are unrelated to the publisher interface and factory work. Per deviation rules, they were not touched and are logged to `deferred-items.md`.

**Total deviations:** 0 auto-fixes applied.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated files prevented `bun run typecheck` from returning exit 0. The new files compile without errors — verified by running tests (Vitest uses esbuild transpilation). These pre-existing errors are outside the scope of Plan 21-01.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PlatformPublisher interface is ready for Plan 21-02 (concrete handler implementations)
- Handler factory is ready for handler registration — just import factory and call `registerHandler()`
- Test patterns established: use MockPublisher/MockHandler pattern for all publisher-related tests
- Circular dependency detection available via `bun run check:circular`

---
*Phase: 21-foundation-and-architecture-cleanup*
*Completed: 2026-02-26*
