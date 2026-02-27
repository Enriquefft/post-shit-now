# Phase 25: Trigger.dev Env Var Delivery - Research

**Researched:** 2026-02-27
**Domain:** Trigger.dev build extensions, environment variable management, deploy-time credential delivery
**Confidence:** HIGH

## Summary

Phase 25 solves the most critical deployment blocker: Trigger.dev Cloud workers start with zero environment variables. Every task reads `process.env.DATABASE_URL`, `process.env.HUB_ENCRYPTION_KEY`, and platform credentials -- all of which exist only in local config files. In dev mode (`trigger dev`), Bun auto-loads `.env` files, masking the problem. In production (`trigger deploy`), workers receive nothing and crash immediately.

The fix is straightforward: add a `syncEnvVars` build extension to `trigger.config.ts` that reads local config files at deploy time and pushes credentials to Trigger.dev Cloud. A new `src/trigger/env-sync.ts` helper handles file reading and env var assembly. Additionally, every task needs an improved env var validation pattern that lists ALL missing variables (not just the first two) with actionable guidance.

This is the lowest-complexity phase in v1.3 (~80 lines of new code) with the highest impact -- every other deployed feature depends on workers having credentials.

**Primary recommendation:** Use `syncEnvVars` from `@trigger.dev/build/extensions/core` with a helper that reads `.env` (loaded by Bun at CLI time) and returns the required env var array. Add a shared `validateRequiredEnvVars()` utility for consistent, actionable error messages across all 13 trigger tasks.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Trigger.dev workers receive all required env vars (DATABASE_URL, HUB_ENCRYPTION_KEY, platform credentials) via syncEnvVars build extension | syncEnvVars API verified via official docs. Full env var inventory extracted from codebase (19 unique variables across 13 tasks). `@trigger.dev/build` package required, must match SDK major version (v4). |
| DEPLOY-02 | Missing env vars produce actionable error messages listing each missing variable at task start | Current tasks have inconsistent validation -- some throw with partial lists, some silently return `{ status: "error" }`. Need shared `validateRequiredEnvVars()` utility that lists ALL missing vars and suggests running `/psn:setup trigger-env`. |
| DEPLOY-03 | syncEnvVars reads from local hub config files at deploy time without requiring manual .env hacking | syncEnvVars callback runs during `bunx trigger.dev deploy` on the developer's machine where local files exist. The `--env-file` flag hydrates `process.env` in the CLI process. Bun also natively loads `.env` files. Either mechanism provides the values to the sync callback. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trigger.dev/build` | ^4.3.3 (match SDK) | Build extensions for `syncEnvVars` | Official Trigger.dev package for deploy-time env var sync. Required -- no alternative for BYOK credential delivery. |
| `@trigger.dev/sdk` | ^4.3.3 (already installed) | Task definitions, logger | Already in use. No changes needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Bun built-in `.env` loading | (bundled) | Auto-loads `.env` files | Dev mode and deploy CLI process. Zero config needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `syncEnvVars` build extension | Dashboard manual entry | Only viable for users with few vars who prefer GUI. Does not scale for BYOK. |
| `syncEnvVars` build extension | `envvars.upload()` SDK call | One-time bulk import only. Does not auto-sync on every deploy. |
| Reading `.env` via Bun | `dotenv` package | Bun loads `.env` natively. Adding dotenv is redundant. |
| Secrets from local files | AWS Secrets Manager / Infisical | Overkill for PSN's single-user BYOK model with local config files. |

**Installation:**
```bash
bun add @trigger.dev/build@^4.3.3
```

**Version constraint:** `@trigger.dev/build` MUST share the same major version (v4) as `@trigger.dev/sdk@^4.3.3`. The trial session hit a version mismatch when installing `@4.4.1` against SDK `@4.3.3` -- pin to `@^4.3.3` to avoid this.

## Architecture Patterns

### Recommended Project Structure
```
trigger.config.ts              # Add build.extensions with syncEnvVars
src/trigger/
  env-validation.ts            # NEW: shared validateRequiredEnvVars() utility
  health.ts                    # MODIFY: use shared validation
  publish-post.ts              # MODIFY: use shared validation
  analytics-collector.ts       # MODIFY: use shared validation
  token-refresher.ts           # MODIFY: use shared validation
  ... (all 13 tasks)           # MODIFY: use shared validation
```

