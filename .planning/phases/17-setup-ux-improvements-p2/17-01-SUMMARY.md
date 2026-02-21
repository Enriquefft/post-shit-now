---
phase: 17-setup-ux-improvements-p2
plan: 01
type: execute
wave: 1
depends_on: []
subsystem: Setup CLI
tags: [ux, progress, setup, cli]
requires_provides:
  requires: []
  provides:
    - ora: Terminal spinners for progress indication
    - StepProgress: Progress step interface
    - createProgressStep: Function to display full step list
    - runStep: Function to execute steps with spinner and timing
  affects:
    - setup-db.ts: Database setup now shows progress
    - setup-trigger.ts: Trigger.dev setup now shows progress
tech_stack:
  added:
    - ora: ^9.3.0 (terminal spinners)
  patterns:
    - Progress indicator with ora spinner
    - Step-by-step checklist display upfront
    - Timing information for completed steps
key_files:
  created:
    - src/cli/utils/progress.ts
  modified:
    - package.json
    - src/cli/setup-db.ts
    - src/cli/setup-trigger.ts
decisions: []
metrics:
  duration: 4m
  tasks_completed: 3
  files_modified: 4
  completed_date: 2026-02-21
---

# Phase 17 Plan 01: Progress Indicators for Setup Operations Summary

**One-liner:** Step-by-step progress indicators with ora spinners and timing for database and Trigger.dev setup operations.

## Executive Summary

Successfully implemented progress indicators for long-running setup operations using ora terminal spinners. Users now see a full step list upfront, live spinners during operations, and timing information on completion. Applied to database setup (Neon project creation and migrations) and Trigger.dev setup (project initialization), targeting operations that take 5-30 seconds.

## Changes Made

### 1. Progress Utilities (`src/cli/utils/progress.ts`)
- Created new utility module with:
  - `StepProgress` interface for step metadata
  - `createProgressStep()` to display full step list upfront (not sequential reveal)
  - `runStep<T>()` to wrap operations with spinner and automatic timing

### 2. Database Setup (`src/cli/setup-db.ts`)
- Added progress indicators for long-running operations:
  - "Creating Neon project" - wrapped in `runStep()` with spinner and timing
  - "Running database migrations" - wrapped in `runStep()` with spinner and timing
  - Step list displayed upfront with all three steps
- Applied to operations taking 5-30 seconds each (not quick file writes or env checks)

### 3. Trigger.dev Setup (`src/cli/setup-trigger.ts`)
- Added progress indicators for long-running operations:
  - "Initializing Trigger.dev project" - wrapped in `runStep()` with spinner and timing
  - Step list displayed upfront with three steps
- Applied to `trigger.dev init` operation (10-30 seconds)

### 4. Dependencies (`package.json`)
- Added `ora@9.3.0` for terminal spinners
- ora handles TTY detection automatically (no special non-TTY handling needed)

## Deviations from Plan

### Deviation 1: Plans 17-02, 17-04, 17-05 Executed Out of Order
- **Found during:** Task 2 (setup-db.ts modification)
- **Issue:** Plans 17-02 (masking), 17-04 (CLI flag fix), and 17-05 (neonctl error) were already executed before 17-01
- **Impact:** setup-db.ts and setup-trigger.ts already contained masking imports and modifications from plan 17-02
- **Resolution:** Worked with existing state - added progress indicators without disrupting masking functionality
- **Files affected:** src/cli/setup-db.ts, src/cli/setup-trigger.ts

### Deviation 2: Pre-existing TypeScript Errors
- **Found during:** Verification (typecheck)
- **Issue:** TypeScript typecheck has errors in files not modified by this plan:
  - src/cli/utils/masking.ts (plan 17-02)
  - src/cli/voice-interview.ts (pre-existing)
  - src/core/db/migrate.ts (pre-existing)
  - src/core/utils/nanoid.ts (pre-existing)
  - src/voice/interview.ts (pre-existing)
- **Resolution:** Per deviation Rule 3 (SCOPE BOUNDARY), did NOT fix these issues - they are outside scope of this plan
- **Note:** Files modified by this plan (progress.ts, setup-db.ts, setup-trigger.ts) have no new type errors

## Key Decisions

### Progress Display Style
- Full step list displayed from start (not sequential reveal)
- Spinner shows running state with `⠋ Running: step name...`
- Success/failure messages include duration: `✓ Step name [1.2s]` or `✗ Step name [1.2s]`
- Applied only to long-running operations (5-30s each)

### TTY Handling
- ora automatically detects TTY and disables animations in non-TTY environments (CI/CD, pipes)
- No special handling needed per 17-RESEARCH.md Pattern 1

## Verification Results

### Commit Verification
- Task 1 commit: `3c37554` - ora dependency installed, progress.ts created
- Task 2 commit: `847c8e4` - database setup progress indicators applied
- Task 3 commit: `18944b0` - Trigger.dev setup progress indicators applied

### File Verification
```
FOUND: /home/hybridz/Projects/post-shit-now/src/cli/utils/progress.ts
FOUND: ora dependency in package.json
FOUND: runStep import in src/cli/setup-db.ts
FOUND: runStep import in src/cli/setup-trigger.ts
```

### Code Verification
- `createProgressStep()` called in both setup files to display full step list
- `runStep()` wraps long-running operations:
  - Neon project creation in setup-db.ts
  - Database migrations in setup-db.ts
  - Trigger.dev init in setup-trigger.ts

## Technical Notes

### ora Usage Pattern
```typescript
// Display full step list upfront
createProgressStep(["Step 1", "Step 2", "Step 3"]);

// Wrap long-running operation
const result = await runStep("Step name", async () => {
  // Long-running work here
  return result;
});

// Automatically outputs:
// [ ] Step 1
// [ ] Step 2
// [ ] Step 3
// ┌────────────────────────────────────────┐
// │ ✓ Step 1 [1.2s]                       │
// └────────────────────────────────────────┘
```

### Error Handling
- runStep() propagates errors after displaying spinner.fail() with duration
- Existing error handling in setup-db.ts and setup-trigger.ts preserved
- Masking from plan 17-02 continues to work for sensitive data

## User Experience Impact

**Before:**
- Silent setup with no progress feedback during long operations
- Users uncertain if setup is progressing or stuck

**After:**
- Clear step list displayed upfront
- Live spinners show work in progress
- Success/failure with timing information
- Works in both terminal and CI/CD environments

## Future Considerations

- Consider adding progress indicators to other long-running CLI operations
- ora provides 20+ spinner types - current default is suitable for general use
- Timing data could be logged for performance analysis

## Self-Check: PASSED

### Files Created/Modified
- [x] src/cli/utils/progress.ts created
- [x] package.json modified (ora added)
- [x] src/cli/setup-db.ts modified
- [x] src/cli/setup-trigger.ts modified

### Commits Verified
- [x] 3c37554 - Task 1 commit exists
- [x] 847c8e4 - Task 2 commit exists
- [x] 18944b0 - Task 3 commit exists

### Verification Checklist
- [x] ora dependency installed in package.json
- [x] src/cli/utils/progress.ts created with exports
- [x] Database setup shows progress for Neon project creation and migrations
- [x] Trigger.dev setup shows progress for init operation
- [x] Each step displays duration on completion
