---
phase: 01-critical-setup-fixes
plan: 02
type: execute
wave: 1
depends_on: [01-01]
files_modified:
  - src/core/utils/env.ts
  - src/cli/setup-db.ts
autonomous: true
requirements: [C4]

subsystem: Database Setup
tags: [validation, neon, api-keys, error-handling]
dependency_graph:
  requires:
    - "Phase 01-Plan01: Database migration fixes"
  provides:
    - "Neon API key validation before project creation"
  affects:
    - "setup-db.ts: database creation flow"

tech_stack:
  added:
    - "ValidationResult interface for structured error responses"
    - "validateNeonApiKey async function with dual-layer validation"
  patterns:
    - "Fast prefix check + API validation two-layer pattern"
    - "Graceful degradation (network failure = warning, not error)"
    - "Actionable error messages with suggestions"

key_files:
  created: []
  modified:
    - path: "src/core/utils/env.ts"
      changes: "Added ValidationResult interface and validateNeonApiKey function with prefix check and API validation"
    - path: "src/cli/setup-db.ts"
      changes: "Integrated key validation before neonctl project creation, with error handling"

decisions:
  - "Two-layer validation: fast prefix check for immediate feedback + API call for actual verification"
  - "Graceful network failure handling: warn but don't block setup when API is unreachable"
  - "Actionable error messages: include both error description and step-by-step suggestion"

metrics:
  duration: "~3min"
  completed_date: "2026-02-20"
  tasks_completed: 2
  files_modified: 2
  lines_added: 77
  commits: 2
---

# Phase 01 Plan 02: Neon API Key Validation Summary

Add Neon API key validation to detect project-scoped keys (which cannot create projects) and guide users to generate organization-scoped keys. Resolves C4 (Neon API key permission error).

**Implementation:** Dual-layer validation combining immediate prefix detection with actual API verification via Neon projects endpoint.

## Tasks Completed

### Task 1: Add validateNeonApiKey function to env.ts
- Added `ValidationResult` interface with `valid`, `error`, `suggestion`, and `warning` fields
- Implemented `validateNeonApiKey` function with:
  - Fast prefix check for project-scoped keys (napi_re4y...) with immediate rejection
  - API validation via `GET /api/v1/projects` to verify key can list projects
  - 401 handling for invalid/expired keys
  - 403 handling for permission issues
  - Graceful network failure handling (warning, not blocking)
- Clear error messages with actionable suggestions for each failure mode

**Commit:** e48f5cf - feat(01-02): add validateNeonApiKey function to env.ts

### Task 2: Integrate key validation into setup-db.ts
- Imported `validateNeonApiKey` from `env.ts`
- Added validation call after loading `NEON_API_KEY`, before `neonctl` project creation
- Returns structured error with both error message and suggestion for invalid keys
- Displays warnings for network validation failures (non-blocking)
- Maintains existing resume-from-failure behavior for already-configured databases

**Commit:** 9963794 - feat(01-02): integrate key validation into setup-db.ts

## Deviations from Plan

None - plan executed exactly as written.

## Key Artifacts

### src/core/utils/env.ts
```typescript
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  warning?: string;
}

export async function validateNeonApiKey(apiKey: string): Promise<ValidationResult> {
  // Fast prefix check
  const projectScopedPrefix = "napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09";
  if (apiKey.startsWith(projectScopedPrefix)) {
    return {
      valid: false,
      error: "Project-scoped API key detected",
      suggestion: "Generate an organization-scoped API key from Neon Console -> Account -> API Keys. Organization keys start with: napi_k..."
    };
  }

  // API validation
  const response = await fetch("https://console.neon.tech/api/v1/projects", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });

  if (response.status === 401) {
    return { valid: false, error: "API key invalid or expired", suggestion: "Regenerate API key from Neon Console." };
  }

  if (response.status === 403) {
    return { valid: false, error: "API key lacks project creation permissions", suggestion: "Use an organization-scoped API key with project creation permissions." };
  }

  return { valid: true };
}
```

### src/cli/setup-db.ts (integration point)
```typescript
// Validate API key before attempting database creation
const keyValidation = await validateNeonApiKey(neonApiKey);
if (!keyValidation.valid) {
  return {
    step: "database",
    status: "error",
    message: `API key validation failed: ${keyValidation.error}`,
    data: {
      error: keyValidation.error,
      suggestion: keyValidation.suggestion,
    },
  };
}

if (keyValidation.warning) {
  console.warn(`Warning: ${keyValidation.warning}`);
}
```

## Success Criteria Achieved

- [x] Neon API key validation occurs before database creation
- [x] Project-scoped keys are rejected with clear error and suggestion
- [x] Organization-scoped keys pass validation
- [x] API call validation catches expired/invalid keys
- [x] Setup fails fast with helpful guidance for incorrect key types

## Requirements Satisfied

**C4:** Neon API key permission error → Detect project-scoped keys (napi_re4y...) which cannot create projects, validate via API, and show clear error messages explaining how to generate organization-scoped keys.

## Next Steps

Proceed to Plan 01-03: Run migrations on personal hub database (C2, C3, C5).
