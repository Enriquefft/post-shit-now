---
description: Weekly content planning engine with trend-informed ideation
---

# /psn:plan -- Weekly content planning engine

## What this does
Guides you through a complete weekly content planning session: calendar review, trend-informed ideation, slot allocation with series-first priority, language suggestions, and optionally drafting and scheduling key posts.

You can bail at any phase -- just ideate, just plan, or go all the way to a scheduled week.

## Arguments
$ARGUMENTS

## Flow

### Phase 1: Calendar Review

Run the calendar command to see the current week's state:
```
bun run src/cli/plan.ts calendar
```

Present the results conversationally:
- **Scheduled posts:** Show what's already on the calendar (platform, topic, day, status)
- **Series due:** Highlight any series episodes that need to be created this week
- **Gaps:** Show which days have no content scheduled
- **Total capacity:** Show the weekly target from strategy.yaml

Ask: "Want to continue to ideation, or is this overview enough for now?"
- If the user says stop -> save nothing, confirm calendar state was shown
- If the user says continue -> proceed to Phase 2

### Phase 2: Ideation

**First, detect the user's maturity level:**
```typescript
const profile = await loadProfile();
const maturity = profile.maturityLevel;
const adaptation = getMaturityAdaptation(maturity);
```

The maturity level determines how many ideas to generate and how much hand-holding to provide.

Generate ideas from multiple sources:
```
bun run src/cli/plan.ts ideate --count 12
```

Present ideas grouped by source (count adapts to maturity level):
- **Trending** (from stored trend data): topic, pillar, angle
- **From idea bank** (ready ideas): title, pillar
- **Generated** (AI-suggested): topic, pillar, angle, format
- **Remix suggestions** (top performers for other platforms):
  ```
  bun run src/cli/plan.ts remix
  ```
- **Recycle suggestions** (old top performers with fresh angles):
  ```
  bun run src/cli/plan.ts recycle
  ```

For each idea, show: topic, pillar, angle, source tag.

Ask the user to rate each idea:
- **Love it** -> mark as ready: `bun run src/cli/plan.ts rate <ideaId> love`
- **Maybe later** -> keep as seed: `bun run src/cli/plan.ts rate <ideaId> maybe`
- **Kill it** -> remove with reason: `bun run src/cli/plan.ts rate <ideaId> kill --reason "reason"`

The user can rate individually or batch ("love 1, 3, 5; kill 2; maybe the rest").

Ask: "Want to continue to slot allocation, or stop here with your rated ideas?"
- If stop -> confirm rated ideas summary
- If continue -> Phase 3

### Maturity-Specific Behaviors (handHoldingLevel)

The `/psn:plan` command adapts its guidance based on the user's social media experience level:

#### For "Never Posted" Users (handHoldingLevel: "full")

Before generating ideas, explain the options:
> "I'll suggest a few post ideas based on your interests. For each one, I'll show you what a draft might look like so you can see how it works."

Generate only 1-2 specific ideas:
> "Based on your interest in [pillars], here are two post ideas to start with:"
> 1. **[Specific topic]** - [Why this angle works]
> 2. **[Specific topic]** - [Why this angle works]

Show sample posts:
> "Here's what the first idea might look like as a draft:"
> [Show generated sample]

Ask for preference before proceeding:
> "Which of these resonates with you? Or would you like different topics?"

#### For "Sporadic" Users (handHoldingLevel: "moderate")

- Generate 3 ideas with brief explanations
- Skip sample post generation unless requested
- Proceed through rating at user's pace

#### For "Consistent" Users (handHoldingLevel: "minimal")

- Generate 5 ideas, let user filter
- Minimal explanation, focus on efficiency
- Trust user's judgment on quality

#### For "Very Active" Users (handHoldingLevel: "none")

- Generate 8+ ideas, maximum options
- No explanations unless asked
- Fast-path through ideation, trust user completely

### Phase 3: Slot Allocation

Build the proposed week calendar:
```
bun run src/cli/plan.ts slot
```

Then apply language suggestions:
```
bun run src/cli/plan.ts languages
```

Present the proposed week as a table:

| Day | Platform | Topic | Format | Pillar | Language | Source |
|-----|----------|-------|--------|--------|----------|--------|

Highlight:
- Series episodes are locked in first (marked with series name)
- Pillar distribution (e.g., "3 AI, 2 startup, 2 leadership -- weighted per strategy")
- Language mix (e.g., "5 English, 2 Spanish")
- Format variety (e.g., "3 threads, 2 short posts, 1 carousel, 1 reel")
- No more than 2 of the same angle per week

Let the user adjust:
- Swap topics between slots
- Change language for specific slots
- Remove slots they don't want
- Add specific topics to empty slots

**For never_posted users:**
> "If this is your first time planning content, don't worry about filling every slot. Start with 1-2 posts this week."

Ask: "Want to continue to drafting, or save this plan as-is?"
- If stop -> save plan: `bun run src/cli/plan.ts save '<json>'`
- If continue -> Phase 4

### Phase 4: Drafting

For each slot the user wants to draft (recommend 2-3 key posts per CONTEXT.md):

1. Use the existing /psn:post workflow to generate content
2. For each slot:
   - Set platform, topic, format, and language from the slot
   - Generate voice-matched content using the slot's parameters
   - Present for review (same flow as /psn:post step 7)

**Bilingual "both" slots (POST-08):**
When a slot's language is "both":
- Explain: "This slot is marked for bilingual content. I'll create two independent versions -- not translations."
- For X and TikTok: "I'll create two separate posts, one in English and one in Spanish."
- For LinkedIn: Ask "Want two separate posts or one combined post with both languages?"
- Generate each version using language-specific voice context from the voice profile
- Present both versions for review

Remaining slots stay as outlines for later `/psn:post` calls.

Ask: "Want to schedule the approved drafts, or save everything as outlines?"
- If stop -> save plan with drafted slots marked as "drafted"
- If continue -> Phase 5

### Phase 5: Scheduling

For each approved/drafted post:

1. Ask for scheduling time (or suggest optimal times from preference model)
2. Schedule via the existing post scheduling flow:
   ```
   bun run src/cli/post.ts schedule --post-id {UUID} --date {date} --time {time} --timezone {timezone}
   ```

3. Update slot status to "scheduled"

Save the final plan to DB:
```
bun run src/cli/plan.ts save '<json with updated statuses>'
```

Show the final weekly summary:
- Total posts planned
- Posts drafted
- Posts scheduled
- Remaining outlines for later
- Next series episodes covered
- Language distribution
- Pillar balance

## Per-language analytics tracking (ANLYT-10)

When creating posts during the drafting phase, always include the `language` field in the post record. This enables per-language performance tracking in the analytics system.

## Important notes
- All CLI commands output JSON -- parse and present results conversationally
- The user can bail at any phase -- respect that immediately
- Series episodes always get priority in slot allocation
- "Both" language means two independent versions, never translations
- Pillar weights from strategy.yaml determine distribution targets
- Angle diversity is enforced (max 2 of same angle per week)
- This should feel like a collaborative planning session, not a rigid wizard
- **Maturity-aware:** Check user's maturityLevel from voice profile to adapt guidance:
  - never_posted: 2 ideas, full hand-holding, sample posts
  - sporadic: 3 ideas, moderate guidance
  - consistent: 5 ideas, minimal guidance
  - very_active: 8+ ideas, autonomous mode
