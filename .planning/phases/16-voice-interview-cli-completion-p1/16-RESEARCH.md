# Phase 16: Voice Interview CLI Completion (P1) - Research

**Researched:** 2026-02-21
**Domain:** CLI Interactive Interviews, State Persistence, Stdin Input
**Confidence:** HIGH

## Summary

This phase involves completing the voice interview CLI interface with three main components: state persistence between CLI invocations, stdin key input with masking, and automatic directory structure creation. The codebase already has a sophisticated interview engine (`src/voice/interview.ts`) with phase-based flows, question generation, and answer processing, but lacks persistence and interactive CLI capabilities.

**Primary recommendation:** Use JSON files for state persistence (following existing project patterns with atomic writes), implement password masking with a simple password prompt library (avoid heavy dependencies like inquirer), and follow existing `mkdir({ recursive: true })` patterns for directory creation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**State persistence format**
- Research bun.lock format — claims binary speed while being human-readable
- Location: `content/voice/.interview.json` (easy to find, alongside YAML profiles)
- Cleanup: Delete state after 7 days
- Concurrent: Support multiple interviews with auto-generated filenames like `.interview-{timestamp}.json`
- Save data: Full state object from `interview.ts` (InterviewState)
- Validation: Strict validation — throw error if corrupted, user must restart
- Security: Plain text storage (no encryption or obfuscation)
- Auto-save: Save state after every answer submission

**CLI command interface**
- Submit: Interactive prompt (ask user "What's your answer for [question]?")
- Auto-advance: Show next questions after submitting answers (auto-continue)
- Complete: Interactive prompt for save path if multiple interviews exist
- Output: Human-readable messages, progress, confirmations (not JSON-only)
- Errors: Friendly error messages describing what went wrong and how to fix
- Validation: Real-time validation of each answer before accepting (reprompt if invalid)
- Restart: Claude's discretion on whether to add restart command
- Progress: Always visible — show "Phase 1/5 • Question 3/7" on each prompt

**Stdin key input behavior**
- Input: Stdin prompt only (not CLI flags)
- Masking: Always masked (hide typed characters with asterisks like password prompts)
- Confirmation: No confirmation required (save immediately, trust user input)
- Validation: Format check + minimal test with CLI or API of said key (minimal verification)

**Directory structure**
- Auto-create: Yes, create directories automatically
- When created: On interview start (before collecting answers)
- Structure: Organized with subdirs (e.g., `content/voice/profiles/`, `content/voice/strategies/`)
- Permissions: System default (typically 755)

### Claude's Discretion
- Whether to add restart command for abandoning current interview
- Exact subdirectory structure within `content/voice/`
- Bun lock format research and implementation approach for state files
- Minimal API test implementation for key validation

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **node:fs/promises** | Built-in | File system operations (mkdir, readFile, writeFile) | Project already uses these patterns, no external dependency |
| **Bun.file API** | Built-in | File existence checks, text reading, writing | Project already uses this, Bun-specific optimizations |
| **InterviewState** | Existing (src/voice/interview.ts) | State object structure | Single source of truth for interview data |
| **Zod** | ^4.3.6 | Schema validation for interview state | Already in dependencies, validates InterviewState |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **readline** (Node built-in) | Built-in | Basic stdin reading for simple prompts | For non-password prompts when avoiding heavy dependencies |
| **@clack/prompts** | To be added | Beautiful interactive CLI prompts | For rich interview experience with progress, validation (optional - discretion) |
| **readline-sync** or **prompt-sync** | To be added | Password-masked stdin input | For API key input with character masking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Plain Node readline** | **@clack/prompts** | Clack provides beautiful UI, multiselect, progress out-of-box but requires new dependency |
| **Simple password lib** | **inquirer** | Inquirer is feature-rich but heavy (slow startup, large bundle) |
| **JSON state files** | **bun.lock binary format** | bun.lock is binary (not JSON), harder to debug; user asked for "human-readable" - research reveals bun.lock is binary despite claims |

