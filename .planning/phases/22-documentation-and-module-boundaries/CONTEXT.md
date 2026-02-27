---
phase: 22-documentation-and-module-boundaries
created: 2026-02-26
source: discuss-phase session
---

# Phase 22 Context: Documentation and Module Boundaries

## What This Phase Builds

Root CLAUDE.md, module-level CLAUDE.md files for `src/platforms/` and `src/core/`, TypeScript path aliases, and top-level barrel exports defining each module's public API.

---

## Decision: CLAUDE.md Content

### Purpose
Dual purpose: **navigation map** (where things live) + **architecture narrative** (how they fit together). A Claude agent opening the project cold should be able to orient within seconds and understand the overall data flow.

### Sections
Minimal. Only one required section: **Project overview** — what this repo is, who uses it, the core value in 2-3 sentences. Beyond that, an ASCII flow diagram of the architecture.

### Architecture explanation
**ASCII text diagram** showing the top-level data flow:

```
trigger task → publisher-factory → platform handler → platform client → API
```

No prose narrative beyond the overview. The diagram gives the mental model in one glance.

### Extension guidance
**Nothing.** Do not include a "how to add a new platform" recipe. Agents read the existing handler files and interface to understand the pattern. CLAUDE.md stays focused on orientation, not tutorials.

### Rules and constraints
**Not in CLAUDE.md.** File size limits, lint rules, TypeScript settings — all in tooling (Biome, tsconfig). No duplication. Agents discover rules through the linter/compiler.

### Target length
100–200 lines. Lean toward the low end.

---

## Decision: Path Aliases

### Aliases to create
Three aliases in `tsconfig.json`:

| Alias | Resolves to |
|-------|------------|
| `@psn/core` | `src/core/` |
| `@psn/platforms` | `src/platforms/` |
| `@psn/trigger` | `src/trigger/` |

`@psn/core` and `@psn/platforms` are from the roadmap spec. `@psn/trigger` added because Trigger.dev tasks are a cross-cutting entry point (publish-post, watchdog, notification-dispatcher).

No other aliases. `src/series/`, `src/media/`, `src/voice/` etc. use relative imports until cross-cutting usage justifies an alias.

### Granularity
`@psn/core` maps to the whole `src/core/` directory. Consumers write `@psn/core/types`, `@psn/core/utils/crypto`, etc. No sub-path aliases.

### Configuration location
**`tsconfig.json` only.** No changes to `trigger.config.ts` or `bunfig.toml`. Bun resolves tsconfig paths natively.

### Enforcement
**Convention only.** No Biome lint rule banning relative cross-module imports. Aliases are preferred style, not mandatory. Agents use them by habit.

---

## Decision: Module-Level CLAUDE.md Files

### Which modules get one
Two files only:
- `src/platforms/CLAUDE.md` — highest complexity, 4 platforms × 4 files each + handler layer
- `src/core/CLAUDE.md` — shared types/utils/DB, touched constantly by all features

`src/trigger/` does not get its own CLAUDE.md this phase.

### Structure (consistent across both)
Both files follow the same two-section structure:

```markdown
## Ownership
[One paragraph: what this module is responsible for, and what it is NOT responsible for]

## Key Files
[Bullet list: filename → one-line description of what it does]
```

No extension recipes. No rules. Consistent structure so agents know exactly where to look in any module CLAUDE.md.

### Target length
~50 lines per module file. Short and scannable.

---

## Decision: Public vs Internal API

### Internal marking convention
**None.** Everything is public by default. The `PlatformPublisher` interface is the public contract; implementation details (clients, media helpers, oauth) are implied by their location. No `@internal` tags, no `internal/` subdirectories this phase.

### Barrel export contents
Top-level barrels expose **only the public contract**:
- `src/platforms/index.ts` → PlatformPublisher interface, handler classes, factory functions
- `src/core/index.ts` → key shared types (Platform, PlatformPublishResult, PostMetadata), DbConnection, PostRow, crypto utils

Platform clients (`XClient`, `LinkedInClient`, etc.), media helpers, and oauth functions are **internal by convention** — not re-exported from the top-level barrel.

### Barrel coverage
**Top-level only.** One barrel per major module:
- `src/platforms/index.ts` (new)
- `src/core/index.ts` (new or update existing `src/core/types/index.ts` to move up one level)

Subdirectories (`platforms/x/`, `platforms/handlers/`, `core/types/`, `core/utils/`) do **not** need their own barrels beyond what already exists. `src/platforms/handlers/index.ts` already exists for auto-registration — keep it, but it's an internal barrel for the factory side-effect, not the public API barrel.

---

## Deferred Ideas

None captured during this session.

---

## Phase Boundary Reminder

Phase 22 scope is fixed to: CLAUDE.md files, path aliases, barrel exports.
- Pre-commit hooks → Phase 24
- JSDoc behavioral contracts on all public APIs → Phase 23
- ProjectContext manager → Phase 24
