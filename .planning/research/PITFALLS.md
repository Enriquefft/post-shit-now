# Pitfalls Research: v1.3 Real-World Reliability

**Domain:** Adding OAuth callback servers, env var management for serverless workers, thread failure recovery, and content pre-validation to an existing CLI-first publishing system
**Researched:** 2026-02-27
**Confidence:** HIGH (based on codebase analysis of actual failure points from 342-turn trial session + official docs + community reports)

## Critical Pitfalls

### Pitfall 1: Trigger.dev Workers Start With Zero Environment Variables

**What goes wrong:**
Every `src/trigger/*.ts` task reads `process.env.DATABASE_URL`, `process.env.HUB_ENCRYPTION_KEY`, and platform-specific keys (X_CLIENT_ID, X_CLIENT_SECRET, etc.) at runtime. When deployed to Trigger.dev Cloud, workers receive NO local `.env` files -- they only see variables explicitly configured in the Trigger.dev dashboard or synced via `syncEnvVars` build extension. The current `trigger.config.ts` (19 lines) has zero env var configuration. A user who runs `bunx trigger.dev deploy` gets tasks that immediately crash with "Missing required env vars" on every invocation. This was the exact blocker hit during the 342-turn trial session.

**Why it happens:**
Local dev (`trigger.dev dev`) auto-loads `.env` files, so everything works in development. Developers assume deployment works the same way. Trigger.dev Cloud does NOT load `.env` files during deployment -- it only reads from its dashboard or the `syncEnvVars` build extension. This dev/prod divergence is invisible until the first production invocation.

**How to avoid:**
1. Add `syncEnvVars` build extension to `trigger.config.ts` that reads from `.hubs/personal.json` and `config/keys.env` at deploy time.
2. Create a central `REQUIRED_ENV_VARS` manifest that every trigger task references. Validate ALL required vars at task start, fail fast with a descriptive message listing every missing var.
3. Make error messages actionable: instead of "Missing required env vars: DATABASE_URL, HUB_ENCRYPTION_KEY", say "Run /psn:setup trigger-env to sync your credentials to Trigger.dev Cloud"
4. Add a pre-deploy validation step that checks all required env vars exist in source files before `trigger deploy` runs.

**Warning signs:**
- Tasks deploy successfully (deployment is just code bundling) but fail on first invocation
- Local `trigger.dev dev` works perfectly but production tasks fail with env var errors
- Health check task returns failures immediately after deployment

**Phase to address:**
Trigger.dev env var delivery -- this MUST be the first phase because all other Trigger.dev features (publishing, analytics, notifications) depend on workers having credentials.

---

### Pitfall 2: Thread Publishing Loses Tweet IDs on Partial Failure

**What goes wrong:**
The current `XHandler.postThread()` method (lines 125-159 of `x.handler.ts`) builds a `tweetIds` array as it posts each tweet sequentially. If tweet 4 of 7 fails with a non-rate-limit error, the method throws the error. The `publish-post` task catches it, marks the post as "failed", but the successfully-posted tweet IDs (tweets 1-3) are lost -- they exist on X but are not recorded anywhere. The user cannot retry (they would double-post tweets 1-3) and cannot clean up (they do not know which tweets were posted).

**Why it happens:**
The thread progress tracking schema exists (`threadProgressSchema` at line 17 of `x.handler.ts`) and is read during `postThread` (lines 132-136), but the handler never WRITES progress back to the DB during the loop. Progress is only checked on entry (to resume), but never persisted between tweets. The checkpoint mechanism is read-only -- a skeleton that was built but never connected to the write path.

**How to avoid:**
1. After each successful tweet in the thread loop, persist `{ posted: i+1, total: tweets.length, lastPostedId: tweetIds[i], tweetIds }` to `post.metadata.threadProgress` in the DB.
2. On retry, read `threadProgress` and resume from `startIndex` (the read path already exists at line 135).
3. On any failure mid-thread, catch the error, save progress, THEN set status to "failed" with subStatus "thread_partial" AND include the tweetIds in metadata.
4. The idempotency boundary is per-tweet-index: never re-post a tweet if its index is below `startIndex`.
5. Pass the `db` connection into `postThread` so it can write progress (currently it only receives `client`, `tweets`, `mediaIds`, `metadata`, `postId`).

**Warning signs:**
- Post status is "failed" but tweets exist on X with no record in the DB
- User retries a thread post and sees duplicate tweets on their timeline
- `metadata.threadProgress` is always null/undefined despite thread posts being attempted

**Phase to address:**
Thread publishing resilience phase. This is the highest-data-loss-risk issue in v1.3.

---

### Pitfall 3: Checkpoint DB Write Fails Silently After Successful Tweet

**What goes wrong:**
The thread resilience fix adds a DB write after each successful tweet. If the DB write fails (Neon timeout, connection reset, RLS violation), the tweet is already posted on X but the checkpoint is not persisted. On retry, the system re-posts that tweet, creating a duplicate. Worse: the `tweetIds` array in memory has the correct ID, but it never reaches the DB. If the task crashes after the failed DB write, progress is lost entirely.

