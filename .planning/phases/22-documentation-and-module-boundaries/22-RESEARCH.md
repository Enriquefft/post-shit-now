# Phase 22: Documentation and Module Boundaries - Research

**Researched:** 2026-02-27
**Domain:** TypeScript path aliases, barrel exports, CLAUDE.md documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CLAUDE.md Content**
- Purpose: navigation map + architecture narrative. Claude agent opening project cold should orient within seconds.
- Sections: Minimal. Only one required section: **Project overview** (what this repo is, who uses it, core value in 2-3 sentences). Beyond that, an ASCII flow diagram.
- Architecture explanation: ASCII text diagram showing top-level data flow: `trigger task → publisher-factory → platform handler → platform client → API`
- Extension guidance: Nothing. No "how to add a new platform" recipe. Agents read existing handler files and interface.
- Rules and constraints: Not in CLAUDE.md. File size limits, lint rules, TypeScript settings — all in tooling. No duplication.
- Target length: 100–200 lines. Lean toward the low end.

**Path Aliases**
- Three aliases in `tsconfig.json` only:
  - `@psn/core` → `src/core/`
  - `@psn/platforms` → `src/platforms/`
  - `@psn/trigger` → `src/trigger/`
- No other aliases. `src/series/`, `src/media/`, `src/voice/` etc. use relative imports.
- `@psn/core` maps to whole `src/core/` directory. Consumers write `@psn/core/types`, `@psn/core/utils/crypto`, etc. No sub-path aliases.
- Configuration location: `tsconfig.json` only. No changes to `trigger.config.ts` or `bunfig.toml`. Bun resolves tsconfig paths natively.
- Enforcement: Convention only. No Biome lint rule. Aliases are preferred style, not mandatory.

**Module-Level CLAUDE.md Files**
- Two files only: `src/platforms/CLAUDE.md` and `src/core/CLAUDE.md`
- `src/trigger/` does NOT get its own CLAUDE.md this phase.
- Both follow the same two-section structure:
  ```markdown
  ## Ownership
  [One paragraph: what this module is responsible for, and what it is NOT responsible for]

  ## Key Files
  [Bullet list: filename → one-line description of what it does]
  ```
- No extension recipes. No rules. ~50 lines per module file.

**Public vs Internal API**
- No internal marking. No `@internal` tags, no `internal/` subdirectories.
- `src/platforms/index.ts` → PlatformPublisher interface, handler classes, factory functions
- `src/core/index.ts` → key shared types (Platform, PlatformPublishResult, PostMetadata), DbConnection, PostRow, crypto utils
- Platform clients (XClient, LinkedInClient, etc.), media helpers, oauth functions are internal by convention — NOT re-exported from top-level barrel.
- Top-level only. One barrel per major module.
- `src/platforms/handlers/index.ts` already exists — keep it as internal barrel for auto-registration. Not the public API barrel.
- For core: update existing `src/core/types/index.ts` to move up one level, or create new `src/core/index.ts`.

### Claude's Discretion

None captured during this session.

### Deferred Ideas (OUT OF SCOPE)

None captured during this session. Phase boundary reminder:
- Pre-commit hooks → Phase 24
- JSDoc behavioral contracts on all public APIs → Phase 23
- ProjectContext manager → Phase 24
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | Create root CLAUDE.md (100-200 lines) for project guidance | CLAUDE.md content pattern: overview + ASCII flow diagram. No tooling duplication. |
| DOC-02 | Document architecture overview with component relationships | ASCII flow diagram `trigger task → publisher-factory → platform handler → platform client → API` per CONTEXT.md |
| ARCH-06 | Add CLAUDE.md files at module boundaries (platforms/, core/) | Module CLAUDE.md pattern: Ownership + Key Files sections, ~50 lines each |
| ARCH-07 | Configure TypeScript path aliases (@psn/platforms, @psn/core) | tsconfig.json paths field. Current `@psn/*` wildcard exists — specific aliases use longest-prefix-wins precedence. |
| ARCH-08 | Create barrel exports (index.ts) at directory boundaries | `src/platforms/index.ts` (new) and `src/core/index.ts` (new or promote existing `src/core/types/index.ts`) |
| ARCH-09 | Define explicit public APIs vs internal modules | Convention-only: clients/media/oauth stay internal by not being re-exported from top-level barrel |
| ARCH-10 | Enforce file size limits (<200 lines) for AI context | Audit current files; all handlers 160-182 lines (within limit). Document the convention in CLAUDE.md or module CLAUDE.md. |
</phase_requirements>

