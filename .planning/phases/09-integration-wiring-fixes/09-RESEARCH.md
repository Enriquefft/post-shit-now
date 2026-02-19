# Phase 9: Integration Wiring Fixes - Research

**Researched:** 2026-02-19
**Domain:** Cross-module integration wiring (Trigger.dev task triggering, function arguments, import paths)
**Confidence:** HIGH

## Summary

Phase 9 is a pure wiring phase -- no new features, libraries, or schemas need to be created. All the code modules already exist and are fully implemented. The work is connecting existing modules that were built in isolation during Phases 7 and 8. Five specific integration gaps were identified in the v1.0 audit, and all five have clear, mechanical fixes.

The codebase uses Trigger.dev SDK's `task.trigger()` method for async task dispatch, Drizzle ORM for database access, and a file-based hub discovery pattern for multi-hub calendar views. The notification dispatcher task (`notificationDispatcherTask` in `src/trigger/notification-dispatcher.ts`) is a complete, working Trigger.dev task that is simply never triggered by any other code. Similarly, `checkIdeaBank()` accepts optional `db` and `userId` parameters but is called without them, `calendarCommand()` calls the wrong calendar function, the engagement monitor writes to `notification_log` but never triggers the dispatcher, and `generate.ts` never checks `lockedSettings` before applying preference model adjustments.

**Primary recommendation:** Wire five existing integration points using import statements + function call argument changes. No new modules needed. Each fix is 5-15 lines of code.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTIF-01 | WhatsApp notifications via WAHA with Twilio fallback | Already implemented in `src/notifications/provider.ts` + `waha.ts` + `twilio.ts`. Dispatcher task fully functional. Just needs callers to trigger it. |
| NOTIF-02 | Tier 1 push notifications (trending 70+, engagement, viral, approvals) | `NOTIFICATION_ROUTES` in `src/notifications/types.ts` correctly maps event types to tiers. Dispatcher handles push tier with fatigue checks. Wire engagement monitor to call dispatcher. |
| NOTIF-03 | Tier 2 morning digest at configurable time | Digest compiler exists at `src/trigger/digest-compiler.ts`. Queuing works via `notification_log` table. Medium-score engagement already queues digest entries. |
| NOTIF-04 | Tier 3 standard notifications (post scheduled/published, approval results, token expiring) | Event types defined in types.ts. Message formatting in `dispatcher.ts` handles all these. Just wire callers. |
| NOTIF-05 | WhatsApp structured commands (R1/R2/R3, skip, approve, reject) | Implemented in `src/notifications/commands.ts`. Works via `whatsapp_sessions` conversation context. |
| NOTIF-06 | Conversation state machine for WhatsApp sessions | `whatsapp_sessions` table and session state management exist. Dispatcher reads session state before dispatch. |
| NOTIF-07 | Notification fatigue prevention (3 push/day, 2hr cooldown, dedup) | `checkFatigueLimits()` in `src/notifications/dispatcher.ts` implements all rules. `FATIGUE_LIMITS` constants defined. Already active in dispatch path. |
| NOTIF-08 | Company-level notification routing by team member expertise | `routeCompanyNotification()` in `src/notifications/dispatcher.ts` routes by event type to admins/authors/all members. |
| TEAM-05 | Company posts follow approval workflow | `src/approval/workflow.ts` fully implements submit/approve/reject/resubmit. Wire approval events to notification dispatcher. |
| AUTH-07 | User notified when token refresh fails | `src/trigger/token-refresher.ts` records `refreshError` + `requiresReauth` in metadata on failure. Wire failure to trigger `notificationDispatcherTask` with `token.expiring` event. |
| POST-11 | System checks idea bank for ready ideas before asking for topic | `checkIdeaBank(db, userId)` in `src/content/topic-suggest.ts` is fully implemented. Just pass `db` and `userId` from `generate.ts`. |
| TEAM-07 | Team member leaving = delete connection file | `removeHubConnection()` in `src/team/hub.ts` already handles this. Wiring verified -- this is already connected via `src/cli/setup-disconnect.ts`. |
| TEAM-08 | /psn:calendar merges Personal + Company Hubs | `getUnifiedCalendar()` in `src/approval/calendar.ts` fully implemented. `calendarCommand()` in `src/cli/plan.ts` needs to call it instead of `getCalendarState()`. |
| ENGAGE-03 | Scores 60+: draft replies; 70+: push notify; 60-69: digest | Reply drafting works via `src/engagement/session.ts`. Engagement monitor categorizes by score. Wire 70+ to trigger notification dispatcher instead of just writing log rows. |
| LEARN-07 | User overrides are permanent -- system won't re-adjust locked settings | `isSettingLocked()` in `src/learning/locks.ts` works. `computeAdjustments()` in `adjustments.ts` already respects locks. Wire `generate.ts` to also check locks before applying preference model. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| @trigger.dev/sdk | ^3.x | Task definition and `.trigger()` dispatch | Already used throughout |
| drizzle-orm | ^0.38.x | Database queries via `HubDb` type | Already used throughout |
| Bun runtime | 1.x | TypeScript execution | Already the runtime |

