# Stack Research

**Domain:** CLI-first social media automation system
**Researched:** 2026-02-18
**Confidence:** HIGH (core stack verified via official docs and npm; platform APIs verified via official developer portals)

## Recommended Stack

### Core Runtime & Build

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.7+ | Language | Type safety across CLI commands, Trigger.dev tasks, and Drizzle schema. Non-negotiable for a system with this many API integrations. |
| Node.js | 22 LTS | Runtime | Current LTS. Required by Trigger.dev v4 (supports 21.7.3, 22.16.0, Bun 1.3.3). Use 22 for long-term support. |
| pnpm | 9+ | Package manager | Workspace support for monorepo. Faster, stricter than npm. Trigger.dev docs use pnpm. |
| tsx | latest | Script runner | Run TypeScript CLI scripts directly without build step. Used for local utility commands. |

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Neon Postgres | - | Managed Postgres | Serverless driver for edge/serverless. Free tier for personal hubs. Branching for dev/staging. Native RLS support. **Decision already made.** |
| `@neondatabase/serverless` | 1.0.2 | Neon driver | Official serverless driver. WebSocket-based connection pooling. Works in Node.js and serverless. |
| `drizzle-orm` | 0.45.x | ORM | SQL-like API, zero overhead, first-class RLS support via `crudPolicy()` helper with Neon roles. Schema-as-code with TypeScript. **Decision already made.** |
| `drizzle-kit` | latest | Migrations | Generate and run migrations from Drizzle schema. Bundled with repo, runs during `/psn:setup`. |

**Drizzle + Neon RLS pattern:** Drizzle provides `pgPolicy()`, `pgRole()`, and `crudPolicy()` (from `drizzle-orm/neon`) for declarative RLS. Neon exposes `authenticated` and `anonymous` roles. Policies are defined alongside schema, not in raw SQL. This is the officially recommended approach per both Neon and Drizzle docs.

