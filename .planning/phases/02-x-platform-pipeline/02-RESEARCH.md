# Phase 2: X Platform Pipeline - Research

**Researched:** 2026-02-19
**Domain:** X (Twitter) API v2, OAuth 2.0 PKCE, Trigger.dev delayed runs, media upload
**Confidence:** HIGH

## Summary

Phase 2 implements the full X platform pipeline: OAuth 2.0 PKCE authentication via the Arctic library, encrypted token storage with race-condition-safe refresh, a typed X API client with rate limit tracking, post scheduling via Trigger.dev delayed runs, thread support with auto-splitting, and media uploads via the X API v2 media endpoint.

The X API v2 ecosystem is now mature for this use case. The new `/2/media/upload` endpoint (launched January 2025) replaces the v1.1 media endpoints (sunset June 2025). Arctic v3 provides a clean, typed OAuth 2.0 PKCE implementation for X. Trigger.dev v4 has first-class support for delayed runs with cancel/reschedule APIs, which map directly to the schedule/edit/cancel post workflow.

The pay-per-use API tier (or free tier with 1,500 posts/month write-only) makes X the cheapest platform to start with. Rate limits are generous: 100 posts/15 minutes per user, 500 media uploads/15 minutes per user.

**Primary recommendation:** Use Arctic v3 for OAuth, raw `fetch` for the X API v2 client (typed wrapper, no third-party SDK needed), Trigger.dev delayed runs for scheduling, and Postgres `SELECT FOR UPDATE SKIP LOCKED` for token refresh locking.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**OAuth Flow UX:**
- Manual URL + paste flow: CLI prints the X authorization URL, user opens browser, authorizes, gets redirected to a page showing the authorization code, pastes it back into CLI
- No local callback server — works everywhere without port access concerns
- On re-run (`/psn:setup`): check if existing token is valid, skip OAuth if it works. Only re-auth when token is expired/invalid
- OAuth is a step within `/psn:setup`, not a separate command. Setup's resume-from-failure handles re-auth scenarios
- Guide user through X Developer Portal app creation (step-by-step instructions for creating app, setting callback URLs, getting client ID/secret) — but skip if credentials already exist in config

**Post Scheduling Behavior:**
- Config-based timezone: user sets timezone once in `config/hub.env` or during setup. All times interpreted and displayed in that timezone. Stored as UTC internally
- Users can both edit and cancel scheduled posts. Editing cancels the Trigger.dev delayed run and creates a new one with updated content
- "Post now" option available — publishes immediately via Trigger.dev (not forced through scheduler delay)
- No queue visibility command in Phase 2. Users wait for `/psn:calendar` in Phase 7. Post confirmation after scheduling is sufficient

**Thread Composition:**
- Single text input with auto-split: user writes one continuous text, system splits at 280 chars respecting sentence/paragraph boundaries
- Feedback loop: after auto-split, show full thread preview (numbered tweets with char counts). User can adjust split points, edit individual tweets, or approve
- No hard limit on thread length. Warn above 7 tweets but don't block
- Full preview before posting: each tweet numbered (1/n), character count shown, user approves entire thread

**Thread Partial Failure:**
- Retry inline: if a tweet in a thread fails, retry up to 3x with exponential backoff before stopping
- Only stop and notify if all retries for a tweet are exhausted
- Record which tweets posted successfully so user can resume from the failure point

**Failure & Notification UX:**
- DB status only for Phase 2 (no email, no WhatsApp yet). User discovers failures next time they interact with PSN
- Posts surfaced when relevant (e.g., `/psn:post` shows recent failures in the preamble)
- Rate limit hits are visible: post record notes "delayed by rate limit" in status. Not silent — user should know
- Detailed post statuses in DB: `draft -> scheduled -> publishing -> published/failed` with sub-statuses (`retry_1`, `retry_2`, `retry_3`, `rate_limited`, `media_uploading`, `media_uploaded`, `thread_partial`)

**Post Final Failure Handling:**
- After 3 retries exhausted, mark as failed and preserve content for easy manual retry or reschedule

### Claude's Discretion

