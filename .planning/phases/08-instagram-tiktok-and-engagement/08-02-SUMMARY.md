---
phase: 08-instagram-tiktok-and-engagement
plan: 02
subsystem: api
tags: [tiktok, oauth, arctic, pkce, content-posting, chunked-upload, creative-center]

requires:
  - phase: 02-x-api-foundation
    provides: "OAuth pattern via Arctic, token-refresher cron, setup CLI pattern"
  - phase: 06-linkedin-and-multi-platform
    provides: "Multi-platform OAuth pattern, LinkedInClient pattern for typed API clients"
  - phase: 08-01
    provides: "Instagram OAuth pattern, token-refresher extension pattern"
provides:
  - "TikTok OAuth via Arctic with PKCE (auth URL, code exchange, token refresh with rotation)"
  - "TikTokClient with typed Content Posting API access"
  - "Chunked video upload with Content-Range headers (5MB-64MB chunks)"
  - "Photo posting via URL pull (up to 35 images)"
  - "Creative Center trending content discovery (free tier)"
  - "Token refresher TikTok lifecycle management"
affects: [08-03-multi-platform-dispatch, 08-04-engagement, analytics]

tech-stack:
  added: []
  patterns: [tiktok-audit-status-tracking, draft-only-mode-for-unaudited, creative-center-scraping]

key-files:
  created:
    - src/platforms/tiktok/types.ts
    - src/platforms/tiktok/oauth.ts
    - src/platforms/tiktok/client.ts
    - src/platforms/tiktok/media.ts
    - src/platforms/tiktok/creative-center.ts
    - src/cli/setup-tiktok-oauth.ts
  modified:
    - src/cli/setup.ts
    - src/trigger/token-refresher.ts

key-decisions:
  - "Arctic TikTok provider with PKCE for OAuth (same pattern as X, unlike LinkedIn which is state-only)"
  - "TikTok refresh tokens rotate on each refresh -- both new access and refresh tokens must be stored"
  - "Unaudited apps forced to SELF_ONLY privacy level (draft-only mode) with clear user communication"
  - "Creative Center scraping uses graceful degradation (empty arrays on failure, never crashes)"
  - "TikTok token refresh window is 1 day (same as X, different from LinkedIn/Instagram 7-day window)"

patterns-established:
  - "TikTok audit status tracking in token metadata (auditStatus field)"
  - "Privacy level resolution based on audit status (unaudited -> SELF_ONLY)"
  - "Creative Center as free fallback for trend discovery (EnsembleData as paid upgrade path)"

requirements-completed: [AUTH-04, PLAT-04]

duration: 6min
completed: 2026-02-19
---

# Phase 8 Plan 2: TikTok Platform Module Summary

**TikTok Content Posting API via Arctic PKCE OAuth, chunked video upload, photo URL posting, and Creative Center trend discovery with draft-only mode for unaudited apps**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T16:09:14Z
- **Completed:** 2026-02-19T16:15:21Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- TikTok OAuth via Arctic with PKCE flow (auth URL generation, code exchange, token refresh with rotation)
- TikTokClient with typed API access: user info, video list, video upload init, photo posting, comments, publish status
- Chunked video upload with sequential PUT requests and Content-Range headers (5MB-64MB chunks)
- Photo posting via URL pull with 35-image limit and auto-clamped title/description
- Creative Center scraper for free trending topics and videos with graceful degradation
- Token refresher extended with TikTok lifecycle (1-day refresh window, rotating refresh tokens)
- Setup CLI with optional TikTok auth step and unaudited mode warning

## Task Commits

Each task was committed atomically:

1. **Task 1: TikTok OAuth, types, and setup CLI** - `ae89756` (feat)
2. **Task 2: TikTok client, chunked upload, photo posting, and Creative Center** - `81ec838` (feat)

## Files Created/Modified
- `src/platforms/tiktok/types.ts` - Zod schemas, error classes, privacy levels, content limits, audit status type
- `src/platforms/tiktok/oauth.ts` - Arctic TikTok OAuth with PKCE (createClient, authUrl, exchange, refresh)
- `src/platforms/tiktok/client.ts` - Typed TikTok API client with SELF_ONLY enforcement for unaudited apps
- `src/platforms/tiktok/media.ts` - Chunked video upload, photo posting, publish status polling
- `src/platforms/tiktok/creative-center.ts` - Free trending topics/videos via Creative Center public data
- `src/cli/setup-tiktok-oauth.ts` - TikTok OAuth setup step with PKCE and audit status tracking
- `src/cli/setup.ts` - Added TikTok setup step after Instagram (optional, skips gracefully)
- `src/trigger/token-refresher.ts` - Added TikTok token refresh with rotation support

## Decisions Made
- Arctic TikTok provider uses PKCE (createAuthorizationURL takes state, codeVerifier, scopes) -- same as X pattern
- TikTok rotates refresh tokens on each refresh (like X, unlike LinkedIn) -- both must be stored
- Unaudited apps forced to SELF_ONLY visibility (draft-only mode) with clear messaging in setup CLI
- Creative Center uses simple fetch-based scraping with graceful degradation (empty arrays on failure)
- Token refresh window set to 1 day before expiry (conservative, matching X pattern)
- TikTok callback URL follows existing pattern: https://example.com/callback

## Deviations from Plan

None - plan executed exactly as written. Token refresher already had TikTok support from 08-01 execution (pre-existing, not a deviation).

## Issues Encountered

None.

## User Setup Required

TikTok requires developer portal configuration:
1. Create app at https://developers.tiktok.com -> Manage Apps -> Create
2. Enable scopes: user.info.basic, video.list, video.publish, video.upload
3. Set OAuth redirect URL to https://example.com/callback
4. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to config/keys.env
5. (Optional) Submit for API audit -- without audit, posts are draft-only (SELF_ONLY visibility)

## Next Phase Readiness
- TikTok platform module complete -- ready for multi-platform dispatch wiring in Plan 08-03
- All 4 platforms (X, LinkedIn, Instagram, TikTok) now have OAuth + API clients
- Token refresher handles all 4 platform lifecycles

---
*Phase: 08-instagram-tiktok-and-engagement*
*Completed: 2026-02-19*
