# Requirements: Post Shit Now

**Defined:** 2026-02-25
**Core Value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.

## v1.2 Requirements

Requirements for agentic architecture improvements. Each maps to roadmap phases.

### Code Splitting

- [x] **ARCH-01**: Extract PlatformPublisher interface with behavioral contracts
- [x] **ARCH-02**: Split publish-post.ts into platform-specific handlers (<200 lines each)
- [x] **ARCH-03**: Create handler factory for platform selection
- [x] **ARCH-04**: Refactor orchestration layer to use interface-based handlers
- [x] **ARCH-05**: Move platform clients to use interface pattern

### Documentation

- [ ] **DOC-01**: Create root CLAUDE.md (100-200 lines) for project guidance
- [ ] **ARCH-06**: Add CLAUDE.md files at module boundaries (platforms/, core/)
- [ ] **DOC-02**: Document architecture overview with component relationships
- [ ] **DOC-03**: Add JSDoc with behavioral contracts (preconditions, postconditions)

### Module Boundaries

- [x] **ARCH-07**: Configure TypeScript path aliases (@psn/platforms, @psn/core)
- [ ] **ARCH-08**: Create barrel exports (index.ts) at directory boundaries
- [ ] **ARCH-09**: Define explicit public APIs vs internal modules
- [ ] **ARCH-10**: Enforce file size limits (<200 lines) for AI context

### Testing Infrastructure

- [ ] **TEST-01**: Add Vitest for interface compliance testing
- [ ] **TEST-02**: Create mock infrastructure for external APIs
- [ ] **TEST-03**: Write interface compliance tests (error handling, state updates)
- [ ] **TEST-04**: Add integration tests for end-to-end flows

### Context Management

- [ ] **CTX-01**: Consolidate state access patterns
- [ ] **CTX-02**: Implement ProjectContext manager
- [ ] **CTX-03**: Add circular dependency detection
- [ ] **CTX-04**: Pre-commit hooks for doc validation

### Tooling

- [x] **TOOL-01**: Configure TypeScript (noUnusedLocals, noUnusedParameters)
- [x] **TOOL-02**: Set up circular dependency checker (madge)
- [x] **TOOL-03**: Configure Biome linting for file size enforcement
- [ ] **TOOL-04**: Add pre-commit hooks for doc compliance

## Out of Scope

| Feature | Reason |
|---------|--------|
| Monorepo with packages/ | Requires pnpm/yarn workspaces, adds complexity not needed for single-repo CLI tool |
| Database schema changes | Current schema works; refactoring should not require migration |
| External API changes | Platform APIs stable; focus on internal architecture |
| Feature flags for rollout | Gradual rollout not needed for agentic development improvements |
| Performance optimization | Refactoring may improve performance; not primary goal |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 21 | Complete |
| ARCH-02 | Phase 21 | Complete |
| ARCH-03 | Phase 21 | Complete |
| ARCH-04 | Phase 21 | Complete |
| ARCH-05 | Phase 21 | Complete |
| DOC-01 | Phase 22 | Pending |
| DOC-02 | Phase 22 | Pending |
| DOC-03 | Phase 23 | Pending |
| ARCH-06 | Phase 22 | Pending |
| ARCH-07 | Phase 22 | Complete |
| ARCH-08 | Phase 22 | Pending |
| ARCH-09 | Phase 22 | Pending |
| ARCH-10 | Phase 22 | Pending |
| TEST-01 | Phase 23 | Pending |
| TEST-02 | Phase 23 | Pending |
| TEST-03 | Phase 23 | Pending |
| TEST-04 | Phase 23 | Pending |
| CTX-01 | Phase 24 | Pending |
| CTX-02 | Phase 24 | Pending |
| CTX-03 | Phase 24 | Pending |
| CTX-04 | Phase 24 | Pending |
| TOOL-01 | Phase 21 | Complete |
| TOOL-02 | Phase 21 | Complete |
| TOOL-03 | Phase 21 | Complete |
| TOOL-04 | Phase 24 | Pending |

**Coverage:**
- v1.2 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation*
