# Phase 7: Team Coordination and Notifications - Research

**Researched:** 2026-02-19
**Domain:** Company Hub provisioning, team coordination, approval workflows, WhatsApp notifications (WAHA/Twilio)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. Company Hub Architecture**
- Company Hub = separate Neon DB + Trigger.dev project (mirrors Personal Hub pattern)
- Creator becomes admin automatically
- Two roles only: admin + member
- Admin: full control, generate invite codes, approve/reject posts, manage team, view all analytics
- Member: create posts, submit for approval, view own analytics, claim calendar slots

**2. Invite Code Flow**
- One-time use, time-limited (48 hours expiry)
- Admin generates as many codes as needed
- No role embedded in code — all invitees join as Member (admin promotes manually)

**3. Offboarding**
- Content stays with attribution: published posts and author preserved permanently
- Only access is revoked — member can no longer post or view company data
- Clean departure: delete connection file from local repo

**4. Approval Workflow**
- Submit -> notify admins -> approve/reject: author submits draft, all admins get notified, any admin can act
- No assigned reviewer — any admin can approve or reject
- Rejection includes optional comment explaining why
- Both WhatsApp and CLI review channels
- Admin can edit + approve: edits tracked for transparency
- Default: tentative scheduling (holds at scheduled time, skips if unapproved by post time)

**5. WhatsApp Notification Tiers**
- Push (immediate): approval requests, post failures, token expiry, viral alerts
- Digest: configurable frequency (daily, twice daily, weekly)
- Structured commands: buttons + text fallback (R1/R2/R3, approve, reject, etc.)
- Fatigue prevention: rate limits + quiet hours (most aggressive wins)

**6. Unified Calendar**
- Hub-grouped sections (Personal, Company A, Company B)
- Slot claiming: members claim available time slots, admin can reassign
- Cross-hub overlap allowed (different audiences)

### Claude's Discretion
None captured — all areas received explicit decisions.

### Deferred Ideas
None captured during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEAM-01 | Admin can create a Company Hub via `/psn:setup hub` | Mirrors Personal Hub: neonctl + Trigger.dev CLI provisioning |
| TEAM-02 | Admin generates one-time invite codes (48h expiry) | invite_codes table with crypto.randomBytes + expiry logic |
| TEAM-03 | Team member joins via `/psn:setup join` with invite code | Validates code, creates team_members record, generates connection file |
| TEAM-04 | Postgres RLS enforces per-user data isolation in Company Hub | Same RLS pattern as Personal Hub with team_members role awareness |
| TEAM-05 | Company posts follow approval workflow: submit -> notify -> approve/reject -> schedule/cancel | Approval state machine on posts table + notification dispatch |
| TEAM-06 | `/psn:approve` shows pending posts with context | CLI command reading submitted posts from Company Hub |
| TEAM-07 | Team member leaving = delete connection file | Connection file deletion + access revocation, content preserved |
| TEAM-08 | `/psn:calendar` merges Personal + Company Hubs | Multi-hub query, hub-grouped display |
| TEAM-09 | Calendar slot claiming with conflict checking | Slot claiming via posts table with company hub context |
| NOTIF-01 | WhatsApp via WAHA (self-hosted) with Twilio fallback | WAHA REST API + Twilio Messaging API as provider abstraction |
| NOTIF-02 | Tier 1 push notifications | Immediate dispatch on trigger events |
| NOTIF-03 | Tier 2 morning digest | Trigger.dev scheduled task compiles digest |
| NOTIF-04 | Tier 3 standard notifications | Event-driven dispatch with lower priority |
| NOTIF-05 | WhatsApp structured commands | WAHA buttons/list API + text parsing fallback |
| NOTIF-06 | Conversation state machine | whatsapp_sessions table tracking active context |
| NOTIF-07 | Fatigue prevention: caps, cooldowns, quiet hours | Rate tracking in notification_log table |
| NOTIF-08 | Company-level notification routing | Team member expertise matching for notification targets |
| LEARN-09 | Company brand preference model | Shared preference_model in Company Hub DB |
| SERIES-07 | Company-scoped series with contributor rotation | Series with hubId + rotation scheduling |
| CONFIG-05 | `/psn:setup join` and `/psn:setup hub` | Setup flow extensions for company operations |
| CONFIG-06 | `/psn:setup disconnect` for clean Company Hub removal | Connection file deletion + optional cleanup |
</phase_requirements>

