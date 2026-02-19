# Stack Research

**Domain:** CLI-first social media automation system
**Researched:** 2026-02-18
**Confidence:** HIGH (core stack verified via npm/official docs), MEDIUM (social API clients -- ecosystem fragmented)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 22.x LTS | Runtime | Trigger.dev v4 supports Node 22.16.0 natively. LTS = stable for production tasks. Avoid Node 21 (non-LTS, only kept for v3 compat). | HIGH |
| TypeScript | 5.5+ | Language | Required by Drizzle, Trigger.dev, and Zod 4. Strict mode mandatory for Zod type inference. | HIGH |
| pnpm | 9.x | Package manager | Disk-efficient (content-addressable store), strict dependency resolution prevents phantom deps, workspace support for monorepo structure. Trigger.dev examples use pnpm. Bun runtime is fine for Trigger.dev tasks but Bun as package manager has edge-case compat issues with some native modules (sharp). | HIGH |
| @trigger.dev/sdk | ^4.3.3 | Task scheduling & execution | v4 is GA. Key features for this project: waitpoints (human-in-the-loop approval), queue management, middleware/lifecycle hooks, priority queuing. Import from `@trigger.dev/sdk` (NOT `@trigger.dev/sdk/v3`). | HIGH |
| trigger.dev (CLI) | ^4.3.3 | Dev/deploy CLI | Must match SDK version. Run `npx trigger.dev@latest dev` for local development. | HIGH |
| drizzle-orm | ^0.45.1 | ORM / query builder | Type-safe, SQL-like API, first-class Neon support via `@neondatabase/serverless`. Stay on 0.45.x stable -- v1 beta exists but has breaking changes (RQBv2, migration folder restructure, validator package moves). Do NOT upgrade to v1 beta for production. | HIGH |
| drizzle-kit | ^0.30.x | Schema migrations | Generates SQL migrations from TypeScript schema. Pairs with drizzle-orm. Will be needed for `/psn:setup` migration runner. | HIGH |
| @neondatabase/serverless | ^1.0.2 | Neon Postgres driver | GA driver for Neon. Use HTTP mode for Trigger.dev tasks (serverless-friendly, no persistent connections). WebSocket mode available if session/transaction support needed. | HIGH |
| zod | ^4.3.6 | Schema validation | Validates API responses, config files, command inputs. Zod 4 has better error formatting (`z.prettifyError`). TypeScript 5.5+ required. Drizzle has built-in zod integration (`drizzle-zod`). | HIGH |

### Social Platform API Clients

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| twitter-api-v2 | ^1.29.0 | X/Twitter API client | The dominant TypeScript client for X API v2. Strongly typed, zero dependencies, supports OAuth 2.0 PKCE, media upload, tweet creation, analytics reads. Officially listed on X Developer Platform. | HIGH |
| linkedin-api-client (official) | latest (beta) | LinkedIn API client | Official LinkedIn JS client by linkedin-developers. Supports 3-legged OAuth, token refresh, Rest.li methods, post creation. Beta status is a concern but it is the ONLY official option. Wrap calls in error handling. | MEDIUM |
| Direct HTTP (fetch/undici) | N/A | Instagram Graph API | No mature, maintained TypeScript client for Instagram Graph API posting. `instagram-graph-api` npm package exists but is thin and sporadically maintained. Better to write a thin typed wrapper over the Graph API endpoints (container creation, publish, media upload). Use Zod to validate responses. | MEDIUM |
| Direct HTTP (fetch/undici) | N/A | TikTok Content Posting API | No official or community TypeScript SDK for TikTok posting. The API is straightforward REST (init upload, upload video/photo, publish). Write a thin typed client. | MEDIUM |

### OAuth & Authentication

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| arctic | ^3.x | OAuth 2.0 flows | Lightweight, fully-typed, runtime-agnostic OAuth 2.0 client. Supports Twitter, LinkedIn, TikTok, and Facebook (for Instagram) out of the box. Does NOT have a dedicated Instagram provider -- use the Facebook provider (Instagram auth goes through Facebook OAuth). 70+ providers, handles PKCE, token refresh. Zero framework dependency. | HIGH |

### Notifications & Messaging

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| WAHA (HTTP API) | latest | WhatsApp notifications | Self-hosted WhatsApp HTTP API. No npm client needed -- it exposes REST endpoints. Call from Trigger.dev tasks via fetch. Free core version, no message limits. Docker-based deployment. | MEDIUM |
| twilio | ^5.x | WhatsApp (alternative) | Official Twilio SDK. More reliable than WAHA for production but costs money. Use as fallback if WAHA proves unstable or if user prefers managed service. | HIGH |

