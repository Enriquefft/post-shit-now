# Phase 15: Database Stability & Recovery (P1) - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure database reliability and add recovery mechanisms for PSN's Neon-backed infrastructure. This phase addresses migration failure handling, hub ID consistency across storage formats, unified hub connection handling, and setup reset capabilities. It does not add new database features — it stabilizes existing database operations.

</domain>

<decisions>
## Implementation Decisions

### Migration retry behavior
- Retry limit: 3 attempts with 2-second fixed delay between retries
- User feedback: Detailed progress during retries — show retry count, delay, table being migrated, and reason for failure
- Progress persistence: Claude's discretion — choose between rollback vs keep partial progress based on migration type and safety considerations

### Hub ID generation strategy
- Missing hubId handling: Auto-generate new ID during migration for legacy hub.env files
- Format: Nanoid-style (shorter, URL-friendly random string)
- Persistence: Write generated hubId to .hubs/*.json only on successful migration completion
- Collision handling: Not a concern — nanoid collision is astronomically unlikely, ignore this case

### Recovery scope
- Reset scope: Selective reset via flags (--db, --files, --all) — user chooses what to reset
- Default behavior: Require explicit scope — user must specify --db and/or --files flags, shows summary of what would be deleted
- Confirmation: Require user confirmation before destructive actions — prompt with explicit "This will delete X. Continue? (y/n)"
- Backup: No backup — reset is destructive by design, user should backup manually if needed

### Hub discovery behavior
- Empty .hubs/ directory: Error immediately with message prompting user to run /psn:setup
- Corrupted files: Error and fail — fail-fast behavior on first corrupted file
- Schema validation: Strict — require hubId, name, and connection fields, error if missing
- Error messages: Detailed with file path — include file path, parse error location, and expected format

### Claude's Discretion
- Migration progress persistence on failure (rollback vs keep partial)
- Exact nanoid length and character set
- Retry error classification (what counts as retriable vs permanent failure)

</decisions>

<specifics>
## Specific Ideas

- "Fixed 2s delay is simpler than exponential backoff and sufficient for network hiccups"
- "Nanoid-style IDs are more user-friendly than full UUIDs while maintaining uniqueness"
- "Strict validation prevents silent failures with corrupted hub files"
- "Detailed error messages help users debug their hub file issues"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-database-stability-recovery-p1*
*Context gathered: 2026-02-21*