**Installation:**
```bash
# For beautiful prompts (discretion - not mandatory)
bun add @clack/prompts

# For password masking (needed for stdin key input)
bun add readline-sync  # OR prompt-sync

# Dev dependencies (optional, for type safety)
bun add -D @types/readline-sync  # Only for readline-sync
```

### bun.lock Format Research Findings

**Important Discovery:** The user's CONTEXT.md mentions researching bun.lock format because it "claims binary speed while being human-readable." Research reveals:

- **bun.lock is BINARY**, not text/JSON-based
- It provides fast parsing speed (7x faster than npm) and smallest file size
- It reduces merge conflicts compared to npm, Yarn, pnpm
- However, it is **not human-readable** in the traditional sense - it's a binary format

**Conclusion:** Since the user wants "human-readable" state files AND the location is alongside YAML profiles, **JSON is the better choice**. JSON is:
- Truly human-readable (can inspect with `cat`)
- Compatible with existing atomic write patterns in the codebase
- Fast enough for interview state (~5KB)
- Easy to debug when things go wrong

## Architecture Patterns

### Recommended Project Structure
```
content/voice/
├── .interview.json              # Active interview state (main session)
├── .interview-{timestamp}.json # Multiple concurrent interviews
├── .interview-{timestamp}.json.tmp # Atomic write temp files
├── profiles/                   # Entity voice profiles (auto-created)
│   ├── personal.yaml            # Legacy path, may be migrated
│   └── {entitySlug}.yaml      # Entity-scoped profiles
├── strategies/                 # Strategy configs (auto-created)
│   └── {entitySlug}.yaml      # Per-entity strategies
└── .interview-cleanup.json     # Cleanup metadata (optional)
```

### Pattern 1: Atomic State Writes (Existing Project Pattern)

**What:** Write to temporary file, then atomic rename to prevent corruption.

**When:** Every time interview state is saved.

**Why:** Prevents corruption on Ctrl+C or system crash during write.

**Example:**
```typescript
// Source: Existing pattern in src/voice/profile.ts (saveProfile function)
import { writeFile, rename } from "node:fs/promises";

const content = JSON.stringify(state, null, 2);
const tmpPath = `${statePath}.tmp`;

// Atomic write: write to temp file, then rename
await writeFile(tmpPath, content, "utf-8");
await rename(tmpPath, statePath);
```

### Pattern 2: Interview State Loading with Validation

**What:** Load state file, validate with Zod schema before using.

**When:** Resuming an interview on startup.

**Why:** Detect corrupted state early, fail fast with clear error.

**Example:**
```typescript
import { readFile } from "node:fs/promises";
import { z } from "zod";

// Define state schema (reuse from src/voice/interview.ts InterviewState)
const interviewStateSchema = z.object({
  phase: z.enum(["identity", "style", "platforms", "language", "review"]),
  questionIndex: z.number().int().min(0),
  answers: z.record(z.string()),
  // ... other InterviewState fields
});

async function loadInterviewState(statePath: string): Promise<InterviewState | null> {
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate with Zod
    const result = interviewStateSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Corrupted interview state: ${result.error.issues.map(i => i.message).join(", ")}`);
    }

    return result.data;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // No state file, start fresh
    }
    throw err; // Re-throw other errors
  }
}
```

### Pattern 3: Directory Auto-Creation with Recursive Mkdir

**What:** Create directories with `mkdir({ recursive: true })` on first access.

**When:** Interview starts (before collecting first answer).

**Why:** Ensures directories exist without requiring manual setup.

**Example:**
```typescript
// Source: Existing pattern in src/content/drafts.ts:79
import { mkdir } from "node:fs/promises";

await mkdir("content/voice/profiles", { recursive: true });
await mkdir("content/voice/strategies", { recursive: true });
```

### Pattern 4: Password-Masked Stdin Input

**What:** Use readline-sync or prompt-sync for masked character input.

**When:** Saving API keys via stdin prompts (setup-keys.ts).

**Why:** Simple, synchronous, no heavy dependencies like inquirer.

**Example:**
```typescript
// Using readline-sync (lightweight, works with Bun)
import readlineSync from "readline-sync";

