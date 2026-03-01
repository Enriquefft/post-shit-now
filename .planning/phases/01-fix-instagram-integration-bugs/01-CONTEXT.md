# Phase 1: Fix Instagram Integration Bugs - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning
**Source:** Codebase audit (conversation)

<domain>
## Phase Boundary

Fix the bugs and gaps that prevent Instagram from working end-to-end. After this phase, a user who completes Instagram OAuth setup should be able to publish posts (image, reel, carousel), collect analytics, and have engagement discovery work — matching X's level of functionality for core flows.

</domain>

<decisions>
## Implementation Decisions

### accountId Metadata Key Fix
- `setup-instagram-oauth.ts:185` stores account ID as `userId` in token metadata
- `instagram.handler.ts:83`, `analytics-collector.ts:318`, `engagement-monitor.ts:88` all read `accountId`
- Fix: change the setup file to store as `accountId` (matches all consumers)
- Also add a migration/compatibility shim for any existing tokens that have `userId`

### OAuth Callback URL
- Currently hardcoded to `https://example.com/callback` in `setup-instagram-oauth.ts:9`
- Should use the same `127.0.0.1:18923` pattern as X OAuth (already built and validated in v1.3)
- Reuse `src/cli/oauth-callback-server.ts` infrastructure

### Rate Limit Propagation
- `InstagramHandler.currentRateLimit` declared at line 28 but never set
- `getRateLimitInfo()` always returns null, `isRateLimited()` always returns false
- Instagram API doesn't return rate limit headers like X does — use self-counting approach
- Track requests against 200/hr budget in the handler, update `currentRateLimit` after each API call

### Handler Tests
- X has 8 handler test scenarios in `x.handler.test.ts`
- Instagram has only a constructor smoke test in `clients.test.ts:83-88`
- Need tests covering: single image publish, reel publish, carousel publish, rate limit behavior, error handling
- Use same class-boundary mock pattern as X (validated in v1.3)

### Claude's Discretion
- Whether to add Instagram-specific content validation (caption length, hashtag limits)
- Whether to wire `postComment()` to engagement flow (nice-to-have, not blocking)
- Whether to add follower count tracking via `getMe()` (nice-to-have, not blocking)

</decisions>

<specifics>
## Specific Details

### Files That Need Changes
- `src/cli/setup-instagram-oauth.ts` — accountId key fix + callback URL
- `src/platforms/handlers/instagram.handler.ts` — rate limit tracking
- `src/platforms/__mocks__/clients.ts` — expand MockInstagramClient
- New test file for Instagram handler

### Existing Infrastructure to Reuse
- OAuth callback server: `src/cli/oauth-callback-server.ts` (built for X in v1.3)
- Test patterns: `src/platforms/handlers/__tests__/x.handler.test.ts`
- Mock patterns: `src/platforms/__mocks__/clients.ts` (MockXClient as template)

### Key API Details
- Instagram Graph API base: `https://graph.instagram.com`
- Auth base: `https://api.instagram.com`
- Rate limit: 200 requests/hour (self-tracked, no response headers)
- Container-based publishing: create → poll status → publish (async workflow)

</specifics>

<deferred>
## Deferred Ideas

- Wire `postComment()` to engagement session for Instagram reply posting
- Add follower count tracking via `getMe()` endpoint
- Instagram-specific content validation (caption length 2200 chars, 30 hashtags max)
- Account-level insights collection (`getAccountInsights()`)

</deferred>

---
*Phase: 01-fix-instagram-integration-bugs*
*Context gathered: 2026-02-28 via codebase audit*
