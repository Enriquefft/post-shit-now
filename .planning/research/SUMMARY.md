# Project Research Summary

**Project:** Post Shit Now v1.3 (Real-World Reliability)
**Domain:** CLI-first social media automation -- operational reliability fixes
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

PSN v1.3 addresses 6 friction points exposed by a real-user trial session (342 turns, 29 hours). These are not feature additions -- they are reliability fixes for an existing v1.0 system that shipped with 148 requirements complete but breaks during real-world setup and publishing. The fixes span three categories: deployment infrastructure (Trigger.dev env vars), user onboarding (OAuth callback server), and publishing reliability (thread checkpointing, tweet validation). Two items are carried from v1.2: testing infrastructure and context management (pre-commit hooks).

The recommended approach is to fix deployment infrastructure first (env var delivery unblocks ALL deployed task execution), then address the X platform publishing pipeline (validation, OAuth, thread resilience), and finish with developer tooling (tests, hooks). This order follows a strict dependency chain: workers must run before publishing can be tested, and publishing code must stabilize before writing tests against it. Zero database migrations are needed -- all schema infrastructure already exists but has incomplete write paths.

The key risk is the thread publishing checkpoint implementation. It touches the most sensitive code path (sequential tweet posting with per-tweet DB writes), has the highest data-loss potential (orphaned partial threads on X with no DB record), and introduces a new failure mode (checkpoint DB write fails after successful tweet, causing duplicates on retry). The mitigation is thorough: retry checkpoint writes (2-3 attempts), never swallow checkpoint errors, and validate the entire thread pre-flight before posting any tweets.

## Key Findings

### Recommended Stack

No major stack changes. v1.3 adds 2 dependencies to an existing, validated stack. See [STACK.md](./STACK.md) for full details.

**Core additions:**
- `@trigger.dev/build` (^4.0.0): `syncEnvVars` build extension for pushing credentials to Trigger.dev Cloud at deploy time. Required -- no alternative for BYOK model.
- `lefthook` (^1.11.0): Pre-commit hook runner. Go binary, zero Node.js deps, parallel execution, officially recommended by Biome.
- Custom `tweet-validator.ts`: Weighted character counting (~60 lines). See conflict resolution below.
- `Bun.serve()` (built-in): Ephemeral localhost OAuth callback server. Zero new dependencies.

**What NOT to add:** `twitter-text` (unmaintained), `express`/`hono` (overkill for callback server), `husky`+`lint-staged` (heavier than lefthook), `dotenv` (Bun loads `.env` natively), any secrets manager SDK (overkill for BYOK).

### Researcher Conflicts Resolved

**1. twitter-text vs custom validator (STACK vs FEATURES vs PITFALLS)**

STACK.md recommends a custom validator, noting `twitter-text` is unmaintained (v3.1.0, last release 6+ years ago, 37KB, no updates since X rebrand). FEATURES.md recommends `twitter-text`, calling it "official" and "maintained." PITFALLS.md hedges, recommending `twitter-text` but with version pinning and edge case awareness.

**Resolution: Build custom validator.** STACK.md is correct on the facts -- the package has had no releases in 6+ years. PSN only needs weighted character counting (URLs=23, emojis=2, CJK=2), not auto-linking, cashtag extraction, or hashtag parsing. A ~60-line `tweet-validator.ts` with the 5 counting rules is more maintainable than depending on an abandoned 37KB package. Include conformance tests against known edge cases (long URLs, compound emoji, CJK text, exactly-280-char tweets). Use twitter-text's GitHub conformance test fixtures as a test data source without depending on the package itself.

**2. OAuth callback port (STACK: 9876, ARCHITECTURE: 18923, FEATURES: port 0)**

STACK.md picks 9876, ARCHITECTURE.md picks 18923, FEATURES.md suggests `port: 0` (OS-assigned). PITFALLS.md correctly identifies the constraint: X Developer Portal requires a pre-registered callback URL with a known port.

**Resolution: Use fixed port.** `port: 0` is incompatible with X's requirement for a pre-registered callback URL. Pick one fixed port and document it in setup instructions. Port choice is arbitrary -- use `18923` (uncommon, avoids conflicts with common dev servers on 3000/5173/8080). The exact number matters less than consistency across code, docs, and Developer Portal instructions.

