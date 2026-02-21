---
phase: 17-setup-ux-improvements-p2
plan: 05
subsystem: setup-db
tags: [error-handling, ux-improvement, neonctl]

# Dependency Graph
requires:
  - src/cli/setup-db.ts (existing database setup module)
provides:
  - Enhanced neonctl error with actionable guidance
affects:
  - Database setup error handling

# Tech Stack
added:
  - Enhanced error data structure for neonctl missing error
patterns:
  - Structured error data with suggestions, commands, docs, and troubleshooting

# Key Files
created: []
modified:
  - src/cli/setup-db.ts: Enhanced neonctl PATH error with structured actionable guidance

# Key Decisions
- "Keep simple error message while providing detailed structured data for programmatic consumption"
- "Include both npm and bun installation commands to support all package managers"
- "Provide troubleshooting steps for PATH issues (common source of confusion)"
- "Link to official neon.tech CLI documentation for authoritative information"
---

# Phase 17 Plan 05: Enhanced Neonctl PATH Error Summary

Enhanced neonctl PATH error handling with actionable guidance, including installation commands, documentation links, and troubleshooting steps.

## Objective

Resolve neonctl PATH issue by providing actionable error messages with installation commands and documentation.

## Implementation

### Task 1: Improve neonctl PATH error with actionable guidance

**Modified file:** `src/cli/setup-db.ts`

**Changes made:**
- Updated error message from `"neonctl CLI not found. Install it: npm i -g neonctl (or bun add -g neonctl)"` to `"neonctl CLI not found in PATH"` for clarity
- Added structured `data` object containing:
  - `suggestion`: Clear guidance text
  - `commands`: Array of installation commands for both npm and bun
  - `docs`: Link to official Neon CLI documentation
  - `troubleshooting`: Steps for PATH verification and installation confirmation

**Before:**
```typescript
return {
  step: "database",
  status: "error",
  message: "neonctl CLI not found. Install it: npm i -g neonctl (or bun add -g neonctl)",
};
```

**After:**
```typescript
return {
  step: "database",
  status: "error",
  message: "neonctl CLI not found in PATH",
  data: {
    suggestion: "Install neonctl to continue with database setup:",
    commands: [
      "npm install -g neonctl",
      "bun add -g neonctl",
    ],
    docs: "https://neon.tech/docs/reference/cli-reference",
    troubleshooting: [
      "After installation, restart your terminal or run: source ~/.bashrc (or ~/.zshrc)",
      "Verify installation with: neonctl version",
    ],
  },
};
```

**Verification:**
- Confirmed updated message contains `"neonctl CLI not found in PATH"`
- Confirmed documentation link points to neon.tech
- Confirmed installation commands include both npm and bun options
- Confirmed troubleshooting array provides PATH and verification steps

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria

- [x] Error message states "neonctl CLI not found in PATH"
- [x] data.commands includes both npm and bun installation commands
- [x] data.docs points to neon.tech CLI documentation
- [x] data.troubleshooting provides PATH verification steps
- [x] User can follow guidance to resolve the issue independently

## Metrics

**Duration:** < 1 minute
**Tasks completed:** 1/1 (100%)
**Files modified:** 1
**Commits created:** 1 (9163e03)

## Self-Check: PASSED

- Found: 17-05-SUMMARY.md
- Found: commit 9163e03
