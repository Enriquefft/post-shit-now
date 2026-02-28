---
phase: 19-voice-profile-and-interview-refinements-p3
plan: 02B
type: execute
wave: 1
depends_on: [19-02]
files_modified: [src/cli/voice-interview.ts, .claude/commands/psn/voice.md]
autonomous: true
requirements: [m3]

must_haves:
  truths:
    - "CLI import command validates URLs before processing"
    - "CLI provides clear feedback for URL validation errors"
    - "Documentation explains URL validation behavior"
  artifacts:
    - path: "src/cli/voice-interview.ts"
      provides: "CLI URL validation integration"
      exports: ["importContent"]
    - path: ".claude/commands/psn/voice.md"
      provides: "URL validation documentation"
  key_links:
    - from: "src/cli/voice-interview.ts"
      to: "src/voice/import.ts"
      via: "importBlogContent function call with validation"
      pattern: "importBlogContent\\(urls\\)"
    - from: "src/cli/voice-interview.ts"
      to: "src/voice/import.ts"
      via: "validateUrl function call for pre-validation"
      pattern: "validateUrl\\("
---

<objective>
Integrate URL validation into CLI import command and update documentation.

Purpose: Provide user-friendly URL validation in the CLI and document the validation behavior.
Output: CLI with URL validation and updated documentation
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
@src/cli/voice-interview.ts (importContent function and CLI entry point)
@src/voice/import.ts (validateUrl function added in plan 19-02)
@.claude/commands/psn/voice.md
</context>

<tasks>

<task type="auto">
  <name>Add validation to CLI import command</name>
  <files>src/cli/voice-interview.ts</files>
  <action>
    Update the import CLI command in src/cli/voice-interview.ts to validate URLs from command line:

    1. Import validateUrl from src/voice/import.ts
    2. In CLI entry point (import.meta.main section), when "import" command detected
    3. Parse blog URLs from args.filter((a) => a.startsWith("http"))
    4. For each URL, call validateUrl() before passing to importContent
    5. Print validation errors in user-friendly format

    Output format for CLI:
    ```
    Error: Invalid URL 'https://example.com/blog'
    Reason: Invalid URL format. Could not parse hostname.

    No valid URLs to import. Please check your URLs and try again.
    ```

    Follow existing JSON output pattern in voice-interview.ts:
    - On success: JSON.stringify result
    - On error: console.error(JSON.stringify({error}))

    Note: importBlogContent already validates URLs (from plan 19-02), but pre-validation in CLI provides better UX by failing fast before any processing starts.
  </action>
  <verify>grep -A10 'case "import":' src/cli/voice-interview.ts | grep -q "validateUrl"</verify>
  <done>CLI import command validates URLs before processing</done>
</task>

<task type="auto">
  <name>Update voice.md documentation</name>
  <files>.claude/commands/psn/voice.md</files>
  <action>
    Update /psn:voice import section in .claude/commands/psn/voice.md to mention URL validation:

    Add note under "For blog URLs":
    "Note: URLs are validated before processing. Only http:// and https:// URLs are accepted.
    Invalid URLs will show clear error messages describing the issue."

    This sets user expectations and explains validation behavior.
  </action>
  <verify>grep -q "URLs are validated" .claude/commands/psn/voice.md</verify>
  <done>Documentation updated to explain URL validation behavior</done>
</task>

</tasks>

<verification>
1. Test valid URL: bun run src/cli/voice-interview.ts import https://example.com/blog
2. Test invalid protocol: bun run src/cli/voice-interview.ts import file:///path/to/file
3. Test malformed URL: bun run src/cli/voice-interview.ts import not-a-url
4. Test localhost rejection: bun run src/cli/voice-interview.ts import http://localhost/blog
5. Verify error messages are clear and actionable
6. Check documentation includes URL validation note
</verification>

<success_criteria>
- CLI import command validates URLs before processing
- CLI provides clear feedback for URL validation errors
- Error messages include the problematic URL and specific validation failure reason
- Documentation updated to explain URL validation behavior
</success_criteria>

<output>
After completion, create `.planning/phases/19-voice-profile-and-interview-refinements-p3/19-02B-SUMMARY.md`
</output>