- Arctic library integration details for X OAuth 2.0 PKCE
- X API client architecture (typed client with rate limit tracking)
- Trigger.dev delayed run management (create, cancel, re-create on edit)
- Media upload pipeline (register -> upload -> attach flow for X)
- Token refresh task scheduling and row-level locking implementation
- Token encryption key management (reuse Phase 1 crypto utils)
- DB schema additions for Phase 2 (posts table expansion, thread tracking)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can authenticate with X via OAuth 2.0 PKCE flow using Arctic library | Arctic v3 Twitter provider verified: `createAuthorizationURL(state, codeVerifier, scopes)` + `validateAuthorizationCode(code, codeVerifier)`. PKCE flow documented with `generateState()` and `generateCodeVerifier()`. |
| AUTH-05 | Token refresher task runs daily and proactively refreshes tokens within 7 days of expiry | X access tokens expire in 2 hours, refresh tokens valid 6 months (one-time use). Arctic provides `refreshAccessToken(refreshToken)`. Daily cron via Trigger.dev `schedules.task`. |
| AUTH-06 | OAuth token refresh uses Postgres row-level locking (SELECT FOR UPDATE SKIP LOCKED) to prevent race conditions | Postgres SKIP LOCKED pattern verified: single atomic statement selects and locks rows, concurrent workers skip already-locked rows. Drizzle ORM supports raw SQL for this. |
| AUTH-07 | User is notified when token refresh fails and manual re-authorization is needed | DB status tracking: token refresh failures stored in `oauth_tokens` metadata. Surfaced when user interacts with `/psn:post` or other commands. |
| AUTH-08 | OAuth tokens are stored encrypted in Hub DB oauth_tokens table, not in environment variables | Phase 1 crypto utils (AES-256-GCM) already exist. `encrypt()`/`decrypt()` from `src/core/utils/crypto.ts`. Schema already has `oauth_tokens` table with `access_token`/`refresh_token` text fields. |
| PLAT-01 | X posting: text posts, threads (3-7 tweets), images, scheduling via Trigger.dev delayed runs | X API v2 `POST /2/tweets` with `reply.in_reply_to_tweet_id` for threads. `POST /2/media/upload` for images. Trigger.dev `task.trigger({}, { delay })` for scheduling. |
| PLAT-05 | Each platform has its own typed API client with rate limit awareness | X rate limits tracked via `x-rate-limit-remaining` and `x-rate-limit-reset` response headers. Typed client wraps fetch with Zod schema validation. |
| SCHED-01 | User can schedule a post for a specific date and time | Trigger.dev `delay` accepts ISO 8601 datetime or relative duration strings. Post record created in DB with `scheduledAt` timestamp. |
| SCHED-02 | Post scheduler task publishes content at scheduled time via Trigger.dev delayed run | `publishPost` Trigger.dev task triggered with `{ delay: scheduledDate }`. Run ID stored in post metadata for cancel/reschedule. |
| SCHED-03 | Scheduler handles multi-step media upload (register -> upload -> attach) per platform | X API v2 simple upload: single `POST /2/media/upload` with binary data returns `media_id`. Attach via `media.media_ids` in tweet creation. Chunked upload available for large files (initialize/append/finalize). |
| SCHED-04 | Scheduler retries 3x with exponential backoff on failure; respects platform rate limit windows | Trigger.dev config already has retry settings. Additional rate limit awareness: read `x-rate-limit-reset` header, use `wait.until()` or re-delay if rate limited. |
| SCHED-05 | Failed posts notify the user and are tagged status:failed | Post status flow: `scheduled -> publishing -> published/failed`. Failed posts surfaced in `/psn:post` preamble. Metadata captures failure reason. |
| CONTENT-05 | Content queue in Hub DB posts table is source of truth for scheduled/published posts | Posts table already exists in schema. Needs expansion for thread tracking (parent_post_id, thread_position, trigger_run_id). |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| arctic | ^3.7.0 | OAuth 2.0 PKCE client for X | Zero-dependency, typed, maintained by pilcrow (Lucia Auth author). Direct X/Twitter provider support. |
| @trigger.dev/sdk | ^4.3.3 (already installed) | Task scheduling, delayed runs, cancel/reschedule | Already in the project. First-class delay/cancel/reschedule support. |
| zod | ^4.3.6 (already installed) | API response validation, schema typing | Already in the project. Used for X API response validation. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | ^0.45.1 (already installed) | DB queries, token storage, post management | Already in the project. Raw SQL available for SELECT FOR UPDATE SKIP LOCKED. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| arctic | twitter-api-v2 (npm) | twitter-api-v2 bundles a full SDK with read endpoints we don't need. Arctic is lighter — just OAuth. We build the posting client ourselves with fetch. |
| Raw fetch for X API | twitter-api-v2 SDK | SDK adds convenience but obscures rate limit headers and makes it harder to implement custom retry logic. Raw fetch with typed wrappers gives full control. |
| Trigger.dev delay | node-cron + setTimeout | Trigger.dev delay survives process restarts, provides dashboard visibility, built-in cancel/reschedule. No comparison. |

