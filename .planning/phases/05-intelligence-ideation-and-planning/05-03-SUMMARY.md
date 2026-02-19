---
phase: 05-intelligence-ideation-and-planning
plan: 03
subsystem: ideas
tags: [idea-bank, state-machine, inline-tags, preference-model, cli, slash-command]

requires:
  - phase: 05-01
    provides: "ideas, series, trends, weeklyPlans, monitoredAccounts DB tables"
provides:
  - "Idea types, capture, lifecycle, and bank modules (src/ideas/)"
  - "CLI entry point for idea management (src/cli/capture.ts)"
  - "/psn:capture slash command for fast idea capture"
  - "Killed-idea feedback loop in preference model"
affects: [05-04, 05-05, 05-06, weekly-planning, content-generation]

tech-stack:
  added: []
  patterns:
    - "Inline tag parsing (#key:value) for fast idea categorization"
    - "State machine with VALID_TRANSITIONS constant for lifecycle enforcement"
    - "Killed-idea feedback loop wired into computeWeeklyUpdate"

key-files:
  created:
    - src/ideas/types.ts
    - src/ideas/capture.ts
    - src/ideas/lifecycle.ts
    - src/ideas/bank.ts
    - src/cli/capture.ts
    - .claude/commands/psn/capture.md
  modified:
    - src/learning/preference-model.ts
    - src/core/db/schema.ts

key-decisions:
  - "CLI supports capture/list/ready/search/stats/stale/expire/killed subcommands"
  - "killedIdeaPatterns stored as jsonb on preference_model table for rejection learning"
  - "Graceful try/catch around killed idea query for when ideas table does not exist yet"

patterns-established:
  - "Inline tag parsing: #key:value extracted from free-text input"
  - "Idea lifecycle state machine: spark -> seed -> ready -> claimed -> developed -> used/killed"
  - "Rejection feedback loop: killed ideas inform preference model weekly update"

requirements-completed: [IDEA-01, IDEA-02, IDEA-03, IDEA-04, IDEA-06, IDEA-07, IDEA-08]

duration: 4min
completed: 2026-02-19
---

# Phase 5 Plan 3: Idea Bank Summary

**Idea bank with inline tag capture, maturity pipeline state machine, staleness/expiry management, and killed-idea feedback into preference model**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-19T11:02:38Z
- **Completed:** 2026-02-19T11:06:17Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Complete idea bank system with types, capture, lifecycle, and bank query modules
- CLI with 8 subcommands (capture, list, ready, search, stats, stale, expire, killed)
- /psn:capture slash command enabling sub-30-second idea capture with inline tags
- Killed-idea feedback loop wired into preference model's computeWeeklyUpdate

## Task Commits

Each task was committed atomically:

1. **Task 1: Idea types, capture logic, and lifecycle state machine** - `061c459` (feat)
2. **Task 2: Capture CLI, /psn:capture slash command, killed-idea preference feedback** - `8696efe` (feat)

## Files Created/Modified
- `src/ideas/types.ts` - IdeaStatus, Urgency, CaptureInput types, VALID_TRANSITIONS state machine
- `src/ideas/capture.ts` - parseInlineTags, inferUrgency, captureIdea with timely/seasonal expiry
- `src/ideas/lifecycle.ts` - transitionIdea, autoPromoteIdeas, getStaleIdeas, expireTimelyIdeas, recordKillFeedback
- `src/ideas/bank.ts` - getReadyIdeas, searchIdeas, getIdeasByStatus, getIdeaStats, listIdeas, getKilledIdeasSince
- `src/cli/capture.ts` - CLI entry point with 8 subcommands and exported functions
- `.claude/commands/psn/capture.md` - Slash command for fast idea capture and management
- `src/learning/preference-model.ts` - Added KilledIdeaPatterns type, killed-idea feedback section in computeWeeklyUpdate
- `src/core/db/schema.ts` - Added killedIdeaPatterns jsonb column to preference_model table

## Decisions Made
- CLI supports 8 subcommands beyond the planned 5 (added ready, search, killed for completeness)
- killedIdeaPatterns stored as jsonb on preference_model table with rejectedPillars, commonReasons, recentKills
- Graceful try/catch around killed idea query handles case where ideas table does not exist yet
- Common kill reasons sorted by frequency for quick pattern recognition

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added killedIdeaPatterns column to schema**
- **Found during:** Task 2 (preference model wiring)
- **Issue:** Plan specified storing killedIdeaPatterns in preference model but no schema column existed
- **Fix:** Added killedIdeaPatterns jsonb column to preference_model table in schema.ts
- **Files modified:** src/core/db/schema.ts
- **Verification:** bun run typecheck passes
- **Committed in:** 8696efe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Schema column addition required for killed-idea feedback storage. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Idea bank ready for weekly planning integration (05-04, 05-05)
- /psn:capture available for immediate use
- Preference model now learns from rejected ideas in weekly updates

## Self-Check: PASSED

All 8 files verified present. Both commits (061c459, 8696efe) verified in git log.

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
