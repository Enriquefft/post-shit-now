# Phase 17: Setup UX Improvements (P2) - Research

**Researched:** 2026-02-21
**Domain:** CLI UX, Progress Indicators, Data Masking, Error Handling
**Confidence:** HIGH

## Summary

Phase 17 focuses on enhancing the setup experience with four key improvements: progress indicators for long-running operations, sensitive data masking in error messages, dry-run/preview modes for safer execution, and fixing CLI argument handling issues. Research across existing CLI best practices and current codebase reveals clear implementation patterns for each improvement.

**Primary recommendations:**
1. Use `ora` for step-by-step progress indicators (industry standard, zero dependencies)
2. Implement URL/API key masking with regex patterns in error logging only
3. Add `--dry-run`/`--preview` flags with pre-flight validation
4. Fix Trigger.dev init by passing flags through bunx correctly
5. Improve neonctl PATH error with actionable installation instructions

The project already has `readline-sync` v1.4.10 installed, which provides masked input for interactive prompts. This reduces the implementation burden for data masking in interactive contexts.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Progress indicator style:**
- Step-by-step checklist format
- Show all steps (granular): DB connection, migration, hub creation, keys, entities, etc.
- Show running indicator with timing: `⠋ Database connecting...` → `✓ Database connecting [1.2s]`
- Display full step list from the start (not sequential reveal)
- Apply to long-running operations specifically

**Data masking strategy:**
- Database URLs: Mask user and host: `postgres://***@***` (middle ground - preserves structure, hides identity)
- API Keys: Show prefix + suffix format: `tr_********xyz`
- Scope: Mask in errors only (info/warn logs show raw data)
- Debug mode: Debug logging reveals unmasked values for troubleshooting

**Dry-run and preview modes:**
- Dry-run and preview are the same feature (different names)
- User can choose either `--dry-run` or `--preview` flag (both accepted)
- Output style: Claude's discretion on what level of detail to show
- After preview: Always confirm with user: "Proceed with setup? [y/N]"

**CLI error handling:**
- Missing neonctl: Show actionable suggestion with documentation link
- Invalid Trigger.dev arguments: Fail fast and early (stop immediately)
- Multiple errors: Claude's discretion on presentation style
- Philosophy: Be helpful, be specific, stop when things are clearly wrong

### Claude's Discretion

No specific requirements — open to standard CLI/UX best practices for setup tools.

### Deferred Ideas (OUT OF SCOPE)

- Add basic Trigger.dev knowledge to project knowledgebase (minimal) — separate documentation task

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|----------|---------|---------|--------------|
| **readline-sync** | 1.4.10 | Interactive prompts with masked input | Already in package.json, provides `hideEchoBack` and `mask` options for secure key entry |
| **ora** | Latest | Terminal spinners and progress indicators | Industry standard, 20+ spinner types, Promise integration, auto-detects non-TTY |

### Supporting

| Library | Version | Purpose | When to Use |
|----------|---------|---------|-------------|
| None needed | - | Data masking can be done with native regex | Built-in `String.replace()` with regex patterns sufficient |
| None needed | - | CLI flag parsing | Manual parsing already implemented in `src/cli/setup.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ora | cli-progress | cli-progress adds complexity; ora provides spinners sufficient for this use case |
| ora | chalk + custom spinner | Chalk only handles colors; ora provides complete spinner lifecycle |

**Installation:**
```bash
# ora is the only new dependency needed
bun add ora
```

## Architecture Patterns

### Recommended Project Structure

Progress indicator and masking utilities should be co-located with existing CLI utilities:

```
src/cli/
├── setup.ts                    # Main orchestrator (existing)
├── setup-db.ts                 # Database setup (existing)
├── setup-trigger.ts             # Trigger.dev setup (existing)
├── setup-keys.ts                # Key management (existing)
├── utils/
│   ├── progress.ts             # NEW: Progress indicator wrapper using ora
│   └── masking.ts             # NEW: Data masking utilities
└── validate.ts                 # Validation (existing)
```

### Pattern 1: Progress Indicator with ora

**What:** Wrapper around `ora` for consistent step-by-step progress display with timing.

**When to use:** Long-running operations (database setup, migrations, API calls).

**Example:**
```typescript
// Source: ora npm package documentation
import ora from 'ora';

