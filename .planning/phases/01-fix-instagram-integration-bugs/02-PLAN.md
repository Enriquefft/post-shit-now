---
phase: 01-fix-instagram-integration-bugs
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/platforms/handlers/instagram.handler.ts
  - src/platforms/__mocks__/clients.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "InstagramHandler tracks API requests and updates currentRateLimit after each publish"
    - "getRateLimitInfo() returns actual rate limit state, not always null"
    - "isRateLimited() returns true when 200/hr budget is exhausted"
    - "MockInstagramClient supports container workflow methods for testing"
  artifacts:
    - path: "src/platforms/handlers/instagram.handler.ts"
      provides: "Rate limit tracking in Instagram handler"
      contains: "currentRateLimit"
    - path: "src/platforms/__mocks__/clients.ts"
      provides: "Full MockInstagramClient with container workflow stubs"
      contains: "createContainer"
  key_links:
    - from: "src/platforms/handlers/instagram.handler.ts"
      to: "src/platforms/instagram/client.ts"
      via: "InstagramClient constructor and API calls"
      pattern: "new InstagramClient"
    - from: "src/platforms/__mocks__/clients.ts"
      to: "src/platforms/instagram/client.ts"
      via: "mirrors public API surface"
      pattern: "MockInstagramClient"
---

<objective>
Wire up rate limit tracking in InstagramHandler so `getRateLimitInfo()` and `isRateLimited()` return real values, and expand MockInstagramClient to support full handler testing.

Purpose: The handler declares `currentRateLimit` but never updates it, making rate limit methods useless. The mock client is a stub with no methods, blocking handler test coverage.

Output: A working rate limit self-counter in the handler and a test-ready MockInstagramClient.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-fix-instagram-integration-bugs/01-CONTEXT.md
@src/platforms/handlers/instagram.handler.ts
@src/platforms/__mocks__/clients.ts
@src/platforms/instagram/client.ts
@src/platforms/instagram/media.ts
@src/platforms/instagram/types.ts

<interfaces>
<!-- Key types the executor needs -->

From src/core/types/publisher.ts:
```typescript
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}
```

From src/platforms/instagram/types.ts:
```typescript
export const MAX_REQUESTS_PER_HOUR = 200;
export const MAX_POSTS_PER_DAY = 25;
```

From src/platforms/instagram/client.ts (public API surface):
```typescript
class InstagramClient {
  constructor(accessToken: string, accountId: string)
  async request<T>(endpoint: string, options?: RequestInit, schema?: ZodType<T>): Promise<T>
  async getMe(): Promise<InstagramProfile>
  async getMedia(params?: { limit?: number }): Promise<InstagramMediaList>
  async getMediaInsights(mediaId: string, metrics: string[]): Promise<InstagramInsights>
  async getAccountInsights(metrics: string[], period: string): Promise<InstagramInsights>
  async createContainer(params: Record<string, string>): Promise<InstagramContainer>
  async getContainerStatus(containerId: string): Promise<InstagramContainerStatus>
  async publishContainer(containerId: string): Promise<InstagramContainer>
  async searchHashtags(query: string): Promise<InstagramHashtagSearch>
  async postComment(mediaId: string, text: string): Promise<InstagramComment>
  getRateLimitInfo(): InstagramRateLimitInfo
}
```

From src/platforms/instagram/media.ts (helpers used by handler):
```typescript
async function createImageContainer(client: InstagramClient, imageUrl: string, caption: string): Promise<InstagramContainer>
async function createReelsContainer(client: InstagramClient, videoUrl: string, caption: string): Promise<InstagramContainer>
async function createCarouselContainers(client: InstagramClient, mediaUrls: string[], caption: string): Promise<InstagramContainer>
async function waitForContainerReady(client: InstagramClient, containerId: string): Promise<void>
async function publishContainer(client: InstagramClient, containerId: string): Promise<InstagramContainer>
```

