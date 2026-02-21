# Phase 17: Setup UX Improvements (P2) - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

## Phase Boundary

Enhance the setup experience with progress indicators, data masking, preview/dry-run modes, and CLI argument handling fixes. This phase improves user experience for setup operations without changing the core setup functionality.

---

## Implementation Decisions

### Progress indicator style
- Step-by-step checklist format
- Show all steps (granular): DB connection, migration, hub creation, keys, entities, etc.
- Show running indicator with timing: `⠋ Database connecting...` → `✓ Database connecting [1.2s]`
- Display full step list from the start (not sequential reveal)
- Apply to long-running operations specifically

### Data masking strategy
- **Database URLs:** Mask user and host: `postgres://***@***` (middle ground - preserves structure, hides identity)
- **API Keys:** Show prefix + suffix format: `tr_********xyz`
- **Scope:** Mask in errors only (info/warn logs show raw data)
- **Debug mode:** Debug logging reveals unmasked values for troubleshooting

### Dry-run and preview modes
- Dry-run and preview are the same feature (different names)
- User can choose either `--dry-run` or `--preview` flag (both accepted)
- **Output style:** Claude's discretion on what level of detail to show
- **After preview:** Always confirm with user: "Proceed with setup? [y/N]"

### CLI error handling
- **Missing neonctl:** Show actionable suggestion with documentation link
- **Invalid Trigger.dev arguments:** Fail fast and early (stop immediately)
- **Multiple errors:** Claude's discretion on presentation style
- Philosophy: Be helpful, be specific, stop when things are clearly wrong

---

## Specific Ideas

No specific requirements — open to standard CLI/UX best practices for setup tools.

---

## Deferred Ideas

- Add basic Trigger.dev knowledge to project knowledgebase (minimal) — separate documentation task

---

*Phase: 17-setup-ux-improvements-p2*
*Context gathered: 2026-02-21*
