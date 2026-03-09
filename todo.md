# Post Shit Now — Learnings & Improvement Opportunities

## Philosophy Alignment

PSN's philosophy: code doesn't try to be smart, Claude handles all intelligence, the framework makes Claude cheaper and more effective. Automate what should be automated, nothing more.

Current state: **mostly aligned, with drift in heuristic modules**.

---

## Heuristic Code That Should Be Claude's Job

These modules use hardcoded keyword matching and rules to make judgment calls that Claude would handle better with full context. They should be reduced to data providers, passing raw data to Claude instead of pre-deciding.

- [ ] **`src/content/format-picker.ts`** — 435 lines of keyword-based format selection. "Contains 'data'? → carousel." Claude with voice profile + topic context picks better formats. Replace with: pass platform constraints + format options to Claude, let it choose.

- [ ] **`src/content/topic-suggest.ts`** — Mechanical angle template rotation ("Hot take: {pillar}", "How to {pillar}"). Claude generates better, voice-matched ideas. Replace with: pass pillars + fatigue data + idea bank to Claude as context, remove template engine.

- [ ] **`src/engagement/scoring.ts` `suggestEngagementType()`** — Keyword matching to decide reply vs quote vs duet. "Contains 'opinion'? → quote." Claude reading the actual post decides better. Replace with: pass the post content + platform capabilities to Claude.

- [ ] **`src/intelligence/scoring.ts` `generateAngleStubs()`** — Random angle templates for trends. Claude generates angles that match voice profile. Replace with: pass scored trends to Claude, let it generate angles.

## Heuristic Code That Should Stay (Legitimate Automation)

These modules do math/aggregation that saves Claude from crunching numbers. They align with "make it cheaper."

- [x] `src/analytics/scoring.ts` — Weighted engagement score computation (pure math, no judgment)
- [x] `src/analytics/fatigue.ts` — "3 declining posts → fatigued" (simple threshold, feeds Claude as warning)
- [x] `src/intelligence/scoring.ts` `scoreTrends()` — Pre-ranks trends so Claude sees top 10 instead of 200
- [x] `src/engagement/scoring.ts` `scoreOpportunity()` — Composite scoring to pre-filter opportunities
- [x] `src/learning/preference-model.ts` — Weekly aggregation of what formats/pillars/times perform best

---

## Missing Test Coverage

- [ ] **LinkedIn handler** — `MockLinkedInClient` is an empty stub, no publish flow tests
- [ ] **TikTok handler** — `MockTikTokClient` is an empty stub, no publish flow tests
- [ ] **CLI setup scripts** — No tests for any setup flow (OAuth, DB provisioning, health checks)
- [ ] **Trigger.dev cron tasks** — No direct tests for analytics-collector, token-refresher, digest-compiler, engagement-monitor, trend-collector

---

## Minor Known Issues

- [ ] **LinkedIn callback URL hardcoded** — `linkedin.handler.ts` line 77 and `analytics-collector.ts` line 222 use `"https://example.com/callback"` for token refresh. Should use the real redirect URI.
- [ ] **Placeholder hashtags** — `src/content/generate.ts` line 306 has `"#ContentCreation #SocialMedia"` hardcoded in X→LinkedIn content adapter.
- [ ] **`validateCredentials()` stubs** — All 4 handlers return `true` unconditionally. Should make a lightweight API call (e.g., `getMe()`) to actually validate.
- [ ] **Hardcoded `userId: "default"`** — Analytics collector and engagement monitor hardcode this. Works for single-user personal hubs, breaks for multi-user company hubs.
- [ ] **Stale phase directory** — `.planning/phases/02-database-stability/` has 4 plans, 0 summaries. Superseded by Phase 15 in v1.1. Should be deleted.
- [ ] **Layering concern** — `src/content/generate.ts` imports `resolveHub` from `src/cli/post-finish.ts` (content module importing CLI module).

---

## Architecture Observations

- The publish pipeline (slash command → CLI → Trigger.dev → handler → client → API) is fully wired end-to-end, no gaps.
- All 4 platform clients are real implementations with proper OAuth, rate limiting, and error handling.
- 12 Trigger.dev tasks, all implemented — scheduling, analytics, token refresh, watchdog, notifications, engagement, trends.
- 20 DB tables with RLS policies. Migrations current.
- Voice interview engine is complete (5-phase, adaptive, bilingual, multi-entity).
- `generatePost()` correctly builds context for Claude without trying to write content — this is the philosophy working as intended.
