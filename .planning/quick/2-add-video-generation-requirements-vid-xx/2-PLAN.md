---
phase: quick
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "VID-xx requirements exist in REQUIREMENTS.md matching PRD video generation section"
    - "Phase 3 in ROADMAP.md references VID-xx requirements"
    - "Traceability table includes all VID-xx entries mapped to Phase 3"
    - "Coverage count is updated to reflect new requirements"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "Video Generation requirements section"
      contains: "VID-01"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 3 updated with VID-xx"
      contains: "VID-01"
  key_links:
    - from: ".planning/REQUIREMENTS.md"
      to: ".planning/ROADMAP.md"
      via: "VID-xx IDs referenced in Phase 3 Requirements line"
      pattern: "VID-0[1-5]"
---

<objective>
Add video generation requirements (VID-01 through VID-05) to REQUIREMENTS.md and update ROADMAP.md Phase 3 to include them.

Purpose: The PRD describes video generation in detail (Kling, Runway, Pika providers with cost estimates, fully-generated vs semi-automated content types) but no VID-xx requirement IDs exist. Image generation has IMG-01 through IMG-05 but video has nothing equivalent, leaving a traceability gap.
Output: Updated REQUIREMENTS.md with Video Generation section and updated ROADMAP.md Phase 3.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@PRD.md (video generation section around lines 1678-1698)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add VID-xx requirements to REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
Add a new "### Video Generation" section immediately after the "### Image Generation" section (after IMG-05, before "### Analytics"). Add these requirements following the exact format of existing entries (checkbox, bold ID, colon, description):

- [ ] **VID-01**: User can generate animated text/quote videos for posts (fully automated, no recording needed)
- [ ] **VID-02**: User can generate b-roll with voiceover using TTS for posts (fully automated, no recording needed)
- [ ] **VID-03**: User can generate short video clips using Kling (realistic motion, product demos), Runway (stylized, image-to-video), or Pika (animated clips, text-to-video)
- [ ] **VID-04**: Claude picks the best video generation tool based on content type (matching IMG-05 pattern for images)
- [ ] **VID-05**: Generated video meets platform-specific format and length requirements (X: under 15s optimal, TikTok: 60s+ favored, Instagram Reels: watch-time optimized)

Then update the traceability table: add 5 rows for VID-01 through VID-05, all mapped to Phase 3, status Pending. Insert them after the IMG-05 row to maintain the section grouping.

Finally update the coverage count at the bottom:
- Change "v1 requirements: 143 total" to "v1 requirements: 148 total"
- Change "Mapped to phases: 143" to "Mapped to phases: 148"
  </action>
  <verify>
Grep for "VID-0[1-5]" in REQUIREMENTS.md — should find exactly 5 requirement lines plus 5 traceability rows (10 matches). Grep for "148 total" should find 1 match.
  </verify>
  <done>REQUIREMENTS.md has a Video Generation section with VID-01 through VID-05, traceability table updated, coverage count says 148.</done>
</task>

<task type="auto">
  <name>Task 2: Update ROADMAP.md Phase 3 to include VID-xx</name>
  <files>.planning/ROADMAP.md</files>
  <action>
In Phase 3 details, update the **Requirements** line to add VID-01 through VID-05. Currently it reads:
"**Requirements**: VOICE-01, VOICE-02, ..., IMG-04, IMG-05, CONTENT-01, CONTENT-02, CONFIG-02, CONFIG-03"

Add VID-01, VID-02, VID-03, VID-04, VID-05 after IMG-05 (before CONTENT-01) so that image and video generation requirements are grouped together.

Also update Success Criteria item 4 to mention video alongside images. Currently:
"4. User can generate images using GPT Image, Ideogram 3, or Flux 2, with Claude picking the best tool and sharp processing for platform specs"

Change to:
"4. User can generate images using GPT Image, Ideogram 3, or Flux 2, and generate videos using Kling, Runway, or Pika, with Claude picking the best tool for the job and media processed to meet platform specs"

Do NOT change the Phase 3 overview line in the phase list at the top — it already says "image generation" which is close enough (the detailed section has the specifics).
  </action>
  <verify>
Grep for "VID-01" in ROADMAP.md — should find it in the Phase 3 Requirements line. Grep for "Kling" in ROADMAP.md — should find it in Success Criteria item 4.
  </verify>
  <done>ROADMAP.md Phase 3 Requirements line includes VID-01 through VID-05 and Success Criteria mentions video generation providers.</done>
</task>

</tasks>

<verification>
1. `grep -c "VID-0" .planning/REQUIREMENTS.md` returns 10 (5 requirements + 5 traceability rows)
2. `grep "VID-01, VID-02, VID-03, VID-04, VID-05" .planning/ROADMAP.md` finds the Phase 3 Requirements line
3. `grep "148 total" .planning/REQUIREMENTS.md` confirms updated count
4. No other phases reference VID-xx (video gen belongs exclusively to Phase 3)
</verification>

<success_criteria>
- VID-01 through VID-05 exist in REQUIREMENTS.md Video Generation section
- Traceability table maps all 5 to Phase 3
- Coverage count updated from 143 to 148
- ROADMAP.md Phase 3 Requirements line includes VID-01 through VID-05
- Phase 3 Success Criteria mentions video generation
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-video-generation-requirements-vid-xx/2-SUMMARY.md`
</output>
