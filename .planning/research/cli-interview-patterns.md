# CLI Interview Patterns: Multi-Step Interactive Flows and State Persistence

**Research Date:** 2026-02-20
**Domain:** CLI Tools with Interactive Interview Flows
**Overall Confidence:** MEDIUM

## Executive Summary

Research into CLI tools with multi-step interactive flows reveals established patterns and modern libraries for building sophisticated command-line interfaces. The ecosystem has matured significantly, with several well-maintained libraries offering beautiful, type-safe interactive prompts. Key findings include: **Clack** as a modern, TypeScript-first option with beautiful UI; **@inquirer/prompts** as a lighter, more performant successor to the classic inquirer.js; and established state management patterns using JSON/YAML files following XDG directory standards.

The current PSN codebase already implements a sophisticated interview engine (`src/voice/interview.ts`) with phase-based flows, branching logic, and answer processing. However, it lacks state persistence between CLI invocations and could benefit from modern prompt libraries for better user experience.

**Critical gap:** No resume capability exists for interrupted interviews. Users must restart from the beginning if they exit mid-interview. This is a major UX friction point for lengthy voice profile interviews.

---

## Key Findings

### Interactive CLI Libraries (HIGH Confidence)

| Library | Status | Strengths | Weaknesses | Best For |
|---------|---------|------------|-------------|----------|
| **@clack/prompts** | Actively maintained | Beautiful UI, TypeScript-first, simple API, multiselect support | Smaller ecosystem than inquirer.js | Modern CLIs with emphasis on UX |
| **@inquirer/prompts** | New architecture | High performance, lighter than classic inquirer, full TypeScript support | Less mature ecosystem | Performance-sensitive tools |
| **inquirer.js** | Classic, established | Huge ecosystem, extensive plugins, rich prompt types | Large bundle, slow startup | Maximum feature needs |
| **prompts** | Stable | Lightweight, simple API, good TypeScript | Relatively simple functionality | Performance/utility tools |
| **enquirer** | Stable | Modern design, custom prompts | Sparse docs, smaller ecosystem | Stylish CLIs with custom needs |

### State Persistence Patterns (MEDIUM Confidence)

**XDG Directory Standards** are the established pattern for CLI state file locations:

| Directory | Purpose | Example Path | Content |
|-----------|---------|--------------|---------|
| `XDG_CONFIG_HOME` | User preferences | `~/.config/psn/` | Settings, auth tokens |
| `XDG_STATE_HOME` | Application state | `~/.local/state/psn/` | Interview state, history |
| `XDG_CACHE_HOME` | Temporary cache | `~/.cache/psn/` | API responses, temp data |
| `XDG_DATA_HOME` | Important user data | `~/.local/share/psn/` | Portable user data |

**State File Formats:**
- **JSON:** Most common, easy to parse, good for interview state
- **YAML:** Human-readable, good for configuration files
- **Binary (SQLite):** Best for complex relational data, provider keys

**File Naming Patterns:**
- Session files: `last_session.json`, `session-{timestamp}.json`
- Checkpoint files: `checkpoint-*.json`, `ckpt-*.yaml`
- Pattern matching for resume: glob patterns to find latest modified file

### Interview Flow Patterns (HIGH Confidence)

**Well-known interview-style CLIs:**
1. **`npm init`**: Step-by-step questionnaire with defaults, supports `-y` for non-interactive mode
2. **`git init`**: Simple initialization, often chained with other setup commands
3. **Custom init tools** (`ginit`): Enhanced flows combining multiple operations

**Common interview characteristics:**
- Sequential question presentation
- Branching logic based on previous answers
- Validation with retry on invalid input
- Progress tracking and feedback
- Optional questions with skip capability

### Answer Submission Patterns (MEDIUM Confidence)

**Dual-mode pattern:** Modern CLIs support both interactive and batch modes:
- **Interactive mode:** Conversational Q&A, step-by-step guidance
- **Batch mode:** Non-interactive, accepts pre-defined answers via flags or config files

