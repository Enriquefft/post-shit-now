# Phase 12: Solo Founder Experience - Research

**Researched:** 2026-02-19
**Domain:** Multi-entity voice management, unified setup UX, maturity-aware planning
**Confidence:** HIGH

## Summary

Phase 12 introduces three user-facing capabilities: (1) entity-scoped voice profiles for solo founders managing multiple projects without Company Hub overhead, (2) unified setup flow absorbing the voice interview into `/psn:setup`, and (3) maturity-aware planning that adapts hand-holding based on the user's social media experience level.

The current codebase already has strong foundations: voice profiles are YAML-based with a mature schema (VOICE-01 through VOICE-10), the interview engine detects experience levels (`beginner`, `intermediate`, `advanced`), and `/psn:setup` already orchestrates multi-step provisioning. The work is primarily about extending these patterns rather than building new subsystems.

**Primary recommendation:** Extend existing voice profile schema with `entity_slug` field, refactor `/psn:setup` to absorb voice interview as a configuration step, and leverage the existing `detectedExperience` concept for planning behavior adaptation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Entity Profile Selection
- **Selection method:** CLI flag (`--entity <slug>`) with searchable picker fallback (like fzf)
- **Single entity behavior:** Show picker but pre-selected (user can confirm or change)
- **Picker displays:** Entity name + description + last used indicator
- **No entity flag:** Prompt with searchable picker

#### Unified Setup Flow
- **First-run users:** Full wizard with smart inference and defaults
  - User mostly confirms suggested values rather than typing from scratch
  - Inference provides suggestions, user confirms for speed
- **Returning users:** Status screen showing:
  - What's configured (checkmarks)
  - What's incomplete/missing (gaps highlighted)
  - Recommended next action
- **Entity creation mini-wizard:** Full flow: name -> voice interview -> platform connection
  - Smart defaults: if one entity has X connected, suggest connecting X for new entity

#### Maturity Adaptation
- **4 levels:** never posted / sporadic / consistent / very active
- **"Never posted" behavior:**
  - Explain all options before asking
  - Suggest 1-2 specific post ideas rather than open-ended ask
  - Generate sample posts for them to see before committing
- **Sporadic/Consistent/Very active:** Claude's discretion - researcher/planner determine appropriate adaptations

#### Profile Storage & Naming
- **Primary storage:** Hub database with `voice_profiles` table
  - Add `entity_slug` column to distinguish entities
  - Hub-scoped: personal hub entities in personal DB
- **YAML files:** Keep for backup/export and initial creation review
- **Entity naming:** Auto-slugify from display name
  - "My Side Project" -> `my-side-project`
  - "PSN Founder" -> `psn-founder`

### Claude's Discretion

- Exact searchable picker implementation (fzf-style or custom)
- Specific adaptations for sporadic, consistent, and very active users
- YAML export/import format details
- Slug collision handling (append number? error?)

### Deferred Ideas (OUT OF SCOPE)

None - discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOICE-11 (new) | Entity-scoped voice profiles without Company Hub overhead | Voice profile schema extension (`entity_slug`), profile selection pattern, Hub DB storage |
| SETUP-01 (new) | Unified setup flow absorbing voice interview | Current `runSetup()` orchestration pattern, validation summary pattern, `/psn:voice` interview engine |
| PLAN-11 (new) | Maturity-aware planning with adaptive hand-holding | Existing `detectExperienceLevel()` in interview.ts, planning engine in ideation.ts, `/psn:plan` flow |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yaml | ^2.8.2 | Voice profile serialization | Already used for all voice profiles; Zod + yaml pattern proven |
| zod | ^4.3.6 | Schema validation | Already validates `VoiceProfile` and `StrategyConfig` |
| drizzle-orm | ^0.45.1 | Database operations | Already used for all Hub DB operations; `voice_profiles` table fits existing pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | 0.31.9 | Migrations | Adding `voice_profiles` table and `entity_slug` column |
| @neondatabase/serverless | ^1.0.2 | DB connections | Hub DB access for profile CRUD |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom fzf-like picker | `@clack/prompts` | @clack adds dependency for single feature; custom implementation matches existing JSON-to-stdout pattern |
| DB-only storage | YAML files only | CONTEXT.md explicitly requires both: DB for queries, YAML for backup/export |

