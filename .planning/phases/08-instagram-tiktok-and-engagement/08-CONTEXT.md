# Phase 8: Instagram, TikTok, and Engagement - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete platform coverage by adding Instagram and TikTok posting pipelines (OAuth, media upload, content adaptation), plus a proactive engagement engine that monitors trending content across all enabled platforms and helps users engage strategically with human approval on every interaction.

</domain>

<decisions>
## Implementation Decisions

### Engagement Strategy
- Niche definition: derive topics from voice profile pillars as baseline, plus manual overrides to add/remove keywords
- Monitor all enabled platforms by default, with per-platform toggle to disable engagement monitoring independently
- Daily engagement caps are user-configurable per platform (set during /psn:setup or via config)
- Opportunity scoring: composite score — relevance (40%), recency (30%), reach (20%), engagement potential (10%)
- Runs as a scheduled Trigger.dev task every 2-4 hours, surfaces batched opportunities for review

### Reply Drafting & Interaction
- Full spectrum engagement: comments/replies, quote posts, duets (TikTok), stitches, repost-with-commentary across all platforms
- Voice matching: context-adaptive — match the tone of the thread being replied to while keeping user's voice recognizable
- UX flow: triage-then-draft — first pass: quick yes/no on opportunities; second pass: draft and review replies for approved ones
- Engagement outcomes tracked and fed back into opportunity scoring model (same learning loop pattern as post analytics in Phase 4)

### Instagram Content Handling
- Format selection: Claude auto-picks (Reel, carousel, feed image) based on content analysis, user can override during review
- Reels bias: Claude's discretion based on content type and performance data
- Rate limit budgeting (200 req/hr): Claude's discretion on allocation strategy
- Hashtag strategy: dynamic per post from a cached pool, pool refreshed weekly within the 30-search/week budget

### TikTok Content Strategy
- Video-first: default to video content — TikTok's algorithm strongly favors video
- Audit fallback: draft-only mode until TikTok audit is approved — generate TikTok-optimized content as local drafts, user posts manually
- Monitoring: Creative Center (free) as default, EnsembleData (~$100/mo) available as premium upgrade
- Cross-posting: smart repurpose — repurpose video content (Reels → TikTok), but create text-based content natively per platform

### Claude's Discretion
- Instagram Reels vs carousel vs feed ratio optimization
- Rate limit budget allocation across posting/analytics/engagement
- Exact composite score weights tuning based on platform
- Engagement session UX details (batch sizes, triage presentation)
- TikTok chunked upload implementation details

</decisions>

<specifics>
## Specific Ideas

- Engagement ROI tracking feeds back into the same learning loop architecture from Phase 4 — not a separate system
- Triage-then-draft flow keeps engagement sessions fast: quick scan of 10-20 opportunities, then focus on the 3-5 worth engaging with
- Smart repurpose for video (IG Reels → TikTok) maximizes content ROI without making platforms feel like carbon copies
- Draft-only mode for TikTok means the platform is always "ready" in the system — just gated on posting API access

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-instagram-tiktok-and-engagement*
*Context gathered: 2026-02-19*
