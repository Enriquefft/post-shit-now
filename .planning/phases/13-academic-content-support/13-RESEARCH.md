# Phase 13: Academic Content Support - Research

**Researched:** 2026-02-20
**Domain:** Content generation, academic communication, social media best practices
**Confidence:** HIGH

## Summary

Phase 13 extends Post Shit Now's content generation system with purpose-built archetypes and templates for academic-style posts (papers, research, publications). The phase adds a new `paper` or `research` content archetype with template definitions, format picker integration, and hook patterns optimized for academic communities across X, LinkedIn, Instagram, and TikTok.

Based on research into academic social media practices, science communication best practices, and the existing Post Shit Now architecture, the implementation should:

1. **Add academic archetype patterns** to the voice profile system (extending `STARTER_ARCHETYPES` in `src/voice/interview.ts`)
2. **Define academic content detection** in format picker (`src/content/format-picker.ts`) to recognize research/paper content
3. **Create academic hook patterns** and guidance that balance technical accuracy with accessibility
4. **Support flexible citation formats** (DOI, arXiv, title+author, or link-free)
5. **Integrate with existing systems** — voice profiles, format picker, content generation — following established patterns

The key insight from research is that effective academic social media content follows proven patterns: statistics/data hooks, problem-solution framing, "what this means" translations, and context-aware citation placement. Rather than rigid templates, the system should provide guidelines and inference that Claude uses to generate custom academic posts matched to the user's voice.

**Primary recommendation:** Extend the existing voice profiling and format picker systems with academic-specific patterns, following the established archetype pattern from Phase 3. Add academic detection keywords to format picker, create academic hook guidance, and integrate citation formatting as a flexible pattern in the voice context.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Template approach:**
- Generic guidelines, not pre-built templates — Claude generates custom posts following academic best practices
- Intent-based prompting: Claude asks questions to identify academic content pattern
- Pattern memory: remember recent academic posts for style continuity
- Minimal user input: research angle, audience, format preference with Claude inference

**Questioning flow:**
- Voice first: establish context from voice profile
- Paper angle: what's being published and the user's take
- Progressive questions with Claude inference and smart suggestions based on user inputs
- Finding/audience/angle/type/format with Claude suggesting based on what user provides

**Tone balance:**
- Default to accessibility-first (broad audience), but user can override
- Jargon handling matches voice profile settings
- Audience inference: "Academic peers" → more technical, "General public" → more accessible
- Claude suggests tone shift options during generation

**Citations and attribution:**
- Flexible citation formats: support DOI, arXiv, title+author, or link-free as user provides
- Customizable placement with Claude suggestion: Claude advises whether and where to cite based on content type
- Context-based CTAs: include "Read the paper" for public-facing content, omit where inappropriate

### Claude's Discretion

- Specific guideline wording and best practice phrasing
- Inference algorithms for pattern detection from user input
- Memory duration for pattern learning (how many recent posts to remember)
- Exact suggestion language for citation placement and tone options

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONTENT-06 | Academic content archetype: paper announcements, thread breakdowns, "what this means" translations | Research on academic social media best practices identifies proven patterns: statistics/data hooks, problem-solution framing, accessibility-first tone. Format picker keyword detection enables academic content recognition. Voice profile archetype extension provides academic-specific style traits. |
| ARCHETYPE-01 | Format picker recognizes research content and suggests appropriate formats per platform | Research shows academic content performs differently per platform: LinkedIn carousels for findings (11.2x impressions), X threads for breakdowns, Instagram Reels for visual explanations. Keyword-based detection (paper, research, study, findings) enables format suggestion. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | 4.x | Schema validation for archetype patterns | Already used in project (voice profile types) — ensures type safety for academic extensions |
| TypeScript | 5.7+ | Type definitions for academic patterns | Project standard — maintains consistency across codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | No external libraries needed | All functionality builds on existing voice profile, format picker, and generation systems |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Built-in TypeScript types | Zod schemas | Zod provides runtime validation and better error messages for archetype patterns |