## Summary

Phase 7 introduces multi-tenant team coordination via Company Hubs and a WhatsApp notification layer. The core architectural insight is that a Company Hub is structurally identical to a Personal Hub (Neon Postgres + Trigger.dev project) — the same schema, the same RLS policies, but with additional tables for team membership, invite codes, and notification preferences. Team members connect to a Company Hub via a local connection file (`.hubs/company-{slug}.json`), and all Company Hub operations route through this connection.

The approval workflow is a simple state machine on the existing posts table: `draft -> submitted -> approved/rejected -> scheduled/cancelled`. No separate approval table needed — the post record itself carries the approval state, reviewer ID, and review comment.

WhatsApp notifications use a provider abstraction layer that supports both WAHA (self-hosted, free for single session) and Twilio (hosted, pay-per-message) through the same interface. WAHA provides REST endpoints for sending text, images, buttons, and list messages, with webhooks for incoming messages. The notification system is a Trigger.dev task layer: events trigger immediate dispatch (push tier), scheduled tasks compile digests, and a webhook handler processes incoming structured commands.

**Primary recommendation:** Build in 5 plans: (1) DB schema extensions for team/notification tables, (2) Company Hub provisioning and invite code flow, (3) approval workflow engine and notification dispatcher, (4) WhatsApp provider abstraction and structured commands, (5) slash commands (`/psn:approve`, `/psn:calendar`, setup extensions).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crypto | built-in | Invite code generation | Node.js built-in crypto.randomBytes for secure codes |
| zod | v4 (existing) | Validation | Already used throughout for schema validation |
| drizzle-orm | (existing) | DB operations | Single source of truth for all schema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch | built-in | WAHA/Twilio API calls | Built-in fetch for HTTP requests to notification providers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch for WAHA | waha-sdk (unofficial) | No official SDK; raw fetch matches XClient/LinkedInClient pattern |
| Raw fetch for Twilio | twilio npm package | Official SDK adds 5MB+ dependency; raw REST API is trivial for messaging-only use |
| Separate approval table | Approval fields on posts table | Posts already have status field; adding approval columns keeps data co-located |

**Installation:** No new dependencies required. All functionality uses existing libraries and Node.js built-ins.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── team/
│   ├── hub.ts              # NEW: Company Hub provisioning, connection management
│   ├── invite.ts           # NEW: Invite code generation and redemption
│   ├── members.ts          # NEW: Team member management (join, leave, promote)
│   └── types.ts            # NEW: Team types, connection file schema
├── approval/
│   ├── workflow.ts          # NEW: Approval state machine (submit, approve, reject)
│   ├── calendar.ts          # NEW: Multi-hub calendar merging, slot claiming
│   └── types.ts            # NEW: Approval types
├── notifications/
│   ├── provider.ts          # NEW: Provider abstraction (WAHA/Twilio interface)
│   ├── waha.ts             # NEW: WAHA REST API client
│   ├── twilio.ts           # NEW: Twilio REST API client for WhatsApp
│   ├── dispatcher.ts       # NEW: Notification dispatch (push/digest/standard)
│   ├── commands.ts         # NEW: Incoming structured command parser
│   ├── digest.ts           # NEW: Digest compilation logic
│   └── types.ts            # NEW: Notification types, tiers, preferences
├── trigger/
│   ├── notification-dispatcher.ts  # NEW: Push notification dispatch task
│   ├── digest-compiler.ts          # NEW: Scheduled digest compilation task
│   ├── notification-webhook.ts     # NEW: Incoming WhatsApp message handler
│   └── publish-post.ts             # EXTEND: Approval check before publish
├── cli/
│   ├── setup-company-hub.ts  # NEW: Company Hub creation wizard
│   ├── setup-join.ts         # NEW: Join Company Hub with invite code
│   ├── setup-disconnect.ts   # NEW: Disconnect from Company Hub
│   └── setup.ts              # EXTEND: Add hub/join/disconnect subcommands
├── core/
│   └── db/
│       └── schema.ts         # EXTEND: team_members, invite_codes, notification tables
└── .claude/
    └── commands/
        └── psn/
            ├── approve.md     # NEW: /psn:approve command
            └── calendar.md    # NEW: /psn:calendar command