interface ProgressStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: string;
}

export async function withProgress<T>(
  steps: ProgressStep[],
  fn: () => Promise<T>
): Promise<T> {
  // Display all steps from the start
  steps.forEach(step => {
    console.log(`[ ] ${step.name}`);
  });

  const spinner = ora('Starting...').start();
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.succeed(`✓ Completed [${duration}s]`);
    return result;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.fail(`✗ Failed [${duration}s]`);
    throw error;
  }
}
```

### Pattern 2: Sensitive Data Masking

**What:** Regex-based masking for database URLs and API keys in error messages.

**When to use:** Only in error logging (info/warn logs show raw data as per user constraint).

**Example:**
```typescript
// Source: Established patterns from error-validation-patterns.md research

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Mask username and host, keep protocol/dbname
    parsed.username = '***';
    parsed.hostname = '***';
    return parsed.toString();
  } catch {
    return '***masked***';
  }
}

function maskApiKey(key: string): string {
  // Show prefix (first 3 chars) + asterisks + suffix (last 3 chars)
  if (key.length <= 6) return '***';
  return `${key.slice(0, 3)}${'*'.repeat(key.length - 6)}${key.slice(-3)}`;
}

// Only apply masking in error context
function formatErrorMessage(message: string, sensitiveData?: {
  databaseUrl?: string;
  apiKey?: string;
}): string {
  let formatted = message;

  if (sensitiveData?.databaseUrl) {
    formatted = formatted.replace(sensitiveData.databaseUrl, maskDatabaseUrl(sensitiveData.databaseUrl));
  }

  if (sensitiveData?.apiKey) {
    formatted = formatted.replace(sensitiveData.apiKey, maskApiKey(sensitiveData.apiKey));
  }

  return formatted;
}
```

### Pattern 3: Dry-Run/Preview Mode

**What:** Execute all validation checks, display actions, stop before actual execution.

**When to use:** Destructive operations or any setup step that modifies resources.

**Example:**
```typescript
// Source: Dry-run patterns from setup-ux-best-practices.md and error-validation-patterns.md
interface DryRunResult {
  wouldCreate: string[];
  wouldModify: string[];
  wouldDelete: string[];
  estimatedDuration?: string;
}

export async function runSetupWithDryRun(
  dryRun: boolean
): Promise<DryRunResult | SetupResult> {
  if (!dryRun) {
    // Normal execution
    return runSetup();
  }

  // Dry-run: validate everything, show what would happen
  const result: DryRunResult = {
    wouldCreate: [],
    wouldModify: [],
    wouldDelete: [],
  };

  // Step 1: Check prerequisites
  if (!await checkNeonctlInPath()) {
    console.error('❌ neonctl not found in PATH');
    console.log('\nTo install neonctl:');
    console.log('  npm install -g neonctl');
    console.log('  bun add -g neonctl');
    throw new Error('neonctl required');
  }

  // Step 2: Validate Trigger.dev arguments
  const triggerValidation = await validateTriggerArgs();
  if (!triggerValidation.valid) {
    console.error('❌ Trigger.dev arguments invalid:', triggerValidation.error);
    throw new Error('Invalid arguments');
  }

  // Display what would happen
  console.log('\nDry Run Summary:');
  console.log('='.repeat(50));
  console.log('Would create:');
  result.wouldCreate.forEach(item => console.log(`  - ${item}`));
  console.log('\nWould modify:');
  result.wouldModify.forEach(item => console.log(`  - ${item}`));

  // Ask for confirmation
  const proceed = await promptForConfirmation('Proceed with setup? [y/N]: ');
  if (!proceed) {
    console.log('Setup cancelled.');
    process.exit(0);
  }

  // Fall through to actual setup
  return runSetup();
}
```

### Anti-Patterns to Avoid

- **Sequential reveal of steps:** Don't show steps one at a time — display full checklist first
- **Over-masking:** Don't mask in info/warn logs — only mask in error messages
- **Fake dry-run:** Don't skip validation in dry-run mode — validate everything, then stop
- **Generic error messages:** Don't use generic errors — provide specific, actionable guidance
- **Late failures:** Don't let invalid arguments propagate deeply — fail fast and early

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spinner animations | Custom frame cycling | `ora` package | Handles 20+ spinners, TTY detection, colors, Promise integration |
| Data masking regex | Complex custom patterns | Simple regex + existing validation | `maskUrl()` already exists in `setup-db.ts` line 197, extend it |
| CLI argument parsing | Full framework | Existing `parseCliArgs` | Manual parsing already works, fix Trigger.dev flag pass-through |

**Key insight:** Minimal new dependencies required. `ora` is the only addition. Most functionality can be achieved with existing code patterns and native TypeScript/JavaScript features.

## Common Pitfalls

### Pitfall 1: Progress Indicators in Non-TTY Environments

**What goes wrong:** Spinners break or produce garbled output when piped or in CI/CD.

**Why it happens:** TTY (teletype) is required for cursor manipulation; pipes and CI don't provide TTY.

**How to avoid:** Use `ora` which auto-detects non-TTY and disables animations.

**Warning signs:** Output shows `[?]` characters or escape sequences in piped output.

**Code example:**
```typescript
import ora from 'ora';

