---
phase: 01-fix-instagram-integration-bugs
plan: 03
type: tdd
wave: 2
depends_on: ["02"]
files_modified:
  - src/platforms/handlers/instagram.handler.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Instagram handler publish flow is tested for image, reel, and carousel formats"
    - "Rate limit behavior is tested (self-counting updates currentRateLimit)"
    - "Error paths are tested (missing credentials, missing token, missing accountId, daily limit)"
    - "Test coverage matches X handler's level of rigor"
  artifacts:
    - path: "src/platforms/handlers/instagram.handler.test.ts"
      provides: "Handler-level tests for InstagramHandler"
      min_lines: 150
  key_links:
    - from: "src/platforms/handlers/instagram.handler.test.ts"
      to: "src/platforms/__mocks__/clients.ts"
      via: "vi.mock swaps InstagramClient for MockInstagramClient"
      pattern: "MockInstagramClient"
    - from: "src/platforms/handlers/instagram.handler.test.ts"
      to: "src/platforms/handlers/instagram.handler.ts"
      via: "imports and tests InstagramHandler.publish()"
      pattern: "InstagramHandler"
---

<objective>
Create comprehensive handler-level tests for InstagramHandler, covering the full publish flow (image, reel, carousel), error paths, and rate limit behavior.

Purpose: Instagram currently has only a constructor smoke test. X has 8 test scenarios. This plan brings Instagram to parity, catching regressions in the publish flow and validating the rate limit tracking added in Plan 02.

Output: `src/platforms/handlers/instagram.handler.test.ts` with test coverage matching X handler patterns.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-fix-instagram-integration-bugs/01-CONTEXT.md
@.planning/phases/01-fix-instagram-integration-bugs/01-02-SUMMARY.md
@src/platforms/handlers/instagram.handler.ts
@src/platforms/handlers/x.handler.test.ts
@src/platforms/__mocks__/clients.ts

<interfaces>
<!-- Key contracts the executor needs -->

From src/platforms/handlers/x.handler.test.ts (test pattern to follow):
```typescript
// Module mocks pattern:
vi.mock("@trigger.dev/sdk", () => ({ ... }));
vi.mock("../../core/utils/publisher-factory.ts", () => ({ registerHandler: () => {} }));
vi.mock("../x/client.ts", () => { const { MockXClient } = require("../__mocks__/clients.ts"); return { XClient: MockXClient }; });
vi.mock("../../core/utils/crypto.ts", () => ({ decrypt: (val) => val, encrypt: (val) => val }));

// DB mock pattern:
function createMockDb(tokenRow, postRows = []) {
  return { select: () => ({ from: () => ({ where: () => ({ limit: () => [tokenRow] }) }) }),
           execute: async () => {}, ... };
}

// Post builder:
function buildPost(overrides = {}) { return { id: "post-001", userId: "user-001", ... }; }
```

From src/platforms/handlers/instagram.handler.ts (publish flow):
```typescript
// Reads metadata.accountId from token
// Checks daily post limit via DB query
// Creates InstagramClient(accessToken, accountId)
// Calls publishByFormat() which uses media.ts helpers
// media.ts helpers call: createImageContainer/createReelsContainer/createCarouselContainers → waitForContainerReady → publishContainer
```

From src/platforms/instagram/media.ts (must be mocked):
```typescript
export async function createImageContainer(client, imageUrl, caption): Promise<InstagramContainer>
export async function createReelsContainer(client, videoUrl, caption): Promise<InstagramContainer>
export async function createCarouselContainers(client, mediaUrls, caption): Promise<InstagramContainer>
export async function waitForContainerReady(client, containerId): Promise<void>
export async function publishContainer(client, containerId): Promise<InstagramContainer>
```

