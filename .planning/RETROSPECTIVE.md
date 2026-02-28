# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.3 — Real-World Reliability

**Shipped:** 2026-02-28
**Phases:** 6 | **Plans:** 12 | **Requirements:** 23

### What Was Built
- **syncEnvVars build extension** — Trigger.dev workers receive all credentials (DATABASE_URL, HUB_ENCRYPTION_KEY, platform tokens) at deploy time without manual .env hacking
- **Tweet validator with weighted character counting** — Intl.Segmenter-based grapheme clustering handles URLs (23 chars), emoji (2 chars), CJK (2 chars); single countTweetChars() function shared by validator and thread splitter
- **X OAuth callback server** — Automatic authorization code capture on 127.0.0.1:18923 with CSRF protection (state parameter validation) and graceful fallback to manual paste if port busy
- **Thread checkpoint persistence** — Per-tweet checkpoint writes within same error boundary; resume-from-checkpoint on retry; X Error 187 (duplicate) treated as "already posted"; Jaccard similarity (0.8 threshold) for duplicate detection
- **Vitest test infrastructure** — Class-boundary mocks for all 4 platform API clients (X, LinkedIn, Instagram, TikTok); tweet validator edge case coverage; thread checkpoint/resume tests; JSDoc behavioral contracts on PlatformPublisher interface
- **lefthook pre-commit hooks** — Three parallel quality gates (biome check --write, tsc --noEmit --incremental, madge --circular) with glob scoping to src/ files; auto-restage on biome fixes

### What Worked
- **Real-user session as source material** — The 342-turn trial session produced a precise list of friction points. Every phase addressed a real problem, not a hypothetical one.
- **Zero database migrations** — All schema already existed from v1.0. Fixes completed incomplete write paths and added missing validation. No migration risk.
- **Carrying phases across milestones** — Testing (v1.2 Phase 23) and Context Management (v1.2 Phase 24) carried cleanly into v1.3 as Phases 29-30. No context was lost.
- **Plan execution speed** — Most plans completed in 1-5 minutes. Phase 30 Plan 01 (43-file biome/TS cleanup) was the outlier at 15 minutes.
- **Custom over dependency** — Building tweet-validator.ts (~60 lines) instead of depending on unmaintained twitter-text npm package. Simpler, fully understood, zero supply chain risk.

### What Was Inefficient
- **Phase 27/28 plan references were wrong in ROADMAP.md** — Plans listed as 30-01/30-02 instead of 27-01/27-02 and 28-01/28-02. Copy-paste error from template.
- **Phase 30 Plan 01 scope was large** — 43 files touched to establish biome/TS clean baseline. Could have been addressed incrementally across earlier phases instead of batching.
- **STATE.md accumulated too much context** — Decisions, performance metrics, and session notes grew unwieldy. The milestone boundary cleanup process (now documented) addresses this going forward.

### Patterns Established
- **Mock at class boundary, not HTTP layer** — Platform client mocks simulate the client class interface, not raw fetch/HTTP calls. Simpler setup, faster execution, more readable tests.
- **Fixtures from real API responses** — Test fixtures use actual X API v2 response shapes, not fabricated data. Catches shape mismatches early.
- **JSDoc contracts on interface only** — Behavioral contracts documented on PlatformPublisher interface; implementations inherit. Single source of truth for contracts.
- **PROJECT.md as single source of truth** — MEMORY.md and CLAUDE.md are synced at milestone boundaries via the State Consolidation checklist in CLAUDE.md.
- **lefthook with parallel glob-scoped jobs** — Pre-commit hooks skip entirely when no src/ files are staged. Parallel execution keeps total hook time under 3 seconds.
- **Soft warnings never block publishing** — Tweet warnings (mentions, hashtags, duplicates) are logged but never prevent a post from going out.

### Key Lessons
1. **Real usage beats hypothetical planning.** The 342-turn trial session exposed issues that design review never would have caught (e.g., Trigger.dev workers deploying with zero credentials, X rejecting "localhost" in OAuth callbacks).
2. **Build custom when the alternative is unmaintained.** tweet-validator.ts at 60 lines is more maintainable than depending on twitter-text (last updated years ago, doesn't handle modern Unicode correctly).
3. **Checkpoint persistence must be in the same error boundary as the action.** Writing the tweet ID after posting but outside the try/catch means checkpoint failures are swallowed silently.
4. **Pre-commit hooks need a clean baseline first.** Phase 30 Plan 01 had to fix 43 files of pre-existing issues before hooks could be enabled. Future milestones start clean.
5. **State consolidation prevents context rot.** Without explicit sync points, PROJECT.md, MEMORY.md, and CLAUDE.md drift apart within days. Milestone boundaries are the natural sync cadence.

### Cost Observations
- Model mix: primarily Opus for plan execution
- Plans completed: 12 across 6 phases
- Notable: Most plans completed in 1-5 minutes; total milestone execution ~45 minutes active time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 14 | 54 | Initial build — all features from scratch |
| v1.1 | 7 | 31 | Bug fixes driven by trial run issues |
| v1.2 | 3 | 6 | Architecture refactor — interface-based design |
| v1.3 | 6 | 12 | Real-world reliability — testing and tooling |

### Cumulative Quality

| Milestone | Tests | Quality Gates | Key Addition |
|-----------|-------|---------------|-------------|
| v1.0 | 0 | None | Feature-complete but untested |
| v1.1 | 0 | None | Setup reliability improved |
| v1.2 | 0 | None | Architecture for testability |
| v1.3 | Yes | 3 pre-commit hooks | Vitest + lefthook established |

### Top Lessons (Verified Across Milestones)

1. **Real-user feedback drives the highest-value work.** Both v1.1 (30 trial-run issues) and v1.3 (342-turn session friction) produced more impactful changes than speculative planning.
2. **Small, focused phases execute faster.** v1.2 and v1.3 phases (2 plans each) averaged 2-5 minutes per plan vs v1.0 phases that were larger and harder to track.
3. **Single source of truth prevents drift.** Established in v1.3 but the need was evident since v1.1 when ROADMAP.md, PROJECT.md, and MEMORY.md began diverging.
