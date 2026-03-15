# Post Shit Now — Learnings & Improvement Opportunities

## Philosophy Alignment

PSN's philosophy: code doesn't try to be smart, Claude handles all intelligence, the framework makes Claude cheaper and more effective. Automate what should be automated, nothing more.

Current state: **aligned**. Heuristic modules reduced to data providers. ZeroClaw integration handles all intelligence via Opus orchestration.

---

## ZeroClaw Integration (2026-03-15)

PSN is now integrated into ZeroClaw as a first-class skill. The `psn_cli` bridge routes all commands through `/etc/nixos/zeroclaw/skills/psn/cli.ts` with secret injection and error classification.

### ZeroClaw Cron Jobs Using PSN
- **build-in-public-drafter** — daily, uses `psn_cli content build-context` + `post create`
- **content-scout** — daily, captures ideas via `psn_cli capture`
- **engagement-scout** — daily, uses `psn_cli engage session/triage/draft`
- **psn-analytics** — daily 10pm, `psn_cli analytics collect`
- **psn-reconcile** — every 15m, state.db ↔ PSN status sync + approval timeout cascade
- **psn-voice-sync** — weekly Monday, SOUL.md → PSN voice profile (hash-based dedup)
- **psn-weekly-review** — Friday agent, reviews performance via `psn_cli review weekly`

### Intelligence Split
ZeroClaw (Opus) handles all judgment: content writing, engagement quality, strategy. PSN provides data, publishing pipeline, and platform APIs. No heuristic decision-making in PSN code.

---

## Heuristic Code — Resolved

All four heuristic modules have been reduced to data providers:

- [x] **`src/content/format-picker.ts`** — Stripped to `getFormatOptions()` returning available formats + constraints per platform. Claude decides format.
- [x] **`src/content/topic-suggest.ts`** — Removed angle template rotation. Returns raw pillars + idea bank + fatigue data. Claude generates angles.
- [x] **`src/engagement/scoring.ts` `suggestEngagementType()`** — Returns first available engagement type as default. Claude (via engagement-scout) makes the real decision.
- [x] **`src/intelligence/scoring.ts` `generateAngleStubs()`** — Removed. `scoreTrends()` returns scored trends without pre-generated angles. Claude generates with full voice context.

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
- [x] ~~**Placeholder hashtags**~~ — Removed hardcoded `"#ContentCreation #SocialMedia"` from X→LinkedIn adapter. Hashtags generated via voice context.
- [ ] **`validateCredentials()` stubs** — All 4 handlers return `true` unconditionally. Should make a lightweight API call (e.g., `getMe()`) to actually validate.
- [ ] **Hardcoded `userId: "default"`** — Analytics collector and engagement monitor hardcode this. Works for single-user personal hubs, breaks for multi-user company hubs.
- [x] ~~**Stale phase directory**~~ — Deleted `.planning/phases/02-database-stability/`.
- [x] ~~**Layering concern**~~ — Moved `resolveHub` to `src/core/utils/resolve-hub.ts`. Both `generate.ts` and `post-finish.ts` import from shared location.

---

## Architecture Observations

- The publish pipeline (slash command → CLI → Trigger.dev → handler → client → API) is fully wired end-to-end, no gaps.
- All 4 platform clients are real implementations with proper OAuth, rate limiting, and error handling.
- 12 Trigger.dev tasks, all implemented — scheduling, analytics, token refresh, watchdog, notifications, engagement, trends.
- 20 DB tables with RLS policies. Migrations current.
- Voice interview engine is complete (5-phase, adaptive, bilingual, multi-entity).
- `generatePost()` correctly builds context for Claude without trying to write content — this is the philosophy working as intended.
- ZeroClaw bridge (`skills/psn/cli.ts`) provides secret injection, error classification (6 classes), and 3x retry for transient network errors.
