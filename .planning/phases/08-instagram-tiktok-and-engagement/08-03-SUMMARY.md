---
phase: 08-instagram-tiktok-and-engagement
plan: 03
subsystem: api
tags: [instagram, tiktok, analytics, publishing, content-generation, multi-platform]

requires:
  - phase: 08-01
    provides: "Instagram client, media container workflow, hashtag pool"
  - phase: 08-02
    provides: "TikTok client, chunked video upload, photo posting"
  - phase: 06-02
    provides: "Multi-platform dispatch pattern, format picker, analytics collector"
provides:
  - "Instagram and TikTok analytics collection with tiered cadence"
  - "Multi-platform dispatch publishing to all 4 platforms"
  - "Instagram and TikTok content generation guidance"
  - "Enriched format picker with keyword-based Instagram/TikTok format selection"
affects: [08-04, 08-05]

tech-stack:
  added: []
  patterns:
    - "Per-platform analytics rate limit budgeting (50 req/hr for Instagram)"
    - "TikTok video.list inline metrics collection (no separate insights call)"
    - "Instagram container workflow in publish dispatch (create -> poll -> publish)"
    - "TikTok SELF_ONLY enforcement for unaudited apps in publish path"
    - "Platform-specific content guidance constants (INSTAGRAM_CONTENT_GUIDANCE, TIKTOK_CONTENT_GUIDANCE)"

key-files:
  created: []
  modified:
    - src/analytics/collector.ts
    - src/trigger/analytics-collector.ts
    - src/trigger/publish-post.ts
    - src/content/generate.ts
    - src/content/format-picker.ts

key-decisions:
  - "Instagram analytics budget: 50 req/hr from 200/hr total (conservative allocation for analytics)"
  - "TikTok metrics via video.list inline (more efficient than separate per-video insights)"
  - "Instagram engagement weights: shares(4) > saved(3) > comments(2) > likes(1)"
  - "TikTok engagement weights: shares(4) > comments(2) > likes(1)"
  - "Instagram format default: Reels (30.81% reach rate beats static posts)"
  - "TikTok format default: video (algorithm strongly favors video content)"
  - "Instagram reach stored in userProfileClicks column (reusing existing schema)"

patterns-established:
  - "Platform-specific CONTENT_GUIDANCE constants for voice prompt injection"
  - "Keyword sets per platform for format auto-selection"
  - "adaptContentForPlatform extended with Instagram and TikTok conversions"

requirements-completed: [ANLYT-03, ANLYT-04, POST-03, POST-04]

duration: 6min
completed: 2026-02-19
---

# Phase 8 Plan 3: Multi-Platform Pipeline Integration Summary

**Instagram and TikTok wired into analytics collection, publish dispatch, content brain, and format picker -- all 4 platforms now first-class**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-19T16:17:57Z
- **Completed:** 2026-02-19T16:24:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Daily analytics collector pulls Instagram metrics (impressions, reach, likes, comments, shares, saved) and TikTok metrics (views, likes, comments, shares) with per-platform error isolation
- Multi-platform dispatch publishes to Instagram (container workflow: create -> poll -> publish) and TikTok (chunked video upload / photo posting) with partial failure isolation
- Content brain injects Instagram-specific guidance (2200-char caption, hashtag strategy, Reels bias) and TikTok-specific guidance (video script hook/body/CTA format, 90-char title)
- Format picker enriched with keyword sets for Instagram (reel/carousel/quote-image) and TikTok (video/photo) with content analysis-based auto-selection

## Task Commits

Each task was committed atomically:

1. **Task 1: Instagram and TikTok analytics collection** - `a3bbac3` (feat)
2. **Task 2: Multi-platform publish dispatch and content generation** - `62e861d` (feat)

## Files Created/Modified
- `src/analytics/collector.ts` - Added collectInstagramAnalytics and collectTikTokAnalytics with tiered cadence and engagement scoring
- `src/trigger/analytics-collector.ts` - Extended daily cron with Instagram and TikTok collection blocks, token refresh handling
- `src/trigger/publish-post.ts` - Added publishToInstagram (container workflow) and publishToTikTok (chunked upload/photos) with rate limit handling
- `src/content/generate.ts` - Added INSTAGRAM_CONTENT_GUIDANCE and TIKTOK_CONTENT_GUIDANCE constants, extended buildVoicePromptContext and adaptContentForPlatform
- `src/content/format-picker.ts` - Enriched pickFormatInstagram with reel/carousel/quote keywords and Reels bias, enriched pickFormatTikTok with video/photo keywords

## Decisions Made
- Instagram analytics budgeted at 50 req/hr (from 200/hr total) to leave room for publishing and other operations
- TikTok video.list returns metrics inline, so no separate per-video insights calls needed (more efficient than Instagram pattern)
- Instagram engagement weights: shares(4) > saved(3) > comments(2) > likes(1) -- saved is high-signal on Instagram
- TikTok engagement weights: shares(4) > comments(2) > likes(1) -- views used as impression equivalent
- Instagram reach stored in userProfileClicks column to reuse existing postMetrics schema without migration
- Default Instagram format biased toward Reels (30.81% reach rate, 55% views from non-followers)
- Default TikTok format is always video (algorithm strongly favors video content)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Instagram token refresh return type mismatch**
- **Found during:** Task 1
- **Issue:** refreshInstagramToken returns `expiresIn` (seconds), not `expiresAt` (Date) -- analytics collector used wrong property
- **Fix:** Computed expiresAt from expiresIn: `new Date(Date.now() + refreshed.expiresIn * 1000)`
- **Files modified:** src/trigger/analytics-collector.ts
- **Verification:** npx tsc --noEmit passes
- **Committed in:** a3bbac3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type mismatch fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 platforms (X, LinkedIn, Instagram, TikTok) now have analytics collection, publish dispatch, and content generation support
- Ready for 08-04 (engagement features) and 08-05 (final integration)

---
*Phase: 08-instagram-tiktok-and-engagement*
*Completed: 2026-02-19*