**Validation patterns:**
- Client-side validation (regex, type checking)
- Server-side validation for API calls
- Immediate feedback with error messages
- Retry loops until valid input received

---

## Recommended Stack

### Interactive Prompts Library

**Recommendation:** Use **@clack/prompts** for PSN CLI interview flows.

**Why @clack/prompts:**
1. **TypeScript-first**: Written in TypeScript, excellent type inference
2. **Beautiful UI**: Modern, minimal design with smooth animations
3. **Simple API**: Easy to learn, quick to implement
4. **Multiselect support**: Essential for content pillars, platforms, etc.
5. **Spinner component**: Built-in loading states for async operations
6. **Group functionality**: Chain multiple prompts with access to previous answers

**Alternatives considered:**
- **@inquirer/prompts**: Better performance but smaller ecosystem, less visually polished
- **inquirer.js**: Too heavy, slow startup
- **prompts**: Too simple, lacks multiselect

**Installation:**
```bash
bun add @clack/prompts
# Dev dependencies for type safety
bun add -D @types/node
```

### State Management

**Recommendation:** Use **JSON files** following XDG standards with Bun's file API.

**Why JSON + XDG:**
1. **Bun's file API**: Simple, fast, built-in JSON serialization
2. **XDG compliance**: Respects user expectations, easy cleanup
3. **Human-readable**: Easy to inspect/debug interview state
4. **Simple schema**: Interview state is flat, no complex relationships

**State file locations:**
- Interview state: `~/.local/state/psn/interview-{userId}-{timestamp}.json`
- Latest session: `~/.local/state/psn/last-interview.json`
- Configuration: `~/.config/psn/config.json`

**Alternatives considered:**
- **YAML**: More readable but requires `yaml` library (already in dependencies)
- **SQLite**: Overkill for interview state, better for provider keys (already in use)
- **Redis**: Too complex for local CLI state

### State Persistence Library

**Recommendation:** Use **custom implementation** with Bun's file API, no external library needed.

**Why custom implementation:**
1. **Simple requirements**: Just save/load JSON files
2. **No external deps**: Bun's file API is sufficient
3. **Full control**: Tailor to PSN's specific interview structure

**Implementation pattern:**
```typescript
// Save interview state
const statePath = join(xdgStateHome, 'psn', `interview-${userId}-${timestamp}.json`);
await ensureDir(dirname(statePath));
await Bun.write(statePath, JSON.stringify(state, null, 2));

// Save as last session for quick resume
const lastSessionPath = join(xdgStateHome, 'psn', 'last-interview.json');
await Bun.write(lastSessionPath, JSON.stringify({
  ...state,
  path: statePath
}, null, 2));

// Load last session
const lastSession = JSON.parse(await Bun.file(lastSessionPath).text());
```

**Alternatives considered:**
- **conf**: Electron-focused, not ideal for CLI
- **configstore**: Node-only, doesn't leverage Bun's APIs
- **lowdb**: Overkill, adds unnecessary complexity

---

## Feature Landscape

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Question display** | Core functionality | Low | Must show prompt text clearly |
| **Input validation** | Prevent invalid state | Medium | Regex, type checking, range validation |
| **Error feedback** | Users need to know what went wrong | Low | Clear, actionable error messages |
| **Progress indication** | Multi-step interviews need feedback | Low | "Step X of Y" or percentage |
| **Required/optional markers** | Users should know what's mandatory | Low | Visual distinction in UI |
| **Help text/hints** | Users need guidance | Low | Example inputs, format hints |
| **Cancel/exit** | Users must be able to abort | Low | Graceful shutdown, cleanup |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Resume capability** | Major UX improvement for long interviews | High | Save state, detect incomplete on startup |
| **Branching logic** | Adaptive interviews feel intelligent | Medium | Different question paths based on answers |
| **Experience detection** | Skip irrelevant questions, reduce friction | Medium | Analyze answers, import content for context |
| **Multi-select** | Essential for pillars, platforms, etc. | Medium | Built into @clack/prompts |
| **Default values** | Faster completion for common cases | Low | Pre-fill based on detected context |
| **Batch mode** | Automation and scripting support | Medium | Accept answers from flags/config files |
| **Progress checkpointing** | Resume from interruption mid-phase | High | Save after each question or phase |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Nested menus** | Complex navigation, confusing for CLI | Single-level sequential flows |
| **Unlimited branching** | Maintenance nightmare, unpredictable paths | Limited branching with clear paths |
| **Complex conditional logic** | Hard to test, confusing UX | Simple if/else, no complex rules |
| **Persistent wizard sessions** | Clutter, security risk | Auto-cleanup completed sessions |
| **Custom key bindings** | Users expect standard navigation | Use standard CLI patterns |

