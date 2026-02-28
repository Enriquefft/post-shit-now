# Phase 29: Testing Infrastructure - Research

**Researched:** 2026-02-28
**Domain:** Vitest testing, mock infrastructure, JSDoc behavioral contracts
**Confidence:** HIGH

## Summary

Phase 29 adds testing infrastructure for the publish pipeline: mock API clients, interface compliance tests, tweet validation unit tests, and thread checkpoint tests. The project already has a working Vitest setup (v4.0.18) with 12 passing test files and 191 tests. The existing `vitest.config.ts` works without explicit path alias configuration because Vitest 4.x automatically reads `tsconfig.json` paths. The `bun test` command also works (using Bun's native test runner), but `vitest run` is the primary test runner configured in `package.json`.

The existing test suite already covers the publisher-factory (18 tests), PlatformPublisher interface shape tests (19 tests), thread-splitter (20 tests), and publish-post orchestration (6 tests). What is MISSING per the requirements: mock classes for the four platform API clients (XClient, LinkedInClient, InstagramClient, TikTokClient), tweet validation unit tests (countTweetChars edge cases), thread checkpoint logic tests (resume, duplicate detection), and JSDoc behavioral contracts on platform interfaces.

**Primary recommendation:** Build mock classes for the four platform clients at the class boundary (not HTTP layer), add targeted unit tests for countTweetChars and thread checkpoint/resume logic in XHandler.postThread, and add JSDoc contracts to platform interface definitions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Critical paths only -- no broad coverage goal for this phase
- Focus on: publish flow, tweet validation (weighted character counting), thread checkpoint persistence and resume, platform handler contracts
- Skip utility/helper coverage, analytics, series, voice, team modules
- Interface compliance tests cover the publish flow only (publish(), postThread(), error handling), not every PlatformPublisher method
- Use real X API response shapes for test fixtures -- actual response structures, not simplified stubs
- Test data doubles as API shape documentation
- Mock the DB layer (Drizzle query results), no test database or Neon branches
- JSDoc scope: Platform interfaces only -- PlatformPublisher, PlatformClient, handler methods
- Skip internal helpers and non-platform exports
- JSDoc style: Caller contracts -- preconditions, postconditions, error behavior, side effects
- @throws tags for non-obvious errors only -- SkipRetryError, partially_posted behavior, checkpoint side effects
- JSDoc location: Interface/type definitions only (single source of truth). Implementations inherit the contract.

### Claude's Discretion
- Mock implementation details (hand-crafted vs factory pattern)
- Test file organization (co-located vs __tests__ dirs)
- Vitest configuration specifics (pool, reporters, coverage thresholds)
- Which specific API response fixtures to capture

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Vitest configured with TypeScript path alias resolution | Already working -- Vitest 4.0.18 reads tsconfig.json paths automatically. No changes needed. |
| TEST-02 | Mock infrastructure exists for all external platform API clients | Create MockXClient, MockLinkedInClient, MockInstagramClient, MockTikTokClient at class boundary level |
| TEST-03 | Interface compliance tests validate PlatformPublisher behavioral contracts | Extend existing publisher.test.ts with publish flow behavioral tests (preconditions, postconditions, error handling) |
| TEST-04 | Unit tests cover tweet validation and thread checkpoint logic | Add countTweetChars edge case tests + thread checkpoint resume/duplicate detection tests |
| DOC-03 | JSDoc comments include behavioral contracts on public APIs | Add @precondition/@postcondition/@throws to PlatformPublisher, client interfaces, handler methods |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.0.18 | Test runner | Already installed and configured, 191 tests passing |
| bun-types | latest | Type definitions | Already in devDependencies for Bun runtime |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest/globals | (bundled) | Global test APIs | Already enabled via `globals: true` in vitest.config.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest | bun test | Bun's test runner works but vitest has better mocking (vi.mock) and is the configured standard |

**Installation:**
No new dependencies needed. Everything is already installed.

## Architecture Patterns

### Current Test File Organization (Co-located)
```
src/
├── core/
│   ├── types/
│   │   ├── publisher.ts          # PlatformPublisher interface
│   │   └── publisher.test.ts     # Interface compliance tests (19 tests)
│   └── utils/
│       ├── publisher-factory.ts
│       ├── publisher-factory.test.ts  # Factory tests (18 tests)
│       ├── tweet-validator.ts
│       ├── thread-splitter.ts
│       └── thread-splitter.test.ts    # Thread splitter tests (20 tests)
├── platforms/
│   ├── x/
│   │   ├── client.ts             # XClient class
│   │   └── types.ts              # XApiError, RateLimitError, Zod schemas
│   ├── linkedin/client.ts        # LinkedInClient class
│   ├── instagram/client.ts       # InstagramClient class
│   └── tiktok/client.ts          # TikTokClient class
└── trigger/
    └── publish-post.test.ts      # Orchestration tests (6 tests)
```

### Recommended New Files
```
src/
├── core/
│   └── utils/
│       └── tweet-validator.test.ts    # NEW: countTweetChars edge cases
├── platforms/
│   ├── __mocks__/
│   │   └── clients.ts                 # NEW: MockXClient, MockLinkedInClient, etc.
│   └── handlers/
│       └── x.handler.test.ts          # NEW: thread checkpoint resume + duplicate detection
└── (existing test files untouched)
```

### Pattern 1: Mock at Client Class Boundary
**What:** Create mock classes that implement the same public API as real client classes (XClient, LinkedInClient, etc.) but return canned responses. Mock at the class instantiation point, NOT at the HTTP fetch layer.
**When to use:** All handler tests that need to avoid real API calls.
**Example:**
```typescript
// src/platforms/__mocks__/clients.ts
import type { RateLimitInfo } from "../x/types.ts";

const DEFAULT_RATE_LIMIT: RateLimitInfo = {
  limit: 300,
  remaining: 299,
  resetAt: new Date(Date.now() + 900_000),
};

export class MockXClient {
  private tweets: Array<{ id: string; text: string }> = [];
  private nextId = 1;
  private shouldFail = false;
  private failError: Error | null = null;

  async createTweet(params: {
    text: string;
    replyToId?: string;
    mediaIds?: string[];
  }): Promise<{ id: string; text: string; rateLimit: RateLimitInfo }> {
    if (this.shouldFail && this.failError) throw this.failError;
    const id = `tweet_${this.nextId++}`;
    this.tweets.push({ id, text: params.text });
    return { id, text: params.text, rateLimit: DEFAULT_RATE_LIMIT };
  }

  async getTimeline(params?: { maxResults?: number }): Promise<{
    data: Array<{ id: string; text: string }>;
    rateLimit: RateLimitInfo;
  }> {
    return { data: this.tweets, rateLimit: DEFAULT_RATE_LIMIT };
  }

  // Test helpers
  setFailure(error: Error): void { this.shouldFail = true; this.failError = error; }
  clearFailure(): void { this.shouldFail = false; this.failError = null; }
  getPostedTweets(): Array<{ id: string; text: string }> { return [...this.tweets]; }
  reset(): void { this.tweets = []; this.nextId = 1; this.shouldFail = false; }
}
```

### Pattern 2: Real API Response Fixtures
**What:** Test fixtures use actual X API response shapes (from docs/observed responses) so fixtures double as API shape documentation.
**When to use:** All mock client responses and test assertions.
**Example:**
```typescript
// Fixture: Real X API v2 tweet creation response shape
const REAL_TWEET_RESPONSE = {
  data: {
    id: "1849234567890123456",
    text: "Hello world",
  },
};

// Fixture: Real X API v2 error response (403 duplicate)
const REAL_DUPLICATE_ERROR = {
  status: 403,
  detail: "You are not allowed to create a Tweet with duplicate content.",
  type: "about:blank",
  title: "Forbidden",
};

// Fixture: Real X API rate limit headers
const REAL_RATE_LIMIT_HEADERS = {
  "x-rate-limit-limit": "300",
  "x-rate-limit-remaining": "0",
  "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 900),
};
```

### Pattern 3: DB Mock Chain Pattern (Already Established)
**What:** The existing tests use a Drizzle-shaped chainable mock pattern. This should be reused for consistency.
**When to use:** Any test needing DB interaction mocking.
**Example (from existing publish-post.test.ts):**
```typescript
function buildMockDb(post: ReturnType<typeof buildPost> | null) {
  const mockLimit = vi.fn().mockResolvedValue(post ? [post] : []);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  const mockSetWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  return { select: mockSelect, update: mockUpdate };
}
```

### Anti-Patterns to Avoid
- **Mocking at HTTP/fetch layer:** The user explicitly decided to mock at client class boundary, not at network level. Do NOT use `vi.spyOn(globalThis, 'fetch')`.
- **Test database or Neon branches:** Mock Drizzle query results only. No real DB connections.
- **Broad coverage:** This phase focuses only on publish flow, tweet validation, and thread checkpoint. Do not add tests for analytics, series, voice, or team modules.
- **Mocking everything in PlatformPublisher:** Interface compliance tests cover publish(), postThread(), and error handling only -- not validateCredentials, getRateLimitInfo, etc. (existing publisher.test.ts already covers those).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path alias resolution in tests | Custom resolve config | Vitest 4.x auto-reads tsconfig.json paths | Already working, 191 tests pass with @psn/core and @psn/platforms |
| Grapheme counting | Custom Unicode parser | Intl.Segmenter (already used in tweet-validator.ts) | Built-in, handles ZWJ sequences correctly |
| Test globals (describe, it, expect) | Manual imports | `globals: true` in vitest.config.ts | Already configured |

**Key insight:** The existing test infrastructure is more mature than the requirements suggest. TEST-01 (Vitest with path aliases) is already complete. The work is focused on mock classes, targeted unit tests, and JSDoc.

## Common Pitfalls

### Pitfall 1: Trigger.dev SDK Mock Complexity
**What goes wrong:** XHandler.postThread() calls `retry.onThrow()` and `wait.until()` from `@trigger.dev/sdk`. Tests fail because these SDK functions aren't available outside the Trigger.dev runtime.
**Why it happens:** The handler code directly imports Trigger.dev SDK functions that expect a task execution context.
**How to avoid:** Mock `@trigger.dev/sdk` at module level with `vi.mock()` like the existing publish-post.test.ts does. Make `retry.onThrow` execute the callback directly (no retries), and `wait.until` resolve immediately.
**Warning signs:** Errors mentioning "task context" or "not running in a task".

### Pitfall 2: Side-Effect Handler Registration
**What goes wrong:** Importing any handler file (e.g., `x.handler.ts`) triggers `registerHandler()` as a top-level side-effect, polluting the handler registry across tests.
**Why it happens:** The factory pattern uses import-time side-effects for handler registration.
**How to avoid:** Use `vi.mock("../platforms/handlers/index.ts", () => ({}))` to prevent real handler registration (existing pattern). Always call `unregisterHandler()` in `afterEach()`.
**Warning signs:** Tests passing individually but failing when run together.

### Pitfall 3: Testing Private Methods (postThread, saveCheckpoint)
**What goes wrong:** `postThread` is a private method on XHandler. Thread checkpoint logic is tested indirectly through `publish()`.
**Why it happens:** TypeScript private visibility prevents direct testing.
**How to avoid:** Test through the public `publish()` method by providing multi-tweet content. Mock XClient at the class boundary so you control which tweets succeed/fail and verify checkpoint saves via the mock DB.
**Warning signs:** Trying to cast to `any` to access private methods -- avoid this.

### Pitfall 4: Vitest Module Cache with Dynamic Imports
**What goes wrong:** The existing publish-post.test.ts uses `await import()` for dynamic imports, causing slow test execution (1165ms for a single test) due to module loading overhead.
**Why it happens:** Each `await import()` loads the full module graph.
**How to avoid:** For new tests, prefer static imports with `vi.mock()` at the top of the file. Only use dynamic imports when absolutely necessary (e.g., when testing modules that have top-level side-effects that must run after mocks are set up).

### Pitfall 5: SkipRetryError as Internal Class
**What goes wrong:** Tests can't import SkipRetryError directly because it's defined inside x.handler.ts (not exported).
**Why it happens:** SkipRetryError is an implementation detail of the thread posting retry logic.
**How to avoid:** Test the behavior (duplicate detection, checkpoint saving), not the error class. Verify that when XClient throws a 403 duplicate error, the handler recovers the tweet ID from timeline and continues.

## Code Examples

### countTweetChars Edge Cases to Test
```typescript
// Source: X developer docs, twitter-text v3.json config
describe("countTweetChars edge cases", () => {
  it("counts plain ASCII as 1 char each", () => {
    expect(countTweetChars("Hello")).toBe(5);
  });

  it("counts emoji as 2 chars", () => {
    // Single emoji = 1 grapheme = 2 weighted chars
    expect(countTweetChars("\u{1F600}")).toBe(2); // grinning face
  });

  it("counts ZWJ emoji sequence as 2 chars (single grapheme)", () => {
    // Family emoji (ZWJ sequence) = 1 grapheme = 2 weighted chars
    expect(countTweetChars("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}")).toBe(2);
  });

  it("counts URL as 23 chars regardless of actual length", () => {
    expect(countTweetChars("https://example.com")).toBe(23);
    expect(countTweetChars("https://example.com/very/long/path")).toBe(23);
  });

  it("counts CJK characters as 2 chars each", () => {
    expect(countTweetChars("\u4F60\u597D")).toBe(4); // "nihao" in Chinese
  });

  it("counts bare domain URLs as 23 chars", () => {
    expect(countTweetChars("example.com")).toBe(23);
  });

  it("returns 0 for empty string", () => {
    expect(countTweetChars("")).toBe(0);
  });

  it("handles mixed content (text + URL + emoji)", () => {
    // "Hi " = 3, URL = 23, " " = 1, emoji = 2 => 29
    expect(countTweetChars("Hi https://example.com \u{1F600}")).toBe(29);
  });
});
```

### Thread Checkpoint Resume Test Shape
```typescript
// Testing through XHandler.publish() with mock XClient
describe("XHandler thread checkpoint resume", () => {
  it("resumes from checkpoint on retry", async () => {
    const handler = new XHandler();
    const mockClient = new MockXClient();
    // First 2 tweets already posted (simulated by checkpoint in metadata)
    const post = buildPost({
      content: JSON.stringify(["tweet 1", "tweet 2", "tweet 3"]),
      metadata: {
        threadProgress: JSON.stringify({
          posted: 2,
          total: 3,
          lastPostedId: "tweet_2",
          tweetIds: ["tweet_1", "tweet_2"],
        }),
      },
    });
    // Only tweet 3 should be posted
    const result = await handler.publish(mockDb, post, encKey);
    expect(result.status).toBe("published");
    // Verify only 1 createTweet call was made (for tweet 3)
  });
});
```

### JSDoc Behavioral Contract Pattern
```typescript
// Source: Existing publisher.ts pattern + CONTEXT.md decisions
/**
 * Publish a post to the platform.
 *
 * @precondition OAuth token is decrypted and valid (or will be refreshed)
 * @precondition `post.content` is non-empty and within platform limits
 * @postcondition Returns `{ status: "published", externalPostId }` on success
 * @postcondition Returns `{ status: "failed", error }` for non-retryable errors
 * @throws {SkipRetryError} When X Error 187 (duplicate) detected during thread posting --
 *   handler recovers tweet ID from timeline instead of failing
 * @throws Error starting with "RATE_LIMIT:" when rate limited (for orchestrator retry)
 * @sideeffect Saves thread checkpoint to DB after each successful tweet in a thread
 * @sideeffect Sets post subStatus to "thread_partial" during thread posting
 */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vitest 1.x manual path alias config | Vitest 4.x auto-reads tsconfig.json | Vitest 3.x+ | No vite-tsconfig-paths plugin needed |
| vi.mocked() helper | vi.mocked() is built-in | Vitest 1.x+ | Already available, used in existing tests |
| msw/nock HTTP mocking | Mock at class boundary | Project decision | Simpler, no HTTP interception overhead |

**Deprecated/outdated:**
- `vite-tsconfig-paths` plugin: Not needed with Vitest 4.x -- it reads tsconfig.json paths natively
- `@testing-library/jest-dom`: Not relevant (no DOM in this project)

## Open Questions

1. **ZWJ emoji counting precision**
   - What we know: `Intl.Segmenter` correctly clusters ZWJ sequences as single graphemes. The codePointWeight function uses the first code point's weight.
   - What's unclear: Whether X's actual counting for specific ZWJ sequences (flags, skin tones, families) always matches our weight=200 (2 chars) assignment.
   - Recommendation: Test with known examples from X's documentation. If edge cases emerge during testing, adjust weights.

2. **Bare domain URL detection edge cases**
   - What we know: The URL_PATTERN regex matches bare domains like `example.com`. The test data should include edge cases like `example.co.uk` and `t.co`.
   - What's unclear: Whether all TLDs in the regex match X's actual URL detection.
   - Recommendation: Include common URL formats in test fixtures and document any discrepancies as known limitations.

## Sources

### Primary (HIGH confidence)
- Existing codebase: vitest.config.ts, package.json, tsconfig.json (verified working configuration)
- Existing tests: 12 test files, 191 passing tests (verified via `vitest run`)
- Source code: x.handler.ts, tweet-validator.ts, thread-splitter.ts, publisher.ts (direct inspection)

### Secondary (MEDIUM confidence)
- X developer docs: weighted character counting rules (countTweetChars implementation references v3.json config)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- already installed and verified working
- Architecture: HIGH -- existing test patterns established in 12 test files
- Pitfalls: HIGH -- identified from direct code inspection (Trigger.dev mocking, side-effect registration, private methods)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- Vitest 4.x is established)
