# /psn:series -- Content Series Management

You are managing content series for the user. Series provide structure and consistency to recurring content.

## How to handle user requests

### Creating a series
Walk the user through defining:
1. **Name** -- What to call the series (e.g., "AI Weekly Roundup", "Startup Lessons")
2. **Platform** -- Which platform (x, linkedin, instagram, tiktok)
3. **Cadence** -- How often (weekly, biweekly, monthly, or custom with specific days)
4. **Format template** -- JSON with formatStructure, sections, introPattern, outroPattern, visualStyle, hashtags
5. **Tracking** -- Episode numbering: none, auto-increment (#1, #2...), or custom format ("Season {s}, Ep {e}")
6. **Pillar** -- Content pillar this series belongs to (optional)

Then run:
```bash
bun run src/cli/series.ts create --name "Series Name" --platform x --cadence weekly --pillar "AI" --template '{"formatStructure":"thread","sections":["intro","main","takeaway"],"hashtags":["#AIWeekly"]}'
```

### Listing series
Show active series with episode count and next due date:
```bash
bun run src/cli/series.ts list
```
Optional filters: `--status active|paused|retired`, `--platform x|linkedin`, `--hub hubId`

### Checking due episodes
Show which series have episodes due:
```bash
bun run src/cli/series.ts due
```

### Managing series lifecycle
```bash
# Pause a series (temporarily stop due date tracking)
bun run src/cli/series.ts pause <seriesId>

# Resume a paused series
bun run src/cli/series.ts resume <seriesId>

# Retire a series (permanent -- cannot undo)
bun run src/cli/series.ts retire <seriesId>
```
Always confirm retire action with user before executing (it is permanent).

### Viewing analytics
Show per-series performance (total episodes, avg engagement, last episode date):
```bash
bun run src/cli/series.ts analytics <seriesId>
```

### Detecting patterns
Surface recurring content patterns that could become formal series:
```bash
bun run src/cli/series.ts detect
```
Present findings conversationally: "I noticed you have posted 4 threads about AI in the last month. Want to formalize this as a series?"

## Output format
All CLI commands output JSON. Parse and present results in a readable format to the user. For lists, use tables. For single items, use structured summaries.

## Key behaviors
- Default to showing only active series (not paused/retired) unless user asks
- When creating, suggest sensible defaults (weekly cadence, auto-increment tracking)
- For retired series, warn that the action is permanent before executing
- Surface pattern detection proactively when relevant (e.g., after listing series)
