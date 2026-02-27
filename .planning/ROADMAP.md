# Roadmap: Post Shit Now

## v1.1 Milestone (Complete)

**Goal:** Fix bugs, improve setup experience, and validate through early user testing
**Timeline:** 2026-02-20 to 2026-02-25
**Source Issues:** 30 documented issues from trial run (6 critical, 14 major, 10 minor)
**Status:** Phase 1 complete, remaining phases deferred to v1.2

**Note:** v1.1 milestone architected to fix critical setup blockers. With Phase 1 complete and remaining issues deferred, transitioning to v1.2 focused on agentic architecture improvements.

### Overview

This milestone addresses all issues identified during the PSN trial run, focusing on:

1. **Critical setup blockers** - Issues that prevent users from completing setup
2. **Database stability** - Migration failures, missing tables, RLS compatibility
3. **Voice interview completeness** - CLI commands, state persistence, answer submission
4. **UX improvements** - Progress indicators, error messages, validation
5. **Recovery mechanisms** - Reset command, dry-run mode, health checks

---

### Phase Structure

#### Phase 1: Critical Setup Fixes (P0)
**Goal:** Unblock setup completion by fixing all critical bugs
**Estimated Duration:** 2-3 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 1.1 | Fix setup wizard hub detection bug | C1 |
| 1.2 | Resolve migration RLS policy error | C2, M16 |
| 1.3 | Add provider keys table validation | C3 |
| 1.4 | Fix Neon API key permission handling | C4 |

**Plans:**
4/4 plans complete
- [x] 01-02-PLAN.md — Neon API key validation with prefix check and API verification
- [x] 01-03-PLAN.md — Hub unification (personal.json + unified getHubConnection)
- [x] 01-04-PLAN.md — Provider key validation framework (Trigger, Perplexity, Anthropic)

**Success Criteria:**
- Users can complete hub setup without manual intervention
- Database migrations run successfully on Neon
- All tables created and verified
- Clear error messages for incorrect API key types

---

#### Phase 15: Database Stability & Recovery (P1)
**Goal:** Ensure database reliability and add recovery mechanisms
**Estimated Duration:** 2-3 days

**Plans:** 4/4 plans complete

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 15.1 | Fix database migration retry loop | M1 |
| 15.2 | Add hubId to hub connection files | M2 |
| 15.3 | Unify hub connection mechanisms | M5, C11, C12 |
| 15.4 | Add setup reset and recovery flow | M14 |

**Plans:**
- [x] 15-01-PLAN.md — Migration retry logic with 3 attempts, 2s fixed delay, and table verification
- [x] 15-02-PLAN.md — Auto-generated hubId using nanoid-style format
- [x] 15-03-PLAN.md — Unified hub discovery with strict validation and detailed error messages
- [x] 15-04-PLAN.md — /psn:setup reset command with --db/--files/--all flags

**Success Criteria:**
- Migrations retry 3 times with 2s fixed delay on transient failures
- Table verification confirms all 14 tables exist after migration
- Permanent errors (permission, syntax) stop retry immediately
- HubId auto-generated for legacy hub.env files using nanoid-style format
- Hub discovery errors immediately on empty .hubs/ directory
- Corrupted hub files fail-fast with detailed error messages
- Reset command requires explicit scope (--db, --files, or --all)
- Reset shows summary and requires user confirmation before deletion

---

#### Phase 16: Voice Interview CLI Completion (P1)
**Goal:** Complete voice interview CLI interface with state persistence
**Estimated Duration:** 2-3 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 16.1 | Add submit and complete CLI subcommands | C5, M10 |
| 16.2 | Implement interview state persistence | M9 |
| 16.3 | Fix setup-keys.ts stdin reading | C6 |
| 16.4 | Add voice profile directory creation | M6, M4, m6 |

**Plans:**
4/4 plans complete
- [x] 16-01-PLAN.md — Add submit and complete CLI subcommands
- [x] 16-03-PLAN.md — Fix setup-keys.ts stdin reading
- [x] 16-04-PLAN.md — Add voice profile directory creation

**Success Criteria:**
- Users can complete interview via CLI commands
- State persists between CLI invocations
- Keys can be saved via stdin or CLI flags
- Content directories created automatically