### Feature Dependencies

```
State persistence → Resume capability
Branching logic → Experience detection
Validation → Error feedback
Multi-select → Progress tracking
```

### MVP Recommendation

**Prioritize for initial implementation:**
1. Resume capability (save/load interview state)
2. Branching logic (different questions based on experience)
3. Progress indication (show current step)
4. Multi-select support (content pillars, platforms)
5. Validation with feedback (clear error messages)

**Defer:**
- Batch mode (can be added later for automation)
- Advanced progress checkpointing (resume from mid-question is sufficient)
- Experience detection from imported content (can be added in iteration)

---

## Architecture Patterns

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Entry Point                        │
│                (src/cli/interview.ts)                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Interview Orchestrator                         │
│  - Check for saved state                                  │
│  - Load or create interview state                          │
│  - Drive conversation flow                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌──────────────────┐     ┌──────────────────┐
│  Prompt Engine   │     │ State Manager    │
│  (@clack/prompts)│     │  (JSON + XDG)    │
└──────────────────┘     └──────────────────┘
          │                         │
          └────────────┬────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           Interview State (In-Memory)                      │
│  - Current phase                                         │
│  - Question index                                        │
│  - Answers map                                           │
│  - Detected experience                                    │
│  - Flags (blankSlate, isRecalibration)                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Finalizer (Voice Profile Generation)                │
│  - Convert interview state to VoiceProfile                │
│  - Save to YAML profile file                            │
│  - Generate strategy if needed                            │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **CLI Entry Point** | Parse args, invoke orchestrator | Orchestrator |
| **Orchestrator** | Drive flow, manage state lifecycle | Prompt Engine, State Manager, Interview State |
| **Prompt Engine** (@clack/prompts) | Display UI, collect input | Orchestrator |
| **State Manager** | Save/load state files, cleanup | Orchestrator, filesystem |
| **Interview State** | Hold current answers, metadata | Orchestrator, Finalizer |
| **Finalizer** | Generate profile from state | Interview State, Profile Persistence |

### Data Flow

```
1. User invokes CLI
   ↓
2. Orchestrator checks for saved state (State Manager)
   ↓
3a. State found → Prompt user to resume or restart
   3b. No state → Create new Interview State
   ↓
4. Orchestrator generates questions for current phase
   ↓
5. Prompt Engine displays question, collects answer
   ↓
6. Answer validated → Update Interview State
   ↓
7. State Manager saves checkpoint (after each answer or phase)
   ↓
8. Check if phase complete → Advance to next phase or finalize
   ↓
9. If interview complete → Finalizer generates profile
   ↓
10. State Manager cleans up temporary state files
```

### Patterns to Follow

#### Pattern 1: State Snapshotting

**What:** Save interview state after each question or phase to enable resume.

**When:** Every answer is submitted or phase is advanced.