**Installation:**
```bash
bun add arctic
```

No other new dependencies needed. Everything else is already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── platforms/
│   └── x/
│       ├── client.ts          # Typed X API client with rate limit tracking
│       ├── oauth.ts           # Arctic-based OAuth PKCE flow
│       ├── types.ts           # X API request/response Zod schemas
│       └── media.ts           # Media upload helpers
├── trigger/
│   ├── publish-post.ts        # Post publisher task (single + thread)
│   ├── token-refresher.ts     # Daily token refresh cron
│   └── watchdog.ts            # (existing) Post watchdog
├── core/
│   ├── db/
│   │   ├── schema.ts          # (expand) Add thread tracking columns
│   │   └── connection.ts      # (existing)
│   ├── utils/
│   │   ├── crypto.ts          # (existing) Token encryption
│   │   ├── thread-splitter.ts # Text -> thread auto-split logic
│   │   └── timezone.ts        # Timezone conversion utilities
│   └── types/
│       └── index.ts           # (expand) New post sub-statuses, thread types
└── cli/
    ├── setup.ts               # (expand) Add X OAuth step
    └── post.ts                # Post creation CLI script
```

### Pattern 1: OAuth 2.0 PKCE Flow (Manual URL + Paste)

**What:** User authorizes via browser, pastes code back into CLI. No callback server.
**When to use:** CLI tools without HTTP server capability.
**Example:**
```typescript
// Source: https://arcticjs.dev/providers/twitter + https://arcticjs.dev/guides/oauth2-pkce
import { Twitter, generateState, generateCodeVerifier } from "arctic";

const twitter = new Twitter(clientId, clientSecret, callbackUrl);

// Step 1: Generate PKCE params and auth URL
const state = generateState();
const codeVerifier = generateCodeVerifier();
const scopes = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];
const authUrl = twitter.createAuthorizationURL(state, codeVerifier, scopes);

// Step 2: User opens URL in browser, authorizes, gets redirected, copies code
// CLI outputs: authUrl for user to open
// CLI reads: authorization code pasted by user

// Step 3: Exchange code for tokens
const tokens = await twitter.validateAuthorizationCode(code, codeVerifier);
const accessToken = tokens.accessToken();
const refreshToken = tokens.refreshToken();
const expiresAt = tokens.accessTokenExpiresAt(); // ~2 hours from now

// Step 4: Encrypt and store
const encryptedAccess = encrypt(accessToken, encryptionKey);
const encryptedRefresh = encrypt(refreshToken, encryptionKey);
// Insert into oauth_tokens table
```

### Pattern 2: Trigger.dev Delayed Run for Scheduling

**What:** Create a delayed run that fires at the scheduled time. Store run ID for cancel/reschedule.
**When to use:** Every scheduled post.
**Example:**
```typescript
// Source: https://trigger.dev/docs/triggering (delay section)
import { runs } from "@trigger.dev/sdk";
import { publishPost } from "./trigger/publish-post";

// Schedule a post
const handle = await publishPost.trigger(
  { postId: "uuid-here" },
  { delay: scheduledDate } // ISO 8601 datetime or Date object
);
// Store handle.id (run_xxx) in post metadata for cancel/reschedule

// Cancel a scheduled post
await runs.cancel(handle.id);

// Edit: cancel old run, create new one
await runs.cancel(oldRunId);
const newHandle = await publishPost.trigger(
  { postId: "uuid-here" },
  { delay: newScheduledDate }
);

// Post now (no delay)
const handle = await publishPost.trigger({ postId: "uuid-here" });
```

### Pattern 3: Token Refresh with Row-Level Locking

**What:** Use `SELECT FOR UPDATE SKIP LOCKED` to prevent concurrent token refresh race conditions.
**When to use:** Token refresher cron task that may run on multiple workers.
**Example:**
```typescript
// Source: https://www.inferable.ai/blog/posts/postgres-skip-locked
// + Drizzle raw SQL
import { sql } from "drizzle-orm";

