# Phase 30: Context Management - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated code quality gates at commit time via lefthook pre-commit hooks (biome auto-fix, typecheck, circular dependency detection) and a documented consolidation process for keeping PROJECT.md, MEMORY.md, and CLAUDE.md in sync. No new features, no production code changes beyond hook configuration.

</domain>

<decisions>
## Implementation Decisions

### Hook strictness & behavior
- Block commits on any biome error or typecheck failure — no "warn and pass" mode
- No timeout — hooks always run to completion regardless of duration (optimize hooks if slow, don't skip them)
- Standard `--no-verify` escape hatch allowed for WIP commits
- Hooks scope to src/ files only — planning docs, configs, and markdown are excluded from biome/typecheck

### Circular dependency policy
- Block commits that introduce circular dependencies — consistent with biome strictness
- Assume codebase is currently cycle-free (Phase 21 cleaned up architecture, `check:circular` passes). If any existing cycles found during implementation, fix them in this phase
- Madge scope includes both src/ and trigger/ directories — catches cross-boundary cycles between trigger tasks and core modules

### State consolidation approach
- Checklist added to CLAUDE.md as a "State Consolidation" section — always visible to Claude Code sessions
- Triggered at milestone boundaries (when running /gsd:complete-milestone) — natural checkpoint
- PROJECT.md is the single source of truth — MEMORY.md and CLAUDE.md are updated to match when conflicts exist
- All three files (PROJECT.md, MEMORY.md, CLAUDE.md) are part of the consolidation process

### Auto-fix scope
- Biome auto-fixes are automatically re-staged (deterministic, safe — standard lefthook pattern)
- Typecheck failures show full tsc error output (not summarized) — actionable immediately
- All three tools (biome, typecheck, madge) run in parallel in a single lefthook group — fastest possible execution
- Madge runs alongside biome/typecheck, not after — it's independent of their results

### Claude's Discretion
- Lefthook configuration details (command structure, glob patterns)
- Exact wording of the consolidation checklist
- How to handle edge cases (e.g., staged deletions, renamed files)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `biome.json` — Already configured, `bun run lint` works
- `madge` — Already installed as devDependency, `bun run check:circular` works with `madge --circular src/`
- `bun run typecheck` — Already configured as `tsc --noEmit`
- `bun run format` — `biome format --write .` already available

### Established Patterns
- All dev commands use Bun exclusively (no npm/npx/yarn)
- Package.json scripts: `typecheck`, `lint`, `format`, `check:circular`
- biome handles both linting and formatting in one tool

### Integration Points
- No existing git hooks (.husky doesn't exist, no lefthook.yml)
- Hooks need to be added from scratch via lefthook
- CLAUDE.md consolidation section integrates with existing GSD milestone workflow

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-context-management*
*Context gathered: 2026-02-28*
