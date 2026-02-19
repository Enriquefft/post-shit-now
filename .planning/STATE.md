# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.
**Current focus:** Phase 5 - Intelligence, Ideation, and Planning

## Current Position

Phase: 5 of 8 (Intelligence, Ideation, and Planning)
Plan: 3 of 6 in current phase
Status: Executing Phase 5
Last activity: 2026-02-19 - Completed 05-03 (Idea bank with capture, lifecycle, CLI, preference feedback)

Progress: [██████░░░░] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 20
- Average duration: ~6min
- Total execution time: ~2h 7min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3/3 | ~60min | ~20min |
| 2 | 4/4 | ~12min | ~3min |
| 3 | 7/7 | ~21min | ~3min |
| 4 | 5/5 | ~25min | ~5min |
| 5 | 3/6 | ~8min | ~3min |

**Recent Trend:**
- Last 5 plans: 04-04 (~5min), 04-05 (~4min), 05-01 (~2min), 05-02 (~2min), 05-03 (~4min)
- Trend: Phase 5 plans executing efficiently

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 8 phases derived from 108 requirements; comprehensive depth
- [Roadmap]: Submit LinkedIn partner API + TikTok audit applications in Phase 1 (multi-week lead times)
- [Roadmap]: X is first platform (easiest API access, no approval gates)
- [Roadmap]: Voice profiling is Phase 3 (core differentiator, needs infrastructure first)
- [01-01]: Biome 2.4.2 config schema differs from 2.0 docs — organizeImports moved to assist.actions.source
- [01-01]: drizzle.config.ts uses placeholder DATABASE_URL to avoid requiring live DB for generation
- [01-02]: CLI scripts output JSON to stdout for Claude to interpret (not human-readable)
- [01-03]: Watchdog marks stuck posts as retry/failed — actual re-publish comes in Phase 2
- [02-02]: Paragraph boundaries always create separate tweets (no merging short paragraphs)
- [02-01]: Used Arctic v3 for X OAuth PKCE -- handles code challenge and token exchange with minimal boilerplate
- [02-01]: X callback URL set to https://example.com/callback for CLI-based OAuth flows
- [02-01]: userId 'default' for single-user setup, RLS handles multi-user when needed
- [02-02]: Built-in Intl.DateTimeFormat for timezone operations (zero external dependencies)
- [02-03]: Raw fetch over SDK for X API client — minimal dependencies, full control over rate limit headers
- [02-03]: Token refresh at 1-day-before-expiry window catches all X tokens (2hr lifetime)
- [02-03]: jsonb_set for metadata updates preserves existing metadata fields
- [02-04]: Thread content stored as JSON string array in posts.content column
- [02-04]: Rate limit backoff uses Trigger.dev wait.until() for zero compute cost
- [02-04]: Partial thread failures tracked in metadata.threadProgress for resume on retry
- [02-04]: Watchdog max 3 retries before marking failed (SCHED-04 compliance)
- [03-01]: YAML as source of truth for voice profiles (file-based, not DB)
- [03-01]: Atomic write via .tmp + rename prevents profile corruption
- [03-01]: Zod v4 schemas with inferred types for zero schema/type drift
- [03-01]: VoiceTweak discriminated union for surgical profile edits
- [03-02]: fal.ai as primary path for Ideogram and Flux (no minimum usage requirement)
- [03-02]: GPT Image as default/versatile provider; Ideogram for text-heavy; Flux for photorealism
- [03-02]: Content hint keyword matching for auto-selection (not ML-based)
- [03-02]: Instagram always JPEG; iterative quality reduction for size enforcement
- [03-03]: Kling v2.6 endpoints via fal.ai for best quality realistic motion and native audio
- [03-03]: Runway SDK constrains text-to-video to veo3.1 model (gen4.5 not in SDK types)
- [03-03]: Content hint scoring pattern reused from image-gen for provider auto-selection
- [03-04]: Interview engine is a library, not interactive CLI -- Claude drives conversation via slash commands
- [03-04]: Experience detection uses keyword signal scoring plus imported content volume
- [03-04]: Content analysis is heuristic string processing, not ML -- simple and deterministic
- [03-04]: Blank-slate users get 5 starter archetypes as starting templates
- [03-05]: Content brain is a context assembler, not a black-box generator -- Claude generates actual text using assembled voice context
- [03-05]: Deterministic topic suggestions with angle rotation to avoid repetition across calls
- [03-05]: Draft files use YAML frontmatter for metadata, stored as markdown in content/drafts/
- [03-05]: Published drafts pruned after 14 days (CONTENT-01), media after 7 days (CONTENT-02)
- [03-06]: Edit distance uses diff package word-level diffing, not character-level
- [03-06]: Calibration convergence: 10 consecutive posts below 15% edit ratio
- [03-06]: Brand-operator profiles standalone; brand-ambassador inherits personal with guardrails
- [03-06]: Thread content (JSON arrays) normalized by joining before diffing
- [03-07]: Slash commands orchestrate Phase 3 subsystems through CLI JSON output pattern
- [04-01]: Engagement rate stored as basis points (integer * 10000) to avoid floating-point in DB
- [04-01]: Thread metrics aggregation uses first tweet's impression_count for rate calculation
- [04-01]: XClient.getTweets chunks IDs into batches of 100 per X API v2 limit
- [03-07]: Voice tweaks use colon-delimited DSL (formality:8, add-pillar:AI, tone-x:casual)
- [03-07]: Post command adapts to user input flexibility -- single word to detailed brief
- [04-02]: Tiered collection cadence: 0-7 day posts every run, 8-30 day posts if not collected in 3 days
- [04-02]: Per-post error isolation in analytics collector (catch, log, continue)
- [04-02]: Fatigue detection requires strictly declining scores across last 3 posts
- [04-02]: Added unique index on postMetrics (postId, platform) for upsert support
- [04-03]: Speed limits: 5+ posts before any adjustment, 3+ weeks before pillar weight changes
- [04-03]: Feedback only at 3x average (high), 0.3x average (low), and edit streaks
- [04-03]: Format preferences always auto-apply; new pillars and drop format always require approval
- [04-03]: Frequency capped per platform (x:14, linkedin:7, instagram:7, tiktok:7)
- [04-05]: Single preference model DB query reused for both topic suggestions and generation
- [04-05]: Hub routing in draft metadata (not new schema column) until Company Hub Phase 7
- [04-05]: Fatigue matching uses case-insensitive substring includes for flexible topic detection
- [04-04]: Review returns structured WeeklyReview object -- Claude renders it in the slash command
- [04-04]: Bottom posts filtered to avoid overlap with top posts when few posts exist
- [04-04]: Monthly analysis queues strategic recommendations as approval-tier strategyAdjustments
- [04-04]: Risk budget uses first-half vs second-half metric trend as heuristic for adjustment impact
- [04-05]: Company posts conceptually pending_approval; personal posts proceed normally
- [05-01]: SeriesTemplate and PlanSlot exported as interfaces for reuse in downstream modules
- [05-01]: EditPattern interface pattern reused for SeriesTemplate and PlanSlot typed jsonb columns
- [05-02]: Lightweight YAML parsing in collector instead of adding yaml dependency
- [05-02]: Perplexity citations mapped to SearchResult with content fallback when no citations
- [05-02]: Competitive intelligence uses keyword frequency extraction (not ML) for topic detection
- [05-02]: Gap suggestions compare competitor topics against user pillar words
- [05-03]: CLI supports capture/list/ready/search/stats/stale/expire/killed subcommands
- [05-03]: killedIdeaPatterns stored as jsonb on preference_model table for rejection learning
- [05-03]: Graceful try/catch around killed idea query for when ideas table does not exist yet

### Pending Todos

None yet.

### Blockers/Concerns

- LinkedIn partner API approval takes 2-6 weeks — must submit in Phase 1, needed by Phase 6
- TikTok audit takes 1-2 weeks — must submit in Phase 1, needed by Phase 8
- drizzle-kit push silently deletes RLS policies — only generate+migrate is safe (established Phase 1)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Check if current GSD roadmap fully implements PRD.md | 2026-02-19 | 557f243 | [1-check-if-current-gsd-roadmap-fully-imple](./quick/1-check-if-current-gsd-roadmap-fully-imple/) |
| 2 | Add video generation requirements (VID-xx) to REQUIREMENTS.md and ROADMAP.md | 2026-02-19 | b04842b | [2-add-video-generation-requirements-vid-xx](./quick/2-add-video-generation-requirements-vid-xx/) |

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 05-03-PLAN.md
Resume file: None