// Inside token-refresher task:
// 1. Select tokens expiring within 7 days, locking them
const result = await db.execute(sql`
  SELECT id, user_id, platform, refresh_token, expires_at
  FROM oauth_tokens
  WHERE platform = 'x'
    AND expires_at < NOW() + INTERVAL '7 days'
  FOR UPDATE SKIP LOCKED
  LIMIT 10
`);

// 2. For each locked token, refresh via Arctic
for (const token of result.rows) {
  const decryptedRefresh = decrypt(token.refresh_token, encryptionKey);
  const newTokens = await twitter.refreshAccessToken(decryptedRefresh);
  // 3. Update with new encrypted tokens
  // Arctic returns a new refresh token (X refresh tokens are one-time use)
}
```

### Pattern 4: Thread Auto-Split with Sentence Boundary Respect

**What:** Split long text into 280-char tweets at sentence/paragraph boundaries.
**When to use:** Thread composition before posting.
**Example:**
```typescript
function splitIntoThread(text: string, maxLen = 280): string[] {
  const paragraphs = text.split(/\n\n+/);
  const tweets: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= maxLen) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) tweets.push(current.trim());
      // If paragraph itself exceeds maxLen, split by sentences
      if (para.length > maxLen) {
        const sentences = para.match(/[^.!?]+[.!?]+\s*/g) || [para];
        current = "";
        for (const sentence of sentences) {
          if (current.length + sentence.length <= maxLen) {
            current += sentence;
          } else {
            if (current) tweets.push(current.trim());
            current = sentence;
          }
        }
      } else {
        current = para;
      }
    }
  }
  if (current.trim()) tweets.push(current.trim());
  return tweets;
}
```

### Pattern 5: X API Client with Rate Limit Tracking

**What:** Typed fetch wrapper that reads rate limit headers and tracks remaining quota.
**When to use:** Every X API call.
**Example:**
```typescript
interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

interface XApiResponse<T> {
  data: T;
  rateLimit: RateLimitInfo;
}

