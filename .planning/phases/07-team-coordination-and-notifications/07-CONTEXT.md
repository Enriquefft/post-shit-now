# Phase 7: Team Coordination and Notifications — Context

Created: 2026-02-19
Phase goal: Teams can coordinate content through Company Hubs with approval workflows and WhatsApp notifications.

---

## 1. Company Hub Onboarding

### Hub creation
- **Any user creates via `/psn:setup`**: run `/psn:setup create-company` to spin up a Company Hub
- Creator becomes admin automatically
- Company Hub = separate Neon DB + Trigger.dev project (same pattern as Personal Hub)

### Roles
- **Admin + Member**: two roles only
- Admin: full control, generate invite codes, approve/reject posts, manage team, view all analytics
- Member: create posts, submit for approval, view own analytics, claim calendar slots

### Invite codes
- **One-time use, time-limited**: each code works exactly once, expires in 48 hours
- Admin generates as many codes as needed
- No role embedded in code — all invitees join as Member (admin promotes manually)

### Offboarding
- **Content stays with attribution**: published posts and author attribution preserved permanently
- Only access is revoked — member can no longer post or view company data
- Clean departure: delete connection file from local repo

---

## 2. Approval Workflow UX

### Flow
- **Submit → notify admins → approve/reject**: author submits draft, all admins get notified, any admin can act
- No assigned reviewer — any admin can approve or reject
- Rejection includes optional comment explaining why

### Review channels
- **Both WhatsApp and CLI**: notification via WhatsApp with post preview, detailed review via `/psn:approve` in CLI
- Either channel can approve — WhatsApp buttons or CLI command, whichever admin prefers
- Approval is idempotent — approving an already-approved post is a no-op

### Admin editing
- **Edit + approve**: admin can make edits directly to the draft and approve the modified version
- Edit history tracked (who changed what) for transparency
- Author sees edits in their next `/psn:approve` or notification

### Scheduling constraint
- **Author chooses**: author can either:
  - Schedule tentatively (post holds at scheduled time if not yet approved — skips if still unapproved by post time)
  - Wait for approval before scheduling (post enters queue only after admin approves)
- Default: tentative scheduling (most common workflow)

---

## 3. WhatsApp Notification Tiers

### Push (immediate) triggers
All 4 trigger types enabled:
- **Approval requests**: new post submitted → immediate to all admins
- **Post failures**: publish failure after 3 retries → immediate to author
- **Token expiry warnings**: OAuth token near expiry → immediate re-auth reminder
- **Viral post alerts**: post exceeding 3x average engagement → immediate to author

### Digest notifications
- **Configurable frequency**: user sets preferred cadence (daily, twice daily, weekly)
- Content adapts to frequency — daily gets highlights, weekly gets full summary
- Covers: published posts, pending approvals, analytics highlights, upcoming schedule

### Structured commands
- **Buttons + text fallback**: WhatsApp interactive message buttons for common actions ([Approve] [Reject] [View])
- Text parsing for edge cases (reply "approve", "reject reason: too long", etc.)
- Buttons preferred — text is fallback for when buttons aren't available

### Fatigue prevention
- **Rate limits + quiet hours**: both mechanisms, most aggressive wins
- Rate caps: max N push notifications per hour (excess queued to next digest)
- Quiet hours: user-configurable window (e.g., 10PM–8AM) — push held until window ends
- Digest always respects configured time, never sent during quiet hours

---

## 4. Unified Calendar Experience

### Display
- **Hub-grouped sections**: separate sections per hub — "Personal", "Company A", "Company B"
- Each hub has its own timeline within the calendar view
- Clear visual separation so user knows which hub each post belongs to

### Slot claiming
- **Claim + admin approval**: members claim available time slots in company calendar
- Admin can reassign or override claims
- Unclaimed slots visible to all members as available

### Conflict resolution
- **Allow overlap**: personal and company posts can be at the same time
- Different audiences — simultaneous posting is acceptable
- No automatic staggering or warnings for cross-hub overlap

### Analytics in calendar
- **Optional analytics overlay**: default is a clean scheduling view
- Toggle to overlay engagement scores on past (published) posts
- Upcoming posts show status only (scheduled, pending approval, draft)

---

## Deferred Ideas

None captured during this discussion.

---

## Summary for Downstream Agents

### Key patterns
- Company Hub mirrors Personal Hub architecture (separate Neon DB + Trigger.dev project)
- Two roles only (admin/member) — keep it simple, no RBAC complexity
- Invite codes are one-time, 48h expiry — no multi-use or role-specific codes
- Approval is any-admin (not assigned) with dual-channel review (WhatsApp + CLI)
- Admins can edit drafts directly before approving
- WhatsApp uses interactive buttons for actions, text as fallback
- Calendar is hub-grouped, not merged — cross-hub overlap is allowed

### New DB/schema needs
- Company Hub DB: same schema as Personal Hub + team_members table (user_id, role, joined_at)
- Invite codes table: code, company_hub_id, created_by, expires_at, used_by, used_at
- Approval state on posts: status (draft/submitted/approved/rejected), reviewer_id, review_comment, reviewed_at
- Notification preferences table: user_id, tier (push/digest), frequency, quiet_hours_start, quiet_hours_end
- WhatsApp session table: user_id, phone, session_state, provider (waha/twilio)

### Existing patterns to extend
- `/psn:setup` → add create-company and join flows
- Post status → add submitted/approved/rejected states for company posts
- Trigger.dev tasks → add notification dispatcher, digest compiler
- RLS policies → company hub needs team-member-aware policies
- `/psn:post` → detect company hub context, auto-submit for approval
- Planning engine → company calendar slots with claiming logic
