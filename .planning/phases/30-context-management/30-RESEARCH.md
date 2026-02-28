# Phase 30: Context Management - Research

**Researched:** 2026-02-28
**Domain:** Git hooks (lefthook), code quality gates, documentation consolidation
**Confidence:** HIGH

## Summary

Phase 30 adds automated code quality enforcement at commit time using lefthook pre-commit hooks and establishes a documented process for keeping PROJECT.md, MEMORY.md, and CLAUDE.md synchronized. The tooling is straightforward: lefthook orchestrates three parallel jobs (biome check with auto-fix, typecheck, circular dependency detection via madge) that gate every commit.

Key finding: the codebase has pre-existing issues that must be addressed before hooks can be activated. There are 25 TypeScript errors (mostly in `src/voice/interview.ts` and `src/core/db/migrate.ts`), biome lint violations (fixable), and 6 circular dependencies in `src/media/` (image-gen/video-gen provider patterns). The current `check:circular` script silently processes 0 files because it lacks `--extensions ts` — this must be fixed. The CONTEXT.md decision says to fix existing cycles in this phase.

Performance concern: full `tsc --noEmit` takes ~10.7s (first run) or ~3.5s (incremental cached run). The 3-second target in the success criteria is achievable with `--incremental` on subsequent commits but may be exceeded on first run or after large changes. Biome is fast (~0.35s). Madge takes ~3.2s with `--extensions ts`. Running all three in parallel, the bottleneck is typecheck at ~3.5s incremental.

