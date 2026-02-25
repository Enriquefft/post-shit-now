---
phase: quick
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - users/enrique/SETUP-GUIDE.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Enrique has a clear, step-by-step setup guide for Post Shit Now"
    - "Guide covers his specific use case: solo founder, multiple brands, founder-led sales"
    - "Guide starts with psn:setup and explains the complete flow from zero to posting"
  artifacts:
    - path: "users/enrique/SETUP-GUIDE.md"
      provides: "Complete setup guide tailored to Enrique's use case"
      min_lines: 200
  key_links:
    - from: "users/enrique/SETUP-GUIDE.md"
      to: ".claude/commands/psn/setup.md"
      via: "References setup command documentation"
      pattern: "/psn:setup"
---

<objective>
Create a comprehensive setup guide for Enrique tailored to his specific use case: solo founder managing multiple brands (PSN, Genera, 404tf), launching papers, job seeking, wants to establish social media presence (LinkedIn, Instagram, X) for founder-led sales, starting from zero.

Purpose: Provide Enrique with a clear, practical walkthrough of Post Shit Now setup starting with psn:setup, addressing his unique multi-brand scenario and lack of social media experience.

Output: users/enrique/SETUP-GUIDE.md - a complete, beginner-friendly setup guide.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@users/enrique/description.md
@.claude/commands/psn/setup.md
@docs/entity-creation-workflow.md
@docs/index.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Enrique's tailored setup guide</name>
  <files>users/enrique/SETUP-GUIDE.md</files>
  <action>
Create users/enrique/SETUP-GUIDE.md with the following structure:

**Header & Context**
- Title: "Post Shit Now Setup Guide - For Enrique"
- Brief overview of his situation (solo founder, 3 brands, launching papers, job seeking, zero social media presence)
- Goal: Establish founder-led social media presence for sales, credibility, and networking

**Prerequisites Section**
- What he needs before starting:
  - Neon account (link to neon.tech)
  - Trigger.dev account (link to trigger.dev)
  - Platform accounts ready (LinkedIn, Instagram, X)
- Time estimate for setup (30-45 minutes)

**Step-by-Step Walkthrough**

**Step 1: Initial Setup (psn:setup)**
- Command: `/psn:setup` (explain this runs the full setup wizard)
- What happens during setup (5 steps):
  1. API keys collection (NEON_API_KEY, TRIGGER_SECRET_KEY) - explain where to get each
  2. Database creation (Neon project, encryption key generation)
  3. Migrations (automatic - no action needed)
  4. Trigger.dev configuration (project ref setup)
  5. Validation (checks all connections)
- Common pitfalls and how to fix them
- Validation check: How to confirm setup worked

**Step 2: Understanding Your Personal Hub**
- Explain what a Personal Hub is (his central PSN installation)
- All configuration files are local (security)
- He can create Company Hubs later (not needed initially)

**Step 3: Create Entities for Each Brand**
- Explain entity concept (separate voice profiles per project/brand)
- Recommended entities for Enrique:
  1. "Post Shit Now" - main product
  2. "Genera" - his CTO role, edtech
  3. "404tf" - co-founder role
  4. "Personal" - for job seeking, papers, personal brand (critical for his use case)
- Commands:
  - List entities: `/psn:setup entity --list`
  - Create entity: `/psn:setup entity --create "Personal"`
- Emphasize: The "Personal" entity is most important for his job seeking and papers launch

