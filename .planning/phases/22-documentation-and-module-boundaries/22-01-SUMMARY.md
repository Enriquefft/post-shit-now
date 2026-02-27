---
phase: 22-documentation-and-module-boundaries
plan: "01"
subsystem: documentation
tags: [claude-md, navigation, module-boundaries, orientation]
dependency_graph:
  requires: []
  provides: [CLAUDE.md, src/platforms/CLAUDE.md, src/core/CLAUDE.md]
  affects: [agent-orientation, onboarding]
tech_stack:
  added: []
  patterns: [module-level CLAUDE.md, two-section ownership+key-files structure]
key_files:
  created:
    - CLAUDE.md
    - src/platforms/CLAUDE.md
    - src/core/CLAUDE.md
  modified: []
decisions:
  - "Root CLAUDE.md scoped to orientation only: project overview, ASCII flow diagram, module map, dev commands, slash commands — no tooling rules or extension recipes"
  - "Module CLAUDE.md files use strict two-section structure (Ownership + Key Files) matching CONTEXT.md spec"
  - "src/platforms/CLAUDE.md lists all 20 platform files with accurate one-liners derived from actual directory structure"
  - "src/core/CLAUDE.md lists all 14 core files including schema-zod.ts, api-keys.ts, and migrate.ts found during inspection"
metrics:
  duration: ~2min
  completed: 2026-02-27
  tasks_completed: 2
  files_created: 3
---

# Phase 22 Plan 01: CLAUDE.md Navigation Files Summary

Three agent-orientation CLAUDE.md files created: root project navigation map with ASCII flow diagram, plus module-level orientation files for `src/platforms/` and `src/core/`.

## What Was Built

### Task 1: Root CLAUDE.md (58 lines)

`/home/hybridz/Projects/post-shit-now/CLAUDE.md` — Project navigation map containing:

- 2-3 sentence project overview (what PSN is, who uses it, core value)
- ASCII architecture flow diagram: `slash command → trigger task → publisher-factory → platform handler → platform client → API` with Neon Postgres below
- Module Map table: three `@psn/*` aliases with paths and responsibilities
- Six `src/` directory descriptions for modules without aliases (voice, series, approval, notifications, team, media)
- Dev commands table (bun-only: test, typecheck, check:circular, biome check)
- Slash commands table listing all 10 `/psn:` commands with descriptions

### Task 2: Module-Level CLAUDE.md Files

`/home/hybridz/Projects/post-shit-now/src/platforms/CLAUDE.md` (44 lines) — Platforms module orientation:
- Ownership paragraph: what platforms/ is responsible for and NOT responsible for
- Key Files: all 20 platform files organized by layer (handlers, X, LinkedIn, Instagram, TikTok)

`/home/hybridz/Projects/post-shit-now/src/core/CLAUDE.md` (27 lines) — Core module orientation:
- Ownership paragraph: what core/ is responsible for and NOT responsible for
- Key Files: all 14 core files organized by subsystem (types, db, utils)

## Verification Results

- CLAUDE.md: 58 lines (under 200 limit) — PASS
- src/platforms/CLAUDE.md: 44 lines (under 70 limit) — PASS
- src/core/CLAUDE.md: 27 lines (under 70 limit) — PASS
- ASCII flow diagram present in CLAUDE.md — PASS
- Module Map with @psn aliases present — PASS
- Both module files have Ownership + Key Files sections — PASS
- No tooling rules (file size, lint settings) in any CLAUDE.md — PASS
- No extension recipes in any CLAUDE.md — PASS

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Root CLAUDE.md | 5873292 | docs(22-01): create root CLAUDE.md navigation map |
| Task 2: Module CLAUDE.md files | a8082a2 | docs(22-01): create module-level CLAUDE.md files for platforms/ and core/ |

## Self-Check: PASSED

All artifacts verified present and commits confirmed:
- CLAUDE.md — FOUND
- src/platforms/CLAUDE.md — FOUND
- src/core/CLAUDE.md — FOUND
- 22-01-SUMMARY.md — FOUND
- commit 5873292 — FOUND
- commit a8082a2 — FOUND
