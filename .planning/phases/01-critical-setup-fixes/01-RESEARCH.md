# Phase 1: Critical Setup Fixes - Research

**Researched:** 2026-02-20
**Domain:** Setup wizard bugs, database migrations, API key validation
**Confidence:** HIGH

## Summary

Phase 1 addresses four critical bugs that block users from completing setup:

1. **Hub detection bug (C1)** - setup.ts uses `getHubConnection()` for Personal Hub, but Personal Hub is stored in `config/hub.env` (loaded via `loadHubEnv()`), not `.hubs/*.json` files (loaded via `getHubConnection()`)

2. **RLS policy error (C2, M16)** - Schema defines `pgRole("hub_user").existing()` but the role doesn't exist in Neon, causing migration failures. Current CONTEXT.md decision is to use Neon's native RLS with Drizzle configuration.

3. **Provider keys table missing (C3)** - Caused by RLS policy failure preventing table creation. After fixing RLS, table should be created normally.

4. **Neon API key permission error (C4)** - Project-scoped keys (starting with `napi_re4y...`) cannot create projects. Organization-scoped keys (starting with `napi_kjk...`) are required.

**Primary recommendation:** Follow the CONTEXT.md decisions exactly: use Neon's official RLS/Drizzle guide, validate API keys with minimal API calls, unify hub storage to `.hubs/*.json` format.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### RLS Strategy
- **Use Neon RLS configured from Drizzle** — Follow official Neon/Drizzle RLS guide
- **Fail setup if RLS fails** — Do not fallback to app-level filtering
- **Apply RLS to all tables or fail entirely** — Maximum security, high failure risk but clear expectations
- Reference: https://neon.com/docs/guides/rls-drizzle

#### API Key Validation
- **Detect proactively AND show clear errors** — Both approaches combined
- **Validate via API call** — Make minimal API call (e.g., list projects) to validate key
- **Apply to all provider keys** — Extend validation framework to Trigger.dev, Perplexity, Anthropic, etc., not just Neon

