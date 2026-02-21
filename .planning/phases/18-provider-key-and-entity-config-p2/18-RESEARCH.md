# Phase 18: Provider Key & Entity Configuration (P2) - Research

**Researched:** 2026-02-21
**Domain:** CLI Setup, Database Operations, Entity Management, Configuration Flow
**Confidence:** HIGH

## Summary

Phase 18 focuses on completing four setup-related improvements: integrating provider key configuration into the main setup flow, adding setup completion validation, documenting the entity creation workflow, and handling entity slug collisions. Research reveals that most infrastructure already exists—what's missing is proper wiring and user-facing documentation.

**Primary recommendations:**
1. Wire `setupProviderKeys()` and `writeProviderKey()` into the main `runSetup()` flow in setup.ts
2. Extend `getSetupStatus()` to check voice_profiles table for completion tracking
3. Create a workflow documentation file (not code changes) for entity creation flow
4. Verify that `ensureUniqueSlug()` in entity-profiles.ts handles all collision cases (it already does)

The codebase already has robust provider key management (`setup-keys.ts` with `collectKeysInteractively`, `setupProviderKeys`, `writeProviderKey`), entity management (`entity-profiles.ts` with `createEntity`, `listEntities`, `ensureUniqueSlug`), and setup status detection (`setup-voice.ts` with `getSetupStatus`). The gaps are primarily in integration and documentation.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| M8 | Provider key configuration flow unclear | `setup-keys.ts` has all needed functions—just needs wiring into main `runSetup()` flow |
| M7 | Missing setup completion validation | `getSetupStatus()` exists but doesn't check voice_profiles table for completion |
| M4 | Missing entity creation flow documentation | Entity creation commands exist—needs workflow documentation, not code |
| m4 | Entity slug collision handling | `ensureUniqueSlug()` already implements -2, -3, -N collision resolution |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|----------|---------|---------|--------------|
| **readline-sync** | 1.4.10 | Interactive prompts with masked input | Already installed, provides `hideEchoBack` and `mask` options for secure key entry |
| **drizzle-orm** | 1.0.0-beta.15-859cf75 | Database queries and schema | Already in use, provides type-safe queries for voice_profiles and api_keys tables |
| **zod** | 4.3.6 | Schema validation | Already in use, validates VoiceProfile and entity creation inputs |

### Supporting
| Library | Version | Purpose | When to Use |
|----------|---------|---------|-------------|
| None needed | - | Provider key management | Existing `setup-keys.ts` functions handle collection, validation, and storage |
| None needed | - | Entity slug generation | Existing `ensureUniqueSlug()` in entity-profiles.ts handles collisions |
| None needed | - | Setup status tracking | Existing `getSetupStatus()` in setup-voice.ts can be extended |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| readline-sync | inquirer | Inquirer adds complexity; readline-sync is already installed and sufficient |
| ensureUniqueSlug (existing) | Database UNIQUE constraint | Existing function already handles collisions with user-friendly slugs; DB constraint would throw cryptic errors |

**Installation:**
```bash
# No new dependencies needed
# All functionality uses existing packages
```

## Architecture Patterns

### Recommended Project Structure

Existing structure is already well-organized. Changes should follow established patterns:

```
src/cli/
├── setup.ts                    # Main orchestrator (existing) — ADD provider key flow
├── setup-keys.ts               # Provider key management (existing) — NO CHANGES
├── setup-voice.ts              # Voice setup and status (existing) — EXTEND status check
├── voice-interview.ts           # Interview engine (existing) — NO CHANGES
└── voice-entity-workflow.md     # NEW: Entity creation workflow documentation
```

### Pattern 1: Provider Key Collection Flow Integration
**What:** Wire `setupProviderKeys()` and `collectKeysInteractively()` into main setup.

**When to use:** Main setup flow (after hub/database setup, before platform OAuth).

**Current State:**
- `setup-keys.ts` exports `setupProviderKeys(configDir)` which checks for missing keys
- `setup-keys.ts` exports `collectKeysInteractively(configDir)` which prompts for keys with masked input
- `setup.ts` calls `setupProviderKeys()` but returns early on "need_input" status
- `runSetup()` in setup.ts lines 592-602 check provider keys but don't prompt

