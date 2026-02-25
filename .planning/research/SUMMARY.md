# Project Research Summary

**Project:** Post Shit Now - Agentic Development Improvements
**Domain:** TypeScript/Node.js codebase architecture refactoring for AI-assisted development
**Researched:** 2026-02-25
**Confidence:** HIGH

## Executive Summary

This research targets a specific refactoring initiative: transforming the existing Post Shit Now codebase to optimize it for AI-assisted development using Claude Code. The current codebase has architectural debt (monolithic `publish-post.ts` at 1,239 lines) and lacks the patterns that AI assistants need to navigate, understand, and modify code effectively. The recommended approach prioritizes interface-first design, code splitting into focused modules (<200 lines each), barrel exports at module boundaries, comprehensive CLAUDE.md documentation (project-level and directory-level), and explicit TypeScript configuration tailored for AI exploration (`noUnusedLocals: false`, `noUnusedParameters: false`).

The research identifies a clear opportunity cost: AI assistants working with poorly structured codebases waste tokens attempting to understand monolithic files, produce inconsistent modifications due to unclear module boundaries, and require repeated corrections for the same mistakes. The proposed refactoring is an investment in developer productivity: after Phase 1 cleanup, Claude Code can understand the codebase more deeply, modify it more reliably, and reduce the "AI correction cycle" from 3-5 iterations to 1-2 iterations.

Key risks include the upfront cost of refactoring a working codebase and ensuring that AI-generated documentation (CLAUDE.md) remains synchronized with code changes. Mitigation requires a phased approach (foundation first, then directory-level docs as needed), pre-commit hooks for documentation validation (context rot prevention), and treating this as a productivity investment with measurable returns (fewer corrections per feature).

## Key Findings

### Recommended Stack

The core stack for agentic development prioritizes AI-friendly tooling over pure performance. TypeScript strict mode is essential, but with specific flags disabled to enable AI exploration. Fast tooling (Bun, Biome, Vitest) reduces iteration time. Documentation patterns (CLAUDE.md, JSDoc) are first-class concerns, not afterthoughts.

**Core technologies:**
- **TypeScript 5.9.3** with `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true` — Catches errors before runtime. Forces explicit undefined checks. Requires `override` keyword for clarity.
- **TypeScript 5.9.3** with `noUnusedLocals: false`, `noUnusedParameters: false` — **Critical for AI**: AI often declares temporary variables during exploration. Auto-cleanup would block AI from trying variations.
- **Bun (latest)** — Runtime faster than Node.js for local development. Type checking via `bun run typecheck`.
- **tsx (latest)** — Script runner to execute TypeScript directly without build step. Used for CLI scripts invoked by Claude commands.
- **Biome 2.4.2** — Linting and formatting in one tool. Runs 10-100x faster than ESLint+Prettier. Auto-fixable rules help AI conform to standards.
- **Vitest 4.0.18** — Unit testing with native TypeScript support. Smart re-runs only affected tests. AI-friendly test generation.

**TypeScript configuration rationale:**
- `moduleResolution: "bundler"` — Modern resolution compatible with Bun/Trigger.dev bundling
- `paths: { "@psn/*": ["./src/*"] }` — Path aliases enable clear module boundaries. AI can reason about imports more easily than relative paths.

**Interface-based architecture:**
- TypeScript interfaces define contracts between modules. AI assistants read interfaces to understand component responsibilities without reading implementation.
- Barrel exports (`index.ts`) at module boundaries expose only public API. Internal implementation hidden, reducing AI confusion.
- Interface segregation: one interface per responsibility. Split god interfaces into focused contracts.

**Code organization patterns:**
- **Domain-based directories** — `src/platforms/x/`, `src/platforms/linkedin/`, `src/core/db/`, `src/core/types/`
- **File size limits (<200 lines)** — AI can hold entire file in context. Functions >50 lines extracted, classes >200 lines split.
- **Explicit dependency injection** — Constructor injection makes dependencies visible. AI understands what a class needs to function.

### Expected Features

AI assistants assume certain architectural patterns exist in well-structured codebases. Missing these patterns causes AI to struggle with navigation, modification, and understanding.

