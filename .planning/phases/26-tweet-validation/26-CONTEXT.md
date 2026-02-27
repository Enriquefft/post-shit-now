# Phase 26: Tweet Validation - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Pre-flight validation for tweets with weighted character counting (URLs=23, emojis=2, CJK=2). Thread splitting for oversized content. Single `countTweetChars()` function shared by validator and splitter. Clear error messages instead of misleading X API 403s.

</domain>

<decisions>
## Implementation Decisions

### Error reporting
- Simple count vs max format: "Tweet is 312/280 characters" — no type breakdown
- Block publishing with suggestion: "Consider splitting into a thread" — don't auto-fix
- Validate at both content generation time (so Claude can self-correct) and publish time (final safety net)
- Publish-time validation failures send notification to user via their configured channel (WhatsApp/email)

### Thread splitting rules
- Split at sentence boundaries — last complete sentence that fits, reads naturally
- Fraction suffix numbering: "1/3" appended to each tweet
- Reserve space for numbering suffix when calculating available characters per tweet (e.g., " 1/3" = 4 chars, " 1/10" = 5 chars)
- Maximum thread length: 10 tweets — anything longer should be a different format

### Validation scope
- Primary: weighted character counting (hard error, blocks publish)
- Mentions: warn when >10 mentions in a single tweet (soft warning, still publishes)
- Hashtags: warn when >5 hashtags in a single tweet (soft warning, still publishes)
- Duplicate detection: check against recent posts in DB, warn on near-duplicate content (soft warning)

### Claude's Discretion
- Exact duplicate detection algorithm (fuzzy match threshold, time window for "recent")
- How to surface warnings during content generation vs publish time
- URL detection regex / pattern matching approach
- How to handle edge cases (partial URLs, unicode edge cases, zero-width characters)

</decisions>

<specifics>
## Specific Ideas

- Soft warnings (mentions, hashtags, duplicates) should still publish — they're advisory, not blockers
- Only character count exceeding 280 is a hard block
- Thread splitter must account for suffix space before splitting, not after — avoids off-by-one overflow

</specifics>

<deferred>
## Deferred Ideas

- Media attachment validation (size, format, dimensions) — future phase
- Link preview validation (check if URLs are reachable) — future phase

</deferred>

---

*Phase: 26-tweet-validation*
*Context gathered: 2026-02-27*
