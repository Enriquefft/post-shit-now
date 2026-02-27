# Stack Research: v1.3 Real-World Reliability

**Domain:** Social media automation CLI -- reliability fixes for existing system
**Researched:** 2026-02-27
**Confidence:** HIGH (verified against official docs, existing codebase, and real test runs)

## Scope

This research covers ONLY new stack additions/changes needed for v1.3 fixes. The existing stack (Neon Postgres, Drizzle ORM, Trigger.dev, Bun, TypeScript, Arctic, Zod) is validated and unchanged.

---

## Recommended Stack Additions

### 1. Trigger.dev Environment Variable Delivery

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@trigger.dev/build` | ^4.0.0 | Build extensions for env var sync during deploy | Required for `syncEnvVars` -- the official pattern for injecting env vars into cloud workers |

**The Problem:** All trigger tasks use `process.env.DATABASE_URL`, `process.env.HUB_ENCRYPTION_KEY`, `process.env.X_CLIENT_ID`, etc. (confirmed in `src/trigger/analytics-collector.ts`, `token-refresher.ts`, `health.ts`, etc.). In dev mode, these load from `.env` automatically. In deployed (cloud) mode, they must be explicitly synced. Currently workers get no credentials because nothing syncs env vars to Trigger.dev Cloud.

**The Solution:** `syncEnvVars` build extension in `trigger.config.ts`. Three viable patterns:

**Pattern A: Direct .env file sync via deploy CLI (recommended for PSN)**
```typescript
import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

export default defineConfig({
  runtime: "bun",
  project: "<ref>",
  dirs: ["./src/trigger"],
  build: {
    extensions: [
      syncEnvVars(async () => {
        // This runs during `trigger deploy`, NOT at task runtime.
        // process.env is populated by --env-file flags on the deploy command.
        return {
          DATABASE_URL: process.env.DATABASE_URL!,
          HUB_ENCRYPTION_KEY: process.env.HUB_ENCRYPTION_KEY!,
          X_CLIENT_ID: process.env.X_CLIENT_ID!,
          X_CLIENT_SECRET: process.env.X_CLIENT_SECRET!,
          LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID!,
          LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET!,
          INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID!,
          INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET!,
          TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY!,
          TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET!,
          WAHA_BASE_URL: process.env.WAHA_BASE_URL ?? "",
          WAHA_SESSION: process.env.WAHA_SESSION ?? "default",
        };
      }),
    ],
  },
});
```

Deploy command: `bunx trigger.dev@latest deploy --env-file config/hub.env --env-file config/keys.env`

The `--env-file` flag hydrates `process.env` in the CLI process so `syncEnvVars` can read them. `syncEnvVars` then pushes them to the Trigger.dev Cloud environment for that deploy.

**Pattern B: One-time SDK upload (for initial setup or scripting)**
```typescript
import { envvars } from "@trigger.dev/sdk";
await envvars.upload({ variables: parsed, override: false });
```

**Pattern C: Dashboard manual entry** -- Not viable for PSN's BYOK model where each user has different credentials.

**Recommendation:** Use Pattern A as the primary mechanism. Add a `/psn:deploy` command that runs the deploy with correct `--env-file` flags. Pattern B can serve as a setup-time helper.

**Critical detail:** `syncEnvVars` does NOT run during `trigger dev` -- only during `trigger deploy`. Dev mode automatically loads `.env` files. The existing dev experience is unchanged.

### 2. X OAuth Callback Server

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Bun built-in HTTP server | (bundled with Bun) | Temporary localhost server for OAuth callback | Zero dependencies, Bun.serve() starts in <1ms, project already uses Bun runtime |

**The Problem:** Current OAuth flow uses `https://example.com/callback` as the redirect URI (confirmed in `src/cli/setup-x-oauth.ts` line 9). Users must manually copy the authorization code from the browser URL bar -- error-prone and confusing.