**Installation:**
No new packages required. All functionality achievable with existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── voice/
│   ├── profile.ts          # Existing: load/save YAML profiles
│   ├── types.ts            # Existing: VoiceProfile schema -> ADD entity_slug
│   ├── interview.ts        # Existing: interview engine -> ADD maturity field
│   ├── entity-profiles.ts  # NEW: entity CRUD, selection picker
│   └── calibration.ts      # Existing: calibration reports
├── cli/
│   ├── setup.ts            # Existing: orchestrator -> EXTEND with voice interview
│   ├── setup-voice.ts      # NEW: voice setup subcommand (or merge into setup.ts)
│   └── validate.ts         # Existing: validation checks
├── planning/
│   ├── ideation.ts         # Existing: generatePlanIdeas -> ADD maturity adaptations
│   └── types.ts            # Existing: PlanIdea types
└── content/
    └── generate.ts         # Existing: post generation -> EXTEND entity selection
```

### Pattern 1: Entity-Scoped Voice Profile Schema Extension
**What:** Add `entity_slug` to VoiceProfile schema and create DB-backed `voice_profiles` table
**When to use:** All voice operations become entity-aware

**Example:**
```typescript
// Source: Existing src/voice/types.ts pattern
// Extend voiceProfileSchema
export const voiceProfileSchema = z.object({
  version: z.string(),
  entitySlug: z.string().optional(), // NEW: entity identifier
  entityDisplayName: z.string().optional(), // NEW: human-readable name
  entityDescription: z.string().optional(), // NEW: shown in picker
  maturityLevel: z.enum(["never_posted", "sporadic", "consistent", "very_active"]).optional(), // NEW
  createdAt: z.string(),
  // ... rest of existing schema
});
```

### Pattern 2: Searchable Entity Picker (CLI)
**What:** JSON-to-stdout picker pattern matching existing CLI architecture
**When to use:** When `--entity` flag not provided

**Example:**
```typescript
// Source: Pattern from existing src/cli/setup.ts JSON output
// Entity picker outputs JSON for Claude to render interactively

export async function listEntities(db: HubDb, userId: string): Promise<EntitySummary[]> {
  // Query voice_profiles table grouped by entity_slug
  // Return: [{ slug, displayName, description, lastUsedAt }]
}

// Claude renders picker via slash command, receives selection
// Pattern matches existing /psn:setup flow
```

### Pattern 3: Unified Setup Status Detection
**What:** Check existing configuration state to determine setup flow behavior
**When to use:** `/psn:setup` called by returning user

**Example:**
```typescript
// Source: Pattern from existing runSetup() in src/cli/setup.ts
// Existing pattern: sequential steps with "need_input" status

interface SetupStatus {
  hasHub: boolean;
  hasVoiceProfile: boolean;
  hasPlatforms: boolean;
  hasEntities: boolean;
  incompleteSteps: string[];
  recommendedAction: string;
}

export async function detectSetupStatus(configDir: string): Promise<SetupStatus> {
  // Check config/hub.env -> hasHub
  // Check content/voice/personal.yaml -> hasVoiceProfile
  // Check oauth_tokens table -> hasPlatforms
  // Check voice_profiles table -> hasEntities
  // Return status for Claude to render
}
```

### Pattern 4: Maturity-Aware Planning Adaptations
**What:** Branch planning behavior based on maturity level
**When to use:** `/psn:plan` ideation phase

**Example:**
```typescript
// Source: Existing detectExperienceLevel() in src/voice/interview.ts
// Extend with maturity-specific behaviors

interface MaturityAdaptation {
  explainBeforeAsking: boolean;
  suggestedIdeasCount: number;
  showSamplePosts: boolean;
  handHoldingLevel: "full" | "moderate" | "minimal" | "none";
}