From src/core/types/publisher.ts:
```typescript
export interface RateLimitInfo { limit: number; remaining: number; resetAt: Date; }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create Instagram handler test suite</name>
  <files>src/platforms/handlers/instagram.handler.test.ts</files>
  <behavior>
  - Test: Single image publish succeeds — returns `{ status: "published", externalPostId: "..." }`
  - Test: Reel publish succeeds with video URL
  - Test: Carousel publish succeeds with multiple image URLs
  - Test: Missing INSTAGRAM_APP_ID returns `{ status: "failed", error: contains "not set" }`
  - Test: Missing OAuth token returns `{ status: "failed", error: "no_instagram_oauth_token" }`
  - Test: Missing accountId in token metadata returns `{ status: "failed", error: "instagram_account_id_not_in_token_metadata" }`
  - Test: Daily post limit exceeded returns `{ status: "failed", error: contains "daily_limit" }`
  - Test: After successful publish, `getRateLimitInfo()` returns non-null with correct remaining count
  </behavior>
  <action>
Create `src/platforms/handlers/instagram.handler.test.ts` following the exact pattern from `x.handler.test.ts`:

**Module mocks** (set up before imports):
```typescript
vi.mock("@trigger.dev/sdk", () => ({
  wait: { until: async () => {} },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));
vi.mock("../../core/utils/publisher-factory.ts", () => ({ registerHandler: () => {} }));
vi.mock("../instagram/client.ts", () => {
  const { MockInstagramClient } = require("../__mocks__/clients.ts");
  return { InstagramClient: MockInstagramClient };
});
vi.mock("../instagram/oauth.ts", () => ({
  refreshInstagramToken: async () => ({ accessToken: "refreshed", expiresIn: 5184000 }),
}));
vi.mock("../../core/utils/crypto.ts", () => ({
  decrypt: (val: string) => val,
  encrypt: (val: string) => val,
}));
```

**Mock the media.ts helpers** — these call through to the client, so mock them to use the client methods directly:
```typescript
vi.mock("../instagram/media.ts", () => ({
  createImageContainer: async (_client: unknown, _url: string, _caption: string) => ({ id: "container_1" }),
  createReelsContainer: async (_client: unknown, _url: string, _caption: string) => ({ id: "container_1" }),
  createCarouselContainers: async (_client: unknown, _urls: string[], _caption: string) => ({ id: "container_1" }),
  waitForContainerReady: async () => {},
  publishContainer: async (_client: unknown, _containerId: string) => ({ id: "ig_media_123" }),
}));
```

**DB mock**: Create a `createMockDb()` helper that returns a mock db object supporting:
- `select().from(oauthTokens).where().limit()` — returns token row with `metadata: { accountId: "ig_12345" }`
- `select().from(posts).where()` — returns empty array (no daily limit hit) by default
- `execute()` — no-op for update queries

**Test helpers**:
- `buildPost(overrides)` — returns a full post row with platform "instagram", mediaUrls: ["https://example.com/img.jpg"], sensible defaults
- Set `process.env.INSTAGRAM_APP_ID` and `process.env.INSTAGRAM_APP_SECRET` in `beforeEach`, clean up in `afterEach`

**Test scenarios** (8 tests in 3 describe blocks):

`describe("InstagramHandler")`:
  - `describe("single post publish")`:
    - `it("publishes image post successfully")` — default post with mediaUrls, expect status "published" and externalPostId present
    - `it("publishes reel successfully")` — post with metadata.instagramFormat "reel" and video URL
    - `it("publishes carousel successfully")` — post with multiple mediaUrls and metadata.instagramFormat "carousel"

  - `describe("error paths")`:
    - `it("fails when INSTAGRAM_APP_ID missing")` — delete env var, expect status "failed"
    - `it("fails when no OAuth token found")` — mock db returns empty token array
    - `it("fails when accountId missing from metadata")` — token with metadata: {} (no accountId)
    - `it("fails when daily post limit reached")` — mock db returns MAX_POSTS_PER_DAY posts for today

  - `describe("rate limiting")`:
    - `it("updates rate limit info after successful publish")` — call publish, then check `handler.getRateLimitInfo()` returns non-null with remaining < MAX_REQUESTS_PER_HOUR

Import `InstagramHandler` AFTER the vi.mock calls (dynamic import or just regular import — vitest hoists vi.mock).
  </action>
  <verify>
    <automated>bun test src/platforms/handlers/instagram.handler.test.ts</automated>
  </verify>
  <done>
- All 8 test scenarios pass
- Test file follows x.handler.test.ts patterns (module mocks, buildPost helper, describe blocks)
- No tests access private methods — all go through public publish() API
- `bun test` passes with no regressions
  </done>
</task>

</tasks>

<verification>
- `bun test src/platforms/handlers/instagram.handler.test.ts` — all 8 tests pass
- `bun test` — no regressions across test suite
- `bun run typecheck` — passes
</verification>

<success_criteria>
Instagram handler has test coverage matching X handler's level: successful publish for all three formats (image, reel, carousel), error paths for missing credentials/token/accountId/daily limit, and rate limit tracking verification.
</success_criteria>

<output>
After completion, create `.planning/phases/01-fix-instagram-integration-bugs/01-03-SUMMARY.md`
</output>