### Image Generation API Clients

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| openai | ^4.x | GPT Image generation | Official OpenAI SDK. Covers GPT Image (DALL-E successor). Well-typed, maintained. | HIGH |
| Direct HTTP (fetch) | N/A | Ideogram 3 API | No official SDK. REST API with API key auth. Thin typed wrapper. | MEDIUM |
| Direct HTTP (fetch) | N/A | Flux 2 (BFL API) | No official SDK. REST API. Thin typed wrapper. | MEDIUM |

### Intelligence & Search APIs

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| Direct HTTP (fetch) | N/A | Perplexity API | OpenAI-compatible API format. Can use the `openai` SDK with a custom baseURL. | HIGH |
| exa-js | latest | Exa search API | Official Exa TypeScript SDK. Semantic search, content retrieval. | MEDIUM |
| Direct HTTP (fetch) | N/A | Tavily API | Simple REST API. No maintained SDK worth depending on. | MEDIUM |
| Direct HTTP (fetch) | N/A | Brave Search API | Simple REST API with API key. Thin wrapper. | MEDIUM |

### Image Processing

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| sharp | ^0.34.5 | Image resizing/optimization | Fastest Node.js image processor (libvips-based). Resize for platform specs, format conversion, optimization before upload. Built-in TypeScript types since v0.32. | HIGH |