**3. Callback hostname: localhost vs 127.0.0.1 (STACK vs PITFALLS)**

STACK.md uses `localhost`. PITFALLS.md warns X may reject `localhost` and recommends `127.0.0.1`.

**Resolution: Use `127.0.0.1`.** PITFALLS.md cites community reports of `localhost` being rejected by X. `127.0.0.1` is reliably accepted per RFC 8252. There is no downside to using the IP address. Register `http://127.0.0.1:18923/callback` in the X Developer Portal.

**4. Pre-commit tool: lefthook vs husky+lint-staged (STACK vs ARCHITECTURE)**

STACK.md recommends lefthook (Go binary, zero deps, parallel, Biome-recommended). ARCHITECTURE.md recommends husky+lint-staged (standard TypeScript ecosystem).

**Resolution: Use lefthook.** It is lighter (no Node.js dependency chain), faster (parallel by default), and officially recommended by Biome (PSN's linter). The `stage_fixed: true` feature auto-re-stages files after Biome auto-fix, which husky+lint-staged requires extra configuration for.

**5. syncEnvVars vs resolveEnvVars (STACK/ARCHITECTURE vs FEATURES)**

FEATURES.md uses `resolveEnvVars` -- this is the deprecated name. STACK.md and ARCHITECTURE.md correctly use `syncEnvVars`, which is the current API per the Trigger.dev changelog.

**Resolution: Use `syncEnvVars`.** The `resolveEnvVars` name was renamed to `syncEnvVars` in the build extensions API. FEATURES.md references are stale.

### Expected Features

See [FEATURES.md](./FEATURES.md) for full analysis.

**Must have (table stakes -- blocks real user workflow):**
- Trigger.dev env var delivery -- workers crash without DATABASE_URL, HUB_ENCRYPTION_KEY
- X OAuth callback server -- users cannot complete setup without manual URL hacking
- Thread publishing resilience -- partial failures lose tweet IDs, duplicates on retry
- Tweet pre-flight validation -- X returns misleading 403 for oversized tweets

**Should have (improves quality and maintainability):**
- Testing infrastructure -- contract tests, mock infrastructure, handler compliance verification
- Context management -- pre-commit hooks (biome + typecheck), state consolidation

**Defer to v1.4+:**
- Dry-run mode for publishing
- Multi-hub env var resolution
- Thread resume CLI UX (`/psn:post --resume`)
- LinkedIn/Instagram/TikTok OAuth callback servers (same pattern, blocked by partner approvals)

### Architecture Approach

v1.3 makes surgical modifications to the existing 4-layer architecture (CLI -> Core -> Platform -> Trigger). No new layers, no new tables, no migrations. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full component inventory.

**Modified components:**
1. `trigger.config.ts` -- Add `syncEnvVars` build extension (reads local config, pushes to Cloud)
2. `src/cli/oauth-callback-server.ts` (NEW) -- Ephemeral Bun.serve() for OAuth code capture
3. `src/platforms/x/validation.ts` (NEW) -- Weighted character counting, pre-flight validation
4. `src/platforms/handlers/x.handler.ts` -- Add validation before API calls; persist threadProgress to DB after each tweet
5. `src/test/` (NEW) -- Shared mocks, fixtures, compliance test suite
6. `lefthook.yml` (NEW) -- Pre-commit hooks: biome, typecheck, circular dep check

**Key architectural insight:** The threadProgress schema (read path) already exists in the handler code but the write path was never implemented. This is a skeleton-completion fix, not a new feature. Similarly, the callback URL is parameterized in `x/oauth.ts` -- the hardcoding is only in the CLI layer. Zero schema changes means zero migration risk.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for all 16 pitfalls with prevention strategies.

1. **Workers deploy with zero env vars** -- Dev mode auto-loads `.env`, production does not. Use `syncEnvVars` build extension. Validate all required vars at task start with actionable error messages listing every missing var.
2. **Thread checkpoint writes fail silently** -- If DB write fails after a successful tweet post, retries create duplicates. Retry checkpoint writes 2-3 times with 500ms delay. Never swallow checkpoint errors. A failed checkpoint is worse than a failed tweet.
3. **Callback URL hardcoded in 3 locations** -- `setup-x-oauth.ts`, `x.handler.ts`, and X Developer Portal. Extract to a single constant in `x/oauth.ts`. Verify with `grep -r "example.com/callback" src/` returning zero results.
4. **Thread splitter and validator use different character counting** -- Splitter uses raw `string.length`, validator will use weighted counting. Create a shared `countTweetChars()` utility used by both. Single source of truth.
5. **Pre-commit hooks block Claude Code workflow** -- Heavy hooks (full typecheck, full tests) add 10-30s per commit. Keep hooks fast: biome on staged files only, run typecheck in parallel. Use `stage_fixed: true` for auto-fix.
6. **X refresh token race condition** -- Concurrent tasks can both try to refresh a single-use token. Use optimistic locking on token rows (`WHERE updated_at = original_value`). Address alongside handler modifications in thread resilience phase.

## Implications for Roadmap

Based on dependency analysis across all 4 research files, the milestone should be structured as 6 phases in strict dependency order.

### Phase 1: Trigger.dev Env Var Delivery
**Rationale:** Every deployed task crashes without this. All other fixes are untestable in production until workers have credentials. Highest impact, lowest complexity.
**Delivers:** Working Trigger.dev Cloud deployments with all required env vars synced from local config files. Pre-deploy validation. Actionable error messages for missing vars.
**Addresses:** Table-stakes env var delivery (FEATURES P1).
**Avoids:** Pitfall 1 (zero env vars), Pitfall 9 (syncEnvVars overwrites dashboard vars), Pitfall 10 (build-time vs runtime confusion).
**Stack:** `@trigger.dev/build` for `syncEnvVars` extension. New file `src/trigger/env-sync.ts`. Modify `trigger.config.ts`.
**Complexity:** LOW. ~50 lines of new code + config change.

### Phase 2: Tweet Validation
**Rationale:** Independent of other fixes. Pure function + handler integration. Quick win that also reduces mid-thread failures (enhances Phase 4). Should land before thread resilience to avoid merge conflicts in `x.handler.ts`.
**Delivers:** Pre-flight tweet validation with weighted character counting. Clear error messages ("Tweet is 312 chars, max 280") instead of misleading 403. Updated thread-splitter using same counting logic (single source of truth).
**Addresses:** Tweet pre-flight validation (FEATURES P1). Thread-splitter/validator consistency.
**Avoids:** Pitfall 7 (misleading 403), Pitfall 8 (splitter vs validator counting mismatch).
**Stack:** Custom `tweet-validator.ts`. No new dependencies.
**Complexity:** LOW. ~100 lines new code (validator + splitter update + shared counting utility).

### Phase 3: X OAuth Callback Server
**Rationale:** Independent of publishing fixes. Enables real user onboarding testing. Builds a reusable component for future platform OAuth flows (LinkedIn, Instagram, TikTok).
**Delivers:** Automatic OAuth code capture via localhost callback server. Zero manual steps in happy path. Fallback to manual entry if port unavailable. State parameter validation (CSRF fix). Single callback URL constant across codebase.
**Addresses:** OAuth callback server (FEATURES P1). Callback URL consolidation.
**Avoids:** Pitfall 4 (example.com callback), Pitfall 5 (URL in 3 locations), Pitfall 11 (port leak/cleanup failure), Pitfall 12 (state not validated).
**Stack:** `Bun.serve()` built-in. Fixed port 18923, hostname `127.0.0.1`. New file `src/cli/oauth-callback-server.ts`.
**Complexity:** MEDIUM. ~80 lines new code + cleanup handlers (SIGINT/SIGTERM) + timeout + fallback logic.

### Phase 4: Thread Publishing Resilience
**Rationale:** Depends on Phase 1 (workers must run to test) and benefits from Phase 2 (pre-validated tweets reduce mid-thread content failures). Touches same file as Phase 2 (`x.handler.ts`) so must come after to avoid conflicts. Highest data-loss risk in the milestone.
**Delivers:** Per-tweet checkpoint persistence to DB. Resume-from-checkpoint on Trigger.dev retry. No more orphaned partial threads. Optimistic locking on token refresh for concurrent task safety.
**Addresses:** Thread publishing resilience (FEATURES P1). Thread resume capability (checkpoint storage).
**Avoids:** Pitfall 2 (lost tweet IDs), Pitfall 3 (checkpoint write fails silently), Pitfall 6 (refresh token race condition).
**Stack:** No new dependencies. Modify `x.handler.ts` (pass `db` to `postThread`, add checkpoint writes with retry logic).
**Complexity:** HIGH. Most invasive change -- sequential DB writes after each tweet, retry logic for checkpoint failures, duplicate detection (X Error 187), optimistic locking on token rows.

### Phase 5: Testing Infrastructure
**Rationale:** Write tests AFTER production code stabilizes (Phases 1-4). Testing moving targets wastes effort. Carried from v1.2.
**Delivers:** Mock infrastructure (fixtures, DB mocks, client class mocks). Handler compliance test suite verifying PlatformPublisher contract. Unit tests for validation and checkpoint logic. Vitest config with path alias resolution.
**Addresses:** Testing infrastructure (FEATURES P2). Handler contract verification.
**Avoids:** Pitfall 13 (mocking wrong layer -- mock at client class boundary, not fetch), Pitfall 14 (vitest path aliases broken).
**Stack:** Vitest 4.x (already installed). `@vitest/coverage-istanbul` if coverage desired. Mock at client class boundary, NOT HTTP layer.
**Complexity:** MEDIUM. Infrastructure setup + test writing for 4 phases of new code.

### Phase 6: Context Management
**Rationale:** Pre-commit hooks run linter and typecheck, which require stable code and tests to exist. Must be last. Carried from v1.2.
**Delivers:** `lefthook.yml` with parallel pre-commit hooks (biome on staged files with auto-fix, typecheck, circular dep check). State consolidation between PROJECT.md and MEMORY.md.
**Addresses:** Context management (FEATURES P2). Automated quality gates.
**Avoids:** Pitfall 15 (hooks blocking Claude Code workflow -- keep hooks under 3 seconds).
**Stack:** `lefthook` (Go binary). New `lefthook.yml` at project root.
**Complexity:** LOW. Config file + state consolidation documentation task.

### Phase Ordering Rationale

- **Env vars first:** All deployed Trigger.dev tasks crash without credentials. This is the prerequisite for testing any other fix in production.
- **Validation before thread resilience:** Both modify `x.handler.ts`. Validation is smaller and independent -- landing it first avoids merge conflicts and reduces mid-thread failures that thread resilience must handle.
- **OAuth between validation and thread resilience:** Independent of both but logically groups the "X platform fixes" together. Order relative to Phase 2 is flexible.
- **Thread resilience after validation:** Benefits from pre-validated tweets (fewer content-related mid-thread failures). Only network/rate-limit errors remain, which have existing retry logic.
- **Tests after code stabilizes:** Writing tests against code that is about to change means rewriting tests. All production code lands in Phases 1-4.
- **Hooks last:** Pre-commit hooks validate code quality. Tests and stable code must exist first.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 4 (Thread Resilience):** Most complex phase. Needs detailed implementation spec for: checkpoint write error handling with retry, duplicate detection via X Error 187 response parsing, optimistic locking pattern for token refresh, and the exact DB update query for threadProgress metadata. Consider `/gsd:research-phase`.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Env Vars):** `syncEnvVars` is extremely well-documented by Trigger.dev. Copy from official docs.
- **Phase 2 (Validation):** X character counting rules are stable and well-documented. Straightforward pure-function implementation.
- **Phase 3 (OAuth Callback):** RFC 8252 pattern used by GitHub CLI, Google oauth2l, Trigger.dev CLI. Well-established.
- **Phase 5 (Testing):** Standard Vitest patterns. Mock boundaries clear from architecture.
- **Phase 6 (Context Management):** lefthook config is declarative YAML. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions verified against official docs and existing codebase. No speculative choices. Conflicts between researchers resolved with clear rationale. |
| Features | HIGH | Features derived from actual user friction points (342-turn session), not hypothetical needs. FEATURES.md had stale API name (resolveEnvVars) and incorrect twitter-text recommendation -- both corrected. |
| Architecture | HIGH | All modifications target existing code with known file paths, line numbers, and schema. Zero new tables/migrations. ARCHITECTURE.md recommended husky over lefthook -- overridden per Biome official recommendation. |
| Pitfalls | HIGH | 16 pitfalls identified from codebase analysis, official docs, and community reports. Prevention strategies are specific, actionable, and mapped to phases. |

