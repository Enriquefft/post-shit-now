---
phase: 01-fix-instagram-integration-bugs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/cli/setup-instagram-oauth.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "Instagram OAuth stores accountId (not userId) in token metadata"
    - "Existing tokens with userId key are migrated to accountId on read"
    - "OAuth callback uses local server (127.0.0.1:18923) instead of example.com"
    - "Setup instructions reference the correct callback URL"
  artifacts:
    - path: "src/cli/setup-instagram-oauth.ts"
      provides: "Fixed OAuth setup with accountId key and local callback server"
      contains: "accountId"
  key_links:
    - from: "src/cli/setup-instagram-oauth.ts"
      to: "src/cli/oauth-callback-server.ts"
      via: "import and use for callback"
      pattern: "oauth-callback-server"
    - from: "src/cli/setup-instagram-oauth.ts"
      to: "src/platforms/handlers/instagram.handler.ts"
      via: "accountId metadata key agreement"
      pattern: "accountId"
---

<objective>
Fix the Instagram OAuth setup to store the correct metadata key (`accountId` instead of `userId`) and use the local OAuth callback server instead of the hardcoded `https://example.com/callback` placeholder.

Purpose: The metadata key mismatch (`userId` vs `accountId`) silently breaks every Instagram publish, analytics collection, and engagement monitor flow because they all read `metadata.accountId` which is never set. The hardcoded callback URL makes real OAuth impossible.

Output: A working `setup-instagram-oauth.ts` that stores `accountId` in token metadata and uses the local callback server for the OAuth redirect.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/01-fix-instagram-integration-bugs/01-CONTEXT.md
@src/cli/setup-instagram-oauth.ts
@src/cli/oauth-callback-server.ts
@src/platforms/handlers/instagram.handler.ts

<interfaces>
<!-- Key contracts the executor needs -->

From src/cli/oauth-callback-server.ts:
```typescript
export interface CallbackResult { code: string; state: string; }
export interface CallbackError { error: "timeout" | "state_mismatch" | "port_unavailable" | "missing_params"; message: string; }
export type CallbackOutcome = { ok: true; result: CallbackResult } | { ok: false; error: CallbackError };
// Function: startCallbackServer(expectedState: string, timeoutMs?: number): Promise<CallbackOutcome>
```

From src/platforms/x/oauth.ts (callback constants):
```typescript
export const OAUTH_CALLBACK_HOSTNAME = "127.0.0.1";
export const OAUTH_CALLBACK_PORT = 18923;
```

Consumers that read `metadata.accountId`:
- `instagram.handler.ts:83` — `const accountId = tokenMetadata.accountId;`
- `analytics-collector.ts:318` — `const accountId = token.metadata?.accountId;`
- `engagement-monitor.ts:88` — `const accountId = igToken.metadata?.accountId ?? "";`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix accountId metadata key and callback URL</name>
  <files>src/cli/setup-instagram-oauth.ts</files>
  <action>
Make three changes to `src/cli/setup-instagram-oauth.ts`:

1. **Fix the metadata key** (line 185): Change `userId: tokens.userId` to `accountId: tokens.userId` in the metadata object inside `completeInstagramOAuth()`. The value (`tokens.userId`) is correct — it's the key name that's wrong. All three consumers (handler, analytics, engagement) read `metadata.accountId`.

2. **Replace the callback URL** (line 9): Replace the `INSTAGRAM_CALLBACK_URL = "https://example.com/callback"` constant with the local callback server URL. Import `OAUTH_CALLBACK_HOSTNAME` and `OAUTH_CALLBACK_PORT` from `../platforms/x/oauth.ts` and build the URL as `http://${OAUTH_CALLBACK_HOSTNAME}:${OAUTH_CALLBACK_PORT}/callback`. This matches X OAuth's proven pattern.

3. **Update setup instructions** (line 59): Change the instruction that says `"4. Set OAuth redirect URL to: https://example.com/callback"` to reference the actual callback URL `http://127.0.0.1:18923/callback`.

4. **Add backward compatibility**: After the metadata object is constructed in `completeInstagramOAuth()`, no migration shim is needed at the storage site — but add a compatibility read in the three consumers. Actually, since this plan only owns `setup-instagram-oauth.ts`, just fix the write side. The read side already handles missing `accountId` gracefully (returns error). Any pre-existing tokens with the wrong key will fail and the user re-runs setup, which writes the correct key.

Do NOT wire up the full callback server flow (startCallbackServer + auto-capture). That would change the setup UX significantly. Just fix the URL so Meta's redirect hits the right endpoint. The existing manual "paste the code" flow still works — the user just copies the code param from the localhost redirect.
  </action>
  <verify>
    <automated>bun run typecheck</automated>
  </verify>
  <done>
- `completeInstagramOAuth()` stores `accountId` (not `userId`) in token metadata
- `INSTAGRAM_CALLBACK_URL` points to `http://127.0.0.1:18923/callback`
- Setup instructions reference the correct callback URL
- TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
- `bun run typecheck` passes
- `biome check src/cli/setup-instagram-oauth.ts` passes
- The metadata key in the upsert block is `accountId`, not `userId`
- The callback URL constant is `http://127.0.0.1:18923/callback`
</verification>

<success_criteria>
Instagram OAuth token storage uses the `accountId` key that all downstream consumers expect, and the callback URL points to the local OAuth callback server.
</success_criteria>

<output>
After completion, create `.planning/phases/01-fix-instagram-integration-bugs/01-01-SUMMARY.md`
</output>
