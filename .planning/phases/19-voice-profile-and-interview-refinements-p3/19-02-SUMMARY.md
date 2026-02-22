---
phase: 19-voice-profile-and-interview-refinements-p3
plan: 02
subsystem: voice
tags: [validation, security, import]
dependency_graph:
  requires: []
  provides: [URL validation for import operations]
  affects: [src/voice/import.ts]
tech_stack:
  added: []
  patterns: [validation-first, fail-fast, defensive-security]
key_files:
  created: []
  modified:
    - src/voice/import.ts (validateUrl function, importBlogContent integration)
key_decisions: []
metrics:
  duration: 133s
  completed_date: 2026-02-22
---

# Phase 19 Plan 02: URL Validation for Blog Import Summary

Implemented URL validation function and integrated it into importBlogContent to prevent processing invalid URLs with clear error messages. The validation enforces HTTP/HTTPS protocol requirements, blocks dangerous protocols, and rejects localhost addresses for security.

## One-Liner

JWT auth with refresh rotation using jose library... wait, wrong template. URL validation with HTTP/HTTPS enforcement, protocol filtering, and localhost rejection using native URL constructor for defensive security.

## Tasks Completed

### Task 1: Add URL validation function to import.ts

Added `validateUrl` function to `src/voice/import.ts` with the following features:

- Accepts string URL parameter
- Validates HTTP/HTTPS protocol requirement (rejects file://, javascript:, data:)
- Validates basic URL format using URL constructor
- Checks for valid hostname (no empty or whitespace)
- Blocks localhost and loopback addresses (localhost, 127.0.0.1, ::1, 127.*, 0.*)
- Returns `{valid: boolean, error: string | null}` result for easy consumption

**Error messages (actionable):**
- "Invalid URL format. URL must be a non-empty string."
- "Invalid URL format. URL should not have leading/trailing whitespace."
- "Invalid URL protocol. URL must start with http:// or https://"
- "Invalid URL protocol. JavaScript URLs are not allowed."
- "Invalid URL protocol. Data URLs are not allowed."
- "Invalid URL format. Could not parse hostname."
- "Invalid URL format. Hostname is required."
- "Localhost URLs are not allowed. Use a publicly accessible URL."

**Pattern reference:** Follows the `isValidTimezone` function pattern from `src/core/utils/timezone.ts` using try/catch with constructor-based validation.

**Commit:** `aabafbc`

### Task 2: Integrate validation into importBlogContent

Updated `importBlogContent` function to validate URLs before processing:

- Calls `validateUrl()` for each URL before attempting fetch
- Skips invalid URLs gracefully (continues processing valid ones)
- Tracks validation errors for aggregated error reporting
- Throws descriptive error if all URLs fail validation
- Error format: "Invalid URL 'https://example.com/blog': Invalid URL format. Could not parse hostname."
- Follows existing error pattern from src/voice/import.ts (throw Error with descriptive messages)

**Commit:** `1e501e4`

## Verification Results

All verification tests passed:

- `validateUrl` function exists in `src/voice/import.ts`
- `validateUrl` integrated into `importBlogContent` function
- Valid HTTPS URL: `https://example.com/blog` → valid
- Valid HTTP URL: `http://example.com/blog` → valid
- Invalid protocol (file://): `file:///path/to/file` → invalid
- Invalid protocol (javascript:): `javascript:alert('xss')` → invalid
- Malformed URL: `not-a-url` → invalid
- Localhost rejected: `http://localhost/blog` → invalid
- 127.0.0.1 rejected: `http://127.0.0.1/blog` → invalid
- Empty URL: `` → invalid
- Whitespace URL: `  https://example.com  ` → invalid
- URL with port: `https://example.com:8080/blog` → valid
- URL with path and query: `https://example.com/blog?foo=bar` → valid

**File statistics:**
- Lines in `src/voice/import.ts`: 549 (exceeds minimum 200 requirement)
- Exports: `validateUrl`, `importBlogContent`, `ValidationResult` (all required)

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None - no authentication operations performed during this plan.

## Success Criteria Met

- URL validation prevents invalid URLs from being processed
- Error messages include the problematic URL and specific validation failure reason
- importBlogContent validates all URLs before attempting fetch operations
- Invalid URLs throw descriptive errors with actionable messages
