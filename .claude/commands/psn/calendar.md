---
description: Unified multi-hub content calendar with approval status
---

# /psn:calendar -- Unified multi-hub content calendar

## What this does
Shows a unified calendar view across your Personal Hub and all connected Company Hubs. Displays posts grouped by hub with approval status badges. Supports slot claiming for Company Hub time slots with concurrency protection.

## Arguments
$ARGUMENTS

## Usage
- `/psn:calendar` -- show this week's unified calendar
- `/psn:calendar week [date]` -- show a specific week (e.g., "2026-02-24" or "next week")
- `/psn:calendar claim <hubSlug> <datetime> <platform>` -- claim a time slot in a Company Hub
- `/psn:calendar release <postId>` -- release a claimed slot
- `/psn:calendar available <hubSlug>` -- show available slots for a Company Hub

## Flow

### 1. Load environment
Load env vars from `config/hub.env` and `config/keys.env`:
```
set -a && source config/hub.env && source config/keys.env && set +a
```

### 2. Handle actions

#### Default / Week (unified calendar view)
1. Discover Personal Hub and all Company Hub connections:
   ```typescript
   import { createHubConnection } from "src/core/db/connection.ts";
   import { loadHubEnv } from "src/core/utils/env.ts";
   import { discoverCompanyHubs, getHubDb } from "src/team/hub.ts";
   import { getUnifiedCalendar, formatCalendarForCli } from "src/approval/calendar.ts";

   const hubEnv = await loadHubEnv("config");
   const personalDb = createHubConnection(hubEnv.data.databaseUrl);
   const companyHubs = await discoverCompanyHubs(".");
   ```

2. Calculate date range for the target week:
   - Default: current week (Monday to Sunday)
   - With date argument: the week containing that date

3. Fetch the unified calendar:
   ```typescript
   const calendar = await getUnifiedCalendar({
     personalDb,
     companyHubs: companyHubs.map(c => ({ connection: c, db: getHubDb(c) })),
     userId: currentUserId,
     startDate,
     endDate,
   });
   ```

4. Display hub-grouped calendar:
   ```
   Personal Hub
   ======================================
   Mon 2/17  10:00 AM  [X]      "Thread about AI testing"     Published
   Tue 2/18   2:00 PM  [X, LI]  "React patterns carousel"    Scheduled
   Thu 2/20   9:00 AM  [X]      "Quick tip: TypeScript 5.8"  Draft

   Acme Corp
   ======================================
   Mon 2/17  11:00 AM  [LI]     "Company Q1 update"          Published
   Wed 2/19   3:00 PM  [X, LI]  "Product launch teaser"      [Pending]
   Fri 2/21   9:00 AM  [X]      -- Available slot --

   StartupCo
   ======================================
   Tue 2/18   1:00 PM  [X]      "Feature spotlight"          [Approved]
   ```

5. Show summary:
   > "12 posts this week: 5 published, 4 scheduled, 2 pending approval, 1 available slot"

6. Visual status indicators:
   - Published: "Published" (with checkmark when displaying)
   - Scheduled: "Scheduled" (time set, no badge needed)
   - Draft: "Draft"
   - Pending Approval: "[Pending]"
   - Approved: "[Approved]"
   - Rejected: "[Rejected]"
   - Available slot: "-- Available slot --"

7. Cross-hub overlap handling:
   - Overlap between hubs is allowed (different audiences per CONTEXT.md)
   - Within the same hub: show a warning if two posts target the same time and platform
     > "Warning: Two posts scheduled at 2:00 PM on X in Acme Corp. Consider moving one."

#### Claim
Claim a time slot in a Company Hub:
1. Validate inputs:
   - Hub slug must match a connected Company Hub
   - Datetime must be in the future
   - Platform must be valid (x, linkedin, instagram, tiktok)

2. Claim the slot with concurrency protection:
   ```typescript
   import { claimSlot } from "src/approval/calendar.ts";

   const hub = companyHubs.find(h => h.slug === hubSlug);
   const db = getHubDb(hub);

   const result = await claimSlot(db, {
     userId: currentUserId,
     hubId: hub.hubId,
     dateTime: new Date(datetime),
     platform,
   });
   ```

3. If successful:
   > "Slot claimed: {hubName} - {datetime} - {platform}. Start drafting with `/psn:post`"

4. If slot already taken:
   > "This slot is already claimed. Run `/psn:calendar available {hubSlug}` to see open slots."

#### Release
Release a previously claimed slot:
```typescript
import { releaseSlot } from "src/approval/calendar.ts";

const db = getHubDb(targetHub);
await releaseSlot(db, { postId, userId: currentUserId });
```

Confirm: "Slot released. It's now available for other team members."

Only works on placeholder drafts (slotClaimed posts). Regular posts cannot be released this way -- use `/psn:post cancel` instead.

#### Available
Show available posting slots for a specific Company Hub:
```typescript
import { getAvailableSlots } from "src/approval/calendar.ts";

const hub = companyHubs.find(h => h.slug === hubSlug);
const db = getHubDb(hub);
const slots = await getAvailableSlots(db, {
  hubId: hub.hubId,
  startDate,
  endDate,
  platform, // optional filter
});
```

Display grouped by day:
```
Available slots for Acme Corp (this week):

Monday 2/17
  9:00 AM  [X]
  12:00 PM [X]
  8:00 AM  [LinkedIn]

Tuesday 2/18
  9:00 AM  [X]
  10:00 AM [LinkedIn]

...
```

Default optimal times per platform (when strategy.yaml not available):
- X: 9am, 12pm, 5pm
- LinkedIn: 8am, 10am, 12pm
- Instagram: 11am, 2pm, 7pm
- TikTok: 10am, 3pm, 8pm

Suggest: "Claim a slot with `/psn:calendar claim {hubSlug} {datetime} {platform}`"

### 3. Error handling

- **No hubs found:** "No hubs configured. Run `/psn:setup` first."
- **Hub not found:** "No Company Hub with slug '{slug}'. Connected hubs: {list of slugs}"
- **Invalid date:** "Could not parse date '{input}'. Try formats like '2026-02-24' or 'next monday'."
- **Past datetime:** "Cannot claim a slot in the past. Choose a future time."
- **Hub connection failed:** Show partial calendar (skip failed hub with note: "Could not load {hubName}")

## Important notes
- Personal Hub always shows first, then Company Hubs alphabetically
- All times shown in the user's configured timezone
- Cross-hub overlap is intentional and allowed (different audiences)
- Within-hub overlap triggers a warning but does not block
- Slot claiming uses SELECT FOR UPDATE for concurrency safety
- Available slots use default optimal hours per platform unless strategy.yaml provides custom times
- The CLI outputs JSON -- parse it and present the calendar visually
- Claimed slots appear as empty drafts -- fill them with `/psn:post`
