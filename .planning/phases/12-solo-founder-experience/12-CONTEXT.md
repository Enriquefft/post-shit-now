# Phase 12: Solo Founder Experience - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Solo founders with multiple projects can maintain distinct voices per entity without Company Hub overhead, and new users get maturity-appropriate guidance through unified setup flow.

Delivers:
- Entity-scoped voice profiles (multiple personas without Company Hubs)
- Unified setup flow (voice interview absorbed into `/psn:setup`)
- Maturity-aware planning (adaptive hand-holding vs autonomy)

</domain>

<decisions>
## Implementation Decisions

### Entity Profile Selection
- **Selection method:** CLI flag (`--entity <slug>`) with searchable picker fallback (like fzf)
- **Single entity behavior:** Show picker but pre-selected (user can confirm or change)
- **Picker displays:** Entity name + description + last used indicator
- **No entity flag:** Prompt with searchable picker

### Unified Setup Flow
- **First-run users:** Full wizard with smart inference and defaults
  - User mostly confirms suggested values rather than typing from scratch
  - Inference provides suggestions, user confirms for speed
- **Returning users:** Status screen showing:
  - What's configured (checkmarks)
  - What's incomplete/missing (gaps highlighted)
  - Recommended next action
- **Entity creation mini-wizard:** Full flow: name → voice interview → platform connection
  - Smart defaults: if one entity has X connected, suggest connecting X for new entity

### Maturity Adaptation
- **4 levels:** never posted / sporadic / consistent / very active
- **"Never posted" behavior:**
  - Explain all options before asking
  - Suggest 1-2 specific post ideas rather than open-ended ask
  - Generate sample posts for them to see before committing
- **Sporadic/Consistent/Very active:** Claude's discretion - researcher/planner determine appropriate adaptations

### Profile Storage & Naming
- **Primary storage:** Hub database with `voice_profiles` table
  - Add `entity_slug` column to distinguish entities
  - Hub-scoped: personal hub entities in personal DB
- **YAML files:** Keep for backup/export and initial creation review
- **Entity naming:** Auto-slugify from display name
  - "My Side Project" → `my-side-project`
  - "PSN Founder" → `psn-founder`

### Claude's Discretion
- Exact searchable picker implementation (fzf-style or custom)
- Specific adaptations for sporadic, consistent, and very active users
- YAML export/import format details
- Slug collision handling (append number? error?)

</decisions>

<specifics>
## Specific Ideas

- Searchable picker like fzf for entity selection - familiar UX
- First-run wizard should feel fast - infer defaults, let user confirm
- Status screen for returning users combines "what's done" + "what's missing" + "what's next"

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 12-solo-founder-experience*
*Context gathered: 2026-02-19*
