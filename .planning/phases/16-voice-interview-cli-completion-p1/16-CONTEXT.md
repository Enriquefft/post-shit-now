# Phase 16: Voice Interview CLI Completion (P1) - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete voice interview CLI interface with state persistence, stdin key input, and directory structure automation. Users can complete interviews via CLI commands with persistent state between invocations, save keys via stdin prompts, and have content directories created automatically.
</domain>

<decisions>
## Implementation Decisions

### State persistence format
- Research bun.lock format — claims binary speed while being human-readable
- Location: `content/voice/.interview.json` (easy to find, alongside YAML profiles)
- Cleanup: Delete state after 7 days
- Concurrent: Support multiple interviews with auto-generated filenames like `.interview-{timestamp}.json`
- Save data: Full state object from `interview.ts` (InterviewState)
- Validation: Strict validation — throw error if corrupted, user must restart
- Security: Plain text storage (no encryption or obfuscation)
- Auto-save: Save state after every answer submission

### CLI command interface
- Submit: Interactive prompt (ask user "What's your answer for [question]?")
- Auto-advance: Show next questions after submitting answers (auto-continue)
- Complete: Interactive prompt for save path if multiple interviews exist
- Output: Human-readable messages, progress, confirmations (not JSON-only)
- Errors: Friendly error messages describing what went wrong and how to fix
- Validation: Real-time validation of each answer before accepting (reprompt if invalid)
- Restart: Claude's discretion on whether to add restart command
- Progress: Always visible — show "Phase 1/5 • Question 3/7" on each prompt

### Stdin key input behavior
- Input: Stdin prompt only (not CLI flags)
- Masking: Always masked (hide typed characters with asterisks like password prompts)
- Confirmation: No confirmation required (save immediately, trust user input)
- Validation: Format check + minimal test with CLI or API of said key (minimal verification)

### Directory structure
- Auto-create: Yes, create directories automatically
- When created: On interview start (before collecting answers)
- Structure: Organized with subdirs (e.g., `content/voice/profiles/`, `content/voice/strategies/`)
- Permissions: System default (typically 755)

### Claude's Discretion
- Whether to add restart command for abandoning current interview
- Exact subdirectory structure within `content/voice/`
- Bun lock format research and implementation approach for state files
- Minimal API test implementation for key validation

</decisions>

<specifics>
## Specific Ideas

- Research bun.lock format for state file — user mentioned it claims binary speed while being human-readable
- Interactive prompts should feel like a guided interview, not a form fill
- Progress indicator helps users understand how far they are in the process
- Masked input for keys but no re-typing confirmation (balance security vs UX)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-voice-interview-cli-completion-p1*
*Context gathered: 2026-02-21*
