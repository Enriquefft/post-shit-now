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
- [x] 01-02-PLAN.md â Neon API key validation with prefix check and API verification
- [x] 01-03-PLAN.md â Hub unification (personal.json + unified getHubConnection)
- [x] 01-04-PLAN.md â Provider key validation framework (Trigger, Perplexity, Anthropic)

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
- [x] 15-01-PLAN.md â Migration retry logic with 3 attempts, 2s fixed delay, and table verification
- [x] 15-02-PLAN.md â Auto-generated hubId using nanoid-style format
- [x] 15-03-PLAN.md â Unified hub discovery with strict validation and detailed error messages
- [x] 15-04-PLAN.md â /psn:setup reset command with --db/--files/--all flags

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
- [x] 16-01-PLAN.md â Add submit and complete CLI subcommands
- [x] 16-03-PLAN.md â Fix setup-keys.ts stdin reading
- [x] 16-04-PLAN.md â Add voice profile directory creation

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
- [x] 17-01-PLAN.md â Add progress indicators to setup
- [x] 17-02-PLAN.md â Mask sensitive data in error messages
- [x] 17-03-PLAN.md â Add dry-run and preview modes
- [x] 17-04-PLAN.md â Fix Trigger.dev setup CLI arguments
- [x] 17-05-PLAN.md â Resolve neonctl PATH issue

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
- [x] 18-02-PLAN.md â Add setup completion validation
- [x] 18-03-PLAN.md â Document entity creation workflow
- [x] 18-04-PLAN.md â Verify entity slug collision handling

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
- [ ] 19-01-PLAN.md â Add voice profile validation command
- [ ] 19-02-PLAN.md â Implement URL validation function and importBlogContent integration
- [x] 19-02B-PLAN.md â Integrate URL validation to CLI and update documentation
- [ ] 19-03-PLAN.md â Add timezone schema and interview
- [ ] 19-04-PLAN.md â Design platform persona questions
- [ ] 19-05-PLAN.md â Add timezone strategy and CLI
- [ ] 19-06-PLAN.md â Integrate platform personas

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
- [ ] 20-02-PLAN.md â Add Trigger project auto-detection
- [ ] 20-03-PLAN.md â Document architecture compatibility (RLS)

**Success Criteria:**
- Health check verifies all components
- Trigger projects auto-detected with clear errors
- RLS compatibility documented per platform

---

### Requirements Coverage

#### Critical (P0) - Phase 1 COMPLETE
- C1: Setup wizard hub detection bug â Plan 1.1 COMPLETE
- C2: Migration RLS policy error â Plan 1.2 COMPLETE
- C3: Provider keys table missing â Plan 1.3 COMPLETE
- C4: Neon API key permission error â Plan 1.4 COMPLETE

#### Major High Priority (P1) - Phases 15-16
- C5: Voice interview CLI incomplete â Plan 16.1 COMPLETE
- C6: setup-keys.ts stdin reading â Plan 16.3 COMPLETE
- M1: Migration retry loop â Plan 15.1 COMPLETE
- M2: Hub ID missing â Plan 15.2 COMPLETE
- M5: Empty .hubs confusion â Plan 15.3 COMPLETE
- M6: Voice profile directory â Plan 16.4 COMPLETE
- M9: Interview state persistence â Plan 16.2 COMPLETE
- M10: Archetype question handling â Plan 16.1 COMPLETE
- M12: Database URL exposed â Plan 17.2 COMPLETE

#### Major Medium Priority (P2) - Phases 17-18
- M3: Trigger.dev CLI argument â Plan 17.4 COMPLETE
- M4: Entity creation flow â Plan 18.3 COMPLETE
- M7: Setup completion validation â Plan 18.2 COMPLETE
- M8: Provider key configuration â Plan 18.1 COMPLETE
- M11: Dry-run mode â Plan 17.3 COMPLETE
- M13: neonctl PATH issue â Plan 17.5 COMPLETE
- M14: Recovery flow â Plan 15.4 COMPLETE