From src/platforms/__mocks__/clients.ts (MockXClient pattern):
```typescript
class MockXClient {
  private tweets: PostedTweet[] = [];
  private nextId = 1;
  private pendingFailure: Error | null = null;
  constructor(private readonly accessToken: string) {}
  async createTweet(params): Promise<{ id: string; text: string; rateLimit: RateLimitInfo }>
  setFailure(error: Error): void
  clearFailure(): void
  getPostedTweets(): PostedTweet[]
  reset(): void
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire rate limit tracking in InstagramHandler</name>
  <files>src/platforms/handlers/instagram.handler.ts</files>
  <action>
Instagram's API does not return rate limit headers. The client (`InstagramClient`) already self-tracks requests via `requestCount` and `windowStart` internally. The handler needs to mirror this at the handler level for the `PlatformPublisher` contract.

Add rate limit self-tracking to `InstagramHandler`:

1. **Add tracking state**: Add private fields `requestCount = 0` and `windowStart = Date.now()` alongside the existing `currentRateLimit`.

2. **Create a private `updateRateLimit()` method**:
   - Check if 1 hour has elapsed since `windowStart`. If so, reset `requestCount` to 0 and `windowStart` to `Date.now()`.
   - Increment `requestCount`.
   - Set `currentRateLimit` to `{ limit: MAX_REQUESTS_PER_HOUR, remaining: MAX_REQUESTS_PER_HOUR - requestCount, resetAt: new Date(windowStart + 3_600_000) }`.
   - Import `MAX_REQUESTS_PER_HOUR` from `../instagram/types.ts` (already imported: `MAX_POSTS_PER_DAY` is there, add `MAX_REQUESTS_PER_HOUR`).

3. **Call `updateRateLimit()`** after a successful publish in the `publishByFormat` method — specifically after each `publishContainer()` call succeeds, before returning the ID. Since each publish involves ~3 API calls (create container, poll status, publish), increment by 3 per publish. Simplest approach: call `this.updateRateLimit()` once after the full publish cycle completes in `publishByFormat`, incrementing `requestCount` by 3 instead of 1.

   Actually, simpler: just call `updateRateLimit()` once in the `publish()` method after `publishByFormat` returns successfully (before the return statement at line 133). Each publish is roughly 3 API calls, so increment by 3 (add a `count` parameter to `updateRateLimit(count: number = 1)`).

4. **Import `MAX_REQUESTS_PER_HOUR`**: It's already exported from `../instagram/types.ts`, just add it to the existing import.

Keep the existing `getRateLimitInfo()`, `isRateLimited()`, and `getRetryAfter()` methods as-is — they already work correctly with `currentRateLimit`, they just need it to be populated.
  </action>
  <verify>
    <automated>bun run typecheck</automated>
  </verify>
  <done>
- `currentRateLimit` is updated after each successful publish
- `getRateLimitInfo()` returns actual rate limit state
- `isRateLimited()` returns true when remaining hits 0
- `MAX_REQUESTS_PER_HOUR` imported and used for limit budget
  </done>
</task>

<task type="auto">
  <name>Task 2: Expand MockInstagramClient for handler testing</name>
  <files>src/platforms/__mocks__/clients.ts</files>
  <action>
Expand `MockInstagramClient` to mirror the `InstagramClient` public API surface needed by the handler's publish flow. Follow the `MockXClient` pattern: track published containers in memory, support failure injection, provide test helpers.

The handler doesn't call `InstagramClient` methods directly — it uses the `media.ts` helper functions (`createImageContainer`, `createReelsContainer`, etc.) which call `client.createContainer()`, `client.getContainerStatus()`, and `client.publishContainer()`. So the mock needs those three core methods.

Add to `MockInstagramClient`:

1. **State tracking**:
   - `private containers: Array<{ id: string; type: string; caption: string }>` (tracks created containers)
   - `private nextId = 1`
   - `private pendingFailure: Error | null = null`

2. **Core methods** (called by `media.ts` helpers via the client):
   - `async createContainer(params: Record<string, string>): Promise<{ id: string }>` — stores container, returns `{ id: "container_N" }`
   - `async getContainerStatus(containerId: string): Promise<{ id: string; status_code: string }>` — returns `{ id: containerId, status_code: "FINISHED" }` (always ready)
   - `async publishContainer(containerId: string): Promise<{ id: string }>` — returns `{ id: "ig_media_N" }` (the published media ID)
   - `async getMe(): Promise<{ id: string; username: string }>` — returns `{ id: accountId, username: "test_user" }`

3. **Test helpers** (matching MockXClient pattern):
   - `setFailure(error: Error): void` — next API call throws this error
   - `clearFailure(): void` — restore normal behavior
   - `getPublishedContainers()` — return copy of containers array
   - `reset(): void` — clear all state

4. **Failure injection**: Each core method should check `pendingFailure` first (same pattern as MockXClient.createTweet).

5. **Import `InstagramRateLimitError` from `../instagram/types.ts`** — not strictly needed for the mock itself, but tests will import it from there. Just ensure the mock doesn't need this import.

Keep the existing constructor signature `(accessToken: string, accountId: string)`.
  </action>
  <verify>
    <automated>bun run typecheck</automated>
  </verify>
  <done>
- MockInstagramClient has `createContainer`, `getContainerStatus`, `publishContainer`, `getMe` methods
- Failure injection (`setFailure`/`clearFailure`) works like MockXClient
- Test helpers expose internal state for assertions
- TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
- `bun run typecheck` passes
- `biome check src/platforms/handlers/instagram.handler.ts src/platforms/__mocks__/clients.ts` passes
- InstagramHandler.getRateLimitInfo() returns non-null after a publish
- MockInstagramClient has all methods needed by instagram/media.ts helpers
</verification>

<success_criteria>
Rate limit tracking is functional in InstagramHandler and MockInstagramClient supports the full container workflow for handler-level testing.
</success_criteria>

<output>
After completion, create `.planning/phases/01-fix-instagram-integration-bugs/01-02-SUMMARY.md`
</output>
