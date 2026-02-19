---
phase: 08-instagram-tiktok-and-engagement
plan: 01
subsystem: api
tags: [instagram, oauth, graph-api, container-publishing, hashtags, rate-limiting]

# Dependency graph
requires:
  - phase: 06-linkedin-and-multi-platform
    provides: "LinkedIn OAuth/client patterns, token-refresher cron, multi-platform dispatch"
  - phase: 01-foundation-and-infrastructure
    provides: "DB schema (oauth_tokens), encryption utils, CLI setup pattern"
provides:
  - "Instagram OAuth direct login flow (auth URL, code exchange, 60-day token refresh)"
  - "InstagramClient typed Graph API client with rate limit tracking"
  - "Container-based media publishing (feed images, carousels 2-10, Reels)"
  - "Hashtag pool manager with 30-search/week budget tracking"
  - "Token refresher Instagram 60-day lifecycle support"
affects: [08-03-multi-platform-dispatch, 08-05-engagement-automation]

# Tech tracking
tech-stack:
  added: []
  patterns: [container-based-publishing, access-token-refresh-without-refresh-token, hashtag-budget-tracking]

key-files:
  created:
    - src/platforms/instagram/types.ts
    - src/platforms/instagram/oauth.ts
    - src/platforms/instagram/client.ts
    - src/platforms/instagram/media.ts
    - src/platforms/instagram/hashtags.ts
    - src/cli/setup-instagram-oauth.ts
  modified:
    - src/cli/setup.ts
    - src/trigger/token-refresher.ts

key-decisions:
  - "Instagram OAuth uses raw fetch (no Arctic provider available) for direct login flow"
  - "Instagram has no refresh tokens -- access token itself is refreshed via ig_refresh_token grant"
  - "Container status polling every 5s with max 60 attempts (5 min timeout)"
  - "Hashtag pool cached locally in content/cache/hashtag-pool.json with 7-day rolling budget window"
  - "Default 15 hashtags per post (Instagram allows 30, use half for safety)"

patterns-established:
  - "Container workflow: create container -> poll status -> publish when FINISHED"
  - "Access token refresh without refresh token (Instagram-specific, differs from X and LinkedIn)"
  - "Budget-tracked API usage with rolling window reset"

requirements-completed: [AUTH-03, PLAT-03]

# Metrics
duration: 4min
completed: 2026-02-19
---

# Phase 08 Plan 01: Instagram Platform Module Summary

**Instagram Graph API integration with direct login OAuth, container-based media publishing (feed/carousel/Reels), and hashtag pool with 30-search/week budget tracking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T16:09:15Z
- **Completed:** 2026-02-19T16:14:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Instagram OAuth direct login flow with short-to-long-lived token exchange and 60-day refresh
- InstagramClient with typed Graph API access, rate limit tracking (200 req/hr), and full method coverage
- Container-based publishing for feed images, carousels (2-10 items), and Reels with polling
- Hashtag pool manager with local caching and 30-search/week budget enforcement
- Token refresher extended with Instagram-specific path (no refresh token, access token self-refresh)
- Setup CLI integrated with optional skip pattern matching LinkedIn

## Task Commits

Each task was committed atomically:

1. **Task 1: Instagram OAuth, types, and setup CLI** - `b11cea4` (feat)
2. **Task 2: Instagram client, media containers, and hashtag pool** - `0249475` (feat)

## Files Created/Modified
- `src/platforms/instagram/types.ts` - Zod schemas, error classes, rate limit constants
- `src/platforms/instagram/oauth.ts` - Direct login OAuth flow (auth URL, code exchange, token refresh)
- `src/platforms/instagram/client.ts` - Typed Graph API client with rate limit tracking
- `src/platforms/instagram/media.ts` - Container creation, polling, and publishing for images/carousels/Reels
- `src/platforms/instagram/hashtags.ts` - Hashtag pool with budget tracking and local caching
- `src/cli/setup-instagram-oauth.ts` - Setup CLI step with optional skip pattern
- `src/cli/setup.ts` - Added Instagram OAuth step after LinkedIn
- `src/trigger/token-refresher.ts` - Extended with Instagram 60-day token lifecycle

## Decisions Made
- Instagram OAuth uses raw fetch since Arctic does not have a native Instagram provider
- Instagram does not use refresh tokens -- the access token itself is refreshed via ig_refresh_token grant type, unlike X (one-time-use refresh) and LinkedIn (reusable refresh)
- Container status polling uses 5-second intervals with max 60 attempts (5 min timeout), matching the LinkedIn waitForMediaReady pattern
- Hashtag pool uses local file cache (content/cache/hashtag-pool.json) with 7-day rolling window for budget tracking
- Default 15 hashtags per post selection (Instagram allows 30, using half for safety margin)
- Carousel validation enforces 2-10 images as required by Instagram API

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** Users need:
- INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET from Meta Developer Portal
- Meta App with Instagram Platform API product enabled
- Scopes: instagram_business_basic, instagram_business_content_publish
- OAuth redirect URL set to https://example.com/callback

## Next Phase Readiness
- Instagram platform module complete, ready for Plan 08-03 multi-platform dispatch integration
- Token refresher handles all three platforms (X, LinkedIn, Instagram)
- Container-based publishing ready for content generation pipeline

---
*Phase: 08-instagram-tiktok-and-engagement*
*Completed: 2026-02-19*