### Supporting (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| yaml | ^2.x | Strategy config parsing | Already used |
| zod | ^3.x | Schema validation | Already used |

### No New Dependencies
This phase requires **zero** new npm packages. All wiring uses existing imports.

**Installation:**
```bash
# No installation needed
```

## Architecture Patterns

### Recommended Project Structure
No new files needed. All changes are in existing files:
```
src/
├── content/generate.ts        # Fix: pass db+userId to checkIdeaBank, check lockedSettings
├── cli/plan.ts                # Fix: call getUnifiedCalendar instead of getCalendarState
├── trigger/
│   ├── engagement-monitor.ts  # Fix: trigger notificationDispatcherTask for 70+ scores
│   ├── publish-post.ts        # Fix: trigger notificationDispatcherTask on failure
│   └── token-refresher.ts     # Fix: trigger notificationDispatcherTask on refresh failure
├── approval/workflow.ts       # Fix: callers trigger notificationDispatcherTask on submit/approve/reject
└── learning/locks.ts          # Already complete -- just needs to be imported in generate.ts
```

### Pattern 1: Trigger.dev Task Triggering
**What:** To call a Trigger.dev task from another module, import the task object and call `.trigger()` with a payload.
**When to use:** Whenever async notification dispatch is needed from a Trigger.dev task or CLI handler.
**Example:**
```typescript
// Source: existing pattern in src/cli/post.ts and src/trigger/watchdog.ts
import { notificationDispatcherTask } from "../trigger/notification-dispatcher.ts";

// Fire-and-forget dispatch -- returns a handle (not awaited for notification use case)
await notificationDispatcherTask.trigger({
  eventType: "post.failed",
  userId: post.userId,
  hubId: metadata.hubId,
  payload: { postId: post.id, error: errorMessage, platform: post.platform },
});
```

### Pattern 2: Passing DB Connection Through
**What:** Several functions accept optional `db` and `userId` parameters for progressive enhancement. When the caller has a DB connection, pass it through.
**When to use:** When wiring idea bank checks, calendar views, or preference model lookups.
**Example:**
```typescript
// Source: existing pattern in src/content/topic-suggest.ts
// BEFORE (broken -- always returns empty):
const ideaBankStatus = await checkIdeaBank();

// AFTER (passes DB connection through):
const db = options.databaseUrl ? createHubConnection(options.databaseUrl) : undefined;
const userId = options.userId;
const ideaBankStatus = await checkIdeaBank(db, userId);
```

### Pattern 3: Unified Calendar with Hub Discovery
**What:** `getUnifiedCalendar()` takes personal DB + array of company hub connections. Hub discovery via `discoverCompanyHubs()` returns connection objects that can be converted to DB connections via `getHubDb()`.
**When to use:** When `calendarCommand()` needs to show all hubs.
**Example:**
```typescript
// Source: existing functions in src/approval/calendar.ts + src/team/hub.ts
import { getUnifiedCalendar } from "../approval/calendar.ts";
import { discoverCompanyHubs, getHubDb } from "../team/hub.ts";

const personalDb = await getDb();
const companyHubs = await discoverCompanyHubs();
const companyHubDbs = companyHubs.map(conn => ({
  connection: conn,
  db: getHubDb(conn),
}));

const calendar = await getUnifiedCalendar({
  personalDb,
  companyHubs: companyHubDbs,
  userId: "default",
  startDate: weekStart,
  endDate: weekEnd,
});
```

