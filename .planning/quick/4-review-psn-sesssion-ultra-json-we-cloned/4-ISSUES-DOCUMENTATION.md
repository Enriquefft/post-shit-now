# PSN Session Issues Documentation

**Source:** PSN SESSION_ULTRA.json
**Session Date:** 2026-02-20
**Purpose:** Comprehensive record of setup and voice profile creation issues

---

## Summary

This document captures all issues, bugs, and improvement opportunities discovered during the PSN (Post Shit Now) setup and voice profile creation process. Issues are categorized by severity with suggested fixes and cross-references where applicable.

**Issue Count:** 30 total
- CRITICAL: 6 issues
- MAJOR: 14 issues
- MINOR: 10 issues

---

# CRITICAL ISSUES

Issues that block setup or prevent core functionality from working.

---

## C1: Setup wizard hub detection bug

**Severity:** CRITICAL
**Component:** `src/cli/setup.ts`
**Related Issues:** C2, C11, C12

### Description
The setup wizard shows hub as configured in status check, but `/psn:setup voice` command fails with "Personal Hub not configured" error.

### Reproduction Steps
1. Run `bun run src/cli/setup.ts` - shows hub as configured
2. Run `bun run src/cli/setup.ts voice` - fails with "Personal Hub not configured. Run /psn:setup first."

### Root Cause
`setup.ts` uses `getHubConnection(projectRoot, "personal")` for voice and entity subcommands. This function only looks for Company Hub files (`.hubs/*.json`), not the Personal Hub which is stored in `config/hub.env`.

The Personal Hub should be loaded via `loadHubEnv()` function, not `getHubConnection()`.

### Fix Options
**Option A (Recommended):** Update `setup.ts` voice and entity cases to use `loadHubEnv()`
```typescript
// In setup.ts case "voice":
// OLD:
const connection = await getHubConnection(projectRoot, "personal");
if (!connection) { return error... }

// NEW:
const hubResult = await loadHubEnv(configDir);
if (!hubResult.success) { return error... }
const db = createHubConnection(hubResult.data.databaseUrl);
```

**Option B:** Add special handling for "personal" in `getHubConnection()` to check `config/hub.env`

**Complexity:** Simple
**Priority:** HIGH - blocks voice profile creation

---

## C2: Migration RLS policy error

**Severity:** CRITICAL
**Component:** Drizzle schema
**Related Issues:** M16

### Description
Database migrations fail with: `role 'hub_user' does not exist`. The schema defines `pgRole("hub_user").existing()` but the role doesn't exist in Neon.

### Reproduction Steps
1. Run database setup with Neon
2. Migrations fail on RLS policy creation
3. Error: `role 'hub_user' does not exist`

### Root Cause
RLS policies in schema reference `hub_user` role that doesn't exist in Neon. Neon's free tier has restrictions on custom role creation. The role needs to be created manually before migrations can apply RLS policies.

### Fix Options
**Option A (Recommended for Neon):** Remove RLS policies from schema for Neon compatibility
- Modify schema to use app-level filtering instead of Postgres RLS
- Requires updating all queries to include user ID filtering

**Option B (For self-hosted Postgres):** Create role in migration setup
```sql
CREATE ROLE hub_user;
GRANT USAGE ON SCHEMA public TO hub_user;
```
Then run migrations

**Option C:** Conditional RLS based on environment
- Detect Neon vs self-hosted
- Apply RLS only for self-hosted

### Workaround Used
Manually created `hub_user` role via SQL before running migrations.

**Complexity:** Medium
**Priority:** HIGH - blocks database setup

---

## C3: Provider keys table doesn't exist

**Severity:** CRITICAL
**Component:** Database schema/migrations
**Related Issues:** C2

### Description
Setup fails with: `Failed query: select * from api_keys where user_id = $1`. The `api_keys` table was not created during migrations.

### Reproduction Steps
1. Complete hub setup
2. Run `bun run src/cli/setup.ts`
3. Provider key check fails with table not found error

### Root Cause
Migration to create `api_keys` table likely failed due to the RLS policy error (C2). When migrations fail, later migration steps may be skipped, leaving the database in an incomplete state.

### Fix
1. Resolve RLS policy error (C2)
2. Verify migrations run to completion
3. Add validation after migrations to ensure all tables exist

