# Architecture Research: v1.3 Real-World Reliability

**Domain:** Integration fixes for existing social media automation system
**Researched:** 2026-02-27
**Confidence:** HIGH

## Existing Architecture (Baseline)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLI Layer (src/cli/)                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐      │
│  │ setup-*  │  │  post.ts  │  │ plan.ts  │  │ setup-x-oauth │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘      │
├───────┴──────────────┴────────────┴─────────────────┴──────────────┤
│  Core Layer (src/core/)                                             │
│  ┌────────────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐      │
│  │publisher-factory│  │ crypto   │  │  env    │  │thread-   │      │
│  │                │  │          │  │         │  │splitter  │      │
│  └───────┬────────┘  └──────────┘  └─────────┘  └──────────┘      │
├──────────┴─────────────────────────────────────────────────────────┤
│  Platform Layer (src/platforms/)                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │XHandler  │  │LinkedIn  │  │Instagram │  │TikTok   │           │
│  │ ↓client  │  │Handler   │  │Handler   │  │Handler  │           │
│  │ ↓oauth   │  │          │  │          │  │         │           │
│  │ ↓media   │  │          │  │          │  │         │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘           │
├───────┴──────────────┴────────────┴──────────────┴────────────────┤
│  Trigger Layer (src/trigger/)                                       │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ publish-post │  │ watchdog │  │analytics │  │token-    │      │
│  │              │  │          │  │collector │  │refresher │      │
│  └──────┬───────┘  └──────────┘  └──────────┘  └──────────┘      │
├─────────┴──────────────────────────────────────────────────────────┤
│  Data Layer                                                         │
│  ┌──────────────────────────────────────────┐                      │
│  │  Neon Postgres (Drizzle ORM, RLS)        │                      │
│  │  14 tables: posts, oauth_tokens, etc.    │                      │
│  └──────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Current Data Flow: Publish

```
/psn:post (Claude Code)
    ↓ creates post row (status: "scheduled")
    ↓ schedules Trigger.dev delayed run
publish-post task (Trigger.dev worker)
    ↓ reads DATABASE_URL, HUB_ENCRYPTION_KEY from process.env
    ↓ connects to Neon Postgres
    ↓ loads post row
    ↓ resolves handler via publisher-factory
    ↓ handler.publish(db, post, encKey)
        ↓ decrypts OAuth token from DB
        ↓ creates platform client (e.g., XClient)
        ↓ uploads media if needed
        ↓ posts content via API
        ↓ returns PlatformPublishResult
    ↓ updates post row (status: "published")
    ↓ triggers notification if failed
```

## Integration Points for v1.3 Fixes

### 1. Trigger.dev Env Var Delivery

**Problem:** Workers read `process.env.DATABASE_URL` and `process.env.HUB_ENCRYPTION_KEY` but these only exist in local config files (`config/keys.env`, `.hubs/personal.json`). Deployed workers on Trigger.dev Cloud have no access to local files, so every task crashes with "Missing required env vars."

**Where it fits:** Build extension in `trigger.config.ts` using Trigger.dev's `syncEnvVars` pattern.

**Architecture change: NEW helper + MODIFY config**

```
trigger.config.ts (current)
    defineConfig({ project, dirs, retries, maxDuration })

trigger.config.ts (after)
    defineConfig({
        project, dirs, retries, maxDuration,
        build: {
            extensions: [
                syncEnvVars(async () => {
                    // Reads .hubs/personal.json + config/keys.env
                    // Returns flat { name, value }[] array
                    return loadEnvVarsForDeploy();
                })
            ]
        }
    })
```

**New file: `src/trigger/env-sync.ts`** -- extracts env var loading logic so it is testable independently from the config file. Reads from `.hubs/personal.json` for hub credentials and `config/keys.env` for API keys + platform credentials.

