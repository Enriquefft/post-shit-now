---
phase: 01-critical-setup-fixes
plan: 03
title: "Personal Hub Storage Unification"
subsystem: Hub Storage
tags: [bug-fix, migration, hub-storage]
completed_date: 2026-02-21
duration: 106s

requires:
  - [01-01, "RLS Role Migration Setup"]
  - [01-02, "API Key Validation"]

provides:
  - [01-04, "Provider Keys Validation"]

affects:
  - src/team/hub.ts
  - src/cli/setup-db.ts
  - src/core/utils/env.ts
  - .hubs/personal.json

tech_stack:
  added: []
  patterns: [hub-migration, unified-storage, json-config]

key_files:
  created:
    - .hubs/personal.json (created on setup)
  modified:
    - src/core/utils/env.ts (migratePersonalHubToHubsDir)
    - src/team/hub.ts (discoverCompanyHubs updated)
    - src/cli/setup-db.ts (writes to personal.json)
  deleted: []

decisions: []

metrics:
  tasks_completed: 3
  files_modified: 3
  lines_added: 70
  lines_removed: 24
  commits: 3
---

# Phase 01 Plan 03: Personal Hub Storage Unification Summary

**Unify hub storage by moving Personal Hub from config/hub.env to .hubs/personal.json and updating getHubConnection() to handle both Personal and Company hubs. This resolves C1 (setup wizard hub detection bug).**

## Objective

Personal Hub is stored in config/hub.env but getHubConnection() only looks in .hubs/*.json for Company hubs, causing "Personal Hub not configured" errors. This plan unifies storage to .hubs/personal.json for consistent access.

## Implementation

### Task 1: Add Personal Hub migration utility to env.ts
Added `migratePersonalHubToHubsDir()` function that:
- Checks if migration is needed (personal.json exists? hub.env exists?)
- Reads config/hub.env and parses with existing parseEnvFile
- Creates HubConnection object with all required fields
- Validates with HubConnectionSchema
- Writes to .hubs/personal.json
- Deletes old config/hub.env

**Commit:** d7888f7 - `feat(01-03): add Personal Hub migration utility to env.ts`

### Task 2: Update getHubConnection() to handle Personal Hub
Updated `discoverCompanyHubs()` in hub.ts:
- Changed from filtering `company-*.json` to loading all `*.json` files
- Now includes personal.json alongside company hubs
- getHubConnection() works unified for both Personal and Company hubs
- Removed restriction to company-* prefix only

**Commit:** 6c57ab7 - `feat(01-03): update getHubConnection to handle Personal Hub`

### Task 3: Update setup-db.ts to write .hubs/personal.json
Modified setup-db.ts function:
- Added migration check at start (calls migratePersonalHubToHubsDir)
- Changed resume check from hub.env to personal.json
- Creates HubConnection object with hubId, slug, databaseUrl, etc.
- Writes to .hubs/personal.json instead of config/hub.env
- Trigger project ID filled later by setup-trigger.ts (empty string placeholder)

**Commit:** f1f1ee7 - `feat(01-03): update setup-db.ts to write .hubs/personal.json`

## Changes Summary

### File: src/core/utils/env.ts
- Added imports: `mkdir`, `readFile`, `rm` from fs/promises
- Added import: `type HubConnection`, `HubConnectionSchema` from team/types.ts
- Added `migratePersonalHubToHubsDir()` function (68 lines)
- Exports migration utility for use in setup-db.ts

### File: src/team/hub.ts
- Updated `discoverCompanyHubs()` function
- Changed filter from `entry.startsWith("company-")` to just `.json` files
- Now loads both personal.json and company-*.json
- Updated function docstring to reflect Personal Hub support

### File: src/cli/setup-db.ts
- Added imports: `mkdir` from fs/promises
- Added import: `migratePersonalHubToHubsDir` from env.ts
- Removed import: `parseEnvFile` (no longer needed directly)
- Updated function signature to accept `projectRoot` parameter
- Added migration check at function start
- Changed resume check to use personal.json
- Replaced hub.env writing with personal.json writing
- Creates HubConnection object with all fields (hubId, role, etc.)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All verification checks passed:
1. ✓ migratePersonalHubToHubsDir exists in env.ts and migrates hub.env to personal.json
2. ✓ discoverCompanyHubs loads all JSON files from .hubs/ (not just company-*.json)
3. ✓ getHubConnection("personal") returns Personal Hub from .hubs/personal.json
4. ✓ setup-db.ts writes to .hubs/personal.json instead of config/hub.env
5. ✓ Migration path handles edge cases (both exist, neither exist, only hub.env exists)

## Success Criteria Met

- ✓ Personal Hub stored in .hubs/personal.json (same format as Company Hubs)
- ✓ getHubConnection() handles both personal and company hubs
- ✓ Old config/hub.env automatically migrated to new location
- ✓ Unified hub storage eliminates dual-API confusion
- ✓ setup.ts voice/entity subcommands will now work with Personal Hub

## Impact

**Before:**
- Personal Hub: config/hub.env (loaded via loadHubEnv)
- Company Hubs: .hubs/company-*.json (loaded via getHubConnection)
- Dual API confusion caused C1 bug

**After:**
- Personal Hub: .hubs/personal.json (loaded via getHubConnection)
- Company Hubs: .hubs/company-*.json (loaded via getHubConnection)
- Unified API, no confusion

## Technical Notes

- Migration is one-time and idempotent (safe to call multiple times)
- Hub ID generated with crypto.randomUUID() if not present in hub.env
- HubConnectionSchema validates structure before writing
- Graceful degradation: if personal.json exists, skip migration
- Error handling: returns success/failure status for reporting

## Performance

- Migration is fast (file read + write)
- No database calls required for migration
- Setup time unaffected (writes JSON instead of .env)

## Security

- Encryption key preserved during migration
- Schema validation ensures all fields present
- Old hub.env deleted to prevent confusion

## Self-Check: PASSED