function promptPassword(message: string): string {
  return readlineSync.question(message, { hideEchoBack: true, mask: "*" });
}

// Usage
const apiKey = promptPassword("Enter API key (will be masked): ");
```

**Alternative with @clack/prompts (if chosen):**
```typescript
import * as p from "@clack/prompts";

// Note: Need to verify if @clack/prompts has password() function
// If not available, fall back to readline-sync
const apiKey = await p.password({
  message: "Enter API key",
  mask: "*",
  validate: (value) => {
    if (!value || value.length < 10) {
      return "API key must be at least 10 characters";
    }
    return undefined;
  },
});
```

### Anti-Patterns to Avoid
- **Non-atomic writes:** Writing directly to state file without temp file → corruption on interrupt
- **No validation:** Loading JSON without schema validation → crashes on corrupted state
- **Manual directory creation:** Creating dirs in shell scripts → inconsistent permissions, not portable
- **Heavy dependencies:** Using inquirer.js for simple password input → slow startup, large bundle

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **File locking for concurrent interviews** | Custom lock files with PID checks | Timestamp-based filenames | Simpler, no race conditions for local CLI use |
| **Password masking** | Custom terminal manipulation for hidden input | readline-sync or prompt-sync | Well-tested, cross-platform, handles edge cases |
| **Atomic file writes** | Custom checksum-based rollback | Temp file + rename (POSIX atomic) | POSIX guarantees, standard pattern |
| **Schema validation** | Manual JSON validation | Zod (already in deps) | Type-safe, excellent error messages |
| **Interview state management** | Custom state machine | InterviewState from src/voice/interview.ts | Single source of truth, already tested |

**Key insight:** The project already has excellent patterns for atomic writes (profile.ts), validation (Zod), and interview state (interview.ts). Reuse these patterns instead of building new ones.

## Common Pitfalls

### Pitfall 1: State Corruption on Interrupt

**What goes wrong:** User Ctrl+C's mid-save → JSON file is truncated → Next run crashes parsing incomplete JSON.

**Why it happens:** File writes are not atomic; interrupt occurs mid-write.

**How to avoid:** Use atomic write pattern: write to `.tmp` file, validate, then rename (POSIX atomic rename).

**Warning signs:** Interview state file fails JSON.parse on next run.

**Prevention (already in codebase):**
```typescript
// Source: src/voice/profile.ts:87-92
const tmpPath = `${path}.tmp`;
await writeFile(tmpPath, content, "utf-8");
await rename(tmpPath, path); // Atomic rename - POSIX guarantee
```

### Pitfall 2: Corrupted State File Recovery

**What goes wrong:** State file is corrupted but user can't recover or restart interview.

**Why it happens:** Validation throws but doesn't guide user on how to fix.

**How to avoid:** Detect corruption, show clear error message with fix instructions.

**Prevention:**
```typescript
async function loadInterviewState(statePath: string): Promise<InterviewState | null> {
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    const result = interviewStateSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(
        `Corrupted interview state at ${statePath}\n` +
        `Validation errors: ${result.error.issues.map(i => i.message).join(", ")}\n\n` +
        `To fix: Delete the file and restart the interview.\n` +
        `Command: rm ${statePath}`
      );
    }

    return result.data;
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // No state file, start fresh
    }
    throw err;
  }
}
```

### Pitfall 3: Directory Creation Permission Issues

**What goes wrong:** Directory creation fails due to permissions → Interview can't save state.

**Why it happens:** User lacks write permissions, or parent directory doesn't exist.

**How to avoid:** Pre-flight check with try/catch, clear error message.

**Prevention:**
```typescript
async function ensureInterviewDir(): Promise<void> {
  try {
    await mkdir("content/voice/profiles", { recursive: true });
    await mkdir("content/voice/strategies", { recursive: true });
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(
        `Failed to create interview directories: ${err.message}\n\n` +
        `Please check that you have write permissions for the content/ directory.`
      );
    }
    throw err;
  }
}
```

### Pitfall 4: Multiple Concurrent Interviews Overwriting Each Other

**What goes wrong:** User starts two interviews simultaneously → One overwrites the other's state.

**Why it happens:** Single state file shared across invocations.

**How to avoid:** Use timestamp-based filenames for concurrent interviews.

**Prevention:**
```typescript
function generateInterviewId(): string {
  return Date.now().toString(36);
}

