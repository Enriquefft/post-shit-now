# Phase 1: Critical Setup Fixes - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

## Phase Boundary

Fix all critical bugs that block setup completion:
- Hub detection and connection issues
- Migration RLS policy errors
- Provider keys table validation
- Neon API key permission handling

Scope is fixing existing bugs, not adding new capabilities.

---

## Implementation Decisions

### RLS Strategy
- **Use Neon RLS configured from Drizzle** — Follow official Neon/Drizzle RLS guide
- **Fail setup if RLS fails** — Do not fallback to app-level filtering
- **Apply RLS to all tables or fail entirely** — Maximum security, high failure risk but clear expectations
- Reference: https://neon.com/docs/guides/rls-drizzle

**Rationale:** Neon supports native PostgreSQL RLS. The trial run issue was about custom roles not existing, not RLS capability. Using Drizzle RLS configuration provides proper integration while maintaining security.

### API Key Validation
- **Detect proactively AND show clear errors** — Both approaches combined
- **Validate via API call** — Make minimal API call (e.g., list projects) to validate key
- **Apply to all provider keys** — Extend validation framework to Trigger.dev, Perplexity, Anthropic, etc., not just Neon

**Rationale:** Proactive detection improves UX by catching issues before complex operations. API validation is more reliable than prefix checking alone (prefixes may change). Extending to all providers provides consistent UX across setup flow.

### Hub Connection Strategy
- **Unify storage to .hubs/*.json** — Move Personal Hub from config/hub.env to .hubs/personal.json
- **No backward compatibility needed** — No current users, all breaking changes allowed
- **Use getHubConnection() for all hubs** — Unified API, all hubs accessed through same function

**Rationale:** Unified storage simplifies codebase (single getHubConnection function) and eliminates the confusing dual-storage pattern that caused the trial run bugs. Since there are no production users yet, we can make breaking changes without migration complexity.

### Claude's Discretion
- RLS policy implementation details in Drizzle schema
- Exact API validation endpoints for each provider
- Error message wording and tone (be specific and actionable)
- Hub connection caching strategy (if any)

---

## Specific Ideas

- Follow Neon's official RLS/Drizzle guide exactly
- API validation should show both "what went wrong" and "how to fix it" in error messages
- Hub JSON format should include all fields needed: database_url, encryption_key, hub_id

---

## Deferred Ideas

None — discussion stayed within phase scope.

---

*Phase: 01-critical-setup-fixes*
*Context gathered: 2026-02-20*
