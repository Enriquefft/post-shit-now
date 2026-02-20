# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-19)

**Core value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.
**Current focus:** Phase 12 - Solo Founder Experience

## Current Position

Phase: 12 of 13 (Solo Founder Experience)
Plan: 1 of 3 in current phase (EXECUTING)
Status: 12-01 complete, entity-scoped voice profiles
Last activity: 2026-02-19 - Completed 12-01 (entity-scoped voice profiles)

Progress: [██████████░] 92%

## Performance Metrics

**Velocity:**
- Total plans completed: 26
- Average duration: ~6min
- Total execution time: ~2h 31min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 3/3 | ~60min | ~20min |
| 2 | 4/4 | ~12min | ~3min |
| 3 | 7/7 | ~21min | ~3min |
| 4 | 5/5 | ~25min | ~5min |
| 5 | 6/6 | ~20min | ~3min |
| 6 | 2/2 | ~15min | ~7min |

**Recent Trend:**
- Last 5 plans: 05-05 (~3min), 05-06 (~7min), 06-01 (~8min), 06-02 (~7min)
- Trend: Phase 6 multi-platform plans slightly longer due to cross-platform wiring

*Updated after each plan completion*
| Phase 07 P01 | 2min | 2 tasks | 5 files |
| Phase 07 P02 | 4min | 4 tasks | 8 files |
| Phase 07 P03 | 4min | 3 tasks | 4 files |
| Phase 07 P04 | 5min | 4 tasks | 8 files |
| Phase 07 P05 | 4min | 3 tasks | 4 files |
| Phase 08 P01 | 4min | 2 tasks | 8 files |
| Phase 08 P02 | 6min | 2 tasks | 8 files |
| Phase 08 P04 | 6min | 2 tasks | 8 files |
| Phase 08 P03 | 6min | 2 tasks | 5 files |
| Phase 08 P05 | 6min | 2 tasks | 5 files |
| Phase 09 P01 | 2min | 2 tasks | 4 files |
| Phase 09 P02 | 2min | 2 tasks | 2 files |
| Phase 11 P01 | 5 | 2 tasks | 2 files |
| Phase 11 P02 | 3 | 1 tasks | 4 files |
| Phase 11 P03 | 5 | 1 tasks | 4 files |
| Phase 11 P04 | 4 | 1 tasks | 4 files |
| Phase 11 P05 | 8 | 2 tasks | 2 files |
| Phase 11 P06 | 5 | 2 tasks | 1 files |
| Phase 12 P01 | 5min | 4 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 11 added: should we address this remaining tech debt issues? - CONFIG-04: search providers read from process.env (BYOK stores in keys.env — works via Trigger.dev env vars) - IMG/VID providers not imported by generate.ts (Claude-invoked pattern, by design)

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
- [05-04]: Added unique index on trends (user_id, title, source) for upsert support
- [05-04]: ON CONFLICT updates score only if new score is higher (GREATEST)
- [05-04]: Poller does NOT prune old trends -- daily collector handles that
- [05-04]: Lightweight YAML parsing reused from collector pattern for pillar loading
- [05-05]: SeriesTemplate re-exported from schema.ts as single source of truth
- [05-05]: Pattern detection uses pure SQL+JS aggregation, no ML
- [05-05]: Custom tracking format supports {e} for episode and {s} for season
- [05-05]: Retired status is terminal -- cannot un-retire a series
- [05-06]: PlanSlot.seriesEpisode as string in planning types, converted to number for DB schema
- [05-06]: Language balance targets 60/40 primary/secondary with 14-day post history analysis
- [05-06]: Bilingual "both" uses recursive generatePost calls for independent generation passes
- [05-06]: Series state advancement in publish-post.ts wrapped in try/catch to never roll back publishes
- [05-06]: checkIdeaBank backward-compatible: returns empty when no DB provided