**Env vars to sync:**
| Source | Env Var | Used By |
|--------|---------|---------|
| `.hubs/personal.json` | `DATABASE_URL` | All tasks (DB connection) |
| `.hubs/personal.json` | `HUB_ENCRYPTION_KEY` | publish-post, token-refresher (token decrypt) |
| `config/keys.env` | `X_CLIENT_ID` | XHandler (OAuth refresh during publish) |
| `config/keys.env` | `X_CLIENT_SECRET` | XHandler (OAuth refresh during publish) |
| `config/keys.env` | `TRIGGER_SECRET_KEY` | Task-to-task triggering (e.g., publish-post triggers notification-dispatcher) |
| `config/keys.env` | Other platform credentials | LinkedIn, Instagram, TikTok handlers |

**Data flow change:** At deploy time only. During `bunx trigger.dev deploy`, the syncEnvVars extension reads local files and pushes env vars to Trigger.dev Cloud. No changes to any task code -- they already read from `process.env.*`.

**Important detail:** The `syncEnvVars` callback runs during the build/deploy phase, which happens on the developer's machine (where local files exist). The env vars are then set in Trigger.dev Cloud for the deployed workers.

**Confidence:** HIGH -- Trigger.dev docs explicitly describe `syncEnvVars` as the solution for this exact pattern. No custom infrastructure needed.

---

### 2. X OAuth Callback Server

**Problem:** The OAuth flow uses `https://example.com/callback` as the callback URL. X redirects there after authorization, but that URL leads nowhere. Users must manually extract the `code` parameter from the browser's address bar. Real users fail at this step consistently.

**Where it fits:** New module in `src/cli/`, consumed by `src/cli/setup-x-oauth.ts`.

**Architecture change: NEW component + MODIFY existing**

```
src/cli/oauth-callback-server.ts  (NEW)
    startCallbackServer(port) -> { url, waitForCode(), close() }
        Uses Bun.serve() for lightweight HTTP server
        Listens on localhost:PORT/callback
        Extracts ?code= and ?state= from redirect query params
        Resolves Promise with code, auto-closes server

src/cli/setup-x-oauth.ts  (MODIFY)
    X_CALLBACK_URL changes from "https://example.com/callback"
        to "http://localhost:18923/callback"
    After generating auth URL, starts callback server
    Waits for code via server Promise
    Falls back to manual code entry if port already bound
```

**`src/platforms/x/oauth.ts` -- NO CHANGE.** The `callbackUrl` is already a parameter to `createXOAuthClient()`. The hardcoding is in `setup-x-oauth.ts`, not in the oauth module.

**Port selection:** Use a fixed, unusual port (`18923`) because OAuth callback URLs must be registered in the X Developer Portal and must match exactly. Dynamic ports would make setup instructions impossible.

**User-facing change to setup instructions:** The `need_input` response from `setupXOAuth()` currently tells users to set the callback URL to `https://example.com/callback`. This changes to `http://localhost:18923/callback`.

**Data flow change:**

```
Current:
  generate auth URL → user opens browser → X redirects to example.com
  → user manually copies ?code= from URL bar → pastes into terminal

After:
  start Bun.serve() on :18923 → generate auth URL with localhost callback
  → user opens browser → X redirects to localhost:18923/callback
  → server captures ?code= → resolves Promise → server auto-closes
  → falls back to manual entry on BindError
```

**Reusability:** The callback server is generic (captures code + state from OAuth redirect). LinkedIn, Instagram, and TikTok OAuth flows can reuse it. Build the server as platform-agnostic.

**Confidence:** HIGH -- Bun.serve() is well-suited for this. The arctic library handles PKCE correctly regardless of callback URL. The only new piece is an HTTP server that captures one request.

---

### 3. Thread Publishing Resilience

**Problem:** If a 7-tweet thread fails on tweet 4, tweets 1-3 are already posted on X. The tweet IDs exist only in local variables. When Trigger.dev retries the task, `postThread()` starts from tweet 1 again, creating duplicate tweets.

**Where it fits:** MODIFY `src/platforms/handlers/x.handler.ts`. The infrastructure already exists but is incomplete.

