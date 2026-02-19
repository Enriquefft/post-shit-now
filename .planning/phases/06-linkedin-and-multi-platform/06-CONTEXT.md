# Phase 6: LinkedIn and Multi-Platform — Context

Created: 2026-02-19
Phase goal: User can post to LinkedIn in addition to X, with content adapted per platform and failures isolated.

---

## 1. LinkedIn Content Adaptation

### Adaptation strategy
- **User chooses per post**: when posting to multiple platforms, system asks "adapt this or generate fresh?"
- Default suggestion: auto-adapt (system transforms content for LinkedIn norms)
- User can override to independent generation (same topic, independently crafted — like bilingual "both")

### Format support
- All 4 LinkedIn format types supported: **text+image posts, document/carousel posts, polls, articles**
- Format picker (existing from Phase 3) extended to include LinkedIn-specific formats
- Carousels auto-suggested by format picker when content fits (lists, steps, frameworks, how-tos) — not a separate command

### Length and style
- **Platform-native length**: LinkedIn posts expand to 1000-1300 chars with hooks, storytelling, CTAs
- NOT a copy of X content padded out — genuinely adapted to LinkedIn conventions
- Voice profile's existing tone/style applies; length and structure adapt per platform

---

## 2. Multi-Platform Posting Flow

### Platform targeting
- **Default from strategy.yaml + Claude suggests + user override**
- strategy.yaml defines default platform targets per pillar/format combination
- Claude suggests based on content type and strategy context
- User can always override (add/remove platforms) per post

### Scheduling
- **Platform-optimal stagger**: system automatically staggers posts across platforms based on each platform's optimal posting times
- Not simultaneous — each platform gets its best time slot within the posting window
- User can override to force same-time if desired

### `/psn:post` UX flow
- **Generate-then-branch**: generate core content first, then show platform-specific previews for each target
- User reviews and edits each platform version independently
- Can approve some, reject others, edit individually

### Weekly planning integration
- **One slot, multiple platforms**: each plan slot is one content idea that targets N platforms
- Displayed as "Topic X → X, LinkedIn" in the calendar
- Platform-specific adaptations happen at draft time, not planning time

---

## 3. Partial Failure and Retry Behavior

### Isolation model
- **Keep successes, retry failures**: if X publishes but LinkedIn fails, X stays published
- Never roll back a successful platform publish
- Each platform publishes independently — no all-or-nothing coupling

### Retry strategy
- **Auto-retry with backoff + escalate**: 3 automatic retries with exponential backoff (existing watchdog pattern)
- After 3 failed attempts, escalate: notify user for manual intervention
- User can then retry manually or cancel the failed platform post

### Status visibility
- **Per-platform status on post record**: each post shows per-platform state (X ✓, LinkedIn ✗ retry 2/3)
- Queryable via `/psn:post status` or similar command
- Granular enough to see exactly what happened on each platform

### Retry windows
- **Platform-specific windows**: different retry timeouts per platform based on typical outage/rate-limit patterns
- LinkedIn may have longer windows (known for slower API responses and maintenance)
- X has shorter windows (fast API, quick failures)

---

## 4. LinkedIn Token Lifecycle

### Expiry warnings
- **Progressive warnings**: 7 days, 3 days, 1 day before expiry
- Increasing urgency in notification tone
- Warnings surfaced during any command that touches LinkedIn

### Re-authentication
- **Same as initial OAuth**: re-run the browser-based OAuth 2.0 flow (same as `/psn:setup`)
- Familiar flow, no separate command needed
- Tokens stored encrypted in Hub DB (same as X tokens)

### Auto-refresh
- **Auto-refresh when possible**: LinkedIn refresh tokens used automatically via existing token-refresher cron
- Silent operation — user doesn't notice unless refresh fails
- When refresh fails, fall back to prompting user for full re-auth

### Expired token handling
- **Publish attempt + fail gracefully**: system attempts publish even with potentially expired token
- On auth failure, moves to retry queue, notifies user to re-auth
- Other platforms (X) proceed unaffected — partial failure isolation applies

---

## Deferred Ideas

None captured during this discussion.

---

## Summary for Downstream Agents

### Key patterns
- Multi-platform is additive: each platform publishes independently, never blocks another
- Content adaptation is per-post user choice (adapt vs. fresh), with auto-adapt as default suggestion
- Platform targeting comes from strategy.yaml defaults + Claude suggestions + user override
- Staggered scheduling — not simultaneous — respects per-platform optimal times
- Format picker extended with LinkedIn formats (carousel, poll, article) — same selection logic
- Token lifecycle mirrors X pattern: auto-refresh via cron, progressive warnings, same OAuth re-auth flow

### New DB/schema needs
- Posts table needs multi-platform status tracking (per-platform publish state)
- Platform-specific retry windows configuration
- LinkedIn OAuth token storage (same pattern as X)
- LinkedIn analytics storage (same postMetrics pattern, new platform value)

### Existing patterns to extend
- Token refresher cron → add LinkedIn refresh logic
- Format picker → add LinkedIn formats
- publish-post task → multi-platform dispatch with partial failure isolation
- Watchdog → multi-platform awareness
- `/psn:post` slash command → platform selection step + branched previews
- Weekly plan slots → platform targeting metadata