const MATURITY_ADAPTATIONS: Record<string, MaturityAdaptation> = {
  never_posted: {
    explainBeforeAsking: true,
    suggestedIdeasCount: 2,
    showSamplePosts: true,
    handHoldingLevel: "full",
  },
  sporadic: {
    explainBeforeAsking: false,
    suggestedIdeasCount: 3,
    showSamplePosts: false,
    handHoldingLevel: "moderate",
  },
  consistent: {
    explainBeforeAsking: false,
    suggestedIdeasCount: 5,
    showSamplePosts: false,
    handHoldingLevel: "minimal",
  },
  very_active: {
    explainBeforeAsking: false,
    suggestedIdeasCount: 8,
    showSamplePosts: false,
    handHoldingLevel: "none",
  },
};
```

### Anti-Patterns to Avoid
- **Don't create Company Hub for entities:** Solo founder entities are explicitly NOT Company Hubs. They live in Personal Hub with `entity_slug` distinguishing profiles.
- **Don't remove YAML profiles:** CONTEXT.md requires YAML for backup/export. DB is primary, YAML is secondary.
- **Don't use interactive CLI prompts:** All CLI scripts output JSON. Claude renders interactive flows through slash commands.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity picker UI | Custom terminal UI | JSON output + Claude rendering | Matches existing pattern; no new dependencies |
| Slug generation | Custom slugify | `slugify()` helper (simple) | Trivial 5-line function; no library needed |
| Maturity detection | New detection logic | Extend existing `detectExperienceLevel()` | Already signals `beginner/intermediate/advanced` |

**Key insight:** The interview engine already has experience detection. Extend it with the 4-level maturity model rather than building parallel detection.

## Common Pitfalls

### Pitfall 1: Entity vs Company Hub Confusion
**What goes wrong:** Treating entity profiles like mini Company Hubs with separate databases
**Why it happens:** Similar use case (multiple voices) but different architecture
**How to avoid:** Entity profiles share the Personal Hub database; distinguished by `entity_slug` column only
**Warning signs:** Creating `.hubs/entity-{slug}.json` files

### Pitfall 2: Maturity Level Mismatch with Experience Detection
**What goes wrong:** Interview detects `advanced` but maturity is `sporadic` (different axes)
**Why it happens:** Experience detection looks at content volume; maturity looks at posting frequency/consistency
**How to avoid:** Maturity is a separate field from experience. Interview captures both:
- `detectedExperience` (existing): how sophisticated their approach is
- `maturityLevel` (new): how consistent their posting is
**Warning signs:** Conflating "I know engagement strategies" with "I post regularly"

### Pitfall 3: Picker State Not Persisted
**What goes wrong:** User selects entity but selection forgotten on next command
**Why it happens:** No "last used" tracking
**How to avoid:** Store `lastUsedAt` timestamp in voice_profiles table; picker shows most recent first
**Warning signs:** User must select entity every time

### Pitfall 4: Setup Absorbs Voice But Loses Voice-Only Path
**What goes wrong:** `/psn:voice` deprecated but users want to update voice without full setup
**Why it happens:** Over-merging commands
**How to avoid:** Keep `/psn:setup voice` as subcommand for voice-only updates. `/psn:setup` (no args) is full wizard.
**Warning signs:** `/psn:voice` returns "command deprecated"

## Code Examples

Verified patterns from official sources:

### Entity Profile DB Schema
```typescript
// Source: Pattern from src/core/db/schema.ts (existing)
// Add voice_profiles table following existing patterns

export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    entitySlug: text("entity_slug").notNull(), // unique per user
    entityDisplayName: text("entity_display_name"),
    entityDescription: text("entity_description"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    profileData: jsonb("profile_data").$type<VoiceProfile>().notNull(), // full YAML content
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("voice_profiles_user_entity_idx").on(table.userId, table.entitySlug),
    pgPolicy("voice_profiles_isolation", {
      as: "permissive",
      to: hubUser,
      for: "all",
      using: sql`${table.userId} = current_setting('app.current_user_id')`,
      withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
    }),
  ],
);
```

### Setup Status Detection
```typescript
// Source: Pattern from src/cli/setup.ts runSetup()
// Extend validation pattern for setup status

