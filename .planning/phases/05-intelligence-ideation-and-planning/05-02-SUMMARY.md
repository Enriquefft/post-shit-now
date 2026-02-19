---
phase: 05-intelligence-ideation-and-planning
plan: 02
subsystem: intelligence
tags: [hackernews, reddit, producthunt, google-trends, rss, perplexity, exa, tavily, brave, scoring]

requires:
  - phase: 05-01
    provides: "ideas, series, trends, weeklyPlans, monitoredAccounts DB tables"
  - phase: 02-03
    provides: "XClient for X API interactions"
provides:
  - "6 trend source adapters (HN, Reddit, Product Hunt, Google Trends, RSS, X)"
  - "Pillar relevance scoring engine with angle stub generation"
  - "collectTrends orchestrator with BYOK graceful degradation"
  - "4 search clients (Perplexity, Exa, Tavily, Brave) with unified searchAll"
  - "Competitive intelligence via monitored X accounts"
affects: [05-03, 05-04, 05-05, 05-06]

tech-stack:
  added: [rss-parser]
  patterns: [BYOK-degradation, Promise.allSettled-aggregation, env-var-gating]

key-files:
  created:
    - src/intelligence/types.ts
    - src/intelligence/sources/hackernews.ts
    - src/intelligence/sources/reddit.ts
    - src/intelligence/sources/producthunt.ts
    - src/intelligence/sources/google-trends.ts
    - src/intelligence/sources/rss.ts
    - src/intelligence/sources/x-trending.ts
    - src/intelligence/scoring.ts
    - src/intelligence/collector.ts
    - src/intelligence/search/perplexity.ts
    - src/intelligence/search/exa.ts
    - src/intelligence/search/tavily.ts
    - src/intelligence/search/brave-search.ts
    - src/intelligence/search/index.ts
    - src/intelligence/competitive.ts
  modified: []

key-decisions:
  - "Lightweight YAML parsing in collector instead of adding yaml dependency"
  - "Perplexity citations mapped to SearchResult with content fallback when no citations"
  - "Competitive intelligence uses keyword frequency extraction (not ML) for topic detection"
  - "Gap suggestions compare competitor topics against user pillar words"

patterns-established:
  - "BYOK degradation: check env var, return empty array if missing, wrap in try/catch"
  - "Promise.allSettled aggregation: call all providers in parallel, collect fulfilled results"
  - "Per-item error isolation: catch errors per source/account, log and continue"

requirements-completed: [INTEL-01, INTEL-02, INTEL-03, INTEL-04, INTEL-05, INTEL-06]

duration: 2min
completed: 2026-02-19
---

# Phase 5 Plan 2: Intelligence Collection Layer Summary

**6 trend source adapters, pillar relevance scoring, 4 search clients with unified searchAll, and competitive intelligence with BYOK degradation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-19T11:02:32Z
- **Completed:** 2026-02-19T11:04:59Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Built 6 trend source adapters (HN, Reddit, Product Hunt, Google Trends, RSS, X) with no-auth and BYOK patterns
- Pillar relevance scoring with keyword matching, source normalization, and angle stub generation for 70+ scoring trends
- collectTrends orchestrator and collectBreakingNews lighter variant for INTEL-02 polling
- Four search clients (Perplexity, Exa, Tavily, Brave) with unified searchAll aggregator and URL deduplication
- Competitive intelligence module that monitors X accounts, extracts topics, estimates frequency, and suggests content gaps

## Task Commits

Each task was committed atomically:

1. **Task 1: Intelligence types, source adapters, and scoring engine** - `976787f` (feat)
2. **Task 2: Collector orchestrator, search clients, and competitive intelligence** - `d0ce3d9` (feat)

## Files Created/Modified
- `src/intelligence/types.ts` - RawTrend, ScoredTrend, SearchResult, Pillar types
- `src/intelligence/sources/hackernews.ts` - HN top stories fetcher (no auth)
- `src/intelligence/sources/reddit.ts` - Reddit hot posts via OAuth app-only token
- `src/intelligence/sources/producthunt.ts` - Product Hunt GraphQL featured products
- `src/intelligence/sources/google-trends.ts` - Google Trends RSS parser (no auth)
- `src/intelligence/sources/rss.ts` - Generic RSS feed parser with graceful skip
- `src/intelligence/sources/x-trending.ts` - X timeline trending via XClient
- `src/intelligence/scoring.ts` - Pillar relevance scoring, overall score, angle stubs
- `src/intelligence/collector.ts` - collectTrends and collectBreakingNews orchestrators
- `src/intelligence/search/perplexity.ts` - Perplexity sonar model search
- `src/intelligence/search/exa.ts` - Exa neural search
- `src/intelligence/search/tavily.ts` - Tavily web search
- `src/intelligence/search/brave-search.ts` - Brave Search web results
- `src/intelligence/search/index.ts` - Unified searchAll aggregator with re-exports
- `src/intelligence/competitive.ts` - Competitor monitoring with topic extraction and gap analysis

## Decisions Made
- Lightweight YAML parsing in collector.ts instead of adding a yaml dependency -- only needed to extract customRssFeeds array
- Perplexity citations mapped to SearchResult array; falls back to content snippet when no citations returned
- Competitive intelligence uses keyword frequency extraction (deterministic, not ML) for topic detection from tweets
- Gap suggestions compare competitor's frequent words against user's pillar name words for simple mismatch detection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict null check in collector YAML parser**
- **Found during:** Task 2 (collector.ts)
- **Issue:** `match[1]` could be undefined per strict null checks after regex match
- **Fix:** Changed `if (match)` to `if (match?.[1])` for safe access
- **Files modified:** src/intelligence/collector.ts
- **Verification:** `bun run typecheck` passes clean
- **Committed in:** d0ce3d9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript strictness fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. All search clients and source adapters use BYOK pattern and gracefully degrade when API keys are missing.

## Next Phase Readiness
- Intelligence collection layer complete, ready for Plan 03 (idea generation) and Plan 04 (weekly planning)
- collectTrends provides the data backbone for trend-based content ideation
- searchAll enables on-demand research queries from slash commands
- checkCompetitors ready for competitive analysis integration

---
*Phase: 05-intelligence-ideation-and-planning*
*Completed: 2026-02-19*
