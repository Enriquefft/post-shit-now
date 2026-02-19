# Phase 5: Intelligence, Ideation, and Planning — Context

Created: 2026-02-19
Phase goal: User can capture ideas, get trend-informed suggestions, plan a full week of content, create recurring series, and post in both English and Spanish.

---

## 1. Idea Lifecycle and Capture UX

### Capture format
- `/psn:capture` accepts a **sentence + optional inline tags** (pillar, platform, format hints)
- Minimum: a single sentence describing the idea
- Tags are optional — system infers pillar/platform later during maturity promotion
- Example: `"AI agents replacing SaaS #pillar:ai #format:thread"` or just `"AI agents replacing SaaS"`

### Maturity pipeline
- Stages: **spark → seed → ready → claimed → developed → used/killed**
- **Auto-promote with override**: system auto-advances ideas when confidence is high (trend match, notes added, related post performance)
- User can always revert/override any auto-promotion
- Promotion signals: matching trend detected, user adds notes/angle, engagement data on related topics

### Killing ideas
- **Staleness warning after N days**: system flags old sparks/seeds that haven't been touched
- User decides to keep or kill — no auto-deletion
- Killed ideas move to a killed state (queryable for posterity, out of active views)

### Storage
- **Database only** (Neon Postgres)
- Ideas table with RLS scoped per user + hub
- Supports personal ideas and per-company ideas naturally
- Browsed/searched via `/psn:capture list` with filters
- No git files for ideas — they change state too frequently

---

## 2. Weekly Planning Experience

### Plan output
- **Hybrid: calendar outline + key drafts**
- `/psn:plan` generates a week calendar: day, topic, format, series slot, pillar
- System also generates actual draft content for 2-3 key posts
- Remaining slots are outlined for later `/psn:post` calls

### Autonomy level
- **Collaborative back-and-forth**
- System proposes, user reacts iteratively
- "I'd put a thread about X on Tuesday — good?" style conversation
- System uses strategy.yaml, preference model, series schedule, idea bank, and trend data to inform suggestions
- User has full control to swap, add, remove, reorder

### Series integration
- **Auto-slot series episodes first**
- Due series episodes are locked into the plan before filling other slots
- Remaining capacity filled with pillar-balanced, trend-informed content
- User can still override series slots if needed

### Plan execution
- **Finish-then-schedule model**: users can flesh out posts during the planning session (all, some, or none)
- Only finished/approved posts get scheduled as Trigger.dev delayed runs
- Unfinished posts remain as drafts — user completes them later with `/psn:post`
- Plan itself persists as a reference (what was planned vs. what was published)

---

## 3. Content Series Management

### Series definition
- **Named + cadence + format template + branding**
- Each series has: name, cadence (weekly/biweekly/monthly/custom), format template (structure, sections, intro/outro patterns), visual style notes, hashtag set
- Full creative definition — not just a label

### Episode tracking
- **Customizable per series** — not all series have episodes
- Options per series:
  - No numbering (recurring topic, e.g., "hot takes on Fridays")
  - Auto-increment (e.g., "AI Roundup #14")
  - Custom format string (e.g., "Season 2, Ep 3")
- Each series defines its own tracking preference at creation time

### Missed episodes
- **Suggest from idea bank + warn**
- When a series episode is due during `/psn:plan`, system searches idea bank for matching topics
- If match found: suggest it for the episode slot
- If no match: warn that episode is due but empty
- User decides: skip, postpone, or create on the spot

### Storage
- **Database only** (Neon Postgres)
- Series table with hub_id scoping (RLS per hub)
- Template, cadence, branding, tracking config stored as columns/jsonb
- Series have mutable state (episode count, last published, performance history)
- Managed via `/psn:series` command

---

## 4. Bilingual Content Creation

### Language choice
- **Default from profile + inferred override**
- Voice profile has a default language setting: `en`, `es`, or `both`
- During `/psn:post`, system uses the default unless context suggests otherwise
- If idea/topic is in Spanish, infer Spanish. If ambiguous, use default.
- User can always override explicitly

### "Both" languages handling
- **Claude suggests approach, user confirms**
- When posting in both languages, system suggests either:
  - Two separate posts (common for X, TikTok)
  - One combined post with both sections (common for LinkedIn)
- Suggestion based on: voice profile preferences, target platform conventions, content type
- User confirms or changes the approach per post

### EN/ES content relationship
- **User controls the relationship per post**
- Options when creating bilingual content:
  - "Same idea, adapt it" — same core topic/angle, culturally adapted execution
  - "Fresh take" — independent content for Spanish audience, different angle
- Default behavior: same core idea, independently crafted (not translated)
- User can specify the relationship each time

### Voice profiles
- **Base profile + language overrides**
- Single YAML profile per user with shared base traits (pillars, formality level, identity)
- Language-specific sections override only what differs: `es:` section for Spanish vocabulary, cultural references, tone adjustments
- Shared traits inherited by both languages unless overridden
- Interview engine collects language-specific voice samples when bilingual is enabled

---

## Deferred Ideas

None captured during this discussion.

---

## Summary for Downstream Agents

### Storage decisions (both DB-only)
- Ideas: Neon Postgres, RLS per user+hub, `/psn:capture list` for browsing
- Series: Neon Postgres, RLS per hub, template/branding as jsonb, `/psn:series` for management

### Key patterns
- Auto-promote ideas (user can override) — not manual-only
- Collaborative planning (back-and-forth) — not fully autonomous
- Series auto-slotted first in weekly plans
- Finish-then-schedule: only approved posts get Trigger.dev delayed runs
- Bilingual via base profile + language overrides in single YAML
- Language default in profile, inferred from context, always overridable
- Episode tracking is per-series customizable (none, auto-increment, custom format)

### New DB tables needed
- `ideas` — maturity pipeline, hub scoping, tags, staleness tracking
- `series` — definition, cadence, template (jsonb), tracking config, episode state
- `weeklyPlans` (or similar) — plan persistence, slot status, link to drafts

### Voice profile extension
- Add `defaultLanguage` field: `en` | `es` | `both`
- Add `es:` section for language-specific overrides (vocabulary, cultural refs, tone)
- Interview engine needs bilingual question path
