---
phase: 01-foundation-infrastructure
plan: 02
subsystem: infra
tags: [neonctl, trigger-dev, cli, setup-wizard, slash-commands, byok]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Drizzle schema, connection factory, crypto utils, env loader, types"
provides:
  - "Hub provisioning CLI (setup-db, setup-trigger, setup-keys, validate)"
  - "/psn:setup slash command for onboarding"
  - "Resume-from-failure setup flow"
  - "JSON-based CLI output for Claude interpretation"
affects: [phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: [neonctl]
  patterns: [json-cli-output, resume-from-failure, slash-command-to-cli-bridge]

key-files:
  created:
    - src/cli/setup.ts
    - src/cli/setup-db.ts
    - src/cli/setup-trigger.ts
    - src/cli/setup-keys.ts
    - src/cli/validate.ts
    - .claude/commands/psn/setup.md
  modified: []

key-decisions:
  - "CLI scripts output JSON to stdout — Claude interprets and presents to user"
  - "neonctl with --api-key flag (no browser/auth flow needed)"
  - "Encryption key auto-generated during DB setup"

patterns-established:
  - "CLI pattern: each script exports a function + has import.meta.main entry point"
  - "Setup pattern: check-then-act for resume-from-failure"
  - "Slash command pattern: .claude/commands/psn/*.md describes workflow for Claude"

requirements-completed: [INFRA-03, INFRA-04, CONFIG-01, CONFIG-04, CONFIG-07]

# Metrics
duration: ~15min
completed: 2026-02-18
---

# Plan 01-02: Hub Provisioning CLI Summary

**Step-by-step setup wizard with neonctl DB provisioning, Trigger.dev config, API key collection, and connection validation — all via JSON CLI output**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built complete Hub provisioning flow: keys -> database -> migrations -> trigger -> validate
- Each setup step outputs structured JSON for Claude to interpret
- Resume-from-failure: re-running setup skips completed steps
- Created /psn:setup slash command describing the wizard flow

## Task Commits

1. **Task 1: CLI scripts** - `27137d3` (feat)
2. **Task 2: Slash command** - `27137d3` (feat, same commit)

## Files Created/Modified
- `src/cli/setup.ts` - Main orchestrator with 5-step flow
- `src/cli/setup-db.ts` - Neon DB provisioning via neonctl CLI
- `src/cli/setup-trigger.ts` - Trigger.dev project configuration
- `src/cli/setup-keys.ts` - API key collection and storage
- `src/cli/validate.ts` - Connection and config validation
- `.claude/commands/psn/setup.md` - Slash command entry point

## Decisions Made
- Used neonctl with --api-key flag to avoid browser-based auth flow
- Encryption key auto-generated during DB setup and stored in hub.env
- Trigger.dev project ref extracted from secret key format when possible

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None.

## User Setup Required

Users need to provide before running /psn:setup:
1. **NEON_API_KEY** from Neon Console -> Settings -> API Keys
2. **TRIGGER_SECRET_KEY** from Trigger.dev Dashboard -> Project Settings -> API Keys

## Next Phase Readiness
- Hub provisioning ready for users to clone and set up
- Validation confirms DB connectivity, Trigger.dev config, and directory structure

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-18*
