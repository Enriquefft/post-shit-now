# Feature Research: v1.3 Real-World Reliability

**Domain:** CLI-first social media automation -- operational reliability fixes
**Researched:** 2026-02-27
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

These are blockers exposed by real usage (342-turn, 29-hour session). Without them, the product does not function for a new user going through setup and first post.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Trigger.dev env var delivery | Workers crash immediately without DATABASE_URL and HUB_ENCRYPTION_KEY. Current workaround is manual `.env` hacking which no user discovers on their own. | MEDIUM | Use `resolveEnvVars` in trigger.config.ts to pull from hub connection file at deploy time. The current trigger.config.ts has zero env var resolution. Also need X_CLIENT_ID and X_CLIENT_SECRET. |
| X OAuth callback server | OAuth requires a real callback URL to capture the authorization code. Current code has `"https://example.com/callback"` hardcoded in x.handler.ts line 54. Users cannot complete OAuth without manually extracting the code from a redirect to a dead URL. | MEDIUM | Standard pattern: ephemeral localhost HTTP server (RFC 8252). Bun.serve with `port: 0` for OS-assigned port. Browser opens auth URL, localhost captures code, server shuts down. |
| Thread publishing resilience | Thread posting is sequential (tweet N needs tweet N-1's ID). If tweet 3/7 fails, all progress is lost -- the handler throws without persisting the 2 successful tweet IDs. The `threadProgress` field in metadata exists in the schema but is never written during posting, only read. | HIGH | Must persist tweet IDs to DB after each successful tweet. On retry, resume from `threadProgress.posted` index. This is the most data-loss-prone bug. |
| Tweet pre-flight validation | X returns HTTP 403 for oversized tweets (not 400, not a clear error). Users see "Forbidden" with no indication their tweet is too long. Zero validation happens before the API call. | LOW | Use `twitter-text` npm package (`parseTweet`) for weighted character counting. URLs always count as 23 chars (t.co wrapping). Emojis count as 2. Media attachments are free. |
| Testing infrastructure (Vitest) | 12 test files exist but coverage is spotty. No mocks for platform API calls. No interface compliance tests. Carried from v1.2. | MEDIUM | Vitest 4.x already installed. Add `@trigger.dev/testing` (v3.3.x) for task mocking. Use MSW for HTTP API mocks. Write contract tests verifying PlatformPublisher compliance. |
| Context management | State scattered across PROJECT.md, CLAUDE.md, MEMORY.md, and planning docs. No validation that docs stay in sync. Carried from v1.2. | LOW | Pre-commit hooks to validate key state files. State consolidation to reduce duplication between PROJECT.md and MEMORY.md. |

### Differentiators (Competitive Advantage)

Features that go beyond fixing what is broken and make PSN notably better than alternatives.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Thread resume-from-checkpoint | Most social media tools treat thread posting as atomic -- all or nothing. PSN can resume a partially-posted thread from exactly where it left off, preserving already-posted tweets. | LOW (incremental over resilience fix) | The resilience fix naturally enables this. Store `threadProgress` after each tweet, expose resume capability. No competitor does this for CLI tools. |
| Intelligent tweet validation with suggestions | Beyond rejecting oversized tweets, actively suggest where to split or what to trim. Show weighted char count breakdown (URLs=23, emojis=2 each). | LOW | `parseTweet` returns `weightedLength` and `permillage`. Display in `/psn:post` preview step before scheduling. |
| Dry-run mode for publishing | Let users see exactly what would be sent to each platform API without posting. Validates credentials, token freshness, content limits, media requirements. | MEDIUM | Requires `dryRun` option on each handler. Validates everything except the final API call. Builds trust with cautious users. |
| Multi-hub env var resolution | Workers automatically resolve correct hub credentials based on post's hubId, without per-hub environment configuration. | MEDIUM | Task payload includes hubId, task fetches hub connection from central registry at runtime. Eliminates per-hub Trigger.dev project requirement. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automatic thread retry without user confirmation | "Just retry the whole thread if it fails" | Leads to duplicate tweets. X Error 187 (duplicate detection) is unreliable as idempotency. Orphaned partial threads confuse followers. X has no idempotency key support. | Resume-from-checkpoint with user confirmation. Show what posted, what remains, let user decide. |
| Storing OAuth tokens in local .env files | "Simpler than DB encryption" | Tokens in plaintext on disk. Git accidents expose credentials. Multi-device sync impossible. X refresh tokens are one-time-use so stale local copies break auth permanently. | Current DB encryption is correct. The OAuth *flow* needs fixing, not the storage. |
| ngrok/tunnel for OAuth callback | "Use ngrok so callback works remotely" | Adds infrastructure dependency. Free ngrok URLs change. Security risk (exposes local port). Unnecessary for OAuth code capture. | Localhost callback per RFC 8252. Industry standard for CLI/native apps. No tunnel needed. GitHub CLI, Google oauth2l, and Trigger.dev CLI all use this pattern. |
| Full E2E tests against live platform APIs | "Test against real X/LinkedIn/IG/TikTok" | Rate limits, API costs ($0.01/tweet adds up), flaky tests, credential management in CI. Platform API behavior changes break tests randomly. | Mock platform APIs with MSW. Contract tests for interface compliance. Live API tests only for manual smoke testing. |
| Per-task .env files in Trigger.dev | "Each task gets its own env vars" | Trigger.dev does not support per-task env vars. Environment variables are project-wide per environment (dev/staging/prod). Fighting this creates maintenance burden. | `resolveEnvVars` for deploy-time sync. Pass hub identifiers in task payloads, resolve credentials at runtime for multi-tenant scenarios. |

## Feature Dependencies

```
[Tweet pre-flight validation]
    (independent -- no dependencies)

[X OAuth callback server]
    (independent -- no dependencies on other v1.3 features)

[Trigger.dev env var delivery]
    (independent -- but blocks ALL deployed task execution)
    └──enables──> [Thread publishing resilience] (workers must run to test threads)

[Thread publishing resilience]
    └──requires──> [Trigger.dev env var delivery] (tasks must run to test)
    └──enhanced-by──> [Tweet pre-flight validation] (validate before posting = fewer mid-thread failures)

[Testing infrastructure]
    └──enhanced-by──> [Tweet pre-flight validation] (validation logic is highly testable)
    └──enhanced-by──> [Thread publishing resilience] (checkpoint logic needs thorough tests)

[Context management]
    (independent -- no code dependencies)
```

### Dependency Notes

- **Thread resilience requires env var delivery:** Cannot test thread publishing in deployed workers if workers crash on startup from missing env vars. Fix env vars first.
- **Validation enhances thread resilience:** If tweets are validated before posting, mid-thread failures from content issues (oversized tweets) are eliminated. Only network/rate-limit failures remain, which have existing handling.
- **Testing infrastructure enhances everything:** Contract tests ensure resilience and validation changes do not break the handler interface. Tests can be written in parallel with feature work.
- **Context management is fully independent:** No code dependencies. Can be done at any point.

## Implementation Details

### 1. Trigger.dev Env Var Delivery

**Current state:** `trigger.config.ts` has no env var configuration. Workers read `process.env.DATABASE_URL` and `process.env.HUB_ENCRYPTION_KEY` at runtime and crash if missing.

**Solution -- two complementary approaches:**

1. **Deploy-time (primary):** Add `resolveEnvVars` to `trigger.config.ts` that reads from `.hubs/personal.json` and syncs DATABASE_URL, HUB_ENCRYPTION_KEY, X_CLIENT_ID, and X_CLIENT_SECRET to the Trigger.dev environment. This runs during `bunx trigger.dev deploy`, on the local machine -- it can read local files.
2. **Dashboard fallback:** Document that users can set these in the Trigger.dev dashboard (Environment Variables page) for their project.

**Key detail:** `resolveEnvVars` runs in the build/deploy context (local machine), not in the worker. It reads local config files and pushes values to Trigger.dev's environment. The deployed worker then receives them as `process.env.*`.

**Also needed:** X_CLIENT_ID and X_CLIENT_SECRET (x.handler.ts lines 31-34). These come from `config/keys.env` locally.

**Existing code to modify:** `trigger.config.ts` (19 lines, trivial), plus documentation in setup wizard.

### 2. X OAuth Callback Server

**Current state:** `createXOAuthClient` called with `callbackUrl: "https://example.com/callback"` (hardcoded placeholder in x.handler.ts line 54 and presumably in the setup command). No server captures the redirect.

**Solution -- localhost callback per RFC 8252:**

1. Start ephemeral `Bun.serve()` with `port: 0` (OS assigns available port).
2. Set callback URL to `http://localhost:{port}/callback`.
3. Create Arctic Twitter client with that callback URL.
4. Generate auth URL with PKCE (already implemented in `x/oauth.ts`).
5. Open user's browser via `Bun.spawn(["open", url])` or similar.
6. Wait for callback with authorization code (timeout: 120s).
7. Exchange code for tokens (already implemented), encrypt, store in DB.
8. Shut down server, display success message.

**Library choice:** Hand-roll with Bun.serve rather than adding `oauth-callback` package. The pattern is ~50 lines and avoids a dependency for trivial functionality. Bun.serve with `port: 0` is idiomatic.

**Security considerations:** Bind to localhost only (Bun.serve default). Validate state parameter matches (CSRF prevention, already handled by Arctic). Timeout after 120s if user abandons flow.

**Existing code to modify:** `src/platforms/x/oauth.ts` (add callback server function), setup command (wire it in), x.handler.ts (use dynamic callback URL for token refresh -- though refresh does not need a callback URL, this is only for the initial auth flow).

### 3. Thread Publishing Resilience

**Current state:** `XHandler.postThread()` (x.handler.ts lines 125-159) iterates through tweets, pushes IDs to a local `tweetIds` array. On non-rate-limit failure, the handler throws -- successfully-posted tweet IDs are lost. The `threadProgressSchema` exists (lines 17-22) and is read on entry (lines 132-136), but never written back to DB during posting.

**Solution -- persist progress after each tweet:**

1. After each successful `client.createTweet()`, write `threadProgress` to `posts.metadata` via DB update: `{ posted: i+1, total: tweets.length, lastPostedId: result.id, tweetIds: [...] }`.
2. Also set `subStatus: "thread_partial"` to distinguish from other publishing states.
3. On failure, the post remains in `publishing` status with `threadProgress` showing exactly where it stopped.
4. On retry (Trigger.dev auto-retry or manual), read `threadProgress` to resume from correct index with correct `replyToId`.
5. On completion, store all tweet IDs in metadata. Clear `subStatus`.

**Performance:** DB write after each tweet adds ~50ms latency per tweet (Neon HTTP driver). For a 7-tweet thread: ~350ms total overhead. Acceptable tradeoff for data safety.

**Edge case -- duplicate detection:** If DB write fails after a successful tweet post, on retry the same content is re-posted. X may return Error 187 (duplicate). Handle by catching 187 and treating as "already posted, advance index." Parse the error to extract or look up the existing tweet ID if possible.

**Edge case -- rate limit mid-thread:** Already handled (x.handler.ts lines 150-155) with `wait.until`. The fix must preserve this behavior while adding checkpoint persistence.

**Existing code to modify:** `src/platforms/handlers/x.handler.ts` (postThread method, ~35 lines affected). Needs DB connection passed into postThread (currently only has XClient).

### 4. Tweet Pre-flight Validation

**Current state:** No validation before API call. `splitIntoThread` (thread-splitter.ts) uses raw `string.length` against 280. Does not account for weighted character counting.

**Solution:**

1. Add `twitter-text` npm package (official X library, maintained by X/Twitter).
2. Create `src/platforms/x/validate.ts` with a `validateTweet(text: string, mediaIds?: string[]): ValidationResult` function.
3. Call `parseTweet(text)` which returns `{ weightedLength, valid, permillage }`.
4. Before each `createTweet` call in the handler, run validation. Return descriptive error if invalid.
5. In `/psn:post` command preview step, show weighted character count per tweet.

**Validation rules:**
- `parseTweet(text).valid === true` (weighted length <= 280)
- URLs count as 23 characters regardless of actual length (t.co wrapping)
- Emojis count as 2 characters each (Unicode weight)
- Media attachments do not count toward character limit
- Maximum 4 images or 1 video per tweet
- Practical thread limit: 25 tweets (warn, not block)

**Also fix thread-splitter:** Update `splitIntoThread` to use weighted character counting from `twitter-text` instead of raw `string.length`. This prevents generating tweets that pass the splitter but fail the API.

**Existing code to modify:** New file `src/platforms/x/validate.ts`. Modify `x.handler.ts` publish method. Modify `thread-splitter.ts` to accept a weight function.

### 5. Testing Infrastructure

**Current state:** Vitest 4.x installed. 12 test files exist. No API mocking infrastructure. No `@trigger.dev/testing`.

**Solution:**

1. **Add packages:** `@trigger.dev/testing` (task-level testing), `msw` (HTTP API mocking).
2. **Contract tests:** For each platform handler (X, LinkedIn, Instagram, TikTok), verify it implements PlatformPublisher with correct method signatures and behavioral contracts. Test: returns `{ platform, status, externalPostId }` on success, returns `{ platform, status: "failed", error }` on failure.
3. **Unit tests for new features:**
   - Tweet validation: weighted counting edge cases (emoji, URLs, mixed content)
   - Thread checkpoint: persistence after each tweet, resume from checkpoint, duplicate handling
   - OAuth callback: server lifecycle, timeout, state validation
4. **MSW setup:** Create `src/test/msw-handlers.ts` with mock responses for X API endpoints (`/2/tweets`, `/2/users/me`).

**Test categories:**
- **Unit:** Pure functions (validation, thread splitting, checkpoint logic)
- **Contract:** Handler interface compliance (all 4 handlers)
- **Integration:** Task-level tests with `@trigger.dev/testing` + MSW mocks

### 6. Context Management

**Current state:** PROJECT.md, CLAUDE.md, MEMORY.md, and planning docs have overlapping content. No automated sync validation.

**Solution:**
1. **Pre-commit hook** (git hook script in `.githooks/` or lefthook): validate that PROJECT.md exists and has required sections (Current State, Constraints, Key Decisions).
2. **State consolidation:** Remove duplicate content between PROJECT.md and MEMORY.md. MEMORY.md should reference PROJECT.md, not duplicate it.
3. **Doc validation script:** `scripts/validate-docs.ts` that checks milestone status markers are consistent.

## MVP Definition

### v1.3 Scope (This Milestone)

- [x] Trigger.dev env var delivery -- Unblocks all deployed task execution
- [x] X OAuth callback server -- Unblocks user authentication
- [x] Thread publishing resilience -- Prevents data loss on partial failure
- [x] Tweet pre-flight validation -- Prevents misleading 403 errors
- [x] Testing infrastructure -- Vitest mocks, contract tests, MSW
- [x] Context management -- State consolidation, pre-commit hooks

### Defer to v1.4+ (Future)

- [ ] Dry-run mode -- Valuable but not blocking real usage
- [ ] Multi-hub env var resolution -- Only matters with Company Hubs (secondary use case)
- [ ] Thread resume CLI UX (`/psn:post --resume`) -- Checkpoint persistence is v1.3, user-facing resume UX can wait
- [ ] LinkedIn/Instagram/TikTok OAuth callback servers -- Same pattern as X, but those platforms need partner approval first anyway

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Trigger.dev env var delivery | HIGH | LOW | P1 |
| X OAuth callback server | HIGH | MEDIUM | P1 |
| Thread publishing resilience | HIGH | HIGH | P1 |
| Tweet pre-flight validation | HIGH | LOW | P1 |
| Testing infrastructure (Vitest) | MEDIUM | MEDIUM | P2 |
| Context management | LOW | LOW | P2 |
| Dry-run mode | MEDIUM | MEDIUM | P3 |
| Multi-hub env resolution | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have -- blocks real user workflow
- P2: Should have -- improves development quality and maintainability
- P3: Nice to have -- defer to future milestone

## Sources

- [Trigger.dev Environment Variables](https://trigger.dev/docs/deploy-environment-variables) -- resolveEnvVars and dashboard configuration (HIGH confidence)
- [Trigger.dev trigger.config.ts](https://trigger.dev/docs/trigger-config) -- config file bundling and build extensions (HIGH confidence)
- [Trigger.dev Env Vars SDK Changelog](https://trigger.dev/changelog/env-vars-sdk) -- SDK for programmatic env var management (HIGH confidence)
- [oauth-callback (GitHub)](https://github.com/kriasoft/oauth-callback) -- Lightweight OAuth callback for CLI tools, Bun/Node/Deno (MEDIUM confidence)
- [RFC 8252 - OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252) -- Standard for localhost OAuth callbacks (HIGH confidence)
- [X API Error Troubleshooting](https://developer.x.com/en/support/x-api/error-troubleshooting) -- Error codes including 187 (duplicate) and 403 (MEDIUM confidence)
- [X Counting Characters](https://docs.x.com/fundamentals/counting-characters) -- Official weighted character counting rules (HIGH confidence)
- [twitter-text (npm)](https://www.npmjs.com/package/twitter-text) -- Official X text parsing library with parseTweet (HIGH confidence)
- [twitter-text (GitHub)](https://github.com/twitter/twitter-text) -- Conformance tests and specification (HIGH confidence)
- [@trigger.dev/testing (npm)](https://www.npmjs.com/package/@trigger.dev/testing) -- Official Trigger.dev testing utilities v3.3.x (MEDIUM confidence)
- [Building a Localhost OAuth Callback Server in Node.js](https://dev.to/koistya/building-a-localhost-oauth-callback-server-in-nodejs-470c) -- Pattern reference (MEDIUM confidence)

---
*Feature research for: v1.3 Real-World Reliability*
*Researched: 2026-02-27*
