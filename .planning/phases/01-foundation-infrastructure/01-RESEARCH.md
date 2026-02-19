# Phase 1: Foundation Infrastructure - Research

**Researched:** 2026-02-18
**Domain:** Project scaffolding, database infrastructure, task automation, developer tooling
**Confidence:** HIGH

## Summary

Phase 1 establishes the technical foundation: Bun-based TypeScript project, Drizzle ORM with Neon Postgres (including RLS), Trigger.dev v4 Cloud for task automation, and developer tooling (Biome, Vitest). The ecosystem is mature and well-documented. Bun is fully supported by both Drizzle ORM and Trigger.dev v4 (runtime v1.3.3). Drizzle has first-class RLS support via `pgPolicy()` and `pgTable.withRLS()`, but the critical constraint is that `drizzle-kit push` silently skips RLS policies -- only `generate` + `migrate` is safe. Neon CLI (`neonctl`) handles DB provisioning entirely from the terminal. Trigger.dev v4 supports Bun runtime natively with `runtime: "bun"` in `trigger.config.ts`.

**Primary recommendation:** Use a flat single-package structure (not monorepo) with Bun as package manager + runtime, Drizzle ORM with `@neondatabase/serverless` driver, Trigger.dev v4 with Bun runtime, and Biome 2.x for linting/formatting. Never use `drizzle-kit push` -- always `generate` then `migrate`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Setup Flow UX:** Step-by-step wizard: Claude guides user through one thing at a time (create DB -> connect Trigger.dev -> add API keys -> validate -> done)
- **CLI tooling only** for external services -- no browser-based copy/paste flows. Use `neonctl` and `trigger` CLI exclusively
- **Full validation** at end of setup: test every connection (DB, Trigger.dev, platform APIs) and show pass/fail checklist
- **Resume from failure** on re-run: detect what's already configured, skip completed steps, retry failed step
- **Bun** as package manager and TypeScript runner (no tsx needed)
- Slash commands at `.claude/commands/psn/*.md`
- Config directory structure matches PRD exactly: `config/strategy.yaml`, `config/hub.env`, `config/keys.env`, `config/voice-profiles/`, `config/series/`, `config/connections/`, `config/company/`
- **Neon DB creation** via `neonctl` CLI -- fully terminal-based, no dashboard visits
- **Trigger.dev project creation** via `npx trigger.dev@latest init` (or equivalent v4 CLI)
- **Deploy Trigger.dev tasks immediately** during setup -- everything works when setup completes
- **Auto-migrate DB schema:** run all pending Drizzle migrations automatically, no user confirmation needed
- **CLI scripts output JSON to stdout only** -- Claude interprets and presents to user
- **Errors are actionable:** always tell the user what to do next
- **Validation checklist** uses checkmarks: checkmark DB connection, checkmark Trigger.dev, X OAuth
- **Progress indicators** use step counters: `[2/5] Creating database...`

### Claude's Discretion