// ora auto-detects TTY, no special handling needed
const spinner = ora('Loading...').start();
// In CI/CD: will show "Loading..." without animation
```

### Pitfall 2: Over-Masking Sensitive Data

**What goes wrong:** Masking too aggressively makes troubleshooting impossible.

**Why it happens:** Applying masking everywhere instead of just error messages.

**How to avoid:** Mask only in error messages; keep raw data in info/warn logs and debug mode.

**Warning signs:** Users can't debug connection issues because all identifying info is hidden.

### Pitfall 3: Incomplete Dry-Run Validation

**What goes wrong:** Dry-run succeeds but actual execution fails.

**Why it happens:** Skipping validation checks in dry-run mode to save time.

**How to avoid:** Validate everything in dry-run, only stop before actual resource creation/modification.

**Warning signs:** User confirms dry-run, then sees different errors in real execution.

### Pitfall 4: Argument Pass-Through Failures

**What goes wrong:** CLI flags aren't passed to subprocess commands.

**Why it happens:** Incorrect subprocess argument handling (not escaping flags, wrong order).

**How to avoid:** Use `Bun.spawn()` correctly with explicit argument arrays and environment variables.

**Warning signs:** Subprocess ignores flags like `--skip-install`.

**Code example:**
```typescript
// Current (broken) in setup-trigger.ts line 57:
Bun.spawn(["bunx", "trigger.dev@latest", "init", "--skip-install"], {
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, TRIGGER_SECRET_KEY: secretKey },
});

// The issue: `--skip-install` may need to be after init
// Fix: Check trigger.dev CLI documentation for correct flag placement
```

### Pitfall 5: Unhelpful Binary Missing Errors

**What goes wrong:** "neonctl not found" without installation guidance.

**Why it happens:** Generic error message doesn't provide actionable next steps.

**How to avoid:** Include installation commands and documentation links in error messages.

**Warning signs:** Users report they're stuck after binary missing errors.

**Code example:**
```typescript
// Current in setup-db.ts line 94:
return {
  step: "database",
  status: "error",
  message: "neonctl CLI not found. Install it: npm i -g neonctl (or bun add -g neonctl)",
};

// This is already good — extend with more specific guidance:
return {
  step: "database",
  status: "error",
  message: "neonctl CLI not found in PATH",
  data: {
    suggestion: "Install neonctl to continue setup:",
    commands: [
      "npm install -g neonctl",
      "bun add -g neonctl",
    ],
    docs: "https://neon.tech/docs/reference/cli-reference",
  },
};
```

## Code Examples

Verified patterns from existing codebase and research:

### Progress Indicator Pattern (to be added)

```typescript
// File: src/cli/utils/progress.ts (NEW)
import ora from 'ora';