---

## Summary

Phase 22 is a pure documentation and structure phase. No new business logic is introduced. The three deliverables are: (1) CLAUDE.md files (root + two module-level), (2) TypeScript path alias configuration in tsconfig.json, and (3) top-level barrel exports for `src/platforms/` and `src/core/`.

The project already has a partial path alias: `"@psn/*": ["./src/*"]` in tsconfig.json. The specific aliases `@psn/core`, `@psn/platforms`, `@psn/trigger` must be added. Because TypeScript uses longest-prefix-wins for path matching, the specific aliases will take precedence over the wildcard for their respective paths — but the wildcard should be kept for other `src/` imports that don't have a specific alias, or removed if the project wants to restrict to only the three declared aliases.

The `src/core/types/index.ts` file exists but only re-exports types. The decision requires promoting this to a `src/core/index.ts` top-level barrel that also exports `DbConnection`, `PostRow`, and crypto utilities. The `src/core/types/index.ts` currently re-exports from `../../approval/types.ts`, `../../notifications/types.ts`, and `../../platforms/linkedin/types.ts` — these cross-module re-exports create coupling that should be evaluated before including in the new top-level barrel.

**Primary recommendation:** Write CLAUDE.md files first (orientation context), then add path aliases to tsconfig.json, then create the two top-level barrels — this order means the documentation reflects the final state.

---

## Standard Stack

### Core (no new installs needed)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| TypeScript | 5.9.3 (peer dep) | Path alias configuration via `paths` field | Built-in, no plugin needed |
| Bun runtime | latest | Native tsconfig path resolution | Bun reads `paths` from tsconfig.json automatically |
| Biome | 2.4.2 | Linting/formatting — already configured | Already in project, no changes needed for this phase |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| tsc --noEmit | via `bun run typecheck` | Verify aliases resolve correctly after changes | Run after tsconfig.json changes |
| `bun run check:circular` (madge) | ^8.0.0 | Verify barrels don't introduce circular deps | Run after barrel creation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsconfig.json paths only | bunfig.toml aliases | tsconfig.json is the single source of truth; Bun reads it natively; no bunfig.toml needed |
| Convention-only internal marking | `@internal` JSDoc tags | JSDoc contracts are Phase 23; no duplication this phase |
| Top-level barrels | Sub-directory barrels | Sub-barrels would require consumers to know internals; top-level enforces the public API surface |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Current Project Structure (relevant to this phase)
```
src/
├── core/
│   ├── db/              # connection.ts, schema.ts, api-keys.ts, migrate.ts
│   ├── types/
│   │   ├── index.ts     # Platform, PlatformPublishResult, PostMetadata, etc.
│   │   └── publisher.ts # PlatformPublisher interface, DbConnection, PostRow
│   └── utils/           # crypto.ts, publisher-factory.ts, thread-splitter.ts, etc.
├── platforms/
│   ├── handlers/
│   │   ├── index.ts     # Internal barrel: auto-registers all handlers
│   │   ├── x.handler.ts
│   │   ├── linkedin.handler.ts
│   │   ├── instagram.handler.ts
│   │   └── tiktok.handler.ts
│   ├── x/               # client.ts, media.ts, oauth.ts, types.ts
│   ├── linkedin/        # carousel.ts, client.ts, media.ts, oauth.ts, types.ts
│   ├── instagram/       # (similar)
│   └── tiktok/          # (similar)
└── trigger/             # publish-post.ts, watchdog.ts, health.ts, etc.
```

### Pattern 1: TypeScript Path Aliases with Longest-Prefix-Wins

**What:** TypeScript resolves path aliases by matching the longest prefix. Specific aliases (`@psn/core/*`) beat the wildcard (`@psn/*`) for imports starting with `@psn/core/`.

**When to use:** When you want both specific module aliases AND a fallback wildcard.

**Current state:** tsconfig.json has `"@psn/*": ["./src/*"]` — zero usages in source files (confirmed by grep). The wildcard exists but is unused.

