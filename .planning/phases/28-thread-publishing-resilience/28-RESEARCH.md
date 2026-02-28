# Phase 28: Thread Publishing Resilience - Research

**Researched:** 2026-02-27
**Domain:** X thread publishing checkpoint/resume, error handling, idempotent retries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Persist tweet IDs to DB immediately after each successful tweet (not batch at end)
- Store checkpoint in existing posts table metadata JSONB column (no new table, no migration)
- Checkpoint data: posted tweet IDs array + count only (no content hashes)
- If checkpoint DB write fails: retry 2-3 times, halt thread if retries exhausted (losing a tweet ID is worse than a shorter thread)
- Retries triggered automatically via Trigger.dev's built-in retry with backoff (no user action needed)
- Partially-posted threads show distinct "partially_posted" status with progress (e.g., "3/7 tweets posted")
- Notify user only on final failure (after all Trigger.dev retries exhausted) -- silent retries for transient issues
- No re-validation of remaining tweets on resume -- Phase 26 validates all tweets upfront, content hasn't changed
- React to Error 187 only -- no proactive pre-check against checkpoint before posting
- Error 187 on retry treated as success: attempt to find existing tweet ID via API lookup, advance checkpoint
- If Error 187 but can't find existing tweet ID: advance without ID, log warning, continue posting rest of thread
- No time limit on retries -- threads are time-sensitive content, edge cases not worth engineering around
- Rate limit mid-thread: wait for cooldown (from X rate limit headers), then resume in same attempt
- Content error mid-thread: halt immediately, checkpoint what's posted (don't skip -- threads need continuity)
- Network error mid-thread: retry the specific tweet 2-3 times inline, then halt and let Trigger.dev retry
- Final state after all retries exhausted: "partially_posted" with checkpoint preserved -- user can manually retry later or accept partial thread

### Claude's Discretion
- Exact retry backoff timing for inline network retries
- How to look up existing tweet ID when Error 187 occurs (search API, user timeline, etc.)
- Thread progress metadata JSONB structure details
- Trigger.dev retry configuration (max attempts, backoff curve)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| THREAD-01 | Thread progress (posted tweet IDs) is persisted to DB after each successful tweet | Checkpoint persistence pattern using posts.metadata JSONB column; existing `threadProgress` field in PostMetadata schema; `retry.onThrow` for DB write retries |
| THREAD-02 | Thread posting resumes from last checkpoint on retry (no duplicate tweets) | Existing `postThread` method already reads `threadProgress` from metadata and starts from `startIndex`; needs DB persistence after each tweet to survive task-level retries |
| THREAD-03 | Checkpoint DB writes retry 2-3 times on failure (checkpoint failure is never swallowed) | `retry.onThrow` from Trigger.dev SDK for inline block retries with configurable `maxAttempts` |
| THREAD-04 | X Error 187 (duplicate) on retry is treated as "already posted" rather than failure | X API v2 returns HTTP 403 with `"You are not allowed to create a Tweet with duplicate content."` in detail field; user timeline lookup via `GET /2/users/{id}/tweets` to recover tweet ID |
</phase_requirements>

## Summary

This phase makes X thread publishing recoverable by adding per-tweet checkpoint persistence, resume-from-checkpoint on retry, and duplicate detection via Error 187 handling. The existing codebase is already 60-70% of the way there: `XHandler.postThread()` already parses `threadProgress` from metadata and starts from `startIndex`, and the `PostMetadata` interface in the DB schema already has a `threadProgress` field. What is missing is the DB write after each tweet (the checkpoint persist), the `retry.onThrow` wrapper around that DB write, proper Error 187 detection, and the `partially_posted` status.

The Trigger.dev SDK provides `retry.onThrow` for inline block retries (perfect for checkpoint DB writes) and `AbortTaskRunError` for halting retries on non-recoverable errors. The existing task-level retry config (`maxAttempts: 3, factor: 2`) on `publish-post` handles task-level retries automatically. The X API v2 does NOT return the legacy error code 187 -- instead it returns HTTP 403 with a specific detail string. Detection must parse the error body text.