**Example:**
```typescript
import { join } from "node:path";
import * as path from "node:path";

interface InterviewState {
  userId: string;
  phase: "identity" | "style" | "platforms" | "language" | "review";
  questionIndex: number;
  answers: Map<string, string>;
  updatedAt: string;
}

class StateManager {
  private readonly stateDir: string;

  constructor(userId: string) {
    const xdgStateHome = process.env.XDG_STATE_HOME ?? join(process.env.HOME ?? "", ".local/state");
    this.stateDir = join(xdgStateHome, "psn");
  }

  async saveState(state: InterviewState, sessionId: string): Promise<void> {
    await ensureDir(this.stateDir);
    const statePath = join(this.stateDir, `interview-${sessionId}.json`);
    await Bun.write(statePath, JSON.stringify(state, null, 2));

    // Also save as last session for quick resume
    const lastSessionPath = join(this.stateDir, "last-interview.json");
    await Bun.write(lastSessionPath, JSON.stringify({
      ...state,
      path: statePath,
      sessionId,
    }, null, 2));
  }

  async loadLastSession(): Promise<InterviewState | null> {
    const lastSessionPath = join(this.stateDir, "last-interview.json");
    const file = Bun.file(lastSessionPath);
    if (!(await file.exists())) return null;

    try {
      return JSON.parse(await file.text());
    } catch {
      return null;
    }
  }

  async cleanup(sessionId: string): Promise<void> {
    const statePath = join(this.stateDir, `interview-${sessionId}.json`);
    await Bun.remove(statePath);
  }

  async cleanupOldSessions(maxAgeHours: number = 24): Promise<void> {
    const now = Date.now();
    for await (const entry of Bun.readdir(this.stateDir)) {
      if (!entry.isFile || !entry.name.startsWith("interview-")) continue;
      if (entry.name === "last-interview.json") continue;

      const stat = await entry.stat();
      const ageHours = (now - stat.mtime.getTime()) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours) {
        await Bun.remove(join(this.stateDir, entry.name));
      }
    }
  }
}
```

#### Pattern 2: Branching Question Logic

**What:** Show different questions based on previous answers.

**When:** Generating questions for a phase.

**Example:**
```typescript
import * as p from "@clack/prompts";

interface InterviewQuestion {
  id: string;
  text: string;
  hint?: string;
  type: "input" | "select" | "multiselect" | "confirm";
  options?: Array<{ value: string; label: string; hint?: string }>;
  required: boolean;
  condition?: (state: InterviewState) => boolean;
}

class QuestionGenerator {
  private readonly questionBanks: Record<string, InterviewQuestion[]> = {
    identity: [
      {
        id: "pillars",
        text: "What topics do you want to be known for?",
        type: "multiselect",
        options: [
          { value: "ai", label: "AI/ML" },
          { value: "webdev", label: "Web Development" },
          { value: "startup", label: "Startups" },
          // ... more options
        ],
        required: true,
      },
      {
        id: "posting_frequency",
        text: "How often do you post?",
        type: "select",
        options: [
          { value: "never", label: "Never posted / Just starting" },
          { value: "sporadic", label: "Sporadically (a few times per month)" },
          { value: "consistent", label: "Consistently (multiple times per week)" },
          { value: "daily", label: "Very active (daily)" },
        ],
        required: true,
      },
    ],
    platforms: [
      {
        id: "platform_x",
        text: "How do you want to show up on X?",
        hint: "Tone, thread style, hashtag approach",
        type: "input",
        required: false,
        condition: (state) => state.answers.has("x_connected"),
      },
      {
        id: "platform_linkedin",
        text: "How do you want to show up on LinkedIn?",
        hint: "More professional tone works well",
        type: "input",
        required: false,
        condition: (state) => state.answers.has("linkedin_connected"),
      },
    ],
  };

  generateQuestions(state: InterviewState): InterviewQuestion[] {
    const bank = this.questionBanks[state.phase] ?? [];
    return bank.filter((q) => {
      if (!q.condition) return true;
      return q.condition(state);
    });
  }
}
```

#### Pattern 3: Grouped Prompts with Context

**What:** Chain related prompts with access to previous answers.

**When:** Collecting multiple related inputs in a phase.

