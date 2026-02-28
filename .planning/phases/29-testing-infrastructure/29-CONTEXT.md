# Phase 29: Testing Infrastructure - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish Vitest test runner with TypeScript path alias resolution, mock infrastructure for platform API clients, interface compliance tests for PlatformPublisher behavioral contracts, unit tests for tweet validation and thread checkpoint logic, and JSDoc behavioral contracts on public APIs. No new features or refactoring beyond what testing requires.

</domain>

<decisions>
## Implementation Decisions

### Test scope & priority
- Critical paths only — no broad coverage goal for this phase
- Focus on: publish flow, tweet validation (weighted character counting), thread checkpoint persistence and resume, platform handler contracts
- Skip utility/helper coverage, analytics, series, voice, team modules
- Interface compliance tests cover the publish flow only (publish(), postThread(), error handling), not every PlatformPublisher method

### Test data strategy
- Use real X API response shapes for test fixtures — actual response structures, not simplified stubs
- Test data doubles as API shape documentation
- Mock the DB layer (Drizzle query results), no test database or Neon branches

### JSDoc behavioral contracts
- Scope: Platform interfaces only — PlatformPublisher, PlatformClient, handler methods
- Skip internal helpers and non-platform exports
- Style: Caller contracts — preconditions, postconditions, error behavior, side effects
- Example: "Throws SkipRetryError if Error 187 detected. Saves checkpoint to DB on partial failure."
- @throws tags for non-obvious errors only — SkipRetryError, partially_posted behavior, checkpoint side effects. Skip obvious ones (DB connection, network)
- Location: Interface/type definitions only (single source of truth). Implementations inherit the contract.

### Claude's Discretion
- Mock implementation details (hand-crafted vs factory pattern)
- Test file organization (co-located vs __tests__ dirs)
- Vitest configuration specifics (pool, reporters, coverage thresholds)
- Which specific API response fixtures to capture

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-testing-infrastructure*
*Context gathered: 2026-02-28*