**Current state (code analysis):**

The schema already defines `PostMetadata.threadProgress` (line 82 of schema.ts):
```typescript
threadProgress?: string;  // JSON string of { posted, total, lastPostedId, tweetIds }
```

The XHandler already **reads** thread progress on entry:
```typescript
const threadProgress = metadata?.threadProgress
    ? threadProgressSchema.parse(JSON.parse(metadata.threadProgress as string))
    : undefined;
const startIndex = threadProgress?.posted ?? 0;
const tweetIds = threadProgress?.tweetIds ?? [];
```

But the handler **never writes** progress back to the DB during the thread. If the task crashes between tweets, all progress is lost.

**Architecture change: MODIFY `XHandler.postThread()` signature and body**

```typescript
// Current signature (no DB access):
private async postThread(client, tweets, mediaIds, metadata, postId)

// After (DB access added):
private async postThread(client, tweets, mediaIds, metadata, postId, db)
```

**The `publish()` method already has `db`** -- it just needs to pass it down to `postThread()`.

**Data flow change for thread publishing:**

```
For each tweet[i] in thread:
    1. Call client.createTweet({ text, replyToId }) -> tweetId
    2. Append tweetId to accumulated tweetIds array
    3. db.update(posts)
       .set({
           subStatus: "thread_partial",
           metadata: {
               ...existingMetadata,
               threadProgress: JSON.stringify({
                   posted: i + 1,
                   total: tweets.length,
                   lastPostedId: tweetId,
                   tweetIds: [...accumulated]
               })
           }
       })
       .where(eq(posts.id, postId))
    4. Continue to next tweet

On crash/retry:
    1. publish-post task re-runs
    2. XHandler reads post.metadata.threadProgress
    3. Resumes from posted index, using lastPostedId as replyToId
    4. Skips already-posted tweets

After thread completes:
    1. Write all tweetIds to posts.platformPostIds
    2. Clear threadProgress from metadata (cleanup)
```

**Schema changes: NONE.** All fields already exist:
- `posts.metadata.threadProgress` -- typed in PostMetadata
- `posts.platformPostIds` -- typed as `string[]`, exists but unpopulated for threads
- `posts.subStatus` -- already supports `"thread_partial"` value

**DB writes per thread:** One UPDATE per tweet (typically 3-7). Using Neon HTTP driver, each is a stateless HTTP request. Acceptable latency and no connection concerns.

**Confidence:** HIGH -- the schema and read logic already exist. This fix adds the write-back that was missed during initial implementation.

---

### 4. Tweet Validation

**Problem:** X API returns HTTP 403 for tweets exceeding 280 characters. The error body is vague ("Forbidden"). Users see `"failed: Forbidden"` and have no idea the tweet was too long.

**Where it fits:** New validation module in `src/platforms/x/`, called from `XHandler` before any API calls.

**Architecture change: NEW component + MODIFY handler**

```
src/platforms/x/validation.ts  (NEW)
    X_CHAR_LIMIT = 280
    URL_DISPLAY_LENGTH = 23  (X shortens all URLs to t.co length)

    countTweetLength(text: string): number
        Accounts for URL shortening (URLs count as 23 chars regardless of actual length)

    validateTweet(text: string): { valid: boolean; error?: string; charCount: number }
        Returns clear error: "Tweet is 312 chars (max 280)"

    validateThread(tweets: string[]): { valid: boolean; errors: Array<{ index: number; error: string }> }
        Validates each tweet in thread, reports all violations at once

src/platforms/handlers/x.handler.ts  (MODIFY)
    Add validation call before createTweet():
        const validation = validateTweet(tweetText);
        if (!validation.valid) {
            return { platform: "x", status: "failed", error: validation.error };
        }
```

**Integration with existing thread-splitter:** The `splitIntoThread()` function in `src/core/utils/thread-splitter.ts` already respects 280 chars. Validation catches two edge cases the splitter cannot handle:
1. Pre-split content (JSON array in `post.content`) where individual segments were manually composed too long
2. URL shortening math -- a tweet with a 200-char URL is actually only 23 chars of URL + remaining text, but a tweet with no URLs uses raw character count

