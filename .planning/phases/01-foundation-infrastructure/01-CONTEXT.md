# Phase 1: Foundation Infrastructure - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding, `@psn/core` shared package, Personal Hub provisioning (Neon Postgres + Trigger.dev Cloud), Drizzle migration infrastructure, BYOK API key setup, post watchdog task, and full validation. Voice profiling, content generation, and platform posting are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Setup Flow UX
- Step-by-step wizard: Claude guides user through one thing at a time (create DB → connect Trigger.dev → add API keys → validate → done)
- CLI tooling only for external services — no browser-based copy/paste flows. Use `neonctl` and `trigger` CLI exclusively
- Full validation at end of setup: test every connection (DB, Trigger.dev, platform APIs) and show pass/fail checklist
- Resume from failure on re-run: detect what's already configured, skip completed steps, retry failed step

### Project Structure
- **Bun** as package manager and TypeScript runner (no tsx needed)
- Codebase organization: Claude's discretion — pick what works best for Trigger.dev deployment + shared DB schemas
- Slash commands at standard Claude Code location: `.claude/commands/psn/*.md`
- Config directory structure matches PRD exactly: `config/strategy.yaml`, `config/hub.env`, `config/keys.env`, `config/voice-profiles/`, `config/series/`, `config/connections/`, `config/company/`

### Hub Provisioning
- Neon DB creation via `neonctl` CLI — fully terminal-based, no dashboard visits
- Trigger.dev project creation via `npx trigger.dev@latest init` (or equivalent v4 CLI)
- Deploy Trigger.dev tasks immediately during setup — everything works when setup completes
- Auto-migrate DB schema: run all pending Drizzle migrations automatically, no user confirmation needed

### Error & Output Style
- CLI scripts output JSON to stdout only — Claude interprets and presents to user. Clean separation between data and presentation
- Errors are actionable: always tell the user what to do next (e.g., "DB connection failed. Run: neonctl databases list")
- Validation checklist uses checkmarks: ✓ DB connection  ✓ Trigger.dev  ✗ X OAuth
- Progress indicators use step counters: `[2/5] Creating database...` — numbered steps, no animation

### Claude's Discretion
- Codebase organization (single package vs monorepo) — optimize for Trigger.dev + Drizzle sharing
- Resume-from-failure detection approach
- Exact Drizzle schema design for initial tables
- Token encryption approach for `oauth_tokens` table
- Post watchdog implementation details (polling interval, re-trigger strategy)

</decisions>

<specifics>
## Specific Ideas

- User explicitly wants Bun over pnpm/npm — faster installs, built-in TypeScript runner
- Config structure must match PRD directory tree exactly (users will reference PRD as documentation)
- "CLI tooling only" means the setup experience should never require opening a browser during provisioning

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-infrastructure*
*Context gathered: 2026-02-18*