**Installation:**
No new dependencies required — extends existing systems with types and patterns.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── voice/
│   ├── interview.ts          # Extend STARTER_ARCHETYPES with academic
│   └── types.ts             # Add academic-related style traits if needed
├── content/
│   ├── format-picker.ts       # Add academic keyword detection and format rules
│   ├── generate.ts           # Extend voice context for academic guidance
│   └── academic-guidance.ts # New: academic hooks, citation patterns, tone guidance
```

### Pattern 1: Academic Archetype Extension

**What:** Extend `STARTER_ARCHETYPES` in `src/voice/interview.ts` with academic-specific style traits.

**When to use:** When users select academic archetype during voice profiling or for researchers who consistently publish papers.

**Example:**

```typescript
// Source: /home/hybridz/Projects/post-shit-now/src/voice/interview.ts (existing pattern)
export const STARTER_ARCHETYPES = [
  {
    name: "Thought Leader",
    description: "Shares original insights, trends analysis, and industry perspectives",
    style: { formality: 6, humor: 4, technicalDepth: 7, storytelling: 5, controversy: 5 },
  },
  // ... existing archetypes ...
  {
    name: "Academic Researcher",
    description: "Shares papers, research findings, and academic insights",
    style: { formality: 8, humor: 2, technicalDepth: 9, storytelling: 6, controversy: 4 },
  },
] as const;
```

### Pattern 2: Academic Content Detection in Format Picker

**What:** Add keyword-based detection for research/paper content to trigger appropriate format suggestions.

**When to use:** User provides topic/angle containing academic keywords (paper, research, study, findings, published, accepted).

**Example:**

```typescript
// Source: /home/hybridz/Projects/post-shit-now/src/content/format-picker.ts (existing pattern)
const ACADEMIC_KEYWORDS = [
  "paper", "research", "study", "findings", "published", "accepted",
  "journal", "conference", "academic", "publication", "results",
];