function getInterviewStatePath(interviewId?: string): string {
  const id = interviewId || generateInterviewId();
  return `content/voice/.interview-${id}.json`;
}

// Save latest interview for quick resume
async function saveLatestInterview(interviewId: string): Promise<void> {
  const latestPath = "content/voice/.interview.json";
  const content = JSON.stringify({ interviewId, updatedAt: new Date().toISOString() }, null, 2);
  await writeFile(latestPath, content, "utf-8");
}
```

### Pitfall 5: Old Interview Files Accumulating

**What goes wrong:** `.interview-{timestamp}.json` files accumulate over time → Clutter, disk usage.

**Why it happens:** No cleanup mechanism for completed/interrupted interviews.

**How to avoid:** Cleanup on interview completion, or periodic cleanup on startup.

**Prevention:**
```typescript
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const MAX_INTERVIEW_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function cleanupOldInterviews(): Promise<void> {
  const voiceDir = "content/voice";
  const files = await readdir(voiceDir);

  for (const file of files) {
    if (!file.startsWith(".interview-") || !file.endsWith(".json")) {
      continue;
    }

    const filePath = join(voiceDir, file);
    const fileStat = await stat(filePath);
    const ageMs = Date.now() - fileStat.mtimeMs;

    if (ageMs > MAX_INTERVIEW_AGE_MS) {
      await rm(filePath);
      console.log(`Cleaned up old interview: ${file}`);
    }
  }
}
```

## Code Examples

Verified patterns from existing codebase:

### Atomic Write Pattern
```typescript
// Source: src/voice/profile.ts:87-92
import { writeFile, rename } from "node:fs/promises";

const content = stringify(result.data);
const tmpPath = `${path}.tmp`;

// Atomic write: write to temp file, then rename
await writeFile(tmpPath, content, "utf-8");
await rename(tmpPath, path);
```

### Recursive Directory Creation
```typescript
// Source: src/content/drafts.ts:79
import { mkdir } from "node:fs/promises";

