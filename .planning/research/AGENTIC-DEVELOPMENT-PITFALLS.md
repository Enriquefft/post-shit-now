# Pitfalls Research: Agentic Development Refactoring

**Domain:** TypeScript codebase refactoring for AI-assisted development
**Researched:** 2026-02-25
**Confidence:** HIGH (verified via multiple sources, documented post-mortems, and best practices)

---

## Critical Pitfalls

Mistakes that cause rewrites, major issues, or significantly degrade agentic development quality.

### Pitfall 1: Interface Definitions Without Clear Behavioral Contracts

**What goes wrong:**
Interfaces are defined but lack clear semantic contracts, making it impossible for AI assistants to understand what implementations must do. AI generates code that "compiles" but doesn't match expected behavior, leading to subtle bugs that surface in production.

**Why it happens:**
Developers treat interfaces as just TypeScript type annotations rather than behavioral contracts. They define methods with parameters and return types but don't document:
- What the method *actually does* (business logic semantics)
- Preconditions and postconditions
- Error conditions and how they're signaled
- Ordering constraints (e.g., "must call uploadMedia() before publish()")
- Side effects (database writes, API calls, notifications)

**Consequences:**
- AI generates implementations that satisfy type signatures but violate business rules
- Different AI sessions produce incompatible implementations of the same interface
- Maintenance nightmares: "Does this method need to handle X?" requires digging through all implementations
- Integration tests fail unpredictably because assumptions aren't encoded

**Warning signs:**
- Interface methods with names like `handle()`, `process()`, `execute()` without JSDoc explaining semantics
- Multiple platform implementations of the same interface with divergent error handling
- Code reviewers asking "what's this supposed to do?" about interface methods
- AI generating different behavior for the same interface across sessions

**Prevention:**

1. **Define behavioral contracts in JSDoc:**
```typescript
interface PlatformPublisher {
  /**
   * Publish a post to the platform.
   *
   * Preconditions:
   * - All media must be uploaded first via MediaUploader.uploadMedia()
   * - OAuth token must be valid and have required permissions
   *
   * Postconditions:
   * - Post is live on the platform immediately
   * - Returns stable post ID that can be used for analytics queries
   *
   * Error handling:
   * - Throws RateLimitError (429) when rate limit exceeded - caller must implement backoff
   * - Throws AuthenticationError (401) when token expired - caller must refresh token
   * - Throws ValidationError (400) when content violates platform rules - caller must fix content
   *
   * Side effects:
   * - Sends notification to user upon success via notifier service
   * - Updates post record in database with platform post ID and URL
   */
  publish(content: PostContent, token: string): Promise<PublishResult>;
}
```

2. **Add interface compliance tests:**
```typescript
describe('XPublisher implements PlatformPublisher', () => {
  it('throws RateLimitError on 429 response', async () => {
    const publisher = new XPublisher();
    await expect(publisher.publish(mockContent, mockToken))
      .rejects.toThrow(RateLimitError);
  });

  it('throws ValidationError on invalid content', async () => {
    const publisher = new XPublisher();
    await expect(publisher.publish(invalidContent, mockToken))
      .rejects.toThrow(ValidationError);
  });
});
```

3. **Document ordering constraints explicitly:**
```typescript
/**
 * Platform publishing workflow:
 * 1. Upload media via MediaUploader (get mediaId)
 * 2. Prepare content with mediaId(s)
 * 3. Publish via PlatformPublisher
 *
 * Do not call publish() before uploading media.
 */
export class PublishingWorkflow {
  // ...
}
```

**Phase to address:** Phase 1 (Interface definitions) — Must define contracts before extracting modules

---

### Pitfall 2: Code Splitting Without Dependency Injection

**What goes wrong:**
Large monolithic files (like `publish-post.ts` at 1,239 lines) are split into smaller modules, but those modules still use global singletons or tight coupling. The refactoring reduces file size but doesn't improve testability or AI understanding.

**Why it happens:**
Developers focus on "extract into smaller files" without considering how modules obtain their dependencies. They copy-paste code and end up with modules that:
- Import database connections from global modules
- Hardcode platform API clients
- Call services directly via static imports
- Can't be tested in isolation (everything is wired together)

**Consequences:**
- Split modules are just as difficult for AI to understand (still need to read global context)
- Tests can't isolate individual components (everything drags in whole dependency tree)
- Circular dependencies emerge because modules reach into each other
- Future changes require touching many files due to tight coupling

**Warning signs:**
- Extracted module files have `import { db } from '../database'` or similar
- `new PlatformClient()` appears inside functions rather than constructors
- Tests import half the codebase to test one function
- `vi.mock()` calls in test files mock 5+ dependencies

**Prevention:**