**Decision impact:** Since no existing code uses `@psn/*`, the safest approach is to either:
1. Replace the wildcard with the three specific aliases (clean, matches declared intent exactly)
2. Add specific aliases alongside the wildcard (keeps fallback for other src/ modules)

CONTEXT.md says "no other aliases" for unlisted modules — option 1 (replace) is more aligned with the intent. But option 2 is safer if future phases need `@psn/series`, etc.

**Recommended:** Replace the wildcard with the three specific aliases + add wildcard form for each:
```json
// Source: TypeScript official docs https://www.typescriptlang.org/tsconfig/paths.html
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@psn/core":      ["./src/core/index.ts"],
      "@psn/core/*":    ["./src/core/*"],
      "@psn/platforms": ["./src/platforms/index.ts"],
      "@psn/platforms/*": ["./src/platforms/*"],
      "@psn/trigger":   ["./src/trigger/index.ts"],
      "@psn/trigger/*": ["./src/trigger/*"]
    }
  }
}
```

The bare alias (e.g., `@psn/core`) maps to the barrel; the wildcard (e.g., `@psn/core/*`) allows deep imports like `@psn/core/types`.

### Pattern 2: Top-Level Barrel Export

**What:** A single `index.ts` at the module root that explicitly re-exports only the public API. Internal files are not referenced.

**When to use:** When you want to define a clear module boundary without `@internal` markers or directory restructuring.

**Example — src/platforms/index.ts (new file):**
```typescript
// Public API for src/platforms/
// Consumers: Trigger.dev tasks, CLI commands, tests

// The publish contract — what all handlers implement
export type { PlatformPublisher, DbConnection, PostRow, RateLimitInfo } from "./handlers/x.handler.ts";
// Or better: export from the canonical source
export type { PlatformPublisher, DbConnection, PostRow, RateLimitInfo } from "../core/types/publisher.ts";

// Handler classes (for DI / test mocking)
export { XHandler } from "./handlers/x.handler.ts";
export { LinkedInHandler } from "./handlers/linkedin.handler.ts";
export { InstagramHandler } from "./handlers/instagram.handler.ts";
export { TikTokHandler } from "./handlers/tiktok.handler.ts";

// Factory functions
export { createHandler, registerHandler, hasHandler, registeredPlatforms } from "../core/utils/publisher-factory.ts";

// NOT exported: XClient, LinkedInClient, media helpers, oauth functions
```

**Example — src/core/index.ts (new file, promotes src/core/types/index.ts):**
```typescript
// Public API for src/core/
// Core shared types and utilities used across the project

// Types
export type {
  Platform,
  PlatformPublishResult,
  PostMetadata,
  PostStatus,
} from "./types/index.ts";
export type { DbConnection, PostRow } from "./types/publisher.ts";

// Database
export { createHubConnection } from "./db/connection.ts";

// Utilities
export { encrypt, decrypt, keyFromHex } from "./utils/crypto.ts";

// NOT exported: schema internals, migration scripts, env utils
```

**Important:** `src/core/types/index.ts` currently re-exports from `../../approval/types.ts`, `../../notifications/types.ts`, `../../platforms/linkedin/types.ts`. These cross-module re-exports create coupling. The new `src/core/index.ts` barrel should be selective — only re-export what is truly "core" shared API. The cross-module re-exports in `src/core/types/index.ts` can remain as-is (they are not the public API barrel for phase 22 purposes).

### Pattern 3: Module CLAUDE.md (Ownership + Key Files)

**What:** A short markdown file at the module root giving orientation in two sections.

**Structure:**
```markdown
## Ownership

[One paragraph stating what this module is responsible for and what it is NOT responsible for.]

## Key Files

- `file.ts` — one-line description
- `subfolder/file.ts` — one-line description
```

**Target:** ~50 lines. No recipes, no rules, no tutorials.

### Anti-Patterns to Avoid

