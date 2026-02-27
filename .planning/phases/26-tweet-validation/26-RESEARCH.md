# Phase 26: Tweet Validation - Research

**Researched:** 2026-02-27
**Domain:** Tweet character counting, content validation, thread splitting
**Confidence:** HIGH

## Summary

Tweet validation requires implementing X's weighted character counting algorithm, which uses a scale/weight system where characters in specific Unicode ranges count as 1 character and everything else counts as 2. URLs always count as exactly 23 characters (t.co shortening). The project already has a `thread-splitter.ts` that uses naive `string.length` for character counting -- this must be refactored to use the new `countTweetChars()` function (TVAL-03 single source of truth).

The existing codebase has `splitIntoThread()` in `src/core/utils/thread-splitter.ts` and the X handler in `src/platforms/handlers/x.handler.ts` which calls it. Neither performs weighted character counting -- they use raw `.length` comparisons against 280. The X handler also has no pre-flight validation; it sends text directly to the API and catches errors after the fact. The REQUIREMENTS.md explicitly states: do NOT use the `twitter-text` npm package (unmaintained 6+ years); build a custom ~60-line validator instead.

**Primary recommendation:** Create a single `countTweetChars()` function in `src/core/utils/tweet-validator.ts` implementing X's v3 weighted counting config, then refactor `thread-splitter.ts` to use it, and add pre-flight validation in the X handler before any API call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Error format: "Tweet is 312/280 characters" -- no type breakdown
- Block publishing with suggestion "Consider splitting into a thread" -- don't auto-fix
- Validate at both content generation time (Claude self-correction) and publish time (final safety net)
- Publish-time validation failures send notification via configured channel (WhatsApp/email)
- Thread splitting: sentence boundaries, fraction suffix "1/3", reserve space for numbering
- Maximum thread length: 10 tweets
- Character count > 280: hard error, blocks publish
- Mentions > 10: soft warning, still publishes
- Hashtags > 5: soft warning, still publishes
- Duplicate detection: soft warning against recent posts in DB

### Claude's Discretion
- Exact duplicate detection algorithm (fuzzy match threshold, time window)
- How to surface warnings during content generation vs publish time
- URL detection regex / pattern matching approach
- How to handle edge cases (partial URLs, unicode edge cases, zero-width characters)

### Deferred Ideas (OUT OF SCOPE)
- Media attachment validation (size, format, dimensions)
- Link preview validation (check if URLs are reachable)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TVAL-01 | Tweets validated with weighted character counting (URLs=23, emojis=2, CJK=2) before API submission | X's v3 config: scale=100, defaultWeight=200, 4 ranges at weight=100; URLs always 23 chars via t.co |
| TVAL-02 | Oversized tweets produce clear error messages with actual vs max count instead of misleading 403 | Pre-flight validation in X handler before `createTweet()` call; format: "Tweet is N/280 characters" |
| TVAL-03 | Thread splitter and tweet validator share a single `countTweetChars()` utility | New `tweet-validator.ts` exports `countTweetChars()`; `thread-splitter.ts` imports and uses it instead of `.length` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| None (custom) | N/A | Tweet character counting | Project decision: twitter-text unmaintained 6+ years; custom ~60 lines is smaller, maintainable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod/v4` | (existing) | Validation result schemas | Already in project, use for validation result types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom validator | `twitter-text` npm | Unmaintained since 2020, large bundle, project explicitly rejects it |
| Custom validator | `@drunkencure/tweet-character-counter` | Third-party dependency for ~60 lines of code; unnecessary complexity |

**Installation:**
```bash
# No new dependencies required -- pure TypeScript implementation
```

## Architecture Patterns

### Recommended Project Structure
```
src/core/utils/
  tweet-validator.ts        # NEW: countTweetChars(), validateTweet(), ValidationResult type
  tweet-validator.test.ts   # NEW: comprehensive tests with URL/emoji/CJK cases
  thread-splitter.ts        # MODIFIED: use countTweetChars() instead of .length
  thread-splitter.test.ts   # MODIFIED: update tests for weighted counting