**The Solution:** Spin up a temporary `Bun.serve()` on `http://localhost:PORT/callback` during the OAuth flow. Arctic already supports localhost callback URIs natively.

**Implementation approach:**
```typescript
function startCallbackServer(port: number): Promise<{ code: string; state: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.stop();
      reject(new Error("OAuth callback timeout (5 minutes)"));
    }, 300_000);

    const server = Bun.serve({
      port,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          clearTimeout(timeout);
          server.stop();
          if (code && state) {
            resolve({ code, state });
            return new Response(
              "<html><body><h2>Authorization complete.</h2><p>You can close this tab and return to your terminal.</p></body></html>",
              { headers: { "Content-Type": "text/html" } }
            );
          }
          reject(new Error("Missing code or state in callback"));
          return new Response("Error: missing parameters", { status: 400 });
        }
        return new Response("Not found", { status: 404 });
      },
    });
  });
}
```

**Port selection:** Use port 9876 (uncommon, avoids conflicts with dev servers). X Developer Portal requires the exact callback URL to be registered, so setup instructions must tell users to set `http://localhost:9876/callback`.

**X Platform callback requirements (verified via official docs):**
- X accepts `http://localhost:PORT/callback` for development
- The callback URL in the Developer Portal must match exactly
- HTTPS is NOT required for localhost
- Arctic handles PKCE with arbitrary callback URLs

**No new dependencies needed.** Bun.serve() is built-in. Keep manual code paste as a fallback path if the port is unavailable.

### 3. Tweet Content Validation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom `tweet-validator.ts` | N/A | Pre-flight tweet validation before API call | `twitter-text` is unmaintained (v3.1.0, last release 6+ years ago). Rules are simple enough to implement directly. |

**Why NOT `twitter-text` (npm):**
- Last published version 3.1.0 was ~6 years ago -- no updates since X rebrand
- No maintainer activity
- Package is 37KB with unnecessary features (auto-linking, hashtag extraction, cashtag detection)
- PSN only needs character counting and limit validation

**What to build -- a lightweight `tweet-validator.ts`:**

| Rule | Value | Source |
|------|-------|--------|
| Max characters (standard) | 280 | X API docs |
| URL weighted length | 23 characters (all URLs, regardless of actual length) | X counting rules |
| Max media per tweet | 4 images OR 1 video/GIF | X API docs |
| Thread max tweets | No hard API limit, 25 is practical max | Community consensus |
| Emoji weighting | 2 characters per emoji (surrogate pair) | X counting rules |

```typescript
interface TweetValidation {
  weightedLength: number;
  isValid: boolean;
  remainingChars: number;
  errors: string[];
}

function validateTweet(text: string, options?: { mediaCount?: number }): TweetValidation;
function validateThread(tweets: string[]): { valid: boolean; perTweet: TweetValidation[]; errors: string[] };
```

**Key counting rules to implement:**
1. URLs (`http://` or `https://`) count as 23 characters regardless of actual length
2. Emoji (surrogate pairs and ZWJ sequences) count as their code unit length
3. CJK characters count as weight 2
4. Standard ASCII counts as weight 1
5. Newlines count as 1

**Integration:** Call from `XHandler.publish()` BEFORE making API calls. Also integrate with existing `splitIntoThread()` to validate each chunk post-split.

### 4. Vitest (Already Working -- Enhancements Only)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| `vitest` | 4.0.18 (installed) | Test runner | WORKING -- 12 files, 189 tests, all passing |

**Verified via actual test run:** `bun run test` completes in 2.27s with zero failures.

**Known Vitest 4 + Bun issues (verified, NOT affecting PSN):**
- `bun:test` import bundling -- only affects projects importing from `bun:test` directly
- Memory leak in 4.0.18 with large monorepos -- PSN has 12 test files, well under threshold
- `import { $ } from 'bun'` breaks in Vitest 4 -- PSN does not do this in test files