**Why it happens:**
Developers wrap the `createTweet` call in try/catch but do not wrap the checkpoint DB write in its own error handling. Or they wrap it but swallow the error ("checkpoint is optional, tweet already posted"). The DB write is treated as a side effect rather than a critical step. Neon HTTP driver failures are transient and rare in testing but happen in production under load or during Neon cold starts.

**How to avoid:**
1. Wrap the checkpoint DB write in a retry loop (2-3 attempts with 500ms delay). The tweet is already posted -- the DB write MUST succeed for consistency.
2. If the checkpoint write fails after all retries, throw a specific `CheckpointWriteError` that includes the accumulated `tweetIds` in its payload. Trigger.dev's retry will re-invoke the task, and the handler should log the lost progress for manual recovery.
3. Never swallow checkpoint write errors. A failed checkpoint is worse than a failed tweet because it causes duplicate content on retry.
4. Test this path explicitly: mock DB to fail on update while tweet creation succeeds.

**Warning signs:**
- Duplicate tweets appearing in threads after retries
- `threadProgress` in post metadata is null despite partial thread being visible on X
- Trigger.dev logs show task retried but thread started from index 0

**Phase to address:**
Thread publishing resilience phase -- checkpoint write error handling must be in the implementation spec, not an afterthought.

---

### Pitfall 4: OAuth Callback URL Points to example.com -- No Callback Server

**What goes wrong:**
The current `setup-x-oauth.ts` hardcodes `X_CALLBACK_URL = "https://example.com/callback"` (line 9). The setup instructions tell users to configure this same URL in the X Developer Portal. During the OAuth flow, X redirects to `https://example.com/callback?code=...&state=...` -- a URL the user does not control. The user must manually copy the authorization code from their browser URL bar after the redirect fails (example.com shows a 404).

**Why it happens:**
X OAuth 2.0 PKCE requires a callback URL registered in the Developer Portal. CLI tools traditionally cannot receive HTTP callbacks. The placeholder was added as a "fix later" item and the fix was never done.

**How to avoid:**
1. Spin up a temporary localhost HTTP server (`Bun.serve()` on a fixed port like 18923) that listens for the callback.
2. Register `http://127.0.0.1:18923/callback` as the redirect URI -- NOT `localhost` (X may reject `localhost` but reliably accepts `127.0.0.1`).
3. The server must: extract `code` and `state` params, validate state matches the generated state, exchange the code for tokens, display a "Success! You can close this tab" HTML page, then shut down.
4. Add a timeout (120 seconds) -- if the user never completes the browser flow, the server shuts down gracefully.
5. Use a fixed port (not `port: 0`) because the X Developer Portal requires a pre-registered callback URL with a known port.
6. Store the PKCE code verifier in the server's closure/memory, not in the URL or a file.

**Warning signs:**
- Users paste partial URLs or the wrong query parameter value
- OAuth exchange fails with "invalid code" because the code was URL-decoded incorrectly during manual copy
- Users report "the redirect page showed an error" -- that is example.com's 404 page

**Phase to address:**
X OAuth flow phase. Must be completed before any X-dependent feature testing.

---

### Pitfall 5: Callback URL Hardcoded in Three Separate Locations

**What goes wrong:**
The callback URL `"https://example.com/callback"` exists in three places simultaneously: `setup-x-oauth.ts` line 9 (initial auth flow), `x.handler.ts` line 54 (token refresh during publish), and the X Developer Portal settings (web UI). When the OAuth callback server changes this to `http://127.0.0.1:18923/callback`, developers update one or two locations but miss the third. The Arctic Twitter client constructor requires the callback URL to match what was used during initial auth -- a mismatch causes "invalid_request" errors from X with no indication that the callback URL is the problem.

**Why it happens:**
The same string is copy-pasted rather than referenced from a single constant. The `x.handler.ts` usage is particularly easy to miss because it is in the token refresh path (line 54), not the initial auth path.