**Data flow change:**

```
Current:
    content → createTweet() → X API 403 → "failed: Forbidden"

After:
    content → validateTweet() → invalid → return failed with clear message
                               → valid   → createTweet() → normal flow
```

**No schema changes.** Validation is purely in-memory before API calls.

**Confidence:** HIGH -- X's character counting rules are well-documented. URL shortening to 23 chars via t.co is stable behavior since 2016.

---

### 5. Testing Infrastructure

**Problem:** 12 test files exist but no mocking strategy, no handler compliance tests, no CI integration. The XHandler has 170 lines of untested publish logic.

**Where it fits:** New test utilities and test files. No production code changes required if mock boundaries are clean.

**Architecture for testing:**

```
src/
├── test/                            (NEW - shared test infrastructure)
│   ├── fixtures/                    (post rows, token rows, platform responses)
│   │   ├── posts.ts                 (createTestPost factory)
│   │   └── tokens.ts               (createTestToken factory)
│   ├── mocks/                       (mock factories for external boundaries)
│   │   ├── db.ts                    (mock createHubConnection → in-memory)
│   │   ├── platform-client.ts       (mock XClient, LinkedInClient, etc.)
│   │   └── trigger.ts              (mock task(), wait.until(), logger)
│   └── helpers.ts                   (shared test setup/teardown)
```

**Mock boundaries -- where to cut:**

| Boundary | Mock Target | Why This Layer |
|----------|------------|----------------|
| Database | `createHubConnection()` | Handlers receive `db` as parameter, easy to substitute |
| Platform APIs | `XClient`, etc. | Handlers create clients internally -- mock at class level |
| Trigger.dev SDK | `task()`, `wait`, `logger` | Not available outside Trigger.dev runtime |
| Filesystem | `Bun.file()` | Media upload reads files from disk |
| Network | Individual `fetch()` calls | Only for OAuth exchange, not globally |

**Handler compliance test pattern:**

```typescript
// Tests that ALL handlers satisfy the PlatformPublisher contract
describe.each(["x", "linkedin", "instagram", "tiktok"])("%s handler", (platform) => {
    it("returns { status: 'published', externalPostId } on success");
    it("returns { status: 'failed' } for content policy errors (does not throw)");
    it("throws on rate limit errors (for Trigger.dev retry)");
    it("refreshes expired tokens transparently before publish");
    it("persists refreshed tokens to DB before returning");
});
```

**Vitest config changes needed:**
- Add path alias resolution matching `tsconfig.json` so `@psn/core`, `@psn/platforms` work in tests
- Add `setupFiles` for shared mock initialization

**What to test at which layer:**

| Layer | What to Test | How |
|-------|-------------|-----|
| `src/core/utils/` | Pure functions (thread-splitter, crypto, timezone) | Unit tests, no mocks needed |
| `src/platforms/x/validation.ts` | Character counting, URL shortening logic | Unit tests, no mocks |
| `src/platforms/x/client.ts` | Request construction, response parsing, error mapping | Mock fetch |
| `src/platforms/handlers/*.ts` | Full publish flow: token decrypt, client creation, API call, status return | Mock DB + mock client |
| `src/trigger/publish-post.ts` | Orchestration: status transitions, multi-platform dispatch, notification on failure | Mock everything (DB, handlers, notifications) |
| `src/cli/oauth-callback-server.ts` | Server starts, captures code, auto-closes | Real Bun.serve() with localhost requests |

**Confidence:** HIGH -- Vitest is already installed and configured. The mock boundary design follows directly from the existing architecture where dependencies are injected via function parameters.

---

### 6. Context Management

**Problem:** No pre-commit hooks. Circular dependencies can slip in undetected. No automated quality gates before commits.

**Where it fits:** Project root configuration. No production code changes.

**Architecture change: NEW config files**

