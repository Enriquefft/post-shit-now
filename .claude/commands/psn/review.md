# /psn:review -- Review content performance and update learning loop

## What this does
Generates a weekly performance briefing, triggers the learning loop, and surfaces actionable insights. Feels like a social media manager's weekly debrief.

## Arguments
$ARGUMENTS

## Usage
- `/psn:review` -- default last 7 days
- `/psn:review --days 14` -- custom time range
- `/psn:review --approve <id>` -- approve a queued adjustment
- `/psn:review --reject <id>` -- reject a queued adjustment
- `/psn:review --lock <field>` -- permanently lock a setting
- `/psn:review --unlock <field>` -- unlock a setting

## Flow

### 1. Load environment
Load env vars from `config/hub.env` and `config/keys.env`:
```
set -a && source config/hub.env && source config/keys.env && set +a
```

### 2. Handle management commands
If `$ARGUMENTS` contains `--approve`, `--reject`, `--lock`, or `--unlock`, handle those first:

**Approve an adjustment:**
```typescript
import { approveAdjustment } from "src/learning/adjustments.ts";
await approveAdjustment(db, "<id>");
```

**Reject an adjustment:**
```typescript
import { rejectAdjustment } from "src/learning/adjustments.ts";
await rejectAdjustment(db, "<id>");
```

**Lock a setting:**
```typescript
import { lockSetting } from "src/learning/locks.ts";
await lockSetting(db, userId, "<field>", currentValue);
```

**Unlock a setting:**
```typescript
import { unlockSetting } from "src/learning/locks.ts";
await unlockSetting(db, userId, "<field>");
```

After handling, confirm the action and continue to the review.

### 3. Generate the weekly review
Parse the `--days` flag from `$ARGUMENTS` (default: 7).

```typescript
import { generateWeeklyReview } from "src/analytics/review.ts";
const review = await generateWeeklyReview(db, userId, { days });
```

### 4. Present the review
Present the review in a clear, structured format:

**Performance summary (this week vs last):**
Show the comparison table with deltas. Highlight biggest improvements and declines.

**Top performers (full breakdown):**
For each of the top 3 posts, show:
- Content snippet
- Format, pillar, topic
- All engagement metrics (impressions, likes, retweets, bookmarks, replies, quotes)
- Engagement score and rate
- What made it work

**Underperformers (full breakdown):**
For each bottom post, show:
- Content snippet
- What went wrong (low impressions? low engagement rate? no saves?)
- Suggestions for improvement

**Remaining posts (compact):**
Show a table with score, rate, and one-line verdict for each.

**Cross-pillar analysis:**
Show pillar performance table. Call out which pillars are above/below average.

**Follower trend:**
Show current count, previous count, delta, and direction. Do NOT correlate with specific posts (per user decision -- too noisy for reliable attribution).

**Recommendations (with evidence):**
For each recommendation, show the text and cite the specific posts that support it. Group by priority (high/medium/low).

**Content fatigue warnings:**
If any topics are fatigued, show warnings with suggestions for alternatives.

**"What the brain changed this week" (changelog):**
Show all auto-applied adjustments from the period. Be transparent -- no hidden changes.

**Pending approvals:**
If any adjustments need user approval, present each with:
- What the adjustment is
- Why it's recommended
- Options: approve or reject (with the adjustment ID)

**Feedback moments:**
If there are exceptional posts (3x above average) or streaks, ask the user about them. These questions help the system learn.

### 5. Wrap up
- Confirm the report was saved to the path shown in `review.reportPath`
- If there are pending approvals, remind the user they can approve/reject with `/psn:review --approve <id>` or `/psn:review --reject <id>`
- If there are feedback moments, engage with the user about each one

## Important notes
- The review feels like a social media manager's weekly briefing -- conversational, not robotic
- Recommendations ALWAYS cite specific posts as evidence
- Fatigue warnings suggest alternatives, not just warn
- The changelog is transparent -- no hidden changes
- Follower trends are context only -- never correlate with specific posts
- Reports are automatically saved to `analytics/reports/weekly-YYYY-MM-DD.md`
- The learning loop runs during every review (preference model update, adjustments, changelog)