- **Over-exporting in barrels:** Re-exporting everything from a module defeats the purpose of defining a public API. Be selective — only export what external consumers should use.
- **Duplicating rules in CLAUDE.md:** File size limits are in biome.json (204800 bytes max size). TypeScript strictness is in tsconfig.json. CLAUDE.md should NOT repeat these — agents discover them through tooling.
- **Circular imports via barrel:** Creating `src/core/index.ts` that imports from `src/platforms/` would be circular since `src/platforms/` already imports from `src/core/`. Verify with `bun run check:circular` after barrel creation.
- **Adding @psn/trigger barrel without file:** If `@psn/trigger` is added to tsconfig.json paths, `src/trigger/index.ts` is NOT required to exist for the alias to work — the alias maps to the directory, not just the barrel. However, without a barrel, `import something from "@psn/trigger"` would fail. The alias `@psn/trigger/*` allowing `@psn/trigger/publish-post` would work fine without a barrel.
- **Replacing working relative imports:** Existing source files use relative imports (`../../core/types/index.ts`). Phase 22 does NOT require updating all existing imports — aliases are preferred style, not mandatory. Do not do a mass-replace of existing imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular dependency detection in barrels | Custom import analyzer | `bun run check:circular` (madge already configured) | madge already in devDependencies, runs in < 5 seconds |
| TypeScript compilation verification | Custom checker | `bun run typecheck` (tsc --noEmit) | Already in package.json scripts |
| Path alias enforcement | Custom Biome rule | Convention only (per CONTEXT.md decision) | User explicitly decided against lint enforcement |

**Key insight:** This phase is configuration and documentation — no new libraries or tools are needed. All required tooling (tsc, madge, Biome) is already installed and configured.

---

## Common Pitfalls

### Pitfall 1: Circular Import via Top-Level Barrel

**What goes wrong:** `src/core/index.ts` imports from `src/core/types/index.ts` which re-exports from `../../platforms/linkedin/types.ts`. Now `src/core/` indirectly depends on `src/platforms/`. If `src/platforms/index.ts` then imports from `@psn/core`, TypeScript may accept it but madge will flag the circle.

**Why it happens:** `src/core/types/index.ts` has cross-module re-exports that were added organically (line 100-102): `export type { LinkedInOAuthConfig } from "../../platforms/linkedin/types.ts"`.

**How to avoid:** The new `src/core/index.ts` barrel should NOT re-export the full `src/core/types/index.ts`. Instead, selectively re-export types from `src/core/types/index.ts` that are genuinely "core" (Platform, PlatformPublishResult, PostMetadata, etc.) and skip the cross-module ones. Run `bun run check:circular` after creating the barrel.

**Warning signs:** `madge --circular src/` output lists a cycle involving `core/index.ts` and `platforms/`.

### Pitfall 2: Missing @psn/trigger Barrel Causing Import Failures

**What goes wrong:** `"@psn/trigger": ["./src/trigger/index.ts"]` is added to tsconfig paths, but `src/trigger/index.ts` does not exist. Imports like `import { publishPost } from "@psn/trigger"` fail with "Cannot find module".

**Why it happens:** The `@psn/trigger` alias mapping to a barrel requires the barrel to exist. Unlike `@psn/trigger/*` (which resolves to individual files), the bare `@psn/trigger` expects a file at `src/trigger/index.ts`.

**How to avoid:** Either create `src/trigger/index.ts` when adding the alias, or only add `@psn/trigger/*` (the wildcard form) and skip the bare `@psn/trigger` mapping. Per CONTEXT.md, `src/trigger/` does not get its own CLAUDE.md this phase — the barrel is optional. The alias is primarily for imports like `@psn/trigger/publish-post`.

**Warning signs:** TypeScript error `Cannot find module '@psn/trigger'` after running `bun run typecheck`.

### Pitfall 3: tsconfig baseUrl Interaction

**What goes wrong:** The current tsconfig.json has `"baseUrl": "."`. TypeScript 5.x still requires `baseUrl` to be set when using `paths` (or paths are resolved relative to tsconfig.json location by default). Removing or changing `baseUrl` breaks existing relative-style paths.

**Why it happens:** The `paths` values starting with `./` are relative to `baseUrl`. If `baseUrl` changes, all path mappings shift.

**How to avoid:** Keep `"baseUrl": "."` unchanged. Add new path entries with `"./src/..."` prefix to match existing convention.

**Warning signs:** After tsconfig changes, `bun run typecheck` reports errors on previously-working imports.

### Pitfall 4: CLAUDE.md Content Creep