### Background Tasks & Scheduling

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@trigger.dev/sdk` | 4.1.x | Task SDK | v4 is GA. Warm starts (100-300ms). Waitpoints for approval workflows. Priority runs. Middleware system. **Decision already made.** |
| `trigger.dev` (CLI) | 4.3.x | Dev/deploy CLI | `npx trigger dev` for local development, `npx trigger deploy` for cloud. |

**Key Trigger.dev v4 patterns for this project:**
- **Delayed runs**: `task.trigger({ ... }, { delay: "2h" })` for scheduled posts. Store `runId` in DB to cancel/reschedule.
- **Cron tasks**: `schedules.task({ cron: "0 */6 * * *" })` for analytics collection, trend gathering, token refresh.
- **Waitpoints (wait-for-token)**: Human-in-the-loop approval for company posts. Create token, send to WhatsApp, wait for response.
- **Priority**: `task.trigger({ ... }, { priority: 100 })` for time-sensitive posts.
- **Middleware + locals**: Share hub connection context across all tasks.

**Breaking change from v3:** Import from `@trigger.dev/sdk` (not `@trigger.dev/sdk/v3`). Queues must be predefined with `queue()`. Lifecycle hooks use single object params.

### Validation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `zod` | 4.x | Schema validation | Validate API payloads, config files, command inputs. Drizzle has native Zod integration (now built into drizzle-orm, no separate drizzle-zod package needed). Trigger.dev `schemaTask` uses Zod. |

### OAuth & Token Management

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `arctic` | 3.x | OAuth 2.0 clients | Lightweight, typed OAuth clients. Supports **LinkedIn, Twitter/X, TikTok, Facebook** (Instagram uses Facebook OAuth). No heavy auth framework needed since we store tokens in DB, not sessions. |

**OAuth flow per platform:**
- **X/Twitter**: OAuth 2.0 PKCE. Arctic `Twitter` provider. Tokens don't expire (revoke-only).
- **LinkedIn**: OAuth 2.0 authorization code. Arctic `LinkedIn` provider. Tokens expire in 60 days. Cron task for refresh.
- **Instagram**: OAuth 2.0 via **Facebook Login** (Instagram Graph API requires Facebook Business Login). Arctic `Facebook` provider. Short-lived token (1hr) exchanged for long-lived (60 days). Cron task for refresh.
- **TikTok**: OAuth 2.0. Arctic `TikTok` provider. Tokens expire, refresh via cron.

**Token storage:** Encrypted in `oauth_tokens` DB table. Trigger.dev `token-refresher` cron task checks expiry daily and refreshes proactively.

**Instagram note:** Arctic does not have a dedicated Instagram provider because Instagram OAuth goes through Facebook. Use the `Facebook` provider with `instagram_basic`, `instagram_content_publish`, `pages_show_list` scopes.

---

## Platform API SDKs

### X (Twitter)

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| `twitter-api-v2` | 1.29.x | Full X API v2 client | HIGH - actively maintained, 4k+ GitHub stars, official X docs list it |

**Usage:** Post tweets, upload media (images/video), read analytics, manage threads. Supports OAuth 2.0 and OAuth 1.0a. Pay-per-use pricing: $0.01/post, $0.005/read.

```typescript
import { TwitterApi } from 'twitter-api-v2';
const client = new TwitterApi(accessToken);
await client.v2.tweet({ text: 'Hello world' });
```

### LinkedIn

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| Direct REST API calls | - | LinkedIn Marketing API | HIGH - no good SDK exists; raw fetch is the standard approach |

**Why no SDK:** LinkedIn's Marketing API is versioned (currently `202602`). Community SDKs are stale or incomplete. The API is REST + JSON; a thin typed wrapper over `fetch` is all you need. Build a `linkedin-client.ts` module.

**Key endpoints:**
- `POST /rest/posts` - Create posts (text, articles, images, carousels)
- `POST /rest/images` - Upload images (register + upload flow)
- `GET /rest/organizationalEntityShareStatistics` - Analytics

**Partner approval required:** Takes days to weeks. Apply early. Tokens expire 60 days.

### Instagram

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| Direct REST API calls | - | Instagram Graph API (via Facebook) | HIGH - same situation as LinkedIn, thin wrapper is best |

**Why no SDK:** The `instagram-graph-api` npm package exists but is thin and low-adoption. Better to build a typed client. Instagram Graph API endpoints are stable and well-documented.

**Key endpoints:**
- `POST /{ig-user-id}/media` - Create media container (image_url/video_url + caption)
- `POST /{ig-user-id}/media_publish` - Publish container
- `GET /{ig-user-id}/insights` - Analytics

**Rate limit:** 200 requests/hour. Business/Creator account required. No personal accounts.

### TikTok

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| Direct REST API calls | - | TikTok Content Posting API | HIGH - official REST API, no maintained SDK |
| `ensembledata` | latest | TikTok analytics scraping | MEDIUM - third-party service, ~$100/mo |

**Content Posting API:** REST endpoint at `https://open.tiktokapis.com/v2/post/publish/`. Supports Direct Post and Inbox (Draft) modes. **Audit required** for public posting access.

**Analytics:** TikTok's official API has limited analytics. EnsembleData provides real-time scraping for engagement metrics, trending content, hashtag monitoring. Fallback: TikTok Creative Center (free, manual).

---

## Intelligence & Search APIs

| Library | Version | Purpose | Pricing | Confidence |
|---------|---------|---------|---------|------------|
| `@tavily/core` | latest | Search API for trend research | ~$0.005/search (1000 free/mo) | HIGH - official SDK, Vercel AI SDK compatible |
| `@exalabs/ai-sdk` | latest | Semantic search, content discovery | $0.001/search (1000 free/mo) | HIGH - official SDK |
| Perplexity API (via `openai` SDK) | - | Deep research, trend analysis | $5/1000 searches (Sonar), $1/1000 (Sonar Pro for citations) | HIGH - OpenAI-compatible API |
| Brave Search API (raw fetch) | - | Web search, news monitoring | $5/1000 requests ($5 free credit/mo) | HIGH - independent index, less SEO spam |

**Perplexity integration:** Uses OpenAI-compatible API format. Use the `openai` package with `baseURL: 'https://api.perplexity.ai'`. Models: `sonar` (fast), `sonar-pro` (deeper retrieval). Citation tokens now free.

**Strategy:** Use Tavily for quick searches (cheap, fast). Exa for semantic/neural search (finding similar content). Perplexity for deep research queries. Brave for news monitoring.

---

## Image & Video Generation