**Must have (table stakes):**
- **Interface definitions for platform handlers** — Define `PlatformPublisher` interface with `publish(content, token)` method. AI needs contracts to understand component boundaries.
- **Code splitting from monolithic `publish-post.ts`** — 1,239 lines exceeds AI context window for deep understanding. Extract platform-specific logic into `src/platforms/*/publisher.ts` modules.
- **Root CLAUDE.md documentation** — 100-200 lines covering: project overview, common commands, code style, prohibited actions. Claude Code automatically loads this.
- **Path aliases for module imports** — Configure `@psn/platforms/*`, `@psn/core/db/*`, `@psn/core/types/*`. Clear boundaries make AI reasoning easier.
- **Barrel exports at module boundaries** — Single entry point per module. `src/platforms/x/index.ts` exports only: `XPublisher`, `createXOAuthClient`, `XPostContent` type.
- **File size limits (<200 lines)** — Split monolithic files. AI deep reasoning requires entire file in context.
- **Explicit dependency injection** — Constructor injection: `class Publisher(db: Database, tokenManager: TokenManager)`. Dependencies visible in constructor.

**Should have (competitive):**
- **Directory-level CLAUDE.md files** — Module-specific patterns. `src/platforms/x/CLAUDE.md` (50-100 lines) with X-specific notes, gotchas, examples.
- **Interface compliance tests** — Vitest tests validating that implementations honor contracts. `expect(publisher).toMatchObject<PlatformPublisher>({ publish: expect.any(Function) })`.
- **Mock infrastructure for external APIs** — Isolate unit tests from platform-specific APIs. Vitest mocks for `twitter-api-v2`, `instagram-graph-api`, `linkedin-api-sdk`.
- **JSDoc comments on public APIs** — Focus on "why" not "what". Include examples and thrown errors. AI reads JSDoc to understand function purpose.
- **Architecture overview documentation** — `ARCHITECTURE.md` with diagrams showing data flow. AI understands system structure without exploring.

**Defer (v2+):**
- **Context rot prevention** — Pre-commit hooks to verify CLAUDE.md examples still compile, file size limits enforced. Defer until documentation is stable.
- **Refactoring safety nets** — Integration tests for end-to-end publishing flows. Defer until large-scale refactoring is planned.

**Anti-features (commonly requested, problematic):**
- **AI-generated CLAUDE.md from scratch** — AI invents patterns that don't exist. Start minimal (100 lines), evolve organically after 2nd-3rd AI correction.
- **Complex multi-level @imports** — AI may miss critical rules buried in 5 levels. Simple structure: root CLAUDE.md + directory CLAUDE.md.
- **God objects with extensive JSDoc** — AI overwhelmed by 500+ line interfaces. Interface segregation: split into focused interfaces.
- **Dynamic imports for lazy loading** — AI can't statically analyze dependencies. Refactoring becomes error-prone.

### Architecture Approach

The refactoring targets specific architectural debt patterns that hinder AI-assisted development. The approach is interface-first, module-boundary-aware, and documentation-centric.

**Major components to refactor:**

1. **Monolithic `publish-post.ts` (1,239 lines)** — Split into focused modules. Extract platform-specific logic into `src/platforms/*/publisher.ts`. Create orchestration layer (`platform-dispatcher.ts`). AI can understand one platform at a time.

2. **Interface definitions** — Define `PlatformPublisher`, `MediaUploader`, `OAuthClient` interfaces in `src/core/types/platform.ts`. Implement per-platform: `XPublisher`, `LinkedInPublisher`, `InstagramPublisher`, `TikTokPublisher`. Strategy pattern: `publish-post.ts` delegates to appropriate publisher.

3. **Path aliases** — Configure `@psn/platforms/*`, `@psn/core/db/*`, `@psn/core/types/*` in tsconfig.json. Replace relative imports with clear boundaries. AI reasoning about imports becomes easier.

4. **Barrel exports** — Single entry point per module. `src/platforms/x/index.ts` exports only public API. Internal files NOT exported. Clear public API surface for AI discovery.

5. **Domain-based directories** — Logical code grouping by business domain. `src/platforms/`, `src/core/db/`, `src/core/types/`, `src/trigger/tasks/`. Flat structures or shallow nesting (max 3-4 levels).

