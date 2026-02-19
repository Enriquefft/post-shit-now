---
phase: 07-team-coordination-and-notifications
plan: 01
subsystem: database
tags: [drizzle, postgres, rls, zod, team, approval, notifications, whatsapp]

requires:
  - phase: 01-foundation
    provides: "Drizzle schema patterns, RLS policy templates, pgRole hubUser"
  - phase: 06-multi-platform
    provides: "Posts table with multi-platform columns"
provides:
  - "teamMembers and inviteCodes tables for team coordination"
  - "Approval columns on posts table for company workflow"
  - "notificationPreferences, notificationLog, whatsappSessions tables"
  - "Type definitions for team, approval, and notification domains"
  - "WhatsAppProvider interface abstracting WAHA/Twilio"
  - "APPROVAL_TRANSITIONS state machine with isValidTransition"
  - "NOTIFICATION_ROUTES mapping event types to tiers"
  - "FATIGUE_LIMITS constants for notification throttling"
affects: [07-02, 07-03, 07-04, 07-05]

tech-stack:
  added: []
  patterns:
    - "Approval state machine via const APPROVAL_TRANSITIONS lookup"
    - "Notification tier routing via NOTIFICATION_ROUTES map"
    - "WhatsAppProvider interface for provider abstraction (WAHA/Twilio)"
    - "Team RLS with hub-based visibility (see own OR same hub members)"

key-files:
  created:
    - src/team/types.ts
    - src/approval/types.ts
    - src/notifications/types.ts
  modified:
    - src/core/db/schema.ts
    - src/core/types/index.ts

key-decisions:
  - "Team RLS allows seeing all members in same hub (not just own record)"
  - "inviteCodes has no RLS -- validated server-side only"
  - "Approval columns nullable on posts (null = personal, non-null = company)"
  - "pushEnabled/digestEnabled as integer (0/1) for Postgres boolean-as-int pattern"

patterns-established:
  - "Hub-scoped RLS: userId match OR hubId IN (same hub subquery)"
  - "State machine as const Record mapping current -> allowed next states"

requirements-completed: [TEAM-01, TEAM-02, TEAM-03, TEAM-04, NOTIF-06, NOTIF-07, LEARN-09, SERIES-07]

duration: 2min
completed: 2026-02-19
---

# Phase 7 Plan 1: Schema and Types for Team Coordination Summary

**Team/approval/notification schema with 5 new tables, approval columns on posts, Zod-validated types, and WhatsApp provider abstraction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T15:46:02Z
- **Completed:** 2026-02-19T15:47:57Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Defined complete type systems for team (HubConnection, TeamMember, InviteCode), approval (state machine), and notification (tiers, events, WhatsApp) domains
- Extended posts table with approval workflow columns (approvalStatus, reviewerId, reviewComment, reviewedAt)
- Added 5 new tables: teamMembers, inviteCodes, notificationPreferences, notificationLog, whatsappSessions
- All new tables (except inviteCodes) have RLS policies; teamMembers has hub-scoped visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Team and notification type definitions** - `a5142f5` (feat)
2. **Task 2: Schema extensions for team coordination tables** - `f81fe18` (feat)

## Files Created/Modified
- `src/team/types.ts` - HubRole, HubConnection, TeamMember, InviteCode types with Zod schemas
- `src/approval/types.ts` - ApprovalStatus, APPROVAL_TRANSITIONS state machine, isValidTransition, ApprovalAction
- `src/notifications/types.ts` - NotificationTier, NOTIFICATION_ROUTES, WhatsAppProvider interface, FATIGUE_LIMITS
- `src/core/db/schema.ts` - 5 new tables + 4 approval columns on posts
- `src/core/types/index.ts` - Re-exports for team/approval/notification types

## Decisions Made
- Team RLS allows seeing all members in same hub (not just own record) -- needed for team visibility
- inviteCodes has no RLS policy -- validated server-side, not user-scoped
- Approval columns are nullable on posts table (null = personal post, non-null = company workflow)
- pushEnabled/digestEnabled stored as integer (0/1) matching existing schema patterns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for all Phase 7 subsystems
- Team types ready for invite code generation and redemption (07-02)
- Approval types ready for workflow implementation (07-03)
- Notification types ready for WhatsApp provider implementation (07-04)

---
*Phase: 07-team-coordination-and-notifications*
*Completed: 2026-02-19*