#### Minor (P3) - Phases 19-20
- m1: Progress indicators â Plan 17.1 COMPLETE
- m2: Voice profile validation â Plan 19.1 COMPLETE
- m3: Content import validation â Plan 19.2 COMPLETE
- m4: Entity slug collision â Plan 18.4 COMPLETE
- m5: Trigger project auto-detect â Plan 20.2 COMPLETE
- m6: Content directory structure â Plan 16.4 COMPLETE
- m7: Platform personas â Plan 19.4 COMPLETE
- m8: Timezone configuration â Plan 19.3 COMPLETE
- m9: Health check command â Plan 20.1 COMPLETE
- m10: RLS compatibility docs â Plan 20.3 COMPLETE

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
- Phases ordered by priority (P0 â P3) and dependency flow
- Research documents (setup-ux-best-practices, cli-interview-patterns, error-validation-patterns) inform implementation approach
- Each plan will include atomic commits with clear messages
- User testing validation after Phase 17 completion

---

## v1.0 Milestone (Complete)

â **Complete** â 14 phases, 54 plans, 148 requirements (100%)
See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for full details

Completed: 2026-02-20

## v1.2 Milestone (Architecture Complete, Testing/Context Carried to v1.3)

**Goal:** Improve agentic coding accuracy through code splitting, interface boundaries, and documentation
**Timeline:** 2026-02-25 to 2026-02-27
**Focus:** Address architectural debt to enable AI-assisted development
**Status:** Architecture phases complete (21-22.1). Phases 23-24 carried to v1.3 as Phases 29-30.

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

- [x] **Phase 21: Foundation and Architecture Cleanup** - Split monolithic code, define interfaces, configure tooling (completed 2026-02-27)
- [x] **Phase 22: Documentation and Module Boundaries** - CLAUDE.md, path aliases, barrel exports (completed 2026-02-27)
- [x] **Phase 22.1: Tech Debt Cleanup** - Fix canonical type imports, CLAUDE.md alias label, PostSubStatus union (completed 2026-02-27)
- [ ] **Phase 23: Testing Infrastructure** - Carried to v1.3 as Phase 29
- [ ] **Phase 24: Context Management and Validation** - Carried to v1.3 as Phase 30

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
- [x] 21-01-PLAN.md â Create PlatformPublisher interface and refactor publish-post.ts into interface-based platform handlers

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
**Plans**: 3 plans

Plans:
- [ ] 22-01-PLAN.md â Create root CLAUDE.md and module-level CLAUDE.md files for platforms/ and core/
- [ ] 22-02-PLAN.md â Replace wildcard tsconfig path alias with specific @psn/core, @psn/platforms, @psn/trigger aliases
- [ ] 22-03-PLAN.md â Create public API barrel exports for src/platforms/index.ts and src/core/index.ts

#### Phase 22.1: Tech Debt Cleanup
**Goal**: Address actionable tech debt from v1.2 milestone audit before proceeding to testing infrastructure
**Depends on**: Phase 22
**Gap Closure**: Closes tech debt items from v1.2-MILESTONE-AUDIT.md
**Requirements**: ARCH-01, ARCH-04, DOC-01, ARCH-07
**Success Criteria** (what must be TRUE):
  1. `publish-helpers.ts` imports `DbConnection` and `PostRow` from `src/core/types/publisher.ts` (no local redeclaration)
  2. `CLAUDE.md` Module Map shows `@psn/trigger/*` (not bare `@psn/trigger`)
  3. `PostSubStatus` union in `src/core/types/index.ts` includes `"partial_failure"` member
  4. `bun run typecheck` error count unchanged (no new errors introduced)
**Plans**: 1 plan

Plans:
- [ ] 22.1-01-PLAN.md â Fix canonical type imports in publish-helpers.ts, add partial_failure to PostSubStatus, correct CLAUDE.md alias label