**Example:**
```typescript
class InterviewOrchestrator {
  async runIdentityPhase(state: InterviewState): Promise<InterviewState> {
    const results = await p.group({
      pillars: () => p.multiselect({
        message: "What 3-5 topics do you want to be known for?",
        options: [
          { value: "ai", label: "AI/ML" },
          { value: "webdev", label: "Web Development" },
          { value: "startup", label: "Startups" },
          { value: "productivity", label: "Productivity" },
          { value: "career", label: "Career Growth" },
        ],
        required: true,
      }),
      boundaries: () => p.text({
        message: "Any topics to avoid?",
        placeholder: "e.g., politics, religion, controversial topics",
      }),
      audience: () => p.text({
        message: "Who are you trying to reach?",
        placeholder: "e.g., developers, startup founders, tech-curious generalists",
        validate: (value) => {
          if (!value || value.length < 5) {
            return "Please provide a bit more detail about your audience";
          }
          return undefined;
        },
      }),
      posting_frequency: () => p.select({
        message: "How often do you currently post?",
        options: [
          { value: "never", label: "Never posted / Just starting" },
          { value: "sporadic", label: "Sporadically (a few times per month)" },
          { value: "consistent", label: "Consistently (multiple times per week)" },
          { value: "daily", label: "Very active (daily)" },
        ],
      }),
    }, {
      onCancel: () => {
        // User cancelled - offer to save and exit
        p.cancel("Interview cancelled. Saving your progress...");
        // Save state and exit
        process.exit(0);
      },
    });

    // Update state with answers
    state.answers.set("pillars", JSON.stringify(results.pillars));
    state.answers.set("boundaries", results.boundaries);
    state.answers.set("audience", results.audience);
    state.answers.set("posting_frequency", results.posting_frequency);

    // Detect experience from frequency answer
    const maturity = this.detectMaturity(results.posting_frequency);
    state.detectedExperience = maturity;

    // Advance phase
    state.phase = "style";
    state.questionIndex = 0;
    state.updatedAt = new Date().toISOString();

    return state;
  }

  private detectMaturity(frequency: string): "beginner" | "intermediate" | "advanced" {
    const freqMap: Record<string, "beginner" | "intermediate" | "advanced"> = {
      never: "beginner",
      sporadic: "intermediate",
      consistent: "intermediate",
      daily: "advanced",
    };
    return freqMap[frequency] ?? "beginner";
  }
}
```

### Anti-Patterns to Avoid

#### Anti-Pattern 1: State in Global Variables

**What:** Storing interview state in global variables or module-scoped variables.

**Why bad:** State persists between CLI invocations, causing confusion; hard to test; breaks when multiple instances run.

**Instead:** Pass state explicitly through function parameters or use a class with instance properties.

#### Anti-Pattern 2: In-place State Mutation Without Backup

**What:** Updating state object in place without creating a backup.

**Why bad:** Can't roll back on validation error; hard to undo; debugging is difficult.

**Instead:** Create new state objects for each step (immutability pattern), or explicitly save backup before mutation.

#### Anti-Pattern 3: Blocking I/O in Main Thread

**What:** Long-running operations (file writes, API calls) blocking the prompt loop.

**Why bad:** UI freezes, poor UX; appears hung to user.

**Instead:** Use async/await for I/O, show spinners for long operations.

#### Anti-Pattern 4: Hard-coded File Paths

**What:** Using absolute paths like `/home/user/.psn/state.json` or relative paths like `./state.json`.

**Why bad:** Breaks on different systems; doesn't respect XDG standards; hard to test.

**Instead:** Use XDG environment variables with fallbacks: `process.env.XDG_STATE_HOME ?? join(process.env.HOME, ".local/state")`.

---

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **State file storage** | Local filesystem (~1KB per user) | Local filesystem (~100MB total) | Move to cloud storage with local sync |
| **Cleanup overhead** | Negligible | Periodic cleanup job (cron) | Automated retention policies |
| **Performance** | Instant save/load | <10ms save/load | Consider binary format (msgpack) |
| **State size** | ~5KB per interview | ~5KB per interview | Compress or split by phase |

**Note:** For PSN, state is local per-machine, so "users" refers to number of interview sessions per machine, not total users. Local filesystem is sufficient for any realistic number of interviews.

---

## Pitfalls

### Critical Pitfalls

