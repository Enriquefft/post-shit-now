# Phase 3: Voice Profiling and Content Generation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

User can build a voice profile through adaptive interviews or content import, generate posts that sound like them (not generic AI), create images and videos with AI tools, review and edit drafts, and manage the draft lifecycle. Voice profiles support bilingual (en/es) with language-specific sections.

</domain>

<decisions>
## Implementation Decisions

### Voice Interview Flow
- **Adaptive depth interview**: Starts with 5-8 core questions, branches deeper based on answers. User can stop anytime and profile improves over time.
- **Spectrum-aware design**: Users are NOT binary (never-posted vs power-poster). The interview adapts to where the user falls on the experience spectrum. Detect from their answers and imported content how much social media experience they have, and adjust question depth/framing accordingly.
- **Profile contains 4 data dimensions beyond writing style**:
  1. Content pillars (3-5 topics they want to be known for)
  2. Comfort boundaries (topics/tones they explicitly avoid)
  3. Platform personas (different voice parameters per platform)
  4. Reference voices (accounts/people whose style they admire)
- **Both editing modes**: YAML is the source of truth and always directly editable. `/psn:voice edit` provides guided interactive experience for those who prefer it. Claude validates profile on next use.

### Content Import & Calibration
- **Import sources**: X post history (via OAuth), blog/website URLs (scrape + analyze), raw text samples (paste directly), and other user-created content sources (flexible input)
- **Adaptive threshold**: No hard minimum for content samples. Start generating with whatever's available. Profile improves as more content is added over time. Quality and diversity of samples matter more than quantity.
- **Dual calibration signals**: Track edits silently (what user changes in drafts) AND occasionally ask for explicit feedback. Both signals refine the voice profile.
- **Calibration convergence**: After N approved posts with consistently low edit distance, mark profile as "calibrated" with confidence score. Continue learning after calibration.

### Post Generation Experience
- **Flexible input**: Accept anything from a single word to detailed instructions. Claude adapts to how much the user provides — from "write about AI agents" to full briefs with angle, tone, and format specified.
- **Configurable variations**: Default to 1 best draft. User can request multiple variations when they want options.
- **Both inline + file drafts**: Default to inline conversation (Claude shows draft, user gives feedback). Also save to `drafts/` folder. User can switch to file-based editing anytime. Preference is configurable.
- **High-fidelity visual previews**: For posts that are visual (carousels, image posts, infographics), Claude generates a high-fidelity storyboard or mockup of how it would look. Only when it makes sense — not for plain text posts.
- **Smart format suggestion**: Claude picks the best format based on content + platform strengths (thread for nuanced X takes, carousel for LinkedIn data, etc.). Shows what other formats could work. User can request regeneration in different format.

### Media Generation
- **Provider selection**: User can set default image and video generators in config. Claude auto-selects the best tool when another would be clearly better (text overlay = Ideogram, photorealism = Flux, versatile = GPT Image). User preference respected but Claude suggests switching when appropriate.
- **Video scope**: Claude has full liberty to determine the right scope for video generation based on platform requirements and API capabilities. User can also configure video provider preferences.
- **Always approve media**: Never auto-attach generated media. Show generated image/video to user, who says "use this" or "regenerate". Safer flow.
- **3 attempts max**: Generate up to 3 times. After 3 failed attempts, suggest refining the prompt or providing their own image/video instead.

### Claude's Discretion
- Exact interview question wording and branching logic
- Voice profile YAML schema structure and field names
- Edit distance calculation method for calibration scoring
- Visual preview format and rendering approach
- Draft auto-pruning rules and timing
- How to extract voice patterns from imported content
- Platform-specific media processing (dimensions, formats, compression)

</decisions>

<specifics>
## Specific Ideas

- Interview should feel like a conversation with a social media strategist, not a form to fill out
- Visual previews should be genuinely high-fidelity — show how the post would appear on the actual platform, not a wireframe
- Calibration should be invisible to the user most of the time — they just notice posts getting better

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-voice-profiling-and-content-generation*
*Context gathered: 2026-02-19*
