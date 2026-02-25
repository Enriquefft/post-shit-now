# Research Summary: Agentic Architecture Improvements

**Project:** Post Shit Now (PSN) v1.2
**Domain:** TypeScript/Node.js social media publishing orchestration
**Researched:** 2026-02-25
**Overall confidence:** HIGH

## Executive Summary

Current `publish-post.ts` (1,239 lines) is a monolithic Trigger.dev task that directly imports all platform clients (X, LinkedIn, Instagram, TikTok), handles token refresh inline, and orchestrates multi-platform publishing with partial failure isolation. This architecture makes it difficult for AI assistants to understand component boundaries, modify one platform without affecting others, and reason about dependencies.

**Recommended refactoring:** Extract platform-specific publishing logic into `PlatformPublisher` interface implementations, create shared utilities for cross-cutting concerns (token management, media uploads, error handling), and reduce `publish-post.ts` to orchestration-only (<200 lines). This follows the strategy pattern with dependency injection, enabling AI to understand and modify individual platforms independently.

**Key insight:** The monolithic structure is the primary friction point for agentic development. AI assistants struggle to make targeted changes because all platform logic is coupled in one file with no interface contracts. Splitting into focused modules (<200 lines each) with clear interfaces enables AI to work on a single platform without needing to understand the entire system.

## Key Findings

**Stack:** TypeScript 5.9.3, Bun runtime, Trigger.dev Cloud, Neon Postgres (Drizzle ORM), Vitest for testing
**Architecture:** Strategy pattern with PlatformPublisher interface, factory pattern for platform selection, dependency injection via constructor
**Critical pitfall:** Duplicate token refresh logic across 4 platforms (~500 lines repeated code) and rate limit handling duplication

## Implications for Roadmap

Based on research, suggested phase structure for agentic architecture improvements:

1. **Phase 1: Define Interface Contracts** - Create `PlatformPublisher` interface with `PublishContext` and `PublishResult` types. All publishers will implement this contract.
   - Addresses: Interface-first design, AI contract clarity
   - Avoids: AI inventing patterns when modifying platform code
   - Estimated effort: 2-3 hours

2. **Phase 2: Implement Shared Utilities** - Create `TokenManager`, `ErrorHandlers`, and `RateLimiter` classes to consolidate cross-cutting concerns.
   - Addresses: Duplicate token refresh code (500+ lines), rate limit handling duplication
   - Avoids: Maintenance burden across 4 platforms
   - Estimated effort: 4-6 hours

3. **Phase 3: Extract Platform Publishers** - Create `XPublisher`, `LinkedInPublisher`, `InstagramPublisher`, `TikTokPublisher` classes implementing `PlatformPublisher` interface.
   - Addresses: Monolithic publish-post.ts, platform coupling
   - Avoids: AI understanding entire 1,239-line file
   - Estimated effort: 8-12 hours (parallelizable per platform)

4. **Phase 4: Create Barrel Exports** - Add `index.ts` files to each platform directory exporting only public API (publisher, OAuth client, public types).
   - Addresses: Implementation details leaked, unclear API surface
   - Avoids: Internal imports breaking on refactoring
   - Estimated effort: 1-2 hours

5. **Phase 5: Refactor Orchestration** - Reduce `publish-post.ts` to <200 lines, create `getPublisher()` factory, replace inline platform logic with publisher delegation.
   - Addresses: Orchestration mixed with implementation, god object anti-pattern
   - Avoids: Difficulty understanding task flow
   - Estimated effort: 4-6 hours

6. **Phase 6: Add Tests** - Create interface compliance tests for all publishers, mock infrastructure for external dependencies, integration tests for end-to-end publishing.
   - Addresses: Refactoring validation, regression prevention
   - Avoids: Breaking existing behavior
   - Estimated effort: 6-8 hours

**Phase ordering rationale:**
- Phases 1-2 must be sequential: Interfaces and shared utilities are foundational, publishers depend on them
- Phase 3 is parallelizable: Each platform publisher can be built independently after foundations exist
- Phase 4 can run alongside Phase 3: Barrel exports are simple once publishers exist
- Phase 5 must come after Phase 3: Orchestration refactoring depends on publisher implementations
- Phase 6 validates all previous phases: Tests verify refactoring didn't break behavior

**Total estimated effort:** 25-37 hours (3-5 days for one developer, 2-3 weeks with AI assistance)

## Research Flags for Phases

- **Phase 1 (Interface Contracts):** Low research needed — PlatformPublisher interface design is straightforward based on existing code. Type definitions already in `src/core/types/index.ts`. No blocking research.

- **Phase 2 (Shared Utilities):** Low research needed — TokenManager pattern is standard dependency injection. ErrorHandlers pattern documented in Trigger.dev SDK. RateLimiter design follows existing client rate limit tracking. No blocking research.

- **Phase 3 (Platform Publishers):** Medium research needed — Each platform has unique media upload flow, thread logic (X), carousel support (LinkedIn), container polling (Instagram/TikTok). Need to verify all edge cases covered during extraction. Platform-specific knowledge required.

- **Phase 4 (Barrel Exports):** No research needed — Barrel export pattern is standard. Existing clients already have index.ts files for some platforms.

- **Phase 5 (Orchestration Refactor):** Medium research needed — Multi-platform partial failure isolation logic must be preserved. Thread progress tracking (X) and series state advancement must work after refactoring. Existing codebase has examples of these flows.

- **Phase 6 (Testing):** Medium research needed — Integration test patterns for Trigger.dev tasks not well-documented. Mock infrastructure design for external APIs (X, LinkedIn, Instagram, TikTok) needs consideration. Test database setup for isolated testing.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against existing codebase and official docs. TypeScript 5.9.3 confirmed in tsconfig.json. |
| Features | HIGH | Refactoring scope well-defined based on publish-post.ts analysis. Platform-specific patterns understood from existing code. |
| Architecture | HIGH | Strategy pattern, factory pattern, dependency injection are established patterns. Build order derived from hard dependencies. |
| Pitfalls | HIGH | Monolithic god object, duplicate code, implicit dependencies identified from codebase analysis. Solutions grounded in best practices. |

**Overall confidence:** HIGH

## Gaps to Address

- **Integration test patterns for Trigger.dev tasks:** Existing codebase has no integration test examples for Trigger.dev tasks. Need to research testing patterns for delayed runs, cron tasks, and waitpoints.

- **Mock infrastructure design:** External platform APIs (X, LinkedIn, Instagram, TikTok) need comprehensive mocks for unit tests. Existing codebase has minimal test coverage.

- **Thread progress tracking after refactoring:** X thread posting uses thread progress metadata stored in post metadata. Must ensure this state machine works correctly when logic is split into XPublisher class.

- **Series state advancement after refactoring:** Series state is advanced in `advanceSeriesState()` helper. Must verify this logic still works after publishers are extracted.

- **Backward compatibility validation:** Existing scheduled posts must continue working after refactoring. Need end-to-end test with production-like Trigger.dev configuration.

- **Documentation for AI assistants:** CLAUDE.md files needed in platform directories (X, LinkedIn, Instagram, TikTok) to provide AI-specific context for platform-specific patterns, gotchas, and examples.

---
*Research summary for: Agentic Architecture Improvements - Post Shit Now v1.2*
*Researched: 2026-02-25*