#### Pitfall 1: State Corruption on Interrupt

**What goes wrong:** User Ctrl+C's mid-save → JSON file is truncated → Next run crashes parsing incomplete JSON.

**Why it happens:** File writes are not atomic; interrupt occurs mid-write.

**Consequences:** User can't resume; must start over; data loss; frustration.

**Prevention:**
1. Write to temp file first, then atomic rename
2. Use write-ahead logging (WAL) pattern
3. Validate JSON before replacing old state

**Implementation:**
```typescript
async saveState(state: InterviewState, sessionId: string): Promise<void> {
  const stateDir = this.stateDir;
  const statePath = join(stateDir, `interview-${sessionId}.json`);
  const tempPath = join(stateDir, `interview-${sessionId}.json.tmp`);

  // Write to temp file
  await Bun.write(tempPath, JSON.stringify(state, null, 2));

  // Validate temp file
  const tempContent = await Bun.file(tempPath).text();
  try {
    JSON.parse(tempContent); // Verify valid JSON
  } catch (e) {
    await Bun.remove(tempPath);
    throw new Error("State serialization failed");
  }

  // Atomic rename (POSIX guarantee)
  await Bun.rename(tempPath, statePath);
}
```

**Detection:** Check for `.tmp` files on startup; validate JSON before use; offer recovery from backup.

#### Pitfall 2: Stale State After Code Changes

**What goes wrong:** Interview state structure changes between code versions → old state files don't load → users locked out.

**Why it happens:** Schema evolves; backward compatibility not maintained.

**Consequences:** Resume fails; users must restart; migration needed.

**Prevention:**
1. Version field in state schema
2. Migration functions for each version change
3. Fallback to fresh state on migration failure

**Implementation:**
```typescript
interface InterviewState {
  version: number; // Increment on schema changes
  userId: string;
  phase: InterviewPhase;
  // ... other fields
}

const STATE_VERSION = 2;

const MIGRATIONS: Record<number, (state: any) => any> = {
  1: (state) => ({
    ...state,
    version: 2,
    detectedExperience: state.experienceLevel ?? null, // Field rename
    experienceLevel: undefined,
  }),
};

async loadState(sessionId: string): Promise<InterviewState | null> {
  const statePath = join(this.stateDir, `interview-${sessionId}.json`);
  const file = Bun.file(statePath);
  if (!(await file.exists())) return null;

  const content = await file.text();
  let state = JSON.parse(content);

  // Migrate to current version
  while (state.version < STATE_VERSION) {
    const migrate = MIGRATIONS[state.version];
    if (!migrate) {
      // Can't migrate - start fresh
      console.warn(`Cannot migrate state from version ${state.version}. Starting fresh.`);
      return null;
    }
    state = migrate(state);
  }

  return state as InterviewState;
}
```

**Detection:** Check version on load; warn users on version mismatch; log migration events.

#### Pitfall 3: State File Permission Issues

**What goes wrong:** File created with wrong permissions → Can't write on next run → Resume fails.

**Why it happens:** Umask settings; running as different user; file system mounted with restrictions.

**Consequences:** Resume fails silently; users confused; error messages unclear.

**Prevention:**
1. Explicitly set file permissions (0600 for sensitive state)
2. Check writability before starting interview
3. Graceful fallback if state dir is read-only

**Implementation:**
```typescript
async ensureWritable(dir: string): Promise<void> {
  try {
    await ensureDir(dir);
    const testPath = join(dir, ".write-test");
    await Bun.write(testPath, "test");
    await Bun.remove(testPath);
  } catch (e) {
    throw new Error(
      `Cannot write to state directory: ${dir}\n` +
      `Check permissions or set XDG_STATE_HOME explicitly.`
    );
  }
}
```

**Detection:** Pre-flight check on startup; catch permission errors; guide users to fix or use alternative location.

### Moderate Pitfalls

#### Pitfall 4: Memory Leaks from Unbounded State

**What goes wrong:** Interview state grows indefinitely as answers accumulate; long interviews consume excessive memory.

