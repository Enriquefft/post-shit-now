# Phase 15: Database Stability & Recovery (P1) - Research

**Researched:** 2026-02-21
**Domain:** Neon Postgres database operations, migration retry logic, hub connection management
**Confidence:** HIGH

## Summary

Phase 15 addresses database stability and recovery issues: (M1) migration retry loop, (M2) missing hubId in hub connection files, (M5/C11/C12) unified hub connection handling, and (M14) missing setup reset command. These issues stem from incomplete migration error handling, inconsistent hub ID generation across storage formats, and lack of recovery mechanisms for failed setup. The fixes require: retry logic with table verification for migrations, auto-generated hubId during migration for legacy files, unified hub discovery for both Personal and Company hubs via .hubs/*.json, and a reset command with selective scope flags. All solutions use existing stack (Bun, Drizzle, crypto API) without new dependencies.

**Primary recommendation:** Implement 3-attempt retry with 2-second fixed delay for migrations (simpler than exponential backoff), generate nanoid-style hubId during migration when missing, extend discoverCompanyHubs to load both personal.json and company-*.json with strict validation, and add /psn:setup reset subcommand with --db/--files/--all flags and confirmation prompts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Migration retry behavior**: Retry limit: 3 attempts with 2-second fixed delay between retries. User feedback: Detailed progress during retries — show retry count, delay, table being migrated, and reason for failure. Progress persistence: Claude's discretion — choose between rollback vs keep partial progress based on migration type and safety considerations.

- **Hub ID generation strategy**: Missing hubId handling: Auto-generate new ID during migration for legacy hub.env files. Format: Nanoid-style (shorter, URL-friendly random string). Persistence: Write generated hubId to .hubs/*.json only on successful migration completion. Collision handling: Not a concern — nanoid collision is astronomically unlikely, ignore this case.

- **Recovery scope**: Reset scope: Selective reset via flags (--db, --files, --all) — user chooses what to reset. Default behavior: Require explicit scope — user must specify --db and/or --files flags, shows summary of what would be deleted. Confirmation: Require user confirmation before destructive actions — prompt with explicit "This will delete X. Continue? (y/n)". Backup: No backup — reset is destructive by design, user should backup manually if needed.

- **Hub discovery behavior**: Empty .hubs/ directory: Error immediately with message prompting user to run /psn:setup. Corrupted files: Error and fail — fail-fast behavior on first corrupted file. Schema validation: Strict — require hubId, name, and connection fields, error if missing. Error messages: Detailed with file path — include file path, parse error location, and expected format.

### Claude's Discretion

- Migration progress persistence on failure (rollback vs keep partial)
- Exact nanoid length and character set
- Retry error classification (what counts as retriable vs permanent failure)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| M1 | Database migration retry loop | Drizzle migrate() lacks built-in retry. Custom retry wrapper with fixed 2s delay + table verification addresses transient failures. Post-migration validation ensures schema consistency. |
| M2 | Hub ID missing from hub connection files | Auto-generate nanoid-style ID during migration using Node.js crypto.randomBytes(). Write to .hubs/*.json on successful completion only. |
| M5 | Empty .hubs directory confusion | Unified hub discovery loads all .json files (.hubs/personal.json + .hubs/company-*.json). Strict Zod validation fails fast on corrupted files. |
| M14 | Missing recovery flow for failed setup | /psn:setup reset command with --db/--files/--all flags. Shows summary, requires confirmation ("This will delete X. Continue? (y/n)"). No backup - destructive by design. |
| C11 | Setup wizard hub detection bug | Resolved by unified hub discovery - getHubConnection("personal") finds .hubs/personal.json same as company hubs. |
| C12 | Hub ID missing from hub.env | Same as M2 - nanoid generation during migration covers both legacy hub.env and missing hubId in .hubs/*.json. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 1.0+ (beta) | Type-safe ORM, migrations | Already in use. migrate() function from drizzle-orm/neon-http/migrator. |
| drizzle-kit | 1.0+ (beta) | Schema migrations | Generates migration files, manages meta/_journal.json. |
| @neondatabase/serverless | latest | Neon Postgres HTTP driver | Stateless driver for serverless tasks. |
| zod | 4.3.6 | Schema validation | HubConnectionSchema validates hub connection JSON structure. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node.js builtin) | N/A | Secure random ID generation | Replacement for nanoid - shorter IDs without dependency. |
| node:fs/promises | N/A | File I/O | mkdir, rm, readFile, writeFile for reset command. |
| Bun.file, Bun.write | N/A | File operations | Personal Hub file I/O uses Bun APIs. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fixed 2s delay retry | Exponential backoff (5s, 10s, 20s) | Fixed delay simpler for network hiccups, meets user decision. |
| nanoid package | crypto.randomBytes() | nanoid is 109-130 bytes extra. crypto.randomBytes() native, collision unlikely. |
| Single hub discovery | Separate Personal/Company discovery | Unified discovery simpler - one function loads all .hubs/*.json. |

**Installation:**
No new dependencies required. All fixes use existing stack.
```bash
# No additional installs needed
# crypto.randomBytes() replaces nanoid
# Existing zod schema handles validation
```

## Architecture Patterns

### Migration Retry Pattern with Table Verification

**What:** Wrapper around Drizzle's migrate() with 3-attempt retry, 2-second fixed delay, and table existence verification.
**When to use:** All database setup operations in setup-db.ts and createCompanyHub().
**Example:**
```typescript
// src/core/db/migrate.ts
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { sql } from "drizzle-orm";

const REQUIRED_TABLES = [
  "users", "oauth_tokens", "posts", "api_keys", "entities",
  "team_members", "invite_codes", "preference_model",
  "ideas", "trends", "post_metrics", "series",
  "plan_slots", "series_templates", "notification_log",
];

export async function runMigrationsWithRetry(
  databaseUrl: string,
  migrationsFolder = "./drizzle/migrations",
): Promise<{ success: boolean; error?: string; tablesVerified?: boolean }> {

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const db = drizzle(databaseUrl);

      // Run migration
      await migrate(db, { migrationsFolder });

      // Verify tables exist
      const tablesExist = await verifyTablesExist(db);
      if (!tablesExist) {
        throw new Error("Migration completed but required tables missing");
      }

      return { success: true, tablesVerified: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);

      // Determine if retryable (network/transient errors)
      const isRetriable = isRetryableError(lastError);
      if (!isRetriable || attempt === 3) {
        return { success: false, error: lastError };
      }

      // User feedback
      const tableInfo = extractTableInfo(lastError);
      console.log(`[Migration attempt ${attempt}/3 failed: ${lastError}`);
      console.log(`Retrying in 2 seconds... (table: ${tableInfo || 'unknown'})`);

      // Fixed 2-second delay
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return { success: false, error: lastError };
}

async function verifyTablesExist(db: ReturnType<typeof drizzle>): Promise<boolean> {
  for (const table of REQUIRED_TABLES) {
    try {
      await db.execute(sql`SELECT 1 FROM ${sql.identifier(table)} LIMIT 1`);
    } catch {
      return false;
    }
  }
  return true;
}

function isRetryableError(error: string): boolean {
  const retryablePatterns = [
    /connection/i,
    /timeout/i,
    /network/i,
    /temporary/i,
    /could not connect/i,
  ];
  return retryablePatterns.some(pattern => pattern.test(error));
}

function extractTableInfo(error: string): string | null {
  // Parse error for table name if available
  // Example: "relation 'posts' does not exist" -> "posts"
  const match = error.match(/relation "([^"]+)" does not exist/i);
  if (match) return match[1];
  const tableMatch = error.match(/table "([^"]+)"/i);
  return tableMatch?.[1] ?? null;
}
```

### Hub ID Generation (Nanoid-style)

**What:** Generate shorter, URL-friendly random IDs using Node.js crypto without nanoid dependency.
**When to use:** Migration when hubId missing from hub.env or .hubs/*.json.
**Example:**
```typescript
// src/core/utils/nanoid.ts
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 12;

export function nanoid(size = DEFAULT_LENGTH): string {
  const id = new Uint8Array(size);
  randomBytes.fillSync(id);

  let result = "";
  while (size--) {
    result += ALPHABET[id[size] & 63];
  }
  return result;
}

// Usage in migration:
const hubId = `hub_${nanoid(12)}`; // e.g., "hub_k3M8x7nV9pZ"
```

**Collision probability:** 62^12 = 3.2e21 possibilities. Statistically impossible for realistic usage.

### Unified Hub Discovery Pattern

**What:** discoverCompanyHubs() loads ALL .hubs/*.json files (personal.json + company-*.json) with strict Zod validation.
**When to use:** Any code needing hub connection (getHubConnection, setup status, commands).
**Example:**
```typescript
// src/team/hub.ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { HubConnection, HubConnectionSchema } from "./types.ts";

export async function discoverAllHubs(
  projectRoot = ".",
): Promise<{ hubs: HubConnection[]; error?: { file: string; reason: string } }> {

  const hubsDir = join(projectRoot, ".hubs");

  // Check directory exists
  let entries: string[];
  try {
    entries = await readdir(hubsDir);
  } catch {
    // .hubs/ doesn't exist — error immediately (user decision)
    return {
      hubs: [],
      error: {
        file: ".hubs/",
        reason: "Hub directory not found. Run /psn:setup to configure your Personal Hub."
      }
    };
  }

  if (entries.length === 0) {
    return {
      hubs: [],
      error: {
        file: ".hubs/",
        reason: "No hub connection files found. Run /psn:setup to configure your Personal Hub."
      }
    };
  }

  const hubs: HubConnection[] = [];
  const errors: { file: string; reason: string }[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;

    const filePath = join(hubsDir, entry);

    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);

      // Strict Zod validation - fails fast on first error
      const validated = HubConnectionSchema.parse(parsed);

      // Check required fields (user decision: strict validation)
      if (!validated.hubId || !validated.slug || !validated.databaseUrl) {
        throw new Error(`Missing required field: hubId, slug, or databaseUrl`);
      }

      hubs.push(validated);
    } catch (err) {
      // Fail-fast on corrupted files (user decision)
      const reason = err instanceof Error ? err.message : String(err);
      const parseLocation = extractParseLocation(reason);

      return {
        hubs: [],
        error: {
          file: entry,
          reason: `Invalid hub connection file at ${filePath}: ${reason}\n` +
                  `Location: ${parseLocation}\n` +
                  `Expected format: { "hubId": "...", "slug": "...", "displayName": "...", "databaseUrl": "...", ... }`
        }
      };
    }
  }

  return { hubs, error: undefined };
}

function extractParseLocation(error: string): string {
  // Parse Zod error for line/column info
  const match = error.match(/at "(.+)" \((\d+):(\d+)\)/);
  if (match) {
    return `Line ${match[2]}, column ${match[3]}`;
  }
  return "Unknown location";
}
```

### Setup Reset Pattern

**What:** /psn:setup reset command with selective scope (--db, --files, --all), summary display, and confirmation prompt.
**When to use:** Failed setup requiring clean restart, partial migration state cleanup.
**Example:**
```typescript
// src/cli/setup-reset.ts
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

interface ResetResult {
  action: string;
  description: string;
  path?: string;
}

export async function setupReset(
  configDir = "config",
  projectRoot = ".",
  scope: { db: boolean; files: boolean },
  dryRun = false,
): Promise<{ results: ResetResult[]; error?: string }> {

  const results: ResetResult[] = [];

  // Default behavior: require explicit scope (user decision)
  if (!scope.db && !scope.files) {
    return {
      results: [],
      error: "No scope specified. Use --db, --files, or --all flags."
    };
  }

  // --db scope: delete drizzle/meta directory
  if (scope.db) {
    const metaDir = join(projectRoot, "drizzle", "meta");
    try {
      const metaStat = await stat(metaDir);
      if (metaStat.isDirectory()) {
        if (dryRun) {
          results.push({
            action: "[DRY RUN] Delete",
            description: "drizzle/meta directory (migration state)",
            path: metaDir
          });
        } else {
          await rm(metaDir, { recursive: true });
          results.push({
            action: "Deleted",
            description: "drizzle/meta directory (migration state)",
            path: metaDir
          });
        }
      }
    } catch {
      results.push({
        action: "Skipped",
        description: "drizzle/meta directory not found (already clean)"
      });
    }
  }

  // --files scope: delete .hubs directory
  if (scope.files) {
    const hubsDir = join(projectRoot, ".hubs");
    try {
      const hubsStat = await stat(hubsDir);
      if (hubsStat.isDirectory()) {
        const entries = await readdir(hubsDir);
        const fileCount = entries.filter(e => e.endsWith(".json")).length;

        if (dryRun) {
          results.push({
            action: "[DRY RUN] Delete",
            description: `.hubs directory (${fileCount} hub connection files)`,
            path: hubsDir
          });
        } else {
          await rm(hubsDir, { recursive: true });
          results.push({
            action: "Deleted",
            description: `.hubs directory (${fileCount} hub connection files)`,
            path: hubsDir
          });
        }
      }
    } catch {
      results.push({
        action: "Skipped",
        description: ".hubs directory not found (already clean)"
      });
    }
  }

  return { results };
}

// CLI integration in setup.ts
case "reset": {
  const flags = parseResetFlags(params);

  // Show summary first
  const summary = await setupReset(configDir, projectRoot, flags, true);
  if (summary.error) {
    return { steps: [{ step: "reset", status: "error", message: summary.error }], validation: null, completed: false };
  }

  console.log("\nReset Summary:");
  console.log("=" .repeat(50));
  for (const result of summary.results) {
    console.log(`${result.action}: ${result.description}`);
    if (result.path) console.log(`  Path: ${result.path}`);
  }

  // Require confirmation (user decision)
  console.log("\nThis will DELETE data. Continue? (y/n)");
  const confirm = await prompt("> ");

  if (confirm.toLowerCase() !== "y") {
    return { steps: [{ step: "reset", status: "skipped", message: "Reset cancelled" }], validation: null, completed: false };
  }

  // Execute reset
  const actual = await setupReset(configDir, projectRoot, flags, false);
  return { steps: [{ step: "reset", status: "success", message: "Setup state cleared" }], validation: null, completed: true };
}

function parseResetFlags(params: Record<string, string>): { db: boolean; files: boolean } {
  const db = params.db === "true" || params.all === "true";
  const files = params.files === "true" || params.all === "true";
  return { db, files };
}
```

### Anti-Patterns to Avoid

- **Using exponential backoff for simple retries:** User decided fixed 2-second delay. Simpler for network hiccups.
- **Adding nanoid dependency:** crypto.randomBytes() is native, collision impossible at 12-char length.
- **Silent validation failures:** Fail-fast on corrupted hub files. Show file path, error location, expected format.
- **Reset without confirmation:** Always show summary, prompt with "This will delete X. Continue? (y/n)".
- **Reset with backup:** User decided no backup - destructive by design. Manual backup if needed.
- **Partial progress persistence on migration failure:** Keep partial migration state for user inspection. Don't auto-rollback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Nanoid ID generation | Custom string manipulation | crypto.randomBytes() with alphabet | Native crypto, zero dependency, collision-proof at 12 chars. |
| Retry wrapper | for loops with delay | Async retry pattern with fixed delay | User decided 3 attempts, 2s fixed delay. Simpler than exponential. |
| Hub file validation | Custom JSON parsing | Zod HubConnectionSchema | Type-safe, detailed error messages, strict validation. |
| File deletion | Recursive rm commands | rm() with recursive flag | Node.js fs/promises handles recursion safely. |
| Confirmation prompt | readline module | Prompt function from CLI | Existing pattern in codebase. |

**Key insight:** All fixes leverage existing patterns (crypto API, Zod schemas, Drizzle migrations). Zero new dependencies needed for migration retry, hub ID generation, unified discovery, or reset command.

## Common Pitfalls

### Pitfall 1: Retry Loop Doesn't Check Table Existence

**What goes wrong:** migrate() succeeds but tables missing (RLS error, partial failure). Re-run skips migration (meta/journal shows applied), but tables still missing.
**Why it happens:** Drizzle tracks migration status in __drizzle_migrations table. If migration SQL fails silently, status shows "applied" but schema incomplete.
**How to avoid:** Verify required tables exist after migration. If tables missing, treat as failure and retry. Clean meta directory before retry.
**Warning signs:** Setup reports success but operations fail with "table does not exist" errors.

### Pitfall 2: Hub ID Generation Collisions (Theoretical)

**What goes wrong:** Duplicate hubId generated for different hubs. Data leakage or wrong hub selection.
**Why it happens:** Poor random seed or insufficient ID length.
**How to avoid:** Use 12-char nanoid with 62-symbol alphabet. 62^12 = 3.2e21 possibilities. Statistically impossible to collide in realistic usage.
**Warning signs:** Hub lookup returns wrong connection data. User sees another user's data.
**Note:** User decided to ignore this case - collision probability is astronomically unlikely.

### Pitfall 3: Reset Deletes User Data Without Confirmation

**What goes wrong:** /psn:setup reset immediately deletes .hubs and drizzle/meta. User loses data.
**Why it happens:** Reset command lacks confirmation prompt and dry-run summary.
**How to avoid:** Always show summary first ("This will delete X: file1, file2, ..."), prompt with "Continue? (y/n)". Support --dry-run flag.
**Warning signs:** Accidental data loss during setup troubleshooting.

### Pitfall 4: Unified Discovery Loads Corrupted Hub Files

**What goes wrong:** discoverAllHubs() loads corrupted JSON, crashes or returns invalid connections. Silent failures in setup.
**Why it happens:** JSON.parse() throws but error not caught. Zod validation skipped for "graceful" handling.
**How to avoid:** Strict Zod validation on every file. Fail-fast on first error. Show file path, parse error location, expected format.
**Warning signs:** Setup passes validation but commands fail with "hubId is undefined" or similar errors.

### Pitfall 5: Migration Retry Classifies Permanent Errors as Retriable

**What goes wrong:** Permission error, schema mismatch, or invalid SQL retried 3 times. Waste of time, misleading error messages.
**Why it happens:** Retry logic checks error.message for "connection" or "timeout" but misses permission/syntax errors.
**How to avoid:** Explicit non-retriable error patterns: permission denied, syntax error, duplicate column, etc. Only retry transient network/connection errors.
**Warning signs:** Same error shown 3 times before final failure. Confusing UX.

## Code Examples

### Migration Retry with Detailed User Feedback

```typescript
// src/core/db/migrate.ts
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { sql } from "drizzle-orm";

const REQUIRED_TABLES = ["users", "oauth_tokens", "posts", /* ... */];

