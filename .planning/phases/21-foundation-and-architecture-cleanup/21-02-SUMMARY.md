---
phase: 21-foundation-and-architecture-cleanup
plan: "02"
subsystem: api
tags: [trigger.dev, platform-handlers, publisher-factory, drizzle, oauth, vitest]

requires:
  - phase: 21-01
    provides: PlatformPublisher interface and publisher-factory with registerHandler/createHandler

provides:
  - XHandler implementing PlatformPublisher (src/platforms/handlers/x.handler.ts)
  - LinkedInHandler implementing PlatformPublisher (src/platforms/handlers/linkedin.handler.ts)
  - InstagramHandler implementing PlatformPublisher (src/platforms/handlers/instagram.handler.ts)
  - TikTokHandler implementing PlatformPublisher (src/platforms/handlers/tiktok.handler.ts)
  - Handler barrel exports with auto-registration side-effects (src/platforms/handlers/index.ts)
  - publish-post.ts refactored to pure orchestration under 200 lines
  - publish-helpers.ts with markFailed, advanceSeriesState, updateBrandPreferenceIfCompany
  - Integration tests for orchestration layer (6 tests)
  - Biome maxSize 204800 bytes file size limit

affects:
  - any phase adding new platform support (must implement PlatformPublisher)
  - 21-03+ phases that may extend orchestration or add platform handlers
  - health-check tasks using validateCredentials()

tech-stack:
  added: []
  patterns:
    - Handler registration via side-effect import (handlers/index.ts auto-registers all handlers)
    - Factory pattern for platform dispatch (createHandler(platform) -> PlatformPublisher)
    - Private helper method extraction for 200-line limit compliance (postThread, publishByFormat)
    - vi.mock of barrel exports to prevent side-effect registration in tests

key-files:
  created:
    - src/platforms/handlers/x.handler.ts
    - src/platforms/handlers/linkedin.handler.ts
    - src/platforms/handlers/instagram.handler.ts
    - src/platforms/handlers/tiktok.handler.ts
    - src/platforms/handlers/index.ts
    - src/trigger/publish-helpers.ts
    - src/trigger/publish-post.test.ts
  modified:
    - src/trigger/publish-post.ts
    - biome.json

key-decisions:
  - "publish-helpers.ts created to hold markFailed/advanceSeriesState/updateBrandPreferenceIfCompany since they touch shared DB state and helpers + orchestration core would exceed 200 lines in a single file"
  - "LinkedIn visibility typed as 'PUBLIC' | 'CONNECTIONS' cast from string metadata to satisfy client method signatures"
  - "Test mocks handlers/index.ts barrel to prevent real handler registration overwriting test mock handlers"
  - "Handler private methods (postThread for X, publishByFormat for LinkedIn/Instagram/TikTok) keep each class under 200 lines"

patterns-established:
  - "Side-effect auto-registration: each handler calls registerHandler() at module init; orchestrator imports handlers/index.ts"
  - "PlatformPublisher 200-line limit: extract private helpers as class methods for complex platform logic"
  - "Integration test isolation: vi.mock barrel exports to control handler registry in tests"

requirements-completed: [ARCH-02, ARCH-04, ARCH-05, TOOL-03]

duration: 32min
completed: 2026-02-27
---

# Phase 21 Plan 02: Platform Handlers and Orchestration Refactor Summary

**Monolithic 1,238-line publish-post.ts decomposed into four PlatformPublisher handlers (each under 200 lines) plus a 184-line pure orchestration layer using factory dispatch**

## Performance

- **Duration:** 32 min
- **Started:** 2026-02-27T00:02:42Z
- **Completed:** 2026-02-27T00:34:00Z
- **Tasks:** 8
- **Files modified:** 9

## Accomplishments
- Created four platform handlers (X, LinkedIn, Instagram, TikTok) each implementing PlatformPublisher interface and under 200 lines
- Refactored publish-post.ts from 1,238 lines to 184 lines of pure orchestration using createHandler() factory dispatch
- Extracted shared helpers (markFailed, advanceSeriesState, updateBrandPreferenceIfCompany) to publish-helpers.ts
- All 189 tests pass including 6 new integration tests for the orchestration layer
- Biome maxSize 204800 enforces file size limits going forward

