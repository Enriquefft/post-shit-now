# Phase 11: Tech Debt Remediation (CONFIG-04 + IMG/VID) - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate all external API key consumers (search providers, image/video generation) from process.env to the api_keys database table with hub-scoped access. Enables per-hub key isolation for multi-tenant architecture (Personal Hub uses user's keys, Company Hubs use company keys).

</domain>

<decisions>
## Implementation Decisions

### Multi-Tenant Key Model
- Isolated tenants: companies bring their own API keys, cost attribution per hub
- Hub-scoped keys: api_keys.userId holds the hub owner (user ID for Personal Hub, hub ID for Company Hub)
- Key lookup uses hub context, not the acting user's ID
- Enables: different API keys per person/company, per-hub cost tracking

### Provider Migration Scope
- Migrate ALL providers to DB, not just search (CONFIG-04)
- Search providers: Perplexity, Brave, Tavily, Exa
- Media providers: GPT Image, Ideogram, Flux, Kling, Runway, Pika
- No fallback to process.env — DB only (strict)

### Key Lookup Pattern
- Before (current): `const apiKey = process.env.OPENAI_API_KEY`
- After (new): `const apiKey = await getApiKey(db, hubId, "openai")`
- Every provider call needs `db` + `hubId` passed through call chain

### IMG/VID Provider Wiring
- Media CLIs receive hub context via `--hub-id` flag
- Maintains Claude-invoked slash command pattern
- Media generation remains decoupled, but keys come from DB
- CLI signature: `bun run src/media/image-gen.ts generate --hub-id {hubId} --prompt "..."`

### Key Setup Flow
- Extend /psn:setup to collect and store keys in DB per hub
- Keys encrypted in api_keys.encryptedValue column
- Per-hub key management (Personal Hub = user's keys, Company Hub = company's keys)

### Claude's Discretion
- Migration order (search first or media first)
- Exact CLI flag naming
- Error messaging when key not found
- Whether to batch migration or incremental

</decisions>

<specifics>
## Specific Ideas

- User has personal API keys for Personal Hub
- User uses company's API keys when posting to Company Hub
- Cost attribution: per-hub tracking of API usage
- api_keys table already exists in schema but unused — now becomes primary storage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-tech-debt-remediation*
*Context gathered: 2026-02-19*