- Codebase organization (single package vs monorepo) -- optimize for Trigger.dev + Drizzle sharing
- Resume-from-failure detection approach
- Exact Drizzle schema design for initial tables
- Token encryption approach for `oauth_tokens` table
- Post watchdog implementation details (polling interval, re-trigger strategy)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Developer can set up project with Node.js 22 LTS, pnpm, TypeScript 5.7+, Biome linting, Vitest testing | Bun replaces Node+pnpm per user decision. Bun has native TS support. Biome 2.x confirmed. Vitest works with Bun via `bun run test`. |
| INFRA-02 | Shared `@psn/core` package contains Drizzle schemas, API clients, types, and hub connection logic | Single-package structure recommended (Claude's discretion). Drizzle schemas, types, and connection logic in `src/core/`. |
| INFRA-03 | User can provision a Personal Hub (Neon Postgres + Trigger.dev Cloud) via `/psn:setup` | `neonctl` CLI for DB creation, `trigger.dev` CLI for project init. Both terminal-only per user decision. |
| INFRA-04 | Hub connector (`createHubConnection()`) establishes typed database connections with proper error handling | Drizzle + `@neondatabase/serverless` driver. HTTP driver for serverless, WebSocket for long-running. |
| INFRA-05 | Drizzle Kit migration infrastructure generates and applies migrations (never `push` in production) | Confirmed: `drizzle-kit push` silently skips RLS policies (GitHub issue #3504). Only `generate` + `migrate` is safe. |
| INFRA-06 | Post watchdog task detects stuck Trigger.dev runs and re-triggers them | Trigger.dev v4 scheduled tasks (cron) + `runs.list()` API for detecting stuck runs. |
| INFRA-07 | All secrets (API keys, hub credentials, connection files) are gitignored and never committed | `.gitignore` patterns for `config/hub.env`, `config/keys.env`, `config/connections/`. |
| CONFIG-01 | `/psn:setup` walks through full onboarding: Hub creation, OAuth, API keys, voice profiling, preferences | Phase 1 scope: Hub creation + API keys + validation. OAuth and voice profiling are later phases. |
| CONFIG-04 | BYOK model: user provides all API keys (platform APIs, image gen, intelligence, Trigger.dev, Neon) | Keys stored in `config/keys.env`, loaded via Bun's env handling. |
| CONFIG-07 | Database migrations run automatically during setup via Drizzle Kit | `drizzle-kit generate` + `drizzle-kit migrate` in setup flow. Auto-run per user decision. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bun | 1.2+ | Package manager, TypeScript runner, test runner host | User decision. Native TS, fast installs, built-in runner. Trigger.dev supports Bun 1.3.3 runtime. |
| drizzle-orm | 1.0+ (beta) | Type-safe ORM with RLS support | First-class Neon integration, `pgPolicy()` API, migration-based workflow. |
| drizzle-kit | 1.0+ (beta) | Schema migrations CLI | `generate` + `migrate` workflow preserves RLS policies. Never use `push`. |
| @neondatabase/serverless | latest | Neon Postgres driver | HTTP driver for serverless (Trigger.dev tasks), WebSocket for local dev. |
| @trigger.dev/sdk | 4.3+ | Task automation SDK | v4 GA with Bun runtime support, delayed runs, cron schedules, wait primitives. |
| trigger.dev (CLI) | 4.3+ | Dev server and deployment CLI | `init`, `dev`, `deploy` commands. |
| typescript | 5.7+ | Type system | Required by project spec. Bun runs TS natively. |
| @biomejs/biome | 2.0+ | Linter + formatter | Single tool replacing ESLint + Prettier. Type-aware linting since 2.0. |
| vitest | 3.x | Test framework | Works with Bun via `bun run test` (not `bun test` which uses Bun's own runner). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | latest | Environment variable loading | Fallback if Bun's built-in env loading isn't sufficient for `.env` files |
| ws | latest | WebSocket polyfill | Required for Neon WebSocket driver in Node.js/Bun environments |
| zod | 3.x | Schema validation | Validate API key configs, setup inputs, task payloads |
| yaml | 2.x | YAML parsing | Read/write `config/strategy.yaml` and voice profiles |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bun | pnpm + tsx | User explicitly chose Bun. No reason to reconsider. |
| Drizzle ORM | Prisma | Prisma lacks first-class RLS support. Drizzle's `pgPolicy()` is ideal. |
| @neondatabase/serverless | postgres.js | Neon driver optimized for serverless (HTTP). postgres.js needs persistent connections. |
| Biome | ESLint + Prettier | User spec says Biome. Single tool, faster, type-aware in 2.0. |

**Installation:**
```bash
bun add drizzle-orm @neondatabase/serverless @trigger.dev/sdk zod yaml ws
bun add -d drizzle-kit @biomejs/biome vitest typescript @types/ws
```

## Architecture Patterns

### Recommended Project Structure

Single-package (not monorepo). Trigger.dev deploys from root `trigger.config.ts` and reads `dirs: ["./src/trigger"]`. Shared code in `src/core/` is imported by both CLI scripts and Trigger.dev tasks.

```
post-shit-now/
├── .claude/commands/psn/     # Slash commands (setup.md, etc.)
├── config/                    # User config (gitignored secrets)
│   ├── strategy.yaml
│   ├── hub.env               # Neon connection string (GITIGNORED)
│   ├── keys.env              # API keys (GITIGNORED)
│   ├── voice-profiles/
│   ├── series/
│   ├── connections/          # Company hub connections (GITIGNORED)
│   └── company/
├── src/
│   ├── core/                 # @psn/core equivalent (schemas, clients, types)
│   │   ├── db/
│   │   │   ├── schema.ts     # Drizzle schema with RLS policies
│   │   │   ├── migrate.ts    # Migration runner
│   │   │   └── connection.ts # createHubConnection()
│   │   ├── types/            # Shared TypeScript types
│   │   └── utils/            # Shared utilities
│   ├── cli/                  # CLI scripts (JSON stdout)
│   │   ├── setup.ts          # Hub provisioning
│   │   └── validate.ts       # Connection validation
│   └── trigger/              # Trigger.dev tasks
│       ├── watchdog.ts       # Post watchdog cron
│       └── health.ts         # Health check task
├── drizzle/                  # Generated migrations
│   └── migrations/
├── drizzle.config.ts
├── trigger.config.ts
├── tsconfig.json
├── biome.json
├── vitest.config.ts
├── package.json
└── .gitignore
```

### Pattern 1: Hub Connection Factory

**What:** Typed database connection factory using Drizzle + Neon serverless driver
**When to use:** Every database operation

```typescript
// src/core/db/connection.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createHubConnection(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

// For WebSocket (long-running processes, local dev):
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

export function createHubConnectionWs(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}
```

### Pattern 2: Drizzle Schema with RLS

**What:** Define tables with row-level security policies inline
**When to use:** All Hub tables that store per-user data

```typescript
// src/core/db/schema.ts
import { pgTable, pgPolicy, pgRole, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const hubUser = pgRole("hub_user").existing();

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  pgPolicy("posts_isolation", {
    as: "permissive",
    to: hubUser,
    for: "all",
    using: sql`user_id = current_setting('app.current_user_id')`,
    withCheck: sql`user_id = current_setting('app.current_user_id')`,
  }),
]);
```

### Pattern 3: Trigger.dev Task with Bun Runtime

**What:** Define Trigger.dev tasks that run in Bun runtime
**When to use:** All scheduled/automated tasks

```typescript
// src/trigger/watchdog.ts
import { schedules } from "@trigger.dev/sdk";
import { createHubConnection } from "../core/db/connection";

export const postWatchdog = schedules.task({
  id: "post-watchdog",
  cron: "*/15 * * * *", // Every 15 minutes
  run: async (payload) => {
    const db = createHubConnection(process.env.DATABASE_URL!);
    // Find posts scheduled in the past that haven't been published
    // Re-trigger publishing for stuck posts
  },
});
```

### Pattern 4: CLI Script with JSON Output

**What:** CLI scripts that output structured JSON for Claude to interpret
**When to use:** All `/psn:setup` and validation scripts

```typescript
// src/cli/setup.ts
interface SetupResult {
  step: string;
  status: "success" | "error" | "skipped";
  message: string;
  data?: Record<string, unknown>;
}

function output(result: SetupResult): void {
  console.log(JSON.stringify(result));
}

// Usage: bun run src/cli/setup.ts
```

### Anti-Patterns to Avoid

- **Using `drizzle-kit push`:** Silently drops RLS policies. Always use `generate` + `migrate`.
- **Storing connection strings in code:** Use `config/hub.env` loaded at runtime.
- **Browser-based setup flows:** User explicitly wants CLI-only (`neonctl`, `trigger` CLI).
- **Monorepo for this project:** Adds unnecessary complexity. Single package with `src/core/` for shared code is sufficient for Trigger.dev deployment.
- **Using `bun test` instead of `bun run test`:** `bun test` invokes Bun's built-in test runner, not Vitest.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL scripts | Drizzle Kit `generate` + `migrate` | Tracks migration state, generates diffs, preserves RLS |
| Neon DB provisioning | HTTP API calls | `neonctl` CLI | Auth, project creation, connection strings all handled |
| Task scheduling | Custom cron + queue | Trigger.dev scheduled tasks | Checkpointing, retries, delayed runs, dashboard monitoring |
| Environment validation | Custom env checkers | Zod schemas | Type-safe validation, clear error messages |
| YAML config parsing | Regex/custom parser | `yaml` package | Handles all YAML edge cases, TypeScript types |
| Token encryption at rest | Custom crypto | Node.js `crypto.createCipheriv` with AES-256-GCM | Battle-tested, authenticated encryption, available in Bun |

**Key insight:** This phase is infrastructure plumbing. Every component has a well-tested library. The value is in correct wiring, not custom implementations.

## Common Pitfalls

### Pitfall 1: drizzle-kit push Destroys RLS Policies

**What goes wrong:** `drizzle-kit push` applies schema changes directly but silently skips `pgPolicy` definitions. After push, tables have no RLS policies.
**Why it happens:** Known bug (GitHub issue #3504). `push` uses a different code path that doesn't process policy statements.
**How to avoid:** Always use `drizzle-kit generate` then `drizzle-kit migrate`. Add a CI check or pre-push hook that fails if `drizzle-kit push` is used.
**Warning signs:** Tables accessible without proper auth context after schema changes.

### Pitfall 2: Bun Concurrent Statement Issues

**What goes wrong:** Bun 1.2.0 had issues executing concurrent database statements, leading to errors.
**Why it happens:** Internal Bun SQLite driver limitation (less relevant for Neon HTTP driver which is stateless).
**How to avoid:** Use Neon HTTP driver (`drizzle-orm/neon-http`) for Trigger.dev tasks (stateless, no connection pooling issues). WebSocket driver only for local dev where concurrency is lower.
**Warning signs:** Random database errors under concurrent task execution.

### Pitfall 3: Trigger.dev Bun Runtime vs Local Bun

**What goes wrong:** Local development uses your installed Bun version, but Trigger.dev Cloud uses a specific runtime version (currently Bun 1.3.3).
**Why it happens:** Trigger.dev pins runtime versions for stability.
**How to avoid:** Set `runtime: "bun"` in `trigger.config.ts`. Test with `trigger dev` which simulates the cloud runtime.
**Warning signs:** Tasks work locally but fail in deployed environment.

### Pitfall 4: neonctl Auth Flow

**What goes wrong:** `neonctl auth` launches a browser, which the user explicitly wants to avoid for provisioning.
**Why it happens:** Default auth flow is browser-based OAuth.
**How to avoid:** Use `neonctl --api-key $NEON_API_KEY` for all commands. User provides Neon API key during BYOK setup, stored in `config/keys.env`.
**Warning signs:** Browser opening during setup flow.

### Pitfall 5: Vitest vs Bun Test Runner

**What goes wrong:** Running `bun test` invokes Bun's built-in test runner instead of Vitest.
**Why it happens:** Bun has its own test runner that responds to `bun test`.
**How to avoid:** Always use `bun run test` (which runs the `test` script from package.json) or `bunx vitest`.
**Warning signs:** Tests using Vitest-specific APIs (mocking, etc.) fail with unknown function errors.

### Pitfall 6: Drizzle ORM Version Instability

**What goes wrong:** Drizzle ORM 1.0 is in beta. API may have minor changes between releases.
**Why it happens:** Active development towards stable 1.0 release.
**How to avoid:** Pin exact versions in `package.json`. Use `--save-exact` flag with `bun add`.
**Warning signs:** Type errors or runtime failures after `bun update`.

## Code Examples

### Drizzle Config for Neon

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/core/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Trigger.dev Config with Bun Runtime

```typescript
// trigger.config.ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  runtime: "bun",
  project: "<project-ref>", // Set during setup
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  maxDuration: 300, // 5 minutes default
});
```

### Biome Configuration

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

### Migration Runner

```typescript
// src/core/db/migrate.ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

export async function runMigrations(databaseUrl: string) {
  const sql = neon(databaseUrl);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
}
```

### Delayed Run for Post Scheduling

```typescript
// Future use (Phase 2) but infrastructure must support it
import { task } from "@trigger.dev/sdk";

export const publishPost = task({
  id: "publish-post",
  maxDuration: 60,
  retry: { maxAttempts: 3 },
  run: async (payload: { postId: string }) => {
    // Publish post to platform API
  },
});

// Triggered with delay:
// await publishPost.trigger({ postId: "..." }, { delay: scheduledDate });
```

### AES-256-GCM Token Encryption

```typescript
// src/core/utils/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(ciphertext: string, key: Buffer): string {
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Drizzle `push` for dev | `generate` + `migrate` always | Bug confirmed Nov 2024 | RLS policies preserved |
| Trigger.dev v3 | Trigger.dev v4 GA | 2025 | Bun runtime, wait primitives, checkpointing |
| ESLint + Prettier | Biome 2.0 | June 2025 | Single tool, type-aware linting |
| Neon WebSocket only | Neon HTTP + WebSocket drivers | 2024 | HTTP for serverless, WebSocket for persistent |
| Node.js + tsx | Bun native TS | Mature 2025 | No transpilation step, faster startup |

**Deprecated/outdated:**
- Trigger.dev v3 API: Replaced by v4. Different config format and SDK imports.
- `drizzle-kit push` for RLS projects: Broken for RLS policies. Use `generate` + `migrate`.
- ESLint flat config migration: Skip entirely, use Biome 2.0.

## Open Questions

1. **Drizzle ORM 1.0 stability**
   - What we know: Currently in beta, API mostly stable
   - What's unclear: Exact release timeline for stable 1.0
   - Recommendation: Pin exact version, test migrations on each update

2. **Bun + Neon WebSocket compatibility**
   - What we know: `ws` package needed as WebSocket polyfill
   - What's unclear: Whether Bun's native WebSocket works with Neon driver
   - Recommendation: Use HTTP driver for Trigger.dev tasks (no WebSocket needed), test WS locally

3. **Token encryption key management**
   - What we know: AES-256-GCM is the right algorithm
   - What's unclear: Where to derive the encryption key from (user passphrase? random key in env?)
   - Recommendation: Generate random 32-byte key during setup, store in `config/hub.env`

## Sources

### Primary (HIGH confidence)
- Drizzle ORM official docs (https://orm.drizzle.team/docs/rls) - RLS API with pgPolicy, pgRole
- Drizzle ORM Neon guide (https://orm.drizzle.team/docs/connect-neon) - Connection setup
- Trigger.dev Bun guide (https://trigger.dev/docs/guides/frameworks/bun) - Bun runtime setup
- Trigger.dev config docs (https://trigger.dev/docs/config/config-file) - trigger.config.ts
- Trigger.dev scheduling (https://trigger.dev/docs/tasks/scheduled) - Cron and delayed runs
- Neon CLI GitHub (https://github.com/neondatabase/neonctl) - neonctl commands

### Secondary (MEDIUM confidence)
- GitHub issue #3504 (https://github.com/drizzle-team/drizzle-orm/issues/3504) - push vs migrate RLS bug
- Biome 2.0 release (https://biomejs.dev/) - Type-aware linting features
- Neon RLS guide (https://neon.com/docs/guides/rls-drizzle) - Neon + Drizzle RLS integration

### Tertiary (LOW confidence)
- Bun concurrent statement issues - mentioned in search results, needs validation with Neon HTTP driver specifically

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are well-documented, actively maintained, and verified via official docs
- Architecture: HIGH - Single-package structure is standard for Trigger.dev projects, verified via Trigger.dev monorepo guides
- Pitfalls: HIGH - drizzle-kit push bug confirmed via GitHub issue, Bun/Vitest conflict confirmed via official docs
- RLS patterns: MEDIUM - Drizzle RLS API is documented but relatively new (beta)

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days - stack is stable)
