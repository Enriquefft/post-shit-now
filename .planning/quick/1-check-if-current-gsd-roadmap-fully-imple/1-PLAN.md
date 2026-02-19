---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/1-check-if-current-gsd-roadmap-fully-imple/GAP-ANALYSIS.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Every PRD feature/capability is mapped to a roadmap phase or identified as a gap"
    - "Every roadmap requirement ID traces back to a specific PRD section"
    - "Gaps between PRD vision and roadmap coverage are clearly documented with severity"
  artifacts:
    - path: ".planning/quick/1-check-if-current-gsd-roadmap-fully-imple/GAP-ANALYSIS.md"
      provides: "Complete gap analysis report"
      min_lines: 100
  key_links: []
---

<objective>
Perform a comprehensive gap analysis comparing PRD.md against .planning/ROADMAP.md to identify any PRD requirements, features, or capabilities that are missing, partially covered, or could fall through the cracks in the current 8-phase roadmap.

Purpose: Ensure the roadmap fully implements the PRD vision before proceeding with Phase 2+ planning.
Output: GAP-ANALYSIS.md with detailed findings.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@PRD.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Comprehensive PRD vs Roadmap gap analysis</name>
  <files>.planning/quick/1-check-if-current-gsd-roadmap-fully-imple/GAP-ANALYSIS.md</files>
  <action>
Read PRD.md thoroughly (all sections) and .planning/ROADMAP.md + .planning/REQUIREMENTS.md. Perform a systematic comparison:

1. **PRD Section-by-Section Mapping**: For each major PRD section, identify which roadmap phase(s) cover it:
   - Product Overview / Two-Hub Architecture
   - Target Users
   - Platforms (all 4 + constraints)
   - Multi-Language Support
   - Architecture (data split, hub separation)
   - The Creative Brain (intelligence layer, competitive intel, content archetypes, remixing, recycling)
   - Idea Bank and Pipeline (maturity stages, surfacing, claiming, timely ideas)
   - Voice Profile and Onboarding (all 3 profiles, interview, import, calibration, blank-slate path)
   - Learning Loop (3 feedback channels, preference model, update cadence, autonomy levels, company brand learning)
   - Content Series (definition, lifecycle, company series, management)
   - Engagement Engine (flow, platform-specific, safety, /psn:engage)
   - Commands (all 10 slash commands with their full flows)
   - Notifications (WAHA, tiers, structured commands, state machine, fatigue prevention, company routing)
   - Content Generation Engine (platform formats, media generation - image + video)
   - Company Account Coordination (multi-user, approval, calendar)
   - Employee Advocacy
   - Posting Frequency Targets (ramping system)
   - Hub Tasks (all 8 Trigger.dev tasks)
   - Installation and Setup (all flows)
   - Content Strategy System (strategy.yaml, auto-generation)
   - Phased Rollout (PRD's own phases vs roadmap phases)
   - Risks and Mitigations
   - Success Metrics

2. **Requirement Coverage Check**: Verify all 143 requirement IDs in REQUIREMENTS.md appear in at least one roadmap phase's Requirements line. Check for any that are listed in REQUIREMENTS.md but missing from ROADMAP.md phase assignments.

3. **PRD Phased Rollout vs Roadmap Phases**: The PRD has its own 7-phase rollout suggestion (Phase 1a through Phase 7). Compare this against the roadmap's 8 phases. Identify any feature the PRD places earlier/later than the roadmap, or features the PRD mentions that the roadmap omits entirely.

4. **Gap Categories**: For each finding, classify as:
   - **MISSING**: PRD describes it, roadmap has no coverage
   - **PARTIAL**: Roadmap covers some aspects but misses specific PRD details
   - **RESEQUENCED**: Roadmap places it in a different phase than PRD suggests (note if this is intentional/reasonable)
   - **IMPLICIT**: Not explicitly in roadmap but likely covered as part of a broader task (flag for verification)

5. **Severity**: For each gap, rate as:
   - **Critical**: Core functionality that users expect, would be noticed if missing
   - **Important**: Enhances the product significantly, should be addressed before v1
   - **Minor**: Nice-to-have details, can be deferred without impact

Write the report to GAP-ANALYSIS.md with:
- Executive summary (overall coverage assessment)
- Detailed findings table (PRD section, requirement IDs, roadmap phase, gap type, severity, notes)
- PRD phased rollout comparison table
- List of all gaps sorted by severity
- Recommendations (what to add/change in the roadmap)
  </action>
  <verify>
The file .planning/quick/1-check-if-current-gsd-roadmap-fully-imple/GAP-ANALYSIS.md exists and contains:
- At least 100 lines
- An executive summary section
- A detailed mapping table covering all PRD sections
- A gaps list with severity ratings
- Recommendations section
  </verify>
  <done>
GAP-ANALYSIS.md contains a complete, actionable comparison of PRD.md vs ROADMAP.md with every PRD feature mapped to a roadmap phase or flagged as a gap, severity-rated, with clear recommendations.
  </done>
</task>

</tasks>

<verification>
- GAP-ANALYSIS.md covers all major PRD sections (20+ sections)
- Every one of the 143 requirement IDs is accounted for
- Gaps are categorized and severity-rated
- Recommendations are specific and actionable
</verification>

<success_criteria>
- Complete gap analysis report exists at .planning/quick/1-check-if-current-gsd-roadmap-fully-imple/GAP-ANALYSIS.md
- Every PRD section has been compared against roadmap phases
- All gaps identified with type (MISSING/PARTIAL/RESEQUENCED/IMPLICIT) and severity
- Report includes actionable recommendations for roadmap updates
</success_criteria>

<output>
The GAP-ANALYSIS.md file serves as the deliverable. No summary file needed for quick tasks.
</output>