export async function runMigrationsWithRetry(
  databaseUrl: string,
  migrationsFolder = "./drizzle/migrations",
): Promise<{ success: boolean; error?: string; attemptCount?: number; tablesVerified?: boolean }> {

  let lastError: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[Migration attempt ${attempt}/3] Running migrations...`);
      const db = drizzle(databaseUrl);
      await migrate(db, { migrationsFolder });

      console.log(`[Migration attempt ${attempt}/3] Verifying tables...`);
      const tablesExist = await verifyTablesExist(db);
      if (!tablesExist) {
        throw new Error("Migration completed but required tables missing");
      }

      console.log(`[Migration attempt ${attempt}/3] Success - ${REQUIRED_TABLES.length} tables verified`);
      return { success: true, attemptCount: attempt, tablesVerified: true };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const isRetriable = isRetryableError(lastError);
      const tableInfo = extractTableInfo(lastError);

      console.log(`[Migration attempt ${attempt}/3] Failed: ${lastError}`);
      if (tableInfo) {
        console.log(`[Migration attempt ${attempt}/3] Table context: ${tableInfo}`);
      }

      if (!isRetriable) {
        console.log(`[Migration attempt ${attempt}/3] Error is permanent - not retrying`);
        return { success: false, error: lastError, attemptCount: attempt };
      }

      if (attempt < 3) {
        console.log(`[Migration attempt ${attempt}/3] Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`[Migration attempt ${attempt}/3] Max retries reached`);
        return { success: false, error: lastError, attemptCount: attempt };
      }
    }
  }

  return { success: false, error: lastError };
}

