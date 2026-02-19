# Plan 06-02 Summary: Multi-Platform Dispatch, Format Picker, Analytics

## Status: Complete

## What Was Built

### Task 1: Multi-Platform Publish-Post with Partial Failure Isolation
- **`src/trigger/publish-post.ts`** — Refactored from single-platform (X only) to multi-platform dispatch. publishToPlatform dispatcher routes to publishToX or publishToLinkedIn. Each platform publishes independently with try/catch. Overall status: "published" if ANY platform succeeded, "failed" if ALL failed. Partial failure tracked via subStatus "partial_failure". Per-platform status stored in post.metadata.platformStatus
- **`src/core/types/index.ts`** — Added PlatformPublishResult, PlatformStatus interfaces. Extended PostMetadata with platformStatus, multiPlatformGroupId, linkedinFormat, format, topic, pillar fields. Backward compatible when targetPlatforms not provided

### Task 2: LinkedIn Format Picker, Content Adaptation
- **`src/content/format-picker.ts`** — Added "long-post" (3000 max chars, optimal 1000-1300) and "linkedin-article" PostFormat types. Added PLATFORM_FORMAT_SUPPORT map. Enhanced pickFormatLinkedIn with LinkedIn-specific keyword matching: lists/steps/frameworks -> carousel, stories -> long-post, external links -> linkedin-article, quotes -> quote-image, hot takes -> long-post
- **`src/content/generate.ts`** — Added LINKEDIN_CONTENT_GUIDANCE and X_CONTENT_GUIDANCE constants. Added adaptContentForPlatform function for X<->LinkedIn content adaptation (expand for LinkedIn, condense for X)
- **`src/planning/types.ts`** — Added targetPlatforms field to PlanSlot for multi-platform weekly plan slots

### Task 3: LinkedIn Analytics Collection
- **`src/analytics/types.ts`** — Added LinkedInMetrics and XMetrics interfaces with platform discriminator. Added PlatformMetrics union type. Re-exports LinkedIn analytics types
- **`src/analytics/collector.ts`** — Added collectLinkedInAnalytics function with LinkedIn-weighted engagement scoring (reshares:4, comments:3, reactions:1). Same tiered cadence pattern as X. Per-post error isolation
- **`src/trigger/analytics-collector.ts`** — Extended to collect both X and LinkedIn analytics independently. LinkedIn failure does NOT prevent X collection. LinkedIn skipped silently if not configured

## Truths Verified
1. User can generate and post LinkedIn content (text, image, carousel) adapted to LinkedIn format strengths
2. Multi-platform posting dispatches independently per platform with partial failure isolation
3. LinkedIn failure does not block X posting -- each platform publishes independently
4. Analytics collector pulls LinkedIn metrics (impressions, reactions, comments, reshares) daily
5. Format picker recommends LinkedIn-appropriate formats (carousel for lists, long-form for stories)
6. Per-platform publish status is visible on each post record

## Commits
- `75889cd` feat(06-02): multi-platform dispatch, LinkedIn format picker, and analytics