async function xApiFetch<T>(
  endpoint: string,
  options: RequestInit,
  accessToken: string
): Promise<XApiResponse<T>> {
  const res = await fetch(`https://api.x.com${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const rateLimit: RateLimitInfo = {
    limit: Number(res.headers.get("x-rate-limit-limit") ?? 0),
    remaining: Number(res.headers.get("x-rate-limit-remaining") ?? 0),
    resetAt: new Date(Number(res.headers.get("x-rate-limit-reset") ?? 0) * 1000),
  };

  if (res.status === 429) {
    throw new RateLimitError(rateLimit);
  }

  if (!res.ok) {
    throw new XApiError(res.status, await res.text(), rateLimit);
  }

  const data = await res.json() as T;
  return { data, rateLimit };
}
```

### Anti-Patterns to Avoid

- **Storing tokens in env vars:** Tokens change every 2 hours. Store encrypted in DB, decrypt at runtime.
- **Ignoring rate limit headers:** Always read `x-rate-limit-remaining` and `x-rate-limit-reset`. Never retry blindly after 429.
- **Using setTimeout for scheduling:** Does not survive process restarts. Always use Trigger.dev delayed runs.
- **Refreshing tokens without locking:** Multiple workers refreshing the same token = one-time-use refresh token consumed twice = one worker gets invalid token. Always use `SELECT FOR UPDATE SKIP LOCKED`.
- **Splitting threads mid-word:** Always split at sentence boundaries, then paragraph boundaries, then word boundaries as last resort.
- **Fire-and-forget thread posting:** Each tweet in a thread depends on the previous tweet's ID. Must be sequential with error tracking per tweet.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 PKCE | Custom PKCE implementation | Arctic v3 Twitter provider | PKCE code verifier/challenge generation, token exchange, refresh — all handled. Edge cases in spec compliance. |
| Token encryption | Custom cipher | Phase 1 `crypto.ts` (AES-256-GCM) | Already built, tested, handles IV + auth tag correctly. |
| Delayed task execution | Custom scheduler / setTimeout | Trigger.dev delayed runs | Survives restarts, dashboard visibility, cancel/reschedule API, retry built-in. |
| Row-level locking | Application-level mutex | Postgres `SELECT FOR UPDATE SKIP LOCKED` | Database-level atomicity, no distributed lock coordination needed. |
| Timezone conversion | Manual UTC offset math | Intl.DateTimeFormat / `toLocaleString` with timeZone | Handles DST transitions, IANA timezone database. |

**Key insight:** The hard parts of this phase (OAuth security, concurrent token refresh, reliable scheduling) all have battle-tested database/library solutions. Hand-rolling any of them introduces subtle bugs that only manifest under concurrency or after token expiry.

## Common Pitfalls

### Pitfall 1: X Refresh Tokens Are One-Time Use
**What goes wrong:** Code refreshes a token, stores the new access token, but fails to store the new refresh token. Next refresh attempt uses the old (now invalid) refresh token.
**Why it happens:** Other OAuth providers (Google, etc.) reuse refresh tokens. X does not.
**How to avoid:** Always store BOTH the new access token AND the new refresh token atomically in a single DB transaction after each refresh.
**Warning signs:** Token refresh works once, then fails on the next cycle. Users get re-auth prompts every 2 hours.

### Pitfall 2: Thread Posting Requires Sequential Execution
**What goes wrong:** Posting tweets in parallel or without waiting for the response. The `in_reply_to_tweet_id` for tweet N+1 requires the ID from tweet N's response.
**Why it happens:** Temptation to parallelize for speed.
**How to avoid:** Post tweets sequentially. Store each tweet's returned ID. Use it as `in_reply_to_tweet_id` for the next tweet.
**Warning signs:** Tweets appear as standalone posts instead of a connected thread.

### Pitfall 3: Rate Limit 429 Without Backoff
**What goes wrong:** Hitting rate limit, immediately retrying, getting banned or exhausting retries.
**Why it happens:** Not reading the `x-rate-limit-reset` header to know when the window resets.
**How to avoid:** On 429 response, read `x-rate-limit-reset` header (Unix timestamp), wait until that time, then retry. Use Trigger.dev `wait.until()` to checkpoint during the wait (no compute cost).
**Warning signs:** Repeated 429 errors in logs, posts stuck in `publishing` state.

### Pitfall 4: Media Upload Requires `media.write` Scope
**What goes wrong:** OAuth flow requests `tweet.read`, `tweet.write`, `users.read`, `offline.access` but forgets `media.write`. Media uploads return 403.
**Why it happens:** `media.write` is a newer scope added with the v2 media endpoints.
**How to avoid:** Always include `media.write` in the OAuth scopes list from day 1. Re-auth is required to add scopes later.
**Warning signs:** Text posts work fine, but posts with images fail with 403.

### Pitfall 5: Timezone Misinterpretation
**What goes wrong:** User says "schedule for 9am" but it posts at 9am UTC instead of 9am in their timezone.
**Why it happens:** Forgetting to convert from user's configured timezone to UTC before storing/scheduling.
**How to avoid:** Read timezone from config, convert to UTC immediately, store UTC, display in user's timezone.
**Warning signs:** Posts appear at wrong times. Off by consistent number of hours.

### Pitfall 6: Drizzle ORM Doesn't Have Built-in SELECT FOR UPDATE
**What goes wrong:** Trying to use Drizzle's query builder for `FOR UPDATE SKIP LOCKED` and finding it's not directly supported.
**Why it happens:** Drizzle's typed query builder doesn't expose row-level locking clauses.
**How to avoid:** Use `db.execute(sql`...`)` with raw SQL for the token refresh query. The rest of the token update can use the normal Drizzle builder.
**Warning signs:** TypeScript errors or missing methods when trying to chain `.forUpdate()`.

### Pitfall 7: Callback URL Mismatch in X Developer Portal
**What goes wrong:** OAuth flow fails with "callback URL mismatch" error.
**Why it happens:** The callback URL in the X Developer Portal app settings must EXACTLY match the one passed to Arctic's Twitter constructor, including trailing slashes and protocol.
**How to avoid:** Use a consistent callback URL. For CLI apps without a real server, use a known redirect like `https://example.com/callback` or a localhost URL. Document the exact URL in setup instructions.
**Warning signs:** OAuth authorization succeeds but token exchange fails with redirect_uri mismatch.

## Code Examples

### Creating a Tweet (X API v2)
```typescript
// Source: https://docs.x.com/x-api/posts/create-post
const { data, rateLimit } = await xApiFetch<{ data: { id: string; text: string } }>(
  "/2/tweets",
  {
    method: "POST",
    body: JSON.stringify({ text: "Hello from PSN!" }),
  },
  accessToken
);
// data.data.id = "1234567890123456789"
```

### Creating a Thread
```typescript
// Source: https://docs.x.com/x-api/posts/create-post (reply object)
async function postThread(tweets: string[], accessToken: string): Promise<string[]> {
  const postedIds: string[] = [];
  for (let i = 0; i < tweets.length; i++) {
    const body: Record<string, unknown> = { text: tweets[i] };
    if (i > 0) {
      body.reply = { in_reply_to_tweet_id: postedIds[i - 1] };
    }
    const { data } = await xApiFetch<{ data: { id: string } }>(
      "/2/tweets",
      { method: "POST", body: JSON.stringify(body) },
      accessToken
    );
    postedIds.push(data.data.id);
  }
  return postedIds;
}
```

### Simple Media Upload (X API v2)
```typescript
// Source: https://docs.x.com/x-api/media/upload-media
async function uploadImage(
  imageBuffer: Buffer,
  mimeType: string,
  accessToken: string
): Promise<string> {
  const formData = new FormData();
  formData.append("media", new Blob([imageBuffer], { type: mimeType }));
  formData.append("media_category", "tweet_image");

  const res = await fetch("https://api.x.com/2/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Media upload failed: ${res.status}`);
  const result = await res.json();
  return result.media_id; // Use in tweet's media.media_ids array
}
```

### Tweet with Media
```typescript
// Source: https://docs.x.com/x-api/posts/create-post
const mediaId = await uploadImage(imageBuffer, "image/jpeg", accessToken);
const { data } = await xApiFetch<{ data: { id: string } }>(
  "/2/tweets",
  {
    method: "POST",
    body: JSON.stringify({
      text: "Check this out!",
      media: { media_ids: [mediaId] },
    }),
  },
  accessToken
);
```

### Trigger.dev Publish Post Task
```typescript
// Source: https://trigger.dev/docs/tasks/overview + https://trigger.dev/docs/triggering
import { task, logger, wait } from "@trigger.dev/sdk";