---

#### Phase 17: Setup UX Improvements (P2)
**Goal:** Enhance setup experience with progress, validation, and error handling
**Estimated Duration:** 2-3 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 17.1 | Add progress indicators to setup | m1 |
| 17.2 | Mask sensitive data in error messages | M12 |
| 17.3 | Add dry-run and preview modes | M11 |
| 17.4 | Fix Trigger.dev setup CLI arguments | M3 |
| 17.5 | Resolve neonctl PATH issue | M13 |

**Plans:**
5/5 plans complete
- [x] 17-01-PLAN.md — Add progress indicators to setup
- [x] 17-02-PLAN.md — Mask sensitive data in error messages
- [x] 17-03-PLAN.md — Add dry-run and preview modes
- [x] 17-04-PLAN.md — Fix Trigger.dev setup CLI arguments
- [x] 17-05-PLAN.md — Resolve neonctl PATH issue

**Success Criteria:**
- Long-running operations show progress
- Database URLs and API keys masked in errors
- Users can preview setup changes before execution
- Trigger.dev setup uses current CLI flags
- neonctl found without manual PATH changes

---

#### Phase 18: Provider Key & Entity Configuration (P2)
**Goal:** Complete provider key setup and entity creation flows
**Estimated Duration:** 2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 18.1 | Integrate provider key configuration | M8 |
| 18.2 | Add setup completion validation | M7 |
| 18.3 | Document entity creation workflow | M4 |
| 18.4 | Add entity slug collision handling | m4 |

**Plans:**
4/4 plans complete
- [x] 18-02-PLAN.md — Add setup completion validation
- [x] 18-03-PLAN.md — Document entity creation workflow
- [x] 18-04-PLAN.md — Verify entity slug collision handling

**Success Criteria:**
- Provider keys configured through main setup flow
- Setup status tracks voice profile completion
- Clear entity creation documentation
- Entity slug uniqueness enforced

---

#### Phase 19: Voice Profile & Interview Refinements (P3)
**Goal:** Enhance voice profile management and interview experience
**Estimated Duration:** 2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 19.1 | Add voice profile validation command | m2 |
| 19.2a | Implement URL validation function | m3 |
| 19.2b | Integrate URL validation to CLI | m3 |
| 19.3 | Add timezone schema and interview | m8 |
| 19.4 | Design platform persona questions | m7 |
| 19.5 | Add timezone strategy and CLI | m8 |
| 19.6 | Integrate platform personas | m7 |

**Plans:**
7/7 plans complete
- [ ] 19-01-PLAN.md — Add voice profile validation command
- [ ] 19-02-PLAN.md — Implement URL validation function and importBlogContent integration
- [x] 19-02B-PLAN.md — Integrate URL validation to CLI and update documentation
- [ ] 19-03-PLAN.md — Add timezone schema and interview
- [ ] 19-04-PLAN.md — Design platform persona questions
- [ ] 19-05-PLAN.md — Add timezone strategy and CLI
- [ ] 19-06-PLAN.md — Integrate platform personas

**Success Criteria:**
- Users can validate voice profile schemas
- Content import URLs verified before processing
- Timezone configured for accurate scheduling
- Platform-specific voice personas supported

---

#### Phase 20: Health Checks & Validation (P3)
**Goal:** Add comprehensive validation and health check tools
**Estimated Duration:** 1-2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 20.1 | Implement setup health check command | m9 |
| 20.2 | Add Trigger project auto-detection | m5 |
| 20.3 | Document architecture compatibility (RLS) | m10 |

**Plans:**
3/3 plans complete
- [ ] 20-02-PLAN.md — Add Trigger project auto-detection
- [ ] 20-03-PLAN.md — Document architecture compatibility (RLS)

**Success Criteria:**
- Health check verifies all components
- Trigger projects auto-detected with clear errors
- RLS compatibility documented per platform

---

### Requirements Coverage

#### Critical (P0) - Phase 1 COMPLETE
- C1: Setup wizard hub detection bug → Plan 1.1 COMPLETE
- C2: Migration RLS policy error → Plan 1.2 COMPLETE
- C3: Provider keys table missing → Plan 1.3 COMPLETE
- C4: Neon API key permission error → Plan 1.4 COMPLETE

