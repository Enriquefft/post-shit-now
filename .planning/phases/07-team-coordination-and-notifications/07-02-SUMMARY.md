---
phase: 07-team-coordination-and-notifications
plan: 02
subsystem: team
tags: [neon, drizzle, invite-code, hub-provisioning, cli, base64, crypto]

requires:
  - phase: 07-01
    provides: "Team schema (teamMembers, inviteCodes tables) and types (HubConnection, TeamMember, InviteCode)"
  - phase: 01-foundation
    provides: "Neon DB setup pattern, Drizzle connection/migration, CLI setup flow, env loading"
provides:
  - "Company Hub provisioning (createCompanyHub) with Neon DB + migrations + connection file"
  - "Invite code generation/redemption (crypto-secure, one-time, 48h expiry)"
  - "Team member CRUD with soft-delete, role management, last-admin guard"
  - "Setup CLI subcommands: hub, join, disconnect"
  - "Hub discovery and connection file management (.hubs/ directory)"
affects: [07-03, 07-04, 07-05, approval-workflow, notifications]

tech-stack:
  added: []
  patterns: ["invite bundle as base64-encoded JSON for codeless hub joining", "soft-delete via leftAt for team member offboarding", ".hubs/ directory for multi-hub connection files"]

key-files:
  created:
    - src/team/hub.ts
    - src/team/invite.ts
    - src/team/members.ts
    - src/cli/setup-company-hub.ts
    - src/cli/setup-join.ts
    - src/cli/setup-disconnect.ts
  modified:
    - src/cli/setup.ts
    - .gitignore

key-decisions:
  - "Invite bundle as base64 JSON containing code + connection details -- avoids central registry"
  - "Neon HTTP driver for Company Hub connections (same pattern as Personal Hub)"
  - "Soft-delete for team member removal preserves attribution per CONTEXT.md"
  - "Last-admin guard prevents demoting the only admin in a hub"
  - "Server-side error during disconnect is non-fatal -- local file still removed"

patterns-established:
  - "Hub connection files in .hubs/company-{slug}.json with Zod validation on discovery"
  - "Setup subcommand routing via runSetupSubcommand in setup.ts"
  - "Invite bundle pattern: admin generates base64 bundle, member decodes and redeems"

requirements-completed: [TEAM-01, TEAM-02, TEAM-03, TEAM-07, CONFIG-05, CONFIG-06]

duration: 4min
completed: 2026-02-19
---

# Phase 7 Plan 2: Company Hub and Team Management Summary

**Company Hub provisioning via Neon DB with invite-bundle joining, team member CRUD with soft-delete, and CLI subcommands for hub/join/disconnect**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T15:49:49Z
- **Completed:** 2026-02-19T15:53:29Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments
- Company Hub provisioning creates Neon DB, runs migrations, inserts admin, and writes connection file
- Invite code flow with crypto.randomBytes, one-time use, 48h default expiry, and atomic redemption
- Team member CRUD with soft-delete offboarding, role promotion/demotion, and last-admin guard
- CLI extensions: `/psn:setup hub`, `/psn:setup join`, `/psn:setup disconnect`

## Task Commits

Each task was committed atomically:

1. **Task 1: Company Hub provisioning and connection file management** - `b5d86bf` (feat)
2. **Task 2: Invite code generation and redemption** - `419aa4a` (feat)
3. **Task 3: Team member management** - `65621a3` (feat)
4. **Task 4: Setup CLI extensions for hub/join/disconnect** - `1155c8c` (feat)

## Files Created/Modified
- `src/team/hub.ts` - Hub provisioning, discovery, connection management, DB access
- `src/team/invite.ts` - Invite code generation, redemption, listing, cleanup
- `src/team/members.ts` - Team member CRUD, role management, isAdmin helper
- `src/cli/setup-company-hub.ts` - CLI flow for Company Hub creation
- `src/cli/setup-join.ts` - CLI flow for joining via base64 invite bundle
- `src/cli/setup-disconnect.ts` - CLI flow for clean hub departure
- `src/cli/setup.ts` - Added subcommand routing (hub/join/disconnect)
- `.gitignore` - Added `.hubs/` entry to protect connection credentials

## Decisions Made
- Invite bundle as base64 JSON avoids needing a central registry -- admin shares a single string containing code + connection details
- Neon HTTP driver (stateless) for Company Hub connections matches Personal Hub pattern
- Soft-delete for team member removal (leftAt timestamp) preserves content attribution
- Last-admin guard in demoteToMember prevents leaving a hub without any admin
- Disconnect continues removing local file even if server-side removal fails (graceful degradation)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. NEON_API_KEY and TRIGGER_SECRET_KEY are already configured from Phase 1 setup.

## Next Phase Readiness
- Team infrastructure ready for approval workflow (07-03)
- isAdmin helper available for authorization guards in approval flow
- Hub connection pattern established for notification system (07-04, 07-05)

---
*Phase: 07-team-coordination-and-notifications*
*Completed: 2026-02-19*
