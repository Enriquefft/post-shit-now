---
phase: 4-review-psn-session
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md]
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - "All issues from PSN session are documented in a structured format"
    - "Issues are categorized by severity (critical, major, minor)"
    - "Each issue includes reproduction steps and suggested fixes"
  artifacts:
    - path: ".planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md"
      provides: "Comprehensive issues documentation from PSN session"
      min_lines: 100
  key_links:
    - from: "SESSION_ULTRA.json"
      to: "4-ISSUES-DOCUMENTATION.md"
      via: "Issue extraction and categorization"
      pattern: "Parse session JSON, extract errors, document with context"
---

<objective>
Review the PSN SESSION_ULTRA.json file and document all issues, bugs, and improvement opportunities discovered during the setup and voice profile creation process.

Purpose: Create a comprehensive record of problems encountered to guide future development decisions
Output: Structured issues documentation with severity levels and suggested fixes
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md

# Source material
Session log at: /home/hybridz/Projects/psn/SESSION_ULTRA.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract and categorize all issues from SESSION_ULTRA.json</name>
  <files>.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-ISSUES-DOCUMENTATION.md</files>
  <action>
Create a comprehensive issues documentation file by parsing SESSION_ULTRA.json and extracting all errors, bugs, and friction points. Structure the document with:

**Categories:**
1. CRITICAL ISSUES (blocks setup/usage)
2. MAJOR ISSUES (significant friction, incomplete features)
3. MINOR ISSUES (UX improvements, documentation gaps)

**For each issue include:**
- Title and severity
- Description from session context
- Reproduction steps (from session)
- Root cause (if identified)
- Suggested fix or workaround

**Key issues to capture (from session):**

