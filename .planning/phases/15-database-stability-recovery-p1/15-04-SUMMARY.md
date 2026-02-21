---
phase: 15-database-stability-recovery-p1
plan: 04
type: execute
wave: 2
depends_on: [15-01]
files_modified:
  - src/cli/setup-reset.ts
  - src/cli/setup.ts
  - src/team/hub.ts
tags: [setup, reset, recovery, cleanup, database]
subsystem: Database Stability & Recovery

tech-stack:
  added: []
  patterns:
    - Selective reset via flags (--db, --files, --all)
    - Dry-run summary before destructive actions
    - User confirmation via need_input status
    - File cleanup with recursive deletion

key-files:
  created:
    - path: src/cli/setup-reset.ts
      purpose: Setup reset function for cleanup and recovery
      exports: ["setupReset"]
      lines: 75
  modified:
    - path: src/cli/setup.ts
      purpose: Add reset subcommand with summary display
      changes: Added import, reset case, parseResetFlags, CLI flag handling
      lines_added: 60
    - path: src/team/hub.ts
      purpose: Fix linting formatting issue
      changes: Fixed string concatenation formatting
      lines_modified: 1

decisions:
  - Require explicit scope (--db, --files, --all) - no default behavior
  - Show dry-run summary before executing any deletions
  - Return need_input status for confirmation (handled by slash command orchestrator)
  - No automatic backup - user must backup manually if needed
  - Skip directories if not found (already clean) rather than erroring

metrics:
  duration_seconds: 141
  duration_minutes: 2
  completed_date: 2026-02-21
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  lines_added: ~135
  lines_deleted: ~8

requirements_satisfied:
  - M14: Missing recovery flow for failed setup

---

# Phase 15 Plan 04: Setup Reset Command Summary

## One-Liner
Implemented `/psn:setup reset` command with selective scope (--db, --files, --all), dry-run summary, and confirmation prompt for clean recovery from failed setup.

## Objective
Add `/psn:setup reset` command for cleanup and recovery from failed setup. Reset command supports selective scope via flags (--db, --files, --all), shows summary before execution, and requires explicit user confirmation. No automatic backup — reset is destructive by design (user must backup manually if needed).

## Completed Tasks

| Task | Name | Commit | Files Created/Modified |
|------|------|--------|------------------------|
| 1 | Create setup reset function with selective scope | 19ed91d | src/cli/setup-reset.ts (created), src/team/hub.ts (format fix) |
| 2 | Add reset subcommand to setup.ts | c3f1eeb | src/cli/setup.ts (added import, reset case, parseResetFlags, CLI handling) |

## Implementation Details

### Task 1: Create setup reset function
- Created `src/cli/setup-reset.ts` with `setupReset()` function
- Supports `--db` flag: Deletes `drizzle/meta` directory (migration state)
- Supports `--files` flag: Deletes `.hubs` directory (hub connection files)
- Supports `--all` flag: Deletes both directories
- Requires explicit scope: Returns error if no flags specified
- Dry-run mode: Shows summary of what would be deleted
- Graceful handling: Skips directories if not already found

### Task 2: Add reset subcommand to setup.ts
- Imported `setupReset` function from `./setup-reset.ts`
- Added `reset` case to `runSetupSubcommand()` switch statement
- Shows dry-run summary before confirmation
- Returns `need_input` status with summary data for slash command orchestrator
- Added `parseResetFlags()` helper to parse `--db`, `--files`, `--all` flags
- Updated `parseCliArgs()` to handle reset subcommand flags

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Met

- [x] `/psn:setup reset` without flags returns error requiring scope specification
- [x] `/psn:setup reset --db` shows summary of drizzle/meta deletion
- [x] `/psn:setup reset --files` shows summary of .hubs directory deletion
- [x] `/psn:setup reset --all` shows summary of both directories
- [x] Reset returns need_input status with confirmation prompt instructions

## Verification Results

1. **setup-reset.ts exists with setupReset() function**: Verified (lines 10-75)
2. **setupReset requires explicit scope**: Verified (error returned when no flags)
3. **setupReset shows dry-run summary**: Verified (dryRun parameter returns "[DRY RUN]" actions)
4. **setup.ts has reset case**: Verified (case "reset" at line 443)
5. **Reset returns need_input status**: Verified (returns need_input with summary data)

## Test Results

```bash
# Test reset without flags (should error)
$ bun run src/cli/setup.ts reset
{
  "steps": [
    {
      "step": "reset",
      "status": "error",
      "message": "No scope specified. Use --db, --files, or --all flags."
    }
  ],
  "validation": null,
  "completed": false
}
```

## Key Decisions

1. **Explicit scope required**: User must specify `--db`, `--files`, or `--all` flags - no default destructive behavior
2. **Dry-run summary first**: Always show what would be deleted before any action is taken
3. **Confirmation orchestrator**: Returns `need_input` status for slash command orchestrator to handle confirmation prompt
4. **No automatic backup**: Reset is destructive by design - user must backup manually if needed
5. **Graceful skipping**: If directories don't exist, skip rather than error (already clean state)

## Files Modified/Created

### Created
- `src/cli/setup-reset.ts` (75 lines) - Setup reset function with selective scope

### Modified
- `src/cli/setup.ts` (+60 lines) - Added reset subcommand, parseResetFlags helper, CLI flag handling
- `src/team/hub.ts` (format fix) - Fixed string concatenation formatting for linting

## Requirements Satisfied

- **M14**: Missing recovery flow for failed setup - Implemented `/psn:setup reset` command

## Next Steps

This plan completes the Database Stability & Recovery P1 phase functionality for reset commands. Users can now:
1. Run `/psn:setup reset --db` to clean migration state
2. Run `/psn:setup reset --files` to clean hub connection files
3. Run `/psn:setup reset --all` to clean both
4. See summary before any destructive action
5. Confirm before execution (via slash command orchestrator)


## Self-Check: PASSED

- Created: src/cli/setup-reset.ts (75 lines)
- Created: .planning/phases/15-database-stability-recovery-p1/15-04-SUMMARY.md
- Commit 19ed91d: feat(15-04): create setup reset function with selective scope
- Commit c3f1eeb: feat(15-04): add reset subcommand to setup.ts
- Commit e6229da: docs(15-04): complete setup reset command plan