```
.husky/                              (NEW - git hooks manager)
    └── pre-commit                   (runs lint-staged)

.lintstagedrc.json                   (NEW - staged file checks)
    "src/**/*.ts": [
        "biome check --write",       (format + lint with auto-fix)
        "vitest related --run"        (tests affected by changed files)
    ]

package.json                         (MODIFY - add dev dependencies + prepare script)
    devDependencies += { "husky": "^9", "lint-staged": "^15" }
    scripts += { "prepare": "husky" }
```

**Pre-commit chain:**

```
git commit
    ↓ .husky/pre-commit
    ↓ bunx lint-staged
        ↓ For each staged .ts file:
            1. biome check --write  (auto-fix format + lint)
            2. vitest related --run  (only tests for changed files)
        ↓ Separately (not per-file):
            3. bun run check:circular  (madge --circular src/)
    ↓ Any failure → commit blocked with clear error
```

**Circular dependency detection:** Already works via `madge` (in package.json scripts as `check:circular`). The pre-commit hook just invokes it. No new tooling needed.

**Confidence:** HIGH -- husky + lint-staged is standard for TypeScript projects. madge already functions correctly.

---

## Component Inventory: New vs Modified

| Component | Status | File Path | Purpose |
|-----------|--------|-----------|---------|
| Env sync helper | **NEW** | `src/trigger/env-sync.ts` | Read local config files, return env var array for syncEnvVars |
| Trigger config | **MODIFY** | `trigger.config.ts` | Add syncEnvVars build extension |
| OAuth callback server | **NEW** | `src/cli/oauth-callback-server.ts` | Temporary HTTP server for OAuth redirect capture |
| X OAuth setup | **MODIFY** | `src/cli/setup-x-oauth.ts` | Use callback server instead of manual code entry |
| Tweet validation | **NEW** | `src/platforms/x/validation.ts` | Pre-flight character count and URL shortening validation |
| XHandler | **MODIFY** | `src/platforms/handlers/x.handler.ts` | Add validation before API calls; persist thread progress to DB |
| Test utilities | **NEW** | `src/test/` | Shared mocks, fixtures, helpers |
| Handler compliance tests | **NEW** | `src/platforms/handlers/__tests__/` | PlatformPublisher contract verification |
| Publish-post tests | **NEW/MODIFY** | `src/trigger/publish-post.test.ts` | Expand existing test file with real coverage |
| Pre-commit hooks | **NEW** | `.husky/`, `.lintstagedrc.json` | Automated quality gates |
| Package.json | **MODIFY** | `package.json` | Add husky + lint-staged to devDependencies |

## Schema Changes

**No new tables, no new columns, no migrations required for v1.3.**

All fixes use existing infrastructure:
- `posts.metadata.threadProgress` -- already typed in `PostMetadata`, needs write logic
- `posts.platformPostIds` -- already exists as `jsonb("platform_post_ids").$type<string[]>()`, needs population after thread completes
- `posts.subStatus` -- already supports `"thread_partial"` value

This is significant: zero database migrations means zero risk of schema-related deployment issues.

## Recommended Build Order

```
Phase 1: Trigger.dev Env Vars           (unblocks all deployed testing)
    └── No dependencies. Highest impact -- deployed tasks crash without this.
    └── Files: src/trigger/env-sync.ts (NEW), trigger.config.ts (MODIFY)

Phase 2: Tweet Validation               (standalone quick win)
    └── No dependencies on other fixes. Pure function + handler call.
    └── Files: src/platforms/x/validation.ts (NEW), x.handler.ts (MODIFY)

Phase 3: Thread Resilience              (same handler file as Phase 2)
    └── Depends on Phase 2 landing first to avoid merge conflicts in x.handler.ts.
    └── Files: x.handler.ts (MODIFY -- add DB writes in postThread)

Phase 4: X OAuth Callback Server        (standalone CLI fix)
    └── No production code dependencies. Enables real user onboarding testing.
    └── Files: src/cli/oauth-callback-server.ts (NEW), setup-x-oauth.ts (MODIFY)

Phase 5: Testing Infrastructure         (depends on stable production code)
    └── Write tests AFTER production code is finalized. Testing moving targets wastes effort.
    └── Files: src/test/ (NEW), __tests__/ files (NEW), vitest.config.ts (MODIFY)

Phase 6: Context Management             (depends on tests existing)
    └── Pre-commit hooks run tests, so tests must exist first.
    └── Files: .husky/ (NEW), .lintstagedrc.json (NEW), package.json (MODIFY)
```