**Required Wiring:**
```typescript
// In setup.ts, around line 592-602
// Replace early return with interactive collection
const providerKeysResult = await setupProviderKeys(configDir);
if (Array.isArray(providerKeysResult)) {
  // Instead of returning early, collect keys interactively
  console.log("Provider keys required:");
  const collectResult = await collectKeysInteractively(configDir);
  steps.push(collectResult);
  if (collectResult.status === "error") {
    return { steps, validation: null, completed: false };
  }
} else {
  steps.push(providerKeysResult);
}
```

### Pattern 2: Setup Status Extension
**What:** Extend `getSetupStatus()` to check voice_profiles table for completion.

**When to use:** `/psn:setup status` command to show accurate progress.

**Current State:**
- `setup-voice.ts` exports `getSetupStatus()` which checks hub.env, voice profiles count, platform count
- Status returned: `hasHub`, `hasVoiceProfile`, `hasPlatforms`, `entityCount`, `platformList`, `incompleteSteps`, `recommendedAction`
- No check for whether entity has completed voice interview (vs just existing entity record)

**Required Extension:**
```typescript
// In setup-voice.ts, getSetupStatus() around line 70-94
// Add interview completion check
if (db && userId) {
  const entityResults = await db
    .select({ profileData: voiceProfiles.profileData })
    .from(voiceProfiles)
    .where(eq(voiceProfiles.userId, userId))
    .limit(1);

  // Check if any entity has completed interview
  const hasCompletedInterview = entityResults[0]?.profileData?.calibration?.status === "calibrated";
  // OR check if profile has pillars defined (indicates interview completion)
  const hasPillars = entityResults[0]?.profileData?.identity?.pillars?.length > 0;

  status.hasVoiceProfile = hasCompletedInterview || hasPillars;
  // ... rest of existing logic
}
```

### Pattern 3: Entity Slug Collision Handling (Already Implemented)
**What:** Verify existing collision handling is complete.

**When to use:** Entity creation via `createEntity()`.

**Current State:**
- `entity-profiles.ts` exports `ensureUniqueSlug()` (lines 228-248)
- Function queries all existing slugs for user, checks for base slug collision
- If collision found, appends -2, -3, etc. incrementally
- Used by `createEntity()` on line 124: `const slug = await ensureUniqueSlug(db, userId, baseSlug);`

**Verification:** Already implements requirement—no code changes needed. May need to document behavior.

### Pattern 4: Entity Creation Workflow Documentation
**What:** Create markdown documentation for entity creation flow.

**When to use:** User guidance after completing voice interview.

**Required Content:**
```markdown
# Entity Creation Workflow

## Overview
Entities allow you to manage multiple projects/brands with separate voice profiles.

## Commands
1. List entities: `/psn:setup entity --list`
2. Create entity: `/psn:setup entity --create "Project Name"`
3. Set voice profile: `/psn:setup voice --entity <slug>`
4. Complete interview: `/psn:voice complete`

## Flow
1. Create entity → slug auto-generated from name
2. Run voice interview for entity → answers saved to DB
3. Complete interview → profile finalized and saved
4. Entity ready for content generation

## Slug Collisions
If entity name collides, slug auto-incremented: "my-project", "my-project-2", "my-project-3"
```

### Anti-Patterns to Avoid
- **Early return from provider key check:** Instead of returning "need_input", prompt for keys interactively
- **Separate status tracking file:** Don't create new config file—use existing voice_profiles table
- **Duplicating entity creation code:** Reuse existing `createEntity()` and `ensureUniqueSlug()`
- **Hard-coded provider list:** Use existing `PROVIDER_KEYS` array in setup-keys.ts

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider key validation | Custom API calls | `validateProviderKey()` in env.ts | Already handles format checks and API validation |
| Slug collision detection | Manual DB queries | `ensureUniqueSlug()` in entity-profiles.ts | Already implements -2, -3, -N pattern |
| Interactive prompts | readline or inquirer | `readline-sync` with `hideEchoBack` | Already installed and used in setup-keys.ts |
| Setup status file | New JSON file | Extend `getSetupStatus()` | Single source of truth in DB |
| Entity creation API | Custom INSERT queries | `createEntity()` in entity-profiles.ts | Handles slug generation, profile creation |

**Key insight:** All required functionality exists. Phase 18 is primarily about wiring existing pieces together and documenting workflows, not building new features.

## Common Pitfalls

