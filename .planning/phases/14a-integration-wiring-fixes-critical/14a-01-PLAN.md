---
phase: 14a-integration-wiring-fixes-critical
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/approval/approval.ts
  - src/trigger/publish-post.ts
  - src/trigger/token-refresher.ts
  - src/trigger/engagement-monitor.ts
autonomous: true
gap_closure: true
requirements:
  - NOTIF-01
  - NOTIF-02
  - NOTIF-03
  - NOTIF-04
  - NOTIF-05
  - NOTIF-06
  - NOTIF-07
  - NOTIF-08
  - TEAM-05
  - AUTH-07

must_haves:
  truths:
    - "notificationDispatcherTask is triggered by approval workflow events (submit, approve, reject)"
    - "notificationDispatcherTask is triggered by publish-post failure events"
    - "notificationDispatcherTask is triggered by token refresher failure events"
    - "WhatsApp notifications arrive for push-tier opportunities (score 70+) from engagement monitor"
  artifacts:
    - path: "src/approval/approval.ts"
      provides: "Approval workflow state machine with notification triggers"
      contains: "notificationDispatcherTask.trigger"
    - path: "src/trigger/publish-post.ts"
      provides: "Publish task with failure notification"
      contains: "notificationDispatcherTask.trigger"
    - path: "src/trigger/token-refresher.ts"
      provides: "Token refresher with failure notification"
      contains: "notificationDispatcherTask.trigger"
    - path: "src/trigger/engagement-monitor.ts"
      provides: "Engagement monitor with high-score notifications"
      contains: "notificationDispatcherTask.trigger"
  key_links:
    - from: "src/approval/approval.ts"
      to: "src/trigger/notification-dispatcher.ts"
      via: "notificationDispatcherTask import"
      pattern: "import.*notificationDispatcherTask"
    - from: "src/trigger/publish-post.ts"
      to: "src/trigger/notification-dispatcher.ts"
      via: "notificationDispatcherTask import"
      pattern: "import.*notificationDispatcherTask"
    - from: "src/trigger/token-refresher.ts"
      to: "src/trigger/notification-dispatcher.ts"
      via: "notificationDispatcherTask import"
      pattern: "import.*notificationDispatcherTask"
    - from: "src/trigger/engagement-monitor.ts"
      to: "src/trigger/notification-dispatcher.ts"
      via: "notificationDispatcherTask import"
      pattern: "import.*notificationDispatcherTask"
---

<objective>
Wire notification dispatcher into approval workflow, publish-post failures, token refresher failures, and engagement monitor high-score opportunities.

Purpose: Close CRITICAL integration gap from v1.0 audit where notificationDispatcherTask exists but is never triggered by events. Users should receive push notifications for approvals, failures, and high-engagement opportunities.