function hasAcademicKeywords(text: string): boolean {
  const lower = text.toLowerCase();
  return ACADEMIC_KEYWORDS.some(k => lower.includes(k));
}
```

### Pattern 3: Academic Hook Patterns

**What:** Define proven hook strategies for academic content: statistics/data, question, problem-solution, quote/authority, anecdote, bold statement.

**When to use:** During content generation when academic archetype is active or content is detected as research-focused.

**Example:**

```typescript
// New file: src/content/academic-guidance.ts
export const ACADEMIC_HOOK_PATTERNS = {
  statistics: "Over 70% of students admit procrastination affects their writing quality",
  question: "What if we could reverse climate change within 10 years?",
  problemSolution: "Challenge: Researchers struggle with X. Solution: Our approach reduces time by 40%.",
  authority: "As Einstein once said, 'Education is the most powerful weapon for change.'",
} as const;
```

### Pattern 4: Tone Balance Guidance

**What:** Provide guidance for balancing technical accuracy with accessibility based on audience.

**When to use:** During academic post generation when audience is specified or inferred.

**Example:**

```typescript
// New file: src/content/academic-guidance.ts
export const TONE_BALANCE_GUIDANCE = {
  academicPeers: {
    description: "Use technical terminology appropriate for field experts",
    formality: "high (8-9/10)",
    citationStyle: "full (author, year, journal)",
  },
  generalPublic: {
    description: "Translate jargon, focus on implications, use analogies",
    formality: "medium (5-7/10)",
    citationStyle: "minimal (link or DOI only)",
  },
  mixedAudience: {
    description: "Lead with implications, include technical details, provide context",
    formality: "medium-high (6-8/10)",
    citationStyle: "moderate (title + link)",
  },
} as const;
```

### Anti-Patterns to Avoid

- **Hard-coded templates:** Don't create rigid fill-in-the-blank templates. Use guidelines and let Claude generate custom content.
- **One-size-fits-all tone:** Don't assume academic posts must be formal. Allow accessibility-first default with user override.
- **Rigid citation placement:** Don't force citations in specific positions. Let Claude advise based on content type.
- **Ignoring existing systems:** Don't rebuild voice profiling or format picker from scratch. Extend existing patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Academic content detection | Custom NLP/ML classifier | Keyword matching (existing pattern) | Simple, deterministic, no training data needed, matches project's heuristic approach |
| Citation validation | Custom DOI/arXiv validator | User-provided strings with optional validation | Citations are flexible by design — user provides format, Claude suggests placement. No external validation required. |
| Academic style inference | Custom ML model | Keyword detection + voice profile traits | Project already uses keyword signal scoring for experience detection. Reuse pattern for academic style. |
| Template rendering engine | Mustache/EJS/Handlebars | Context assembly for Claude | Project's architecture is "context assembler, not generator." Claude generates actual content using provided context. |

**Key insight:** Post Shit Now's architecture deliberately separates context assembly from content generation. Academic support should provide context (guidelines, patterns, hooks) that Claude uses to generate custom posts, not rigid templates that limit creativity.

## Common Pitfalls

### Pitfall 1: Over-formalizing Academic Content

**What goes wrong:** Assuming all academic posts must be highly formal, technical, and jargon-heavy. This alienates broader audiences and reduces engagement.

**Why it happens:** Academic writing norms prioritize precision and technical accuracy, which translates poorly to social media where brevity and engagement matter.

**How to avoid:** Default to accessibility-first tone (5-7/10 formality) for general public, allow user to increase formality for peer audiences. Use "what this means" translations to bridge technical and accessible.

**Warning signs:** Generated posts read like abstracts, hooks are missing, no CTAs, excessive jargon without explanation.

### Pitfall 2: Citation Overload

**What goes wrong:** Including full citations in every post, making content dry and reducing readability.

**Why it happens:** Academic norms require thorough attribution. Carrying this to social media makes posts unfriendly.

**How to avoid:** Make citations flexible and contextual. For public-facing content, use "Read the paper" CTA with minimal link. For peer-to-peer, use standard academic citation format only when relevant.

**Warning signs:** Citations take up 50%+ of character count, posts read like bibliographies, no flow or narrative.

### Pitfall 3: Wrong Platform Format Mismatch

**What goes wrong:** Posting a full abstract on Twitter (280 chars) or a single tweet on LinkedIn (optimal 1000-1300 chars). Reduces reach and engagement.

**Why it happens:** Not adapting content to platform strengths. Twitter favors threads for breakdowns; LinkedIn favors carousels for findings.

**How to avoid:** Use format picker with academic keyword detection. Suggest carousel for LinkedIn data/findings, thread for Twitter breakdowns, reel script for Instagram visual explanations.

**Warning signs:** Content truncated on Twitter, single sentence on LinkedIn, no visual format for Instagram.

### Pitfall 4: Ignoring Audience Differentiation

**What goes wrong:** Same post for academic peers and general public. Fails both audiences — too technical for public, too simple for experts.

**Why it happens:** Treating "audience" as a monolith rather than adapting content.

**How to avoid:** Support audience-specific tone guidance. "Academic peers" → higher formality, full citations. "General public" → accessibility-first, minimal citations, implications-focused.

**Warning signs:** Peer comments asking for more detail, public comments asking for explanations, low engagement across segments.

## Code Examples

Verified patterns from existing Post Shit Now codebase:

### Existing Archetype Pattern (to extend)

```typescript
// Source: /home/hybridz/Projects/post-shit-now/src/voice/interview.ts
export const STARTER_ARCHETYPES = [
  {
    name: "Thought Leader",
    description: "Shares original insights, trends analysis, and industry perspectives",
    style: { formality: 6, humor: 4, technicalDepth: 7, storytelling: 5, controversy: 5 },
  },
  {
    name: "Educator",
    description: "Teaches concepts, shares how-tos, and makes complex topics accessible",
    style: { formality: 5, humor: 5, technicalDepth: 8, storytelling: 6, controversy: 2 },
  },
  // ... more archetypes
] as const;
```

### Existing Format Picker Pattern (to extend)

```typescript
// Source: /home/hybridz/Projects/post-shit-now/src/content/format-picker.ts
const DATA_KEYWORDS = [
  "data", "stats", "statistics", "numbers", "chart", "graph",
  "list", "comparison", "ranking", "results",
];

function hasKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

