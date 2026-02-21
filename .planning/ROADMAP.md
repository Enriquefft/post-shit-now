# Roadmap: Post Shit Now

## v1.1 Milestone (In Progress)

**Goal:** Fix bugs, improve setup experience, and validate through early user testing
**Timeline:** 2026-02-20 to TBD
**Source Issues:** 30 documented issues from trial run (6 critical, 14 major, 10 minor)

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
- [ ] 01-01-PLAN.md — RLS role creation before schema migration
- [ ] 01-02-PLAN.md — Neon API key validation with prefix check and API verification
- [ ] 01-03-PLAN.md — Hub unification (personal.json + unified getHubConnection)
- [ ] 01-04-PLAN.md — Provider key validation framework (Trigger, Perplexity, Anthropic)

**Success Criteria:**
- Users can complete hub setup without manual intervention
- Database migrations run successfully on Neon
- All tables created and verified
- Clear error messages for incorrect API key types

---

#### Phase 2: Database Stability & Recovery (P1)
**Goal:** Ensure database reliability and add recovery mechanisms
**Estimated Duration:** 2-3 days

**Plans:** 4 plans

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 02-01 | Fix database migration retry loop | M1 |
| 02-02 | Add hubId to hub connection files | M2 |
| 02-03 | Unify hub connection mechanisms | M5, C11, C12 |
| 02-04 | Add setup reset and recovery flow | M14 |

**Plans:**
- [ ] 02-01-PLAN.md — Migration retry logic with exponential backoff and table verification
- [ ] 02-02-PLAN.md — Auto-generated hubId in Personal and Company hub files
- [ ] 02-03-PLAN.md — Unified hub discovery for .hubs/*.json (Personal + Company)
- [ ] 02-04-PLAN.md — /psn:setup reset command for cleanup and recovery

**Success Criteria:**
- Migrations handle partial failures gracefully
- Hub IDs consistently available
- Unified hub connection handling for Personal and Company hubs
- Reset command clears partial setup state

---

#### Phase 3: Voice Interview CLI Completion (P1)
**Goal:** Complete voice interview CLI interface with state persistence
**Estimated Duration:** 2-3 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 3.1 | Add submit and complete CLI subcommands | C5, M10 |
| 3.2 | Implement interview state persistence | M9 |
| 3.3 | Fix setup-keys.ts stdin reading | C6 |
| 3.4 | Add voice profile directory creation | M6, M4, m6 |

**Success Criteria:**
- Users can complete interview via CLI commands
- State persists between CLI invocations
- Keys can be saved via stdin or CLI flags
- Content directories created automatically

---

#### Phase 4: Setup UX Improvements (P2)
**Goal:** Enhance setup experience with progress, validation, and error handling
**Estimated Duration:** 2-3 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 4.1 | Add progress indicators to setup | m1 |
| 4.2 | Mask sensitive data in error messages | M12 |
| 4.3 | Add dry-run and preview modes | M11 |
| 4.4 | Fix Trigger.dev setup CLI arguments | M3 |
| 4.5 | Resolve neonctl PATH issue | M13 |

**Success Criteria:**
- Long-running operations show progress
- Database URLs and API keys masked in errors
- Users can preview setup changes before execution
- Trigger.dev setup uses current CLI flags
- neonctl found without manual PATH changes

---

#### Phase 5: Provider Key & Entity Configuration (P2)
**Goal:** Complete provider key setup and entity creation flows
**Estimated Duration:** 2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 5.1 | Integrate provider key configuration | M8 |
| 5.2 | Add setup completion validation | M7 |
| 5.3 | Document entity creation workflow | M4 |
| 5.4 | Add entity slug collision handling | m4 |

**Success Criteria:**
- Provider keys configured through main setup flow
- Setup status tracks voice profile completion
- Clear entity creation documentation
- Entity slug uniqueness enforced

---

#### Phase 6: Voice Profile & Interview Refinements (P3)
**Goal:** Enhance voice profile management and interview experience
**Estimated Duration:** 2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 6.1 | Add voice profile validation command | m2 |
| 6.2 | Implement content import URL validation | m3 |
| 6.3 | Add timezone configuration | m8 |
| 6.4 | Design platform persona interview | m7 |

**Success Criteria:**
- Users can validate voice profile schemas
- Content import URLs verified before processing
- Timezone configured for accurate scheduling
- Platform-specific voice personas supported

---

#### Phase 7: Health Checks & Validation (P3)
**Goal:** Add comprehensive validation and health check tools
**Estimated Duration:** 1-2 days

| Plan | Description | Issues Addressed |
|------|-------------|------------------|
| 7.1 | Implement setup health check command | m9 |
| 7.2 | Add Trigger project auto-detection | m5 |
| 7.3 | Document architecture compatibility (RLS) | m10 |

**Success Criteria:**
- Health check verifies all components
- Trigger projects auto-detected with clear errors
- RLS compatibility documented per platform

---

### Requirements Coverage

#### Critical (P0) - Phase 1
- C1: Setup wizard hub detection bug → Plan 1.1
- C2: Migration RLS policy error → Plan 1.2
- C3: Provider keys table missing → Plan 1.3
- C4: Neon API key permission error → Plan 1.4

#### Major High Priority (P1) - Phases 2-3
- C5: Voice interview CLI incomplete → Plan 3.1
- C6: setup-keys.ts stdin reading → Plan 3.3
- M1: Migration retry loop → Plan 2.1
- M2: Hub ID missing → Plan 2.2
- M5: Empty .hubs confusion → Plan 2.3
- M6: Voice profile directory → Plan 3.4
- M9: Interview state persistence → Plan 3.2
- M10: Archetype question handling → Plan 3.1
- M12: Database URL exposed → Plan 4.2

#### Major Medium Priority (P2) - Phases 4-5
- M3: Trigger.dev CLI argument → Plan 4.4
- M4: Entity creation flow → Plan 5.3
- M7: Setup completion validation → Plan 5.2
- M8: Provider key configuration → Plan 5.1
- M11: Dry-run mode → Plan 4.3
- M13: neonctl PATH issue → Plan 4.5
- M14: Recovery flow → Plan 2.4

#### Minor (P3) - Phases 6-7
- m1: Progress indicators → Plan 4.1
- m2: Voice profile validation → Plan 6.1
- m3: Content import validation → Plan 6.2
- m4: Entity slug collision → Plan 5.4
- m5: Trigger project auto-detect → Plan 7.2
- m6: Content directory structure → Plan 3.4
- m7: Platform personas → Plan 6.4
- m8: Timezone configuration → Plan 6.3
- m9: Health check command → Plan 7.1
- m10: RLS compatibility docs → Plan 7.3

---

### Success Metrics

#### Completion Criteria
- [ ] All 30 documented issues resolved
- [ ] Setup completes end-to-end without manual workarounds
- [ ] Voice interview completable via CLI
- [ ] Database migrations reliable on Neon
- [ ] Recovery mechanisms functional
- [ ] Security issues addressed (credential masking)

#### Quality Gates
- [ ] All phases pass plan verification
- [ ] Integration tests cover critical flows
- [ ] Documentation updated for new features
- [ ] Early users validate fixes

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
- User testing validation after Phase 4 completion

---

## v1.0 Milestone (Complete)

✅ **Complete** — 14 phases, 54 plans, 148 requirements (100%)
See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for full details

Completed: 2026-02-20

## v2 Milestone

*Planning has not yet begun. Use `/gsd:new-milestone` to start the next milestone cycle.*

---

*Last updated: 2026-02-20 (v1.1 roadmap created)*