### Configuration & File Handling

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| yaml | ^2.x | YAML parsing | Parse strategy.yaml, voice profiles, series configs. Well-maintained, TypeScript types included. | HIGH |
| dotenv | ^16.x | Env file loading | Parse hub.env, connections/*.env, keys.env. Standard, battle-tested. | HIGH |

### Development & Testing

| Tool | Version | Purpose | Why Recommended | Confidence |
|------|---------|---------|-----------------|------------|
| vitest | ^3.x | Testing | Native TypeScript/ESM support, 10-20x faster than Jest in watch mode, Jest-compatible API. No ts-jest config needed. | HIGH |
| tsx | ^4.x | TypeScript execution | Run .ts files directly for scripts/utilities. Faster than ts-node, ESM-native. | HIGH |
| @biomejs/biome | ^1.x | Linting + formatting | Single tool replaces ESLint + Prettier. 35x faster than ESLint. Opinionated defaults reduce config. | MEDIUM |

## Project Structure

```
post-shit-now/
  package.json              # Root package (pnpm workspace)
  pnpm-workspace.yaml       # Workspace config
  tsconfig.json              # Shared TS config
  trigger.config.ts          # Trigger.dev configuration
  drizzle.config.ts          # Drizzle Kit config
  src/
    trigger/                 # Trigger.dev task definitions
      tasks/
        post-scheduler.ts
        analytics-collector.ts
        token-refresher.ts
        trend-gatherer.ts
        notification-sender.ts
    db/
      schema/                # Drizzle schema (single source of truth)
        posts.ts
        analytics.ts
        ideas.ts
        preferences.ts
        teams.ts
        series.ts
        trends.ts
        oauth-tokens.ts
      migrations/            # Generated by drizzle-kit
      index.ts               # DB client export
    lib/
      platforms/             # Platform API wrappers
        x.ts
        linkedin.ts
        instagram.ts
        tiktok.ts
      oauth/                 # OAuth flow helpers (arctic-based)
        index.ts
      notifications/         # WhatsApp/notification helpers
        whatsapp.ts
      media/                 # Image gen + processing
        generate.ts
        process.ts
      intelligence/          # Search/research API wrappers
        perplexity.ts
        exa.ts
        tavily.ts
        brave.ts
    utils/
      config.ts              # YAML/env config loaders
      crypto.ts              # Token encryption for DB storage
  .claude/
    commands/psn/            # Slash commands (markdown prompts)
  config/                    # User config (strategy, voice, etc.)
```

## Installation

```bash
# Initialize with pnpm
pnpm init

# Core dependencies
pnpm add @trigger.dev/sdk@^4.3.3 drizzle-orm@^0.45.1 @neondatabase/serverless@^1.0.2 zod@^4.3.6

# Social platform clients
pnpm add twitter-api-v2@^1.29.0 linkedin-api-client arctic@^3.0.0

# Image & media
pnpm add openai@^4.0.0 sharp@^0.34.5

# Intelligence
pnpm add exa-js

# Notifications
pnpm add twilio@^5.0.0

# Config & utilities
pnpm add yaml@^2.0.0 dotenv@^16.0.0

# Dev dependencies
pnpm add -D typescript@^5.5.0 drizzle-kit@^0.30.0 trigger.dev@^4.3.3 vitest@^3.0.0 tsx@^4.0.0 @biomejs/biome@^1.0.0 @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| pnpm | Bun (package manager) | If you want fastest installs AND are willing to debug occasional native module issues (sharp). Bun runtime for Trigger.dev tasks is fine -- just use pnpm for package management. |
| pnpm | npm | If team is unfamiliar with pnpm. npm works but is slower and allows phantom dependencies. |
| drizzle-orm 0.45.x | drizzle-orm v1 beta | Do NOT use v1 beta yet. Breaking changes to relational queries, migration folder structure, and validator packages. Wait for stable v1 release. |
| arctic | oslo/oauth2 | If you need lower-level OAuth control. Arctic is built on oslo/oauth2 internally -- use Arctic for convenience, drop to oslo if you hit an edge case. |
| vitest | Jest | Only if you need React Native testing (irrelevant here). Jest requires ts-jest config overhead. |
| Biome | ESLint + Prettier | If you need highly specific linting rules or ESLint plugins. Biome covers 90% of use cases at 35x speed. |
| twitter-api-v2 | Direct HTTP | Never for X. The library handles OAuth complexity, pagination, rate limiting, and media upload chunking that would take weeks to reimplement. |
| linkedin-api-client | Direct HTTP | If the beta client proves too buggy. LinkedIn API is Rest.li-based with quirky encoding -- a direct wrapper is feasible but painful. |
| sharp | @napi-rs/image | If sharp causes native module issues in your environment. Rare. |
| WAHA | Twilio | If you need reliability guarantees, compliance, or don't want to self-host. Twilio costs ~$0.005-0.05/message but is production-grade. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| drizzle-orm v1 beta | Breaking changes to RQBv2, migration structure, validator packages. Not stable for production. | drizzle-orm ^0.45.1 (latest stable) |
| Prisma | Heavy ORM, poor serverless cold-start, generated client bloat, no RLS support. | Drizzle ORM |
| passport.js | Express-coupled, callback-heavy, unnecessary for this architecture (no web server). | Arctic (direct OAuth 2.0 flows) |
| instagram-private-api | Uses reverse-engineered private APIs. Will get accounts banned. Violates Instagram TOS. | Instagram Graph API (direct HTTP) |
| linkedin-private-api | Same problem. Reverse-engineered, account ban risk. | linkedin-api-client (official) |
| node-cron / cron | Trigger.dev handles all scheduling. Adding a second scheduler creates split-brain problems. | Trigger.dev scheduled tasks |
| express / fastify | No web server needed. Slash commands run locally, Trigger.dev tasks run in cloud. A web server adds unnecessary surface area. | Direct function calls in Trigger.dev tasks |
| Axios | Fetch is built into Node 22. Axios adds bundle size for zero benefit in this architecture. | Native fetch (global) or undici |
| ts-node | Slow, ESM configuration nightmares. | tsx (faster, ESM-native) |
| @trigger.dev/sdk/v3 import | Deprecated in v4. Will break. | Import from `@trigger.dev/sdk` |

## Stack Patterns by Variant

**For Personal Hub (free tier):**
- Neon free tier: 0.5 GB storage, 190 compute hours/month
- Single Trigger.dev project with personal tasks
- All OAuth tokens stored encrypted in personal DB

**For Company Hub:**
- Neon paid tier if needed (Pro starts at $19/mo)
- Separate Trigger.dev project with company tasks
- RLS policies isolate team member data
- Same schema, different connection string

**For both:**
- Shared `src/` code (schema, platform clients, utilities)
- Different `.env` files drive which hub is targeted
- Trigger.dev tasks read connection config at runtime

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @trigger.dev/sdk@^4.3.3 | Node 22.16.0, Bun 1.3.3 | Set runtime in trigger.config.ts |
| drizzle-orm@^0.45.1 | @neondatabase/serverless@^1.0.2 | Use `drizzle-orm/neon-http` adapter |
| drizzle-orm@^0.45.1 | drizzle-kit@^0.30.x | Kit version must match ORM major. Do not mix 0.45 ORM with 1.0-beta Kit. |
| zod@^4.3.6 | TypeScript 5.5+ | Strict mode required in tsconfig.json |
| arctic@^3.x | Any runtime with Fetch API | Node 22 has global fetch. No polyfill needed. |
| sharp@^0.34.5 | Node 22.x | Native module -- pnpm handles better than Bun for installs. |
| twitter-api-v2@^1.29.0 | Node 18+ | Zero dependencies. Works everywhere. |

## Key Integration Patterns

### Trigger.dev Task + Drizzle + Neon

```typescript
// src/trigger/tasks/analytics-collector.ts
import { task } from "@trigger.dev/sdk";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { analytics } from "../../db/schema/analytics";

export const collectAnalytics = task({
  id: "collect-analytics",
  run: async ({ payload }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);

    // Fetch from platform APIs, insert into DB
    await db.insert(analytics).values({
      postId: payload.postId,
      platform: payload.platform,
      impressions: payload.metrics.impressions,
      // ...
    });
  },
});
```

### OAuth Flow with Arctic

```typescript
// src/lib/oauth/index.ts
import { Twitter, LinkedIn, TikTok, Facebook } from "arctic";

// Each provider initialized with user's BYOK credentials
export function createOAuthClient(platform: string, keys: PlatformKeys) {
  switch (platform) {
    case "x":
      return new Twitter(keys.clientId, keys.clientSecret, keys.redirectUri);
    case "linkedin":
      return new LinkedIn(keys.clientId, keys.clientSecret, keys.redirectUri);
    case "tiktok":
      return new TikTok(keys.clientId, keys.clientSecret, keys.redirectUri);
    case "instagram":
      // Instagram uses Facebook OAuth
      return new Facebook(keys.clientId, keys.clientSecret, keys.redirectUri);
  }
}
```

### Platform API Wrapper Pattern

```typescript
// src/lib/platforms/instagram.ts
import { z } from "zod";

const ContainerResponseSchema = z.object({
  id: z.string(),
});

export async function createInstagramPost(
  accessToken: string,
  igUserId: string,
  imageUrl: string,
  caption: string
) {
  // Step 1: Create media container
  const containerRes = await fetch(
    `https://graph.instagram.com/v21.0/${igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );
  const container = ContainerResponseSchema.parse(await containerRes.json());

  // Step 2: Publish
  const publishRes = await fetch(
    `https://graph.instagram.com/v21.0/${igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: container.id,
        access_token: accessToken,
      }),
    }
  );
  return publishRes.json();
}
```

## Sources

- [@trigger.dev/sdk npm](https://www.npmjs.com/package/@trigger.dev/sdk) -- v4.3.3, verified Feb 2026
- [Trigger.dev v4 GA announcement](https://trigger.dev/changelog/trigger-v4-ga) -- migration guide, breaking changes
- [Trigger.dev v3 to v4 migration](https://trigger.dev/docs/migrating-from-v3) -- runtime support, code changes
- [drizzle-orm npm](https://www.npmjs.com/drizzle-orm) -- v0.45.1, verified Feb 2026
- [Drizzle + Neon setup guide](https://orm.drizzle.team/docs/get-started/neon-new) -- official integration docs
- [Drizzle v1 beta release notes](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2) -- breaking changes documented
- [@neondatabase/serverless npm](https://www.npmjs.com/package/@neondatabase/serverless) -- v1.0.2 GA
- [Neon serverless driver docs](https://neon.com/docs/serverless/serverless-driver) -- HTTP vs WebSocket modes
- [twitter-api-v2 npm](https://www.npmjs.com/package/twitter-api-v2) -- v1.29.0, verified Feb 2026
- [twitter-api-v2 GitHub](https://github.com/PLhery/node-twitter-api-v2) -- TypeScript, zero deps
- [linkedin-api-js-client GitHub](https://github.com/linkedin-developers/linkedin-api-js-client) -- official, beta status
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) -- versioned API docs
- [Arctic v3 docs](https://arcticjs.dev/) -- 70+ providers, Twitter/LinkedIn/TikTok/Facebook confirmed
- [Arctic GitHub](https://github.com/pilcrowonpaper/arctic) -- OAuth 2.0 authorization code flow
- [Zod npm](https://www.npmjs.com/package/zod) -- v4.3.6, verified Feb 2026
- [sharp npm](https://www.npmjs.com/package/sharp) -- v0.34.5, TypeScript types built-in
- [WAHA GitHub](https://github.com/devlikeapro/waha) -- self-hosted WhatsApp HTTP API
- [TikTok Content Posting API](https://developers.tiktok.com/products/content-posting-api/) -- official docs, no SDK
- [Instagram Graph API posting guide](https://getlate.dev/blog/api-to-post-to-instagram) -- 2026 tutorial, container-based flow

---
*Stack research for: Post Shit Now -- CLI-first social media automation*
*Researched: 2026-02-18*