**Prevention:**
1. Limit answer size (truncate long text)
2. Clean up intermediate calculations
3. Consider streaming for very large interviews

**Implementation:**
```typescript
const MAX_ANSWER_LENGTH = 10_000; // 10KB per answer

function sanitizeAnswer(value: string): string {
  if (value.length > MAX_ANSWER_LENGTH) {
    console.warn(`Answer truncated to ${MAX_ANSWER_LENGTH} characters`);
    return value.slice(0, MAX_ANSWER_LENGTH) + "... (truncated)";
  }
  return value;
}
```

#### Pitfall 5: Race Conditions on State Access

**What goes wrong:** Multiple CLI instances write to same state file → Last write wins → Lost answers.

**Prevention:**
1. File locking (advisory locks)
2. Session-based state filenames (unique per interview)
3. Detect and warn on concurrent access

**Implementation:**
```typescript
async acquireLock(sessionId: string): Promise<() => Promise<void>> {
  const lockPath = join(this.stateDir, `${sessionId}.lock`);

  try {
    const lockFd = await Bun.open(lockPath, { create: true, write: true });
    // Try to acquire exclusive lock
    // (Bun doesn't have flock yet, use PID check as fallback)
    const pid = process.pid.toString();
    await Bun.write(lockFd, pid);
    return async () => {
      await lockFd.close();
      await Bun.remove(lockPath);
    };
  } catch (e) {
    // Check if lock is stale
    try {
      const lockContent = await Bun.file(lockPath).text();
      const lockPid = Number.parseInt(lockContent, 10);
      // Try to check if process is still running (platform-specific)
      // For now, just warn
      console.warn(`Interview ${sessionId} appears to be in use. Proceeding anyway.`);
    } catch {
      // Lock file is invalid, proceed
    }
    return async () => {};
  }
}
```

### Minor Pitfalls

#### Pitfall 6: Unclear Progress Indication

**What goes wrong:** Users don't know how much is left → Abandon interview.

**Prevention:** Show step number, total questions, estimated time.

**Implementation:**
```typescript
function showProgress(state: InterviewState, totalQuestions: number): void {
  const progress = p.note(
    `Step ${state.questionIndex + 1} of ${totalQuestions} (${state.phase} phase)`,
    "Progress"
  );
}
```

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **Interview setup** | State file permission issues | Pre-flight writeability check |
| **Identity phase** | Too many questions overwhelm users | Group related questions, allow skip |
| **Style phase** | Scale inputs (1-10) unclear | Show scale markers, provide examples |
| **Platforms phase** | Condition branching bugs | Test all platform combinations |
| **Resume flow** | Stale state after updates | Version + migration system |
| **Finalization** | Profile validation fails | Schema validation before finalize |

---

## Sources

