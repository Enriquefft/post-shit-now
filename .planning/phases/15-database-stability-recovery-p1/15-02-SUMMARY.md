---
phase: 15-database-stability-recovery-p1
plan: 02
subsystem: Core Utilities
tags: [nanoid, hub-id, migration, auto-generation]
tech-stack:
  added:
    - nanoid utility (src/core/utils/nanoid.ts)
  patterns:
    - Native crypto API (no external dependencies)
    - URL-safe random ID generation
key-files:
  created:
    - src/core/utils/nanoid.ts
  modified:
    - src/core/utils/env.ts
decisions:
  - nanoid uses Node.js crypto.randomBytes() (native, no nanoid dependency)
  - 12-character length with 62-symbol alphabet (collision probability: 1 in 3.2e21)
  - HubId format: hub_ + 12 alphanumeric chars (e.g., hub_k3M8x7nV9pZ)
  - Validation before file write prevents partial state corruption
metrics:
  duration: "2min 41s"
  completed_date: "2026-02-21T10:29:51Z"
---

# Phase 15 Plan 02: Nanoid-style hubId Generation for Legacy Hub Migration Summary

Add nanoid-style hubId generation for legacy hub.env files during migration. Personal Hub files migrated from config/hub.env to .hubs/personal.json lack hubId field. This plan created nanoid utility and updated migration to auto-generate hubId when missing.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ----- | ------ | ----- |
| 1 | Create nanoid utility function | 277815a | src/core/utils/nanoid.ts |
| 2 | Update hub migration to auto-generate hubId | bd280d0 | src/core/utils/env.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Key Changes

### 1. Nanoid Utility (src/core/utils/nanoid.ts)

Created a nanoid-style ID generation utility using Node.js crypto API:

- **12-character** alphanumeric strings from 62-symbol alphabet
- **URL-friendly**: no special characters, safe for URLs/paths
- **Cryptographically secure**: uses `crypto.randomBytes()`
- **No dependencies**: native Node.js API, zero external packages
- **Collision probability**: ~1 in 3.2e21 (statistically impossible)

```typescript
export function nanoid(size = 12): string {
  const bytes = randomBytes(size);
  let result = "";
  for (let i = 0; i < size; i++) {
    result += ALPHABET[bytes[i] & 63];
  }
  return result;
}
```

### 2. Hub Migration Update (src/core/utils/env.ts)

Updated `migratePersonalHubToHubsDir()` to auto-generate hubId:

- **Auto-generates hubId** when HUB_ID missing from legacy hub.env
- **Format**: `hub_` + 12 alphanumeric chars (e.g., `hub_k3M8x7nV9pZ`)
- **Validation-first**: HubConnectionSchema validates before writing (prevents partial state)
- **Return value**: includes generated hubId for verification
- **Idempotent**: safe to call multiple times

```typescript
// Generate hubId if missing (legacy hub.env files)
const hubId = env.HUB_ID || `hub_${nanoid()}`;

// Validate with schema before writing (prevents partial state corruption)
const validated = HubConnectionSchema.parse(hubConnection);
await Bun.write(personalHubPath, JSON.stringify(validated, null, 2));

return { success: true, migrated: true, hubId };
```

## Verification Results

1. nanoid utility generates 12-character alphanumeric strings: PASSED
2. migratePersonalHubToHubsDir() generates hubId when missing: PASSED
3. HubId validation occurs before writing to .hubs/personal.json: PASSED
4. Migration failure prevents hubId write (prevents partial state): PASSED
5. Generated hubId format: "hub_" + 12 chars (e.g., "hub_k3M8x7nV9pZ"): PASSED

## Technical Notes

- Replaced `crypto.randomUUID().slice(0, 12)` with `nanoid()` for consistent format
- Alphabet: `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` (62 symbols)
- Bitmask `& 63` ensures random byte maps to valid alphabet index
- Validation with `HubConnectionSchema.parse()` ensures all required fields present

## Requirements Traceability

- **M2** (Milestone): Migration reliability and error handling
- **C12** (Database): hubId format consistency across all hub files

## Self-Check: PASSED

- Created files exist: src/core/utils/nanoid.ts, 15-02-SUMMARY.md
- Commits verified: 277815a (Task 1), bd280d0 (Task 2), e4947f3 (Final commit)
- STATE.md updated with position, decisions, metrics
- ROADMAP.md updated with phase 15 progress