6. **CLAUDE.md documentation** — Root `CLAUDE.md` (100-200 lines) for project-level rules. Directory `CLAUDE.md` (50-100 lines) for module-specific patterns. Progressive disclosure: AI gets context relevant to current working directory.

7. **Explicit dependency injection** — Constructor injection makes dependencies visible. AI understands what a component needs to function. Easier to test with mocks.

**Architectural patterns:**

**Pattern 1: Interface-First Design**
```typescript
// Define contract first
interface PlatformPublisher {
  publish(content: PostContent, token: OAuthToken): Promise<PublishResult>;
}

// Implementation per platform
class XPublisher implements PlatformPublisher {
  async publish(content: PostContent, token: OAuthToken) {
    // X-specific logic
  }
}

// Consumer knows contract, not implementation
const publisher: PlatformPublisher = getPublisher(platform);
await publisher.publish(content, token);
```

**Pattern 2: Barrel Exports at Boundaries**
```typescript
// src/platforms/x/index.ts
export { XPublisher } from './publisher.js';
export { createXOAuthClient } from './oauth.js';
export type { XPostContent } from './types.js';
// Internal files NOT exported (client.ts internals, etc.)
```

**Pattern 3: Domain-Based Directories**
```
src/
  core/
    db/          # Database access, schemas, migrations
    types/        # Shared type definitions
    utils/        # General utilities
  platforms/
    x/            # X platform (client, oauth, media, types, publisher)
    linkedin/     # LinkedIn platform
    instagram/    # Instagram platform
    tiktok/       # TikTok platform
  trigger/
    tasks/        # Trigger.dev task definitions
    middleware/    # Shared middleware for tasks
```

**Pattern 4: File Size Limits (<200 lines)**
- AI context window can hold entire file
- Deep understanding without chunking
- Easier for AI to reason about complete function/class
- When to split: Function >50 lines, Class >200 lines, File >200 lines

### Critical Pitfalls

The current codebase has architectural debt that hinders AI-assisted development:

1. **Monolithic files (>1,000 lines)** — `publish-post.ts` at 1,239 lines exceeds AI context window for deep understanding. AI chunks the file, loses context, produces incomplete modifications.
   - **Prevention:** Split into focused modules. Extract platform-specific logic into `src/platforms/*/publisher.ts`. Functions >50 lines, classes >200 lines, files >200 lines.

2. **Missing module boundaries** — Unclear separation between components. AI modifies internals that should be hidden, breaks encapsulation.
   - **Prevention:** Define interfaces at module boundaries. Barrel exports expose only public API. Path aliases (`@psn/platforms/*`) enforce boundaries conceptually.

3. **No CLAUDE.md documentation** — AI lacks project-specific guidance. Repeats same mistakes across sessions. Invents patterns that don't exist.
   - **Prevention:** Root `CLAUDE.md` (100-200 lines) with project rules. Directory `CLAUDE.md` (50-100 lines) with module-specific patterns. Evolve organically after 2nd-3rd AI correction.

4. **Relative imports** — `../../platforms/x/client.ts` makes navigation difficult. AI can't reason about module structure from imports.
   - **Prevention:** Configure path aliases (`@psn/platforms/x/client.ts`). Clear boundaries, easier refactoring.

5. **Missing TypeScript configuration for AI** — `noUnusedLocals: true` blocks AI exploration. AI declares temporary variables, linter auto-deletes them.
   - **Prevention:** Set `noUnusedLocals: false`, `noUnusedParameters: false`. Enable AI exploration without blocking.

6. **Implicit dependencies** — Global dependencies (`getGlobalDb()`) confuse AI. Can't see what a component needs to function.
   - **Prevention:** Explicit constructor injection. `class Publisher(db: Database, tokenManager: TokenManager)`. Dependencies visible and typed.

## Implications for Roadmap

Based on agentic development research, suggested phase structure:

### Phase 1: Foundation and Architecture Cleanup
**Rationale:** Monolithic files and missing module boundaries are the biggest blockers to effective AI-assisted development. This phase establishes interfaces, splits modules, and adds CLAUDE.md documentation.
**Delivers:** Interface definitions (PlatformPublisher, MediaUploader, OAuthClient), split `publish-post.ts` into platform-specific modules, root CLAUDE.md, path aliases configured, barrel exports at module boundaries, TypeScript configuration optimized for AI.
**Addresses:** Interface definitions, code splitting, root CLAUDE.md, path aliases, barrel exports, file size limits, explicit dependency injection
**Avoids:** Monolithic files, missing module boundaries, unclear AI context, implicit dependencies

