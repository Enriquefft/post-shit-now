# Phase 4: Analytics and Learning Loop - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Collect X engagement metrics, score posts, surface performance insights through `/psn:review`, and build a preference model that autonomously adjusts content strategy based on engagement signals, edit patterns, and explicit feedback. Also includes semi-automated format support (POST-13) and hub routing for personal vs company posts (SCHED-06).

</domain>

<decisions>
## Implementation Decisions

### Review Experience (/psn:review)
- Default time range: last 7 days (weekly cadence per ANLYT-07)
- Post presentation: ranked list with highlights (top 3 / bottom 3 get full breakdown) PLUS compact score + one-line verdict for remaining posts — combine both approaches
- Recommendations backed by evidence: each suggestion cites specific posts that support it (e.g., "Threads outperformed singles by 2x — see posts #4, #7")
- Comparison mode: both time comparison (this week vs last) AND cross-pillar breakdown in the same review
- Reports saved to `analytics/reports/` (ANLYT-09)

### Learning Loop Autonomy
- Tiered apply model: small adjustments (±5% pillar weight, posting time shifts, format preference tweaks) auto-apply; large changes (new pillar, dropping a format entirely, significant frequency changes) queue for user approval during /psn:review
- Adjustment speed limits: Claude's discretion — pick appropriate speed based on data confidence
- Explicit feedback prompts: at key moments only — 3x above average, significant underperformance, high/low edit streaks (LEARN-03). No friction-adding "rate every post" flow
- User overrides: permanent via explicit lock. Unlocking requires an explicit unlock command — no auto-expiry
- Transparent changelog (LEARN-06): weekly review shows "what the brain changed this week" section

### Engagement Scoring
- Two metrics shown: engagement score (absolute, saves > shares > comments > likes) AND engagement rate (per impression). Both visible, kept separate
- Format normalization: Claude's discretion on whether to normalize by format or show raw with format context
- Analytics collection cadence: Claude's discretion on timing (balance API costs vs data freshness)
- Follower tracking: track weekly/monthly trend, show in /psn:review as context. Do NOT correlate follower changes with specific posts — too noisy for reliable attribution

### Content Fatigue Detection
- Detection method: declining engagement trend — if last 3 posts on a topic each scored lower than previous, flag as fatigued
- Cooldown action: deprioritize in suggestions. Topic still available if user chooses manually, but content brain won't suggest it
- Format fatigue: Claude's discretion on whether to track format fatigue separately from the format picker (Phase 3)
- Visibility: warn during /psn:post too — if user is about to post on a fatigued topic, suggest alternatives. Don't just wait for /psn:review

### Claude's Discretion
- Adjustment speed limits (within tiered model constraints)
- Analytics collection cadence and API cost optimization
- Format normalization approach in scoring
- Whether format fatigue needs separate tracking beyond the format picker
- Monthly deep analysis format and depth (ANLYT-08)

</decisions>

<specifics>
## Specific Ideas

- The review should feel like a social media manager's weekly briefing — here's what worked, here's what didn't, here's what I changed, here's what I recommend
- Fatigue warnings during /psn:post should suggest alternatives, not just warn ("This topic has been cooling — consider [alternative pillar]")
- The system acts as a manager, not a consultant — makes tactical decisions within bounds, reports back

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-analytics-and-learning-loop*
*Context gathered: 2026-02-19*