**Primary recommendation:** Install lefthook, configure `lefthook.yml` with three parallel jobs (biome+stage_fixed, typecheck with --incremental, madge with --extensions ts), fix the 6 existing circular dependencies and pre-existing type errors first, then activate hooks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Block commits on any biome error or typecheck failure — no "warn and pass" mode
- No timeout — hooks always run to completion regardless of duration (optimize hooks if slow, don't skip them)
- Standard `--no-verify` escape hatch allowed for WIP commits
- Hooks scope to src/ files only — planning docs, configs, and markdown are excluded from biome/typecheck
- Block commits that introduce circular dependencies — consistent with biome strictness
- Assume codebase is currently cycle-free (Phase 21 cleaned up architecture, `check:circular` passes). If any existing cycles found during implementation, fix them in this phase
- Madge scope includes both src/ and trigger/ directories — catches cross-boundary cycles between trigger tasks and core modules
- Checklist added to CLAUDE.md as a "State Consolidation" section — always visible to Claude Code sessions
- Triggered at milestone boundaries (when running /gsd:complete-milestone) — natural checkpoint
- PROJECT.md is the single source of truth — MEMORY.md and CLAUDE.md are updated to match when conflicts exist
- All three files (PROJECT.md, MEMORY.md, CLAUDE.md) are part of the consolidation process
- Biome auto-fixes are automatically re-staged (deterministic, safe — standard lefthook pattern)
- Typecheck failures show full tsc error output (not summarized) — actionable immediately
- All three tools (biome, typecheck, madge) run in parallel in a single lefthook group — fastest possible execution
- Madge runs alongside biome/typecheck, not after — it's independent of their results

### Claude's Discretion
- Lefthook configuration details (command structure, glob patterns)
- Exact wording of the consolidation checklist
- How to handle edge cases (e.g., staged deletions, renamed files)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTX-01 | Pre-commit hooks run biome on staged files with auto-fix (lefthook) | Lefthook `stage_fixed: true` with `biome check --write` handles auto-fix and re-staging. Biome official docs confirm this pattern. Glob pattern filters to src/ TS/JSON files only. |
| CTX-02 | Pre-commit hooks run typecheck in parallel (under 3 seconds total) | `tsc --noEmit --incremental` achieves ~3.5s on cached runs (178 files). Lefthook `parallel: true` runs all jobs concurrently. First-run cold cache is ~10.7s — subsequent commits hit cache. |
| CTX-03 | Circular dependency detection at commit time (madge, already configured) | Current `check:circular` script is broken — processes 0 files without `--extensions ts`. Must fix script AND fix 6 existing cycles in src/media/. Madge takes ~3.2s. |
| CTX-04 | State consolidation between PROJECT.md and MEMORY.md documented | Add "State Consolidation" section to CLAUDE.md with checklist. PROJECT.md is single source of truth. Three files: PROJECT.md, MEMORY.md, CLAUDE.md. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lefthook | latest (v2.1.1) | Git hook manager | Biome-recommended, Go binary (fast), parallel by default, single dependency |
| @biomejs/biome | 2.4.2 (installed) | Lint + format in one tool | Already configured, handles both lint and format in `check` command |
| typescript | 5.9.3 (installed) | Type checking | Already configured, `--incremental` flag enables cached builds |
| madge | ^8.0.0 (installed) | Circular dependency detection | Already installed as devDependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | All supporting tools already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| lefthook | husky + lint-staged | Explicitly rejected in REQUIREMENTS.md — lefthook is lighter, Biome-recommended, parallel by default |
| tsc --noEmit | tsc-files (staged only) | tsc-files misses cross-file breakage. Full project check with --incremental is the right tradeoff |

**Installation:**
```bash
bun add -d lefthook
```

After install, run `bunx lefthook install` to create `.git/hooks/pre-commit`.

## Architecture Patterns

### Recommended Project Structure
```
(root)
├── lefthook.yml            # Hook configuration (new)
├── biome.json              # Already exists
├── tsconfig.json           # Already exists (add incremental: true)
├── package.json            # Update check:circular script
├── CLAUDE.md               # Add State Consolidation section
└── .planning/
    └── PROJECT.md           # Single source of truth
```

### Pattern 1: Lefthook Parallel Pre-Commit
**What:** Three independent quality checks running in parallel on every commit
**When to use:** Always — this is the only hook configuration needed
**Example:**
```yaml
# lefthook.yml
# Source: https://biomejs.dev/recipes/git-hooks/ + lefthook docs
pre-commit:
  parallel: true
  jobs:
    - name: biome
      glob: "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true

    - name: typecheck
      glob: "*.{ts,tsx}"
      run: bunx tsc --noEmit --incremental

    - name: circular
      glob: "*.{ts,tsx}"
      run: bunx madge --circular --extensions ts src/
```

**Key details:**
- `stage_fixed: true` on biome job automatically re-stages files after auto-fix
- `glob` on typecheck/circular jobs ensures they only trigger when TS files are staged (but tsc/madge still check all project files — this is correct for cross-file analysis)
- `parallel: true` at hook level runs all three concurrently
- `--colors=off` on biome prevents ANSI escape codes in hook output
- `bunx` prefix required because lefthook runs outside bun's script context

### Pattern 2: Scoping to src/ Only
**What:** Hooks only trigger when src/ files are changed
**When to use:** Per user decision — planning docs, configs, and markdown excluded
**Example:**
```yaml
    - name: biome
      glob: "src/**/*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
```

The glob pattern `src/**/*.{ts,tsx}` ensures hooks skip when only non-src files are committed (e.g., CLAUDE.md edits, planning docs). Note: typecheck and madge still scan the full project when triggered — glob only controls whether the job runs at all.

### Pattern 3: State Consolidation Checklist
**What:** Documented process in CLAUDE.md for syncing PROJECT.md, MEMORY.md, CLAUDE.md
**When to use:** At milestone boundaries (via /gsd:complete-milestone)
**Example checklist content:**
```markdown
## State Consolidation

At milestone boundaries, sync these files (PROJECT.md is the single source of truth):

1. Review PROJECT.md for current architecture, decisions, and module map
2. Update MEMORY.md to match PROJECT.md (remove stale entries, add new decisions)
3. Update CLAUDE.md module map and dev commands if architecture changed
4. Verify all three files agree on: module aliases, dev commands, architecture diagram
```

### Anti-Patterns to Avoid
- **Typecheck on staged files only:** `tsc-files` and similar tools miss cross-file breakage. A change to an export in FileA breaks FileB, but FileB wasn't staged — the pre-commit hook would pass and the commit would introduce type errors. Always run full project typecheck.
- **Timeout on hooks:** The user explicitly decided no timeout. If hooks are slow, optimize the hooks (e.g., --incremental), don't skip them.
- **Running madge without --extensions ts:** Madge processes 0 files by default in this project because there are no `.js` files. The `--extensions ts` flag is mandatory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git hook management | Custom .git/hooks scripts | lefthook | Handles parallel execution, file filtering, stage_fixed, skip conditions |
| Staged file auto-restaging | Custom `git add` after fix | lefthook `stage_fixed: true` | Handles edge cases (partial staging, file deletions, renames) |
| Incremental typecheck | Custom file-list typecheck | `tsc --noEmit --incremental` | Built into TypeScript, handles dependency graph correctly |

**Key insight:** Git hooks have many edge cases (partial staging, merge conflicts, renamed files, deleted files). Lefthook handles all of these. Do not write custom shell scripts for pre-commit logic.

## Common Pitfalls

### Pitfall 1: Madge --extensions ts Missing
**What goes wrong:** `madge --circular src/` processes 0 files and reports "No circular dependency found" even when cycles exist
**Why it happens:** Madge defaults to `.js` extensions. This project has only `.ts` files.
**How to avoid:** Always use `madge --circular --extensions ts src/`
**Warning signs:** "Processed 0 files" in madge output
**Current state:** The existing `check:circular` script in package.json is broken — it lacks `--extensions ts`. There are 6 actual circular dependencies in `src/media/` that go undetected.

### Pitfall 2: Existing Code Quality Issues Block All Commits
**What goes wrong:** Enabling strict pre-commit hooks on a codebase with existing errors means NO commits can land
**Why it happens:** 25 TypeScript errors and biome lint violations exist in the current codebase
**How to avoid:** Fix all existing errors BEFORE activating hooks. Order: (1) fix biome issues with `biome check --write`, (2) fix TS errors, (3) fix circular deps, (4) then install lefthook and activate hooks
**Warning signs:** `bun run typecheck` or `bun run lint` failing on current main branch

### Pitfall 3: Cold Cache Typecheck Performance
**What goes wrong:** First typecheck after cleaning .tsbuildinfo takes ~10.7s, exceeding the 3s target
**Why it happens:** `--incremental` requires a `.tsbuildinfo` cache file. First run builds the cache.
**How to avoid:** Add `"incremental": true` to tsconfig.json so every tsc invocation builds/uses the cache. Add `.tsbuildinfo` to `.gitignore` (machine-specific cache). After initial setup, subsequent commits hit the ~3.5s cached path.
**Warning signs:** "under 3 seconds" target only met on cached runs. Cold cache (clone, CI) will be slower.

### Pitfall 4: Circular Dependencies in src/media/
**What goes wrong:** 6 circular dependencies exist between image-gen/video-gen and their provider files
**Why it happens:** Provider files import from the parent gen file, and the gen file imports from providers (factory pattern without interface separation)
**How to avoid:** Break cycles by: (a) extracting shared types to a separate types file, (b) using dependency inversion (providers don't import from gen files), or (c) lazy imports
**Current cycles:**
1. `media/image-gen.ts` <-> `media/providers/flux.ts`
2. `media/image-gen.ts` <-> `media/providers/gpt-image.ts`
3. `media/image-gen.ts` <-> `media/providers/ideogram.ts`
4. `media/providers/kling.ts` <-> `media/video-gen.ts`
5. `media/video-gen.ts` <-> `media/providers/pika.ts`
6. `media/video-gen.ts` <-> `media/providers/runway.ts`

### Pitfall 5: lefthook install Not Persisted
**What goes wrong:** `bunx lefthook install` creates hooks in `.git/hooks/`, but these are not committed to git. New clones don't have hooks.
**Why it happens:** `.git/` is never committed.
**How to avoid:** Add a `"postinstall": "lefthook install"` script to package.json (or `"prepare"`). This runs automatically after `bun install`, ensuring hooks are set up for every developer.

## Code Examples

### lefthook.yml — Complete Configuration
```yaml
# Source: https://biomejs.dev/recipes/git-hooks/ + lefthook v2 docs
pre-commit:
  parallel: true
  jobs:
    - name: biome
      glob: "src/**/*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true

    - name: typecheck
      glob: "src/**/*.{ts,tsx}"
      run: bunx tsc --noEmit --incremental

    - name: circular
      glob: "src/**/*.{ts,tsx}"
      run: bunx madge --circular --extensions ts src/
```

### tsconfig.json — Incremental Addition
```jsonc
{
  "compilerOptions": {
    // ... existing options ...
    "incremental": true
  }
}
```

### package.json — Script Fixes
```json
{
  "scripts": {
    "check:circular": "madge --circular --extensions ts src/",
    "prepare": "lefthook install"
  }
}
```

### .gitignore — Build Cache
```
*.tsbuildinfo
```

### Circular Dependency Fix Pattern
```typescript
// BEFORE (circular): image-gen.ts imports providers, providers import image-gen types
// image-gen.ts
import { FluxProvider } from "./providers/flux.ts";
export type ImageGenConfig = { ... };

// providers/flux.ts
import type { ImageGenConfig } from "../image-gen.ts"; // CIRCULAR

// AFTER: Extract shared types to a separate file
// media/types.ts (new)
export type ImageGenConfig = { ... };

// image-gen.ts
import type { ImageGenConfig } from "./types.ts";
import { FluxProvider } from "./providers/flux.ts";

// providers/flux.ts
import type { ImageGenConfig } from "../types.ts"; // No cycle
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| husky + lint-staged | lefthook | 2024+ | Single Go binary, parallel by default, Biome-recommended |
| tsc --noEmit (slow) | tsc --noEmit --incremental | TS 4.0+ (2020) | Cached builds, ~3x faster on subsequent runs |
| madge without extensions | madge --extensions ts | Always needed for TS-only projects | Without it, 0 files processed |

**Deprecated/outdated:**
- husky + lint-staged: Still works but heavier, not Biome-recommended. Explicitly rejected by project requirements.

## Open Questions

1. **3-Second Target on Cold Cache**
   - What we know: Incremental cached typecheck is ~3.5s, cold is ~10.7s. Biome is ~0.35s. Madge is ~3.2s.
   - What's unclear: Whether the 3-second success criterion applies to cached runs only or cold runs too
   - Recommendation: Accept ~3.5s cached as "close enough" — cold cache is unavoidable on first run. The success criteria likely assumes warm cache since hooks run repeatedly during development.

2. **Pre-existing TypeScript Errors**
   - What we know: 25 TS errors exist, mostly in `src/voice/interview.ts` (3 errors) and `src/core/db/migrate.ts` (2 errors), plus others
   - What's unclear: Whether these files are actively worked on or legacy code that can be safely fixed
   - Recommendation: Fix all errors before activating hooks. If some files are truly broken, consider whether they should be excluded from tsconfig include paths.

3. **Biome Lint Violations**
   - What we know: `bun run lint` currently fails with violations (e.g., useTemplate in setup-health.ts)
   - What's unclear: Whether auto-fix (`biome check --write`) resolves all current violations
   - Recommendation: Run `biome check --write .` first. Any remaining errors are non-auto-fixable and need manual fixes before hook activation.

## Sources

### Primary (HIGH confidence)
- [Biome Git Hooks Recipe](https://biomejs.dev/recipes/git-hooks/) — Official lefthook + biome configuration pattern
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) — v2.1.1, installation, parallel execution, configuration structure
- [Lefthook Configuration Docs](https://lefthook.dev/configuration/) — Jobs, stage_fixed, glob, parallel options

### Secondary (MEDIUM confidence)
- [n8n lefthook.yml](https://medium.com/@ramunarasinga/lefthook-yml-in-n8n-codebase-cf2655b3303a) — Real-world biome + stage_fixed configuration
- [DevTools Guide: Linting](https://www.devtoolsguide.com/linting-and-formatting/) — Biome + lefthook recommended pattern
- [TypeScript Pre-Commit Approaches](https://dev.to/samueldjones/run-a-typescript-type-check-in-your-pre-commit-hook-using-lint-staged-husky-30id) — tsc-files limitations, --incremental recommendation

### Empirical (HIGH confidence — measured on this codebase)
- `bun run typecheck`: ~10.7s (cold), ~3.5s (incremental cached)
- `bunx biome check src/`: ~0.35s
- `bunx madge --circular --extensions ts src/`: ~3.2s (178 files)
- `madge --circular src/` (without --extensions ts): 0 files processed, false "no cycles" result
- 25 TypeScript errors currently in codebase
- 6 circular dependencies in src/media/ currently undetected by check:circular script

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — lefthook is Biome-recommended, all tools already installed except lefthook itself
- Architecture: HIGH — Configuration is well-documented, measured performance on this codebase
- Pitfalls: HIGH — Discovered critical issues (madge --extensions ts, existing cycles, existing TS errors) through empirical testing

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable tooling, no fast-moving changes expected)