1. **Constructor injection for all dependencies:**
```typescript
// BAD: Tight coupling
class XPublisher {
  async publish(content: PostContent) {
    const db = await getGlobalDb(); // Where does this come from?
    const client = new TwitterApi(getToken()); // Hidden dependency
    // ...
  }
}

// GOOD: Explicit dependencies
class XPublisher implements PlatformPublisher {
  constructor(
    private readonly db: Database,
    private readonly tokenManager: TokenManager,
    private readonly notifier: NotificationService
  ) {}

  async publish(content: PostContent, token: string): Promise<PublishResult> {
    const refreshToken = await this.tokenManager.refreshIfNeeded(token);
    // All dependencies explicit and injectable
  }
}
```

2. **Factory functions for creation:**
```typescript
// src/platforms/x/factory.ts
export function createXPublisher(
  db: Database,
  tokenManager: TokenManager
): PlatformPublisher {
  const notifier = createNotifier(db);
  return new XPublisher(db, tokenManager, notifier);
}

// Usage: clear what's needed
const publisher = createXPublisher(db, tokenManager);
```

3. **Interface-based composition:**
```typescript
// Dependencies are interfaces, not concrete classes
class XPublisher implements PlatformPublisher {
  constructor(
    private readonly db: IDatabase,
    private readonly tokenManager: ITokenManager,
    private readonly notifier: INotifier
  ) {}
}

// Tests can inject mocks
const publisher = new XPublisher(
  mockDb,
  mockTokenManager,
  mockNotifier
);
```

**Phase to address:** Phase 2 (Code splitting) — Dependency injection must accompany extraction

---

### Pitfall 3: Context Rot — Documentation Drifts from Code

**What goes wrong:**
CLAUDE.md, ARCHITECTURE.md, and other documentation are written during initial setup but never updated as the codebase evolves. AI assistants follow outdated documentation, generating code that doesn't match current patterns.

**Why it happens:**
- No process for updating docs when code changes
- Documentation maintenance feels like "extra work"
- Docs become stale quickly, especially in active refactoring phases
- No automated checks to validate examples still compile
- Developers update code but forget to update corresponding docs

**Consequences:**
- AI repeatedly makes the same mistakes (following outdated patterns)
- Context window fills with corrections ("as mentioned before...")
- New team members confused by contradictory documentation vs. code
- Reduced trust in documentation, leading to more ad-hoc decisions

**Warning signs:**
- AI assistant says "as mentioned in previous messages" >3 times per session
- CLAUDE.md contains rules that no one follows anymore
- Architecture diagrams reference components that don't exist
- New contributors ask "which is right, the docs or the code?"
- Git history shows code changes without corresponding doc updates

**Prevention:**

1. **Incremental documentation updates:**
```bash
# Add rule to CLAUDE.md when correcting AI twice
# After 2nd-3rd correction, write it down

# Claude Code shortcut: Press '#' during conversation
# Prompts: "Add this to CLAUDE.md"
```

2. **Pre-commit hooks for doc validation:**
```bash
# .git/hooks/pre-commit
#!/bin/bash
# Validate CLAUDE.md code examples compile
bun run validate-docs || {
  echo "ERROR: CLAUDE.md contains invalid code examples"
  exit 1
}

# Validate file size limits
MAX_LINES=200
FILES_OVER_LIMIT=$(find src -name "*.ts" -exec sh -c 'lines=$(wc -l < "$1"); [ "$lines" -gt '$MAX_LINES' ] && echo "$1"' _ {} \;)

if [ -n "$FILES_OVER_LIMIT" ]; then
  echo "ERROR: Files exceed $MAX_LINES lines:"
  echo "$FILES_OVER_LIMIT"
  exit 1
fi
```

3. **Commit hook for doc-code synchronization:**
```bash
# When modifying code in documented modules, prompt for doc update
# Example: If modifying src/platforms/x/publisher.ts
# Check if src/platforms/x/CLAUDE.md needs update
```

4. **Automated example validation:**
```typescript
// tools/validate-docs.ts
import { execSync } from 'child_process';

const docCodeBlocks = extractCodeBlocks('CLAUDE.md');
for (const block of docCodeBlocks) {
  try {
    execSync(`node -e "${block}"`, { stdio: 'pipe' });
  } catch (error) {
    console.error(`Code block doesn't compile:\n${block}`);
    process.exit(1);
  }
}
```

5. **File size limit enforcement:**
```json
// package.json scripts
{
  "scripts": {
    "validate-docs": "bun run tools/validate-docs.ts",
    "check-file-sizes": "bun run tools/check-file-sizes.ts",
    "pre-commit": "bun run validate-docs && bun run check-file-sizes"
  }
}
```

6. **Documentation review checklist in PR template:**
```markdown
## Documentation Updates
- [ ] CLAUDE.md updated if changing project conventions
- [ ] ARCHITECTURE.md updated if changing module boundaries
- [ ] Platform CLAUDE.md updated (e.g., src/platforms/x/CLAUDE.md)
- [ ] JSDoc comments updated on modified public APIs
```

**Phase to address:** Phase 4 (Documentation maintenance) — Ongoing, must start early

---

### Pitfall 4: Testing Trap — Coverage Without Quality

**What goes wrong:**
Tests are written to achieve coverage metrics but don't catch actual bugs. Refactoring passes all tests but breaks production because tests don't validate behavior, just execution paths.

**Why it happens:**
- Focus on percentage coverage (90%+, 100%) rather than test quality
- Tests that mock everything, testing implementation not behavior
- Happy path tests only, no error scenarios
- Tests that pass for the wrong reasons (e.g., mock returns `undefined` but test doesn't check)

**Consequences:**
- False confidence: "All tests pass, ship it!"
- Production bugs that tests should have caught
- Test suite becomes maintenance burden without value
- AI generates tests that pass but don't validate contracts

**Warning signs:**
- Test files have more mocks than actual code
- Tests use `expect.anything()` or `expect.any(Function)` extensively
- Test coverage is 90%+ but bugs still slip through
- Test comments say "mock all the things"
- Changing an implementation requires updating 10+ tests (testing implementation, not behavior)

**Prevention:**

1. **Test contracts, not implementations:**
```typescript
// BAD: Testing internal implementation
it('calls Twitter API with correct params', () => {
  const publisher = new XPublisher(db, tokenManager, notifier);
  await publisher.publish(content, token);
  expect(mockTwitterApi.v2.tweet).toHaveBeenCalledWith({ text: 'hello' });
});