```

### Pattern 1: Company Hub Connection File
**What:** Local JSON file storing Company Hub connection details, decoupled from the repo.
**When to use:** Every Company Hub interaction.
**Example:**
```typescript
// .hubs/company-acme.json (gitignored)
{
  "hubId": "hub_xxx",
  "slug": "acme",
  "displayName": "Acme Corp",
  "databaseUrl": "postgresql://...",
  "triggerProjectId": "proj_xxx",
  "role": "member",
  "joinedAt": "2026-02-19T10:00:00Z"
}

// Hub resolution: scan .hubs/ directory for all connection files
// Personal Hub from .env, Company Hubs from .hubs/*.json
```

### Pattern 2: Approval State Machine
**What:** Approval workflow as post status transitions with guard conditions.
**When to use:** Every company post submission/review.
**Example:**
```typescript
// Post status transitions for company posts:
// draft -> submitted (author submits for review)
// submitted -> approved (admin approves)
// submitted -> rejected (admin rejects with optional comment)
// approved -> scheduled (system schedules at tentative time)
// rejected -> draft (author can edit and re-submit)
//
// Guard: only company hub posts enter approval workflow
// Guard: submitted -> approved requires admin role
// Guard: tentative scheduling skips if unapproved at post time

const APPROVAL_TRANSITIONS = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: ['scheduled', 'published'],
  rejected: ['draft'], // can re-edit and re-submit
} as const;
```

### Pattern 3: WhatsApp Provider Abstraction
**What:** Interface that both WAHA and Twilio implement for send/receive operations.
**When to use:** All notification dispatch.
**Example:**
```typescript
interface WhatsAppProvider {
  sendText(to: string, body: string): Promise<MessageResult>;
  sendButtons(to: string, body: string, buttons: Button[]): Promise<MessageResult>;
  sendList(to: string, body: string, sections: ListSection[]): Promise<MessageResult>;
  sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult>;
}