**Primary recommendation:** Modify `XHandler.postThread()` to persist checkpoint to DB after each successful tweet using `retry.onThrow` for the DB write, detect Error 187 by parsing the 403 response body string, recover tweet IDs via user timeline lookup, and add `partially_posted` as a new post status.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trigger.dev/sdk` | (project version) | `retry.onThrow`, `AbortTaskRunError`, `wait.until`, `logger` | Already in use; provides inline retry blocks and task abort |
| `drizzle-orm` | (project version) | JSONB update for checkpoint persistence | Already in use; handles posts table updates |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod/v4` | (project version) | Validate threadProgress JSONB structure on read | Already in use in x.handler.ts via `threadProgressSchema` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB metadata column | Separate `thread_checkpoints` table | Cleaner schema but requires migration -- user decided no new tables |
| `retry.onThrow` for DB writes | Manual try/catch loop | `retry.onThrow` is cleaner, has built-in backoff, integrates with Trigger.dev logging |
| User timeline lookup for Error 187 | `searchRecent` API | Timeline is cheaper (rate limit), more reliable, already implemented in `XClient` |

**Installation:**
No new packages needed -- all dependencies already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── platforms/
│   └── handlers/
│       └── x.handler.ts     # Modified: checkpoint persist + Error 187 + resume logic
├── core/
│   ├── db/
│   │   └── schema.ts        # Modified: add "partially_posted" to status docs/comments
│   └── types/
│       └── index.ts          # Modified: add "partially_posted" to PostStatus union
├── trigger/
│   └── publish-post.ts       # Modified: handle "partially_posted" status in orchestrator
│   └── publish-helpers.ts    # Modified: add markPartiallyPosted helper
```

### Pattern 1: Per-Tweet Checkpoint with retry.onThrow
**What:** After each successful tweet API call, persist the checkpoint (tweet IDs array + count) to the posts table metadata JSONB column, wrapped in `retry.onThrow` for resilience.
**When to use:** Every successful tweet in a thread.
**Example:**
```typescript
// Source: Trigger.dev docs (retry.onThrow) + project x.handler.ts
import { retry, logger, AbortTaskRunError } from "@trigger.dev/sdk";

// Inside postThread loop, after successful createTweet:
tweetIds.push(result.id);

await retry.onThrow(
  async ({ attempt }) => {
    await db
      .update(posts)
      .set({
        subStatus: "thread_partial",
        updatedAt: new Date(),
        metadata: {
          ...existingMetadata,
          threadProgress: JSON.stringify({
            posted: tweetIds.length,
            total: tweets.length,
            lastPostedId: result.id,
            tweetIds: [...tweetIds],
          }),
        },
      })
      .where(eq(posts.id, postId));
    logger.info("Thread checkpoint saved", { postId, tweetIndex: i, attempt });
  },
  { maxAttempts: 3, randomize: false }
);
```

### Pattern 2: Error 187 / Duplicate Detection (X API v2)
**What:** X API v2 does NOT use error code 187. Instead, duplicate content returns HTTP 403 with a specific detail string in the response body. Detect this by parsing the error message.
**When to use:** When `XApiError` is caught with `statusCode === 403` during thread posting.
**Example:**
```typescript
// Source: X Developer Community + X API v2 error format
// X API v2 duplicate response format:
// {"detail":"You are not allowed to create a Tweet with duplicate content.","type":"about:blank","title":"Forbidden","status":403}

function isDuplicateError(error: unknown): boolean {
  if (error instanceof XApiError && error.statusCode === 403) {
    return error.message.includes("duplicate content");
  }
  return false;
}
```

### Pattern 3: Tweet ID Recovery via User Timeline
**What:** When Error 187 is detected, look up the user's recent tweets to find the duplicate and recover its tweet ID for the checkpoint.
**When to use:** After detecting a duplicate error during thread retry.
**Example:**
```typescript
// Source: XClient.getTimeline() already exists in x/client.ts
// GET /2/users/{id}/tweets returns recent tweets reverse-chronologically