export async function getSetupStatus(configDir: string): Promise<SetupStatus> {
  const checks: CheckResult[] = [];

  // Check Hub (existing pattern)
  try {
    await readFile(`${configDir}/hub.env`, "utf-8");
    checks.push({ step: "hub", status: "complete" });
  } catch {
    checks.push({ step: "hub", status: "missing" });
  }

  // Check Voice Profile
  try {
    await readFile("content/voice/personal.yaml", "utf-8");
    checks.push({ step: "voice", status: "complete" });
  } catch {
    checks.push({ step: "voice", status: "missing" });
  }

  // Check Platforms (via DB query in real impl)
  // Check Entities (via DB query in real impl)

  return {
    checks,
    recommendedAction: determineNextAction(checks),
  };
}
```

### Maturity-Aware Topic Suggestions
```typescript
// Source: Pattern from src/content/topic-suggest.ts suggestTopics()
// Extend with maturity parameter

export function suggestTopics(options: {
  profile: VoiceProfile;
  platform: Platform;
  count: number;
  maturityLevel?: string; // NEW
}): TopicSuggestion[] {
  const count = adaptCountByMaturity(options.count, options.maturityLevel);

  // For "never_posted": return fewer, more specific suggestions
  // For "very_active": return more, let user filter
  const suggestions = generateSuggestions(options.profile, options.platform, count);

  return suggestions;
}

function adaptCountByMaturity(requested: number, maturity?: string): number {
  switch (maturity) {
    case "never_posted": return Math.min(requested, 2);
    case "sporadic": return Math.min(requested, 3);
    case "consistent": return Math.min(requested, 5);
    case "very_active": return requested;
    default: return requested;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Voice profiles YAML-only | YAML + DB sync (this phase) | Phase 12 | Enables entity queries, last-used tracking |
| `/psn:voice` separate command | Absorbed into `/psn:setup` (this phase) | Phase 12 | Single entry point for all configuration |
| Binary experience detection | 4-level maturity model (this phase) | Phase 12 | More nuanced planning adaptations |

**Deprecated/outdated:**
- `/psn:voice interview` as primary entry point: Becomes `/psn:setup voice` (voice-only) or `/psn:setup` (full wizard)

## Open Questions

1. **Slug collision handling**
   - What we know: CONTEXT.md says auto-slugify; collisions possible
   - What's unclear: Append number (`my-project-2`) or error with suggestion?
   - Recommendation: Append `-2`, `-3`, etc. on collision; simpler UX than error

2. **YAML export format for entities**
   - What we know: YAML kept for backup/export
   - What's unclear: One file per entity or one file with all entities?
   - Recommendation: One file per entity (`content/voice/{entity_slug}.yaml`) matches existing `personal.yaml` pattern

3. **Entity deletion behavior**
   - What we know: Entities can be removed
   - What's unclear: Soft-delete (archive) or hard-delete?
   - Recommendation: Hard-delete for simplicity; entities are lightweight, recreate if needed

## Sources

### Primary (HIGH confidence)
- `src/voice/types.ts` - VoiceProfile schema structure
- `src/voice/profile.ts` - YAML load/save patterns
- `src/voice/interview.ts` - Experience detection, STARTER_ARCHETYPES
- `src/cli/setup.ts` - Setup orchestration pattern, subcommand routing
- `src/core/db/schema.ts` - Table patterns, RLS patterns
- `.claude/commands/psn/setup.md` - Setup command specification
- `.claude/commands/psn/voice.md` - Voice command specification
- `.claude/commands/psn/plan.md` - Planning command specification
- `.planning/phases/12-solo-founder-experience/12-CONTEXT.md` - User decisions

### Secondary (MEDIUM confidence)
- `src/planning/ideation.ts` - Planning engine patterns
- `src/content/topic-suggest.ts` - Topic suggestion patterns
- `.planning/ROADMAP.md` - Phase requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use; no new dependencies
- Architecture: HIGH - Patterns established across 11 previous phases
- Pitfalls: HIGH - Based on understanding of existing codebase patterns

**Research date:** 2026-02-19
**Valid until:** 30 days (stable patterns, no fast-moving dependencies)
