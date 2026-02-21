---
phase: 17-setup-ux-improvements-p2
plan: 04
subsystem: CLI / Setup
tags: [trigger.dev, bugfix, cli-flags]
completed_date: "2026-02-21T17:13:30Z"
duration_minutes: 1

dependency_graph:
  requires: [M3]
  provides: [Correct Trigger.dev CLI flag handling]
  affects: [trigger.dev setup]

tech_stack:
  added: []
  patterns: []
  libraries_used:
    - bunx (CLI package executor)
    - trigger.dev (workflow orchestration)

key_files:
  modified:
    - path: src/cli/setup-trigger.ts
      changes: Fixed CLI flag name from --skip-install to --skip-package-install

decisions: []

metrics:
  tasks_completed: 1
  files_modified: 1
  lines_changed: 1
---

# Phase 17 Plan 04: Fix Trigger.dev CLI Flag Pass-Through Summary

Fixed Trigger.dev setup CLI argument handling by correcting the flag name passed through bunx to trigger.dev init command.

## One-liner

Fixed Trigger.dev CLI flag pass-through by using correct --skip-package-install flag instead of --skip-install.

## Task Execution

### Task 1: Fix Trigger.dev CLI flag pass-through

**Status:** Completed
**Commit:** `9163e03`

**Issue:** The setup-trigger.ts was using the wrong flag name (`--skip-install`) when calling `trigger.dev init`. The correct flag name is `--skip-package-install` according to Trigger.dev CLI documentation.

**Changes made:**
- Updated line 57 in `src/cli/setup-trigger.ts` from:
  ```typescript
  const proc = Bun.spawn(["bunx", "trigger.dev@latest", "init", "--skip-install"], {...})
  ```
  to:
  ```typescript
  const proc = Bun.spawn(["bunx", "trigger.dev@latest", "init", "--skip-package-install"], {...})
  ```

**Verification:**
- Verified correct flag name via `bunx trigger.dev@latest init --help` output
- Confirmed `--skip-package-install` is the valid flag for skipping @trigger.dev/sdk package installation
- Flag is correctly positioned after the `init` subcommand (standard CLI convention)

## Deviations from Plan

None - plan executed exactly as written.

## Artifacts Created

- Modified `src/cli/setup-trigger.ts` with correct Trigger.dev CLI flag

## Key Technical Details

The fix was straightforward once the actual Trigger.dev CLI documentation was consulted. The plan correctly identified that the issue was with flag placement/ordering, but the root cause was actually using the wrong flag name (`--skip-install` vs `--skip-package-install`).

### Trigger.dev CLI Flag Reference

From `trigger.dev init --help`:
```
Options:
  --skip-package-install           Skip installing the @trigger.dev/sdk package
```

### Standard CLI Convention

The bunx argument order `["bunx", "package@version", "command", "--flag"]` follows the standard pattern:
1. `bunx` - the executor
2. `trigger.dev@latest` - package specification
3. `init` - the subcommand
4. `--skip-package-install` - flags for the subcommand

## Lessons Learned

When debugging CLI flag issues, always consult the actual CLI documentation (via `--help`) rather than assuming flag names based on conventions. Different CLIs use different flag naming patterns (e.g., `--skip-install` vs `--skip-package-install`).