## Task Commits

Each task was committed atomically:

1. **Tasks 1-4: Platform handlers + barrel index** - `eaf315f` (feat)
2. **Task 5: Refactor publish-post.ts to orchestration** - `c49836a` (refactor)
3. **Tasks 6-7: Biome config + integration tests** - `e346fa8` (feat)

## Files Created/Modified
- `src/platforms/handlers/x.handler.ts` - X handler with thread posting, media upload, token refresh, rate limit via wait.until()
- `src/platforms/handlers/linkedin.handler.ts` - LinkedIn handler with document/image/article/text post switch
- `src/platforms/handlers/instagram.handler.ts` - Instagram handler with reel/carousel/image container workflow
- `src/platforms/handlers/tiktok.handler.ts` - TikTok handler with chunked video upload and photo posts
- `src/platforms/handlers/index.ts` - Barrel exports; importing registers all handlers as side-effect
- `src/trigger/publish-post.ts` - Refactored to 184-line orchestration: createHandler(platform).publish()
- `src/trigger/publish-helpers.ts` - markFailed, advanceSeriesState, updateBrandPreferenceIfCompany
- `src/trigger/publish-post.test.ts` - 6 integration tests: dispatch, skips, partial failure, all-failed, approval gate
- `biome.json` - Added maxSize: 204800

## Decisions Made
- Extracted helpers to publish-helpers.ts because the orchestration core (185 lines) + 3 helper functions (~130 lines) would exceed the 200-line limit in a single file
- LinkedIn visibility cast from `string` to `"PUBLIC" | "CONNECTIONS"` since metadata comes as a generic string
- Test file mocks `../platforms/handlers/index.ts` to prevent real handler side-effect registration from overwriting mock handlers in tests
- Private methods (postThread for X, publishByFormat for all 4) keep handler classes under 200 lines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] LinkedIn visibility type mismatch**
- **Found during:** Task 8 (Validate architecture - typecheck)
- **Issue:** `metadata.linkedinVisibility` typed as `string` but client methods expect `"PUBLIC" | "CONNECTIONS" | undefined`
- **Fix:** Added cast `(metadata.linkedinVisibility ?? "PUBLIC") as "PUBLIC" | "CONNECTIONS"` and typed `publishByFormat` visibility param correctly
- **Files modified:** `src/platforms/handlers/linkedin.handler.ts`
- **Verification:** `bun run typecheck` shows zero errors in src/platforms/handlers/
- **Committed in:** eaf315f

**2. [Rule 1 - Bug] Test handler overwritten by side-effect import**
- **Found during:** Task 8 (Run integration tests)
- **Issue:** First test "dispatches to handler via factory and returns published" failed because importing publish-post.ts triggered the real handlers/index.ts side-effect, re-registering real handlers over the test's mock handler
- **Fix:** Added `vi.mock("../platforms/handlers/index.ts", () => ({}))` to prevent real handler registration in tests
- **Files modified:** `src/trigger/publish-post.test.ts`
- **Verification:** All 6 integration tests pass; 189 total tests pass
- **Committed in:** e346fa8

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- None beyond the auto-fixed deviations above

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four platform handlers are registered and callable via `createHandler(platform)`
- PlatformPublisher interface is fully implemented across all platforms
- publish-post.ts is a clean orchestration layer ready for future platform additions
- Any new platform requires: implement PlatformPublisher, call registerHandler() at module init, export from handlers/index.ts

---
*Phase: 21-foundation-and-architecture-cleanup*
*Completed: 2026-02-27*

## Self-Check: PASSED

All artifacts verified:
- x.handler.ts: FOUND (173 lines, under 200)
- linkedin.handler.ts: FOUND (182 lines, under 200)
- instagram.handler.ts: FOUND (166 lines, under 200)
- tiktok.handler.ts: FOUND (160 lines, under 200)
- handlers/index.ts: FOUND (15 lines)
- publish-post.ts: FOUND (184 lines, under 200)
- publish-post.test.ts: FOUND
- 21-02-SUMMARY.md: FOUND

Commits verified: eaf315f, c49836a, e346fa8
Tests: 189/189 pass