**What goes wrong:** During writing, it's tempting to add "helpful" sections: how to run tests, how to add a platform, environment variable lists. These duplicate what tooling already surfaces and become stale.

**Why it happens:** Completeness instinct. Documentation writers want to capture everything they know.

**How to avoid:** Strict adherence to the locked structure: overview paragraph + ASCII flow diagram for root CLAUDE.md; Ownership + Key Files for module CLAUDE.md. If content doesn't fit these two structures, it doesn't belong in this phase.

**Warning signs:** CLAUDE.md exceeds 200 lines, contains code examples or setup instructions, or lists environment variables.

### Pitfall 5: Over-exporting from Platforms Barrel

**What goes wrong:** `src/platforms/index.ts` re-exports `XClient`, `createXOAuthClient`, `uploadMedia` etc. Consumers start depending on these internals, defeating the public API intent.

**Why it happens:** It's easy to add `export * from "./x/index.ts"` instead of being selective.

**How to avoid:** Only export: PlatformPublisher interface, handler classes (XHandler etc.), factory functions (createHandler, registerHandler, hasHandler, registeredPlatforms). Platform clients, media helpers, oauth functions stay internal.

---

## Code Examples

### tsconfig.json Path Aliases (final state)

```json
// Source: TypeScript official docs https://www.typescriptlang.org/tsconfig/paths.html
// Bun natively reads tsconfig paths: https://bun.com/docs/guides/runtime/tsconfig-paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@psn/core":        ["./src/core/index.ts"],
      "@psn/core/*":      ["./src/core/*"],
      "@psn/platforms":   ["./src/platforms/index.ts"],
      "@psn/platforms/*": ["./src/platforms/*"],
      "@psn/trigger/*":   ["./src/trigger/*"]
    }
  }
}
```

Note: Bare `@psn/trigger` (without `/*`) is omitted unless `src/trigger/index.ts` is created. `@psn/trigger/*` is sufficient for importing individual trigger tasks like `@psn/trigger/publish-post`.

Note: The existing `"@psn/*": ["./src/*"]` wildcard should be evaluated — if removed, imports like `@psn/series/...` would fail (if anyone used them). Since grep confirms zero usages of `@psn/*` in source, replacing the wildcard is safe.

### src/platforms/index.ts (new — public API barrel)

```typescript
// Source: based on existing handlers/index.ts pattern and CONTEXT.md decisions

/**
 * Public API for src/platforms/
 *
 * Exports the PlatformPublisher contract, all handler classes, and the factory.
 * Platform clients (XClient, LinkedInClient, etc.), media helpers, and oauth
 * functions are internal — not exported here.
 */

// Publish contract
export type { PlatformPublisher, DbConnection, PostRow, RateLimitInfo } from "./handlers/x.handler.ts";

// Handler classes
export { XHandler } from "./handlers/x.handler.ts";
export { LinkedInHandler } from "./handlers/linkedin.handler.ts";
export { InstagramHandler } from "./handlers/instagram.handler.ts";
export { TikTokHandler } from "./handlers/tiktok.handler.ts";

// Factory
export {
  createHandler,
  registerHandler,
  hasHandler,
  registeredPlatforms,
  unregisterHandler,
} from "../core/utils/publisher-factory.ts";
```

Note: `PlatformPublisher`, `DbConnection`, `PostRow`, `RateLimitInfo` are defined in `src/core/types/publisher.ts` (imported into x.handler.ts via re-export). A cleaner approach is to import directly from `../core/types/publisher.ts` to avoid the indirection.

### src/core/index.ts (new — top-level core barrel)

```typescript
/**
 * Public API for src/core/
 *
 * Shared types, DB connection, and utilities used across Trigger.dev tasks,
 * platform handlers, and CLI commands.
 */

// Core types (selective — skip cross-module re-exports from types/index.ts)
export type {
  Platform,
  PlatformPublishResult,
  PostMetadata,
  PostStatus,
  PostSubStatus,
  HubConfig,
  SetupResult,
  ValidationResult,
  ValidationSummary,
} from "./types/index.ts";

// Publisher contract types
export type { PlatformPublisher, DbConnection, PostRow, RateLimitInfo } from "./types/publisher.ts";

// Database
export { createHubConnection } from "./db/connection.ts";
export type { DbClient } from "./db/connection.ts";

// Utilities
export { encrypt, decrypt, keyFromHex } from "./utils/crypto.ts";
```