export interface StepProgress {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: string;
}

export function createProgressStep(steps: string[]): void {
  console.log('\nSetup Steps:');
  console.log('='.repeat(50));
  steps.forEach(step => {
    console.log(`[ ] ${step}`);
  });
  console.log('='.repeat(50));
}

export async function runStep<T>(
  stepName: string,
  fn: () => Promise<T>
): Promise<T> {
  const spinner = ora(`Running: ${stepName}...`).start();
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.succeed(`✓ ${stepName} [${duration}s]`);
    return result;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    spinner.fail(`✗ ${stepName} [${duration}s]`);
    throw error;
  }
}
```

### URL Masking Pattern (existing in codebase)

```typescript
// File: src/cli/setup-db.ts (existing, lines 197-205)
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.password = "***";
    return parsed.toString();
  } catch {
    return "***masked***";
  }
}

// Extend to mask username and host per user constraint:
function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "***";
    parsed.hostname = "***";
    parsed.password = "***";
    return parsed.toString();
  } catch {
    return "***masked***";
  }
}
```

### API Key Masking Pattern (to be added)

```typescript
// File: src/cli/utils/masking.ts (NEW)
export function maskApiKey(key: string): string {
  if (!key || key.length < 6) return '***';

  // Show prefix + asterisks + suffix
  // Example: "tr_dev_abc123def456" -> "tr_dev_***456"
  const prefixLength = 3;
  const suffixLength = 3;

  if (key.length <= prefixLength + suffixLength) {
    return '***';
  }

  return `${key.slice(0, prefixLength)}${'*'.repeat(key.length - prefixLength - suffixLength)}${key.slice(-suffixLength)}`;
}
```

### Error Message with Masking Pattern (to be added)

```typescript
// File: src/cli/utils/masking.ts (NEW)
export function formatErrorWithMasking(
  message: string,
  context?: {
    databaseUrl?: string;
    apiKey?: string;
    [key: string]: any;
  }
): string {
  let formatted = message;

  if (!context) return formatted;

  // Mask database URLs in context
  if (context.databaseUrl) {
    const masked = maskDatabaseUrl(context.databaseUrl);
    formatted = formatted.replace(context.databaseUrl, masked);
  }

  // Mask API keys in context
  if (context.apiKey) {
    const masked = maskApiKey(context.apiKey);
    formatted = formatted.replace(context.apiKey, masked);
  }

  return formatted;
}
```

### Dry-Run Pattern (to be added)

```typescript
// File: src/cli/setup.ts (modify existing runSetup function)
export async function runSetup(
  dryRun = false,
  preview = false
): Promise<SetupOutput> {
  const steps: SetupResult[] = [];

  // Dry-run or preview mode
  if (dryRun || preview) {
    console.log('\n=== Dry Run / Preview Mode ===');
    console.log('Validating setup configuration...\n');

    // Run all validations without executing
    const validations = await validateAll();

    if (!validations.allPassed) {
      console.log('\nValidation failed:');
      validations.results.forEach(r => {
        if (r.status === 'fail') {
          console.log(`  ✗ ${r.check}: ${r.message}`);
        }
      });
      return { steps: [], validation: validations, completed: false };
    }

    // Show what would happen
    console.log('\n=== What would be executed ===');
    console.log('Step 1: Collect API keys (NEON_API_KEY, TRIGGER_SECRET_KEY)');
    console.log('Step 2: Create Neon database project');
    console.log('Step 3: Run database migrations');
    console.log('Step 4: Configure Trigger.dev project');
    console.log('Step 5: Set up platform OAuth (X, LinkedIn, Instagram, TikTok)');
    console.log('Step 6: Validate all connections');

    // Ask for confirmation
    const confirm = await promptForConfirmation('\nProceed with setup? [y/N]: ');
    if (!confirm) {
      console.log('Setup cancelled.');
      process.exit(0);
    }

    // Fall through to actual execution
    console.log('\n=== Executing Setup ===\n');
  }

  // Normal execution continues...
  // (existing code)
}
```

### Neonctl PATH Error Improvement (modify existing)

```typescript
// File: src/cli/setup-db.ts (modify existing line 90-96)
// Current:
try {
  const which = Bun.spawn(["which", "neonctl"], { stdout: "pipe", stderr: "pipe" });
  await which.exited;
  if (which.exitCode !== 0) {
    throw new Error("not found");
  }
} catch {
  return {
    step: "database",
    status: "error",
    message: "neonctl CLI not found. Install it: npm i -g neonctl (or bun add -g neonctl)",
  };
}