// WAHA: POST /api/sendText, POST /api/send/buttons/reply, POST /api/sendList
// Twilio: POST /2010-04-01/Accounts/{sid}/Messages.json with ContentSid for templates
```

### Pattern 4: Notification Event Router
**What:** Events route to appropriate tier (push/digest/standard) based on type and user preferences.
**When to use:** Every notification-triggering event.
**Example:**
```typescript
const NOTIFICATION_ROUTES: Record<string, NotificationTier> = {
  'approval.requested': 'push',
  'post.failed': 'push',
  'token.expiring': 'push',
  'post.viral': 'push',
  'post.published': 'standard',
  'approval.result': 'standard',
  'digest.weekly': 'digest',
  'digest.daily': 'digest',
};
```

### Anti-Patterns to Avoid
- **Shared database connection pool across hubs:** Each hub has its own DB; connection pooling must be per-hub, not shared.
- **Polling for notifications:** Use Trigger.dev event-driven tasks, not polling intervals.
- **Storing notification content in DB:** Only store notification log (what was sent when), not full message content.
- **Hard-coding notification provider:** Provider abstraction allows swapping WAHA/Twilio without touching dispatch logic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Invite code generation | Custom random strings | crypto.randomBytes(16).toString('hex') | Cryptographically secure, sufficient entropy |
| WhatsApp message formatting | Custom markup parser | WAHA/Twilio formatting APIs | Providers handle WhatsApp markdown natively |
| Scheduled digest delivery | Custom cron | Trigger.dev scheduled tasks | Already have Trigger.dev for all scheduling |
| Multi-hub connection management | Custom discovery protocol | File-based .hubs/ directory scan | Simple, git-friendly, zero dependencies |

## Common Pitfalls

### Pitfall 1: RLS Policy Collision Between Personal and Company Hubs
**What goes wrong:** RLS policies from Personal Hub schema conflict with Company Hub team-aware policies.
**Why it happens:** Company Hub needs RLS that allows team members to see company-scoped data, not just their own.
**How to avoid:** Company Hub uses a different RLS strategy: `userId = current_setting('app.current_user_id') OR EXISTS (SELECT 1 FROM team_members WHERE user_id = current_setting('app.current_user_id') AND hub_id = current_setting('app.current_hub_id'))`. Personal Hub RLS stays unchanged.
**Warning signs:** Members can see other members' personal data, or can't see shared company data.

### Pitfall 2: WAHA Session Expiry
**What goes wrong:** WAHA WhatsApp session disconnects silently after inactivity.
**Why it happens:** WhatsApp Web sessions expire and need re-authentication via QR code scan.
**How to avoid:** Health check endpoint (`GET /api/sessions/{session}/status`) on a cron schedule. Re-notify admin if session drops. Store session status in whatsapp_sessions table.
**Warning signs:** Notifications stop working without errors in application logs.

### Pitfall 3: Notification Fatigue Spiral
**What goes wrong:** Users disable notifications entirely because they get too many push notifications.
**Why it happens:** No rate limiting, no quiet hours, too many events classified as "push."
**How to avoid:** Hard cap of 3 push notifications per day (excess routes to next digest). Quiet hours respected. Dedup within 30-minute windows. Escalation to digest if push cap hit.
**Warning signs:** Users asking "how do I turn this off?"

### Pitfall 4: Approval Workflow Deadlock
**What goes wrong:** Posts with tentative schedules miss their window because no admin is available.
**Why it happens:** Tentative scheduling expects approval before post time, but no SLA on admin response.
**How to avoid:** Escalation logic: 1 hour before scheduled time, send urgent push to all admins. At scheduled time, if unapproved, skip with notification to author. Author can reschedule.
**Warning signs:** Posts stuck in "submitted" with scheduled times in the past.

### Pitfall 5: Connection File Secrets Exposure
**What goes wrong:** Company Hub connection files with database URLs get committed to git.
**Why it happens:** `.hubs/` directory not in .gitignore, or user copies repo without cleaning.
**How to avoid:** `.hubs/` MUST be in .gitignore (added during setup). Connection files use encrypted credentials matching the Personal Hub pattern.
**Warning signs:** Database URLs visible in git history.

### Pitfall 6: Twilio WhatsApp Template Approval Delay
**What goes wrong:** Custom notification templates need Meta approval which takes 24-48 hours.
**Why it happens:** Twilio WhatsApp requires pre-approved templates for business-initiated messages outside the 24-hour session window.
**How to avoid:** Design notifications to work within the 24-hour session window when possible. Pre-register a small set of generic templates (approval request, post status, digest summary) during initial setup. WAHA doesn't have this restriction (uses WhatsApp Web protocol).
**Warning signs:** Twilio returns "Message template not found" errors.

## Code Examples

### WAHA Send Button Message
```typescript
// POST {WAHA_URL}/api/send/buttons/reply
const response = await fetch(`${wahaUrl}/api/send/buttons/reply`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session: 'default',
    chatId: `${phoneNumber}@c.us`,
    body: 'New post pending approval:\n\n"5 AI tools every developer needs"\n\nBy @john - scheduled for 2:00 PM',
    buttons: [
      { id: 'approve', body: 'Approve' },
      { id: 'reject', body: 'Reject' },
      { id: 'view', body: 'View in CLI' },
    ],
  }),
});
```

### Twilio Send WhatsApp Message
```typescript
// POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
const params = new URLSearchParams();
params.set('To', `whatsapp:+${phoneNumber}`);
params.set('From', `whatsapp:+${twilioNumber}`);
params.set('ContentSid', templateSid); // Pre-approved template
params.set('ContentVariables', JSON.stringify({ '1': postTitle, '2': authorName }));