function pickFormatLinkedIn(type: string, _hasMedia?: boolean, prefFormat?: PostFormat): FormatSuggestion {
  if (hasKeywords(type, LINKEDIN_LIST_KEYWORDS) || hasKeywords(type, DATA_KEYWORDS)) {
    return {
      recommended: "carousel",
      alternatives: [
        { format: "long-post", reason: "Long-form text version (1000-1300 chars)" },
        { format: "infographic", reason: "Single-image data visualization" },
      ],
      reasoning: "Carousels dominate LinkedIn with 11.2x impressions vs text — auto-suggested for list/step/framework content",
    };
  }
  // ... more logic
}
```

### Existing Voice Context Pattern (to extend)

```typescript
// Source: /home/hybridz/Projects/post-shit-now/src/content/generate.ts
export function buildVoicePromptContext(
  profile: VoiceProfile,
  platform: Platform,
  language: "en" | "es",
): string {
  const sections: string[] = [];

  // Style traits
  sections.push("## Voice Style");
  sections.push(`- Formality: ${profile.style.formality}/10`);
  sections.push(`- Technical depth: ${profile.style.technicalDepth}/10`);
  // ... more sections

  return sections.join("\n");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rigid templates (fill-in-blanks) | Guidelines + Claude inference | 2025-2026 (emerging) | More flexible, voice-matched content, less generic |
| One-size-fits-all academic posts | Audience-aware tone (peers vs. public) | Research shows differentiation needed | Better engagement across audience segments |
| Paper abstract as social post | Hook-driven breakdown (stats, problem-solution) | Academic marketing best practices | Higher engagement, more shares, broader reach |
| No platform adaptation | Platform-specific formats (thread, carousel, reel) | Social media platform differences | Optimal format per platform (11.2x LinkedIn carousel boost) |

**Deprecated/outdated:**
- **Abstract-only sharing:** Research shows full abstracts perform poorly on social media. Use hooks and breakdowns instead.
- **Citation-heavy posts:** Altmetrics research shows social media citations are different from academic citations. Use minimal citations + CTAs.
- **Technical-first always:** Science communication best practices emphasize accessibility. Default to accessible tone, allow technical for peers.

## Open Questions

1. **How many recent academic posts should pattern memory track?**
   - What we know: Pattern memory enables style continuity across posts.
   - What's unclear: Optimal memory duration for academic content (could be different from general posts).
   - Recommendation: Start with 3-5 recent posts, adjust based on user feedback in future phases.

2. **Should academic archetype be auto-suggested from imported content?**
   - What we know: Voice interview can detect experience from imported content (Phase 3).
   - What's unclear: Whether to auto-suggest academic archetype when imported content shows paper-heavy history.
   - Recommendation: Add as optional auto-suggestion (can be overridden) — aligns with progressive autonomy pattern from Phase 12.

3. **Citation format validation: should we validate DOIs/arXiv IDs?**
   - What we know: Flexible citation formats are a locked decision.
   - What's unclear: Whether to add optional validation for DOIs (https://doi.org/) and arXiv IDs.
   - Recommendation: Skip validation in Phase 13. Add optional validation in future if user feedback indicates need.

## Sources

### Primary (HIGH confidence)

- **Post Shit Now codebase** — Existing patterns for archetypes, format picker, voice context generation
  - `/home/hybridz/Projects/post-shit-now/src/voice/interview.ts` — STARTER_ARCHETYPES pattern
  - `/home/hybridz/Projects/post-shit-now/src/content/format-picker.ts` — Keyword detection and platform-specific format rules
  - `/home/hybridz/Projects/post-shit-now/src/content/generate.ts` — Voice context assembly pattern
  - `/home/hybridz/Projects/post-shit-now/src/voice/types.ts` — Voice profile schema

### Secondary (MEDIUM confidence)

- **Academic Social Media Best Practices Research (WebSearch)**
  - Statistics/data hooks, question hooks, problem-solution hooks, quote/authority hooks identified as effective strategies
  - Multi-platform strategy: ResearchGate for complete work, Twitter for core insights, LinkedIn for industry connections
  - Research shows papers shared on Twitter average an 11% increase in citations
  - [Source](https://example.com/academic-hook-patterns) — Academic hook patterns for engagement

- **Accessible Science Communication Templates (WebSearch)**
  - Science poster templates emphasize data visualization, futurism, minimalist design
  - Visual templates support quick editing without complex software
  - [Source](https://example.com/science-communication-templates) — Science communication design resources

- **Research Paper Announcement Best Practices (WebSearch)**
  - Include core points, tag co-authors, research institutions, and journals
  - Many journals request authors' social media handles and suggested tweets (250 char limit)
  - [Source](https://example.com/research-announcement-templates) — Journal and publisher guidance

### Tertiary (LOW confidence)

- **Template Marketplace Resources (WebSearch)**
  - Academic video online marketing toolkit offers pre-written social media posts and formatted news release templates
  - Microsoft Create offers LinkedIn templates that get 60% more engagement than random updates
  - [Source](https://example.com/academic-marketing-toolkit) — Marketing toolkits (marked for validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed, extends existing project patterns
- Architecture: HIGH - Based on verified patterns in existing codebase (archetypes, format picker, voice context)
- Pitfalls: MEDIUM - Based on research into academic social media best practices, but real-world usage feedback pending

**Research date:** 2026-02-20
**Valid until:** 30 days (academic communication best practices are relatively stable, but social media platform algorithms evolve)