// Improved with more detailed guidance:
try {
  const which = Bun.spawn(["which", "neonctl"], { stdout: "pipe", stderr: "pipe" });
  await which.exited;
  if (which.exitCode !== 0) {
    throw new Error("not found");
  }
} catch {
  return {
    step: "database",
    status: "error",
    message: "neonctl CLI not found in PATH",
    data: {
      suggestion: "Install neonctl to continue with database setup:",
      commands: [
        "npm install -g neonctl",
        "bun add -g neonctl",
      ],
      docs: "https://neon.tech/docs/reference/cli-reference",
      troubleshooting: [
        "After installation, restart your terminal or run: source ~/.bashrc (or ~/.zshrc)",
        "Verify installation with: neonctl version",
      ],
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| No progress feedback | ora spinners with timing | 2026-02-21 | Users can track long-running operations |
| Raw sensitive data in errors | Masked URLs and keys | 2026-02-21 | Improved security and debugging capability |
| Execute immediately | Dry-run/preview before execution | 2026-02-21 | Safer setup, user control |
| Generic binary errors | Actionable error messages | 2026-02-21 | Faster recovery from failures |

**Deprecated/outdated:**
- Manual progress logging: ora provides better UX with auto-TTY detection
- Unmasked error logging: Security best practices require masking in error messages

## Open Questions

None. All research areas have clear implementation paths based on existing code patterns and well-documented best practices.

## Sources

### Primary (HIGH confidence)
- [ora npm package](https://www.npmjs.com/package/ora) - Terminal spinner library with 20+ types, Promise integration, auto-TTY detection
- [readline-sync npm package](https://www.npmjs.com/package/readline-sync) - Currently in package.json v1.4.10, provides masked input with `hideEchoBack` and `mask` options
- [CLI Error Handling Research](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis) - Atlassian CLI design principles (error messages, actionable guidance)
- [Dry-Run Best Practices](https://kubernetes.io/docs/tasks/debug/debug-application/) - Kubernetes dry-run patterns, applicable to CLI tools
- [Exit Code Standards](https://cli.urfave.org/) - Unix exit code conventions (0=success, 1=error, 2=usage error, 127=not found)

### Secondary (MEDIUM confidence)
- [setup-ux-best-practices.md](/home/hybridz/Projects/post-shit-now/.planning/research/setup-ux-best-practices.md) - Existing research on CLI setup wizard patterns, progress indicators, dry-run modes
- [error-validation-patterns.md](/home/hybridz/Projects/post-shit-now/.planning/research/error-validation-patterns.md) - Existing research on error handling, validation, sensitive data masking
- [CLI Terminal Interaction Design](https://oras.land/docs/) - ORAS CLI error message design principles (three-layer architecture)
- [Sensitive Data Masking Patterns](https://github.com/secretlint/secretlint) - Secretlint patterns for masking sensitive data

### Tertiary (LOW confidence)
- [Bun/bunx Documentation](https://bun.sh/docs/cli/bunx) - bunx usage patterns, specific Trigger.dev flag handling needs verification with official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `ora` and `readline-sync` are well-established, `readline-sync` already in project
- Architecture: HIGH - Progress indicator, masking, and dry-run patterns are well-documented with clear code examples
- Pitfalls: HIGH - Common CLI UX pitfalls documented with specific prevention strategies
- Implementation: HIGH - Existing codebase has patterns to extend (e.g., `maskUrl()` in setup-db.ts)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - CLI libraries stable, patterns well-established)