### Verification
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```
Expected tables should include: `api_keys`, `entities`, `oauth_tokens`, `posts`, etc.

**Complexity:** Medium
**Priority:** HIGH - blocks provider key configuration

---

## C4: Neon API key permission error

**Severity:** CRITICAL
**Component:** Neon API integration

### Description
Initial setup fails with: `ERROR: project-scoped keys are not allowed to create projects`

### Reproduction Steps
1. Generate Neon API key from project settings (starts with `napi_`)
2. Run setup wizard
3. Database creation fails with permission error

### Root Cause
The original Neon API key was project-scoped (`napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09`), which only has access to an existing project. Creating new Neon projects requires an organization-scoped or root API key.

### Fix
**Option A (Recommended):** Clarify key type requirements in setup prompt
```
NEON_API_KEY: Get from Neon Console -> Account -> API Keys
Note: Use an organization-scoped key, not project-scoped
Organization keys start with: napi_k...
Project keys start with: napi_...
```

**Option B:** Detect key type and provide helpful error message
- Check if key prefix is `napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09`
- If so, show: "This key is project-scoped and cannot create projects. Generate an organization key from your Neon account settings."

**Resolution in Session**
User switched to organization-scoped key: `napi_kjk0csgre3alti441qk2lcfz19mltaq7zl90vnkfxf0l1w44xwwhvtq4q83n4bz4`

**Complexity:** Simple
**Priority:** HIGH - blocks initial setup

---

## C5: Voice interview CLI incomplete

**Severity:** CRITICAL
**Component:** `src/cli/voice-interview.ts`
**Related Issues:** M9, M16

### Description
`bun run src/cli/voice-interview.ts start` returns interview questions but provides no way to submit answers. The CLI only has `start` and `import` commands, but `submitAnswers()` function exists and is not exposed as a CLI subcommand.

### Reproduction Steps
1. Run `bun run src/cli/voice-interview.ts start`
2. Receive interview questions in JSON output
3. No documented way to submit answers to continue interview

### Root Cause
Voice interview engine was designed as a library with programmatic API, not a complete CLI tool. The `submitAnswers()`, `complete()`, and related functions exist but are not wired to CLI subcommands.

### Impact
Users cannot complete voice interview through CLI, must use interactive flow which isn't fully wired. This blocks voice profile creation for CLI-only users.

### Fix
Add CLI subcommands to `src/cli/voice-interview.ts`:

```bash
# Submit answer to specific question
bun run src/cli/voice-interview.ts submit --question-id <id> --answer "<answer>"

# Complete interview and save profile
bun run src/cli/voice-interview.ts complete --profile-path content/voice/personal.yaml

