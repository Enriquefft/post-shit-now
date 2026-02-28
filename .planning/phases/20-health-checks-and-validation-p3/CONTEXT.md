# Phase 20 Context: Health Checks & Validation (P3)

**Phase Number:** 20
**Phase Name:** Health Checks & Validation (P3)
**Goal:** Add comprehensive validation and health check tools

## Phase Overview

Phase 20 focuses on adding validation and health check tools to improve user experience and system reliability. This phase addresses three minor (P3) issues:

1. **m9** - Health check command implementation
2. **m5** - Trigger project auto-detection
3. **m10** - RLS compatibility documentation

## Current State

### Health Check Infrastructure

**Existing:**
- `src/trigger/health.ts` - Contains `healthCheck` Trigger.dev task that validates database connectivity and environment variables
- `src/cli/validate.ts` - Contains `validateAll()` function that checks database, trigger, config structure, and API keys
- Validation pattern uses `ValidationResult` and `ValidationSummary` types from `core/types/index.ts`

**Gaps:**
- No CLI command to run health checks on-demand
- Health checks only accessible via Trigger.dev task invocation
- No comprehensive health check covering all system components

### Trigger.dev Setup

**Existing:**
- `src/cli/setup-trigger.ts` - Handles Trigger.dev project configuration
- Auto-extracts project ref from `TRIGGER_SECRET_KEY` format: `tr_dev_PROJECTREF_...`
- Falls back to `TRIGGER_PROJECT_REF` environment variable
- Runs `bunx trigger.dev@latest init --skip-package-install` if project ref not found

**Gaps (m5):**
- No explicit Trigger project auto-detection in error messages
- Users may see generic "project not found" errors without guidance
- No CLI command to verify Trigger.dev project connectivity

### RLS Architecture

**Decision (from ROADMAP.md):**
- Remove RLS entirely for Neon compatibility
- Implement app-level filtering as alternative
- This decision was made in Phase 1 (C2: Migration RLS policy error)

**Gaps (m10):**
- No documentation explaining the RLS architecture decision
- No guidance on compatibility per platform (Neon vs self-hosted Postgres)
- Teams using self-hosted Postgres may want RLS guidance

## Technical Context

### Health Check Pattern

```typescript
// From src/trigger/health.ts
export interface HealthReport {
  database: "ok" | "error";
  env: "ok" | "error";
  timestamp: string;
  details: Record<string, string>;
}

export const healthCheck = task({
  id: "health-check",
  maxDuration: 30,
  run: async (): Promise<HealthReport> => {
    // Checks DATABASE_URL env var
    // Tests DB connectivity with SELECT 1
    // Returns report with status and details
  },
});
```

### Validation Pattern

```typescript
// From src/cli/validate.ts
export async function validateAll(configDir = "config"): Promise<ValidationSummary> {
  const results: ValidationResult[] = [];

  // Check 1: Database connectivity
  results.push(await checkDatabase(configDir));

  // Check 2: Trigger.dev configuration
  results.push(await checkTrigger(configDir));

  // Check 3: Config directory structure
  results.push(checkConfigStructure(configDir));

  // Check 4: API keys present
  results.push(await checkApiKeys(configDir));

  return { allPassed, results };
}
```

### Setup Command Pattern

**Subcommand routing** (from `src/cli/setup.ts`):
- Hub management: `hub`, `join`, `disconnect`, `invite`, `team`, `promote`
- Platform OAuth: `x-oauth`, `linkedin-oauth`, `instagram-oauth`, `tiktok-oauth`
- Configuration: `keys`, `voice`, `entity`, `notifications`
- System: `status`, `reset`

**Health check subcommand to be added:**
- `health` - Run comprehensive health checks and display results

### Trigger.dev Integration

**Project reference formats:**
- Config file: `trigger.config.ts` with `project: "<your-project-ref>"`
- Secret key: `tr_dev_PROJECTREF_...` or `tr_prod_PROJECTREF_...`
- Direct env: `TRIGGER_PROJECT_REF` variable

**Auto-detection logic** (from `src/cli/setup-trigger.ts`):
```typescript
// Extract project ref from secret key format
const match = secretKey.match(/^tr_(?:dev|prod)_([a-zA-Z0-9]+)_/);
if (match?.[1]) {
  projectRef = match[1];
}
```

## Plans Overview

### 20.1: Implement setup health check command (m9)

**Goal:** Add CLI command `/psn:setup health` that runs comprehensive health checks

**Scope:**
- Create `setup-health.ts` with health check functions
- Add `health` subcommand to `setup.ts` routing
- Cover: database connectivity, Trigger.dev project, hub connections, provider keys
- Display results in human-readable format with color coding
- Support `--json` flag for programmatic output

**Not in scope:**
- Auto-repair mechanisms (out of scope for this phase)
- Integration with external monitoring services

### 20.2: Add Trigger project auto-detection (m5)

**Goal:** Enhance Trigger.dev error messages with auto-detection hints

**Scope:**
- Detect Trigger.dev project ref from config file and secret key
- Compare detected project ref with Trigger.dev API
- Show clear error messages with suggested actions when mismatch detected
- Update `setup-trigger.ts` validation logic
- Add CLI command `/psn:setup trigger --verify` to check project connectivity

**Not in scope:**
- Automatic project creation (exists in `setup-trigger.ts`)
- Automatic project migration between dev/prod

### 20.3: Document architecture compatibility (RLS) (m10)

**Goal:** Create documentation explaining RLS architecture decisions and platform compatibility

**Scope:**
- Document RLS removal decision for Neon compatibility
- Explain app-level filtering pattern as alternative
- Provide guidance for self-hosted Postgres users who may want RLS
- Include migration guidance for teams moving from RLS to app-level filtering
- Add to `docs/` or `planning/research/` directory

**Not in scope:**
- Implementing RLS policies (removed in Phase 1)
- Changing the architecture decision

## Dependencies

### Internal Dependencies
- Phase 1 (Critical Setup Fixes) - RLS decision made here
- Phase 15 (Database Stability) - Migration retry patterns established
- Setup infrastructure (`src/cli/setup.ts`) - Must add `health` subcommand

### External Dependencies
- Neon Postgres (RLS not supported)
- Trigger.dev CLI (auto-detection uses CLI output)
- Trigger.dev API (project verification)

## Success Criteria

From ROADMAP.md:
- Health check verifies all components
- Trigger projects auto-detected with clear errors
- RLS compatibility documented per platform

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Health check false negatives | Use multiple checks per component, with clear pass/fail criteria |
| Trigger API changes | Use documented Trigger.dev CLI and API interfaces |
| RLS documentation confusion | Provide clear examples for both Neon and self-hosted Postgres scenarios |
| Health check performance issues | Set reasonable timeouts, use parallel checks where safe |

## Open Questions

1. **Health check scope:** Should health checks include provider key validation (Perplexity, OpenAI, etc.) or just core infrastructure?
2. **RLS documentation location:** Should this be in `docs/`, `planning/research/`, or a separate compatibility guide?
3. **Trigger verification API:** Does Trigger.dev provide an API endpoint to verify project ref, or should we rely on CLI output parsing?

## Notes

- This is the final phase of the v1.1 milestone (bug fixes and refinements)
- Phase 20 completes all 30 documented issues from the trial run
- After Phase 20, the v1.1 milestone will be ready for audit and potential completion