### Pattern 1: syncEnvVars Build Extension
**What:** Deploy-time hook that reads local env vars and pushes them to Trigger.dev Cloud.
**When to use:** Every `bunx trigger.dev deploy` invocation.
**Example:**
```typescript
// trigger.config.ts
// Source: https://trigger.dev/docs/config/extensions/syncEnvVars
import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  runtime: "bun",
  project: "<your-project-ref>",
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
  maxDuration: 300,
  build: {
    extensions: [
      syncEnvVars(async (ctx) => {
        // Runs on dev machine during `bunx trigger.dev deploy`.
        // process.env is populated by Bun's native .env loading
        // OR by `--env-file` flag on the deploy command.
        const envVars = getRequiredEnvVars();
        console.log(`Syncing ${envVars.length} env vars to Trigger.dev Cloud (${ctx.environment})`);
        for (const v of envVars) {
          console.log(`  ${v.name}: ${v.value ? "***" : "MISSING"}`);
        }
        return envVars;
      }),
    ],
  },
});
```

### Pattern 2: Shared Env Var Validation
**What:** A reusable function that validates ALL required env vars and returns actionable error.
**When to use:** At the start of every trigger task's `run()` function.
**Example:**
```typescript
// src/trigger/env-validation.ts
import { logger } from "@trigger.dev/sdk";

/** Core env vars required by ALL tasks */
export const CORE_ENV_VARS = ["DATABASE_URL"] as const;

/** Env vars for tasks that decrypt tokens */
export const CRYPTO_ENV_VARS = [...CORE_ENV_VARS, "HUB_ENCRYPTION_KEY"] as const;

/** Platform-specific env vars (only needed by platform tasks) */
export const X_ENV_VARS = ["X_CLIENT_ID", "X_CLIENT_SECRET"] as const;
export const LINKEDIN_ENV_VARS = ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] as const;
export const INSTAGRAM_ENV_VARS = ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"] as const;
export const TIKTOK_ENV_VARS = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] as const;

interface EnvValidationResult {
  valid: boolean;
  values: Record<string, string>;
  missing: string[];
}

/**
 * Validate that all required env vars are present.
 * Returns typed values object on success, throws with actionable message on failure.
 */
export function requireEnvVars(
  varNames: readonly string[],
  context: string
): Record<string, string> {
  const missing = varNames.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    const message = [
      `Missing ${missing.length} required env var(s) for ${context}:`,
      ...missing.map((name) => `  - ${name}`),
      "",
      "To fix: run `bunx trigger.dev deploy` to sync env vars from local config.",
      "Or set them in the Trigger.dev dashboard: https://cloud.trigger.dev",
    ].join("\n");
    logger.error(message);
    throw new Error(message);
  }
  return Object.fromEntries(varNames.map((name) => [name, process.env[name]!]));
}
```

### Pattern 3: Deploy Command with --env-file
**What:** CLI command that hydrates process.env from local files before deploy.
**When to use:** When Bun's native `.env` loading is insufficient (e.g., running from a clean shell or CI).
**Example:**
```bash
# Primary: Bun auto-loads .env, syncEnvVars reads process.env
bunx trigger.dev@latest deploy

# Explicit: if .env is not in the standard location
bunx trigger.dev@latest deploy --env-file .env
```

### Anti-Patterns to Avoid
- **Syncing TRIGGER_SECRET_KEY:** Trigger.dev Cloud sets this automatically. Overwriting it causes task-to-task authentication failures. Only sync application-level vars.
- **Reading files inside syncEnvVars callback:** The callback runs in the CLI process where `process.env` is already populated by Bun's `.env` loading. Reading files manually adds complexity for no benefit. Use `process.env` directly.
- **Wildcard env sync (sync everything):** Only sync vars the code needs. Syncing everything risks pushing sensitive CLI-only vars (like TRIGGER_SECRET_KEY) to the worker environment.
- **Per-task env var validation with different patterns:** Currently tasks use 3+ patterns: throw, return `{ status: "error" }`, silent ignore. Standardize on one pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var delivery to Trigger.dev Cloud | Custom API calls to Trigger.dev REST API | `syncEnvVars` build extension | Official, maintained, handles auth and environment scoping automatically |
| .env file parsing | Custom file parser | Bun's native `.env` loading | Bun reads `.env`, `.env.local`, etc. automatically. Zero code needed. |
| Secret management service integration | Custom vault/secrets SDK wrapper | `process.env` from local files | PSN is BYOK single-user. Secrets managers add complexity without benefit at this scale. |

