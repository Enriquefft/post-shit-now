---
phase: 01-foundation-infrastructure
plan: 01
subsystem: infra
tags: [bun, drizzle-orm, neon-postgres, rls, biome, vitest, aes-256-gcm, trigger-dev]

# Dependency graph
requires: []
provides:
  - "Bun project with all dependencies and tooling configs"
  - "Drizzle schema with RLS policies (users, oauth_tokens, posts, api_keys)"
  - "Connection factory (HTTP + WebSocket) for Neon Postgres"
  - "Migration runner (drizzle-orm/neon-http/migrator)"
  - "AES-256-GCM encryption utilities for token storage"
  - "Env file loader for hub.env and keys.env"
  - "Shared types (Platform, HubConfig, PostStatus, etc.)"
affects: [01-02, 01-03, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: [bun, drizzle-orm, "@neondatabase/serverless", "@trigger.dev/sdk", zod, yaml, ws, drizzle-kit, "@biomejs/biome", vitest, typescript]
  patterns: [rls-per-table-pgpolicy, neon-http-for-serverless, neon-ws-for-long-running, aes-256-gcm-token-encryption, env-file-parsing]

key-files:
  created:
    - src/core/db/schema.ts
    - src/core/db/connection.ts
    - src/core/db/migrate.ts
    - src/core/utils/crypto.ts
    - src/core/utils/env.ts
    - src/core/types/index.ts
    - drizzle.config.ts
    - trigger.config.ts
    - biome.json
    - vitest.config.ts
  modified:
    - package.json
    - tsconfig.json
    - .gitignore

key-decisions:
  - "Biome 2.4.2 schema differs from 2.0 docs — organizeImports moved to assist.actions.source"
  - "Used base64(iv + authTag + ciphertext) format for encrypted tokens"
  - "drizzle.config.ts uses placeholder DATABASE_URL to avoid requiring DB for generation"

patterns-established:
  - "RLS pattern: pgPolicy per table using current_setting('app.current_user_id')"
  - "Connection pattern: HTTP for stateless (Trigger.dev tasks), WebSocket for long-running"
  - "Env loading: config/hub.env for infra, config/keys.env for API keys"
  - "Crypto: AES-256-GCM with random IV, 32-byte key from HUB_ENCRYPTION_KEY"

requirements-completed: [INFRA-01, INFRA-02, INFRA-05, INFRA-07]

# Metrics
duration: ~35min
completed: 2026-02-18
---

# Plan 01-01: Foundation Scaffold Summary

**Bun project with Drizzle RLS schema (4 tables), Neon connection factory, AES-256-GCM crypto, and full tooling (Biome 2.4.2 + Vitest)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Scaffolded Bun project with all production and dev dependencies
- Created Drizzle schema with pgPolicy RLS on oauth_tokens, posts, and api_keys tables
- Built dual connection factory (HTTP for serverless, WebSocket for long-running)
- Implemented AES-256-GCM encryption with random IV for token storage
- Configured Biome 2.4.2, Vitest 4.0, TypeScript strict mode — all passing

## Task Commits

1. **Task 1 + Task 2: Project scaffold and core infrastructure** - `097a29c` (feat)

## Files Created/Modified
- `package.json` - Project manifest with all deps and scripts
- `tsconfig.json` - Strict TypeScript with @psn/* path aliases
- `biome.json` - Biome 2.4.2 linter/formatter config
- `vitest.config.ts` - Vitest test runner config
- `drizzle.config.ts` - Drizzle Kit migration generation config
- `trigger.config.ts` - Trigger.dev v4 with Bun runtime
- `.gitignore` - Covers secrets (hub.env, keys.env, connections/)
- `src/core/db/schema.ts` - Drizzle schema: users, oauth_tokens, posts, api_keys with RLS
- `src/core/db/connection.ts` - HTTP + WebSocket connection factory
- `src/core/db/migrate.ts` - Migration runner via neon-http migrator
- `src/core/utils/crypto.ts` - AES-256-GCM encrypt/decrypt/generateKey/keyFromHex
- `src/core/utils/env.ts` - loadHubEnv, loadKeysEnv, parseEnvFile
- `src/core/types/index.ts` - Platform, HubConfig, PostStatus, etc.
- `src/core/db/schema.test.ts` - 10 tests (schema, crypto, env parser)
- `config/` - Directory structure with .gitkeep files
- `drizzle/migrations/` - Empty migrations dir with .gitkeep

## Decisions Made
- Biome 2.4.2 config schema differs significantly from 2.0 — organizeImports moved to `assist.actions.source`, `files.ignore` became `files.includes`, action levels use "on"/"off" not severity strings
- Used placeholder DATABASE_URL in drizzle.config.ts to avoid requiring live DB for generation
- Combined Task 1 and Task 2 into single commit since they were developed together

## Deviations from Plan

### Auto-fixed Issues

**1. [Biome Config] Biome 2.4.2 schema changes from 2.0**
- **Found during:** Task 1 (Biome config)
- **Issue:** Biome 2.x restructured config keys (organizeImports location, files.ignore renamed, action level syntax)
- **Fix:** Updated schema URL to 2.4.2, moved organizeImports to assist.actions.source, used files.includes, level: "on"
- **Files modified:** biome.json
- **Verification:** `bun run lint` passes clean
- **Committed in:** 097a29c

**2. [Biome Lint] useLiteralKeys warnings on bracket notation**
- **Found during:** Task 2 verification
- **Issue:** `env["DATABASE_URL"]` flagged by Biome — prefers dot notation
- **Fix:** Ran `biome check --write --unsafe` to auto-fix to dot notation
- **Files modified:** src/core/utils/env.ts, src/core/db/schema.test.ts
- **Verification:** `bun run lint` passes with zero warnings
- **Committed in:** 097a29c

---

**Total deviations:** 2 auto-fixed (both tooling config/lint)
**Impact on plan:** Necessary fixes for Biome 2.4.2 compatibility. No scope creep.

## Issues Encountered
- `bun` command not found on NixOS — resolved with `nix profile install nixpkgs#bun` (Bun 1.3.3)
- Biome 2.4.2 config format undocumented in some areas — resolved through iterative testing

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness
- Core infrastructure ready for Plan 01-02 (Hub provisioning CLI) and Plan 01-03 (Trigger.dev tasks)
- Schema is defined but not yet migrated to a live database (01-02 handles DB provisioning)
- trigger.config.ts has placeholder project ref (01-02 handles Trigger.dev setup)

---
*Phase: 01-foundation-infrastructure*
*Completed: 2026-02-18*