const response = await fetch(
  `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  }
);
```

### Company Hub Connection Discovery
```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

interface HubConnection {
  hubId: string;
  slug: string;
  displayName: string;
  databaseUrl: string;
  triggerProjectId: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

async function discoverCompanyHubs(projectRoot: string): Promise<HubConnection[]> {
  const hubsDir = join(projectRoot, '.hubs');
  try {
    const files = await readdir(hubsDir);
    const connections: HubConnection[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await readFile(join(hubsDir, file), 'utf-8');
        connections.push(JSON.parse(content));
      }
    }
    return connections;
  } catch {
    return []; // No .hubs directory = no company connections
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WhatsApp Business API (cloud) only | WAHA self-hosted + Twilio as fallback options | 2024+ | WAHA eliminates Meta's per-conversation pricing ($0.05-0.08/conversation) |
| Polling for WhatsApp incoming | Webhook-based message reception | Standard | Event-driven, no compute waste |
| Single-tenant DB per user | Same schema, different connections per hub | Project standard | Mirrors existing Personal Hub pattern |
| Assigned reviewer workflows | Any-admin approval | Context decision | Simpler, faster, no bottleneck on specific admin |

**WAHA vs Twilio comparison:**
| Feature | WAHA (self-hosted) | Twilio |
|---------|-------------------|--------|
| Cost | Free (Core) / $19/mo (Plus) | ~$0.005-0.08 per message |
| Setup | Docker container + QR scan | API keys from Twilio console |
| Templates | Not required (uses WhatsApp Web) | Required for business-initiated messages |
| Buttons | Supported (Plus tier) | Supported via Content Templates |
| Multi-session | Plus tier only | Unlimited |
| Reliability | Depends on self-hosting | 99.95% SLA |
| Rate limits | WhatsApp Web limits (~250 msgs/day) | Meta-imposed limits (varies by tier) |

## Open Questions

1. **WAHA Plus vs Core for buttons**
   - What we know: Interactive buttons (send/buttons/reply) are marked as "Plus" features in WAHA docs.
   - What's unclear: Whether the free Core tier supports any button-like messages or only text.
   - Recommendation: Build provider abstraction that degrades gracefully — if buttons not available, send text with numbered options (R1/R2/R3 pattern from CONTEXT.md).

2. **Trigger.dev webhook handling for incoming WhatsApp**
   - What we know: Trigger.dev tasks are for outgoing work. Incoming webhooks need a web server.
   - What's unclear: Whether to use a separate Express server or Trigger.dev's HTTP trigger feature.
   - Recommendation: Use Trigger.dev HTTP trigger if available, otherwise a minimal webhook handler that triggers a Trigger.dev task for processing.

3. **Company Hub Trigger.dev project sharing**
   - What we know: Each Company Hub is supposed to have its own Trigger.dev project.
   - What's unclear: Whether team members need their own Trigger.dev access or if the admin's project handles all team tasks.
   - Recommendation: Admin's Trigger.dev project handles all company tasks. Team members' personal Trigger.dev projects remain separate. Company connection file includes the Trigger.dev project reference.

## Sources

### Primary (HIGH confidence)
- [WAHA WhatsApp HTTP API](https://waha.devlike.pro/) - Self-hosted WhatsApp API, REST endpoints, message types
- [WAHA GitHub](https://github.com/devlikeapro/waha) - Three engines (WEBJS, NOWEB, GOWS), Docker deployment
- [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp/api) - WhatsApp Business Platform integration
- [Twilio WhatsApp Buttons](https://www.twilio.com/docs/whatsapp/buttons) - Interactive button messages
- [Twilio Content Templates](https://www.twilio.com/docs/content/overview) - Template builder for rich messages
- [Twilio Quick Reply](https://www.twilio.com/docs/content/twilio-quick-reply) - Quick reply buttons (up to 10, 3 for in-session)

### Secondary (MEDIUM confidence)
- [WAHA Self-Hosted Guide](https://medium.com/@hasanmcse/waha-self-hosted-whatsapp-api-with-docker-for-secure-automation-6d0377a10f70) - Docker setup, session management
- [WAHA Postman Collection](https://www.postman.com/devlikeapro/waha/collection/0ur16x3/waha-whatsapp-http-api-2024-8) - Full API endpoint reference

### Tertiary (LOW confidence)
- WAHA Plus pricing: $19/mo mentioned in community but not confirmed on official site. May have changed.
- WAHA button support in Core tier: Unconfirmed. Degraded text fallback is the safe approach.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; WAHA/Twilio are well-documented REST APIs
- Architecture: HIGH - Company Hub mirrors proven Personal Hub pattern; approval is simple state machine
- Pitfalls: HIGH - RLS collision is the main risk; notification fatigue is well-understood problem
- WhatsApp specifics: MEDIUM - WAHA Plus vs Core capabilities need runtime verification

**Research date:** 2026-02-19
**Valid until:** 2026-03-19