export const publishPost = task({
  id: "publish-post",
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: { postId: string }) => {
    // 1. Fetch post from DB
    // 2. Decrypt token
    // 3. Upload media if present
    // 4. Post tweet (or thread)
    // 5. Update post status to published
    // 6. On rate limit: wait.until(resetTime), then retry
  },
});
```

### Token Refresher Cron Task
```typescript
// Source: https://trigger.dev/docs/tasks/scheduled
import { schedules, logger } from "@trigger.dev/sdk";

export const tokenRefresher = schedules.task({
  id: "token-refresher",
  cron: "0 */6 * * *", // Every 6 hours (access tokens expire in 2h)
  run: async () => {
    // 1. SELECT FOR UPDATE SKIP LOCKED tokens expiring within 7 days
    // 2. For each: decrypt refresh token, call Arctic refreshAccessToken()
    // 3. Encrypt new access + refresh tokens
    // 4. Update row atomically (new tokens + new expires_at)
    // 5. Log results
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X API v1.1 media upload | X API v2 `/2/media/upload` | Jan 2025 (announced), Jun 2025 (v1.1 sunset) | Must use v2 endpoints. OAuth 2.0 required (not OAuth 1.0a). |
| $200/mo Basic tier required | Free tier: 1,500 posts/mo write-only | 2023+ (ongoing) | Sufficient for personal use. Pay-per-use for higher volume. |
| OAuth 1.0a for all X API | OAuth 2.0 PKCE standard | 2023+ | OAuth 1.0a planned for deprecation. PKCE is the path forward. |
| Arctic v1/v2 | Arctic v3 | 2024 | Breaking changes in API. v3 is current stable. |
| Trigger.dev v3 | Trigger.dev v4 GA | 2025 | Run Engine 2, warm starts, improved delay/cancel/reschedule. |

**Deprecated/outdated:**
- X API v1.1 media endpoints: sunset June 9, 2025. Do not use `upload.twitter.com/1.1/media/upload.json`.
- OAuth 1.0a for X: still works but planned for deprecation. Use OAuth 2.0 PKCE exclusively.
- Arctic v1/v2: use v3. Breaking changes across major versions.

## Open Questions

1. **Chunked media upload rate limits on free tier**
   - What we know: Reports of low limits on free tier (17 initialize/finalize per 24h, 85 append per 24h). Paid tiers have 180,000/24h for each.
   - What's unclear: Whether these low limits still apply on the pay-per-use tier. Whether simple upload (`POST /2/media/upload`) has the same restrictions.
   - Recommendation: Start with simple upload for images (single endpoint, simpler). Only implement chunked upload if needed for video support later. Test rate limits during development with the actual tier being used.

2. **Arctic v3 `Twitter` constructor callback URL for CLI apps**
   - What we know: Arctic requires a `redirectURI` in the constructor. CLI app has no HTTP server.
   - What's unclear: Whether Arctic validates the redirect URI matches during token exchange, or if it's only used in the authorization URL.
   - Recommendation: Use a placeholder like `https://example.com/callback` or a custom scheme. Configure the same URL in X Developer Portal. The user copies the authorization code from the redirect page, so the URL just needs to display the code. **Validate during implementation.**

3. **X access token 2-hour expiry vs. daily refresh schedule**
   - What we know: Access tokens expire in 2 hours. Requirement says "daily" refresh.
   - What's unclear: Whether the token-refresher cron should run more frequently than daily.
   - Recommendation: Run token refresh every 6 hours (4x daily). This ensures tokens are refreshed well before expiry (6-month refresh token window is generous). The publish-post task should also refresh on-demand if it encounters an expired access token.

## Sources

### Primary (HIGH confidence)
- [Arctic v3 Twitter provider](https://arcticjs.dev/providers/twitter) - OAuth initialization, token exchange, refresh, revoke
- [Arctic v3 OAuth2 PKCE guide](https://arcticjs.dev/guides/oauth2-pkce) - PKCE flow, code verifier, state management
- [X API v2 Create Post](https://docs.x.com/x-api/posts/create-post) - Endpoint, body schema, reply/thread fields, media attachment
- [X API v2 Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits) - Per-user/per-app limits, headers, reset windows
- [X API v2 Media Upload](https://docs.x.com/x-api/media/upload-media) - Simple upload endpoint, media_category, auth requirements
- [Trigger.dev Triggering (delay)](https://trigger.dev/docs/triggering) - Delayed runs, cancel, reschedule SDK methods
- [Trigger.dev Cancel Run](https://trigger.dev/docs/management/runs/cancel) - `runs.cancel()` API
- [Trigger.dev Reschedule Run](https://trigger.dev/docs/management/runs/reschedule) - `runs.reschedule()` API, DELAYED state requirement

### Secondary (MEDIUM confidence)
- [X API v2 Chunked Media Upload](https://docs.x.com/x-api/media/quickstart/media-upload-chunked) - Initialize/append/finalize flow, 1MB chunks
- [X OAuth 2.0 PKCE docs](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code) - Scopes, token expiry (2h access, 6mo refresh)
- [Postgres SKIP LOCKED patterns](https://www.inferable.ai/blog/posts/postgres-skip-locked) - Row-level locking for queue-like operations
- [Arctic npm package](https://www.npmjs.com/package/arctic) - v3.7.0, does not strictly follow semver

### Tertiary (LOW confidence)
- [X API pricing 2026](https://getlate.dev/blog/twitter-api-pricing) - Free tier 1,500 posts/mo, pay-per-use pilot pricing. Needs validation against official X docs.
- [Chunked upload rate limit reports](https://devcommunity.x.com/t/new-chunked-media-upload-initialize-and-finalize-endpoint-limits-too-low/242138) - Free tier low limits. Community reports, may change.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Arctic v3 and Trigger.dev v4 verified via official docs. X API v2 endpoints confirmed.
- Architecture: HIGH - Patterns verified against Trigger.dev docs (delay/cancel/reschedule) and X API reference (create tweet, reply, media).
- Pitfalls: HIGH - Token one-time-use, rate limit headers, SKIP LOCKED pattern all verified from multiple sources.
- Media upload: MEDIUM - Simple upload well-documented. Chunked upload has known issues reported by community. Rate limits on free/pay-per-use tiers need runtime validation.

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — X API and Arctic are relatively stable)
