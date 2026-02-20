---
phase: 4-review-psn-session
plan: 01
subsystem: documentation
tags: [documentation, quality-assurance, bug-tracking]
dependency_graph:
  requires: []
  provides: [issue-tracking, fix-roadmap]
  affects: [setup, voice-interview, database-schema]

tech_stack:
  added: []
  patterns:
    - issue-categorization-by-severity
    - cross-reference-mapping
    - root-cause-analysis
    - fix-complexity-estimation

key_files:
  created:
    - .planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md
  modified: []

key_decisions:
  - issue_organization: "Categorized 30 issues into CRITICAL (6), MAJOR (14), MINOR (10)"
  - fix_priority: "Prioritized by blocking impact, then user experience"
  - root_cause_mapping: "Identified hub connection inconsistency as root cause of multiple bugs"
  - architecture_note: "Documented need for architectural decision on RLS vs app-level security"

metrics:
  duration: "3 minutes"
  tasks_completed: 1/1
  files_created: 1
  files_modified: 0
  completed_date: "2026-02-20"
  lines_of_documentation: 1292
  issues_documented: 30
---

# Phase 4 Plan 1: PSN Session Issues Review - Summary

## Objective

Review the PSN SESSION_ULTRA.json file and document all issues, bugs, and improvement opportunities discovered during the setup and voice profile creation process. Create a comprehensive record of problems encountered to guide future development decisions.

## One-Liner

Documented 30 issues from PSN setup session including hub detection bugs, RLS policy errors, API key permission issues, and incomplete CLI tooling.

## Completed Tasks

| Task | Name | Commit | Files |
|------|-------|---------|--------|
| 1 | Extract and categorize all issues from SESSION_ULTRA.json | 7257b59 | .planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md |

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

## Authentication Gates

None encountered.

## Key Findings

### Issue Distribution
- **CRITICAL (6):** Block setup or prevent core functionality
- **MAJOR (14):** Significant friction or incomplete features
- **MINOR (10):** UX improvements and documentation gaps

### Top Critical Issues

1. **C1: Setup wizard hub detection bug** - `setup.ts` uses `getHubConnection(projectRoot, "personal")` which only looks for Company Hub files (`.hubs/*.json`), but Personal Hub is stored in `config/hub.env` via `loadHubEnv()`. This blocks voice profile creation.

2. **C2: Migration RLS policy error** - Schema defines `pgRole("hub_user").existing()` but role doesn't exist in Neon. Blocks database setup.

3. **C3: Provider keys table doesn't exist** - Migration failure (likely due to RLS error) leaves incomplete database state.

4. **C4: Neon API key permission error** - Project-scoped keys (`napi_...`) cannot create projects. Requires organization-scoped key.

### Root Cause Analysis

**Hub Connection Inconsistency:**
- Personal Hub stored in `config/hub.env` (loaded via `loadHubEnv()`)
- Company Hubs stored in `.hubs/*.json` (loaded via `getHubConnection()`)
- `setup.ts` incorrectly uses `getHubConnection("personal")` causing detection failure
- **Impact:** Issues C1, C11, C12, M2, M5

**Database Migration Fragility:**
- RLS policies require `hub_user` role that doesn't exist in Neon
- Migration failures leave database in incomplete state
- No recovery mechanism or state validation
- **Impact:** Issues C2, C3, M1, M16

**Voice Interview Design Mismatch:**
- Interview engine designed as library with programmatic API
- CLI surface incomplete (missing `submit`, `complete` commands)
- No state persistence between CLI invocations
- **Impact:** Issues C5, M9, M10

### Architectural Decision Needed

**Issue:** RLS policies not compatible with Neon free tier (C2, M16)

**Options:**
- **Option A:** Full RLS with self-hosted Postgres (full security, self-managed)
- **Option B:** App-level filtering for Neon (managed, reduced security)

**Recommendation:** Document both approaches, let deployment target decide.

## Key Decisions Made

### Issue Organization
Categorized all 30 issues by severity with consistent structure:
- Title and severity badge
- Description from session context
- Reproduction steps
- Root cause analysis
- Suggested fixes with multiple options
- Complexity estimation (simple/medium/complex)
- Priority recommendations

### Cross-Reference Mapping
Created issue clusters to identify root causes:
- **Hub Connection Issues:** 5 related issues pointing to storage inconsistency
- **Database Setup Issues:** 4 issues from migration fragility
- **Voice Interview Issues:** 3 issues from library vs CLI mismatch
- **Setup Flow Issues:** 8 issues from validation and recovery gaps

### Fix Prioritization
Recommended priority order based on blocking impact:
1. **Immediate (Critical):** C1-C4 - block setup
2. **High (Major):** C5, M1, M3, M12 - security/UX
3. **Medium (Major):** M2, M5, M8, M13, M14 - quality of life
4. **Low (Minor):** All MINOR issues - nice to have

## Files Created/Modified

### Created
- `.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md` (1,292 lines)
  - 6 critical issues with detailed analysis
  - 14 major issues with fix options
  - 10 minor issues with UX suggestions
  - Cross-reference mapping
  - Prioritization recommendations
  - Estimated fix complexity

### Modified
- None

## Success Criteria

- [x] Issues documentation file created
- [x] All 30+ issues from session captured
- [x] Each issue has severity, description, and fix suggestion
- [x] Document is readable and well-structured

## Next Steps

### Recommended Immediate Actions

1. **Fix C1 (Setup wizard hub detection bug):**
   - Update `setup.ts` to use `loadHubEnv()` for personal hub
   - Complexity: Simple
   - Impact: Unblocks voice profile creation

2. **Fix C2 (Migration RLS policy error):**
   - Remove RLS policies from Neon schema or implement app-level filtering
   - Complexity: Medium
   - Impact: Unblocks database setup

3. **Fix C4 (Neon API key permission error):**
   - Improve error message to detect key type and suggest org-scoped key
   - Complexity: Simple
   - Impact: Better onboarding experience

### Recommended Architectural Work

1. **Unify hub connection mechanism:**
   - Decide between single storage format or appropriate loader per type
   - Resolves: C1, C11, C12, M2, M5

2. **Add state management to voice interview CLI:**
   - Implement state file support or interactive mode
   - Resolves: C5, M9, M10

3. **Add setup recovery flow:**
   - Implement `/psn:setup reset` command
   - Resolves: M1, M14

## Performance Metrics

| Metric | Value |
|--------|-------|
| Duration | 3 minutes |
| Tasks Completed | 1/1 |
| Files Created | 1 |
| Files Modified | 0 |
| Lines of Documentation | 1,292 |
| Issues Documented | 30 |
| Cross-References Created | 15+ |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

### Verification Checks
- [x] Created file exists: `.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md`
- [x] Commit exists: `7257b59`
- [x] File contains 30+ issues with categorization
- [x] Each issue has severity, description, root cause, fix suggestion
- [x] Cross-references mapped for related issues
- [x] Prioritization recommendations provided
