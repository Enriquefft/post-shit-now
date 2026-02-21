---
phase: 03-voice-profiling-and-content-generation
plan: 05
subsystem: content
tags: [content-generation, format-picker, topic-suggestions, drafts, voice-matching, pruning]

# Dependency graph
requires:
  - phase: 03-voice-profiling-and-content-generation/01
    provides: "Voice profile schema, YAML CRUD, and strategy generation"
  - phase: 03-voice-profiling-and-content-generation/02
    provides: "Image generation providers for media attachment"
  - phase: 03-voice-profiling-and-content-generation/03
    provides: "Video generation providers for media attachment"
provides:
  - "Content brain (generatePost) context assembler for voice-matched content generation"
  - "Smart format picker per platform (pickFormat) with keyword-based content analysis"
  - "Topic suggestion engine from voice profile pillars with angle rotation"
  - "Draft lifecycle management with YAML frontmatter and auto-pruning"
  - "Media storage with auto-pruning (7-day default)"
  - "Idea bank stub (Phase 5 forward-compatible)"
  - "Preference model learnings stub (Phase 4 forward-compatible)"
affects: [post-creation, slash-commands, scheduling, analytics, idea-bank]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Context assembler pattern (generatePost prepares context, Claude generates)", "YAML frontmatter for file-based draft metadata", "Angle rotation for non-repetitive topic suggestions"]

key-files:
  created:
    - src/content/format-picker.ts
    - src/content/topic-suggest.ts
    - src/content/drafts.ts
    - src/content/generate.ts
    - content/drafts/.gitkeep
    - content/media/.gitkeep
  modified: []

key-decisions:
  - "Content brain is a context assembler, not a black-box generator -- Claude generates actual text using assembled voice context"
  - "Deterministic topic suggestions with angle rotation to avoid repetition across calls"
  - "Draft files use YAML frontmatter for metadata, stored as markdown in content/drafts/"
  - "Published drafts pruned after 14 days (CONTENT-01), media after 7 days (CONTENT-02)"

patterns-established:
  - "Context assembler pattern: generatePost loads profile + picks format + builds voice prompt context, returns structured data for Claude"
  - "YAML frontmatter draft format: ---\\nmetadata\\n---\\ncontent"
  - "Platform-specific format selection with keyword matching and voice preference override"
  - "Stub pattern for future phase integration (checkIdeaBank, getPreferenceModelLearnings)"

requirements-completed: [POST-01, POST-05, POST-06, POST-09, POST-11, POST-12, POST-14, CONTENT-01, CONTENT-02]

# Metrics
duration: 1min
completed: 2026-02-19
---

# Phase 03 Plan 05: Content Brain Summary

**Content generation brain with voice-matched context assembly, platform-aware format picker, pillar-based topic suggestions, and draft lifecycle with YAML frontmatter and auto-pruning**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-19T07:38:13Z
- **Completed:** 2026-02-19T07:39:02Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Content brain assembles complete voice context from profile, platform persona, and language-specific patterns for Claude to generate voice-matched content
- Smart format picker selects optimal format per platform (carousel for LinkedIn data, threads for long X content, reels for TikTok, etc.) with keyword-based content analysis
- Topic suggestion engine rotates through content pillars and angles (hot take, how-to, story, trend, myth-busting, etc.) with platform-specific format overrides
- Draft lifecycle with YAML frontmatter, filtering by platform/status, and auto-pruning of published drafts after 14 days
- Media storage with 7-day auto-pruning and .gitkeep directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Format picker, topic suggestions, and draft management** - `912c591` (feat, combined commit)
2. **Task 2: Content generation orchestrator (content brain)** - `912c591` (feat, combined commit)

Note: Both tasks were committed together by a prior background agent in a single commit.

## Files Created/Modified
- `src/content/format-picker.ts` - Smart format selection per platform with keyword detection and voice preference support
- `src/content/topic-suggest.ts` - Topic suggestions from voice profile pillars with angle rotation and platform format overrides
- `src/content/drafts.ts` - Draft save/load/list/prune and media save/prune with YAML frontmatter
- `src/content/generate.ts` - Content brain context assembler: loads profile, checks idea bank, suggests topics, picks format, builds voice prompt context
- `content/drafts/.gitkeep` - Draft storage directory
- `content/media/.gitkeep` - Media storage directory

## Decisions Made
- Content brain is a context assembler, not a black-box generator -- Claude IS the LLM, so generatePost prepares structured voice context for Claude to use during slash command interaction
- Deterministic topic suggestions with angle rotation (modulewide index) avoids repeating suggestions across sequential calls
- Draft files stored as markdown with YAML frontmatter for human readability and easy parsing
- Published drafts pruned after 14 days (CONTENT-01), media after 7 days (CONTENT-02) -- only published drafts are pruned, never active ones

## Deviations from Plan

None - plan executed exactly as written. Code was verified against all plan requirements and passes typecheck, lint, and all 118 tests.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Content brain ready for slash command integration (psn:post will call generatePost)
- Format picker and topic suggestions available for all 4 platforms
- Draft management ready for publishing pipeline integration
- Idea bank and preference model stubs ready for Phase 4/5 integration

## Self-Check: PASSED

All 6 source files verified present. Commit hash 912c591 verified in git log.

---
*Phase: 03-voice-profiling-and-content-generation*
*Completed: 2026-02-19*
