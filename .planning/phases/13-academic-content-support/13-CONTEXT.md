# Phase 13: Academic Content Support - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

## Phase Boundary

Building purpose-built archetypes and templates for academic-style posts (papers, research) across platforms. This includes template definitions, format picker integration, and hook patterns optimized for academic communities. The phase delivers guidelines and inference for Claude to generate voice-matched academic content — not rigid templates.

## Implementation Decisions

### Template approach
- Generic guidelines, not pre-built templates — Claude generates custom posts following academic best practices
- Intent-based prompting: Claude asks questions to identify academic content pattern
- Pattern memory: remember recent academic posts for style continuity
- Minimal user input: research angle, audience, format preference with Claude inference

### Questioning flow
- Voice first: establish context from voice profile
- Paper angle: what's being published and the user's take
- Progressive questions with Claude inference and smart suggestions based on user inputs
- Finding/audience/angle/type/format with Claude suggesting based on what user provides

### Tone balance
- Default to accessibility-first (broad audience), but user can override
- Jargon handling matches voice profile settings
- Audience inference: "Academic peers" → more technical, "General public" → more accessible
- Claude suggests tone shift options during generation

### Citations and attribution
- Flexible citation formats: support DOI, arXiv, title+author, or link-free as user provides
- Customizable placement with Claude suggestion: Claude advises whether and where to cite based on content type
- Context-based CTAs: include "Read the paper" for public-facing content, omit where inappropriate

### Claude's Discretion
- Specific guideline wording and best practice phrasing
- Inference algorithms for pattern detection from user input
- Memory duration for pattern learning (how many recent posts to remember)
- Exact suggestion language for citation placement and tone options

## Specific Ideas

No specific requirements — open to standard approaches for academic content guidelines and inference-based generation.

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 13-academic-content-support*
*Context gathered: 2026-02-20*