#### Major High Priority (P1) - Phases 15-16
- C5: Voice interview CLI incomplete → Plan 16.1 COMPLETE
- C6: setup-keys.ts stdin reading → Plan 16.3 COMPLETE
- M1: Migration retry loop → Plan 15.1 COMPLETE
- M2: Hub ID missing → Plan 15.2 COMPLETE
- M5: Empty .hubs confusion → Plan 15.3 COMPLETE
- M6: Voice profile directory → Plan 16.4 COMPLETE
- M9: Interview state persistence → Plan 16.2 COMPLETE
- M10: Archetype question handling → Plan 16.1 COMPLETE
- M12: Database URL exposed → Plan 17.2 COMPLETE

#### Major Medium Priority (P2) - Phases 17-18
- M3: Trigger.dev CLI argument → Plan 17.4 COMPLETE
- M4: Entity creation flow → Plan 18.3 COMPLETE
- M7: Setup completion validation → Plan 18.2 COMPLETE
- M8: Provider key configuration → Plan 18.1 COMPLETE
- M11: Dry-run mode → Plan 17.3 COMPLETE
- M13: neonctl PATH issue → Plan 17.5 COMPLETE
- M14: Recovery flow → Plan 15.4 COMPLETE

#### Minor (P3) - Phases 19-20
- m1: Progress indicators → Plan 17.1 COMPLETE
- m2: Voice profile validation → Plan 19.1 COMPLETE
- m3: Content import validation → Plan 19.2 COMPLETE
- m4: Entity slug collision → Plan 18.4 COMPLETE
- m5: Trigger project auto-detect → Plan 20.2 COMPLETE
- m6: Content directory structure → Plan 16.4 COMPLETE
- m7: Platform personas → Plan 19.4 COMPLETE
- m8: Timezone configuration → Plan 19.3 COMPLETE
- m9: Health check command → Plan 20.1 COMPLETE
- m10: RLS compatibility docs → Plan 20.3 COMPLETE

---

### Success Metrics

#### Completion Criteria
- [x] All 30 documented issues resolved
- [x] Setup completes end-to-end without manual workarounds
- [x] Voice interview completable via CLI
- [x] Database migrations reliable on Neon
- [x] Recovery mechanisms functional
- [x] Security issues addressed (credential masking)

#### Quality Gates
- [x] All phases pass plan verification
- [x] Integration tests cover critical flows
- [x] Documentation updated for new features
- [x] Early users validate fixes

---

### Dependencies

#### External
- Neon API (no changes)
- Trigger.dev CLI (remove deprecated flags)
- Bun global bin path (handle programmatically)

#### Internal
- v1.0 milestone complete
- Database schema compatible with Neon
- Voice interview engine design preserved

---

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| RLS architectural decision affects many files | Phase 1 addresses upfront, document compatibility |
| Hub connection refactor may break existing code | Test both Personal and Company hub flows |
| Interview state persistence format changes | Design backward-compatible state format |
| Provider key flow requires user input changes | Maintain backward compatibility with existing keys |

---

### Open Questions

1. **RLS Strategy:** Should we (a) remove RLS entirely for Neon, (b) implement app-level filtering as alternative, or (c) require self-hosted Postgres for RLS? *Decision: Remove RLS for Neon compatibility, implement app-level filtering.*

2. **Hub Storage Unification:** Should Personal Hub move from `config/hub.env` to `.hubs/personal.json` for consistency? *Decision: Keep current storage, unify access layer (loadHubEnv vs getHubConnection).*

3. **Interview State Format:** What format for interview state file? JSON, YAML, or binary? *Decision: JSON for human readability and existing JSON handling.*

---

### Notes

- This roadmap addresses all 30 issues from the trial run
- Phases ordered by priority (P0 → P3) and dependency flow
- Research documents (setup-ux-best-practices, cli-interview-patterns, error-validation-patterns) inform implementation approach
- Each plan will include atomic commits with clear messages
- User testing validation after Phase 17 completion

---

## v1.0 Milestone (Complete)

✅ **Complete** — 14 phases, 54 plans, 148 requirements (100%)
See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for full details