# Interactive mode (recommended for most users)
bun run src/cli/voice-interview.ts interactive
```

**Complexity:** Medium
**Priority:** HIGH - blocks voice profile creation via CLI

---

## C6: setup-keys.ts stdin reading issue

**Severity:** CRITICAL
**Component:** `src/cli/setup-keys.ts`

### Description
Attempting to save keys via stdin fails silently. Command completes but no keys are saved to file.

### Reproduction Steps
1. Run: `echo "KEY=value" | bun run src/cli/setup-keys.ts`
2. Check `config/keys.env` - file is empty or unchanged
3. No error message indicating failure

### Root Cause
`setup-keys.ts` expects interactive input via prompts or expects to be called programmatically. It doesn't implement stdin parsing for KEY=value format.

### Fix Options
**Option A (Recommended):** Add stdin parsing
```typescript
if (!process.stdin.isTTY) {
  // Read from stdin
  const input = await Bun.stdin.text();
  const lines = input.split('\n');
  for (const line of lines) {
    const [key, value] = line.split('=');
    if (key && value) {
      await writeKey(key.trim(), value.trim());
    }
  }
}
```

**Option B:** Accept CLI flags
```bash
bun run src/cli/setup-keys.ts --key NEON_API_KEY --value "napi_..."
```

**Option C:** Document direct file writing workaround
```bash
mkdir -p config && echo "NEON_API_KEY=value" > config/keys.env
```

**Workaround Used in Session**
Wrote directly to file: `echo "NEON_API_KEY=..." > config/keys.env`

**Complexity:** Simple
**Priority:** MEDIUM - workaround available but confusing

---

# MAJOR ISSUES

Significant friction points or incomplete features that impact user experience.

---

## M1: Database migration retry loop

**Severity:** MAJOR
**Component:** `src/cli/setup-db.ts`
**Related Issues:** C2, C3

### Description
First run shows: "Database created but migrations failed: Can't find meta/_journal.json". Re-running setup skips database step and tries migrations again, but still fails.

### Reproduction Steps
1. Run setup wizard - database created but migrations fail
2. Run setup again - skips database creation
3. Migrations fail again with same error
4. No clear way to reset state

### Root Cause
Drizzle meta files (`meta/_journal.json`, `meta/*_snapshot.json`) are not being generated properly. When migrations fail, partial state is left behind. On retry, the database step is skipped because `config/hub.env` exists, but migrations still fail.

### Fix
Add better error handling and state management:

```typescript
// Check if migrations actually ran successfully
const metaJournal = join(projectRoot, "drizzle", "meta", "_journal.json");
if (!await exists(metaJournal)) {
  // Migration incomplete - clean up and retry
  await rimraf("drizzle/meta");
  await runMigrations();
}
```

Add `--reset` flag to `setup-db.ts` to clean up partial state.

**Complexity:** Medium
**Priority:** MEDIUM - requires manual intervention to recover

---

## M2: Hub ID missing from hub.env

**Severity:** MAJOR
**Component:** `config/hub.env`
**Related Issues:** C1, C11

### Description
`config/hub.env` contains `DATABASE_URL` and `HUB_ENCRYPTION_KEY`, but no `HUB_ID` field. Various operations in the code expect a `hubId` to be present.

### Reproduction Steps
1. Complete setup
2. Check `config/hub.env` - no HUB_ID present
3. Code that reads `hubId` from hub.env fails or uses default "default"

### Root Cause
Setup generates `DATABASE_URL` and `HUB_ENCRYPTION_KEY` but doesn't generate or store a `HUB_ID`. The ID is either derived from the Neon project name or should be generated as a UUID.

### Fix
Add HUB_ID generation during setup:

```typescript
// In setup-db.ts
const hubId = crypto.randomUUID();
const hubEnv = `
DATABASE_URL=${databaseUrl}
HUB_ENCRYPTION_KEY=${encryptionKey}
HUB_ID=${hubId}
`;
await Bun.write(join(configDir, "hub.env"), hubEnv);
```

**Complexity:** Simple
**Priority:** MEDIUM - causes confusion and potential bugs

---

## M3: Trigger.dev setup CLI argument error

**Severity:** MAJOR
**Component:** `src/cli/setup-trigger.ts`

### Description
Trigger.dev setup fails with: `error: unknown option '--skip-install'`

### Reproduction Steps
1. Run setup wizard
2. Trigger.dev step attempts to run: `npx trigger.dev@latest init --skip-install`
3. Command fails with unknown option error

### Root Cause
Trigger.dev CLI removed the `--skip-install` flag in version 4.4.0. The setup script still uses the old flag.

### Fix
Remove `--skip-install` flag from setup-trigger.ts:

```typescript
// OLD:
execSync("npx trigger.dev@latest init --skip-install", { cwd: projectRoot });

// NEW:
execSync("npx trigger.dev@latest init", { cwd: projectRoot });
```

Or use the alternative approach:
```typescript
// Set project ref directly without full init
const projectRef = await getTriggerProjectRef(apiKey);
await updateTriggerConfig(projectRef);
```

**Complexity:** Simple
**Priority:** MEDIUM - blocks trigger.dev setup

---

## M4: Missing entity creation flow

**Severity:** MAJOR
**Component:** `src/cli/setup.ts`
**Related Issues:** C1, M10

### Description
Setup voice suggests creating entities via `/psn:setup entity --create`, but no interactive flow documents entity creation combined with voice interview.

### Reproduction Steps
1. User selects "Thought Leader, Educator, Curator, Academic Researcher, Provocateur" as archetypes
2. Setup creates or updates voice profile
3. No clear flow to create entities that would use this profile

### Root Cause
Entity creation is a separate command from voice interview. There's no integrated flow that:
1. Creates entity
2. Sets up voice profile for that entity
3. Configures platform connections

### Fix
Add integrated flow or document full workflow:

```typescript
// After interview complete, offer entity creation
if (!entities || entities.length === 0) {
  console.log("Create an entity to use this voice profile:");
  console.log("bun run src/cli/setup.ts entity --create 'My Project'");
}
```

**Complexity:** Medium
**Priority:** MEDIUM - confusing user experience

---

## M5: Empty .hubs directory confusion

**Severity:** MAJOR
**Component:** Hub connection detection
**Related Issues:** C1, C11, C12

### Description
`getHubConnection` discovers Company Hubs from `.hubs/*.json` files, but Personal Hub uses `config/hub.env` (different storage mechanism). This inconsistency causes bugs.

### Reproduction Steps
1. Check `.hubs/` directory - empty or doesn't exist
2. Setup status shows "Personal Hub configured"
3. `setup.ts voice` fails looking for hub in `.hubs/`

### Root Cause
Code comments suggest `.hubs/` is for Company Hubs only, but `setup.ts` uses `getHubConnection("personal")` which looks there. The Personal Hub connection mechanism (`config/hub.env`) is different.

### Fix
**Option A (Recommended):** Refactor `setup.ts` to use appropriate connection method per hub type
```typescript
// For personal hub: use loadHubEnv
if (slug === "personal" || !slug) {
  const hubResult = await loadHubEnv(configDir);
  // ... use hubResult
}
// For company hubs: use getHubConnection
else {
  const connection = await getHubConnection(projectRoot, slug);
  // ... use connection
}
```

**Option B:** Add Personal Hub to `.hubs/` as JSON file
- Unifies storage mechanism
- Makes code simpler (always use `getHubConnection`)
- Requires migration from existing `config/hub.env`

**Complexity:** Medium
**Priority:** MEDIUM - causes bugs and confusion

---

## M6: No voice profile file creation directory

**Severity:** MAJOR
**Component:** `src/voice/profile.ts`
**Related Issues:** M7

### Description
Interview saves to `content/voice/personal.yaml`, but no check exists to ensure `content/voice/` directory exists. Setup doesn't create these directories.

### Reproduction Steps
1. Complete setup without prior content directory
2. Try to save voice profile
3. Fails with "ENOENT: no such file or directory"

### Root Cause
Voice profile save assumes directory exists but doesn't create it. Setup process doesn't initialize content directory structure.

### Fix
Add directory creation in profile save:

```typescript
// In profile.ts saveProfile()
const profileDir = join(projectRoot, "content", "voice");
await ensureDir(profileDir);  // Create if doesn't exist
await Bun.write(join(profileDir, "personal.yaml"), yamlString);
```

Also add to setup initialization:
```typescript
// In setup.ts or setup-db.ts
const contentDirs = [
  join(projectRoot, "content"),
  join(projectRoot, "content", "voice"),
  join(projectRoot, "content", "drafts"),
];
for (const dir of contentDirs) {
  await ensureDir(dir);
}
```

**Complexity:** Simple
**Priority:** MEDIUM - blocks voice profile saving

---

## M7: Missing setup completion validation

**Severity:** MAJOR
**Component:** `src/cli/setup.ts`

### Description
Setup shows "2 steps remaining" but no way to mark steps as complete. Voice profile creation doesn't update setup status.

### Reproduction Steps
1. Run `bun run src/cli/setup.ts status`
2. Shows: "2 steps remaining" (voice, platforms)
3. Complete voice profile via interview
4. Run status again - still shows "2 steps remaining"

### Root Cause
Setup status is checked by file/db state, but voice profile completion doesn't update any state tracking. There's no mechanism to mark steps as done.

### Fix
Add completion tracking:

```typescript
// After voice profile creation
const statusFile = join(configDir, "setup-status.json");
const status = await readStatusFile(statusFile);
status.voice = true;
status.voiceCompletedAt = new Date().toISOString();
await writeStatusFile(statusFile, statusFile);

// Update status command to read from file
```

**Complexity:** Medium
**Priority:** MEDIUM - confusing progress indication

---

## M8: Provider key configuration flow unclear

**Severity:** MAJOR
**Component:** `src/cli/setup.ts`, `src/cli/setup-keys.ts`

### Description
Phase 2 provider keys check happens during setup, but no clear path to configure them. `setup-keys.ts` has `writeProviderKey` function but it's not wired to main setup flow.

### Reproduction Steps
1. Run setup - provider key step shows "need_input"
2. No prompt or clear command to add provider keys
3. `writeProviderKey` exists in code but not exposed

### Root Cause
Provider key setup was designed as a separate phase, but the check happens in main setup. The wiring between check and configuration is incomplete.

### Fix
Add provider key configuration step to main setup:

```typescript
// In setup.ts, after hub setup
const providerKeysResult = await setupProviderKeys(configDir);
if (providerKeysResult.status === "need_input") {
  for (const keyRequest of providerKeysResult) {
    const key = await prompt(`Enter ${keyRequest.data.service} API key:`);
    await writeProviderKey(hubId, keyRequest.data.key, key);
  }
}
```

Or expose as subcommand:
```bash
bun run src/cli/setup.ts keys --list
bun run src/cli/setup.ts keys --add perplexity <key>
```

**Complexity:** Medium
**Priority:** MEDIUM - blocks provider key configuration

---

## M9: Interview state not persistent across CLI calls

**Severity:** MAJOR
**Component:** `src/cli/voice-interview.ts`
**Related Issues:** C5

### Description
`voice-interview start` returns state but no mechanism to load/save it between CLI calls. Users would need to manually pass state between invocations.

### Reproduction Steps
1. Run `bun run src/cli/voice-interview.ts start`
2. Receive interview state and questions in JSON
3. Run `bun run src/cli/voice-interview.ts submit` - no previous state loaded

### Root Cause
Interview engine is stateful (tracks questions, answers, progress) but CLI calls are stateless. There's no state file or interactive mode to persist between commands.

### Fix
Add state file support:

```typescript
// Save state to file
const stateFile = join(configDir, "interview-state.json");
await Bun.write(stateFile, JSON.stringify(interviewState));

// Load state in subsequent calls
const savedState = await Bun.readTextFile(stateFile);
const interview = loadInterviewState(JSON.parse(savedState));
```

Or implement interactive mode:
```bash
bun run src/cli/voice-interview.ts interactive
# Keeps process running, handles all questions in one session
```

**Complexity:** Medium
**Priority:** MEDIUM - makes interview impossible to complete via CLI

---

## M10: Voice interview archetype question handling

**Severity:** MAJOR
**Component:** Voice interview engine
**Related Issues:** C5, M9

### Description
User selected multiple archetypes: "Thought Leader, Educator, Curator, Academic Researcher, Provocateur". No way to submit multi-choice answers through CLI.

### Reproduction Steps
1. Interview asks to select archetypes from list
2. User selects multiple archetypes
3. CLI has no submit mechanism for this answer

### Root Cause
Archetype processing expects string matching, but no submission path exists. Multi-select questions require special handling but CLI doesn't implement it.

### Fix
Add `voice-interview submit` CLI command:
```bash
bun run src/cli/voice-interview.ts submit --question-id <id> --answer "Thought Leader, Educator"
```

Handle multi-select parsing:
```typescript
// Parse comma-separated answers
const answers = answerText.split(',').map(a => a.trim());
```

**Complexity:** Simple
**Priority:** MEDIUM - blocks interview completion

---

## M11: No dry-run or preview mode for setup

**Severity:** MAJOR
**Component:** `src/cli/setup.ts`

### Description
Setup makes actual changes to database and filesystem without any way to preview what will happen.

### Reproduction Steps
1. Run `bun run src/cli/setup.ts`
2. Creates Neon project immediately
3. No way to see what will happen first

### Root Cause
Setup is designed to run immediately. No `--dry-run` or `--preview` flag exists to show planned actions without executing them.

### Fix
Add `--dry-run` flag:

```typescript
// In setup.ts
if (params.dryRun) {
  console.log("Dry run - planned changes:");
  console.log("- Create Neon project: psn-hub-{random}");
  console.log("- Run migrations: 15 tables");
  console.log("- Write config: hub.env, keys.env");
  return { status: "dry-run", planned: [...] };
}
```

**Complexity:** Medium
**Priority:** MEDIUM - risky for production environments

---

## M12: Database connection string exposed in errors

**Severity:** MAJOR
**Component:** Error handling
**Security Issue:** Yes

### Description
Errors show full `DATABASE_URL` with password in plaintext.

### Reproduction Steps
1. Run setup with wrong credentials
2. Error message contains: `postgresql://neondb_owner:password@host...`

### Root Cause
Error handling uses raw error strings without sanitizing sensitive data. Connection strings are logged directly.

### Fix
Mask credentials in error messages:

```typescript
function maskConnectionString(url: string): string {
  return url.replace(/:[^:@]+@/, ':***@');
}

// In error handling
const maskedUrl = maskConnectionString(databaseUrl);
console.error(`Failed to connect: ${maskedUrl}`);
```

**Complexity:** Simple
**Priority:** HIGH - security risk

---

## M13: neonctl path issue

**Severity:** MAJOR
**Component:** `src/cli/setup-db.ts`

### Description
neonctl installed via bun but PATH not updated. Had to manually add `/home/hybridz/.cache/.bun/bin:$PATH`

### Reproduction Steps
1. Run `bun add -g neonctl`
2. Run setup wizard
3. Error: "neonctl not found"

### Root Cause
Bun global bin directory is not in PATH by default. Setup script assumes `neonctl` is available directly.

### Fix
**Option A (Recommended):** Use absolute path in setup
```typescript
const bunGlobalBin = join(homedir(), ".cache", ".bun", "bin");
const neonctlPath = join(bunGlobalBin, "neonctl");
execSync(`${neonctlPath} ...`);
```

**Option B:** Add to PATH in setup script
```typescript
const PATH = `${process.env.PATH}:/home/hybridz/.cache/.bun/bin:$PATH`;
execSync("neonctl ...", { env: { ...process.env, PATH } });
```

**Option C:** Document in README that bun global bin must be in PATH

**Workaround Used**
Manual PATH update: `export PATH="/home/hybridz/.cache/.bun/bin:$PATH"`

**Complexity:** Simple
**Priority:** MEDIUM - setup fails without manual intervention

---

## M14: Missing recovery flow for failed setup

**Severity:** MAJOR
**Component:** `src/cli/setup.ts`

### Description
If setup fails partway through, no clear recovery path exists. No "reset" or "clean" command to start over.

### Reproduction Steps
1. Run setup - fails at migration step
2. Try running setup again - skips completed steps
3. No way to clean up partial state and restart

### Root Cause
Setup is designed to be idempotent, but partial failure leaves inconsistent state. No cleanup mechanism exists.

### Fix
Add `/psn:setup reset` command:

```typescript
case "reset": {
  console.log("This will delete config and hub data. Continue? (yes/no)");
  const confirm = await prompt();
  if (confirm === "yes") {
    await rimraf("config");
    await rimraf("drizzle/meta");
    console.log("Setup state cleared. Run /psn:setup to start fresh.");
  }
}
```

Also add `--reset` flag to main setup:
```bash
bun run src/cli/setup.ts --reset
```

**Complexity:** Medium
**Priority:** MEDIUM - makes recovery difficult

---

# MINOR ISSUES

UX improvements, documentation gaps, and nice-to-have features.

---

## m1: No setup progress indicators

**Severity:** MINOR
**Component:** `src/cli/setup.ts`

### Description
Long-running operations (migrations, role creation) show no progress. Users think setup is frozen.

### Reproduction Steps
1. Run setup wizard
2. Migration step runs for 30+ seconds
3. No progress indication, user may think it's stuck

### Fix
Add progress spinners or status messages:

```typescript
// Using ora or similar
const spinner = ora("Running migrations...").start();
await runMigrations();
spinner.succeed("Migrations completed");
```

Or step-by-step logging:
```typescript
console.log("Step 1/4: Creating database...");
await createDatabase();
console.log("Step 2/4: Running migrations...");
await runMigrations();
```

**Complexity:** Simple
**Priority:** LOW - UX improvement

---

## m2: Voice profile format validation not documented

**Severity:** MINOR
**Component:** `src/voice/profile.ts`

### Description
No clear schema validation errors when profile is malformed. Users don't know what valid profiles look like.

### Reproduction Steps
1. Manually edit `content/voice/personal.yaml`
2. Make syntax error or invalid field
3. Error message is generic or unhelpful

### Fix
Add `validate` command:

```bash
bun run src/cli/voice-interview.ts validate content/voice/personal.yaml
```

Output:
```
Profile validation:
[PASS] Identity section exists
[FAIL] Style traits missing formality field
Expected format: formality: 1-10
```

Add schema to documentation:
```yaml
# Valid voice profile structure
identity:
  pillars: [...]
  boundaries: [...]
  style:
    formality: 1-10
    humor: 1-10
    ...
```

**Complexity:** Medium
**Priority:** LOW - developer experience

---

## m3: Content import paths not verified

**Severity:** MINOR
**Component:** `src/cli/voice-interview.ts`

### Description
`voice-interview import` accepts URLs but no validation they exist. No clear error if blog import fails.

### Reproduction Steps
1. Run `bun run src/cli/voice-interview.ts import https://example.com/blog`
2. URL doesn't exist or returns error
3. Generic error message or silent failure

### Fix
Add URL validation:
```typescript
async function validateUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

// Before import
if (!await validateUrl(url)) {
  return { status: "error", message: "URL is not accessible" };
}
```

Better error messages:
```typescript
return {
  status: "error",
  message: "Failed to import from https://example.com/blog",
  details: "HTTP 404: Page not found"
};
```

**Complexity:** Simple
**Priority:** LOW - UX improvement

---

## m4: Entity slug collision handling

**Severity:** MINOR
**Component**: `src/cli/setup.ts` entity creation

### Description
No documented behavior when entity slug already exists. `createEntity` should handle or error on collision.

### Reproduction Steps
1. Create entity with slug "my-project"
2. Try to create another entity with same slug
3. Behavior undefined

### Fix
Add slug uniqueness check:
```typescript
const existing = await getEntity(db, userId, slug);
if (existing) {
  return {
    status: "error",
    message: `Entity "${slug}" already exists. Choose a different name.`
  };
}
```

Or auto-increment slug:
```typescript
let uniqueSlug = slug;
let counter = 1;
while (await getEntity(db, userId, uniqueSlug)) {
  uniqueSlug = `${slug}-${counter++}`;
}
```

**Complexity:** Simple
**Priority:** LOW - data integrity

---

## m5: Trigger project auto-detection fails

**Severity:** MINOR
**Component**: `src/cli/setup-trigger.ts`

### Description
`setup-trigger.ts` should auto-detect project from trigger.dev account. Fallback is manual entry of project ref. `npx trigger.dev projects list` returned empty (failed silently).

### Reproduction Steps
1. Run setup wizard
2. Trigger.dev project list returns empty
3. No error message, falls back to manual entry

### Fix
Add better error handling:
```typescript
try {
  const projects = execSync("npx trigger.dev projects list");
  if (!projects || projects.trim() === "") {
    console.warn("Could not list projects. Manual entry required.");
  }
} catch (error) {
  console.error("Failed to connect to Trigger.dev:", error.message);
}
```

**Complexity:** Simple
**Priority:** LOW - UX improvement

---

## m6: Content directory structure assumptions

**Severity:** MINOR
**Component**: Multiple files

### Description
Code expects `content/voice/`, `content/drafts/`, etc. No initialization creates these directories.

### Reproduction Steps
1. Fresh installation
2. Run setup - content directories don't exist
3. Some operations fail

### Fix
Add `init` command:
```bash
bun run src/cli/setup.ts init
```

Creates directory structure:
```
content/
  voice/
  drafts/
  published/
  ideas/
```

Or create automatically on first use:
```typescript
// In any code that needs content dirs
await ensureDir(join(projectRoot, "content", "voice"));
```

**Complexity:** Simple
**Priority:** LOW - UX improvement

---

## m7: Voice profile persona configuration incomplete

**Severity:** MINOR
**Component**: Voice profiles

### Description
Platform personas (tone per platform) mentioned but no setup flow. Users can't configure platform-specific voice differences.

### Reproduction Steps
1. Complete voice interview
2. Profile has generic voice settings
3. No way to set "casual on X, professional on LinkedIn"

### Fix
Add platform persona interview questions:
```
What tone should posts have on X?
[casual, professional, balanced, sarcastic]

What tone should posts have on LinkedIn?
[casual, professional, balanced, thought-leader]
```

Or add CLI commands:
```bash
bun run src/cli/voice-config.ts set-platform-tone x casual
bun run src/cli/voice-config.ts set-platform-tone linkedin professional
```

**Complexity:** Medium
**Priority:** LOW - feature request

---

## m8: Missing timezone configuration

**Severity:** MINOR
**Component**: Setup wizard

### Description
Setup never asks for timezone. Posting times use system timezone implicitly.

### Reproduction Steps
1. Complete setup
2. User is in different timezone from server
3. Posts scheduled at wrong local times

### Fix
Add timezone setup step:
```bash
# Auto-detect
bun run src/cli/setup.ts --timezone auto

# Or prompt
"Your timezone: (auto-detected: America/New_York)
Press Enter to accept, or enter IANA timezone name"
```

Store in `config/hub.env`:
```
TIMEZONE=America/New_York
```

**Complexity:** Simple
**Priority:** LOW - convenience feature

---

## m9: No setup health check command

**Severity:** MINOR
**Component**: `src/cli/validate.ts`

### Description
No way to verify all components are working after setup. `validate.ts` checks but doesn't test all integrations.

### Reproduction Steps
1. Complete setup
2. Want to verify everything works
3. Run validate - shows config status, not connectivity

### Fix
Add comprehensive health check:
```bash
bun run src/cli/validate.ts --health
```

Tests:
- [PASS/FAIL] Database connectivity
- [PASS/FAIL] Trigger.dev connection
- [PASS/FAIL] Neon project accessible
- [PASS/FAIL] Encryption key valid
- [PASS/FAIL] All tables exist
- [PASS/FAIL] Platform OAuth tokens valid

**Complexity:** Medium
**Priority:** LOW - debugging aid

---

## m10: RLS policies not compatible with Neon free tier

**Severity:** MINOR
**Component**: Database schema
**Related Issues**: C2, M16

### Description
Schema uses `pgRole` and `pgPolicy` extensively. Neon free tier may have restrictions on custom roles.

### Reproduction Steps
1. Try to apply RLS policies on Neon
2. Role creation fails or permissions insufficient
3. Migrations blocked

### Root Cause
Postgres RLS assumes full control over database roles. Neon's managed environment has restrictions.

### Fix
**Architectural Decision Required:**
Choose between:
- **Option A:** Full RLS with custom Postgres instance (self-hosted)
- **Option B:** App-level filtering for Neon (remove RLS)

Document architecture choice in docs:
```markdown
# Platform Compatibility

| Feature | Neon | Self-hosted Postgres |
|---------|-------|---------------------|
| RLS | No (use app filtering) | Yes |
| Custom roles | Limited | Full access |
| Performance | Managed | Self-managed |
```

**Complexity:** Complex (architectural decision)
**Priority:** LOW - documented in C2

---

# Cross-References

## Issue Clusters

### Hub Connection Issues
- **C1:** Setup wizard hub detection bug
- **C11:** Empty .hubs directory confusion
- **C12:** Hub ID missing from hub.env
- **M2:** Hub ID missing from hub.env
- **M5:** Empty .hubs directory confusion

**Root Cause:** Inconsistent hub connection mechanisms between Personal Hub (`config/hub.env`) and Company Hubs (`.hubs/*.json`).

**Recommended Fix:** Unify storage mechanism or use appropriate loader per hub type.

### Database Setup Issues
- **C2:** Migration RLS policy error
- **C3:** Provider keys table doesn't exist
- **M1:** Database migration retry loop
- **M16:** RLS policies not compatible with Neon free tier

**Root Cause:** Migration failures leave database in incomplete state. RLS policies incompatible with Neon.

**Recommended Fix:** Remove RLS for Neon, add migration state validation, implement recovery flow.

### Voice Interview Issues
- **C5:** Voice interview CLI incomplete
- **M9:** Interview state not persistent
- **M10:** Voice interview archetype question handling

**Root Cause:** Voice interview designed as library, not complete CLI. Missing state persistence and answer submission.

**Recommended Fix:** Add CLI subcommands (`submit`, `complete`, `interactive`) and state file support.

### Setup Flow Issues
- **C4:** Neon API key permission error
- **C6:** setup-keys.ts stdin reading issue
- **M3:** Trigger.dev setup CLI argument error
- **M8:** Provider key configuration flow unclear
- **M11:** No dry-run or preview mode
- **M12:** Database connection string exposed in errors
- **M13:** neonctl path issue
- **M14:** Missing recovery flow for failed setup

**Root Cause:** Setup process lacks proper validation, error handling, and recovery mechanisms.

**Recommended Fix:** Add comprehensive validation, error masking, dry-run mode, and reset command.

---

# Prioritization Recommendations

## Immediate (Critical - Block Setup)
1. **C1:** Setup wizard hub detection bug - blocks voice profile creation
2. **C2:** Migration RLS policy error - blocks database setup
3. **C3:** Provider keys table doesn't exist - blocks provider configuration
4. **C4:** Neon API key permission error - blocks initial setup

## High Priority (Major - User Experience)
5. **C5:** Voice interview CLI incomplete - blocks CLI-only users
6. **M1:** Database migration retry loop - requires manual recovery
7. **M3:** Trigger.dev setup CLI argument error - outdated flag
8. **M12:** Database connection string exposed in errors - security risk

## Medium Priority (Major - Quality of Life)
9. **M2:** Hub ID missing from hub.env - consistency
10. **M5:** Empty .hubs directory confusion - bug source
11. **M8:** Provider key configuration flow unclear - incomplete feature
12. **M13:** neonctl path issue - setup failure
13. **M14:** Missing recovery flow for failed setup - hard to recover

## Low Priority (Minor - Nice to Have)
14-30. All MINOR issues (m1-m10) - UX improvements and documentation

---

# Estimated Fix Complexity

| Complexity | Issues | Examples |
|------------|---------|----------|
| Simple | 12 | C4, C6, M2, M3, M12, M13, m1, m2, m3, m4, m5, m6, m8 |
| Medium | 14 | C1, C3, C5, M1, M4, M7, M8, M9, M11, M14, m2, m7, m9, m10 |
| Complex | 4 | C2, M5, M16 (architectural decisions) |

---

# Notes

1. **Session Context:** This review is based on a single PSN setup session on 2026-02-20. Real-world usage may reveal additional issues.

2. **Workarounds:** For most critical issues, workarounds exist (manual file editing, PATH updates, role creation). These should be documented in user guides.

3. **Architecture Decisions:** Several issues (C2, M16, M10) point to an architectural decision needed: whether to support both Neon (app-level security) and self-hosted Postgres (RLS), or pick one target.

4. **Consistency Issues:** Hub connection mechanism inconsistency (C1, M5) is a root cause of multiple bugs. Fixing this would resolve several issues at once.

5. **CLI vs Library:** Voice interview engine (C5, M9, M10) appears to be designed as a library but used as CLI. Either complete the CLI surface or clarify programmatic usage.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-20
**Next Review:** After fixes for C1-C4 are implemented