### Pattern 4: Locked Settings Check in Generate Flow
**What:** Before applying preference model adjustments to content generation, check if the relevant settings are locked by the user.
**When to use:** In `generate.ts` before using preference learnings to modify content.
**Example:**
```typescript
// Source: existing functions in src/learning/locks.ts
import { getLockedSettings, isSettingLocked } from "../learning/locks.ts";

const lockedSettings = await getLockedSettings(db, userId);
const learnings = await getPreferenceModelLearnings(platform, { databaseUrl, userId });

// Only apply learnings for non-locked fields
if (learnings && !isSettingLocked(lockedSettings, "formats.preferences")) {
  // Apply format suggestions from preference model
}
if (learnings && !isSettingLocked(lockedSettings, "hooks")) {
  // Apply hook pattern suggestions
}
```

### Anti-Patterns to Avoid
- **Awaiting notification dispatch in hot paths:** Notification dispatch should be fire-and-forget (`.trigger()` returns quickly). Do NOT `await` the full task completion -- only await the trigger call itself.
- **Creating new DB connections when one exists:** If a `db` parameter is already available in scope, pass it through rather than creating a new connection from `DATABASE_URL`.
- **Swallowing trigger errors silently:** Wrap `.trigger()` calls in try/catch with logging. A failed trigger should not crash the caller, but it should be logged.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification dispatch | Custom HTTP calls to WhatsApp | `notificationDispatcherTask.trigger()` | Task handles provider selection, fatigue, quiet hours, session management |
| Calendar merging | Manual SQL across multiple DBs | `getUnifiedCalendar()` | Already handles per-hub failure isolation, stats computation |
| Fatigue prevention | Custom rate limiting | `checkFatigueLimits()` in dispatcher | Already implements daily caps, cooldowns, dedup |
| Setting locks check | Custom field comparison | `isSettingLocked()` from locks.ts | Pure function, already tested |

**Key insight:** Every piece of logic needed for Phase 9 already exists as a function. The work is purely calling existing functions with correct arguments.

## Common Pitfalls

### Pitfall 1: Circular Import Between Trigger Tasks
**What goes wrong:** Importing `notificationDispatcherTask` into `publish-post.ts` or `engagement-monitor.ts` could create circular dependency chains if they share common imports.
**Why it happens:** Trigger.dev tasks are defined in files that import other modules. If module A imports module B which imports module A's task, you get a cycle.
**How to avoid:** Check import chains before adding. In this codebase, `notification-dispatcher.ts` imports from `../notifications/dispatcher.ts` and `../notifications/provider.ts`. Neither `publish-post.ts` nor `engagement-monitor.ts` import from those modules, so no circular dependency risk.
**Warning signs:** Runtime errors like "Cannot access 'X' before initialization" or undefined imports.

### Pitfall 2: Notification Dispatcher Payload Type Mismatch
**What goes wrong:** Triggering `notificationDispatcherTask` with wrong `eventType` string (not matching `NotificationEventType` union).
**Why it happens:** Event type strings are defined in `src/notifications/types.ts` as a union type. Easy to mistype.
**How to avoid:** Use the `NotificationEventType` type from `src/notifications/types.ts` for compile-time checking. Valid values: `approval.requested`, `approval.result`, `post.failed`, `post.published`, `post.viral`, `token.expiring`, `digest.daily`, `digest.weekly`, `schedule.reminder`.
**Warning signs:** Notifications sent but not formatted correctly (falls through to default case in `formatNotificationMessage`).

### Pitfall 3: Missing userId in Trigger.dev Task Context
**What goes wrong:** In Trigger.dev tasks (`publish-post.ts`, `token-refresher.ts`), the `userId` must come from the post/token record, not from environment.
**Why it happens:** Trigger.dev tasks run in a cloud context without access to local user session. The userId must be passed in the payload or fetched from the DB record.
**How to avoid:** Always extract userId from the post/token row before triggering notifications. The dispatcher task's `DispatchPayload` requires `userId` explicitly.
**Warning signs:** Notifications sent to wrong user or "No active WhatsApp session" errors.

### Pitfall 4: Calendar Command Signature Change
**What goes wrong:** `calendarCommand()` currently takes no arguments and returns a simple calendar state. Switching to `getUnifiedCalendar()` requires different parameters and returns a different shape (`UnifiedCalendar` vs `CalendarState`).
**Why it happens:** The function signature needs to change to accept parameters for hub discovery.
**How to avoid:** Update the function to load hubs internally (keep the zero-argument CLI interface), and update any callers/command handlers that consume the return value to handle the `UnifiedCalendar` type.
**Warning signs:** TypeScript compile errors in plan.ts or slash command handlers that call `calendarCommand()`.

