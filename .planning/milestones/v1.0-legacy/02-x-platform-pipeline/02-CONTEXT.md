# Phase 2: X Platform Pipeline - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

OAuth 2.0 PKCE for X, encrypted token storage with race-condition-safe refresh, X API client with rate limit awareness, post scheduling via Trigger.dev delayed runs, thread support, media uploads, retry handling, and failure tracking. Voice profiling, content generation, analytics, and multi-platform support are separate phases.

</domain>

<decisions>
## Implementation Decisions

### OAuth Flow UX
- Manual URL + paste flow: CLI prints the X authorization URL, user opens browser, authorizes, gets redirected to a page showing the authorization code, pastes it back into CLI
- No local callback server — works everywhere without port access concerns
- On re-run (`/psn:setup`): check if existing token is valid, skip OAuth if it works. Only re-auth when token is expired/invalid
- OAuth is a step within `/psn:setup`, not a separate command. Setup's resume-from-failure handles re-auth scenarios
- Guide user through X Developer Portal app creation (step-by-step instructions for creating app, setting callback URLs, getting client ID/secret) — but skip if credentials already exist in config

### Post Scheduling Behavior
- Config-based timezone: user sets timezone once in `config/hub.env` or during setup. All times interpreted and displayed in that timezone. Stored as UTC internally
- Users can both edit and cancel scheduled posts. Editing cancels the Trigger.dev delayed run and creates a new one with updated content
- "Post now" option available — publishes immediately via Trigger.dev (not forced through scheduler delay)
- No queue visibility command in Phase 2. Users wait for `/psn:calendar` in Phase 7. Post confirmation after scheduling is sufficient

### Thread Composition
- Single text input with auto-split: user writes one continuous text, system splits at 280 chars respecting sentence/paragraph boundaries
- Feedback loop: after auto-split, show full thread preview (numbered tweets with char counts). User can adjust split points, edit individual tweets, or approve
- No hard limit on thread length. Warn above 7 tweets but don't block
- Full preview before posting: each tweet numbered (1/n), character count shown, user approves entire thread

### Thread Partial Failure
- Retry inline: if a tweet in a thread fails, retry up to 3x with exponential backoff before stopping
- Only stop and notify if all retries for a tweet are exhausted
- Record which tweets posted successfully so user can resume from the failure point

### Failure & Notification UX
- DB status only for Phase 2 (no email, no WhatsApp yet). User discovers failures next time they interact with PSN
- Posts surfaced when relevant (e.g., `/psn:post` shows recent failures in the preamble)
- Rate limit hits are visible: post record notes "delayed by rate limit" in status. Not silent — user should know
- Detailed post statuses in DB: `draft → scheduled → publishing → published/failed` with sub-statuses (`retry_1`, `retry_2`, `retry_3`, `rate_limited`, `media_uploading`, `media_uploaded`, `thread_partial`)

### Post Final Failure Handling
- Claude's discretion: after 3 retries exhausted, mark as failed and preserve content for easy manual retry or reschedule

### Claude's Discretion
- Arctic library integration details for X OAuth 2.0 PKCE
- X API client architecture (typed client with rate limit tracking)
- Trigger.dev delayed run management (create, cancel, re-create on edit)
- Media upload pipeline (register → upload → attach flow for X)
- Token refresh task scheduling and row-level locking implementation
- Token encryption key management (reuse Phase 1 crypto utils)
- DB schema additions for Phase 2 (posts table expansion, thread tracking)

</decisions>

<specifics>
## Specific Ideas

- X pay-per-use API (Jan 2026): $0.01/post, $0.005/read — cost is negligible, no need to batch aggressively
- Thread auto-split should respect sentence boundaries, not just character count. Never split mid-word or mid-sentence
- User explicitly wants feedback loop on thread splits — not fire-and-forget auto-splitting
- "Post now" is a real option, not a schedule-with-zero-delay hack

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-x-platform-pipeline*
*Context gathered: 2026-02-19*
