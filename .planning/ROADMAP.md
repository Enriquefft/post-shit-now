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
4/4 plans complete
- [ ] 01-02-PLAN.md — Neon API key validation with prefix check and API verification
- [ ] 01-03-PLAN.md — Hub unification (personal.json + unified getHubConnection)
- [ ] 01-04-PLAN.md — Provider key validation framework (Trigger, Perplexity, Anthropic)

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
- [ ] 17-01-PLAN.md — Add progress indicators to setup
- [ ] 17-02-PLAN.md — Mask sensitive data in error messages
- [ ] 17-03-PLAN.md — Add dry-run and preview modes
- [ ] 17-04-PLAN.md — Fix Trigger.dev setup CLI arguments
- [ ] 17-05-PLAN.md — Resolve neonctl PATH issue

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
- [ ] 18-01-PLAN.md — Integrate provider key configuration
- [ ] 18-02-PLAN.md — Add setup completion validation
- [ ] 18-03-PLAN.md — Document entity creation workflow
- [ ] 18-04-PLAN.md — Add entity slug collision handling

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
| 19.2 | Implement content import URL validation | m3 |
| 19.3 | Add timezone configuration | m8 |
| 19.4 | Design platform persona interview | m7 |

**Plans:**
- [ ] 19-01-PLAN.md — Add voice profile validation command
- [ ] 19-02-PLAN.md — Implement content import URL validation
- [ ] 19-03-PLAN.md — Add timezone configuration
- [ ] 19-04-PLAN.md — Design platform persona interview

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
- [ ] 20-01-PLAN.md — Implement setup health check command
- [ ] 20-02-PLAN.md — Add Trigger project auto-detection
- [ ] 20-03-PLAN.md — Document architecture compatibility (RLS)

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

#### Major High Priority (P1) - Phases 15-16
- C5: Voice interview CLI incomplete → Plan 16.1
- C6: setup-keys.ts stdin reading → Plan 16.3
- M1: Migration retry loop → Plan 15.1
- M2: Hub ID missing → Plan 15.2
- M5: Empty .hubs confusion → Plan 15.3
- M6: Voice profile directory → Plan 16.4
- M9: Interview state persistence → Plan 16.2
- M10: Archetype question handling → Plan 16.1
- M12: Database URL exposed → Plan 17.2

#### Major Medium Priority (P2) - Phases 17-18
- M3: Trigger.dev CLI argument → Plan 17.4
- M4: Entity creation flow → Plan 18.3
- M7: Setup completion validation → Plan 18.2
- M8: Provider key configuration → Plan 18.1
- M11: Dry-run mode → Plan 17.3
- M13: neonctl PATH issue → Plan 17.5
- M14: Recovery flow → Plan 15.4

#### Minor (P3) - Phases 19-20
- m1: Progress indicators → Plan 17.1
- m2: Voice profile validation → Plan 19.1
- m3: Content import validation → Plan 19.2
- m4: Entity slug collision → Plan 18.4
- m5: Trigger project auto-detect → Plan 20.2
- m6: Content directory structure → Plan 16.4
- m7: Platform personas → Plan 19.4
- m8: Timezone configuration → Plan 19.3
- m9: Health check command → Plan 20.1
- m10: RLS compatibility docs → Plan 20.3

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
- User testing validation after Phase 17 completion

---

## v1.0 Milestone (Complete)

✅ **Complete** — 14 phases, 54 plans, 148 requirements (100%)
See: [v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md) for full details

Completed: 2026-02-20

## v2 Milestone

*Planning has not yet begun. Use `/gsd:new-milestone` to start the next milestone cycle.*

---

*Last updated: 2026-02-20 (v1.1 roadmap created)*