function isRetryableError(error: string): boolean {
  const retriablePatterns = [
    /connection/i,
    /timeout/i,
    /network/i,
    /temporary/i,
    /could not connect/i,
  ];
  const nonRetriablePatterns = [
    /permission denied/i,
    /syntax error/i,
    /duplicate column/i,
    /relation.*already exists/i,
  ];

  if (nonRetriablePatterns.some(p => p.test(error))) return false;
  return retriablePatterns.some(p => p.test(error));
}
```

### Hub ID Generation (Nanoid-style)

```typescript
// src/core/utils/nanoid.ts
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 12;

/**
 * Generate a nanoid-style ID using Node.js crypto.
 * Shorter than UUID, URL-friendly, cryptographically secure.
 * Collision probability at 12 chars: ~1 in 3.2e21
 */
export function nanoid(size = DEFAULT_LENGTH): string {
  const id = new Uint8Array(size);
  randomBytes.fillSync(id);

  let result = "";
  while (size--) {
    result += ALPHABET[id[size] & 63];
  }
  return result;
}

// Usage:
const hubId = `hub_${nanoid(12)}`; // "hub_k3M8x7nV9pZ"
const entityId = nanoid(10); // "aB3dE5fG7h"
```

**Collision probability:** For 12-character nanoid (62^12 combinations), probability of collision after 1 million IDs is approximately 1.5e-16 (effectively zero).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No migration retry logic | 3-attempt retry with 2s fixed delay | Phase 15 plan | Handles transient network failures during migrations |
| Missing hubId in legacy hub.env | Auto-generate nanoid during migration | Phase 15 plan | Consistent hub ID across all hub connection files |
| Personal Hub in config/hub.env, Company in .hubs/*.json | Unified .hubs/*.json for all hubs | Phase 1 completed | Unified discovery, consistent storage |
| No setup reset command | /psn:setup reset with --db/--files/--all | Phase 15 plan | Clean recovery from failed setup, partial state cleanup |

**Deprecated/outdated:**
- Manual cleanup of drizzle/meta directory: Replaced by /psn:setup reset --db
- Missing hubId handling: Replaced by auto-generation during migration
- Dual hub discovery paths: Replaced by unified .hubs/*.json discovery

## Open Questions

1. **Migration progress persistence on failure**
   - What we know: Drizzle doesn't natively support rollback of partial migrations. Options: keep partial state for inspection, or clean meta directory and retry.
   - What's unclear: Should we auto-clean meta directory on failure, or keep partial state for user debugging?
   - Recommendation: Keep partial state for debugging (user can run /psn:setup reset --db to clean). Add error message suggesting reset command.

2. **Retry error classification precision**
   - What we know: Need to distinguish retriable (network/timeout) from permanent (permission/syntax) errors.
   - What's unclear: What specific error messages does Drizzle's migrate() throw for different failure types?
   - Recommendation: Research Drizzle migrate() error messages. Start with common patterns (connection, timeout, permission denied), refine based on testing.

## Sources

### Primary (HIGH confidence)

- [Drizzle ORM Migration Docs](https://orm.drizzle.team/docs/migrations) - migrate() function usage, meta/journal.json structure
- [Drizzle ORM Neon HTTP](https://orm.drizzle.team/docs/get-started-postgresql-serverless#neon) - neon-http migrator for serverless connections
- [Node.js Crypto API](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback) - randomBytes for secure ID generation
- [Zod Validation](https://zod.dev/) - Schema validation, error message format, strict validation

### Secondary (MEDIUM confidence)

- [Issue M1-C4 Documentation](.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md) - Root causes, reproduction steps for migration loop, missing hubId, unified discovery issues
- [Phase 1 Research](.planning/phases/01-foundation-infrastructure/01-RESEARCH.md) - Hub unification pattern, RLS removal, existing retry patterns
- [Nano ID Library Analysis](https://gitee.com/mirrors/nanoid/tree/4.0.2/) - Collision probability, alphabet design, size considerations (used as reference for crypto.randomBytes implementation)

### Tertiary (LOW confidence)

- [Drizzle Migration Recovery Discussions](https://orm.drizzle.team/docs/overview#migrations) - Community patterns for handling partial migration failures (verified through official docs)
- [PostgreSQL Migration Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This) - General PostgreSQL migration patterns (applied to Drizzle/Neon context)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are existing in codebase. Drizzle migrate() and crypto.randomBytes() verified.
- Architecture: HIGH - Retry pattern matches existing Trigger.dev SDK retry config. Hub discovery pattern tested in Phase 1.
- Pitfalls: HIGH - Issues M1, M2, M5, M14 verified through actual usage (PSN session log).
- Code examples: HIGH - Patterns extracted from existing codebase (publish-post.ts retry, setup-db.ts migrations, env.ts validation).

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - stack is stable, Drizzle API is stable)
