---
phase: 22-documentation-and-module-boundaries
plan: "03"
subsystem: api
tags: [typescript, barrels, module-boundaries, circular-deps, platforms, core]

# Dependency graph
requires:
  - phase: 21-foundation-and-architecture-cleanup
    provides: PlatformPublisher interface, handler classes, publisher-factory
  - phase: 22-01
    provides: root CLAUDE.md with module map (@psn/core, @psn/platforms aliases)
  - phase: 22-02
    provides: module CLAUDE.md files documenting ownership and key files
provides:
  - src/platforms/index.ts — public API barrel for @psn/platforms (handler classes + factory + contract types)
  - src/core/index.ts — public API barrel for @psn/core (shared types + DB + crypto)
affects: [src/trigger, .claude/commands, tests, any consumer of @psn/core or @psn/platforms]

# Tech tracking
tech-stack:
  added: []
  patterns: [barrel-file-module-boundaries, selective-re-export-for-circular-safety]

key-files:
  created:
    - src/platforms/index.ts
    - src/core/index.ts
  modified: []

key-decisions:
  - "src/core/index.ts selectively re-exports from types/index.ts — cross-module types (ApprovalAction, LinkedInOAuthConfig, HubConnection, MessageResult, etc.) are excluded to prevent circular dependencies"
  - "src/platforms/index.ts imports handler classes from individual handler files (not from handlers/index.ts) — handlers/index.ts is an internal auto-registration barrel with different semantics"
  - "DbClient and HubDb types exported from core barrel alongside createHubConnection — consumers get complete DB surface from one import"
  - "Handler auto-registration side-effects are accepted: importing handlers via the public barrel registers them in the factory registry, which is expected consumer behavior"

patterns-established:
  - "Barrel-per-module pattern: each top-level src/ module gets an index.ts defining its public API surface"
  - "Selective re-export: core barrel only re-exports types that are genuinely core — cross-module types stay in their owning module"
  - "Internal vs public barrel distinction: handlers/index.ts (internal, side-effect auto-registration) vs platforms/index.ts (public API, explicit named exports)"

requirements-completed: [ARCH-08, ARCH-09, ARCH-10]

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 22 Plan 03: Module API Barrels Summary

**Two top-level public API barrels defining @psn/core and @psn/platforms module boundaries — enabling single-import consumption with no circular dependencies**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T07:48:25Z
- **Completed:** 2026-02-27T07:52:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `src/platforms/index.ts` — exports PlatformPublisher contract types, all four handler classes (XHandler, LinkedInHandler, InstagramHandler, TikTokHandler), and five factory functions (createHandler, registerHandler, hasHandler, registeredPlatforms, unregisterHandler)
- Created `src/core/index.ts` — selectively exports 12 core types, publisher contract types, createHubConnection + DbClient/HubDb, and crypto utils (encrypt, decrypt, keyFromHex)
- `bun run check:circular` passes with zero cycles — selective re-export strategy successfully avoids the LinkedInOAuthConfig circular path
- `bun run typecheck` shows only pre-existing errors (predated this plan per 22-02 SUMMARY)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/platforms/index.ts public API barrel** - `b809e11` (feat)
2. **Task 2: Create src/core/index.ts public API barrel and verify no circular deps** - `9487290` (feat)

## Files Created/Modified

- `src/platforms/index.ts` — public API barrel: PlatformPublisher contract, all four handlers, factory functions
- `src/core/index.ts` — public API barrel: selective core types, DB connection, crypto utils

## Decisions Made

- `src/core/index.ts` selectively re-exports from `types/index.ts`. The cross-module types (ApprovalAction, LinkedInOAuthConfig, HubConnection, MessageResult, etc.) that are re-exported from types/index.ts via other module imports are excluded from the core barrel to prevent circular dependency: core/index.ts → platforms/linkedin/types.ts → back to core.
- Handler files imported individually in platforms barrel (not via handlers/index.ts) because handlers/index.ts is an internal auto-registration barrel — different semantics and different audience from the public barrel.
- `DbClient` and `HubDb` type aliases from connection.ts included in the core barrel — they are the natural companion exports to `createHubConnection`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Module boundaries are now formalized: @psn/core and @psn/platforms have clear public APIs
- Consumers (Trigger.dev tasks, slash commands, tests) can now import from a single path per module
- Phase 22 (documentation-and-module-boundaries) is now complete: CLAUDE.md navigation (22-01), module CLAUDE.md files (22-02), and top-level API barrels (22-03)
- Ready for next phase — module map documented in root CLAUDE.md with aliases matching these barrels

---
*Phase: 22-documentation-and-module-boundaries*
*Completed: 2026-02-27*