#### Hub Connection Strategy
- **Unify storage to .hubs/*.json** — Move Personal Hub from config/hub.env to .hubs/personal.json
- **No backward compatibility needed** — No current users, all breaking changes allowed
- **Use getHubConnection() for all hubs** — Unified API, all hubs accessed through same function

### Claude's Discretion

From CONTEXT.md:
- RLS policy implementation details in Drizzle schema
- Exact API validation endpoints for each provider
- Error message wording and tone (be specific and actionable)
- Hub connection caching strategy (if any)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | Latest | Schema definitions, migrations, type-safe queries | Official Drizzle ORM with Neon HTTP driver integration |
| @neondatabase/serverless | Latest | Neon Postgres connection pooling | Recommended driver for serverless environments |
| Drizzle Kit | Latest | Migration generation/push commands | Official CLI tool for Drizzle |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto | Built-in | UUID generation, encryption keys | Standard Node.js crypto API |
| node:fs/promises | Built-in | File operations | Modern promise-based file API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drizzle Kit | Prisma Migrate | Prisma has built-in rollback, but Drizzle is project standard |
| Neon HTTP Driver | PgBouncer | HTTP driver simpler for serverless, pooling for long-running processes |

**Installation:**
```bash
# All dependencies already in package.json
bun install drizzle-orm drizzle-kit @neondatabase/serverless
```

---

## Architecture Patterns

### Hub Storage Pattern

**Recommended:** All hubs stored as JSON files in `.hubs/` directory

**File Structure:**
```
.hubs/
├── personal.json          # Personal Hub configuration
├── company-1.json       # Company Hub 1
└── company-2.json       # Company Hub 2
```

**Hub Connection JSON Format:**
```typescript
interface HubConnection {
  hubId: string;              // e.g., "hub_abc123def"
  slug: string;               // "personal" or company slug
  displayName: string;         // Human-readable name
  databaseUrl: string;         // PostgreSQL connection string
  triggerProjectId: string;   // Trigger.dev project ref
  encryptionKey: string;       // Encryption key for sensitive data
  role: "admin" | "member"; // User's role in hub
  joinedAt: string;           // ISO timestamp
}
```

**Function Pattern:**
```typescript
// In src/team/hub.ts
export async function getHubConnection(
  projectRoot: string,
  slug: string
): Promise<HubConnection | null> {
  const hubsDir = join(projectRoot, ".hubs");
  const hubFile = join(hubsDir, `${slug}.json`);

  if (!await exists(hubFile)) {
    return null;
  }

  const content = await Bun.file(hubFile).text();
  return HubConnectionSchema.parse(JSON.parse(content));
}
```

### Migration Pattern with RLS

**Neon + Drizzle RLS Workflow:**

1. **Define custom role in schema:**
```typescript
// In src/core/db/schema.ts
export const hubUser = pgRole("hub_user").existing();
```

2. **Apply RLS policies to tables:**
```typescript
export const apiKeys = pgTable(
  "api_keys",
  {
    userId: text("user_id").notNull(),
    service: text("service").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    // ...
  },
  (table) => [
    pgPolicy("api_keys_isolation", {
      as: "permissive",
      to: hubUser,
      for: "all",
      using: sql`${table.userId} = current_setting('app.current_user_id')`,
      withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
    }),
  ],
);
```

3. **Create role in migration:**
```sql
-- In drizzle/migrations/XXXX_setup_rls.sql

-- Create the hub_user role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hub_user') THEN
    CREATE ROLE hub_user;
    GRANT USAGE ON SCHEMA public TO hub_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hub_user;
  END IF;
END $$;
```

4. **Set context at connection start:**
```typescript
// In src/core/db/connection.ts or before queries
await db.execute(`SET app.current_user_id = '${userId}'`);
```

**Critical Requirement:** Role must exist BEFORE RLS policies can be applied. Migration must create role first, then apply schema with RLS policies.

### API Key Validation Pattern

**Validation Framework:**

```typescript
// In src/cli/setup-keys.ts

interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
}

async function validateNeonApiKey(apiKey: string): Promise<ValidationResult> {
  // Check 1: Prefix detection
  if (apiKey.startsWith("napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09")) {
    return {
      valid: false,
      error: "Project-scoped key detected",
      suggestion: "Generate an organization-scoped API key from Neon Console → Account → API Keys. Organization keys start with: napi_k..."
    };
  }

  // Check 2: API validation (make minimal API call)
  try {
    const response = await fetch("https://console.neon.tech/api/v1/projects", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      return {
        valid: false,
        error: "API key authentication failed",
        suggestion: "Verify API key is correct and not expired. Regenerate from Neon Console if needed."
      };
    }

    // Success: key can list projects
    return { valid: true };
  } catch (error) {
    // Network error - can't validate, but show helpful message
    return {
      valid: false,
      error: "Could not validate API key with Neon API",
      suggestion: "Check your internet connection or try again later. The key may be valid but validation failed due to network issues."
    };
  }
}
```

**Extend to all providers:**

```typescript
// Map of provider validation functions
const VALIDATORS: Record<string, (key: string) => Promise<ValidationResult>> = {
  neon: validateNeonApiKey,
  trigger: validateTriggerApiKey,
  perplexity: validatePerplexityApiKey,
  anthropic: validateAnthropicApiKey,
  // ... other providers
};

async function validateProviderKey(service: string, key: string): Promise<ValidationResult> {
  const validator = VALIDATORS[service];
  if (!validator) {
    return { valid: true }; // No validator defined, assume valid
  }
  return await validator(key);
}
```

### Anti-Patterns to Avoid

- **Mixing hub storage mechanisms** - Personal Hub in config/hub.env, Company Hubs in .hubs/*.json is confusing. Use ONE mechanism.
- **Assuming role exists** - `pgRole("hub_user").existing()` fails if role wasn't created. Always create role in migration BEFORE using it.
- **Validating only by prefix** - Prefix checking is good, but API validation catches expired/invalid keys that prefixes miss.
- **Silent RLS failures** - If RLS policies can't be applied, fail setup immediately. Don't continue with partial security.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hub connection management | Custom file parsing logic | `getHubConnection()` from src/team/hub.ts | Existing function handles JSON parsing, validation, and error handling |
| Database migrations | Manual SQL execution | `runMigrations()` from src/core/db/migrate.ts | Drizzle's official migration function handles meta tracking, rollback, state management |
| API key validation | Custom regex only | Fetch to provider API | Prefix checks are good first line of defense, but API validation catches edge cases (expired keys, permission changes) |
| Encryption key generation | Custom crypto logic | `generateEncryptionKey()` from src/core/utils/crypto.ts | Existing function uses proper crypto.randomBytes for secure key generation |
| Environment file parsing | Manual split/trim logic | `parseEnvFile()` from src/core/utils/env.ts | Handles quotes, comments, whitespace correctly |

**Key insight:** The codebase already has well-tested utilities. Leverage them instead of rebuilding. Focus on fixing integration bugs, not reimplementing existing patterns.

---

## Common Pitfalls

### Pitfall 1: RLS Role Not Created Before Policy Application

**What goes wrong:** Schema defines `pgRole("hub_user").existing()` but migrations don't create the role first. Drizzle generates SQL with policies that reference non-existent role, causing migration failure.

**Why it happens:** `.existing()` tells Drizzle "this role should already exist" but doesn't ensure it exists. Neon doesn't have a pre-created `hub_user` role.

**How to avoid:**
1. Create a dedicated migration file to set up RLS role
2. Place it BEFORE schema migration files (e.g., `0000_setup_rls_role.sql`)
3. Create role, grant permissions, then apply schema with RLS policies

**Warning signs:**
- Migration fails with `role 'hub_user' does not exist`
- Error in `drizzle/migrations` SQL files referencing `hub_user`

**Correct migration order:**
```sql
-- drizzle/migrations/0000_setup_rls_role.sql
-- Run FIRST to create role

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hub_user') THEN
    CREATE ROLE hub_user;
    GRANT USAGE ON SCHEMA public TO hub_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hub_user;
  END IF;
END $$;

-- drizzle/migrations/0001_schema.sql
-- Run AFTER role exists - this file references hub_user in pgRole().existing()
-- [Generated by Drizzle - will reference hub_user role]
```

### Pitfall 2: Hub Connection API Mismatch

**What goes wrong:** Code uses `getHubConnection()` for Personal Hub (looks in `.hubs/*.json`) but Personal Hub is stored in `config/hub.env` (loaded via `loadHubEnv()`).

**Why it happens:** Inconsistent storage mechanism evolved over time. Personal Hub was first, Company Hubs came later with different storage approach. Code wasn't unified.

**How to avoid:** Per CONTEXT.md decision - move Personal Hub to `.hubs/personal.json` and use `getHubConnection()` for ALL hubs.

**Warning signs:**
- setup.ts shows "Personal Hub configured" but `/psn:setup voice` fails with "Personal Hub not configured"
- Error: `No connection found for hub "personal"` from `getHubConnection()`

**Resolution:**
```typescript
// In src/cli/setup.ts - voice/entity subcommands
case "voice":
case "entity":
  // OLD: const connection = await getHubConnection(projectRoot, "personal");
  // NEW: const connection = await getHubConnection(projectRoot, "personal");
  // BUT: Must first migrate Personal Hub to .hubs/personal.json
  break;
```

**Migration script needed:**
```typescript
// One-time migration to move config/hub.env to .hubs/personal.json
export async function migratePersonalHubToHubsDir(configDir: string, projectRoot: string) {
  const hubEnvPath = join(configDir, "hub.env");
  if (!await exists(hubEnvPath)) return; // Already migrated

  const content = await Bun.file(hubEnvPath).text();
  const env = parseEnvFile(content);

  const hubConnection: HubConnection = {
    hubId: env.HUB_ID || "default",
    slug: "personal",
    displayName: "Personal Hub",
    databaseUrl: env.DATABASE_URL,
    triggerProjectId: env.TRIGGER_PROJECT_REF || "",
    encryptionKey: env.HUB_ENCRYPTION_KEY || "",
    role: "admin",
    joinedAt: new Date().toISOString(),
  };

  const hubsDir = join(projectRoot, ".hubs");
  await ensureDir(hubsDir);

  const personalHubPath = join(hubsDir, "personal.json");
  await Bun.write(personalHubPath, JSON.stringify(hubConnection, null, 2));

  // Delete old hub.env
  await rm(hubEnvPath);

  console.log("Personal Hub migrated to .hubs/personal.json");
}
```

### Pitfall 3: API Key Validation Only Checks Prefix

**What goes wrong:** Validation only checks if key starts with `napi_` but doesn't verify key actually works. Expired keys or keys with wrong permissions pass prefix check.

**Why it happens:** Developer assumes prefix pattern is sufficient validation. Real API validation is more reliable.

**How to avoid:** Combine prefix check (fast rejection) with API validation (confirmation).

**Warning signs:**
- Setup accepts invalid key that fails later during database creation
- Error "project-scoped keys are not allowed to create projects" appears AFTER validation passes

**Validation flow:**
```typescript
async function validateApiKeyWithFallback(key: string): Promise<ValidationResult> {
  // Step 1: Fast prefix check (immediate feedback)
  if (key.startsWith("napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09")) {
    return {
      valid: false,
      error: "Project-scoped key detected",
      suggestion: "Use organization-scoped key (starts with napi_k...)"
    };
  }

  // Step 2: API validation (actual verification)
  try {
    const response = await fetch("https://console.neon.tech/api/v1/projects", {
      headers: { "Authorization": `Bearer ${key}` },
    });

    if (!response.ok) {
      return {
        valid: false,
        error: `API validation failed: ${response.status}`,
        suggestion: "Check if key is correct and has project creation permissions"
      };
    }

    return { valid: true };
  } catch (error) {
    // Network error - can't validate, but don't fail hard
    return {
      valid: true, // Assume valid if we can't verify
      warning: `Could not validate with Neon API: ${error.message}`
    };
  }
}
```

### Pitfall 4: Migration Meta Files Out of Sync

**What goes wrong:** Drizzle's `drizzle/meta/_journal.json` gets corrupted or out of sync, causing `migrate` to skip migrations or fail.

**Why it happens:**
- Migration interrupted partway through
- Manual edits to migration files
- Git merge conflicts in `_journal.json`
- Failed migration doesn't update meta properly

**How to avoid:**
1. Always use `drizzle-kit generate` for migrations (never hand-edit)
2. Resolve merge conflicts in `_journal.json` carefully
3. If migration fails, clean up state before retrying

**Warning signs:**
- `drizzle-kit migrate` reports "no migrations to apply" but database schema differs
- Error: `Can't find meta/_journal.json`
- Migration ID conflicts (multiple `0004_*.sql` files)

**Recovery:**
```bash
# Clean up corrupted state
rm -rf drizzle/meta/_journal.json

# Regenerate from current database state
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate
```

---

## Code Examples

Verified patterns from existing codebase:

### 1. Hub Connection Loading

**Source:** `/home/hybridz/Projects/post-shit-now/src/team/hub.ts`

```typescript
// Current implementation for Company Hubs
export async function getHubConnection(
  projectRoot: string,
  slug: string
): Promise<HubConnection | null> {
  const hubsDir = join(projectRoot, ".hubs");
  const hubFile = join(hubsDir, `${slug}.json`);

  const file = Bun.file(hubFile);
  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  const parsed = JSON.parse(content);

  return HubConnectionSchema.parse(parsed);
}
```

**Usage in Phase 1 fix (C1):**
```typescript
// In src/cli/setup.ts - after migrating to unified storage
case "voice":
case "entity":
  const connection = await getHubConnection(projectRoot, "personal");
  if (!connection) {
    return {
      step: subcommand,
      status: "error",
      message: `No connection found for hub "personal"`,
    };
  }
  // ... continue with connection
```

### 2. RLS Role Creation in Migration

**Pattern:** Create role BEFORE schema defines `.existing()` reference

```sql
-- drizzle/migrations/0000_create_rls_role.sql
-- Must run BEFORE 0001_schema.sql which references hub_user

DO $$
BEGIN
  -- Check if role exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'hub_user'
  ) THEN
    -- Create role
    CREATE ROLE hub_user;

    -- Grant permissions
    GRANT USAGE ON SCHEMA public TO hub_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hub_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hub_user;

    -- Log creation
    RAISE NOTICE 'Created hub_user role for RLS policies';
  END IF;
END $$;
```

**Followed by schema migration (generated by Drizzle):**
```sql
-- drizzle/migrations/0001_schema.sql
-- This file contains pgRole("hub_user").existing() references
-- Generated by: npx drizzle-kit generate
```

### 3. API Key Validation with Fetch

**Source:** Existing `loadKeysEnv` pattern + new validation

```typescript
// In src/cli/setup-keys.ts

async function validateNeonKey(apiKey: string): Promise<ValidationResult> {
  // Fast check: prefix
  if (apiKey.startsWith("napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09")) {
    return {
      valid: false,
      error: "Project-scoped key detected",
      suggestion: "Generate an organization-scoped key from Neon Console → Account → API Keys. Organization keys start with: napi_k..."
    };
  }

  // Actual validation: API call
  try {
    const response = await fetch("https://console.neon.tech/api/v1/projects", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
    });

    if (response.status === 401) {
      return {
        valid: false,
        error: "API key invalid or expired",
        suggestion: "Regenerate API key from Neon Console."
      };
    }

    if (response.status === 403) {
      return {
        valid: false,
        error: "API key lacks project creation permissions",
        suggestion: "Use an organization-scoped API key with project creation permissions."
      };
    }

    // Success: can list projects, key is valid
    return { valid: true };
  } catch (error) {
    // Network failure - don't fail hard, just warn
    return {
      valid: true, // Assume valid if can't verify
      warning: `Could not validate API key: ${error.message}`
    };
  }
}
```

### 4. Migration Execution with Error Handling

**Source:** `/home/hybridz/Projects/post-shit-now/src/core/db/migrate.ts`

```typescript
// Current implementation
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = "./drizzle/migrations",
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = drizzle(databaseUrl);
    await migrate(db, { migrationsFolder });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

**Usage in setup-db.ts (with better error messaging):**
```typescript
const migrateResult = await runMigrations(connectionUri);
if (!migrateResult.success) {
  return {
    step: "database",
    status: "error",
    message: `Database created but migrations failed: ${migrateResult.error}`,
    data: {
      error: migrateResult.error,
      suggestion: "If this is an RLS role error, create hub_user role manually or regenerate migrations."
    }
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Personal Hub in config/hub.env | Personal Hub in .hubs/personal.json | Phase 1 | Unified hub storage, single API |
| No API key validation | Prefix + API validation | Phase 1 | Catches incorrect key types early |
| RLS role assumed exists | Migration creates role first | Phase 1 | Migrations succeed on Neon |

**Current Best Practices (2026):**
- Neon + Drizzle RLS integration is now documented and supported
- API key validation should use both prefix and API calls for reliability
- Hub storage should be unified to avoid confusion
- Migration state management requires manual intervention when corrupted

---

## Open Questions

1. **Exact Neon API key prefixes**
   - What we know: `napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09` is project-scoped, `napi_kjk0csgre3alti441qk2lcfz19mltaq7zl90vnkfxf0l1w44xwwhvtq4q83n4bz4` is organization-scoped
   - What's unclear: Are these patterns stable? Will prefixes change? Are there other prefix variations?
   - Recommendation: Use API validation as primary check, prefix as fast pre-filter. Document both patterns but don't rely solely on prefixes.

2. **RLS performance impact**
   - What we know: RLS has 8-16% overhead per `.planning/research/neon-drizzle-patterns.md`
   - What's unclear: Will RLS on all tables impact query performance significantly for this specific workload?
   - Recommendation: Accept the performance cost. CONTEXT.md decision is "Apply RLS to all tables or fail entirely" - maximum security over performance.

3. **Migration order for RLS setup**
   - What we know: Role must exist before `.existing()` references work
   - What's unclear: Should role creation be in a separate migration file (0000_*) or combined with first schema file?
   - Recommendation: Separate migration file (`0000_setup_rls_role.sql`) is clearer and follows "setup before dependencies" pattern.

4. **Personal Hub migration strategy**
   - What we know: Need to move from config/hub.env to .hubs/personal.json
   - What's unclear: Should this be a one-time script or part of setup-db.ts with automatic migration?
   - Recommendation: Add migration check in setup-db.ts: if hub.env exists and .hubs/personal.json doesn't, migrate automatically.

---

## Sources

### Primary (HIGH confidence)

- **Existing Codebase** - Examined `/home/hybridz/Projects/post-shit-now/src/cli/setup.ts`, `/home/hybridz/Projects/post-shit-now/src/team/hub.ts`, `/home/hybridz/Projects/post-shit-now/src/core/db/schema.ts`, `/home/hybridz/Projects/post-shit-now/src/core/db/migrate.ts`, `/home/hybridz/Projects/post-shit-now/src/core/utils/env.ts`
- **Issues Documentation** - `/home/hybridz/Projects/post-shit-now/.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md` - Contains detailed bug reports for C1-C4, M16
- **Phase Context** - `/home/hybridz/Projects/post-shit-now/.planning/phases/01-critical-setup-fixes/01-CONTEXT.md` - User decisions on RLS, API validation, hub storage

### Secondary (MEDIUM confidence)

- **Neon Drizzle Patterns Research** - `/home/hybridz/Projects/post-shit-now/.planning/research/neon-drizzle-patterns.md` - RLS implementation details, migration patterns, role creation methods
- **Error Validation Patterns Research** - `/home/hybridz/Projects/post-shit-now/.planning/research/error-validation-patterns.md` - CLI error handling patterns, validation strategies, health check approaches

### Tertiary (LOW confidence)

- **Web Search Results** - Neon API key prefix patterns, organization vs project scope (limited official documentation found, needs verification)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing codebase and research files
- Architecture: HIGH - Hub connection and RLS patterns well-documented in existing research
- Pitfalls: HIGH - Root causes identified from issues documentation, clear prevention strategies
- API key validation: MEDIUM - Prefix patterns documented in issues, but API endpoints need verification from official docs

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days for stable stack)