**How to avoid:**
1. Define the callback URL as a single exported constant from `src/platforms/x/oauth.ts`: `export const X_CALLBACK_URL = "http://127.0.0.1:18923/callback"`.
2. Import this constant in `setup-x-oauth.ts` and `x.handler.ts`. Delete all hardcoded strings.
3. Add a comment: "This URL must match the callback URL registered in X Developer Portal."
4. Note: token refresh in `x.handler.ts` does NOT actually validate the callback URL (Arctic's `refreshAccessToken` ignores it), but the Twitter client constructor requires it. The constant ensures consistency.

**Warning signs:**
- OAuth flow returns "invalid_request" during browser redirect step
- Token refresh works fine but initial auth fails (or vice versa)
- `grep -r "example.com/callback" src/` returns any results after the fix

**Phase to address:**
X OAuth flow phase -- extract the constant first, then build the callback server using that constant.

---

### Pitfall 6: X Refresh Token Race Condition With Concurrent Tasks

**What goes wrong:**
X refresh tokens are single-use. When `refreshAccessToken` is called (x.handler.ts lines 56-69), X invalidates the old refresh token and returns a new one. If two Trigger.dev tasks run concurrently for the same user (e.g., a scheduled post and a manually triggered post), both read the same refresh token from DB, both call X's refresh endpoint, and only the first succeeds. The second gets "invalid_grant" because the token was already consumed. The first task writes its new tokens, but the second may overwrite with stale data or fail permanently.

**Why it happens:**
The current code has no locking around token refresh. In local development with a single process, this never surfaces. In production with Trigger.dev Cloud, tasks run as independent workers that can execute simultaneously. The token refresh path has no concurrency protection.

**How to avoid:**
1. Use Postgres advisory locks (`pg_advisory_xact_lock`) keyed on a hash of (userId, platform) when refreshing tokens. This serializes refresh across concurrent tasks.
2. Alternatively, use optimistic locking: read the token row with its `updated_at`, refresh, then UPDATE with `WHERE updated_at = {original_value}`. If zero rows affected, re-read (another task already refreshed).
3. At minimum: always write the new tokens BEFORE doing anything else after refresh. If the DB write fails, log the new refresh token securely (Trigger.dev dashboard is encrypted).
4. For v1.3: optimistic locking is lighter than advisory locks and sufficient -- most users have 1 concurrent task. But when the race happens, it is catastrophic (permanent auth failure requiring re-auth).

**Warning signs:**
- "invalid_grant" errors in Trigger.dev logs for users who were previously authenticated
- Token refresh works in local testing (single process) but fails in production
- Users needing to re-auth frequently despite 2-hour token lifetime

**Phase to address:**
Thread publishing resilience phase -- address alongside handler modifications since token refresh logic is in the same file (x.handler.ts lines 47-70).

---

### Pitfall 7: X API Returns Misleading 403 for Content Violations

**What goes wrong:**
The X API returns HTTP 403 for at least 5 different failure modes: tweet too long (>280 chars), duplicate content, account locked, missing permissions, and suspicious activity. The current `XClient` treats all non-429 errors generically. When a tweet exceeds 280 characters, the error message is "Tweet needs to be a bit shorter" -- but this arrives as a 403, which users instinctively interpret as an authentication/permissions issue.

**Why it happens:**
X's API uses 403 as a catch-all for "you cannot do this" rather than using distinct status codes. Without pre-validation, the error only surfaces after the API call. For threads, the error does not indicate WHICH tweet failed.

**How to avoid:**
1. Add a `validateTweet(text)` function that runs BEFORE any API call. Check weighted character count (URLs = 23 chars, emojis = 2 chars) using the `twitter-text` npm package.
2. For threads: validate ALL tweet segments independently before posting any of them. Fail pre-flight rather than mid-post.
3. Parse the 403 response body `detail` field to distinguish content violations from auth failures.
4. Map known 403 sub-errors to user-facing messages: `"too_long"`, `"duplicate"`, `"locked"`.

**Warning signs:**
- Users report "403 Forbidden" and immediately suspect OAuth is broken
- Thread posts fail on tweet N but error does not indicate which tweet or why
- Users re-run `/psn:setup` when the real issue is content formatting

**Phase to address:**
Tweet validation phase. Should come BEFORE thread resilience -- validate content before attempting to publish to avoid partial failures caused by foreseeable content errors.

---

### Pitfall 8: Thread Splitter and Validator Use Different Character Counting

**What goes wrong:**
The thread splitter (`splitIntoThread` in `thread-splitter.ts`) uses raw `string.length` for the 280-char limit (lines 34, 42, 64, 72, 98). The new tweet validator will use `twitter-text` weighted counting (URLs=23, emojis=2). These produce different results for the same content. A URL like `https://example.com/very/long/path` counts as 34 chars in the splitter but 23 chars in the validator. The splitter may split a tweet that the validator considers valid, or (worse) the splitter produces a tweet that fits by raw length but exceeds 280 weighted chars due to emoji density.

**Why it happens:**
The splitter was written before validation existed. Adding validation as a separate module creates two character counting standards. Developers focus on the new validator and forget to update the existing splitter.

**How to avoid:**
1. Update `splitIntoThread` to accept a weight function parameter: `splitIntoThread(text, maxLen, weightFn?)`. Default `weightFn` uses `twitter-text`'s `parseTweet().weightedLength`.
2. Or: create a shared `countTweetChars(text)` utility used by both splitter and validator.
3. Single source of truth: ONE function for character counting, used everywhere.
4. Test case: a tweet with a 200-character URL should be treated as 23 chars by both splitter and validator.

**Warning signs:**
- Splitter produces tweets that fail validation
- Tweets with long URLs get unnecessarily split
- Character count displayed in thread preview differs from what validator reports

**Phase to address:**
Tweet validation phase -- update the splitter in the same phase to use the same counting logic.

---

### Pitfall 9: syncEnvVars Overwrites Dashboard-Set Variables

**What goes wrong:**
The `syncEnvVars` build extension pushes env vars to Trigger.dev Cloud during `bunx trigger.dev deploy`. If a user has manually set environment variables via the Trigger.dev dashboard (documented as the fallback), the next deploy overwrites them silently. This is especially dangerous for `HUB_ENCRYPTION_KEY` -- if it is overwritten with a different value, all encrypted tokens in the database become undecryptable.

**Why it happens:**
`syncEnvVars` performs a full sync: it sets the variables returned by the callback. If the callback returns `DATABASE_URL` from `.hubs/personal.json` and the user had set a different `DATABASE_URL` via the dashboard (e.g., pointing to a Neon branch for testing), the deploy silently replaces it.

**How to avoid:**
1. Document clearly: "syncEnvVars is the source of truth. Do NOT set env vars in the dashboard if using syncEnvVars -- they will be overwritten on next deploy."
2. In the `syncEnvVars` callback, log which variables are being synced: `console.log("Syncing env vars: DATABASE_URL, HUB_ENCRYPTION_KEY, ...")`.
3. Only sync variables that the code explicitly needs. Do not use a wildcard "sync everything" approach.
4. Do NOT include `TRIGGER_SECRET_KEY` in the sync -- Trigger.dev Cloud sets this automatically. Overwriting it causes task-to-task authentication failures.

**Warning signs:**
- Tasks fail after deploy with "decryption failed" errors (encryption key changed)
- Dashboard env vars reset to local values after every deploy
- User-configured staging database replaced with production database URL

**Phase to address:**
Trigger.dev env var delivery phase -- document the overwrite behavior in code comments and setup wizard output.

---

### Pitfall 10: syncEnvVars Reads Config at Build Time, Not Runtime

**What goes wrong:**
The `syncEnvVars` build extension runs during `bunx trigger.dev deploy`, reading env vars from files and pushing them to Trigger.dev Cloud once. If a user rotates API keys AFTER deployment, the deployed workers still have the OLD keys until redeployment. This is different from a local `.env` file where restarting picks up changes.

**Why it happens:**
`syncEnvVars` is a BUILD extension, not a runtime hook. It syncs once per deploy. Users who update `config/keys.env` expect changes to propagate automatically -- they do not.

**How to avoid:**
1. Document: "After rotating any API key, run `bunx trigger.dev deploy` to sync new credentials."
2. Distinguish static credentials (client IDs/secrets, rarely change) from dynamic credentials (OAuth tokens, rotate automatically). Static go in env vars. Dynamic already live in DB -- this is correct.
3. Never store OAuth access/refresh tokens as env vars -- they rotate too frequently. The current design (tokens in DB, client IDs in env vars) is correct.
4. The health check task should validate credentials are working (test API call), not just present.

**Warning signs:**
- Credentials work locally but fail in deployed tasks after a key rotation
- Health check passes (env var exists) but publish fails (stale value)
- Users update keys.env and assume tasks pick them up without redeploying

**Phase to address:**
Trigger.dev env var delivery phase -- same phase, both are env var lifecycle issues.

---

### Pitfall 11: Callback Server Port Leak and Cleanup Failure

**What goes wrong:**
The temporary localhost HTTP server for OAuth must shut down after receiving the callback OR after timeout. If the process crashes between server start and shutdown, the port remains bound. The next OAuth attempt fails with EADDRINUSE. Bun.serve() returns a server object that must be explicitly stopped -- there is no automatic cleanup on unhandled exceptions or SIGINT.

**Why it happens:**
Developers test the happy path (user completes auth, callback received, server stops). They do not test: user closes browser, user takes too long, process receives Ctrl+C during auth, port already in use from a previous crash.

**How to avoid:**
1. Wrap the entire callback server lifecycle in try/finally that calls `server.stop()` in finally.
2. Register SIGINT/SIGTERM handlers that call `server.stop()` before exiting.
3. Before starting, attempt to connect to the target port -- if bound, inform user or kill the stale process.
4. Always set a hard timeout (120 seconds) with `setTimeout` that calls `server.stop()`.
5. Return proper 404 Response for non-callback paths (Bun.serve crashes if the fetch handler does not return a Response for `/favicon.ico` or other browser-initiated requests).

**Warning signs:**
- EADDRINUSE errors on second OAuth attempt
- Orphaned Bun processes listening on the OAuth port after a failed auth flow
- Server crashes on favicon request from browser

**Phase to address:**
X OAuth flow phase -- cleanup handlers must be part of the initial implementation, not added later.

---

### Pitfall 12: State Parameter Generated But Never Validated (CSRF Risk)

**What goes wrong:**
The current `setup-x-oauth.ts` generates a `state` parameter (line 107) and `completeXOAuth` receives it as `_state` (line 131, underscore prefix indicating it is unused). There is NO validation that the state received in the callback matches what was generated. An attacker could inject a valid authorization code with a forged state parameter (session fixation attack).

**Why it happens:**
In the current manual flow, the user pastes the code and the function arguments pass state through without validation. The underscore prefix on `_state` confirms it was intentionally ignored. The callback server fix makes state validation trivial -- compare the query parameter against the stored value.

**How to avoid:**
1. When the callback server receives the redirect, compare `state` query parameter against the state stored in the server's closure.
2. If state does not match, reject with a clear error and do NOT exchange the code.
3. Make state single-use: once validated, discard it.

**Warning signs:**
- `completeXOAuth` receives `_state` but never validates it
- No test verifying state validation
- Callback server accepts any `state` value without checking

**Phase to address:**
X OAuth flow phase -- must be fixed alongside the callback server implementation.

---

### Pitfall 13: Testing Infrastructure Mocks the Wrong Layer

**What goes wrong:**
When adding Vitest tests for PlatformPublisher compliance, developers mock `fetch` globally rather than at the client class boundary. This creates tests that verify HTTP behavior but miss contract violations -- a handler returning `{ status: "success" }` instead of `{ status: "published" }` passes the HTTP mock test but violates the PlatformPublisher contract.

**Why it happens:**
Platform handlers mix multiple concerns: token retrieval, refresh, media upload, content posting. Mocking at HTTP feels natural. But compliance tests should verify handler-level contracts, not HTTP-level behavior.

**How to avoid:**
1. Create a `PlatformPublisherComplianceSuite` that takes any PlatformPublisher implementation and verifies correct return types, status values, error conventions.
2. Mock at the DB + client class layer, not the HTTP layer.
3. Use MSW only when testing the client layer (`XClient`), not the handler layer (`XHandler`).
4. Separate test layers: unit (XClient), contract (XHandler), integration (publish-post task).

**Warning signs:**
- Tests pass but handlers return wrong status values in production
- `fetch` mocked inside handler tests rather than injecting dependencies
- `process.env` overrides scattered across test files

**Phase to address:**
Testing infrastructure phase.

---

### Pitfall 14: Vitest Cannot Resolve Path Aliases

**What goes wrong:**
The current `vitest.config.ts` has no path alias resolution. Production code uses `@psn/core` and `@psn/platforms` aliases defined in `tsconfig.json`. Test files importing from these aliases fail with "Cannot find module @psn/core". Developers work around this with relative imports in tests, creating a parallel import convention that diverges from production code.

**Why it happens:**
Vitest does not automatically read `tsconfig.json` path aliases. The `resolve.alias` config must be set explicitly in `vitest.config.ts` to mirror the `tsconfig.json` `paths` entries.

**How to avoid:**
1. Add `resolve.alias` to `vitest.config.ts` matching all three aliases from tsconfig: `@psn/core` -> `src/core`, `@psn/platforms` -> `src/platforms`, `@psn/trigger/*` -> `src/trigger/*`.
2. Or use `vite-tsconfig-paths` plugin which reads tsconfig automatically.
3. Enforce: all test files use the same import style as production code. No relative imports crossing module boundaries.

**Warning signs:**
- Tests use `../../core/` while production uses `@psn/core`
- New aliases added to tsconfig but not to vitest.config, breaking only tests
- Tests pass locally (IDE resolves aliases) but fail in CI

**Phase to address:**
Testing infrastructure phase -- must be configured before writing any new tests.

---

### Pitfall 15: Pre-Commit Hooks That Block Claude Code Workflow

**What goes wrong:**
Adding pre-commit hooks (typecheck, full test suite, circular dependency check) that run on every commit can break the Claude Code development loop. Claude Code makes frequent small commits during agentic development. Heavy hooks add 10-30 seconds per commit. If a hook fails, the commit is rejected, derailing multi-step plans.

**Why it happens:**
Pre-commit hooks are designed for human developers who commit occasionally. Claude Code's agentic workflow commits much more frequently.

**How to avoid:**
1. Keep pre-commit hooks FAST: Biome lint on staged files only (<2 seconds), doc validation. Typecheck and full tests belong in CI or pre-push.
2. Use `lint-staged` (or lefthook with staged-file filtering) to only check changed files.
3. Auto-fix what can be auto-fixed: `biome check --write` instead of just `biome check`.
4. Critical: if using vitest in hooks, always use `--run` flag. Without it, vitest starts in watch mode and hangs the commit indefinitely.
5. Document `--no-verify` as an explicit escape hatch.

**Warning signs:**
- Claude Code sessions stall for 10+ seconds on every commit
- Commit failures for auto-fixable formatting issues
- Developers habitually using `--no-verify`, defeating the hooks entirely

**Phase to address:**
Context management phase -- should be the LAST phase since hooks validate everything built in earlier phases.

---

### Pitfall 16: twitter-text Library Diverges From X API Behavior

**What goes wrong:**
The `twitter-text` npm package implements X's character counting rules, but the npm version may lag behind X's actual API behavior. Edge cases exist: CJK characters, zero-width joiners in emoji sequences, and special Unicode can differ between library and API. The library is correct for 99% of content but the 1% creates confusing mismatches where validation says "valid" but the API rejects.

**Why it happens:**
The `twitter-text` package is maintained by X but updates are sporadic. The library uses a static configuration for URL lengths and character weights that may not match current API behavior precisely.

**How to avoid:**
1. Use `twitter-text` as primary validator but do NOT remove API-level error handling. Pre-flight validation reduces errors; it does not eliminate them.
2. When the API returns 403 and `twitter-text` said valid, log both weighted length and raw length. This diagnostic data identifies divergence.
3. Pin `twitter-text` to a specific version (not `^` range). Update deliberately after checking changelog.
4. Include edge case tests: exactly-280-char tweet, tweet with long URL, compound emoji (family, flag sequences), CJK text.

**Warning signs:**
- Tweets passing local validation but rejected by X API
- Character count in preview differs from X compose box
- Non-Latin script content failing unpredictably

**Phase to address:**
Tweet validation phase -- include edge case tests in the validation test suite.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding `example.com` callback URL | Unblocks OAuth code path, no server needed | Every user hits a broken redirect flow during setup | Never in production -- replace in v1.3 |
| Reading env vars inline in each task | Simple, no abstraction overhead | 40+ scattered `process.env` reads, no central validation, impossible to audit required vars | Only for single-task projects. At 13 tasks, centralize. |
| Thread progress schema read without write | Shows intent for resumability | False sense of safety -- progress is never saved, partial failures are unrecoverable | Never -- implement write path or remove dead read code |
| Raw `string.length` in thread-splitter | Simpler code, works for ASCII | Threads split incorrectly for URLs (count as 23, not actual) and emoji (count as 2). Splitter and validator disagree | Never -- fix during validation phase to maintain single character counting standard |
| No locking on token refresh | Simpler code, works for single process | Concurrent tasks corrupt refresh tokens, causing permanent auth failure | Only if user can have max 1 concurrent task (not true for PSN) |
| Testing with `process.env` overrides | Quick test setup | Tests depend on env state, fail in CI, no protection against missing var additions | Only in early prototyping. Replace with fixtures in v1.3. |
| Treating all 403s as auth errors | Simpler error handling | Users re-run OAuth setup for content issues, wasting 5-10 minutes per false diagnosis | Never -- parse the 403 body from day 1 |
| Relative imports in test files | Tests "work" without alias config | Diverges from production import style, breaks when module paths change | Never -- configure vitest aliases to match tsconfig |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Trigger.dev syncEnvVars | Returning values from `process.env` in the callback (reads local shell env, not config files) | Explicitly read from `.hubs/personal.json` and `config/keys.env` using file I/O. Shell env may not have these if user runs deploy from clean terminal |
| Trigger.dev syncEnvVars | Including `TRIGGER_SECRET_KEY` in the sync list | Trigger.dev Cloud sets this automatically. Overwriting it causes task-to-task auth failures. Only sync application-level vars |
| Trigger.dev syncEnvVars | Missing config file crashes deploy | If `.hubs/personal.json` does not exist (user has not run setup), the sync callback throws. Add try/catch with a clear message: "Run /psn:setup first" |
| X OAuth 2.0 PKCE | Using `localhost` as redirect URI hostname | X may reject `localhost`. Use `127.0.0.1` explicitly -- reliably accepted per community reports |
| X OAuth 2.0 PKCE | Reusing the same `codeVerifier` across attempts | `generateCodeVerifier()` must be called fresh per attempt. Reusing after a failed exchange causes "invalid_grant" |
| X OAuth refresh | Not persisting new refresh token BEFORE using new access token | If process crashes between refresh and DB write, old refresh token is consumed (one-time-use) but new one is lost. Permanent auth failure |
| X API 403 | Assuming 403 means authentication failure | 403 can mean: too long, duplicate, locked, missing permissions. Parse response body `detail` field |
| X API threads | Retrying threads without checkpoint state | Without persisted progress, retries re-post already-published tweets. Always checkpoint after each tweet |
| Neon Postgres HTTP driver | Assuming transaction support across queries | Neon HTTP driver is stateless -- each query is a separate HTTP request. Thread checkpoint writes are individual UPDATEs, not a transaction |
| Bun.serve() for OAuth | Not returning a Response for non-callback paths | Browser sends `/favicon.ico` request. Unhandled path crashes server. Return 404 for all paths except `/callback` |
| Bun.serve() for OAuth | Not calling `server.stop()` on error/timeout | Bun does not auto-cleanup servers on exceptions. Always use try/finally. |
| Vitest + Trigger.dev | Importing trigger task definitions directly in tests | Trigger SDK tasks require runtime context (logger, wait, etc.). Mock the task boundary. Test business logic functions independently |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Validating tweets by sending to API and checking errors | 1 wasted API call per validation attempt, rate limit burn | Validate locally with `validateTweet()` before any API call | Immediately -- every invalid tweet wastes a call at $0.01/post |
| Writing thread progress to DB after every tweet | N DB writes for N-tweet thread, adds ~50ms per write | Acceptable tradeoff for reliability. ~350ms for 7-tweet thread. Optimize only if threads exceed 20 tweets | Never a real problem at current scale |
| Pre-commit hooks running typecheck on full project | 10-30 second commit delay, blocks agentic workflow | Typecheck in CI only. Pre-commit: lint-staged + biome on changed files | Immediately on first commit with hooks |
| Health check task making full API calls to verify tokens | Burns rate limit budget on health checks | Use lightweight endpoints (GET /2/users/me) or just verify token decryption + expiry | At frequent intervals (every 5 min) with multiple platforms |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging OAuth tokens in Trigger.dev task output | Tokens visible in dashboard to anyone with project access | Never log token values. Log `has_token: true`, `expires_in: Ns`, not the token |
| Storing PKCE code verifier in URL params or files | Verifier exposed in browser history or filesystem | Store in callback server's in-memory closure. Never write to disk |
| Callback server bound to 0.0.0.0 | Exposes OAuth callback to local network -- another device intercepts the code | Bind to `127.0.0.1` only. Explicitly set `hostname: "127.0.0.1"` in Bun.serve() |
| Skipping state parameter validation | CSRF/session fixation -- attacker injects their own auth code | Compare callback `state` against generated `state`. Reject mismatches |
| Exposing env var values in error messages | API keys leaked in Trigger.dev logs or CLI output | Sanitize: log `DATABASE_URL=***` not the connection string. Show var name, not value |
| OAuth callback URL using HTTP (appears insecure) | None -- this is correct per RFC 8252 Section 7.3. Localhost callbacks are exempt from HTTPS because the redirect never leaves the machine | Do NOT add self-signed certs. Document the RFC reference if questioned |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Missing required env vars" with no guidance | User does not know which vars or where to set them | List ALL missing vars, provide exact fix: "Run /psn:setup trigger-env to sync credentials" |
| OAuth flow says "paste the code" | User pastes entire URL, or state, or nothing | Auto-capture via localhost callback server. Zero manual steps in happy path |
| Thread fails with "403 Forbidden" on tweet 4 | User thinks OAuth is broken | Pre-validate ALL tweets. Show "Tweet 4 is 312 chars (max 280)" before attempting post |
| Post marked "failed" but tweets 1-3 exist on X | User finds orphaned partial thread, no way to continue | Save thread progress. Show "3/7 tweets posted. Resume with retry." |
| Tweet validation shows "312 chars" without explaining why | User counts 285 characters manually and is confused | Show breakdown: "280 text + 23 URL weight + 9 emoji weight = 312 weighted chars" |
| Browser does not open automatically during OAuth | User sees "Open this URL" but may miss it. `open` works on macOS, `xdg-open` on Linux, neither on WSL | Try platform-specific opener, always print URL as fallback. Format as clickable terminal link |
| syncEnvVars success is invisible | User deploys but has no idea if env vars synced | Print "Synced 4 env vars: DATABASE_URL, HUB_ENCRYPTION_KEY, X_CLIENT_ID, X_CLIENT_SECRET" during deploy |
| Token refresh failure gives generic "failed" | User sees post failed with no next step | Include error classification: `{ error: "token_expired_refresh_failed", action: "Run /psn:setup to re-authenticate" }` |
| Pre-commit hook fails with dense Biome output | User does not know what to fix | Auto-fix formatting. Only block on actual errors. Show one-line summary |

## "Looks Done But Isn't" Checklist

- [ ] **syncEnvVars:** Added to trigger.config.ts -- verify deploy output shows "Synced N environment variables" (not just successful deploy)
- [ ] **syncEnvVars:** Handles missing config files gracefully -- verify deploy with no `.hubs/personal.json` shows helpful error, not crash
- [ ] **syncEnvVars:** Does NOT include TRIGGER_SECRET_KEY -- verify this key is excluded from sync list
- [ ] **Callback server:** Starts and receives callback -- verify it CLOSES after receiving and after timeout (no leaked servers)
- [ ] **Callback server:** Binds to 127.0.0.1 -- verify NOT bound to 0.0.0.0 (security)
- [ ] **Callback server:** Returns 404 for non-callback paths -- verify `/favicon.ico` gets a Response, not a crash
- [ ] **Callback server:** SIGINT/SIGTERM handlers registered -- verify Ctrl+C frees the port
- [ ] **State validation:** OAuth state generated AND checked on callback -- verify mismatched state is rejected
- [ ] **Callback URL:** Single constant in `x/oauth.ts` -- verify `grep -r "example.com/callback" src/` returns zero results
- [ ] **Thread progress:** Written to metadata on EACH tweet -- verify also READ on retry and resumes from correct index
- [ ] **Thread progress:** Resume uses correct replyToId -- verify tweet N on resume uses `tweetIds[N-1]` from checkpoint, not undefined
- [ ] **Thread progress:** Checkpoint for LAST tweet -- verify loop writes checkpoint for final tweet before clearing progress
- [ ] **Checkpoint writes:** DB failure is not swallowed -- verify DB write failure propagates (not caught and ignored)
- [ ] **Tweet validation:** Uses `twitter-text` weighted counting -- verify URLs count as 23, emojis as 2
- [ ] **Tweet validation:** Thread-splitter updated -- verify `splitIntoThread` uses same counting as validator
- [ ] **Tweet validation:** ALL tweets validated before ANY are posted -- verify pre-flight, not mid-flight
- [ ] **Error parsing:** 403 errors produce different messages per sub-type -- verify "too long" vs "duplicate" vs "Forbidden"
- [ ] **Vitest config:** Path aliases resolve -- verify `@psn/core` imports work in test files
- [ ] **Pre-commit hooks:** Use `--run` flag on vitest -- verify hook does not start watch mode
- [ ] **Pre-commit hooks:** Use lint-staged (changed files only) -- verify full-project checks are NOT in pre-commit

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Workers deployed with no env vars | LOW | Add vars to Trigger.dev dashboard or configure syncEnvVars, redeploy |
| Thread partially posted, no checkpoint saved | HIGH | Manually find posted tweets on X timeline, note IDs, update post metadata.threadProgress in DB, then retry |
| Duplicate tweets from checkpoint DB write failure | MEDIUM | Delete duplicates via X web UI. Fix checkpoint write logic. Re-post remaining tweets |
| OAuth callback to example.com fails | LOW | User can still manually extract code from browser URL bar. Inconvenient but functional |
| Stale credentials after key rotation | LOW | Run `bunx trigger.dev deploy` to re-sync |
| Refresh token consumed, new token not stored | HIGH | Full re-auth via OAuth flow. No programmatic recovery for consumed one-time-use token |
| Callback server port leaked | LOW | `lsof -i :18923`, kill the process, retry |
| Pre-commit hook blocks valid commit | LOW | Use `--no-verify` as escape hatch. Fix hook config |
| twitter-text disagrees with X API | LOW | Bypass pre-flight for specific tweet. Report edge case. Check for library update |
| Thread resume uses wrong replyToId | HIGH | Cannot fix posted tweets' reply chain. Delete orphaned tweets manually, re-post thread from scratch |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Workers start with zero env vars | Phase 1: Env Var Delivery | Health check task succeeds in production after deploy |
| syncEnvVars overwrites dashboard vars | Phase 1: Env Var Delivery | Deploy logs list synced variables. Docs warn about overwrite |
| syncEnvVars stale after key rotation | Phase 1: Env Var Delivery | Rotate test key, redeploy, verify new key used |
| Missing config file crashes deploy | Phase 1: Env Var Delivery | Deploy without `.hubs/personal.json` shows helpful error |
| Callback URL in 3 places | Phase 2: X OAuth | `grep -r "example.com/callback" src/` returns zero |
| Callback server port leak | Phase 2: X OAuth | Start flow, Ctrl+C, restart -- no EADDRINUSE |
| State parameter not validated | Phase 2: X OAuth | Send callback with wrong state, verify rejection |
| Callback server crashes on favicon | Phase 2: X OAuth | Complete OAuth in Chrome, verify no server crash from browser requests |
| Misleading 403 for content issues | Phase 3: Tweet Validation | Submit 300-char tweet, error says "too long" not "403 Forbidden" |
| Splitter vs validator character counting | Phase 3: Tweet Validation | Tweet with 200-char URL treated same by both |
| twitter-text edge cases | Phase 3: Tweet Validation | Test suite covers URL, emoji, CJK, exactly-280-char cases |
| Thread loses tweet IDs | Phase 4: Thread Resilience | Mock API error on tweet 3/5, verify tweets 1-2 saved, retry from 3 |
| Checkpoint write fails silently | Phase 4: Thread Resilience | Mock DB failure on update, verify error propagates |
| Refresh token race condition | Phase 4: Thread Resilience | Two concurrent publish tasks with expired token, no "invalid_grant" |
| Tests mock wrong layer | Phase 5: Testing | Compliance suite catches handler returning wrong status |
| Vitest path aliases broken | Phase 5: Testing | All tests use `@psn/core` imports, CI passes |
| Pre-commit hooks block workflow | Phase 6: Context Management | Commit with staged .ts file completes in <3 seconds |

## Sources

- **Codebase analysis:** `x.handler.ts` (lines 51-54: hardcoded callback URL; lines 125-159: thread posting without checkpoint writes; lines 47-70: token refresh without locking), `setup-x-oauth.ts` (line 9: duplicate URL; line 131: unused `_state` parameter), `thread-splitter.ts` (line 22: raw `string.length`), `trigger.config.ts` (no env var config), `vitest.config.ts` (no path aliases)
- [Trigger.dev Environment Variables docs](https://trigger.dev/docs/deploy-environment-variables) -- syncEnvVars, dashboard config, local dev behavior (HIGH confidence)
- [Trigger.dev syncEnvVars Extension](https://trigger.dev/docs/config/extensions/syncEnvVars) -- build-time env var sync from local/external sources (HIGH confidence)
- [X OAuth 2.0 PKCE docs](https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code) -- callback URL rules, token lifetime, refresh token one-time-use (HIGH confidence)
- [X API Error Troubleshooting](https://developer.x.com/en/support/x-api/error-troubleshooting) -- 403 disambiguation, response body details (MEDIUM confidence)
- [twitter-text (GitHub)](https://github.com/twitter/twitter-text) -- character counting conformance tests, weighted length rules (HIGH confidence)
- [RFC 8252 Section 7.3](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3) -- localhost HTTP exemption for OAuth native apps (HIGH confidence)
- [Bun.serve() docs](https://bun.sh/docs/api/http) -- server lifecycle, stop(), hostname binding (HIGH confidence)
- Real-world session analysis: 342-turn, 29-hour trial session exposing all 7 original issues documented in PROJECT.md

---
*Pitfalls research for: v1.3 Real-World Reliability (Post Shit Now)*
*Researched: 2026-02-27*