| Library | Version | Purpose | Pricing | Confidence |
|---------|---------|---------|---------|------------|
| `openai` | 6.22.x | GPT Image (gpt-image-1, gpt-image-1.5) | ~$0.02-0.08/image | HIGH - official SDK |
| `@fal-ai/client` | 1.9.x | FLUX.2 (photorealistic images) | $0.012-0.03/megapixel | HIGH - official SDK |
| Ideogram API (raw fetch) | - | Ideogram 3.0 (best text in images) | $0.04-0.10/image | MEDIUM - no official Node SDK, REST API |

**GPT Image:** Use `openai` SDK. `client.images.generate({ model: "gpt-image-1" })`. Returns base64. Supports up to 4096x4096. Streaming supported. Best for versatile, instruction-following images.

**FLUX.2:** Use `@fal-ai/client`. FLUX.2 [pro] for production quality (no parameter tuning needed), FLUX.2 [dev] for fast prototyping. Sub-2-second generation on fal.ai. Best for photorealistic images.

**Ideogram 3.0:** REST API at `https://api.ideogram.ai`. No official Node SDK -- build thin typed client. Best for images with text (logos, social cards, infographics). Style references (up to 3 images).

**Alternative for FLUX.2:** `replicate` (1.4.x) if you want a single SDK for multiple models. fal.ai is faster and cheaper for FLUX specifically.

---

## WhatsApp Notifications

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| WAHA (Docker) | latest | Self-hosted WhatsApp HTTP API | MEDIUM - unofficial WhatsApp client, ToS risk |

**Setup:** `docker run -p 3000:3000 devlikeapro/waha`. REST API at `localhost:3000`. Dashboard at `localhost:3000/dashboard`. Scan QR code to link WhatsApp account.

**Engines:** WEBJS (browser-based), NOWEB (WebSocket, lighter), GOWS (Go WebSocket, fastest). Use NOWEB for server deployment.

**Core free tier** covers sending/receiving text, images, video. No message limits.

**Alternative:** Twilio WhatsApp API for production reliability (official WhatsApp Business API partner). Higher cost but no ToS risk.