### Pitfall 5: Engagement Monitor Runs in Trigger.dev Cloud
**What goes wrong:** The engagement monitor is a `schedules.task()` which runs in Trigger.dev cloud. Importing `notificationDispatcherTask` and calling `.trigger()` from within another task works -- but only if both tasks are registered with the same Trigger.dev project.
**Why it happens:** Trigger.dev SDK's `.trigger()` makes an API call to the Trigger.dev platform, which then executes the task. This works from within other tasks.
**How to avoid:** Verify both tasks are in the same Trigger.dev project's task registry (both exported from the trigger directory). The existing pattern in `watchdog.ts` confirms this works.
**Warning signs:** "Task not found" errors in Trigger.dev dashboard.

## Code Examples

### Example 1: Wiring Notification Dispatcher into Publish-Post Failure Path
```typescript
// In src/trigger/publish-post.ts, after the "All platforms failed" block:
import { notificationDispatcherTask } from "./notification-dispatcher.ts";

// After: await markFailed(db, post.id, "all_platforms_failed", { platformStatus });
try {
  await notificationDispatcherTask.trigger({
    eventType: "post.failed",
    userId: post.userId as string,
    hubId: (postMetadata.hubId as string) ?? undefined,
    payload: {
      postId: post.id,
      platform: post.platform,
      error: "all_platforms_failed",
      title: (post.content as string).slice(0, 60),
    },
  });
} catch (err) {
  logger.warn("Failed to trigger notification for post failure", {
    postId: post.id,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

### Example 2: Wiring Engagement Monitor to Notification Dispatcher
```typescript
// In src/trigger/engagement-monitor.ts, replace notification_log INSERT for high-score:
import { notificationDispatcherTask } from "./notification-dispatcher.ts";