**Overall confidence:** HIGH

### Gaps to Address

- **X API 403 error body parsing:** PITFALLS.md mentions parsing the `detail` field to distinguish content violations from auth failures. The exact response body format for different 403 sub-errors needs validation during Phase 2/4 implementation. X documentation is incomplete on this -- may need empirical testing.
- **Refresh token race condition severity:** Identified as Pitfall 6. Optimistic locking is recommended, but actual concurrency level in PSN (single user, typically 1-3 concurrent tasks) means this may be rare. Validate whether this needs full implementation or just documentation during Phase 4 planning.
- **Coverage provider compatibility:** STACK.md notes `@vitest/coverage-istanbul` is required for Bun (v8 provider has known issues). Verify during Phase 5 if coverage reporting is desired.
- **X Developer Portal callback URL registration:** Setup instructions must tell users to register `http://127.0.0.1:18923/callback`. This is a documentation + setup wizard update that must not be forgotten during Phase 3.
- **twitter-text conformance test data:** The custom validator should be tested against twitter-text's GitHub conformance test fixtures (YAML files) to ensure accuracy. These fixtures are the ground truth for X's counting rules even if the npm package is unmaintained.

## Sources

### Primary (HIGH confidence)
- [Trigger.dev Environment Variables](https://trigger.dev/docs/deploy-environment-variables) -- syncEnvVars, env var delivery, deploy-time behavior
- [Trigger.dev syncEnvVars Extension](https://trigger.dev/docs/config/extensions/syncEnvVars) -- build extension API
- [Trigger.dev Env Vars SDK Changelog](https://trigger.dev/changelog/env-vars-sdk) -- resolveEnvVars -> syncEnvVars migration
- [X OAuth 2.0 PKCE](https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code) -- callback URL rules, PKCE mandate
- [X Character Counting Rules](https://docs.x.com/fundamentals/counting-characters) -- URL weighting, emoji handling
- [RFC 8252 - OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252) -- localhost callback standard, HTTP exemption (Section 7.3)
- [Arctic v3 Documentation](https://arcticjs.dev/) -- PKCE flow, localhost callback support
- [Biome Git Hooks Recipe](https://biomejs.dev/recipes/git-hooks/) -- lefthook official recommendation
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) -- configuration, features, parallel execution
- [Bun.serve() docs](https://bun.sh/docs/api/http) -- server lifecycle, stop(), hostname binding
- Codebase analysis: `x.handler.ts` (thread posting, token refresh, callback URL), `setup-x-oauth.ts` (hardcoded URL, unused state), `thread-splitter.ts` (raw string.length), `trigger.config.ts` (no env config), `schema.ts` (threadProgress type)
- Local test run verification: 189/189 tests passing on Vitest 4.0.18 with Bun

### Secondary (MEDIUM confidence)
- [X API Error Troubleshooting](https://developer.x.com/en/support/x-api/error-troubleshooting) -- 403 disambiguation, response body format
- [twitter-text npm](https://www.npmjs.com/package/twitter-text) -- v3.1.0, unmaintained 6+ years (used for status assessment, not as dependency)
- [twitter-text GitHub](https://github.com/twitter/twitter-text) -- conformance test fixtures (useful for custom validator test data)
- Community reports on X rejecting `localhost` vs accepting `127.0.0.1` for OAuth callbacks
- 342-turn, 29-hour trial session analysis exposing all 6 friction points

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