src/platforms/handlers/
  x.handler.ts              # MODIFIED: add pre-flight validation before createTweet()
```

### Pattern 1: Weighted Character Counting Algorithm
**What:** X's v3 counting config uses scale=100 with defaultWeight=200 (2 chars). Four Unicode ranges get weight=100 (1 char). URLs detected in text are replaced with 23-char placeholders.
**When to use:** Every time tweet text needs length checking -- validation AND splitting.
**Example:**
```typescript
// Source: X developer docs + twitter-text v3.json config
// https://docs.x.com/fundamentals/counting-characters

interface TweetCountConfig {
  maxWeightedLength: 280;
  scale: 100;
  defaultWeight: 200;   // 2 chars (200/100)
  transformedURLLength: 23;
  ranges: Array<{ start: number; end: number; weight: number }>;
}

const TWEET_CONFIG: TweetCountConfig = {
  maxWeightedLength: 280,
  scale: 100,
  defaultWeight: 200,
  transformedURLLength: 23,
  ranges: [
    { start: 0, end: 4351, weight: 100 },      // Latin-1 + extensions
    { start: 8192, end: 8205, weight: 100 },    // General punctuation through ZWJ
    { start: 8208, end: 8223, weight: 100 },    // Punctuation (excluding directional marks)
    { start: 8242, end: 8247, weight: 100 },    // Quotation marks
  ],
};

function getCharWeight(codePoint: number): number {
  for (const range of TWEET_CONFIG.ranges) {
    if (codePoint >= range.start && codePoint <= range.end) {
      return range.weight;
    }
  }
  return TWEET_CONFIG.defaultWeight;
}

export function countTweetChars(text: string): number {
  // 1. Detect and replace URLs with fixed-length placeholders
  const withoutUrls = text.replace(URL_REGEX, '');
  const urlCount = (text.match(URL_REGEX) || []).length;

  // 2. NFC normalize (X requires this)
  const normalized = withoutUrls.normalize('NFC');

  // 3. Parse emoji sequences as single units (weight 200 = 2 chars)
  // 4. Sum weights of remaining code points
  let weightedSum = urlCount * TWEET_CONFIG.transformedURLLength * TWEET_CONFIG.scale;

  // Iterate by code point (handles surrogate pairs correctly)
  for (const char of normalized) {
    const cp = char.codePointAt(0)!;
    weightedSum += getCharWeight(cp);
  }

  return Math.ceil(weightedSum / TWEET_CONFIG.scale);
}
```

### Pattern 2: Emoji Sequence Handling
**What:** Emoji sequences with ZWJ (U+200D), skin tone modifiers (U+1F3FB-U+1F3FF), and variation selectors (U+FE0F) should count as a single 2-character unit, not multiple characters.
**When to use:** When iterating code points for weighted counting.
**Example:**
```typescript
// A family emoji like "person+ZWJ+person+ZWJ+child" visually renders as one glyph
// X counts the ENTIRE sequence as 2 characters
// Key: Parse emoji sequences as units, then assign weight 200 to each unit

// Use Unicode emoji regex to identify complete emoji sequences
// Segmenter API (Intl.Segmenter with "grapheme" granularity) handles this natively
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

function countGraphemes(text: string): number {
  let total = 0;
  for (const { segment } of segmenter.segment(text)) {
    const cp = segment.codePointAt(0)!;
    // If first code point is outside weight-100 ranges, entire grapheme = 2 chars
    total += getCharWeight(cp) / TWEET_CONFIG.scale;
  }
  return total;
}
```

### Pattern 3: Validation Result Type
**What:** Structured validation result with hard errors and soft warnings.
**When to use:** Return from `validateTweet()` function.
**Example:**
```typescript
interface TweetValidation {
  valid: boolean;           // false only for hard errors (char count > 280)
  charCount: number;        // weighted character count
  maxChars: number;         // 280
  errors: string[];         // hard blockers: "Tweet is 312/280 characters"
  warnings: string[];       // soft: "11 mentions detected (recommended max: 10)"
}

