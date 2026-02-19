# /psn:approve -- Content approval workflow for Company Hubs

## What this does
Reviews, approves, rejects, or edits pending company posts across all connected Company Hubs. Only hub admins can approve or reject posts. Authors are notified of approval decisions via WhatsApp.

## Arguments
$ARGUMENTS

## Usage
- `/psn:approve` -- list all pending approvals across Company Hubs
- `/psn:approve list` -- same as above
- `/psn:approve view <postId>` -- show full post details
- `/psn:approve approve <postId> [comment]` -- approve a pending post
- `/psn:approve reject <postId> [reason]` -- reject a pending post with reason
- `/psn:approve edit <postId>` -- edit content then approve
- `/psn:approve stats` -- show approval statistics

## Flow

### 1. Load environment
Load env vars from `config/hub.env` and `config/keys.env`:
```
set -a && source config/hub.env && source config/keys.env && set +a
```

### 2. Discover Company Hubs
Scan for connected Company Hubs:
```typescript
import { discoverCompanyHubs, getHubDb } from "src/team/hub.ts";
const hubs = await discoverCompanyHubs(".");
```

If no Company Hubs found:
> "No Company Hubs connected. Create one with `/psn:setup hub` or join one with `/psn:setup join`."

### 3. Handle actions

#### List (default)
For each connected Company Hub, fetch pending approvals:
```typescript
import { listPendingApprovals } from "src/approval/workflow.ts";

for (const hub of hubs) {
  const db = getHubDb(hub);
  const pending = await listPendingApprovals(db, hub.hubId);
  // Collect results grouped by hub
}
```

Display grouped by hub:
```
Company: Acme Corp (3 pending)
------------------------------------
1. [X] "5 AI tools every dev needs" by @john - scheduled 2:00 PM today
2. [LinkedIn] "Q1 Retrospective" by @sarah - scheduled tomorrow 9:00 AM
3. [X, LinkedIn] "New feature launch" by @mike - no schedule yet

Company: StartupCo (1 pending)
------------------------------------
4. [X] "Hiring announcement" by @alex - scheduled Friday 10:00 AM
```

If no pending approvals across any hub:
> "No posts pending approval across your Company Hubs."

After listing, ask: "Enter a number to review, or an action (approve/reject #)"

#### View
Load full post details from the Company Hub DB:
```typescript
import { getApprovalStatus } from "src/approval/workflow.ts";

const db = getHubDb(targetHub);
const status = await getApprovalStatus(db, postId);
```

Show:
- Full content (threads displayed as numbered tweets)
- Author
- Platform(s)
- Format
- Scheduled time (in user's timezone)
- Current approval status
- Submission time
- Any previous review comments

#### Approve
1. Load post from the Company Hub DB
2. Show a brief content preview and ask for confirmation
3. Call the approval function:
   ```typescript
   import { approvePost } from "src/approval/workflow.ts";

   const result = await approvePost(db, {
     postId,
     reviewerId: currentUserId,
     hubId: hub.hubId,
     comment: optionalComment,
   });
   ```
4. Dispatch notification to the post author:
   ```typescript
   import { dispatchNotification } from "src/notifications/dispatcher.ts";

   await dispatchNotification(db, {
     eventType: "approval.result",
     hubId: hub.hubId,
     userId: post.userId,
     payload: {
       postId,
       status: "approved",
       reviewerComment: optionalComment,
       scheduledAt: post.scheduledAt,
     },
   });
   ```
5. Confirm: "Post approved. It will publish at {scheduledAt}."

If the post has no scheduled time: "Post approved. The author can now schedule it for publishing."

#### Reject
1. Load post from the Company Hub DB
2. Show a brief content preview
3. Ask for a rejection reason (required -- good communication practice):
   > "Please provide a reason for rejection so the author can improve:"
4. Call the rejection function:
   ```typescript
   import { rejectPost } from "src/approval/workflow.ts";

   const result = await rejectPost(db, {
     postId,
     reviewerId: currentUserId,
     hubId: hub.hubId,
     comment: rejectionReason,
   });
   ```
5. Dispatch notification to the post author:
   ```typescript
   await dispatchNotification(db, {
     eventType: "approval.result",
     hubId: hub.hubId,
     userId: post.userId,
     payload: {
       postId,
       status: "rejected",
       reviewerComment: rejectionReason,
     },
   });
   ```
6. Confirm: "Post rejected. Author will be notified with your feedback."

#### Edit
1. Load full post content from the Company Hub DB
2. Present the content for review -- let Claude assist with edits:
   > "Here's the current content. What changes would you like to make?"
3. After the user finalizes edits, show a diff between original and edited content
4. Call approve with edited content:
   ```typescript
   import { approvePost } from "src/approval/workflow.ts";

   const result = await approvePost(db, {
     postId,
     reviewerId: currentUserId,
     hubId: hub.hubId,
     editedContent: newContent,
   });
   ```
   This automatically tracks the edit in `edit_history` (admin edit during approval).
5. Dispatch notification to the author showing what was changed:
   ```typescript
   await dispatchNotification(db, {
     eventType: "approval.result",
     hubId: hub.hubId,
     userId: post.userId,
     payload: {
       postId,
       status: "approved_with_edits",
       editSummary: "Admin made edits before approving",
       scheduledAt: post.scheduledAt,
     },
   });
   ```
6. Confirm: "Post edited and approved. Author will be notified of the changes."

#### Stats
Fetch approval statistics for each connected hub:
```typescript
import { getApprovalStats } from "src/approval/workflow.ts";

for (const hub of hubs) {
  const db = getHubDb(hub);
  const stats = await getApprovalStats(db, hub.hubId);
  // Display per hub
}
```

Display:
```
Acme Corp:
  Pending: 3 | Approved today: 5 | Rejected today: 1

StartupCo:
  Pending: 1 | Approved today: 2 | Rejected today: 0
```

### 4. Error handling

- **Not an admin:** "You don't have admin permissions for this hub. Contact a hub admin."
- **Post not found:** "Post {postId} not found. Run `/psn:approve list` to see pending posts."
- **Already reviewed:** "This post has already been {approved/rejected}."
- **Hub connection failed:** "Could not connect to {hubName}. Check your connection in `.hubs/`."
- **Invalid transition:** "This post cannot be {action} in its current state ({currentStatus})."

## Important notes
- All approval actions require admin role in the target Company Hub
- Rejection reasons are required -- they help authors improve
- Edit-then-approve tracks the edit in edit_history for calibration
- Notifications are dispatched automatically on approve/reject/edit
- The CLI outputs JSON -- parse it and present results conversationally
- Post IDs are UUIDs -- the numbered list is for convenience only
- Cross-hub: a single `/psn:approve` scans all connected hubs
- Personal Hub posts do not go through approval (approvalStatus is null)