**Ordering rationale:**
- Env vars first: every Trigger.dev task is broken in production without this. All other fixes are untestable deployed until credentials reach workers.
- Validation before thread resilience: both touch `x.handler.ts`. Validation is smaller and can ship independently. Thread resilience is more invasive.
- OAuth after production fixes: it is a setup-time fix, not a runtime fix. Users who already authenticated are unaffected.
- Tests after code stabilizes: testing code that is about to change means rewriting tests.
- Context management last: hooks call the test runner, which requires tests to exist.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Passing Secrets in Trigger.dev Payloads

**What people do:** Include `DATABASE_URL` or encryption keys in the task payload when calling `publishPost.trigger({ postId, databaseUrl, encKey })`.
**Why it is wrong:** Trigger.dev logs all payloads in the dashboard. Secrets become visible to anyone with dashboard access. The existing code already reads from `process.env` -- payloads should contain only identifiers.
**Do this instead:** Use `syncEnvVars` to push secrets at deploy time. Tasks continue reading from `process.env` as they already do.

### Anti-Pattern 2: Thread Retry Without Progress Tracking

**What people do:** Retry the entire thread from tweet 1, hoping X's API is idempotent.
**Why it is wrong:** X has no idempotency mechanism for tweet creation. Posting the same text twice creates two separate tweets. Users end up with duplicate partial threads that cannot be cleaned up programmatically.
**Do this instead:** Persist `threadProgress` to DB after each successful tweet. On retry, read progress and resume from the correct index.

### Anti-Pattern 3: OAuth Callback Server That Never Closes

**What people do:** Start `Bun.serve()` for OAuth and forget cleanup.
**Why it is wrong:** Port stays bound indefinitely. Future OAuth flows or other local tools fail with EADDRINUSE. In a CLI context, orphaned servers are invisible to the user.
**Do this instead:** Auto-close the server after receiving the callback. Add a timeout (e.g., 5 minutes) that closes the server if no callback arrives. Use `server.stop()` in Bun.

### Anti-Pattern 4: Mocking at the Wrong Boundary

**What people do:** Mock `globalThis.fetch` for handler tests.
**Why it is wrong:** Every internal `fetch()` call hits the mock, including unrelated ones. Tests become fragile -- they pass for wrong reasons and break when internal implementation changes.
**Do this instead:** Mock at the client class boundary. Replace `XClient` with a mock implementation, not the network layer. This tests handler logic (token refresh, media upload coordination, thread sequencing) without coupling to HTTP request details.

## Sources

- [Trigger.dev Environment Variables](https://trigger.dev/docs/deploy-environment-variables) -- env var delivery to deployed workers (HIGH confidence)
- [Trigger.dev syncEnvVars Extension](https://trigger.dev/docs/config/extensions/syncEnvVars) -- build-time env var sync from local/external sources (HIGH confidence)
- [Trigger.dev Env Vars SDK](https://trigger.dev/changelog/env-vars-sdk) -- programmatic env var management API (HIGH confidence)
- Codebase analysis: `src/trigger/publish-post.ts` (lines 40-43: env var reads), `src/platforms/handlers/x.handler.ts` (lines 125-159: thread posting), `src/cli/setup-x-oauth.ts` (line 9: hardcoded callback URL), `src/core/db/schema.ts` (line 82: threadProgress metadata type)

---
*Architecture research for: v1.3 Real-World Reliability integration*
*Researched: 2026-02-27*