---

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | latest | Environment variable loading | Loading hub.env and connections/*.env files |
| `yaml` | latest | YAML parsing | Parsing strategy.yaml, voice profiles, series config |
| `sharp` | latest | Image processing | Resize, crop, format convert before upload. Platform-specific sizing. |
| `nanoid` | latest | ID generation | Post IDs, invite codes, idempotency keys |
| `date-fns` | latest | Date manipulation | Scheduling, analytics time ranges, timezone handling |
| `date-fns-tz` | latest | Timezone support | Converting schedule times to platform-native UTC |
| `chalk` | latest | CLI output coloring | Command output formatting (if running outside Claude Code) |
| `ora` | latest | CLI spinners | Loading indicators for long operations |
| `p-limit` | latest | Concurrency control | Rate limiting API calls per platform |
| `encrypt` / `node:crypto` | built-in | Token encryption | Encrypting OAuth tokens at rest in DB. Use Node.js built-in crypto, no external package needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` | Testing | Fast, TypeScript-native. Use for unit testing API clients and Trigger.dev task logic. |
| `biome` | Lint + format | Single tool replacing ESLint + Prettier. Faster. Less config. |
| `drizzle-kit` | DB migrations | `drizzle-kit generate` for SQL, `drizzle-kit migrate` to apply. |
| `trigger.dev` CLI | Task dev/deploy | `npx trigger dev` for local, `npx trigger deploy` for cloud. |

---

## Project Structure

```
post-shit-now/
  config/                    # User config (git-tracked, .env gitignored)
    hub.env                  # Personal hub credentials (gitignored)
    connections/             # Company hub connections (gitignored)
    strategy.yaml            # Personal strategy config
    voice-profiles/          # Voice profile YAML files
    series/                  # Content series config
  content/                   # Content workspace
    drafts/                  # Post drafts (auto-pruned 14d after publish)
    media/                   # Generated media (auto-pruned 7d after posting)
  src/
    db/
      schema/                # Drizzle schema files (tables, RLS policies)
      migrations/            # Generated migration SQL
      index.ts               # DB client factory (personal + company hubs)
    clients/                 # Platform API clients
      x.ts                   # Twitter/X client (twitter-api-v2 wrapper)
      linkedin.ts            # LinkedIn REST client
      instagram.ts           # Instagram Graph API client
      tiktok.ts              # TikTok Content Posting client
      whatsapp.ts            # WAHA REST client
    intelligence/            # Search/research API clients
      tavily.ts
      exa.ts
      perplexity.ts
      brave.ts
    media/                   # Image/video generation clients
      gpt-image.ts
      flux.ts
      ideogram.ts
    trigger/                 # Trigger.dev task definitions
      queues.ts              # Predefined queues (per-platform, per-hub)
      middleware.ts          # Hub context middleware
      tasks/
        post-publisher.ts    # Scheduled post execution
        analytics-collector.ts  # Cron: collect platform analytics
        trend-gatherer.ts    # Cron: intelligence gathering
        token-refresher.ts   # Cron: OAuth token refresh
        notification-sender.ts  # WhatsApp notification dispatch
    lib/                     # Shared utilities
      crypto.ts              # Token encryption/decryption
      config.ts              # YAML/env config loaders
      validation.ts          # Zod schemas
  .claude/
    commands/                # Slash command .md files
  trigger.config.ts          # Trigger.dev project config
  drizzle.config.ts          # Drizzle Kit config
  package.json
  tsconfig.json
```

**Not a monorepo.** This is a single package. Trigger.dev v4 bundles tasks from the same project. No need for pnpm workspaces or turborepo -- it adds complexity without benefit for a repo-as-workspace distribution model where users clone and run.

---

## Installation

```bash
# Core
npm install @trigger.dev/sdk drizzle-orm @neondatabase/serverless zod

# Platform clients
npm install twitter-api-v2 arctic

# Intelligence
npm install @tavily/core @exalabs/ai-sdk

# Image generation
npm install openai @fal-ai/client

# TikTok analytics (optional, ~$100/mo)
npm install ensembledata

# Utilities
npm install yaml sharp nanoid date-fns date-fns-tz dotenv p-limit

# Dev dependencies
npm install -D typescript @types/node vitest @biomejs/biome drizzle-kit trigger.dev tsx
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `drizzle-orm` | Prisma | Never for this project. Prisma's query engine adds latency in serverless. Drizzle is SQL-native with zero overhead. Prisma also lacks first-class RLS support. |
| `arctic` (OAuth) | `passport.js` | Never. Passport is session-based, designed for web apps. We have no web server. Arctic is stateless OAuth 2.0 flows only. |
| `@fal-ai/client` (FLUX) | `replicate` | If you want one SDK for many models (Stable Diffusion, etc). fal.ai is faster and cheaper specifically for FLUX.2. |
| `twitter-api-v2` | Raw fetch | If you only need tweet posting. But the SDK handles media upload, pagination, rate limiting -- worth the dependency. |
| `biome` (lint/format) | ESLint + Prettier | If you need ESLint plugins for specific rules. Biome covers 95% of cases, runs 10-100x faster, and is a single dependency. |
| `vitest` | Jest | If you have existing Jest config. Vitest is faster, native TypeScript, same API as Jest. No reason to use Jest for a new project. |
| WAHA (WhatsApp) | Twilio WhatsApp | For production/enterprise where ToS compliance matters. Twilio is an official WhatsApp Business API partner. Higher cost but zero ban risk. |
| Single package | pnpm monorepo | Never for this project. Users clone this repo as a workspace. A monorepo adds `pnpm-workspace.yaml`, `turbo.json`, cross-package imports -- all complexity for a single deployable unit. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-linkedin` npm | Abandoned (last update 2019), uses deprecated LinkedIn v1 API | Raw fetch with typed client |
| `instagram-private-api` | Uses undocumented private API, guaranteed to break, ban risk | Instagram Graph API (official) |
| `@trigger.dev/sdk/v3` import path | v4 breaking change -- this path is removed | `@trigger.dev/sdk` (no /v3) |
| `drizzle-zod` (separate package) | Merged into `drizzle-orm` core as of v1.0-beta. Separate package is deprecated. | `import { createSelectSchema } from 'drizzle-orm'` |
| `@fal-ai/serverless-client` | Deprecated, renamed to `@fal-ai/client` | `@fal-ai/client` |
| Prisma | Query engine overhead in serverless, no RLS support, generates client code | `drizzle-orm` |
| `passport.js` | Session-based auth middleware for web apps; we have no web server | `arctic` for OAuth flows |
| `cron` / `node-cron` npm | Running cron in a long-lived process is fragile and doesn't scale | Trigger.dev cron schedules (managed, reliable, observable) |
| Bull / BullMQ | Requires self-hosted Redis, operational burden | Trigger.dev Cloud (managed, no infrastructure) |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `drizzle-orm` 0.45.x | `@neondatabase/serverless` 1.0.x | Drizzle has first-class Neon integration. Use `drizzle(neon(url))` pattern. |
| `@trigger.dev/sdk` 4.1.x | Node.js 22 LTS | v4 requires Node 21.7.3+. Node 22 is the recommended runtime. |
| `zod` 4.x | `drizzle-orm` 0.45.x | Zod schemas generated from Drizzle tables. Built-in since drizzle-orm v1.0-beta. |
| `zod` 4.x | `@trigger.dev/sdk` 4.x | Used in `schemaTask()` for typed task payloads. |
| `arctic` 3.x | Node.js 20+ | Requires Web Crypto API (native in Node 20+). |

---

## Sources

- [Trigger.dev v4 GA announcement](https://trigger.dev/changelog/trigger-v4-ga) -- v4 features, waitpoints, warm starts
- [Trigger.dev v3 to v4 migration guide](https://trigger.dev/docs/migrating-from-v3) -- breaking changes, new import paths
- [Trigger.dev scheduled tasks docs](https://trigger.dev/docs/tasks/scheduled) -- cron syntax, declarative cron
- [Drizzle ORM RLS docs](https://orm.drizzle.team/docs/rls) -- pgPolicy, pgRole, crudPolicy
- [Neon + Drizzle RLS guide](https://neon.com/docs/guides/rls-drizzle) -- authenticated/anonymous roles, crudPolicy helper
- [Drizzle + Neon connection docs](https://orm.drizzle.team/docs/connect-neon) -- serverless driver setup
- [twitter-api-v2 npm](https://www.npmjs.com/package/twitter-api-v2) -- v1.29.x, actively maintained
- [X API tools and libraries](https://docs.x.com/x-api/tools-and-libraries/overview) -- official SDK listing
- [LinkedIn Marketing API overview](https://learn.microsoft.com/en-us/linkedin/marketing/overview?view=li-lms-2026-02) -- current API version, endpoints
- [Instagram Graph API developer guide](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/) -- 2026 guide
- [TikTok Content Posting API reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) -- direct post endpoint
- [Arctic v3 docs](https://arcticjs.dev/) -- supported providers (LinkedIn, Twitter, TikTok, Facebook; no Instagram)
- [WAHA GitHub](https://github.com/devlikeapro/waha) -- Docker setup, engines, capabilities
- [@fal-ai/client npm](https://www.npmjs.com/package/@fal-ai/client) -- v1.9.x, FLUX.2 integration
- [OpenAI image generation docs](https://platform.openai.com/docs/guides/image-generation) -- gpt-image-1, gpt-image-1.5
- [Ideogram API overview](https://developer.ideogram.ai/ideogram-api/api-overview) -- REST API, pricing tiers
- [FLUX.2 on fal.ai](https://fal.ai/flux-2) -- model variants, pricing
- [Tavily SDK reference](https://docs.tavily.com/sdk/javascript/reference) -- @tavily/core
- [Exa API docs](https://docs.exa.ai/reference/getting-started) -- @exalabs/ai-sdk
- [Perplexity API changelog](https://docs.perplexity.ai/changelog/changelog) -- sonar models, deprecations
- [Brave Search API](https://brave.com/search/api/) -- pricing, LLM Context API
- [EnsembleData TikTok API](https://ensembledata.com/tiktok-api) -- scraping, analytics
- [OpenAI npm](https://www.npmjs.com/package/openai) -- v6.22.x
- [Replicate npm](https://www.npmjs.com/package/replicate) -- v1.4.x (alternative to fal.ai)

---
*Stack research for: Post Shit Now -- CLI-first social media automation*
*Researched: 2026-02-18*