### Pitfall 1: Returning "need_input" Status Without Prompting
**What goes wrong:** `setupProviderKeys()` returns array of "need_input" results, but main setup flow returns early instead of prompting.
**Why it happens:** Original design assumed separate provider key phase—didn't anticipate interactive collection in main flow.
**How to avoid:** Replace early return with call to `collectKeysInteractively()` which already handles masked input and validation.
**Warning signs:** Provider key step shows "need_input" but no prompt appears; user stuck with unclear next step.

### Pitfall 2: File-Based Status Tracking
**What goes wrong:** Creating new setup-status.json file instead of using existing database.
**Why it happens:** Tempting to add a simple tracking file, but this creates dual source of truth.
**How to avoid:** Extend `getSetupStatus()` to check voice_profiles table directly. Database is single source of truth.
**Warning signs:** Status checks require reading both DB and files; sync issues between file and DB state.

### Pitfall 3: Duplicate Entity Creation Logic
**What goes wrong:** Implementing entity creation in multiple places (setup.ts, entity-creation.ts, etc.).
**Why it happens:** Each command seems to need entity creation, leads to copy-pasted code.
**How to avoid:** Always import and use `createEntity()` from entity-profiles.ts. It already handles slug generation and profile initialization.
**Warning signs:** Multiple functions with similar INSERT queries for voice_profiles table.

### Pitfall 4: Ignoring Existing Interview State
**What goes wrong:** Entity creation flow doesn't account for voice interview progress.
**Why it happens:** Treating entity creation as one-step operation vs. multi-phase workflow.
**How to avoid:** Document the full workflow: create entity → voice interview → completion → ready for generation.
**Warning signs:** Users create entity but voice profile remains blank (no pillars, no calibration).

## Code Examples

Verified patterns from existing codebase:

### Provider Key Collection Integration
```typescript
// Source: src/cli/setup-keys.ts (lines 113-225)
export async function collectKeysInteractively(
  configDir = "config",
): Promise<SetupResult> {
  const results: { name: string; saved: boolean; error?: string }[] = [];

  // Collect Phase 1 keys (NEON_API_KEY, TRIGGER_SECRET_KEY)
  for (const keyDef of REQUIRED_KEYS_PHASE1) {
    const apiKey = await promptForKey(keyDef.name, keyDef.name);
    if (!apiKey) continue; // Skip if cancelled

    const writeResult = await writeKey(keyDef.name, apiKey, configDir);
    // ... track results
  }

  // Collect provider keys (perplexity, openai, etc.)
  const hubEnv = await loadHubEnv(configDir);
  if (hubEnv.success) {
    const db = createHubConnection(hubEnv.data.databaseUrl);
    const hubId = await getHubIdForSetup(configDir);
    const existingKeys = await listKeys(db, hubId);
    const configuredServices = new Set(existingKeys.map((k) => k.service));

    for (const provider of PROVIDER_KEYS) {
      if (configuredServices.has(provider.name)) continue; // Skip if configured

      const apiKey = await promptForKey(provider.name, provider.service);
      if (!apiKey) continue;

      const writeResult = await writeProviderKey(hubId, provider.name, apiKey, configDir);
      // ... track results
    }
  }

  // Return summary
  return {
    step: "keys",
    status: savedCount > 0 ? "success" : "error",
    message: `Saved ${savedCount} keys, ${failedCount} failed or skipped`,
    data: { results },
  };
}
```

### Entity Slug Collision Handling (Already Implemented)
```typescript
// Source: src/voice/entity-profiles.ts (lines 228-248)
async function ensureUniqueSlug(db: DbClient, userId: string, baseSlug: string): Promise<string> {
  // Find all slugs that start with the base slug
  const results = await db
    .select({ slug: voiceProfiles.entitySlug })
    .from(voiceProfiles)
    .where(eq(voiceProfiles.userId, userId));

  const existingSlugs = new Set<string>(results.map((r) => r.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  // Find next available number
  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
}
```