async function recoverTweetId(
  client: XClient,
  tweetText: string,
): Promise<string | null> {
  try {
    const timeline = await client.getTimeline({ maxResults: 10 });
    const match = timeline.data.find((t) => t.text === tweetText);
    return match?.id ?? null;
  } catch {
    return null; // Recovery is best-effort
  }
}
```

### Pattern 4: Partially Posted Status
**What:** Distinguish recoverable partial threads from terminal failures with a distinct `partially_posted` status.
**When to use:** When a thread halts mid-posting but has checkpoint data.
**Example:**
```typescript
// In publish-helpers.ts
export async function markPartiallyPosted(
  db: DbConnection,
  postId: string,
  tweetIds: string[],
  totalTweets: number,
  failReason: string,
) {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  await db
    .update(posts)
    .set({
      status: "partially_posted",
      subStatus: "thread_partial",
      failReason,
      updatedAt: new Date(),
      metadata: {
        ...(post?.metadata ?? {}),
        threadProgress: JSON.stringify({
          posted: tweetIds.length,
          total: totalTweets,
          lastPostedId: tweetIds[tweetIds.length - 1],
          tweetIds,
        }),
      },
    })
    .where(eq(posts.id, postId));
}
```

### Anti-Patterns to Avoid
- **Batch checkpoint at end of thread:** If the task crashes mid-thread, all tweet IDs are lost. Persist after EACH tweet.
- **Swallowing checkpoint DB write failures:** The user decided this is worse than a shorter thread. Always surface checkpoint write failures.
- **Pre-checking checkpoint before each tweet post:** The user decided to react to Error 187 only, not proactively skip. This avoids extra DB reads per tweet.
- **Using content hashes for duplicate detection:** The user decided checkpoint stores tweet IDs + count only. X API duplicate detection is text-based anyway.
- **Re-validating remaining tweets on resume:** Phase 26 validates upfront. Re-validation wastes time and the content hasn't changed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline retry for checkpoint DB writes | Manual try/catch loop with sleep | `retry.onThrow` from `@trigger.dev/sdk` | Built-in backoff, attempt counting, integrates with Trigger.dev logging |
| Task-level retry orchestration | Custom retry scheduler | Trigger.dev task retry config (`maxAttempts`, `factor`) | Already configured on `publish-post` task; handles backoff, deduplication |
| Rate limit wait during thread | Manual setTimeout/sleep | `wait.until({ date })` from `@trigger.dev/sdk` | Checkpoints the task (free compute), resumes exactly at reset time |

**Key insight:** Trigger.dev's `retry.onThrow` is the critical primitive here. It provides sub-task retry for the checkpoint write without retrying the entire task. The task-level retry handles the outer loop (resume from checkpoint on full task re-attempt).

## Common Pitfalls

### Pitfall 1: X API v2 Does Not Return Error Code 187
**What goes wrong:** Code checks for error code 187 (v1.1 format) but X API v2 returns HTTP 403 with `"duplicate content"` in the detail string.
**Why it happens:** Training data and documentation still reference the v1.1 error code format.
**How to avoid:** Parse the `XApiError.message` string for `"duplicate content"` substring when `statusCode === 403`. The existing `XApiError` class stores the response body text as the message.
**Warning signs:** Duplicate errors treated as generic 403 failures instead of recoverable duplicates.

### Pitfall 2: JSONB Metadata Merge Overwrites
**What goes wrong:** Using spread operator (`{ ...metadata, threadProgress: ... }`) can lose concurrent metadata updates from other fields.
**Why it happens:** Two concurrent updates to the same JSONB column create a lost-update scenario.
**How to avoid:** Use `jsonb_set()` in SQL for surgical JSONB field updates, or accept that during thread posting no other process writes to this post's metadata (reasonable for single-user thread publishing).
**Warning signs:** Missing metadata fields after thread checkpoint writes.

### Pitfall 3: Checkpoint Has Tweet IDs But Thread Resumes Wrong Position
**What goes wrong:** `startIndex` is calculated from `tweetIds.length` but the tweetIds array might have gaps if Error 187 recovery couldn't find the tweet ID.
**Why it happens:** When Error 187 is detected but tweet ID recovery fails, the user decided to advance without the ID. If this creates a hole in `tweetIds`, the reply chain breaks.
**How to avoid:** Always use the `posted` count (not `tweetIds.length`) as the resume index. When Error 187 recovery fails, still increment `posted` count and push a sentinel (e.g., empty string) to tweetIds to maintain array alignment, or use `lastPostedId` for the reply chain.
**Warning signs:** Reply chain breaks -- tweets appear as standalone instead of thread continuations.

### Pitfall 4: publish-post Idempotency Check Blocks Resume
**What goes wrong:** The existing idempotency check in `publish-post.ts` (line 89) rejects posts not in `["scheduled", "retry"]` status. A `partially_posted` post would be rejected.
**Why it happens:** The status filter doesn't include the new `partially_posted` status.
**How to avoid:** Add `"partially_posted"` to the allowed statuses in the idempotency check.
**Warning signs:** Retries for partially posted threads are silently skipped with `invalid_status_partially_posted`.

### Pitfall 5: threadProgress Already Exists As String But Schema Types Differ
**What goes wrong:** `PostMetadata.threadProgress` in `schema.ts` is typed as `string` (stringified JSON), while the Zod schema in `x.handler.ts` parses it as an object. There's also a separate `PostMetadata` in `core/types/index.ts` with `threadTweetIds?: string[]`.
**Why it happens:** Two PostMetadata definitions exist -- one in `schema.ts` and one in `types/index.ts`. They have overlapping but different fields.
**How to avoid:** Use the `schema.ts` `PostMetadata` as the single source of truth (it's the DB-facing type). The `threadProgress` field is already `string` there. Parse with Zod on read, stringify on write.
**Warning signs:** TypeScript errors when mixing the two PostMetadata types.

## Code Examples

### Complete Per-Tweet Checkpoint Flow
```typescript
// Source: Trigger.dev docs (retry.onThrow) + existing x.handler.ts pattern
import { retry, logger, AbortTaskRunError } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { posts } from "../../core/db/schema.ts";
import { XApiError } from "../x/types.ts";