**Step 4: Voice Profile Setup for Each Entity**
- Explain voice interview (answers natural language, no technical knowledge needed)
- Start with "Personal" entity first (most critical for his goals)
- Commands:
  - Start interview: `/psn:setup voice`
  - The system will ask about:
    - Maturity level (he should select "starting" - he's new to social media)
    - His background (edtech CTO, solo founder, launching papers)
    - Values (what he cares about)
    - Content pillars (topics: edtech, founder journey, tech leadership, job seeking insights)
    - Platform preferences (LinkedIn first, then IG, then X - matches his stated goals)
- How to complete interview: `/psn:setup voice complete`

**Step 5: Connect Social Platforms**
- Order of connection (start with LinkedIn - he already uses it)
- Commands:
  - LinkedIn: `/psn:setup linkedin`
  - X: `/psn:setup x`
  - Instagram: `/psn:setup instagram`
- What happens during OAuth flow (authenticate once, used for all entities)
- Platform-specific notes:
  - LinkedIn: Professional network, focus on job seeking and thought leadership
  - X: Founder journey, tech insights, real-time engagement
  - Instagram: Behind-the-scenes, papers launch visual content

**Step 6: Generate Your First Post**
- Command: `/psn:post` (or provide a topic)
- Example prompts for Enrique:
  - "Write a post about launching my first paper as a researcher"
  - "Share insights on being a solo founder while job seeking"
  - "Thoughts on founder-led sales from experience with Post Shit Now"
- Explain how the system uses his voice profile
- Review before posting (always safe to review)

**Step 7: Publish and Monitor**
- Command to publish (after review)
- Where to see published posts
- Analytics: `/psn:review` to see performance

**Step 8: Advanced: Company Hub Setup (Optional)**
- When to consider (later, when he has team members joining any of his ventures)
- Brief mention of `/psn:setup hub` for future reference

**Best Practices for Enrique**
- Start with "Personal" entity - critical for job seeking and credibility
- Post consistently (3-4x/week per platform) - the system handles scheduling
- Founder-led sales angle: share authentic journey, lessons learned, not just product promotion
- Cross-platform: write once, the system adapts per platform
- Use the learning loop: the system improves based on engagement data

**Troubleshooting Section**
- Common issues Enrique might encounter:
  - "Setup failed at step X" - how to re-run specific step
  - "Platform connection not working" - OAuth troubleshooting
  - "Voice interview not saving" - complete command troubleshooting
  - "No ideas generated" - check interview completion
- How to get help (logs, status check)

**Next Steps After Setup**
- Weekly routine: check `/psn:calendar`, generate posts, review analytics
- How to refine voice: `/psn:voice tweak` for adjustments
- How to track progress

**Summary Checklist**
- [ ] Run `/psn:setup` (full initial setup)
- [ ] Create "Personal" entity for job seeking and papers
- [ ] Create "Post Shit Now", "Genera", "404tf" entities
- [ ] Complete voice interview for each entity (start with Personal)
- [ ] Connect LinkedIn, X, Instagram
- [ ] Generate first post
- [ ] Publish and verify
- [ ] Check analytics with `/psn:review`

**Reference Links**
- Link to full setup command docs: .claude/commands/psn/setup.md
- Link to entity workflow: docs/entity-creation-workflow.md
- Link to platform-specific docs (LinkedIn, X, Instagram in docs/)

Write in a friendly, encouraging tone. Enrique is new to this - make him feel confident. Use bullet points, clear headings, and minimal technical jargon. Focus on practical steps he can follow immediately.
  </action>
  <verify>
The file users/enrique/SETUP-GUIDE.md exists and contains:
- At least 200 lines
- All 8 steps clearly outlined
- Commands explicitly provided for each step
- Troubleshooting section
- Summary checklist
- Tailored references to Enrique's situation (3 brands, job seeking, launching papers)
  </verify>
  <done>
users/enrique/SETUP-GUIDE.md provides Enrique with a complete, step-by-step walkthrough of Post Shit Now setup starting with psn:setup, covering his unique multi-brand use case and zero-to-social-media journey.
  </done>
</task>

</tasks>

<verification>
- Guide is tailored specifically to Enrique's use case (references his 3 brands, job seeking, launching papers)
- All setup steps covered in order, starting with psn:setup
- Commands are explicit and copy-paste ready
- Troubleshooting section addresses common issues
- Tone is encouraging and beginner-friendly
- Checklist provided for tracking progress
</verification>

<success_criteria>
- users/enrique/SETUP-GUIDE.md exists with at least 200 lines
- Guide covers complete setup flow from psn:setup to first post
- Enrique's specific context (3 brands, job seeking, zero social media) woven throughout
- Practical, actionable commands for every step
- Troubleshooting and summary sections included
</success_criteria>

<output>
The SETUP-GUIDE.md file serves as the deliverable. No summary file needed for quick tasks.
</output>