// GOOD: Testing interface contract
it('publishes tweet and returns ID', async () => {
  const publisher = new XPublisher(db, tokenManager, notifier);
  const result = await publisher.publish(content, token);
  expect(result.tweetId).toBeDefined();
  expect(result.url).toMatch(/^https:\/\/twitter\.com\//);
});

it('throws RateLimitError when platform returns 429', async () => {
  mockTwitterApi.v2.tweet.mockRejectedValue({ code: 429 });
  const publisher = new XPublisher(db, tokenManager, notifier);
  await expect(publisher.publish(content, token))
    .rejects.toThrow(RateLimitError);
});
```

2. **Minimize mocks, test integration:**
```typescript
// BAD: Everything mocked
const mockDb = mockEverything();
const mockTokenManager = mockEverything();
const mockNotifier = mockEverything();
const publisher = new XPublisher(mockDb, mockTokenManager, mockNotifier);

// GOOD: Only mock external dependencies
const mockTwitterApi = vi.mocked(TwitterApi);
const publisher = new XPublisher(realDb, realTokenManager, mockNotifier);
// Test real database interaction, only mock Twitter API
```

3. **Error scenario tests (critical for interfaces):**
```typescript
describe('PlatformPublisher error handling', () => {
  it('throws RateLimitError on 429', async () => { /* ... */ });
  it('throws AuthenticationError on 401', async () => { /* ... */ });
  it('throws ValidationError on 400', async () => { /* ... */ });
  it('throws NetworkError on timeout', async () => { /* ... */ });
  it('throws MediaUploadError when mediaId invalid', async () => { /* ... */ });
});
```

4. **Contract compliance tests:**
```typescript
import type { PlatformPublisher } from '@psn/core/types';

describe('XPublisher contract compliance', () => {
  it('implements PlatformPublisher interface', () => {
    const publisher = new XPublisher(db, tokenManager, notifier);
    // TypeScript catches if interface not implemented
    const typedPublisher: PlatformPublisher = publisher;
    expect(typedPublisher.publish).toBeInstanceOf(Function);
  });

  it('satisfies interface error contract', async () => {
    const publisher = new XPublisher(db, tokenManager, notifier);
    // Must throw RateLimitError, AuthenticationError, ValidationError
    await expect(publisher.publish(content, invalidToken))
      .rejects.toThrow(AuthenticationError);
  });
});
```

5. **Prevent over-mocking with coverage policy:**
```yaml
# .vitest/coverage-policy.yml
rules:
  - if: test_file_uses_more_than_3_mocks
    then: reject_with_message "Over-mocked test - consider integration test"
  - if: test_file_uses_expect_anything
    then: reject_with_message "Use specific assertions, not expect.anything()"
```

**Phase to address:** Phase 2 (Interface compliance tests) and Phase 3 (Testing infrastructure)

---

### Pitfall 5: Circular Dependencies When Extracting Modules

**What goes wrong:**
During code splitting, modules end up importing each other (A imports B, B imports A). TypeScript compiles but fails at runtime, or produces initialization errors where variables are undefined.

**Why it happens:**
- Extracting related functionality without considering dependency direction
- Platform-specific modules importing shared types that import back into platforms
- Utilities imported everywhere ending up with cross-references
- Barrel exports (`index.ts`) re-exporting everything, creating implicit cycles

**Consequences:**
- `ReferenceError: Cannot access 'X' before initialization` at runtime
- Tests fail intermittently depending on import order
- TypeScript compilation succeeds but Node.js fails to load modules
- AI can't understand dependency relationships (cycles confuse reasoning)

**Warning signs:**
- `import { TypeA } from './moduleA'` in moduleB and `import { TypeB } from './moduleB'` in moduleA
- Barrel exports re-exporting types from modules that import the barrel
- `require()` or dynamic `import()` used to break cycles (temporary fix)
- StackOverflow issues discussing circular imports in codebase

**Prevention:**

1. **Extract shared interfaces to separate module:**
```typescript
// BAD: Circular dependency
// src/platforms/x/publisher.ts
import { LinkedInPublisher } from '../linkedin/publisher'; // Platform A imports B

// src/platforms/linkedin/publisher.ts
import { XPublisher } from '../x/publisher'; // Platform B imports A

// GOOD: Extract shared interface
// src/core/types/platform.ts
export interface PlatformPublisher {
  publish(content: PostContent, token: string): Promise<PublishResult>;
}

// src/platforms/x/publisher.ts
import type { PlatformPublisher } from '@psn/core/types'; // Both depend on core

// src/platforms/linkedin/publisher.ts
import type { PlatformPublisher } from '@psn/core/types'; // No cycle
```

2. **Dependency inversion principle:**
```typescript
// BAD: Direct imports create cycle
class XPublisher {
  async publish() {
    const analytics = new AnalyticsCollector(); // Hard dependency
  }
}

// GOOD: Depend on abstractions
class XPublisher implements PlatformPublisher {
  constructor(private readonly analytics: IAnalytics) {}

  async publish() {
    await this.analytics.record(this); // Interface, not concrete class
  }
}
```

3. **Detect circular dependencies with tools:**
```bash
# Install madge
npm install -D madge

# Detect circular dependencies
npx madge --circular src/

# Output:
# /home/hybridz/Projects/post-shit-now/src/platforms/x/publisher.ts
#   └─► /home/hybridz/Projects/post-shit-now/src/platforms/linkedin/publisher.ts
#       └─► /home/hybridz/Projects/post-shit-now/src/platforms/x/publisher.ts
#
# Found 1 circular dependency!
```

4. **Barrel export discipline:**
```typescript
// BAD: Barrel exports everything, creates implicit cycles
// src/platforms/x/index.ts
export * from './publisher';
export * from './client';
export * from '../linkedin/publisher'; // CROSS-PLATFORM EXPORT - CYCLE!

// GOOD: Export only public API
// src/platforms/x/index.ts
export { XPublisher } from './publisher';
export { createXClient } from './client';
// No cross-platform exports
```

5. **Layered architecture (prevents cycles):**
```
src/
  core/types/         # Layer 1: Types only (no imports from other layers)
  core/db/           # Layer 2: Database (imports from types)
  platforms/         # Layer 3: Platform implementations (imports from core)
  trigger/           # Layer 4: Orchestration (imports from platforms)

Rule: Layer N can import from Layer <N, but never from Layer >N
```

**Phase to address:** Phase 2 (Code splitting) — Architecture must be designed before extraction

---

### Pitfall 6: Breaking Production During Refactoring

**What goes wrong:**
Large-scale refactoring (splitting `publish-post.ts`) is deployed and breaks production workflows because behavior changes subtly. Tests pass but production fails due to:
- Edge cases not covered by tests
- Environment differences (local vs production)
- Race conditions not reproducible in tests
- Configuration drift between environments

**Why it happens:**
- Refactoring focuses on code structure, not behavior preservation
- Integration tests don't cover all production scenarios
- No pre-production validation phase
- Rollback strategy not prepared
- "It works on my machine" assumptions

**Consequences:**
- Scheduled posts fail to publish
- Users see errors during critical workflows
- Emergency rollbacks under pressure
- Trust in refactoring process lost

**Warning signs:**
- Test suite runs in <5 seconds (not thorough)
- No staging environment tests
- "We'll fix it in prod" comments
- Rollback script not tested
- Monitoring/alerting not configured for refactored code paths

**Prevention:**

1. **Feature flagging for safe rollout:**
```typescript
// Use feature flags for new refactored code
const USE_NEW_PUBLISHER = process.env.FEATURE_NEW_PUBLISHER === 'true';

export async function publishPost(postId: string) {
  if (USE_NEW_PUBLISHER) {
    return publishViaNewArchitecture(postId);
  } else {
    return publishViaLegacyCode(postId);
  }
}

// Rollout strategy:
// Week 1: 10% traffic (FEATURE_NEW_PUBLISHER=true for 10% of users)
// Week 2: 50% traffic
// Week 3: 100% traffic
// If issues: Set FEATURE_NEW_PUBLISHER=false for instant rollback
```

2. **Comparison testing (canary):**
```typescript
// Run both old and new code, compare results
export async function publishWithComparison(postId: string) {
  const [legacyResult, newResult] = await Promise.all([
    publishViaLegacyCode(postId),
    publishViaNewArchitecture(postId),
  ]);

  if (!deepEqual(legacyResult, newResult)) {
    // Log difference, alert team
    await sendAlert('Refactoring behavior mismatch', {
      legacy: legacyResult,
      new: newResult,
    });
  }

  // Return legacy result until validated
  return legacyResult;
}
```

3. **Pre-production testing checklist:**
```markdown
## Staging Validation Before Production

- [ ] Full integration test suite passes
- [ ] Manual smoke test of core workflows
- [ ] Load testing with production-like volume
- [ ] Environment variables verified (DATABASE_URL, API keys)
- [ ] Feature flags configured (can disable new code instantly)
- [ ] Rollback procedure tested (actually run rollback, verify it works)
- [ ] Monitoring/alerting configured for refactored paths
- [ ] On-call team notified of deployment window
- [ ] Post-deployment verification checklist ready
```

4. **Rollback strategy (git-based):**
```bash
#!/bin/bash
# scripts/rollback-refactoring.sh
set -e

# Tag stable version before refactoring
STABLE_TAG="v1.2.0-stable"

# If issues, rollback:
echo "Rolling back to $STABLE_TAG..."

# 1. Revert recent commits (safer than reset)
git revert --no-commit HEAD~5..HEAD

# 2. Tag rollback point
git tag -f "rollback-$(date +%Y%m%d-%H%M%S)"

# 3. Deploy
npm run deploy:production

# 4. Verify
npm run verify:production

echo "Rollback complete"
```

5. **Post-deployment verification:**
```typescript
// tools/verify-deployment.ts
export async function verifyDeployment() {
  const checks = [
    await checkDatabaseConnection(),
    await checkPlatformApiConnectivity(),
    await checkScheduledPostsPending(),
    await checkTokenRefreshWorking(),
    await checkNotificationDispatch(),
  ];

  const failures = checks.filter(c => !c.passed);
  if (failures.length > 0) {
    throw new Error('Deployment verification failed:\n' +
      failures.map(f => `- ${f.check}: ${f.error}`).join('\n'));
  }

  console.log('All verification checks passed');
}
```

6. **Monitoring for refactored code paths:**
```typescript
// Add structured logging to new code
logger.info('Published post via new architecture', {
  postId,
  platform,
  durationMs,
  success: true,
});

// Alert on anomalies
if (durationMs > 5000) {
  await sendAlert('Slow publishing performance', { durationMs, postId });
}

if (successRate < 0.95) {
  await sendAlert('Publishing failure rate high', { successRate });
}
```

**Phase to address:** Phase 3 (Testing and validation) — Must have safety nets before deploying refactored code

---

## Moderate Pitfalls

Issues that cause problems but are recoverable without major rework.

### Pitfall 7: Barrel Exports That Leak Internals

**What goes wrong:**
`index.ts` barrel files re-export everything from a module (`export * from './file'`), exposing internal implementation details. AI discovers and uses private APIs, creating tight coupling.

**Why it happens:**
Convenience: "I don't want to import from specific files, just use the barrel." Laziness: `export *` is easier than listing public APIs.

**Consequences:**
- AI uses internal functions that shouldn't be public
- Refactoring internals breaks code that shouldn't depend on them
- Module boundaries meaningless (everything accessible)

**Prevention:**

```typescript
// BAD: Re-exports everything
export * from './publisher';
export * from './client';
export * from './utils'; // Leaks internal utilities!

// GOOD: Explicit public API
export { XPublisher } from './publisher';
export { createXClient } from './client';
// utils not exported (internal only)
```

**Phase to address:** Phase 1 (Module boundaries)

---

### Pitfall 8: Path Aliases Not Updated After Restructuring

**What goes wrong:**
Code uses path aliases (`@psn/platforms/x/publisher`) but after restructuring, aliases point to wrong locations. TypeScript compiles but runtime fails.

**Why it happens:**
`tsconfig.json` paths configured once, not updated when directories move or rename.

**Consequences:**
- Module resolution errors at runtime
- Import statements work in IDE but fail in execution
- Confusion: "It worked in VS Code but fails in terminal"

**Prevention:**

```bash
# Update tsconfig.json after restructuring
# Verify aliases resolve correctly
npx tsc --noEmit

# Test in runtime environment (not just IDE)
bun run typecheck
bun run test
```

**Phase to address:** Phase 2 (Code splitting)

---

### Pitfall 9: AI Generates Code That Doesn't Fit Module Boundaries

**What goes wrong:**
AI assistant generates new code that violates established module boundaries (e.g., platform-specific logic in core utils, database queries in CLI scripts).

**Why it happens:**
- Module boundaries not documented in CLAUDE.md
- No clear import restrictions
- AI follows path of least resistance (put code where it's easy)

**Consequences:**
- Code creep: boundaries erode over time
- Circular dependencies emerge
- Architecture diagram no longer matches reality

**Prevention:**

```markdown
# CLAUDE.md

## Module Boundaries

### Core Utils (src/core/utils/)
- No platform-specific logic
- No database queries
- Pure functions, testable in isolation

### Platform Publishers (src/platforms/*/publisher.ts)
- Must implement PlatformPublisher interface
- May call external platform APIs
- Must not access database directly (use repository pattern)

### CLI Scripts (src/cli/)
- Orchestration only
- Import from @psn/core for business logic
- Must not contain business rules

## Prohibited Imports

❌ src/platforms/x/publisher.ts importing src/platforms/linkedin/client.ts
❌ src/cli/queue-post.ts importing drizzle directly (use @psn/core/db)
❌ src/core/utils/platform.ts containing X-specific logic
```

**Phase to address:** Phase 1 (Documentation)

---

### Pitfall 10: Missing Error Handling in Extracted Modules

**What goes wrong:**
During extraction, error handling logic is lost or not properly migrated. Modules throw raw errors instead of wrapped, typed exceptions.

**Why it happens:**
Focus on extracting happy path logic, error handling added as afterthought. Different modules may handle errors inconsistently.

**Consequences:**
- Stack traces leak to users
- AI doesn't know which errors to catch and retry
- Production debugging difficult (generic Error objects)

**Prevention:**

```typescript
// src/core/errors.ts
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly platform: string
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly platform: string,
    public readonly tokenExpired: boolean
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// All platform publishers must use these errors
class XPublisher implements PlatformPublisher {
  async publish(content: PostContent, token: string): Promise<PublishResult> {
    try {
      const result = await this.client.v2.tweet(content);
      return result;
    } catch (error) {
      if (error.code === 429) {
        throw new RateLimitError(
          'X API rate limit exceeded',
          error.retryAfter,
          'x'
        );
      }
      if (error.code === 401) {
        throw new AuthenticationError(
          'X token invalid',
          'x',
          true
        );
      }
      throw error; // Wrap in PlatformError
    }
  }
}
```

**Phase to address:** Phase 1 (Interface definitions)

---

## Minor Pitfalls

Annoying issues that don't break the system but reduce efficiency.

### Pitfall 11: File Size Limits Not Enforced

**What goes wrong:**
Policy says "files under 200 lines" but during refactoring, new files exceed this. AI context window can't hold entire file.

**Prevention:**
Pre-commit hook to check line counts (see Pitfall 3)

**Phase to address:** Phase 4 (Documentation maintenance)

---

### Pitfall 12: JSDoc Inconsistency

**What goes wrong:**
Some functions have detailed JSDoc, others have none. AI can't understand undocumented functions.

**Prevention:**
Lint rule requiring JSDoc on public exports:
```json
// biome.json
{
  "linter": {
    "rules": {
      "style": {
        "useJsdocKey": "error"
      }
    }
  }
}
```

**Phase to address:** Phase 3 (Testing and validation)

---

### Pitfall 13: TypeScript Strict Mode Violations

**What goes wrong:**
Code uses `any` types, implicit `any` parameters, or disables strict checks. AI can't reason about types accurately.

**Prevention:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

**Phase to address:** Phase 1 (Stack configuration)

---

## Technical Debt Patterns

Shortcuts that seem reasonable during refactoring but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Extract without tests** | Faster refactoring, move quickly | Bugs in production, hard to debug | **Never** - Always test before and after |
| **Global singletons for DB** | Easy access from anywhere | Cannot test in isolation, tight coupling | **Never** - Use dependency injection |
| **Export * from barrel** | Convenience, less import statements | Leaks internals, breaks boundaries | Only for small utility modules |
| **Mock everything in tests** | Tests don't need external deps | Tests validate nothing, brittle | Never - test real integration when possible |
| **Skip JSDoc on internal functions** | Less documentation overhead | AI can't understand private code | Only for trivial private helpers (<5 lines) |
| **Feature flagging forever** | Safe rollout, easy rollback | Code complexity, maintenance burden | Only during 2-4 week rollout window, then remove |
| **Circular dependency via dynamic import()** | Compilation succeeds | Runtime failures, confusing dependencies | **Never** - redesign architecture |
| **Path aliases not validated** | Faster development | Runtime import errors | **Never** - always run `tsc --noEmit` |
| **CLAUDE.md written once, never updated** | Initial documentation effort done | Context rot, AI follows outdated patterns | **Never** - update on every convention change |
| **Large files (>500 lines) accepted** | Don't need to split now | AI can't understand, hard to maintain | Only temporary (1 week max), then split |

---

## Integration Gotchas

Common mistakes when connecting to external services during refactoring.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Trigger.dev tasks** | Importing database connection directly (violates dependency injection) | Use task middleware to inject DB connection (see ARCHITECTURE.md) |
| **Platform API clients** | Creating new client instances in every function call (wasteful) | Create client once, reuse via dependency injection |
| **Token management** | Storing tokens in environment variables (can't refresh) | Store in database (encrypted), refresh via background task |
| **Rate limiting** | Implementing per-instance rate limits (doesn't work across tasks) | Implement hub-scoped rate limiter shared by all tasks |
| **Error handling** | Throwing raw platform API errors (exposes internals) | Wrap in domain-specific errors (RateLimitError, AuthenticationError) |
| **Media uploads** | Attaching media before upload completes (race condition) | Upload media first, get mediaId, then attach to post |
| **Postgres RLS** | Forgetting to set user context in transactions | Use middleware to set `app.current_user_id` for every task |
| **Drizzle migrations** | Using `drizzle-kit push` (silent data loss) | Use `drizzle-kit generate` + `drizzle-kit migrate` (review migrations) |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **N+1 queries in refactored code** | Slow database access, timeouts | Use joins or batch queries, use Drizzle ORM correctly | 10+ concurrent users scheduling posts |
| **No connection pooling** | Database connection exhaustion | Use Neon's built-in connection pooling, don't create connections manually | 50+ concurrent background tasks |
| **Synchronous API calls in sequence** | Slow publishing (posts take 10s+) | Parallelize independent API calls with `Promise.all()` | Multiple platforms in single batch |
| **Missing indexes** | Analytics queries slow | Add indexes on frequently queried columns (created_by, scheduled_at, status) | 1000+ posts in database |
| **Context window overflow** | AI makes mistakes, ignores instructions | Keep files <200 lines, use progressive disclosure (directory CLAUDE.md) | Always - AI quality degrades at 40% context usage |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **OAuth tokens in environment variables** | Tokens exposed in logs, can't refresh automatically | Store encrypted in database, refresh via background task |
| **Hardcoded API keys in code** | Keys exposed in git history | Use environment variables, never commit secrets |
| **SQL injection via string concatenation** | Database compromised | Always use parameterized queries (Drizzle ORM handles this) |
| **RLS bypass in company hubs** | Team members see each other's data | Set `app.current_user_id` in every transaction, verify policies |
| **Logging sensitive data** | Passwords, tokens exposed in logs | Redact sensitive fields in logging middleware |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Interface definitions**: Often missing JSDoc describing preconditions, postconditions, error handling — verify each method has behavioral contract
- [ ] **Code splitting**: Often missing dependency injection, modules still coupled via globals — verify constructors inject all dependencies
- [ ] **Tests**: Often missing error scenarios, only happy paths covered — verify error contracts are tested
- [ ] **Documentation**: Often missing directory-level CLAUDE.md, module boundaries not documented — verify each module has guide
- [ ] **Rollback strategy**: Often not tested, deployment assumes success — actually run rollback script before deploy
- [ ] **Feature flags**: Often configured but removal plan missing — document when to remove flags (after X weeks of stability)
- [ ] **Error handling**: Often wraps errors but doesn't preserve stack traces — verify errors include context (postId, platform, userId)
- [ ] **Monitoring**: Often logs added but alerts not configured — verify error rates trigger alerts
- [ ] **File sizes**: Often some files exceed limits despite policy — run line count check, split if >200 lines
- [ ] **Circular dependencies**: Often `madge` check not run — verify `npx madge --circular src/` returns no cycles

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **Interface definitions without contracts** | MEDIUM | 1. Add JSDoc to all interface methods 2. Write contract compliance tests 3. Run `bun run test` to verify implementations 4. Update ARCHITECTURE.md with contracts |
| **Code splitting without DI** | HIGH | 1. Identify global dependencies 2. Refactor to constructor injection 3. Update factory functions 4. Test in isolation (each module should work with mocks) 5. Commit: `git add -A && git commit -m "refactor: add dependency injection"` |
| **Context rot** | LOW (ongoing) | 1. Review CLAUDE.md, compare to actual code 2. Update outdated rules 3. Add rules for recent patterns 4. Set up pre-commit hooks to prevent future rot |
| **Testing trap** | MEDIUM | 1. Review test files, identify over-mocked tests 2. Rewrite tests to verify behavior, not implementation 3. Add integration tests for critical paths 4. Remove `expect.anything()` usage 5. Run `npx madge --circular src/` to detect test cycles |
| **Circular dependencies** | MEDIUM | 1. Run `npx madge --circular src/` to identify cycles 2. Extract shared types to `src/core/types/` 3. Apply dependency inversion principle 4. Verify with `npx tsc --noEmit` 5. Commit: `git commit -m "fix: resolve circular dependencies"` |
| **Breaking production** | HIGH | 1. Enable feature flag to disable new code: `FEATURE_NEW_PUBLISHER=false` 2. Verify rollback works: `git revert --no-commit HEAD~3..HEAD` 3. Deploy rollback: `npm run deploy:production` 4. Run verification: `npm run verify:production` 5. Investigate failure in staging environment 6. Fix, re-test, re-deploy with gradual rollout |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **Interface definitions without contracts** | Phase 1: Interface definitions | Phase 2: Write contract compliance tests |
| **Code splitting without DI** | Phase 2: Code splitting with DI pattern | Phase 2: All modules testable with mocks only |
| **Context rot** | Phase 4: Documentation maintenance | Phase 4+: Pre-commit hooks validate docs match code |
| **Testing trap** | Phase 3: Testing infrastructure | Phase 3: No `expect.anything()`, <3 mocks per test |
| **Circular dependencies** | Phase 2: Code splitting (architecture design) | Phase 2: `npx madge --circular src/` returns empty |
| **Breaking production** | Phase 3: Testing and validation | Phase 3: Staging validation passes, rollback tested |
| **Barrel exports leak internals** | Phase 1: Module boundaries | Phase 2: Barrel exports list explicit public APIs |
| **Path aliases not updated** | Phase 2: Code splitting | Phase 2: `npx tsc --noEmit` passes after restructuring |
| **AI violates module boundaries** | Phase 1: Documentation (CLAUDE.md) | Phase 2: No cross-boundary imports in AI-generated code |
| **Missing error handling** | Phase 1: Interface definitions | Phase 1: All platform publishers use typed errors |
| **File size limits not enforced** | Phase 4: Documentation maintenance | Phase 4: Pre-commit hook rejects files >200 lines |
| **JSDoc inconsistency** | Phase 3: Testing and validation | Phase 3: Linter requires JSDoc on public exports |
| **TypeScript strict violations** | Phase 1: Stack configuration | Phase 1: `bun run typecheck` passes with strict mode |

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| **Phase 1: Interface definitions** | Pitfall 1: Contracts without JSDoc, Pitfall 10: Missing error handling | Write behavioral contracts in JSDoc, define typed errors, add contract compliance tests |
| **Phase 2: Code splitting** | Pitfall 2: No dependency injection, Pitfall 5: Circular dependencies, Pitfall 7: Barrel exports leak internals, Pitfall 8: Path aliases | Apply DI pattern, run `madge` to detect cycles, explicit barrel exports, verify `tsc --noEmit` |
| **Phase 3: Testing and validation** | Pitfall 4: Coverage without quality, Pitfall 6: Breaking production | Write behavior tests (not implementation), feature flagging, staging validation, rollback testing |
| **Phase 4: Documentation** | Pitfall 3: Context rot, Pitfall 9: AI violates boundaries | Pre-commit hooks, CLAUDE.md updates on convention changes, directory-level docs |
| **Phase 5+: Ongoing** | Pitfall 11: File size limits, Pitfall 12: JSDoc inconsistency | Enforce line counts, lint JSDoc rules, periodic documentation audits |

---

## Sources

- [TypeScript代码分割3大误区](https://m.blog.csdn.net/CompiLume/article/153739469) — Code splitting pitfalls, over-splitting, Tree Shaking prerequisites
- [TypeScript代码分割终极指南](https://m.blog.csdn.net/CodeTrick/article/153738895) — Route/feature-level splitting, performance optimization
- [我踩过了TypeScript的坑，只想告诉你快来](https://cloud.tencent.com/developer/article/2250910) — TypeScript migration pitfalls, testing strategies, risk mitigation
- [16万行代码、零停机！JavaScript到TypeScript迁移](https://new.qq.com/rain/a/20250227A06D0700) — Large-scale migration experience, incremental approach, CI validation
- [TypeScript模块系统揭秘](https://m.blog.csdn.net/BreakVein/article/153738284) — Module resolution errors, path configuration, extension conflicts
- [彻底解决TypeScript模块导入扩展名问题](https://blog.csdn.net/gitblog_00944/article/151455758) — Import extension requirements, dependency cache cleaning
- [Claude Code完整教程](https://m.toutiao.com/article/7607411779567813163/) — Context rot, CLAUDE.md maintenance strategies
- [还在瞎用Claude写代码？大神曝出最佳实践](https://m.toutiao.com/a7604044961096499727/) — CLAUDE.md file size limits, incremental documentation
- [万赞心得！ClaudeCode实战心得](https://juejin.cn/post/7594578555352350771) — Context window limitations, fresh conversation strategy
- [程序员必收藏！Git命令手册](https://m.blog.csdn.net/qq_44997147/article/151288310) — Git revert vs reset, rollback strategies
- [如何在多人协作项目中保证回滚操作的一致性？](https://developer.aliyun.com/article/1665691) — Team rollback best practices
- [前端面试题：循环依赖在TypeScript项目中](https://m.blog.csdn.net/weixin_46730573/article/141179893) — Circular dependency problems, solutions
- [在typescript项目中解决cycle依赖的方案](https://segmentfault.com/a/1190000043622126) — Interface-based decoupling, dependency injection
- [HarmonyOS Next代码重构指南](https://cloud.tencent.com/developer/article/2513350) — Extract method refactoring, validation checkpoints
- [VS Code TypeScript Refactoring](https://code.visualstudio.com/docs/typescript/typescript-refactoring) — IDE refactoring tools, extract method/file
- [TypeScript Best Practices in 2025](https://dev.to/mitu_mariam/typescript-best-practices-in-2025-57hb) — AI-assisted development integration
- [The Best AI Coding Assistants in 2026](https://www.datacamp.com/blog/best-ai-coding-assistants) — Refactoring capabilities, AI tools for code organization
- [15 Most Powerful AI Tools Every Developer Should Use in 2025](https://dev.to/nilebits/15-most-powerful-ai-tools-every-developer-should-be-using-in-2025-2075) — Refact.ai, Cursor, AI-powered refactoring
- [AI-Assisted Coding: Practical Guide](http://finelybook.com/ai-assisted-coding/) — Prompt engineering, automated refactoring pitfalls

---

*Pitfalls research for: Agentic Development Improvements - Post Shit Now v1.2*
*Researched: 2026-02-25*