- [06-01]: Arctic LinkedIn provider uses state param only (no PKCE unlike X)
- [06-01]: LinkedIn tokens expire in 60 days; 7-day warning window for proactive refresh
- [06-01]: Organic carousels are document posts (PDF pages via pdf-lib), NOT the sponsored Carousel API
- [06-01]: Person URN fetched from OpenID Connect userinfo and stored in token metadata
- [06-01]: LinkedIn setup optional -- skips gracefully if no credentials provided
- [06-02]: Multi-platform dispatch publishes independently per platform with try/catch isolation
- [06-02]: Overall post status "published" if ANY platform succeeded; subStatus "partial_failure" if some failed
- [06-02]: Per-platform status tracked in post.metadata.platformStatus field
- [06-02]: LinkedIn format picker auto-suggests carousel for list/step/framework content (11.2x impressions)
- [06-02]: LinkedIn engagement weights: reshares(4) > comments(3) > reactions(1)
- [06-02]: Analytics collector handles both platforms independently -- LinkedIn failure does not crash X collection
- [Phase 07]: [07-01]: Team RLS allows seeing all members in same hub (hub-scoped visibility)
- [Phase 07]: [07-01]: inviteCodes has no RLS -- validated server-side only
- [Phase 07]: [07-01]: Approval columns nullable on posts (null=personal, non-null=company)
- [Phase 07]: [07-01]: pushEnabled/digestEnabled as integer (0/1) for Postgres boolean-as-int pattern
- [Phase 07]: [07-02]: Invite bundle as base64 JSON avoids central registry -- admin shares single string
- [Phase 07]: [07-02]: Soft-delete for team member removal (leftAt) preserves content attribution
- [Phase 07]: [07-02]: Last-admin guard prevents demoting the only admin in a hub
- [Phase 07]: [07-02]: Disconnect continues removing local file even if server-side fails (graceful)
- [Phase 07]: [07-03]: Brand preference model uses hubId as userId in preference_model table (no new table)
- [Phase 07]: [07-03]: Publish-post returns 'skipped' for unapproved company posts (never 'failed')
- [Phase 07]: [07-03]: Calendar default optimal hours per platform when strategy.yaml unavailable
- [Phase 07]: [07-03]: Approval stats use 3 separate queries for clarity over single aggregation
- [Phase 07]: [07-04]: WAHA Core tier fallback renders buttons/lists as numbered text options
- [Phase 07]: [07-04]: Twilio always uses text fallback for interactive messages (Content Templates require pre-registration)
- [Phase 07]: [07-04]: Twice-daily digest splits at digestTime and digestTime+10 hours for morning/evening cadence
- [Phase 07]: [07-04]: Company notification routing: admins for approvals, author for failures, both for viral
- [Phase 07]: [07-05]: Slash commands follow existing patterns from post.md, review.md, capture.md
- [Phase 07]: [07-05]: Approval rejection reason is required for good team communication
- [Phase 07]: [07-05]: Calendar cross-hub overlap allowed (different audiences per CONTEXT.md)
- [Phase 07]: [07-05]: Notification setup returns interactive scaffold for Claude-guided configuration
- [Phase 08]: [08-01]: Instagram OAuth uses raw fetch (no Arctic provider available) for direct login flow
- [Phase 08]: [08-01]: Instagram has no refresh tokens -- access token itself refreshed via ig_refresh_token grant
- [Phase 08]: [08-01]: Container status polling every 5s, max 60 attempts (5 min timeout)
- [Phase 08]: [08-01]: Hashtag pool cached locally with 7-day rolling window budget tracking (30 searches/week)
- [Phase 08]: [08-01]: Default 15 hashtags per post (Instagram allows 30, use half for safety)
- [Phase 08]: [08-02]: Arctic TikTok provider uses PKCE (state, codeVerifier, scopes) -- same pattern as X
- [Phase 08]: [08-02]: TikTok rotates refresh tokens on each refresh -- both new tokens must be stored
- [Phase 08]: [08-02]: Unaudited apps forced to SELF_ONLY privacy (draft-only mode) with clear user messaging
- [Phase 08]: [08-02]: Creative Center scraping with graceful degradation (empty arrays on failure, never crashes)
- [Phase 08]: [08-02]: TikTok token refresh window is 1 day before expiry (matching X pattern)
- [Phase 08]: [08-04]: X searchRecent method added to XClient for engagement discovery (missing from existing client)
- [Phase 08]: [08-04]: Instagram hashtag budget limited to 2 searches per monitoring run to preserve 30/week budget
- [Phase 08]: [08-04]: Notification routing reuses existing notification_log table with dedup keys
- [Phase 08]: [08-04]: NeonHttpQueryResult uses .rows[0] pattern for SELECT queries (not destructuring)
- [Phase 08]: [08-03]: Instagram analytics budget 50 req/hr from 200/hr total (conservative for analytics)
- [Phase 08]: [08-03]: TikTok video.list inline metrics — no separate insights call needed (more efficient)
- [Phase 08]: [08-03]: Instagram default format biased to Reels (30.81% reach rate, 55% views from non-followers)
- [Phase 08]: [08-03]: Instagram engagement weights: shares(4) > saved(3) > comments(2) > likes(1)
- [Phase 08]: [08-05]: Draft context blocks returned by drafting engine -- Claude generates actual replies using voice context
- [Phase 08]: [08-05]: Thread tone analysis: 70/30 blend of user base style and thread tone
- [Phase 08]: [08-05]: Scoring weight suggestions require human review (approval-tier pattern)
- [Phase 08]: [08-05]: Content bridge suggests up to 5 ideas from high-relevance engaged opportunities
- [Phase 09]: [09-01]: All notification triggers are fire-and-forget with try/catch -- notification failure never crashes the calling function
- [Phase 09]: [09-01]: High-score engagement (70+) raw INSERT replaced with dispatcher trigger to avoid duplicate notification_log entries
- [Phase 09]: [09-01]: Medium-score engagement (60-69) raw INSERT preserved for digest compilation
- [Phase 09]: [09-02]: Reuse single DB connection for checkIdeaBank and getLockedSettings in generate.ts
- [Phase 09]: [09-02]: calendarCommand returns UnifiedCalendar type (breaking return type change from CalendarState)
- [Phase 09]: [09-02]: Inline type imports for HubConnection and HubDb in calendarCommand
- [Phase 11-tech-debt-remediation]: HUB_ENCRYPTION_KEY environment variable used for all encryption/decryption
- [Phase 11-tech-debt-remediation]: Hub-scoped keys: userId = hubId (user ID for Personal Hub, hub ID for Company Hub)
- [Phase 11-tech-debt-remediation]: listKeys() does NOT decrypt values (security best practice)
- [Phase 11-tech-debt-remediation]: Unique index on (userId, service) for O(1) key lookups
- [Phase 11-tech-debt-remediation]: DB-only approach: no process.env fallbacks for search provider keys
- [Phase 11-tech-debt-remediation]: Ideogram tries fal key first, then ideogram key (fallback pattern)
- [Phase 11-tech-debt-remediation]: /psn:setup keys subcommand supports --list and --service flags
- [Phase 11-tech-debt-remediation]: Architectural limitation: ideation.ts needs hubId for on-demand search (future work)
- [Phase 12]: Entity-scoped voice profiles use entitySlug field for multi-project support
- [Phase 12]: Slug collisions handled by appending -2, -3, etc. to base slug
- [Phase 12]: PostgresJsDatabase type used for DB connection (matching existing pattern)
- [Phase 12]: Function overload pattern for backward-compatible loadProfile() extension

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
Stopped at: Completed 09-01-PLAN.md (Notification dispatcher wiring) -- Phase 9 fully complete
Resume file: N/A