**Key insight:** The env var delivery problem is already solved by Trigger.dev's `syncEnvVars` extension. The real work is: (1) installing the package, (2) wiring up the config, (3) standardizing validation across 13 tasks.

## Common Pitfalls

### Pitfall 1: Dev/Prod Environment Divergence
**What goes wrong:** `trigger dev` auto-loads `.env` files. `trigger deploy` does NOT inject `.env` into the worker. Tasks work locally, crash in production.
**Why it happens:** Invisible behavior difference between dev and deploy modes.
**How to avoid:** `syncEnvVars` extension explicitly pushes vars at deploy time. Log synced var names during deploy for visibility.
**Warning signs:** Tasks deploy successfully but fail on first invocation with "Missing env vars."

### Pitfall 2: syncEnvVars Overwrites Dashboard Variables
**What goes wrong:** If a user set vars via the Trigger.dev dashboard, `syncEnvVars` overwrites them on next deploy. Dangerous for `HUB_ENCRYPTION_KEY` -- wrong key makes all encrypted DB tokens unreadable.
**Why it happens:** `syncEnvVars` performs a full sync of the returned variables.
**How to avoid:** Document that syncEnvVars is the source of truth. Log which variables are being synced during deploy. Do NOT mix dashboard and syncEnvVars for the same project.
**Warning signs:** "Decryption failed" errors after deploy. Dashboard vars reset after deploy.

### Pitfall 3: Version Mismatch Between SDK and Build Package
**What goes wrong:** Installing `@trigger.dev/build@latest` (e.g., 4.4.1) against `@trigger.dev/sdk@4.3.3` causes type errors or runtime incompatibilities.
**Why it happens:** `bun add @trigger.dev/build` installs latest, which may be ahead of the pinned SDK version.
**How to avoid:** Pin `@trigger.dev/build@^4.3.3` to match the SDK version. The trial session hit exactly this issue.
**Warning signs:** Type errors in `trigger.config.ts`. Deploy fails with "incompatible extension version."

### Pitfall 4: Missing Config File Crashes Deploy
**What goes wrong:** If a user has not run `/psn:setup` yet, `.env` may not exist or may be empty. The `syncEnvVars` callback reads empty `process.env` values and pushes empty strings to Trigger.dev Cloud.
**Why it happens:** No pre-sync validation of required values.
**How to avoid:** In the syncEnvVars callback, validate that critical vars (DATABASE_URL, HUB_ENCRYPTION_KEY) are non-empty. If missing, log a clear message and return an empty array (or throw to abort deploy).
**Warning signs:** Deploy succeeds but tasks still fail with missing env vars.

### Pitfall 5: Inconsistent Task Validation Patterns
**What goes wrong:** Tasks use 3+ different patterns for env var validation. Some throw, some return early with `{ status: "error" }`, some only check 1-2 vars. On missing vars, errors are vague and don't list all missing vars.
**Why it happens:** Each task was written independently with its own validation.
**How to avoid:** Create `requireEnvVars()` utility. All tasks use it. It lists ALL missing vars with actionable guidance.
**Warning signs:** User sees "Missing DATABASE_URL" error, fixes it, then sees "Missing HUB_ENCRYPTION_KEY" -- one var at a time.

## Code Examples