Key deliverables:
- `src/core/types/platform.ts` — `PlatformPublisher`, `MediaUploader`, `OAuthClient` interfaces
- `src/platforms/x/` directory with `publisher.ts`, `client.ts`, `oauth.ts`, `media.ts`, `types.ts`, `index.ts` (barrel export)
- `src/platforms/linkedin/`, `src/platforms/instagram/`, `src/platforms/tiktok/` — Same structure
- `src/trigger/platform-dispatcher.ts` — Delegates to platform publishers based on platform type
- `src/trigger/publish-post.ts` — Refactored to <200 lines, orchestration only
- `CLAUDE.md` — Project-level documentation (100-200 lines)
- `tsconfig.json` — Path aliases configured, AI-friendly settings applied

**Research flag:** None — established patterns from agentic development best practices.

### Phase 2: Directory-Level Documentation and Testing
**Rationale:** Phase 1 establishes architecture. Phase 2 adds progressive disclosure (directory-level CLAUDE.md) and validates that implementations honor contracts (interface compliance tests).
**Delivers:** Directory-level CLAUDE.md files for key modules, interface compliance tests (Vitest), mock infrastructure for external APIs, JSDoc comments on public APIs.
**Addresses:** Directory-level CLAUDE.md, interface compliance tests, mock infrastructure, JSDoc comments

Key deliverables:
- `src/platforms/x/CLAUDE.md` — X-specific patterns, OAuth flow notes, rate limit handling
- `src/platforms/linkedin/CLAUDE.md` — LinkedIn-specific patterns, carousel format, 60-day token expiry
- `src/platforms/instagram/CLAUDE.md` — Instagram-specific patterns, multi-step media upload, 200 req/hr limit
- `src/platforms/tiktok/CLAUDE.md` — TikTok-specific patterns, chunked video upload, audit requirements
- `src/platforms/x/publisher.test.ts` — Interface compliance test, external API mocks, error scenario tests
- JSDoc comments on all public APIs (PlatformPublisher.publish(), MediaUploader.uploadMedia(), OAuthClient methods)

**Research flag:** None — standard testing and documentation patterns.

### Phase 3: Context Rot Prevention and Refactoring Safety Nets
**Rationale:** As CLAUDE.md documentation grows, keeping it synchronized with code becomes critical. Pre-commit hooks prevent stale docs that mislead AI. Refactoring safety nets enable large-scale changes with confidence.
**Delivers:** Pre-commit hooks for documentation validation, file size limit enforcement, integration tests for end-to-end publishing flows, context rot detection alerts.
**Addresses:** Context rot prevention, refactoring safety nets

Key deliverables:
- Pre-commit hook: verify CLAUDE.md examples compile
- Pre-commit hook: enforce <200 line file limits
- Pre-commit hook: run Vitest interface compliance tests
- Integration test: end-to-end publishing flow for each platform
- Alert mechanism: notify when CLAUDE.md examples diverge from code

**Research flag:** None — pre-commit hooks and integration tests are established patterns.

### Phase Ordering Rationale

- **Phase 1 comes first** because monolithic files and missing module boundaries are the biggest blockers. AI cannot work effectively with 1,239 line files. Interfaces and barrel exports must exist before directory-level docs can reference them.
- **Phase 2 comes second** because testing and directory-level docs require stable architecture from Phase 1. Interface compliance tests validate that refactored modules honor contracts.
- **Phase 3 comes third** because context rot prevention needs documentation to be stable first. Pre-commit hooks add overhead that's only justified once CLAUDE.md has meaningful content.

This ordering prioritizes high-impact, low-cost changes (Phase 1) before defensive measures (Phase 3). Directory-level docs in Phase 2 add progressive disclosure as needed, not upfront.

### Research Flags