### Setup Status Extension Pattern
```typescript
// Source: src/cli/setup-voice.ts (lines 46-124)
export async function getSetupStatus(
  configDir: string,
  db?: DbClient,
  userId?: string,
): Promise<SetupStatus> {
  const status: SetupStatus = {
    hasHub: false,
    hasVoiceProfile: false,
    hasEntities: false,
    hasPlatforms: false,
    entityCount: 0,
    platformList: [],
    incompleteSteps: [],
    recommendedAction: "",
  };

  // Check hub.env exists -> hasHub
  const hubEnvPath = join(configDir, "hub.env");
  status.hasHub = existsSync(hubEnvPath);

  // Check content/voice/personal.yaml (legacy) OR entities in DB
  if (db && userId) {
    // Query voice_profiles count -> entityCount, hasEntities
    const entityResults = await db
      .select({ count: count() })
      .from(voiceProfiles)
      .where(eq(voiceProfiles.userId, userId));

    status.entityCount = entityResults[0]?.count ?? 0;
    status.hasEntities = status.entityCount > 0;

    // EXTENSION NEEDED: Check interview completion
    // const firstEntity = await db
    //   .select({ profileData: voiceProfiles.profileData })
    //   .from(voiceProfiles)
    //   .where(eq(voiceProfiles.userId, userId))
    //   .limit(1);
    // status.hasVoiceProfile = firstEntity[0]?.profileData?.identity?.pillars?.length > 0;

    // Query oauth_tokens -> platformList, hasPlatforms
    const platformResults = await db
      .selectDistinct({ platform: oauthTokens.platform })
      .from(oauthTokens)
      .where(eq(oauthTokens.userId, userId));

    status.platformList = platformResults.map((r) => r.platform);
    status.hasPlatforms = status.platformList.length > 0;
  }

  // Build incompleteSteps array from missing items
  // ... existing logic

  return status;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Provider keys as separate phase | Integrated into main setup flow | Phase 18 | Single setup command handles all keys |
| File-based setup status | DB-based status (voice_profiles table) | Phase 18 | Single source of truth, no sync issues |
| No slug collision handling | Auto-increment slug (-2, -3, -N) | Phase 12 (already implemented) | User-friendly entity names guaranteed |
| No entity creation docs | Documented workflow guide | Phase 18 | Clear user guidance for multi-project setup |

**Existing patterns from earlier phases:**
- Phase 16: Voice interview state persistence to `content/voice/interviews/`
- Phase 17: Progress indicators with ora, masked input with readline-sync
- Phase 12: Entity-scoped voice profiles with slug collision handling

## Open Questions

1. **Setup completion tracking granularity**
   - What we know: `getSetupStatus()` checks hub, entities, platforms
   - What's unclear: Should completion track per-entity (voice interview done for each entity) or overall (any entity has voice profile)?
   - Recommendation: Track per-entity completion—allows multi-project setup where some entities are configured and others aren't

2. **Provider key collection timing**
   - What we know: `collectKeysInteractively()` handles both Phase 1 (NEON_API_KEY, TRIGGER_SECRET_KEY) and provider keys
   - What's unclear: Should main setup call this for provider keys only, or re-run Phase 1 key collection too?
   - Recommendation: Only collect provider keys—Phase 1 keys are already collected earlier in setup flow

3. **Entity workflow documentation location**
   - What we know: Phase 18.3 requires "Clear entity creation documentation"
   - What's unclear: Should this be in `docs/`, `.planning/`, or as a slash command help?
   - Recommendation: Create `docs/entity-creation-workflow.md` and reference it in `/psn:setup entity --help`

## Sources

### Primary (HIGH confidence)
- **src/cli/setup-keys.ts** — Provider key collection, validation, and storage functions
- **src/cli/setup.ts** — Main setup orchestrator with provider key check (lines 592-602)
- **src/cli/setup-voice.ts** — Setup status detection with `getSetupStatus()` function
- **src/voice/entity-profiles.ts** — Entity CRUD operations with `ensureUniqueSlug()` collision handling
- **src/core/db/api-keys.ts** — Database API key storage with encryption
- **src/core/db/schema.ts** — voice_profiles and api_keys table definitions
- **.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md** — Issue definitions for M8, M7, M4, m4

### Secondary (MEDIUM confidence)
- **src/cli/voice-interview.ts** — Interview state management and completion flow
- **src/voice/profile.ts** — Voice profile save/load with entity support
- **src/voice/types.ts** — VoiceProfile and entity field definitions

### Tertiary (LOW confidence)
- No external sources required—all implementation patterns exist in codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All required libraries already installed and in use
- Architecture: HIGH - Existing patterns well-documented and consistent
- Pitfalls: HIGH - Issues documented from real user trial run (PSN session)

**Research date:** 2026-02-21
**Valid until:** 30 days (stable domain, no external API dependencies)
