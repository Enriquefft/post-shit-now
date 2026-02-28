# Phase 28: Thread Publishing Resilience - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Make thread posting recoverable. Persist tweet IDs per-tweet as a checkpoint, resume from the last checkpoint on retry, and handle X duplicate errors (Error 187) gracefully. No lost tweet IDs, no duplicate tweets on retry.

Requirements: THREAD-01, THREAD-02, THREAD-03, THREAD-04. Zero database migrations — uses existing posts table metadata JSONB column.

</domain>

<decisions>
## Implementation Decisions

### Checkpoint persistence strategy
- Persist tweet IDs to DB immediately after each successful tweet (not batch at end)
- Store checkpoint in existing posts table metadata JSONB column (no new table, no migration)
- Checkpoint data: posted tweet IDs array + count only (no content hashes)
- If checkpoint DB write fails: retry 2-3 times, halt thread if retries exhausted (losing a tweet ID is worse than a shorter thread)

### Resume-from-checkpoint UX
- Retries triggered automatically via Trigger.dev's built-in retry with backoff (no user action needed)
- Partially-posted threads show distinct "partially_posted" status with progress (e.g., "3/7 tweets posted")
- Notify user only on final failure (after all Trigger.dev retries exhausted) — silent retries for transient issues
- No re-validation of remaining tweets on resume — Phase 26 validates all tweets upfront, content hasn't changed

### Duplicate detection (Error 187)
- React to Error 187 only — no proactive pre-check against checkpoint before posting
- Error 187 on retry treated as success: attempt to find existing tweet ID via API lookup, advance checkpoint
- If Error 187 but can't find existing tweet ID: advance without ID, log warning, continue posting rest of thread
- No time limit on retries — threads are time-sensitive content, edge cases not worth engineering around

### Failure boundary design
- Rate limit mid-thread: wait for cooldown (from X rate limit headers), then resume in same attempt
- Content error mid-thread: halt immediately, checkpoint what's posted (don't skip — threads need continuity)
- Network error mid-thread: retry the specific tweet 2-3 times inline, then halt and let Trigger.dev retry
- Final state after all retries exhausted: "partially_posted" with checkpoint preserved — user can manually retry later or accept partial thread

### Claude's Discretion
- Exact retry backoff timing for inline network retries
- How to look up existing tweet ID when Error 187 occurs (search API, user timeline, etc.)
- Thread progress metadata JSONB structure details
- Trigger.dev retry configuration (max attempts, backoff curve)

</decisions>

<specifics>
## Specific Ideas

- Checkpoint write failure halts the thread because losing tweet IDs is worse than posting a shorter thread
- "partially_posted" is a distinct status from "failed" — it communicates recoverable state
- Error 187 handling is the key to making retries idempotent — treat "already posted" as success
- Phase 26 pre-validation means resume logic can skip re-validation entirely

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-thread-publishing-resilience*
*Context gathered: 2026-02-27*