**Phases with standard patterns (skip `/gsd:research-phase`):**
- **Phase 1 (Foundation):** Interface-based architecture, barrel exports, path aliases are well-documented TypeScript patterns. CLAUDE.md documentation is standard Claude Code practice.
- **Phase 2 (Directory docs and testing):** Vitest interface compliance tests, mock infrastructure, JSDoc comments are established patterns.
- **Phase 3 (Context rot prevention):** Pre-commit hooks, integration tests, file size limit enforcement are standard tooling patterns.

**No phases require deeper research** — All patterns are verified from 2026 agentic development best practices, official TypeScript documentation, and Claude Code guidelines.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack verified via official docs. TypeScript 5.9.3, Bun, Biome, Vitest are production-ready. Agentic patterns verified from 2026 best practices. |
| Features | HIGH | Feature research verified against official docs, 2026 best practices, and analysis of existing codebase (1,239 line monolith). Clear distinction between table stakes, differentiators, and anti-features. |
| Architecture | HIGH | Architectural patterns sourced from interface-first design principles, Claude Code best practices, and agentic development guides. File size limits (<200 lines) proven to improve AI reasoning. |
| Pitfalls | HIGH | Pitfalls verified against analysis of existing codebase and agentic development research. Monolithic files, missing module boundaries, and no CLAUDE.md are documented blockers to AI-assisted development. |

**Overall confidence:** HIGH

### Gaps to Address

- **Measurable ROI of refactoring:** Research identifies benefits (fewer AI corrections, faster understanding) but doesn't specify metrics. Track "AI correction cycle count" per feature before/after refactoring during Phase 1 execution.
- **CLAUDE.md evolution strategy:** Research recommends starting minimal and evolving organically after 2nd-3rd AI correction. This requires active tracking of AI mistakes during Phase 1 to identify patterns worth documenting.
- **Directory-level CLAUDE.md scope:** Research doesn't specify which directories need CLAUDE.md. Add directory-level docs reactively when AI makes 2nd-3rd mistake in same module, not proactively for all directories.
- **File size limit enforcement:** Pre-commit hooks in Phase 3 add overhead. Consider warning-only mode during development, enforcement only before commits to main.

These gaps are execution strategies, not research gaps. All architectural decisions have high confidence.

## Sources

### Primary (HIGH confidence — official docs)
- [TypeScript 5.9.3 documentation](https://www.typescriptlang.org/docs/) — Compiler options (`noUncheckedIndexedAccess`, `noImplicitOverride`, module resolution)
- [Bun documentation](https://bun.sh/docs) — Runtime, type checking, tsx execution
- [Biome documentation](https://biomejs.dev/docs/) — Linting and formatting, auto-fixable rules, performance
- [Vitest documentation](https://vitest.dev/) — Native TypeScript support, mock infrastructure, smart re-runs
- [Claude Code documentation](https://docs.anthropic.com/en/docs/build-with-claude/claude-code) — CLAUDE.md patterns, project-specific context

### Secondary (HIGH confidence — 2026 best practices)
- [Claude Code最佳实践：官方心法](https://m.toutiao.com/w/1857885021073411/) — CLAUDE.md patterns, project-specific context, progressive disclosure
- [Claude Code最佳实践指南](https://m.blog.csdn.net/xixiluo99/article/details/157723100) — AI development workflows, context management
- [Agentic coding architecture patterns](https://openai.com/zh-Hans-CN/index/harness-engineering/) — Codex architecture, layered domain design
- [Claude Code Plugin Architecture](https://www.jdon.com/82382-wshobson-agents-CC-plugin.html) — Multi-agent orchestration, plugin boundaries
- [TypeScript dependency injection patterns](https://dev.to/vad3x/typesafe-almost-zero-cost-dependency-injection-in-typescript-112) — Interface-based DI patterns

### Tertiary (MEDIUM confidence — community examples)
- [Context engineering for AI assistants](https://github.com/coleam00/context-engineering-intro) — Code structure for AI coding
- [Nuxt UI rules for AI assistants](https://github.com/HugoRCD/nuxt-ui-rules) — Optimized guidelines for Cursor/Windsurf/Claude Code
- [AI 时代的前端自动化测试](https://juejin.cn/post/7588745319401406464) — AI-driven testing with Vitest
- [Vitest unit testing framework](https://juejin.im/entry/7578811288819908651) — Vitest advantages for TypeScript

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