// Inside XHandler.postThread() loop:
for (let i = startIndex; i < tweets.length; i++) {
  const tweetText = tweets[i];
  if (!tweetText) continue;

  let tweetId: string;

  try {
    const result = await retry.onThrow(
      async () => {
        return await client.createTweet({
          text: tweetText,
          replyToId: i > 0 ? tweetIds[i - 1] : undefined,
          mediaIds: mediaIdsPerTweet[i],
        });
      },
      { maxAttempts: 3, minTimeoutInMs: 1000, factor: 2 }
    );
    tweetId = result.id;
  } catch (error) {
    if (isDuplicateError(error)) {
      // Error 187 equivalent: try to recover tweet ID
      const recoveredId = await recoverTweetId(client, tweetText);
      if (recoveredId) {
        tweetId = recoveredId;
        logger.info("Recovered duplicate tweet ID", { postId, tweetIndex: i, recoveredId });
      } else {
        // Advance without ID per user decision
        tweetId = "";
        logger.warn("Duplicate detected but could not recover tweet ID", { postId, tweetIndex: i });
      }
    } else if (error instanceof RateLimitError && error.rateLimit) {
      // Wait for rate limit cooldown, then retry same tweet
      await wait.until({ date: error.rateLimit.resetAt });
      i--;
      continue;
    } else {
      // Content or network error: checkpoint what we have and halt
      await saveCheckpoint(db, postId, tweetIds, tweets.length, existingMetadata);
      throw error; // Let Trigger.dev task retry handle it
    }
  }

  tweetIds.push(tweetId);

  // Persist checkpoint after each successful tweet
  await retry.onThrow(
    async ({ attempt }) => {
      await saveCheckpoint(db, postId, tweetIds, tweets.length, existingMetadata);
    },
    { maxAttempts: 3, randomize: false }
  );
  // If retry.onThrow exhausts retries, it throws -- halting the thread (per user decision)
}
```

### Error 187 Detection for X API v2
```typescript
// Source: X Developer Community forums, verified against XApiError class in x/types.ts
// X API v2 returns: {"detail":"You are not allowed to create a Tweet with duplicate content.","type":"about:blank","title":"Forbidden","status":403}
// XApiError stores the response body text as `message`

function isDuplicateError(error: unknown): boolean {
  if (error instanceof XApiError && error.statusCode === 403) {
    return error.message.toLowerCase().includes("duplicate content");
  }
  return false;
}
```

### Tweet ID Recovery via User Timeline
```typescript
// Source: XClient.getTimeline() in x/client.ts (already implemented)
// Uses GET /2/users/{id}/tweets -- returns recent tweets reverse-chronologically
// Rate limit: 1500 requests per 15-minute window (v2 user timeline)