1. Setup wizard hub detection bug:
   - `bun run src/cli/setup.ts` shows hub as configured
   - `bun run src/cli/setup.ts voice` fails with "Personal Hub not configured"
   - Root cause: setup.ts uses `getHubConnection(projectRoot, "personal")` which only looks for Company Hub files (.hubs/*.json)
   - Personal hub is stored in config/hub.env, loaded via `loadHubEnv()`
   - Fix: Change setup.ts voice/entity cases to use `loadHubEnv()` instead of `getHubConnection()`

2. Migration RLS policy error:
   - Migrations fail: "role 'hub_user' does not exist"
   - Schema defines `pgRole("hub_user").existing()` but role doesn't exist in Neon
   - Root cause: RLS policies reference non-existent role, Neon doesn't allow creating custom roles
   - Workaround used: Created hub_user role manually via SQL
   - Proper fix: Either (a) remove RLS policies from schema for Neon compatibility, or (b) create role in migration setup

3. Trigger.dev setup CLI argument error:
   - Setup fails: "error: unknown option '--skip-install'"
   - Root cause: Trigger.dev CLI removed --skip-install flag in v4.4.0
   - Fix: Remove --skip-install flag from setup-trigger.ts, or document manual setup requirement

4. Voice interview CLI incomplete:
   - `bun run src/cli/voice-interview.ts start` returns questions but no way to submit answers
   - CLI only has `start` and `import` commands
   - `submitAnswers()` function exists but not exposed as CLI subcommand
   - Interview engine is a library, not a runnable CLI
   - Impact: Users cannot complete voice interview through CLI, must use interactive flow which isn't wired
   - Fix: Add CLI subcommands for `submit`, `complete`, and interactive mode

5. Provider keys table doesn't exist:
   - Setup fails: "Failed query: select * from api_keys where user_id = $1"
   - Root cause: Migration didn't create api_keys table (likely due to RLS error)
   - After RLS fix, api_keys table should exist
   - Verify: Check if migrations actually ran successfully after role creation

6. setup-keys.ts stdin reading issue:
   - Attempted: `echo "KEY=value" | bun run src/cli/setup-keys.ts`
   - Result: No keys saved, empty output
   - Root cause: setup-keys.ts expects interactive input or different approach
   - Workaround: Write directly to config/keys.env file
   - Fix: Either document stdin usage pattern or accept --key and --value flags

7. Neon API key permission error:
   - Error: "project-scoped keys are not allowed to create projects"
   - Original key: `napi_re4yoevqpuf8oeafwmr5f984pnkf3wv8o652xhadd9f66w7sibutphyf0l0c0t09` (starts with napi_)
   - Fix: Use organization-scoped key (napi_kjk0csgre3alti441qk2lcfz19mltaq7zl90vnkfxf0l1w44xwwhvtq4q83n4bz4)
   - Documentation: Should clarify key type requirements in setup prompt

8. Database migration retry loop:
   - First run: "Database created but migrations failed: Can't find meta/_journal.json"
   - Re-run: Skips database step, tries migrations again, still fails
   - Root cause: Drizzle meta files not generated properly
   - Fix: Add better error handling and file existence checks before running migrations

9. Voice interview archetype question handling:
   - User selected multiple archetypes: "Thought Leader, Educator, Curator, Academic Researcher, Provocateur"
   - No way to submit multi-choice answers through CLI
   - Archetype processing expects string matching, but no submission path
   - Fix: Implement `voice-interview submit` CLI command that accepts --question-id and --answer flags

10. Missing entity creation flow:
   - Setup voice suggests creating entities via `/psn:setup entity --create`
   - No interactive flow documented for entity creation + voice interview
   - Entities table needs to be populated before voice profile can be created
   - Fix: Document full entity creation workflow

11. Empty .hubs directory confusion:
   - getHubConnection discovers Company Hubs from .hubs/*.json files
   - Personal hub uses config/hub.env (different storage mechanism)
   - Code comments suggest .hubs/ for company hubs only
   - Issue: setup.ts voice command should use loadHubEnv() for personal hub
   - Fix: Refactor setup.ts to use appropriate connection method per hub type

12. Hub ID missing from hub.env:
   - config/hub.env contains DATABASE_URL and HUB_ENCRYPTION_KEY
   - No HUB_ID field
   - Code expects hubId for various operations
   - Fix: Add HUB_ID generation during setup or derive from database

13. No voice profile file creation directory:
   - Interview saves to content/voice/personal.yaml
   - No check if content/voice directory exists
   - Setup doesn't create this directory
   - Fix: Create content/voice directory during setup if missing

14. Missing setup completion validation:
   - Setup shows "2 steps remaining" but no way to mark as complete
   - Voice profile creation doesn't update setup status
   - Fix: Add completion tracking to setup status command

15. Provider key configuration flow unclear:
   - Phase 2 provider keys check happens during setup
   - No clear path to configure them (needs separate commands)
   - setup-keys.ts has writeProviderKey but not wired to main setup flow
   - Fix: Add provider key configuration step to main setup wizard

16. Interview state not persistent across CLI calls:
   - `voice-interview start` returns state but no mechanism to load/save it
   - User would need to manually pass state between CLI invocations
   - Fix: Add state file (interview-state.json) or interactive REPL mode

17. No dry-run or preview mode for setup:
   - Setup makes actual changes to database and filesystem
   - No way to preview what will happen
   - Fix: Add --dry-run flag to setup commands

18. Database connection string exposed in errors:
   - Errors show full DATABASE_URL with password
   - Should mask sensitive data in logs
   - Fix: Replace credentials with *** in error messages

19. neonctl path issue:
   - neonctl installed via bun but PATH not updated
   - Had to manually add `/home/hybridz/.cache/.bun/bin:$PATH`
   - Fix: Document PATH requirement or use absolute path in setup

20. Voice profile format validation not documented:
   - No clear schema validation errors when profile is malformed
   - Users don't know what valid profiles look like
   - Fix: Add `validate` command to show profile structure and errors

21. Missing recovery flow for failed setup:
   - If setup fails partway through, no clear recovery path
   - No "reset" or "clean" command to start over
   - Fix: Add `/psn:setup reset` command to clear partial state

22. Trigger project auto-detection fails:
   - setup-trigger.ts should auto-detect project from trigger.dev account
   - Fallback is manual entry of project ref
   - `npx trigger.dev projects list` returned empty (failed silently)
   - Fix: Better error handling for trigger API failures

23. Entity slug collision handling:
   - No documented behavior when entity slug already exists
   - createEntity should handle or error on collision
   - Fix: Add slug uniqueness check with helpful error message

24. Content import paths not verified:
   - `voice-interview import` accepts URLs but no validation they exist
   - No clear error if blog import fails
   - Fix: Add URL validation and better import error messages

25. No setup progress indicators:
   - Long-running operations (migrations, role creation) show no progress
   - Users think setup is frozen
   - Fix: Add progress spinners or status messages for each step

26. RLS policies not compatible with Neon free tier:
   - Schema uses pgRole and pgPolicy extensively
   - Neon free tier may have restrictions on custom roles
   - Architectural decision: Choose between (a) full RLS with custom Postgres instance, or (b) app-level filtering for Neon

27. Voice profile persona configuration incomplete:
   - Platform personas (tone per platform) mentioned but no setup flow
   - Users can't configure platform-specific voice differences
   - Fix: Add platform persona interview questions or CLI commands

28. Missing timezone configuration:
   - Setup never asks for timezone
   - Posting times use system timezone implicitly
   - Fix: Add timezone setup step or auto-detect from system

29. No setup health check command:
   - No way to verify all components are working after setup
   - validate.ts checks but doesn't test all integrations
   - Fix: Add comprehensive health check with connection tests

30. Content directory structure assumptions:
   - Code expects content/voice/, content/drafts/, etc.
   - No initialization creates these directories
   - Fix: Add `init` command to create directory structure

Write all issues in markdown format with:
- Severity badges (CRITICAL/MAJOR/MINOR)
- Cross-references between related issues
- Prioritization based on setup blocking impact
- Estimated fix complexity (simple/medium/complex)
</action>
  <verify>Verify file was created and contains at least 20 categorized issues with severity levels</verify>
  <done>Document with 30+ issues categorized by severity, each with description and suggested fix</done>
</task>

</tasks>

<verification>
Review the created documentation for:
- Complete coverage of all session issues
- Clear categorization by severity
- Actionable fix suggestions
- Cross-references between related issues
</verification>

<success_criteria>
- Issues documentation file created
- All 30+ issues from session captured
- Each issue has severity, description, and fix suggestion
- Document is readable and well-structured
</success_criteria>

<output>
After completion, create summary at `.planning/quick/4-review-psn-sesssion-ultra-json-we-cloned/4-SUMMARY.md`
</output>