#### Phase 23: Testing Infrastructure
**Status**: Carried to v1.3 as Phase 29
**Goal**: Establish testing infrastructure with interface compliance validation and mock infrastructure
**Depends on**: Phase 22
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, DOC-03
**Success Criteria** (what must be TRUE):
  1. Vitest configured with TypeScript support
  2. Mock infrastructure exists for all external platform APIs
  3. Interface compliance tests validate behavioral contracts
  4. Integration tests cover end-to-end publishing flows
  5. JSDoc comments include behavioral contracts on public APIs
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md â Create OAuth callback server module and X callback URL constants
- [ ] 27-02-PLAN.md â Integrate callback server into setup flow and eliminate hardcoded duplicates

#### Phase 24: Context Management and Validation
**Status**: Carried to v1.3 as Phase 30
**Goal**: Consolidate state access patterns and add validation automation
**Depends on**: Phase 23
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, TOOL-04
**Success Criteria** (what must be TRUE):
  1. ProjectContext manager centralizes state access
  2. Circular dependencies detected at build time
  3. Pre-commit hooks validate CLAUDE.md compliance
  4. Pre-commit hooks enforce file size limits (<200 lines)
  5. Documentation validation prevents context rot
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md â Create OAuth callback server module and X callback URL constants
- [ ] 27-02-PLAN.md â Integrate callback server into setup flow and eliminate hardcoded duplicates

## v1.3 Milestone (Real-World Reliability)

**Goal:** Fix every friction point a real user hit during first PSN session -- setup, OAuth, publishing, and Trigger.dev integration
**Timeline:** 2026-02-27 to TBD
**Source:** 342-turn trial session analysis (29 hours) + carried v1.2 items
**Focus:** Deployment infrastructure, X platform publishing pipeline, developer tooling

### Overview

This milestone addresses 6 friction points exposed by real-world usage:

1. **Trigger.dev env var delivery** - Workers deploy with zero credentials, crash on every task
2. **Tweet validation** - Oversized tweets get misleading 403 errors instead of clear character counts
3. **X OAuth callback** - No callback server forces manual authorization code capture
4. **Thread publishing resilience** - Partial thread failures lose tweet IDs, retries create duplicates
5. **Testing infrastructure** - No test infrastructure for validating fixes (carried from v1.2)
6. **Context management** - No pre-commit hooks for code quality gates (carried from v1.2)

Zero database migrations. All schema exists -- fixes complete incomplete write paths and add missing validation.

### Phases

- [x] **Phase 25: Trigger.dev Env Var Delivery** - syncEnvVars build extension for credential delivery to workers (completed 2026-02-27)
- [x] **Phase 26: Tweet Validation** - Weighted character counting and pre-flight validation (completed 2026-02-27)
- [x] **Phase 27: X OAuth Callback Server** - Automatic authorization code capture via localhost (completed 2026-02-27)
- [x] **Phase 28: Thread Publishing Resilience** - Per-tweet checkpoint persistence and resume-from-checkpoint (completed 2026-02-28)
- [ ] **Phase 29: Testing Infrastructure** - Vitest, mocks, interface compliance tests (carried from v1.2 Phase 23)
- [ ] **Phase 30: Context Management** - Pre-commit hooks and state consolidation (carried from v1.2 Phase 24)

### Phase Details

#### Phase 25: Trigger.dev Env Var Delivery
**Goal**: Trigger.dev workers receive all required credentials at deploy time without manual .env hacking
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. Running `bunx trigger.dev deploy` syncs DATABASE_URL, HUB_ENCRYPTION_KEY, and platform credentials to Trigger.dev Cloud
  2. A task started with missing env vars logs an actionable error listing each missing variable by name
  3. The syncEnvVars extension reads credentials from local hub config files -- no manual .env file creation required
**Plans**: 2 plans

Plans:
- [ ] 25-01-PLAN.md â Install @trigger.dev/build, create env-validation.ts, wire syncEnvVars into trigger.config.ts
- [ ] 25-02-PLAN.md â Update all 12 trigger tasks to use shared requireEnvVars() utility

#### Phase 26: Tweet Validation
**Goal**: Tweets are validated with accurate character counting before submission, producing clear error messages instead of misleading 403s
**Depends on**: Phase 25 (workers must run to test validation in production)
**Requirements**: TVAL-01, TVAL-02, TVAL-03
**Success Criteria** (what must be TRUE):
  1. A tweet containing URLs, emojis, and CJK characters is counted with correct weighting (URLs=23, emojis=2, CJK=2)
  2. An oversized tweet produces an error message showing actual count vs 280 max before any API call is made
  3. The thread splitter and tweet validator both use a single `countTweetChars()` function (no duplicate counting logic)