### Root CLAUDE.md Structure (skeleton)

```markdown
# Post Shit Now

[2-3 sentence project overview: what it is, who uses it, core value]

## Architecture

```
slash command → trigger task → publisher-factory → platform handler → platform client → API
                                     ↓
                              Neon Postgres (analytics, posts, series, teams)
```

## Module Map

| Alias | Path | Responsibility |
|-------|------|----------------|
| @psn/core | src/core/ | Shared types, DB connection, crypto utils |
| @psn/platforms | src/platforms/ | Platform handlers + PlatformPublisher contract |
| @psn/trigger | src/trigger/ | Trigger.dev scheduled tasks |

[Brief descriptions of other src/ directories without aliases]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `@psn/*` wildcard | Specific module aliases `@psn/core`, `@psn/platforms`, `@psn/trigger` | Phase 22 | Consumers get module-scoped imports with IDE autocomplete per module |
| Types in `src/core/types/index.ts` | Public API in `src/core/index.ts` | Phase 22 | Single import point for core: `import type { Platform } from "@psn/core"` |
| No navigation documentation | Root CLAUDE.md + module CLAUDE.md files | Phase 22 | Claude agents orient in seconds, not minutes |

**Deprecated/outdated:**
- `"@psn/*": ["./src/*"]` wildcard: Zero usages in codebase. Safe to replace with specific aliases.

---

## Open Questions

1. **Should the `@psn/*` wildcard be kept alongside specific aliases?**
   - What we know: Zero usages of `@psn/*` in source files (confirmed by grep). TypeScript uses longest-prefix-wins so specific aliases would take precedence anyway.
   - What's unclear: Future phases may want `@psn/series` etc. Without the wildcard they'd need to add an alias explicitly.
   - Recommendation: Remove the wildcard and only declare the three specific aliases. This matches the CONTEXT.md statement "no other aliases." Future phases add aliases as needed.

2. **Where should PlatformPublisher type be re-exported from in src/platforms/index.ts?**
   - What we know: `PlatformPublisher` and related types are defined in `src/core/types/publisher.ts`. They are imported into `x.handler.ts`. Re-exporting from `x.handler.ts` creates an indirect chain.
   - What's unclear: Is it cleaner to import directly from `../core/types/publisher.ts` in the platforms barrel?
   - Recommendation: Import directly from `../core/types/publisher.ts` in `src/platforms/index.ts`. This avoids the indirection and makes the dependency explicit.

3. **Does src/trigger/index.ts need to be created?**
   - What we know: CONTEXT.md adds `@psn/trigger` alias but says `src/trigger/` does not get its own CLAUDE.md this phase.
   - What's unclear: CONTEXT.md says the bare alias maps to `src/trigger/` — but without a barrel, bare `@psn/trigger` imports would fail. The use case is `@psn/trigger/publish-post` (wildcard form).
   - Recommendation: Add only `"@psn/trigger/*": ["./src/trigger/*"]` to tsconfig.json (no bare `@psn/trigger` alias). No barrel needed. Document in CLAUDE.md that trigger imports use the `/*` form.

---

## Sources

### Primary (HIGH confidence)
- TypeScript official docs (https://www.typescriptlang.org/tsconfig/paths.html) — paths configuration, longest-prefix-wins precedence
- Bun official docs (https://bun.com/docs/guides/runtime/tsconfig-paths) — confirmed Bun reads tsconfig.json paths natively with `moduleResolution: "bundler"`
- Project source inspection — current tsconfig.json, src/core/, src/platforms/ structure

### Secondary (MEDIUM confidence)
- TypeScript GitHub issue #5039 — path mapping design discussion, confirms longest-prefix behavior
- WebSearch results on tsconfig paths precedence — corroborated by official TypeScript docs

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing tooling verified
- Architecture: HIGH — based on direct project file inspection + official TypeScript/Bun docs
- Pitfalls: HIGH — circular import risk verified by inspecting `src/core/types/index.ts` (lines 100-102 show cross-module re-exports)

**Research date:** 2026-02-27
**Valid until:** 2026-04-27 (stable domain — TypeScript paths configuration is not fast-moving)