**Recommended config enhancement for v1.3 (coverage support):**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",  // Required for Bun -- v8 provider has known issues
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/trigger/**"],
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
```

**Coverage note:** Use `istanbul` provider, NOT `v8`. The v8 provider has known Bun incompatibilities. Requires `@vitest/coverage-istanbul` as a devDependency.

### 5. Pre-Commit Hooks

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `lefthook` | ^1.11.0 | Git hooks manager | Zero Node.js dependency (Go binary), fastest hook runner, official Biome recommendation, parallel execution |

**Why lefthook over husky + lint-staged:**
- Single Go binary -- no Node.js dependency chain at all
- Parallel command execution by default (biome + typecheck run simultaneously)
- `stage_fixed: true` auto-re-stages files after Biome auto-fix
- Officially recommended by Biome docs for git hooks
- Used by production projects (n8n codebase, etc.)

**Recommended `lefthook.yml`:**
```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: bunx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
    typecheck:
      run: bun run typecheck
    circular:
      run: bun run check:circular
```

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@trigger.dev/build` | ^4.0.0 | Build extensions for syncEnvVars | Required for env var delivery to cloud workers during deploy |
| `lefthook` | ^1.11.0 | Pre-commit hooks | Dev tooling -- biome, typecheck, circular dep check on commit |
| `@vitest/coverage-istanbul` | ^4.0.0 | Code coverage with Bun | Only if coverage reporting is desired |

## Installation

```bash
# New production dependency (needed at deploy time)
bun add @trigger.dev/build

# New dev dependencies
bun add -D lefthook

# Optional (coverage)
bun add -D @vitest/coverage-istanbul

# Setup hooks after install
bunx lefthook install
```

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `twitter-text` | Unmaintained 6+ years, bloated for our needs (37KB) | Custom `tweet-validator.ts` (~60 lines) |
| `express` / `fastify` / `hono` | Overkill for a 10-second ephemeral OAuth callback server | `Bun.serve()` built-in |
| `husky` + `lint-staged` | Slower, more dependencies, requires Node.js | `lefthook` (Go binary, zero deps) |
| `@vitest/coverage-v8` | Known Bun incompatibilities | `@vitest/coverage-istanbul` if coverage needed |
| `dotenv` | Bun loads `.env` natively; Trigger.dev CLI has `--env-file` flag | Built-in env loading |
| Any secrets manager SDK (Infisical, Vault, etc.) | Overkill for PSN's single-user BYOK model with local config files | `syncEnvVars` reading from `--env-file` populated `process.env` |
| `open` (npm package) | Only needed to open browser for OAuth | `Bun.spawn(["xdg-open", url])` on Linux, or print URL for user to click |
| `@drunkencure/tweet-character-counter` | Tiny community package with zero adoption | Custom validator with exact rules we need |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `syncEnvVars` build extension | Trigger.dev Dashboard manual entry | Only if user has very few env vars and prefers GUI over CLI |
| `syncEnvVars` build extension | `envvars.upload()` SDK call | One-time bulk import during initial setup only |
| `Bun.serve()` callback | Manual code paste (current flow) | Fallback if port is blocked -- keep manual flow as Plan B in code |
| Custom tweet validator | `twitter-text` npm | Never -- package is abandoned, no updates since X rebrand |
| `lefthook` | `husky` + `lint-staged` | Only if team already uses husky and refuses to switch |
| `istanbul` coverage | `v8` coverage | Only if running Vitest on Node.js instead of Bun |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@trigger.dev/build@^4.0.0` | `@trigger.dev/sdk@^4.3.3` | Must match major version (v4) with existing SDK |
| `vitest@4.0.18` | `bun@1.x` | Working now -- do NOT import from `'bun'` in test files |
| `lefthook@^1.11.0` | Any runtime | Go binary, completely runtime-independent |
| `@vitest/coverage-istanbul@^4.0.0` | `vitest@4.0.18` | Must match vitest major version |
| `arctic@^3.7.0` (existing) | `Bun.serve()` localhost callback | Arctic accepts any valid URL as callback, including `http://localhost:PORT` |

---

## Integration Points

### trigger.config.ts
Add `@trigger.dev/build` import and `syncEnvVars` extension. This is the ONLY config file change needed for env var delivery. The existing `retries`, `maxDuration`, and `dirs` config stays unchanged.

### src/cli/setup-x-oauth.ts
Change `X_CALLBACK_URL` from `"https://example.com/callback"` to `"http://localhost:9876/callback"`. Add `startCallbackServer()` call during OAuth initiation. Keep manual code-paste as fallback.

### src/platforms/x/oauth.ts
No changes needed. Arctic's `Twitter` client already accepts any callback URL. The change is purely in the CLI setup layer.

### src/platforms/handlers/x.handler.ts
Add `validateTweet()`/`validateThread()` call before `client.createTweet()` in both single-tweet and `postThread()` paths. Return `PlatformPublishResult` with `status: "failed"` and descriptive error instead of letting X API return misleading 403.

### Thread Publishing (x.handler.ts)
The existing `postThread()` method (lines 125-160) already tracks `tweetIds` array and has rate-limit retry logic. But it does NOT persist progress to DB mid-thread. v1.3 needs to add DB persistence of `threadProgress` metadata after each successful tweet in the thread, so partial failures can be resumed.

### lefthook.yml
New file at project root. Runs `biome check`, `typecheck`, and `check:circular` in parallel on pre-commit.

---

## Sources

- [Trigger.dev Environment Variables Docs](https://trigger.dev/docs/deploy-environment-variables) -- syncEnvVars, envvars SDK, --env-file flag (HIGH confidence)
- [Trigger.dev Env Vars SDK Changelog](https://trigger.dev/changelog/env-vars-sdk) -- resolveEnvVars migration to syncEnvVars build extension (HIGH confidence)
- [X OAuth 2.0 PKCE Official Docs](https://developer.x.com/en/docs/authentication/oauth-2-0/authorization-code) -- callback URL requirements, PKCE mandate (HIGH confidence)
- [Arctic v3 Documentation](https://arcticjs.dev/) -- PKCE flow, localhost callback support (HIGH confidence)
- [X Character Counting Rules](https://docs.x.com/fundamentals/counting-characters) -- URL weighting, emoji handling (HIGH confidence)
- [twitter-text npm](https://www.npmjs.com/package/twitter-text) -- v3.1.0, last published 6+ years ago, unmaintained (HIGH confidence)
- [Vitest 4.0 Release Blog](https://vitest.dev/blog/vitest-4) -- release notes, breaking changes (HIGH confidence)
- [Vitest 4 + Bun Issues](https://github.com/vitest-dev/vitest/issues/8650) -- bun:test bundling, run mode fix (HIGH confidence)
- [Vitest 4.0.18 Memory Leak Issue](https://github.com/vitest-dev/vitest/issues/9560) -- large monorepo OOM, not PSN-relevant (MEDIUM confidence)
- [Biome Git Hooks Recipe](https://biomejs.dev/recipes/git-hooks/) -- lefthook official recommendation (HIGH confidence)
- [Lefthook GitHub](https://github.com/evilmartians/lefthook) -- features, configuration format (HIGH confidence)
- Verified locally: `bun run test` passes 189/189 tests on vitest 4.0.18 with Bun runtime (HIGH confidence)
- Verified locally: `src/trigger/*.ts` uses `process.env.*` for all credentials (codebase grep, HIGH confidence)
- Verified locally: `src/cli/setup-x-oauth.ts` uses `https://example.com/callback` placeholder (codebase read, HIGH confidence)

---
*Stack research for: PSN v1.3 Real-World Reliability*
*Researched: 2026-02-27*