**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md â Create tweet-validator.ts with weighted character counting and refactor thread-splitter
- [ ] 26-02-PLAN.md â Wire pre-flight validation into X handler with duplicate detection

#### Phase 27: X OAuth Callback Server
**Goal**: Users complete X OAuth authorization without manually copying codes from browser URLs
**Depends on**: Phase 25 (independent of tweet validation, but workers must run for end-to-end OAuth testing)
**Requirements**: OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04
**Success Criteria** (what must be TRUE):
  1. Running X OAuth setup opens the browser and automatically captures the authorization code via `http://127.0.0.1:18923/callback`
  2. The callback URL `http://127.0.0.1:18923/callback` is defined in exactly one constant -- `grep -r` finds zero hardcoded duplicates
  3. OAuth state parameter is generated, sent with the auth request, and validated on callback to prevent CSRF
  4. If port 18923 is unavailable, the user is prompted to manually paste the authorization code (graceful fallback)
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md â Create OAuth callback server module and X callback URL constants
- [ ] 27-02-PLAN.md â Integrate callback server into setup flow and eliminate hardcoded duplicates

#### Phase 28: Thread Publishing Resilience
**Goal**: Partial thread failures are recoverable -- no lost tweet IDs, no duplicate tweets on retry
**Depends on**: Phase 26 (pre-validated tweets reduce mid-thread content failures; both modify x.handler.ts)
**Requirements**: THREAD-01, THREAD-02, THREAD-03, THREAD-04
**Success Criteria** (what must be TRUE):
  1. After each successful tweet in a thread, the posted tweet ID is persisted to the DB within the same error boundary
  2. When a thread publish is retried (via Trigger.dev), posting resumes from the last checkpoint -- already-posted tweets are skipped
  3. If a checkpoint DB write fails, it retries 2-3 times before surfacing the error -- checkpoint failures are never swallowed
  4. X Error 187 (duplicate status) received during retry is treated as "already posted" and the thread continues
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md â Create OAuth callback server module and X callback URL constants
- [ ] 27-02-PLAN.md â Integrate callback server into setup flow and eliminate hardcoded duplicates

#### Phase 29: Testing Infrastructure
**Goal**: Validate all v1.3 fixes with automated tests and establish mock infrastructure for ongoing development
**Depends on**: Phase 28 (tests written after production code stabilizes)
**Carried from**: v1.2 Phase 23
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, DOC-03
**Success Criteria** (what must be TRUE):
  1. `bun test` runs Vitest with TypeScript path alias resolution (@psn/core, @psn/platforms) working
  2. Mock classes exist for X, LinkedIn, Instagram, and TikTok API clients (mock at client class boundary, not HTTP layer)
  3. Interface compliance tests verify each PlatformPublisher handler satisfies behavioral contracts (preconditions, postconditions, error handling)
  4. Unit tests cover tweet validation (`countTweetChars` edge cases) and thread checkpoint logic (resume, duplicate detection)
  5. Public API functions in platforms/ and core/ have JSDoc comments with behavioral contracts
**Plans**: 2 plans

Plans:
- [ ] 29-01-PLAN.md — Mock infrastructure, tweet validator tests, and JSDoc behavioral contracts
- [ ] 29-02-PLAN.md — XHandler thread checkpoint and publish flow tests

#### Phase 30: Context Management
**Goal**: Automated code quality gates at commit time and consolidated project state documentation
**Depends on**: Phase 29 (hooks validate code that must be stable; tests must exist first)
**Carried from**: v1.2 Phase 24
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04
**Success Criteria** (what must be TRUE):
  1. `git commit` triggers lefthook pre-commit hooks that run `biome check --fix` on staged files and auto-re-stage fixed files
  2. Pre-commit hooks run typecheck in parallel with biome, completing in under 3 seconds total
  3. Circular dependency detection (madge) runs at commit time and blocks commits that introduce cycles
  4. A documented consolidation process exists for keeping PROJECT.md and MEMORY.md in sync
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md â Create OAuth callback server module and X callback URL constants
- [ ] 27-02-PLAN.md â Integrate callback server into setup flow and eliminate hardcoded duplicates

