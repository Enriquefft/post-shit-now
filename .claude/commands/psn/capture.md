# /psn:capture -- Fast idea capture and management

## What this does
Captures ideas into the idea bank for later use in weekly planning. Supports inline tags for quick categorization. Goal: capture an idea in under 30 seconds.

## Arguments
$ARGUMENTS

## Flow

### Capture mode (default)
When the user provides an idea (any format: sentence, URL, screenshot description, raw thought):

1. Run the capture CLI:
   ```
   bun run src/cli/capture.ts capture "<user's idea text with #optional:tags>"
   ```
   Inline tags use #key:value format. Recognized keys: pillar, platform, format, urgency, hub.
   Examples: `#pillar:ai`, `#platform:x`, `#format:thread`, `#urgency:timely`, `#hub:company`

2. Parse the JSON output and confirm the idea was captured.

3. Show the idea's:
   - Status (spark)
   - Urgency (timely/seasonal/evergreen) -- note if it was inferred
   - Any parsed tags (pillar, platform, format)
   - Expiry date if timely or seasonal

4. Ask if the user wants to:
   - Add notes to flesh out the idea
   - Change urgency classification
   - Capture another idea

### List mode
When the user asks to see their ideas:
```
bun run src/cli/capture.ts list [--status ready] [--pillar ai] [--urgency evergreen] [--limit 20] [--offset 0]
```
Present ideas in a readable format with status, urgency, and age.

### Ready ideas
When the user asks "what's ready to write" or wants ideas for `/psn:post`:
```
bun run src/cli/capture.ts ready [--pillar ai] [--platform x] [--limit 10]
```
Show ideas that have matured to "ready" status -- good candidates for content creation.

### Search
When the user wants to find specific ideas:
```
bun run src/cli/capture.ts search "query" [--status seed] [--limit 20]
```
Searches idea titles and notes by keyword.

### Stats mode
When the user asks for idea bank overview:
```
bun run src/cli/capture.ts stats
```
Show counts by status (spark, seed, ready, claimed, developed, used, killed).

### Stale mode
When the user asks to review stale ideas:
```
bun run src/cli/capture.ts stale
```
Show stale ideas (sparks >14 days, seeds >30 days without activity). For each stale idea, ask the user to:
- **Keep:** Touch the idea to reset staleness timer
- **Kill:** Provide a reason and transition to killed status
- **Promote:** Add notes and promote to next status

### Expire mode
Run timely idea expiration:
```
bun run src/cli/capture.ts expire
```
Report how many timely ideas were auto-killed.

### Killed ideas
View recently killed ideas (for understanding rejection patterns):
```
bun run src/cli/capture.ts killed [--days 7]
```
Shows ideas killed in the last N days with their kill reasons.

## Quick capture examples
- `/psn:capture AI agents are replacing junior devs -- hot take thread idea`
- `/psn:capture #pillar:ai #format:carousel comparison of RAG vs fine-tuning approaches`
- `/psn:capture #urgency:timely OpenAI just announced GPT-5 -- need to post about this today`
- `/psn:capture #platform:linkedin leadership lessons from scaling engineering teams`

## Important notes
- Keep it fast -- the goal is under 30 seconds for a basic capture
- Ideas start as "spark" status and mature through the pipeline: spark -> seed -> ready -> claimed -> developed -> used
- Timely ideas auto-expire after 48 hours if not used
- Seasonal ideas expire after 30 days
- All output is JSON from the CLI -- parse it and present conversationally
- Killed ideas feed back into the preference model so the system learns what the user rejects
- The idea bank feeds into /psn:plan for weekly content planning