Output: notificationDispatcherTask is triggered by all four event sources, enabling the notification system to function as designed.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@src/trigger/notification-dispatcher.ts
@src/notifications/dispatcher.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire notification dispatcher into approval workflow (approval.requested, approval.result events)</name>
  <files>
    src/approval/approval.ts
  </files>
  <action>
    Find or create the approval workflow file (likely in src/approval/ directory).

    Import notificationDispatcherTask from "../trigger/notification-dispatcher.ts".

    For "approval.requested" event (when post is submitted for approval):
    - After post status is updated to "submitted" and approvalStatus is set
    - Trigger notificationDispatcherTask with eventType: "approval.requested"
    - Include: userId (author), hubId (from post metadata), payload with postId, title, author, scheduled time
    - Use fire-and-forget pattern (await is optional, log errors with try/catch)

    For "approval.result" event (when approved/rejected):
    - After post approvalStatus is updated to "approved" or "rejected"
    - Trigger notificationDispatcherTask with eventType: "approval.result"
    - Include: userId (author), hubId if company post, payload with postId, title, approved boolean, optional comment
    - Use fire-and-forget pattern

    Example trigger call:
    ```typescript
    try {
      await notificationDispatcherTask.trigger({
        eventType: "approval.requested",
        userId: post.userId,
        hubId: hubId,
        payload: {
          postId: post.id,
          title: post.content.slice(0, 60),
          author: authorName,
          time: post.scheduledAt?.toISOString(),
        },
      });
    } catch (notifError) {
      logger.warn("Failed to trigger approval notification", { error: notifError });
    }
    ```

    Verify the approval workflow state machine exists (likely has submit, approve, reject transitions).
  </action>
  <verify>
    Search src/approval/approval.ts for "notificationDispatcherTask.trigger" calls.
    Verify at least two trigger calls exist (approval.requested, approval.result).
    Verify payload structure matches dispatcher expectations (userId, optional hubId, payload object).
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    Approval workflow triggers notificationDispatcherTask on submit, approve, and reject events. Admins receive push notifications for pending approvals; authors receive notifications for approval results.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify publish-post failure notification (already implemented, document test)</name>
  <files>
    src/trigger/publish-post.ts
  </files>
  <action>
    Review src/trigger/publish-post.ts to verify failure notification is already wired.

    The code at line 238-256 already implements failure notification:
    - After all platforms fail (line 236: markFailed)
    - Triggers notificationDispatcherTask with eventType: "post.failed"
    - Includes userId, hubId, payload with postId, platform, error, title

    Document this implementation in a test or verification note:
    - Create or update a comment in publish-post.ts noting the failure notification wiring
    - Verify the payload structure matches dispatcher's "post.failed" event type (see src/notifications/dispatcher.ts formatNotificationMessage)
    - Confirm the notification is fire-and-forget (wrapped in try/catch, never crashes publish task)

    If the implementation is complete and correct, add a comment:
    ```typescript
    // NOTIF-01: Notify user on post failure via notification dispatcher
    // Already wired: see lines 238-256
    ```
  </action>
  <verify>
    Confirm notificationDispatcherTask.trigger exists for "post.failed" event (line 240).
    Verify try/catch wrapper prevents notification failures from crashing publish (line 239-256).
    Verify payload includes required fields: postId, platform, error, title.
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    publish-post failure notification is verified as correctly implemented. Documentation comment added to codebase.
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify token refresher failure notification (already implemented, document test)</name>
  <files>
    src/trigger/token-refresher.ts
  </files>
  <action>
    Review src/trigger/token-refresher.ts to verify failure notification is already wired.

    The code at line 266-282 already implements token expiry notification:
    - In the catch block for token refresh failures (line 228-286)
    - After recording failure in metadata (lines 240-264)
    - Triggers notificationDispatcherTask with eventType: "token.expiring"
    - Includes userId, payload with platform, tokenId, error

    Document this implementation in a test or verification note:
    - Create or update a comment in token-refresher.ts noting the failure notification wiring
    - Verify the payload structure matches dispatcher's "token.expiring" event type
    - Confirm the notification is fire-and-forget (wrapped in try/catch at line 267-282)

    If the implementation is complete and correct, add a comment:
    ```typescript
    // AUTH-07: Notify user on token refresh failure requiring re-auth
    // Already wired: see lines 267-282
    ```
  </action>
  <verify>
    Confirm notificationDispatcherTask.trigger exists for "token.expiring" event (line 268).
    Verify try/catch wrapper prevents notification failures from crashing refresher (line 267-282).
    Verify payload includes required fields: platform, tokenId, error.
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    Token refresher failure notification is verified as correctly implemented. Documentation comment added to codebase.
  </done>
</task>

<task type="auto">
  <name>Task 4: Verify engagement monitor high-score notification (already implemented, document test)</name>
  <files>
    src/trigger/engagement-monitor.ts
  </files>
  <action>
    Review src/trigger/engagement-monitor.ts to verify high-score notification is already wired.

    The code at line 128-155 already implements high-score notification:
    - Filters opportunities with score >= 70 (line 123: highScore array)
    - For each high-score opportunity, triggers notificationDispatcherTask (line 134-144)
    - Uses eventType: "post.viral" (not ideal naming but functional)
    - Includes userId, payload with postId, platform, score, authorHandle, postSnippet

    Document this implementation in a test or verification note:
    - Create or update a comment in engagement-monitor.ts noting the high-score notification wiring
    - Verify the payload structure matches dispatcher's event expectations
    - Confirm the notification is fire-and-forget (wrapped in try/catch at line 133-150)

    If the implementation is complete and correct, add a comment:
    ```typescript
    // NOTIF-04: Push notifications for high-score engagement opportunities (score 70+)
    // Already wired: see lines 128-155
    ```

    Note: The event type "post.viral" is reused for engagement opportunities. Consider this acceptable for Phase 14a since it works, but note as a potential improvement for future.
  </action>
  <verify>
    Confirm notificationDispatcherTask.trigger exists in high-score loop (line 134).
    Verify try/catch wrapper prevents notification failures from crashing monitor (line 133-150).
    Verify payload includes required fields: postId, platform, score, authorHandle, postSnippet.
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    Engagement monitor high-score notification is verified as correctly implemented. Documentation comment added to codebase.
  </done>
</task>

</tasks>

<verification>
- src/approval/approval.ts contains notificationDispatcherTask.trigger calls for approval.requested and approval.result
- src/trigger/publish-post.ts failure notification is verified and documented
- src/trigger/token-refresher.ts failure notification is verified and documented
- src/trigger/engagement-monitor.ts high-score notification is verified and documented
- All notification triggers use fire-and-forget pattern (try/catch, never await)
- All payloads match dispatcher event type expectations
- `bun run lint` passes on all modified files
</verification>

<success_criteria>
- notificationDispatcherTask is triggered by approval workflow (submit, approve, reject)
- notificationDispatcherTask is triggered by publish-post failures (verified existing)
- notificationDispatcherTask is triggered by token refresher failures (verified existing)
- notificationDispatcherTask is triggered by engagement monitor high-score opportunities (verified existing)
- All triggers are fire-and-forget (never crash calling tasks)
- Documentation comments added to existing implementations
</success_criteria>

<output>
After completion, create `.planning/phases/14a-integration-wiring-fixes-critical/14a-01-SUMMARY.md`
</output>