### Requirements Coverage (v1.3)

| Requirement | Phase | Category |
|-------------|-------|----------|
| DEPLOY-01 | Phase 25 | Deployment Infrastructure |
| DEPLOY-02 | Phase 25 | Deployment Infrastructure |
| DEPLOY-03 | Phase 25 | Deployment Infrastructure |
| TVAL-01 | Phase 26 | Tweet Validation |
| TVAL-02 | Phase 26 | Tweet Validation |
| TVAL-03 | Phase 26 | Tweet Validation |
| OAUTH-01 | Phase 27 | OAuth Flow |
| OAUTH-02 | Phase 27 | OAuth Flow |
| OAUTH-03 | Phase 27 | OAuth Flow |
| OAUTH-04 | Phase 27 | OAuth Flow |
| THREAD-01 | Phase 28 | Thread Resilience |
| THREAD-02 | Phase 28 | Thread Resilience |
| THREAD-03 | Phase 28 | Thread Resilience |
| THREAD-04 | Phase 28 | Thread Resilience |
| TEST-01 | Phase 29 | Testing Infrastructure |
| TEST-02 | Phase 29 | Testing Infrastructure |
| TEST-03 | Phase 29 | Testing Infrastructure |
| TEST-04 | Phase 29 | Testing Infrastructure |
| DOC-03 | Phase 29 | Testing Infrastructure |
| CTX-01 | Phase 30 | Context Management |
| CTX-02 | Phase 30 | Context Management |
| CTX-03 | Phase 30 | Context Management |
| CTX-04 | Phase 30 | Context Management |

**Mapped: 23/23 requirements** -- full coverage, no orphans.

### Dependency Chain

```
Phase 25 (Env Vars) âââ prerequisite for all production testing
    â
    âââ Phase 26 (Tweet Validation) âââ independent, lands before 28 to avoid x.handler.ts conflicts
    â       â
    â       âââ Phase 28 (Thread Resilience) âââ benefits from pre-validated tweets
    â
    âââ Phase 27 (OAuth Callback) âââ independent of publishing fixes
                                        â
                                        âââ Phase 29 (Testing) âââ tests written after code stabilizes
                                                â
                                                âââ Phase 30 (Context Mgmt) âââ hooks validate stable code
```

### Research Flags

- **Phase 28 (Thread Resilience):** HIGH complexity. Consider `/gsd:research-phase` for checkpoint write error handling, X Error 187 parsing, and optimistic locking patterns.
- **All other phases:** Standard patterns, skip research-phase.

## Progress

**Execution Order:**
Phases execute in numeric order: 21 â 22 â 22.1 â 25 â 26 â 27 â 28 â 29 â 30

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 21. Foundation and Architecture Cleanup | v1.2 | 2/2 | Complete | 2026-02-27 |
| 22. Documentation and Module Boundaries | v1.2 | 3/3 | Complete | 2026-02-27 |
| 22.1. Tech Debt Cleanup | v1.2 | 1/1 | Complete | 2026-02-27 |
| 23. Testing Infrastructure | v1.2 | - | Carried to v1.3 Phase 29 | - |
| 24. Context Management | v1.2 | - | Carried to v1.3 Phase 30 | - |
| 25. Trigger.dev Env Var Delivery | 2/2 | Complete    | 2026-02-27 | - |
| 26. Tweet Validation | 2/2 | Complete    | 2026-02-27 | - |
| 27. X OAuth Callback Server | 2/2 | Complete    | 2026-02-27 | - |
| 28. Thread Publishing Resilience | 2/2 | Complete    | 2026-02-28 | - |
| 29. Testing Infrastructure | 1/2 | In Progress|  | - |
| 30. Context Management | v1.3 | 0/0 | Not started | - |

---

*Last updated: 2026-02-27*