### Complete trigger.config.ts After Modification
```typescript
// Source: Trigger.dev official docs + PSN codebase
import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

// Env vars that deployed workers need. NEVER include TRIGGER_SECRET_KEY.
const SYNC_ENV_VAR_NAMES = [
  // Core (required by all tasks)
  "DATABASE_URL",
  "HUB_ENCRYPTION_KEY",
  // X (Twitter)
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
  // LinkedIn
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  // Instagram
  "INSTAGRAM_APP_ID",
  "INSTAGRAM_APP_SECRET",
  // TikTok
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  // Notifications (optional)
  "WAHA_BASE_URL",
  "WAHA_API_KEY",
  "WAHA_SESSION",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
] as const;

export default defineConfig({
  runtime: "bun",
  project: "<your-project-ref>",
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
  maxDuration: 300,
  build: {
    extensions: [
      syncEnvVars(async (ctx) => {
        const vars: { name: string; value: string }[] = [];
        const missing: string[] = [];

        for (const name of SYNC_ENV_VAR_NAMES) {
          const value = process.env[name];
          if (value) {
            vars.push({ name, value });
          } else {
            missing.push(name);
          }
        }

        // Log what is being synced (names only, never values)
        console.log(`\nSyncing ${vars.length} env vars to Trigger.dev Cloud (${ctx.environment}):`);
        for (const v of vars) {
          console.log(`  + ${v.name}`);
        }
        if (missing.length > 0) {
          console.log(`\nSkipping ${missing.length} unset vars (platform not configured):`);
          for (const name of missing) {
            console.log(`  - ${name}`);
          }
        }

        // Validate critical vars are present
        const critical = ["DATABASE_URL", "HUB_ENCRYPTION_KEY"];
        const missingCritical = critical.filter((n) => !process.env[n]);
        if (missingCritical.length > 0) {
          console.error(`\nERROR: Critical env vars missing: ${missingCritical.join(", ")}`);
          console.error("Run /psn:setup to configure your hub before deploying.");
          throw new Error(`Cannot deploy: missing critical env vars: ${missingCritical.join(", ")}`);
        }

        return vars;
      }),
    ],
  },
});
```

### Shared Env Var Validation Utility
```typescript
// src/trigger/env-validation.ts
import { logger } from "@trigger.dev/sdk";

/**
 * Validate required env vars at task start.
 * Throws with actionable error listing ALL missing variables.
 *
 * @param varNames - Array of required env var names
 * @param taskId - Task identifier for error context
 * @returns Record of env var name to value
 * @throws Error with list of all missing variables and fix instructions
 */
export function requireEnvVars<T extends readonly string[]>(
  varNames: T,
  taskId: string,
): Record<T[number], string> {
  const missing = varNames.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    const lines = [
      `[${taskId}] Missing ${missing.length} required env var(s):`,
      ...missing.map((name) => `  - ${name}`),
      "",
      "Fix: redeploy with `bunx trigger.dev deploy` to sync env vars.",
      "Or set them in Trigger.dev dashboard: https://cloud.trigger.dev",
    ];
    const message = lines.join("\n");
    logger.error(message);
    throw new Error(message);
  }

  return Object.fromEntries(
    varNames.map((name) => [name, process.env[name]!]),
  ) as Record<T[number], string>;
}
```

### Task Usage (Before/After)
```typescript
// BEFORE: publish-post.ts (current -- checks only 2 vars, vague error)
const databaseUrl = process.env.DATABASE_URL;
const encryptionKeyHex = process.env.HUB_ENCRYPTION_KEY;
if (!databaseUrl || !encryptionKeyHex) {
  throw new Error("Missing required env vars: DATABASE_URL, HUB_ENCRYPTION_KEY");
}

// AFTER: publish-post.ts (shared utility, lists ALL missing, actionable)
import { requireEnvVars } from "./env-validation.ts";

const env = requireEnvVars(
  ["DATABASE_URL", "HUB_ENCRYPTION_KEY"] as const,
  "publish-post",
);
const encKey = keyFromHex(env.HUB_ENCRYPTION_KEY);
const db = createHubConnection(env.DATABASE_URL);
```

## Complete Env Var Inventory

Extracted from all 13 trigger tasks in `src/trigger/`:

| Env Var | Required By | Category |
|---------|-------------|----------|
| `DATABASE_URL` | ALL 13 tasks | Core (critical) |
| `HUB_ENCRYPTION_KEY` | publish-post, analytics-collector, token-refresher, trend-poller, trend-collector, engagement-monitor | Core (critical) |
| `X_CLIENT_ID` | analytics-collector, token-refresher | Platform (X) |
| `X_CLIENT_SECRET` | analytics-collector, token-refresher | Platform (X) |
| `LINKEDIN_CLIENT_ID` | analytics-collector, token-refresher | Platform (LinkedIn) |
| `LINKEDIN_CLIENT_SECRET` | analytics-collector, token-refresher | Platform (LinkedIn) |
| `INSTAGRAM_APP_ID` | analytics-collector | Platform (Instagram) |
| `INSTAGRAM_APP_SECRET` | analytics-collector | Platform (Instagram) |
| `TIKTOK_CLIENT_KEY` | analytics-collector, token-refresher | Platform (TikTok) |
| `TIKTOK_CLIENT_SECRET` | analytics-collector, token-refresher | Platform (TikTok) |
| `WAHA_BASE_URL` | notification-dispatcher, digest-compiler | Notifications (optional) |
| `WAHA_API_KEY` | notification-dispatcher, digest-compiler | Notifications (optional) |
| `WAHA_SESSION` | notification-dispatcher, digest-compiler | Notifications (optional, defaults to "default") |
| `TWILIO_ACCOUNT_SID` | notification-dispatcher, digest-compiler | Notifications (optional) |
| `TWILIO_AUTH_TOKEN` | notification-dispatcher, digest-compiler | Notifications (optional) |
| `TWILIO_FROM_NUMBER` | notification-dispatcher, digest-compiler | Notifications (optional) |