### Interactive CLI Libraries
- [Clack Documentation](https://github.com/natemoo-re/clack) - Official GitHub repository with examples
- [@clack/prompts NPM](https://www.npmjs.com/package/@clack/prompts) - NPM package documentation
- [Prompts Library Comparison](https://juejin.cn/post/7443828372776058918) - Comprehensive comparison of prompts, clack, inquirer, enquirer
- [Inquirer vs Alternatives](https://m.blog.cdn.net/blog_programb/article/details/105541062) - Analysis of inquirer.js and alternatives

### State Management Patterns
- [XDG Base Directory Specification](https://github.com/adrg/xdg) - Go implementation of XDG paths with documentation
- [Node.js CLI Best Practices](https://www.cnblogs.com/apachecn/p/19160701) - CLI state storage and config management
- [Python XDG Example](https://juejin.cn/post/7576129509935906835) - XDG usage patterns (translatable to Node.js)
- [Claude CLI Session Persistence](https://juejin.cn/post/7576129509935906835) - Auto-snapshot persistence pattern

### Checkpoint and Resume Patterns
- [Multi-Agent System Checkpointing](https://juejin.cn/post/7443828372776058918) - Incremental checkpointing pattern for long workflows
- [PowerShell Workflow Checkpoints](https://learn.microsoft.com/zh-cn/powershell/module/psworkflow/about/about-workflows) - Automatic resume patterns
- [Microsoft Agent Framework](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/agents) - Checkpoint and resume implementation
- [vLLM Checkpoint Management](https://juejin.cn/post/7443828372776058918) - File naming patterns for checkpoints

### Interview Flow Patterns
- [npm init Documentation](https://www.npmjs.cn/cli/init/) - Official npm init interactive flow
- [NPM Config Patterns](https://nodejs.cn/npm/cli/v7/commands/npm/) - Configuration priority and management
- [Git Interactive Commands](https://juejin.cn/post/7443828372776058918) - Git's interactive rebase and add patterns
- [Custom ginit Example](https://www.cnblogs.com/liujinyu/articles/10900799.html) - Enhanced git init implementation

### Node.js CLI Patterns
- [Node.js readline/promises](https://nodejs.org/api/readline.html) - Modern async readline API
- [Readline Validation Patterns](https://nodejs.org/api/readline.html) - Input validation examples
- [Native vs Library Comparison](https://m.blog.cdn.net/blog_programb/article/details/105541062) - When to use native vs inquirer

### PSN Codebase Analysis
- `src/cli/voice-interview.ts` - Current interview engine implementation
- `src/cli/voice-config.ts` - Existing CLI patterns in the codebase
- `src/voice/interview.ts` - State management and phase logic (current implementation)
- `src/cli/setup.ts` - Multi-step setup command patterns

### Confidence Level Notes
- **HIGH Confidence:** Library features, XDG standards, established patterns (verified from official docs)
- **MEDIUM Confidence:** Implementation patterns, best practices (multiple sources agree, examples available)
- **LOW Confidence:** Future roadmap items, emerging trends (research-only, no official verification)

---

## Gaps to Address

1. **XDG Implementation in Node/Bun:** Research examples show Python and Go implementations; need to confirm the best pattern for Bun/Node.js environment.
2. **Clack in Bun:** Verify @clack/prompts works correctly with Bun's runtime (may have ESM/CommonJS compatibility issues).
3. **File Locking in Bun:** Bun doesn't have full flock support; need to investigate alternative locking mechanisms for concurrent interview prevention.
4. **State Migration Patterns:** More research needed on versioning and migration strategies for interview state schemas.
5. **Error Recovery Patterns:** Best practices for corrupted state files and user-friendly recovery flows need deeper investigation.

---

## Roadmap Implications

Based on research, the CLI interview feature should be implemented in this order:

### Phase 1: Foundation (Sprint 1)
1. **Install @clack/prompts** and verify Bun compatibility
2. **Implement State Manager** with XDG-compliant paths
3. **Save/load state** with basic JSON serialization
4. **Resume prompt** on startup if last session exists

### Phase 2: Enhanced UX (Sprint 2)
1. **Convert existing interview** to use @clack/prompts
2. **Add progress indication** for multi-step phases
3. **Implement branching logic** based on experience detection
4. **Add validation** with clear error messages

### Phase 3: Robustness (Sprint 3)
1. **Add atomic writes** with temp file pattern
2. **Implement state versioning** and migrations
3. **Add pre-flight checks** for state directory writability
4. **Implement cleanup** of old interview sessions

### Phase 4: Advanced Features (Future)
1. **Batch mode** for automation
2. **Experience detection** from imported content
3. **Advanced checkpointing** (resume mid-question, not just mid-phase)
4. **Concurrent session handling** with proper locking

**Phase ordering rationale:**
- Foundation first enables resume capability (critical UX improvement)
- Enhanced UX builds on foundation to improve user experience
- Robustness prevents data loss and handles edge cases
- Advanced features are optimizations, not core requirements

**Research flags for phases:**
- Phase 1: Need to verify @clack/prompts Bun compatibility (implementation research)
- Phase 3: Need to research Bun-specific file locking mechanisms (OS-level research)
- Phase 4: Experience detection from content requires AI/ML research (domain-specific research)