export function validateTweet(text: string): TweetValidation {
  const charCount = countTweetChars(text);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (charCount > 280) {
    errors.push(`Tweet is ${charCount}/280 characters`);
  }

  const mentionCount = (text.match(/@\w+/g) || []).length;
  if (mentionCount > 10) {
    warnings.push(`${mentionCount} mentions detected (recommended max: 10)`);
  }

  const hashtagCount = (text.match(/#\w+/g) || []).length;
  if (hashtagCount > 5) {
    warnings.push(`${hashtagCount} hashtags detected (recommended max: 5)`);
  }

  return { valid: errors.length === 0, charCount, maxChars: 280, errors, warnings };
}
```

### Anti-Patterns to Avoid
- **Using `string.length` for tweet counting:** Wrong for emojis (surrogate pairs), CJK, and URLs. The existing `thread-splitter.ts` does this -- must be fixed.
- **Counting each code point independently for emoji sequences:** A ZWJ sequence like "family emoji" has 7+ code points but should count as 2 characters. Use `Intl.Segmenter` for grapheme clustering.
- **Validating only at publish time:** Content generation should also validate so Claude can self-correct before the user sees an error.
- **Splitting first, validating second:** Thread splitter must use weighted counting during splitting, not just for final validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Grapheme clustering | Custom emoji regex parser | `Intl.Segmenter` API | Built into Bun/Node 16+; handles all ZWJ sequences, skin tones, flags correctly |
| URL detection | Simple `https?://` regex | Robust URL regex covering edge cases | URLs can have ports, query strings, fragments, parentheses, unicode domains |
| Unicode normalization | Manual normalization | `String.prototype.normalize('NFC')` | Built-in, matches X's requirement |

**Key insight:** The weighted counting algorithm itself is simple (~60 lines). The tricky parts are URL detection and emoji grapheme clustering -- both have built-in solutions (`Intl.Segmenter`, robust URL regex patterns).

## Common Pitfalls

### Pitfall 1: Surrogate Pairs in JavaScript
**What goes wrong:** JavaScript `string.length` counts UTF-16 code units, not Unicode code points. A CJK character or emoji uses 2 code units (surrogate pair), making `.length` report double.
**Why it happens:** JavaScript strings are UTF-16 internally.
**How to avoid:** Use `for...of` loop or spread `[...text]` to iterate by code point. Or use `Intl.Segmenter` for grapheme-level iteration.
**Warning signs:** Tests pass with ASCII-only text but fail with emoji/CJK.

### Pitfall 2: URL Regex Over-Matching or Under-Matching
**What goes wrong:** Simple `https?://\S+` regex matches too much (captures trailing punctuation) or too little (misses URLs without protocol).
**Why it happens:** URLs in tweets can appear with or without `https://`, can end with punctuation that's part of the surrounding sentence, or contain parentheses.
**How to avoid:** Use a well-tested URL regex. X counts URLs with or without protocol as 23 chars. Match: `https?://[^\s]+` and `[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(/[^\s]*)?` for protocol-less URLs. Trim trailing punctuation.
**Warning signs:** Character count differs from X's own count by exactly 23 (one URL miscounted).

### Pitfall 3: Thread Suffix Space Reservation
**What goes wrong:** Thread splitter fills a tweet to 280 chars, then appends " 1/3" suffix, creating a 284-char tweet.
**Why it happens:** Suffix is added after splitting instead of reserving space before.
**How to avoid:** Calculate suffix length first (" 1/N" where N is estimated thread count), subtract from maxLen before splitting. For threads > 9 tweets, suffix is 5 chars (" 1/10") instead of 4.
**Warning signs:** Last tweet in thread is exactly at 280 but first tweet overflows after numbering.

### Pitfall 4: NFC Normalization Changes Length
**What goes wrong:** Combining characters (like e + combining accent) normalize to single precomposed characters, changing code point count.
**Why it happens:** X requires NFC normalization; some input text is in NFD form.
**How to avoid:** Always normalize to NFC before counting. `text.normalize('NFC')`.
**Warning signs:** Same visible text produces different character counts on different systems.

### Pitfall 5: Zero-Width Characters
**What goes wrong:** Zero-width spaces (U+200B), zero-width non-joiners (U+200C), and other invisible characters still have weight.
**Why it happens:** They fall in the weight-100 range (U+200B and U+200C are in range U+2000-U+200D) so they count as 1 character each.
**How to avoid:** Don't strip them -- they genuinely count. But warn users if content has many invisible characters.
**Warning signs:** Tweet appears short visually but fails validation.

## Code Examples

### Core: countTweetChars Implementation
```typescript
// Source: X developer docs (https://docs.x.com/fundamentals/counting-characters)
// + twitter-text v3.json config (https://github.com/twitter/twitter-text)

const WEIGHT_100_RANGES = [
  [0, 4351],       // Latin-1 through extensions
  [8192, 8205],    // General punctuation through ZWJ
  [8208, 8223],    // Dashes and quotation marks
  [8242, 8247],    // Prime marks
] as const;

const SCALE = 100;
const DEFAULT_WEIGHT = 200;
const MAX_WEIGHTED = 280;
const URL_WEIGHT = 23;

// Robust URL regex: matches http(s):// URLs and bare domain URLs
const URL_PATTERN = /https?:\/\/[^\s<>\"]+|(?:[a-z0-9](?:[-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>\"]*)?/gi;

function codePointWeight(cp: number): number {
  for (const [start, end] of WEIGHT_100_RANGES) {
    if (cp >= start && cp <= end) return 100;
  }
  return DEFAULT_WEIGHT;
}

export function countTweetChars(text: string): number {
  // Step 1: NFC normalize
  const normalized = text.normalize('NFC');

  // Step 2: Find URLs and calculate their fixed contribution
  const urls = normalized.match(URL_PATTERN) || [];
  const textWithoutUrls = normalized.replace(URL_PATTERN, '');
  const urlWeightedTotal = urls.length * URL_WEIGHT * SCALE;

  // Step 3: Use Intl.Segmenter for proper grapheme clustering
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  let charWeightedTotal = 0;

  for (const { segment } of segmenter.segment(textWithoutUrls)) {
    // Each grapheme cluster gets weight of its first code point
    // Emoji sequences (ZWJ, skin tones) = one grapheme = weight 200 (2 chars)
    const cp = segment.codePointAt(0) ?? 0;
    charWeightedTotal += codePointWeight(cp);
  }

  return Math.ceil((urlWeightedTotal + charWeightedTotal) / SCALE);
}
```

### Thread Splitter Refactor
```typescript
// BEFORE (current -- uses .length):
if (content.length > 280) {
  tweets = splitIntoThread(content);
}

// AFTER (uses countTweetChars):
if (countTweetChars(content) > 280) {
  tweets = splitIntoThread(content);
}

// Inside splitIntoThread, all .length comparisons become countTweetChars() calls:
// paragraph.length <= maxLen  -->  countTweetChars(paragraph) <= maxLen
// merged.length <= maxLen     -->  countTweetChars(merged) <= maxLen
```

### Pre-Flight Validation in X Handler
```typescript
// In x.handler.ts publish() method, before createTweet():
import { countTweetChars, validateTweet } from '../../core/utils/tweet-validator.ts';

// For single tweets:
const validation = validateTweet(tweetText);
if (!validation.valid) {
  return {
    platform: 'x',
    status: 'failed',
    error: validation.errors.join('; '),
  };
}

// For threads, validate each tweet individually:
for (const [i, tweet] of tweets.entries()) {
  const v = validateTweet(tweet);
  if (!v.valid) {
    return {
      platform: 'x',
      status: 'failed',
      error: `Thread tweet ${i + 1}: ${v.errors.join('; ')}`,
    };
  }
}
```

### Duplicate Detection (Claude's Discretion Recommendation)
```typescript
// Simple approach: Jaccard similarity on word sets
// Time window: 7 days (recent enough to catch accidental reposts)
// Threshold: 0.8 similarity (80% word overlap = near-duplicate)

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(w => setB.has(w)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// Query recent posts from DB:
// SELECT content FROM posts WHERE platform = 'x' AND user_id = ? AND created_at > NOW() - INTERVAL '7 days'
// Compare each with jaccardSimilarity(); warn if any >= 0.8
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 140-char limit, all chars = 1 | 280-char weighted counting (v3 config) | 2017 (tweet length), 2018 (v3 config) | CJK/emoji = 2 chars; Latin = 1 char |
| twitter-text npm package | Custom implementation | Project decision (unmaintained since 2020) | ~60 lines vs 200KB+ dependency |
| No emoji sequence handling | Intl.Segmenter grapheme clustering | Available since Node 16 / Bun 1.0 | ZWJ emoji sequences correctly counted as 2 chars |
| URLs counted at actual length | All URLs = 23 chars (t.co) | 2011 (t.co launch) | Stable, unchanged for years |

**Deprecated/outdated:**
- `twitter-text` v3.1.0 (last update 2020): Still technically works but unmaintained; project rejects it
- `twitter-text` v1/v2 config: Old counting rules, superseded by v3

## Open Questions

1. **Bare domain URL detection scope**
   - What we know: X counts any URL (with or without protocol) as 23 chars
   - What's unclear: Exact rules for bare domain detection (does `example.com` count? What about `file.txt`?)
   - Recommendation: Match domains with known TLDs (`.com`, `.org`, `.net`, etc.) + any `https?://` prefix. Err on the side of matching (over-counting by 23 is safer than under-counting and getting a 403).

2. **Intl.Segmenter availability in Trigger.dev workers**
   - What we know: `Intl.Segmenter` is available in Bun (project runtime) and Node 16+
   - What's unclear: Whether Trigger.dev cloud workers run a Node version that supports it
   - Recommendation: Test in Trigger.dev worker environment. Fallback: iterate by code point with `for...of` and handle common emoji modifiers manually (U+FE0F variation selector, U+200D ZWJ, U+1F3FB-U+1F3FF skin tones).

## Sources

### Primary (HIGH confidence)
- [X Developer Docs - Counting Characters](https://docs.x.com/fundamentals/counting-characters) - Official counting rules, URL=23, emoji=2, CJK=2
- [twitter-text v3.json config](https://github.com/twitter/twitter-text/blob/master/config/v3.json) - scale=100, defaultWeight=200, 4 weight-100 ranges, emojiParsingEnabled=true
- Existing codebase: `src/core/utils/thread-splitter.ts`, `src/platforms/handlers/x.handler.ts`

### Secondary (MEDIUM confidence)
- [Twitter Developer Platform - Counting Characters](https://developer.twitter.com/en/docs/counting-characters) - Legacy URL, redirects to docs.x.com
- [twitter-text GitHub](https://github.com/twitter/twitter-text) - Reference implementation (unmaintained but algorithmically correct)

### Tertiary (LOW confidence)
- Blog posts on character counting edge cases - Useful for pitfall awareness but may be outdated

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No dependencies needed; algorithm is well-documented by X
- Architecture: HIGH - Clear integration points in existing codebase (`thread-splitter.ts`, `x.handler.ts`)
- Pitfalls: HIGH - Well-known issues with JavaScript string handling, documented in multiple sources

**Research date:** 2026-02-27
**Valid until:** Stable domain -- valid for 90+ days (X counting rules haven't changed since 2018 v3 config)