**NOT synced (set automatically by Trigger.dev Cloud):**
- `TRIGGER_SECRET_KEY` -- used for task-to-task triggering, set by Trigger.dev Cloud automatically

**Critical vs optional:** `DATABASE_URL` and `HUB_ENCRYPTION_KEY` must be present for ANY task to work. Platform and notification vars are only needed when those platforms/services are enabled. The syncEnvVars callback should sync whatever is available and only fail on missing critical vars.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `resolveEnvVars` | `syncEnvVars` | Trigger.dev v4 changelog | Function was renamed. Old name still referenced in some community posts. |
| Dashboard manual entry | `syncEnvVars` build extension | Trigger.dev v4 | Automates env var delivery. Dashboard still works as fallback. |
| `.env` file in deployment | Build-time sync | Trigger.dev v4 | Deployed workers never see `.env` files. Must use sync or dashboard. |

## Open Questions

1. **syncEnvVars return format: object vs array**
   - What we know: Official docs show array format `{ name, value }[]`. One doc page also mentions object format `{ MY_VAR: "value" }`.
   - What's unclear: Whether object format is officially supported or just implied.
   - Recommendation: Use array format `{ name, value }[]` as shown in the primary docs page. It is unambiguously documented.

2. **Multiple --env-file flags**
   - What we know: `--env-file` is documented for a single file. Bun natively loads `.env` anyway.
   - What's unclear: Whether `--env-file` can be specified multiple times.
   - Recommendation: Rely on Bun's native `.env` loading rather than `--env-file`. Users configure everything in `.env` (or `.env.local`) which Bun auto-loads.

3. **syncEnvVars overwrite behavior**
   - What we know: The extension syncs returned vars to Trigger.dev Cloud. `envvars.upload()` has an `override` parameter.
   - What's unclear: Whether `syncEnvVars` always overwrites or has merge semantics.
   - Recommendation: Treat it as always-overwrite (worst case). Document this clearly. Make syncEnvVars the single source of truth.

## Sources

### Primary (HIGH confidence)
- [Trigger.dev syncEnvVars Extension](https://trigger.dev/docs/config/extensions/syncEnvVars) -- import path, API signature, callback context object, return type
- [Trigger.dev Environment Variables](https://trigger.dev/docs/deploy-environment-variables) -- delivery mechanism, --env-file flag, dashboard vs sync, dev vs deploy behavior
- [Trigger.dev Env Vars SDK Changelog](https://trigger.dev/changelog/env-vars-sdk) -- resolveEnvVars renamed to syncEnvVars
- Codebase analysis: all 13 tasks in `src/trigger/*.ts` grepped for `process.env` usage, full inventory of 16 unique env vars
- Existing `trigger.config.ts` (19 lines, zero env var config, no build extensions)
- `.env.example` (full template of all env vars with documentation)
- `.gitignore` confirms `config/hub.env`, `config/keys.env`, `.hubs/`, `.env` are all git-ignored

### Secondary (MEDIUM confidence)
- Trial session analysis (342 turns) -- exact failure mode when deploying without env vars
- Version mismatch incident: `@trigger.dev/build@4.4.1` vs `@trigger.dev/sdk@4.3.3` (from analysis.json)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `syncEnvVars` is the documented, official solution. Verified import path and API signature against current docs.
- Architecture: HIGH - trigger.config.ts modification is minimal (~30 lines). New env-validation.ts utility is straightforward. All 13 tasks follow same pattern for env var reads.
- Pitfalls: HIGH - 5 pitfalls identified from codebase analysis, official docs, and trial session. All have concrete prevention strategies.

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- Trigger.dev v4 API is mature, unlikely to change within 30 days)