// Replace the raw SQL INSERT block for highScore with:
for (const opp of highScore) {
  try {
    await notificationDispatcherTask.trigger({
      eventType: "post.viral",
      userId,
      payload: {
        postId: opp.externalPostId,
        platform: opp.platform,
        score: opp.score.composite,
        authorHandle: opp.authorHandle,
        postSnippet: opp.postSnippet.slice(0, 100),
      },
    });
  } catch (err) {
    logger.warn("Failed to trigger engagement notification", {
      opportunityId: opp.id ?? opp.externalPostId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

### Example 3: Fixing checkIdeaBank Arguments in Generate
```typescript
// In src/content/generate.ts, line ~370:
// BEFORE:
const ideaBankStatus = await checkIdeaBank();

// AFTER:
const db = options.databaseUrl ? createHubConnection(options.databaseUrl) : undefined;
const ideaBankStatus = await checkIdeaBank(db, options.userId);
```

### Example 4: Fixing Calendar to Use Unified View
```typescript
// In src/cli/plan.ts, calendarCommand():
import { getUnifiedCalendar } from "../approval/calendar.ts";
import { discoverCompanyHubs, getHubDb } from "../team/hub.ts";

export async function calendarCommand() {
  const db = await getDb();
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const companyHubs = await discoverCompanyHubs();
  const companyHubDbs = companyHubs.map(conn => ({
    connection: conn,
    db: getHubDb(conn),
  }));

  return getUnifiedCalendar({
    personalDb: db,
    companyHubs: companyHubDbs,
    userId: "default",
    startDate: weekStart,
    endDate: weekEnd,
  });
}
```

### Example 5: Checking Locked Settings in Generate
```typescript
// In src/content/generate.ts, after fetching preference learnings:
import { getLockedSettings, isSettingLocked } from "../learning/locks.ts";

// After line ~372 (earlyLearnings fetch), add:
let lockedSettings: import("../learning/locks.ts").LockedSetting[] | null = null;
if (options.databaseUrl && options.userId) {
  try {
    const lockDb = createHubConnection(options.databaseUrl);
    lockedSettings = await getLockedSettings(lockDb, options.userId);
  } catch {
    // Graceful fallback -- no locks enforcement if DB unavailable
  }
}

// Then when using earlyLearnings, filter locked fields:
const effectiveLearnings = earlyLearnings ? {
  ...earlyLearnings,
  hooks: isSettingLocked(lockedSettings, "hooks") ? [] : earlyLearnings.hooks,
  formats: isSettingLocked(lockedSettings, "formats.preferences") ? [] : earlyLearnings.formats,
  fatiguedTopics: earlyLearnings.fatiguedTopics, // fatigue is never locked
} : null;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 7/8: Build modules in isolation | Phase 9: Wire modules together | Now | Integration gaps get explicit wiring phase |
| notification_log direct INSERT | notificationDispatcherTask.trigger() | Phase 9 | Full fatigue, quiet hours, provider abstraction |
| Personal-only calendar | Unified multi-hub calendar | Phase 7 (built), Phase 9 (wired) | Company posts visible during planning |

**Deprecated/outdated:**
- Direct `notification_log` INSERT for high-score engagement: Replace with `notificationDispatcherTask.trigger()` to get full dispatch pipeline (fatigue, formatting, delivery).

## Open Questions

1. **Should the engagement monitor keep the notification_log INSERT as a fallback?**
   - What we know: Currently writes to notification_log directly. Phase 9 should trigger the dispatcher instead.
   - What's unclear: Should we remove the raw INSERT entirely, or keep it as a belt-and-suspenders fallback?
   - Recommendation: Replace the raw INSERT with the dispatcher trigger. The dispatcher itself writes to notification_log, so keeping both would create duplicate entries. Remove the raw INSERT for high-score (keep digest INSERT for medium-score since digest compilation reads from notification_log).

2. **calendarCommand return type change**
   - What we know: Current return type is `CalendarState` from `getCalendarState()`. New return type is `UnifiedCalendar` from `getUnifiedCalendar()`.
   - What's unclear: Do any other functions or slash commands depend on the `CalendarState` shape from `calendarCommand()`?
   - Recommendation: Check all callers of `calendarCommand()` and update them. The `slotCommand()` and `languagesCommand()` in plan.ts also call `getCalendarState()` directly (not via `calendarCommand()`), so they are unaffected.

3. **Token refresher notification: which event type?**
   - What we know: `token.expiring` exists as an event type. Token refresher currently logs errors and sets `requiresReauth` metadata.
   - What's unclear: Should we use `token.expiring` for refresh failures specifically, or is there a need for a `token.failed` event type?
   - Recommendation: Use `token.expiring` -- the message formatting already says "Re-authenticate to keep posting" which is the correct user action regardless of whether the token is expiring vs failed to refresh.

## Sources

### Primary (HIGH confidence)
- `src/trigger/notification-dispatcher.ts` -- Full task implementation reviewed, DispatchPayload interface confirmed
- `src/content/generate.ts` -- checkIdeaBank() call at line 370 confirmed missing arguments
- `src/content/topic-suggest.ts` -- checkIdeaBank() signature confirmed: `(db?: HubDb, userId?: string)`
- `src/cli/plan.ts` -- calendarCommand() at line 41 confirmed calling getCalendarState, not getUnifiedCalendar
- `src/approval/calendar.ts` -- getUnifiedCalendar() signature and UnifiedCalendar type confirmed
- `src/trigger/engagement-monitor.ts` -- Raw SQL INSERT to notification_log at lines 131-152 confirmed, no dispatcher trigger
- `src/trigger/publish-post.ts` -- No notification dispatch on failure confirmed
- `src/trigger/token-refresher.ts` -- Error metadata recording at lines 239-262 confirmed, no notification dispatch
- `src/learning/locks.ts` -- isSettingLocked() pure function confirmed
- `src/learning/adjustments.ts` -- Already imports and uses isSettingLocked (line 7, line 100)
- `src/notifications/types.ts` -- All event types and tier routing confirmed
- `src/notifications/dispatcher.ts` -- Full dispatch engine with fatigue checks confirmed
- `src/team/hub.ts` -- discoverCompanyHubs() and getHubDb() confirmed
- `src/cli/post.ts` + `src/trigger/watchdog.ts` -- Existing pattern for `.trigger()` usage confirmed

### Secondary (MEDIUM confidence)
- Trigger.dev SDK `.trigger()` call from within another task -- confirmed by `watchdog.ts` pattern (line 102)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All modules already exist and were verified by direct file reading
- Architecture: HIGH -- All integration patterns are copies of existing patterns in the codebase
- Pitfalls: HIGH -- Each pitfall was verified against actual import chains and type definitions

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable -- no external dependency changes)