async function recoverTweetId(
  client: XClient,
  tweetText: string,
): Promise<string | null> {
  try {
    // Fetch last 10 tweets (thread tweets are very recent)
    const timeline = await client.getTimeline({ maxResults: 10 });
    // Exact text match (tweet content is identical for duplicates)
    const match = timeline.data.find((t) => t.text === tweetText);
    return match?.id ?? null;
  } catch (error) {
    // Recovery is best-effort -- don't let it block the thread
    logger.warn("Failed to recover tweet ID from timeline", { error });
    return null;
  }
}
```

### Checkpoint Save Helper
```typescript
// Surgical JSONB update or full metadata merge
async function saveCheckpoint(
  db: DbConnection,
  postId: string,
  tweetIds: string[],
  totalTweets: number,
  existingMetadata: Record<string, unknown>,
) {
  await db
    .update(posts)
    .set({
      subStatus: "thread_partial",
      updatedAt: new Date(),
      metadata: {
        ...existingMetadata,
        threadProgress: JSON.stringify({
          posted: tweetIds.length,
          total: totalTweets,
          lastPostedId: tweetIds[tweetIds.length - 1] ?? "",
          tweetIds: [...tweetIds],
        }),
      },
    })
    .where(eq(posts.id, postId));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X API v1.1 error code 187 | X API v2 HTTP 403 with "duplicate content" detail string | X API v2 migration (2023+) | Must parse body text, not numeric error code |
| `statuses/user_timeline` (v1.1) | `GET /2/users/{id}/tweets` (v2) | v1.1 deprecated | Already using v2 in XClient.getTimeline() |
| Manual retry loops | `retry.onThrow` from Trigger.dev SDK | Trigger.dev v3 | Cleaner, integrates with task logging and backoff |

**Deprecated/outdated:**
- X API v1.1 error code 187: Replaced by v2 HTTP 403 with detail string. Do not check for numeric code 187.
- `twitter-text` npm package: Unmaintained 6+ years. Project uses custom `tweet-validator.ts` (Phase 26 decision).

## Open Questions

1. **X API v2 403 false positives for duplicate detection**
   - What we know: Multiple developers report X API v2 returning 403 "duplicate content" even when content is new, and sometimes the tweet IS posted despite the error response.
   - What's unclear: Whether the false positive rate affects thread publishing in practice.
   - Recommendation: Treat 403 duplicate as "tweet was posted" (optimistic). The user timeline recovery lookup will confirm. If recovery fails, advance without ID (per user decision). This handles both true duplicates and false positives correctly.

2. **Exact text match for tweet ID recovery**
   - What we know: X may modify tweet text (e.g., URL shortening with t.co). If a tweet contains URLs, the text returned by the API may differ from what was submitted.
   - What's unclear: Whether t.co URL wrapping happens before or after the duplicate check.
   - Recommendation: Use a normalized comparison (trim whitespace, ignore t.co differences) for the timeline text match. If no match found, fall back to advancing without ID.

3. **Two PostMetadata definitions**
   - What we know: `schema.ts` has `PostMetadata` with `threadProgress?: string` and `core/types/index.ts` has `PostMetadata` with `threadTweetIds?: string[]`. These overlap.
   - What's unclear: Which one the orchestrator and handler should use consistently.
   - Recommendation: Use `schema.ts` PostMetadata as the single source of truth (it has the DB-facing JSONB structure). The `threadProgress` field is already there as a string. If the types/index.ts version needs updating, align it.

## Sources

### Primary (HIGH confidence)
- X handler source: `src/platforms/handlers/x.handler.ts` -- existing postThread logic with threadProgress parsing
- DB schema source: `src/core/db/schema.ts` -- PostMetadata interface with threadProgress field
- Trigger.dev docs (retry.onThrow): https://trigger.dev/docs/errors-retrying
- Trigger.dev docs (wait): https://trigger.dev/docs/wait-until
- Trigger.dev docs (AbortTaskRunError): https://trigger.dev/docs/errors-retrying

### Secondary (MEDIUM confidence)
- X Developer Community -- Error 187 / duplicate content: https://devcommunity.x.com/t/api-error-code-187-status-is-a-duplicate-should-return-the-existing-status-id/10773
- X API v2 403 duplicate format: https://devcommunity.x.com/t/403-detail-you-are-not-allowed-to-create-a-tweet-with-duplicate-content-type-about-blank-title-forbidden-status-403/220207
- X API response codes: https://docs.x.com/x-api/fundamentals/response-codes-and-errors
- X API user tweets endpoint: https://docs.x.com/x-api/users/get-posts

### Tertiary (LOW confidence)
- X API false positive duplicate errors: Community reports of tweets posting despite 403 response. Multiple sources agree but no official acknowledgment from X. Treat as known edge case.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, patterns verified against Trigger.dev docs
- Architecture: HIGH -- existing codebase already has 60-70% of the infrastructure (threadProgress field, startIndex resume, postThread method)
- Pitfalls: HIGH -- X API v2 error format verified across multiple community sources; PostMetadata dual-definition found in codebase inspection

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable domain, X API v2 is mature)
