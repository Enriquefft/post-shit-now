---
phase: 07-team-coordination-and-notifications
plan: 03
subsystem: approval
tags: [approval-workflow, calendar, state-machine, brand-model, slot-claiming]

requires:
  - phase: 07-01
    provides: "Team schema with approval columns, team_members, notification tables"
  - phase: 07-02
    provides: "Company Hub connection, team member management, isAdmin guard"
provides:
  - "Approval state machine: submit, approve, reject, resubmit with admin authorization"
  - "Multi-hub unified calendar with slot claiming and concurrency protection"
  - "Publish-post approval gate for company posts (skip if unapproved)"
  - "Company brand preference model shared across team members"
  - "Brand preference model update function for standalone use"
affects: [07-04, 07-05, notifications, slash-commands]

tech-stack:
  added: []
  patterns:
    - "Approval state machine with isValidTransition guard on every state change"
    - "Multi-hub independent queries with per-hub fault isolation"
    - "SELECT FOR UPDATE for slot claiming concurrency"
    - "Company-level preference model keyed by hubId as userId"

key-files:
  created:
    - src/approval/workflow.ts
    - src/approval/calendar.ts
  modified:
    - src/trigger/publish-post.ts
    - src/learning/feedback.ts

key-decisions:
  - "Approval stats use 3 separate queries for simplicity over single aggregation query"
  - "Brand preference model uses hubId as userId in preference_model table (no new table)"
  - "Calendar default optimal hours per platform when strategy.yaml not available"
  - "Publish-post approval gate returns 'skipped' status, never 'failed', for unapproved posts"

patterns-established:
  - "Approval state machine: all transitions validated by isValidTransition before DB update"
  - "Company brand model: shared preference_model record keyed by hubId"
  - "Multi-hub calendar: independent queries with try/catch per hub"

requirements-completed: [TEAM-05, TEAM-08, TEAM-09, LEARN-09, SERIES-07]

duration: 4min
completed: 2026-02-19
---

# Phase 7 Plan 3: Approval Workflow and Calendar Summary

**Approval state machine with admin-gated submit/approve/reject cycle, multi-hub calendar with slot claiming, and publish-post approval gate that skips unapproved company posts**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T15:55:32Z
- **Completed:** 2026-02-19T15:59:15Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Full approval workflow: submit, approve (with inline edit), reject, resubmit with admin authorization guards
- Unified calendar merges Personal + Company Hubs with fault isolation per hub
- Slot claiming with SELECT FOR UPDATE concurrency protection
- Publish-post gates company posts on approval -- tentatively scheduled posts skip (not fail) when unapproved
- Company brand preference model shared across team members, updated on successful publish

## Task Commits

Each task was committed atomically:

1. **Task 1: Approval workflow state machine** - `2b17ce7` (feat)
2. **Task 2: Multi-hub calendar and slot claiming** - `841ebad` (feat)
3. **Task 3: Extend publish-post with approval gate and company brand preference model** - `8e8e281` (feat)

## Files Created/Modified
- `src/approval/workflow.ts` - Approval state machine: submitForApproval, approvePost, rejectPost, resubmitPost, getApprovalStatus, listPendingApprovals, getApprovalStats
- `src/approval/calendar.ts` - Unified calendar, slot claiming/releasing, available slots, CLI formatter
- `src/trigger/publish-post.ts` - Approval gate for company posts, brand preference model update after publish
- `src/learning/feedback.ts` - updateBrandPreferenceModel export for standalone company hub usage

## Decisions Made
- Approval stats use 3 separate queries rather than a single complex aggregation for clarity and maintainability
- Brand preference model reuses existing preference_model table with hubId as userId (no new table needed)
- Calendar provides default optimal posting hours per platform when strategy.yaml is unavailable
- Publish-post returns 'skipped' status for unapproved company posts (never 'failed') per CONTEXT.md tentative scheduling design

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Approval workflow ready for notification dispatch integration (07-04)
- Calendar ready for slash command wiring (07-05)
- Brand preference model ready for analytics collection to update scores

---
*Phase: 07-team-coordination-and-notifications*
*Completed: 2026-02-19*