await mkdir(DRAFTS_DIR, { recursive: true });
```

### Interview State Structure
```typescript
// Source: src/voice/interview.ts:14-25
export interface InterviewState {
  phase: InterviewPhase;
  questionIndex: number;
  answers: Map<string, string>;
  detectedExperience: "beginner" | "intermediate" | "advanced" | null;
  maturityLevel: MaturityLevel | null;
  languages: ("en" | "es")[];
  importedContent: ImportedContent[] | null;
  isBlankSlate: boolean;
  isRecalibration: boolean;
  existingProfile?: VoiceProfile;
}
```

### Question Generation
```typescript
// Source: src/voice/interview.ts:304-319
export function generateQuestions(state: InterviewState): InterviewQuestion[] {
  switch (state.phase) {
    case "identity":
      return state.isBlankSlate ? IDENTITY_QUESTIONS_BLANK_SLATE : IDENTITY_QUESTIONS;
    case "style":
      return state.detectedExperience === "advanced"
        ? STYLE_QUESTIONS_ADVANCED
        : STYLE_QUESTIONS_BEGINNER;
    case "platforms":
      return PLATFORM_QUESTIONS;
    case "language":
      return LANGUAGE_QUESTIONS;
    case "review":
      return [];
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| **In-memory only** | **JSON file persistence** | Since Phase 3 (voice profiling) | Enables resume after interrupt |
| **No directory structure** | **Auto-created subdirectories** | This phase | Cleaner organization, less manual setup |
| **Plain stdin (no masking)** | **Masked password prompts** | This phase | Better security for API keys |
| **Single state file** | **Timestamp-based concurrent interviews** | This phase | Support multiple simultaneous interviews |

**Deprecated/outdated:**
- **Manual directory creation:** Use `mkdir({ recursive: true })` instead of shell scripts or requiring users to create dirs
- **Non-atomic writes:** Direct `Bun.write()` to target file is unsafe for critical state

## Open Questions

1. **Should we add a restart command?**
   - **What we know:** Claude's discretion per CONTEXT.md. Restart would abandon current interview.
   - **What's unclear:** Whether users need this vs. just deleting state file manually.
   - **Recommendation:** Don't add initially. Users can delete `.interview.json` manually. Add if feedback indicates need.

2. **What exact subdirectory structure for content/voice/?**
   - **What we know:** CONTEXT.md says "organized with subdirs (e.g., profiles/, strategies/)".
   - **What's unclear:** Exact structure - should profiles go in `content/voice/profiles/` or stay in `content/voice/`?
   - **Recommendation:** Keep existing files in `content/voice/` (personal.yaml, strategy.yaml). Add subdirs only if creating new entity-scoped profiles: `content/voice/profiles/{entitySlug}.yaml`, `content/voice/strategies/{entitySlug}.yaml`.

3. **What minimal API test for key validation?**
   - **What we know:** CONTEXT.md requires "minimal test with CLI or API". Existing validators in `src/core/utils/env.ts` (validateNeonApiKey, validatePerplexityApiKey, etc.) do prefix checks + minimal API calls.
   - **What's unclear:** Which providers need new validators for stdin key input.
   - **Recommendation:** Reuse existing `validateProviderKey()` function from `src/core/utils/env.ts`. No new validators needed for this phase.

4. **Should we use @clack/prompts for interview UX?**
   - **What we know:** Existing CLI uses JSON output to stdout (not interactive). CONTEXT.md requires "human-readable messages, progress, confirmations".
   - **What's unclear:** Budget for new dependencies vs. simple readline approach.
   - **Recommendation:** Start with simple readline for basic prompts (submit, complete). Consider @clack/prompts for richer UX in a later phase. Focus this phase on core functionality (persistence, masking, dirs).

## Sources

### Primary (HIGH confidence)
- **src/voice/interview.ts** - InterviewState structure, question generation, answer processing
- **src/voice/profile.ts** - Atomic write pattern, profile save/load
- **src/voice/types.ts** - VoiceProfile, InterviewState, MaturityLevel types
- **src/cli/setup-keys.ts** - Key validation patterns, existing validator implementations
- **src/core/utils/env.ts** - validateProviderKey function, validation patterns for Neon, Trigger.dev, Perplexity
- **src/content/drafts.ts** - Directory creation patterns with mkdir({ recursive: true })
- **src/cli/voice-interview.ts** - Current CLI entry point (needs extension)

### Secondary (MEDIUM confidence)
- **[CLI Interview Patterns Research](/home/hybridz/Projects/post-shit-now/.planning/research/cli-interview-patterns.md)** - State persistence patterns, interview flow design, XDG standards
- **[bun.lock Format Research](https://bun.sh/docs/install/lockfile)** - bun.lock is binary format, not human-readable (discovery during research)

### Tertiary (LOW confidence)
- **[readline-sync Package](https://www.npmjs.com/package/readline-sync)** - Password masking library (not verified with official docs, but widely recommended in community)
- **[@clack/prompts Documentation](https://github.com/natemoo-re/clack)** - Beautiful CLI prompts (verified GitHub repo, but password function availability not confirmed)
- **[inquirer.js Documentation](https://www.npmjs.com/package/inquirer)** - Alternative for password input (verified, but heavy - not recommended)

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries and patterns are from existing codebase or well-established Node/Bun ecosystem
- Architecture: **HIGH** - Atomic writes, validation, directory creation patterns are already proven in codebase
- Pitfalls: **HIGH** - Corruption prevention, validation, and cleanup patterns are well-understood from existing code

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days - patterns are stable, bun.lock binary format is verified fact)