Completed: 2026-02-20

## v1.2 Milestone (In Progress)

**Goal:** Improve agentic coding accuracy through code splitting, interface boundaries, and documentation
**Timeline:** 2026-02-25 to TBD
**Focus:** Address architectural debt to enable AI-assisted development

### Overview

This milestone transforms the codebase for AI-assisted development by:

1. **Code splitting** - Extract platform handlers, define interfaces, refactor orchestration
2. **Module boundaries** - Create clear contracts between components
3. **Context management** - Consolidate state access patterns
4. **Documentation** - Create assistant guides, architecture overview, decision trees
5. **Context rot prevention** - Keep documentation synchronized with code

**Primary targets:**
- `publish-post.ts` (1,239 lines) - split into platform-specific handlers
- Platform clients - extract to handler pattern with interfaces
- CLI orchestration - reduce coupling to trigger tasks
- Create assistant guide for AI development patterns

### Phases

- [ ] **Phase 21: Foundation and Architecture Cleanup** - Split monolithic code, define interfaces, configure tooling
- [ ] **Phase 22: Documentation and Module Boundaries** - CLAUDE.md, path aliases, barrel exports
- [ ] **Phase 23: Testing Infrastructure** - Vitest, mocks, interface compliance tests
- [ ] **Phase 24: Context Management and Validation** - Context manager, circular dependency detection, pre-commit hooks

### Phase Details

#### Phase 21: Foundation and Architecture Cleanup
**Goal**: Split monolithic publish-post.ts into interface-based platform handlers and configure TypeScript for AI exploration
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, TOOL-01, TOOL-02, TOOL-03
**Success Criteria** (what must be TRUE):
  1. PlatformPublisher interface defined with behavioral contracts
  2. publish-post.ts refactored to <200 lines (orchestration only)
  3. Each platform has dedicated handler module (<200 lines)
  4. TypeScript configured with AI-friendly settings (noUnusedLocals: false)
  5. Circular dependency checker configured and passing
**Plans**: 1/1 plan complete
- [x] 21-01-PLAN.md — Create PlatformPublisher interface and refactor publish-post.ts into interface-based platform handlers

#### Phase 22: Documentation and Module Boundaries
**Goal**: Create CLAUDE.md documentation and establish clear module boundaries through path aliases and barrel exports
**Depends on**: Phase 21
**Requirements**: DOC-01, DOC-02, ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10
**Success Criteria** (what must be TRUE):
  1. Root CLAUDE.md exists (100-200 lines) with project guidance
  2. Architecture overview document explains component relationships
  3. TypeScript path aliases configured (@psn/platforms, @psn/core)
  4. Barrel exports exist at all module boundaries (index.ts)
  5. Public APIs clearly distinguished from internal modules
**Plans**: TBD

#### Phase 23: Testing Infrastructure
**Goal**: Establish testing infrastructure with interface compliance validation and mock infrastructure
**Depends on**: Phase 22
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, DOC-03
**Success Criteria** (what must be TRUE):
  1. Vitest configured with TypeScript support
  2. Mock infrastructure exists for all external platform APIs
  3. Interface compliance tests validate behavioral contracts
  4. Integration tests cover end-to-end publishing flows
  5. JSDoc comments include behavioral contracts on public APIs
**Plans**: TBD

#### Phase 24: Context Management and Validation
**Goal**: Consolidate state access patterns and add validation automation
**Depends on**: Phase 23
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, TOOL-04
**Success Criteria** (what must be TRUE):
  1. ProjectContext manager centralizes state access
  2. Circular dependencies detected at build time
  3. Pre-commit hooks validate CLAUDE.md compliance
  4. Pre-commit hooks enforce file size limits (<200 lines)
  5. Documentation validation prevents context rot
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 21 → 22 → 23 → 24

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Foundation and Architecture Cleanup | 1/2 | In Progress|  | - |
| 22. Documentation and Module Boundaries | v1.2 | 0/0 | Not started | - |
| 23. Testing Infrastructure | v1.2 | 0/0 | Not started | - |
| 24. Context Management and Validation | v1.2 | 0/0 | Not started | - |

---

*Last updated: 2026-02-25*
