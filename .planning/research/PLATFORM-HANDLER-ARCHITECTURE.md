# Architecture Research: Platform Handler Refactoring

**Domain:** TypeScript/Node.js social media publishing orchestration
**Researched:** 2026-02-25
**Confidence:** HIGH (verified via codebase analysis, existing patterns, and TypeScript best practices)

## Executive Summary

Current `publish-post.ts` (1,239 lines) is a monolithic Trigger.dev task that directly imports all platform clients, handles token refresh inline, and orchestrates multi-platform publishing with partial failure isolation. This architecture makes it difficult for AI assistants to understand component boundaries, modify one platform without affecting others, and reason about dependencies.

**Recommended architecture:** Extract platform-specific publishing logic into `PlatformPublisher` interface implementations, create shared utilities for cross-cutting concerns (token management, media uploads, error handling), and reduce `publish-post.ts` to orchestration-only (<200 lines). This follows the strategy pattern with dependency injection, enabling AI to understand and modify individual platforms independently.

## System Overview

### Current Architecture (Monolithic)

```
┌─────────────────────────────────────────────────────────────────┐
│                    publish-post.ts (1,239 lines)             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  X      │  │LinkedIn  │  │Instagram│  │ TikTok  │        │
│  │publish  │  │publish   │  │publish  │  │publish  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│  ┌────┴────────────┴────────────┴────────────┴────┐        │
│  │  Direct platform client imports                │        │
│  │  Inline token refresh logic                    │        │
│  │  Media upload handling (per platform)          │        │
│  │  Rate limit handling (per platform)           │        │
│  │  DB state updates                            │        │
│  └───────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
- All platform logic in one file → AI can't focus on single platform
- No interface contracts → AI invents patterns when modifying
- Inline token refresh → duplicate code across platforms
- No separation of concerns → orchestration mixed with implementation
- File size 1,239 lines → exceeds AI deep understanding threshold

### Target Architecture (Split)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Trigger.dev Task Layer                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                                               │
│  │publish-post  │  ← Orchestration only (<200 lines)            │
│  │.ts          │  - Load post, validate, dispatch, aggregate    │
│  └──────┬───────┘                                               │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          ├─── platform dispatcher (strategy pattern)
          │
┌─────────┴───────────────────────────────────────────────────────────┐
│                  Platform Handlers Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │XPublisher   │  │LinkedInPub  │  │InstaPub     │           │
│  │implements   │  │implements   │  │implements   │           │
│  │PlatformPub  │  │PlatformPub  │  │PlatformPub  │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
└───────────────────────────┼────────────────────────────────────────┘
                          │
          ┌───────────────┼────────────────┐
          │               │                │
┌─────────┴──────┐ ┌────┴──────┐ ┌─────┴──────────┐
│Shared Utils    │ │Token      │ │Media Upload   │
│                │ │Manager    │ │Helpers        │
│- error retry   │ │           │ │- chunked      │
│- rate limit   │ │- refresh  │ │- container    │
│  handlers     │ │- validate │ │  creation     │
│- status maps   │ │- decrypt  │ │- polling      │
└────────────────┘ └───────────┘ └───────────────┘
```

**Benefits:**
- Each platform isolated → AI can modify one without understanding others
- Interface contracts → AI knows what each publisher must provide
- Shared utilities → No duplicate token refresh, media upload logic
- Clear boundaries → Orchestration separate from implementation
- Files <200 lines → AI can hold entire context in memory

## Recommended Project Structure

```
src/
├── core/
│   ├── db/
│   │   ├── connection.ts        # Hub DB connection factory (HTTP/WebSocket)
│   │   ├── schema.ts           # Drizzle schema definitions
│   │   └── schema-zod.ts       # Zod validation schemas
│   ├── types/
│   │   ├── platform.ts          # PlatformPublisher interface, shared types
│   │   ├── post.ts             # Post-related types
│   │   └── index.ts            # Barrel export
│   └── utils/
│       ├── crypto.ts            # Encryption/decryption for tokens
│       └── thread-splitter.ts  # Thread splitting logic for X
│
├── platforms/
│   ├── x/
│   │   ├── client.ts           # XClient (raw fetch API wrapper)
│   │   ├── oauth.ts            # OAuth flow (arctic integration)
│   │   ├── media.ts            # Media upload (chunked upload)
│   │   ├── types.ts            # X-specific types (RateLimitError, etc.)
│   │   ├── publisher.ts        # XPublisher implements PlatformPublisher ← NEW
│   │   └── index.ts           # Barrel export: XPublisher, types
│   │
│   ├── linkedin/
│   │   ├── client.ts           # LinkedInClient (raw fetch API wrapper)
│   │   ├── oauth.ts            # OAuth flow (arctic integration)
│   │   ├── media.ts            # Media upload (register → upload → attach)
│   │   ├── types.ts            # LinkedIn-specific types
│   │   ├── publisher.ts        # LinkedInPublisher implements PlatformPublisher ← NEW
│   │   └── index.ts           # Barrel export
│   │
│   ├── instagram/
│   │   ├── client.ts           # InstagramClient (raw fetch API wrapper)
│   │   ├── oauth.ts            # OAuth flow (manual Instagram-specific)
│   │   ├── media.ts            # Media upload (container creation + polling)
│   │   ├── types.ts            # Instagram-specific types
│   │   ├── publisher.ts        # InstagramPublisher implements PlatformPublisher ← NEW
│   │   └── index.ts           # Barrel export
│   │
│   └── tiktok/
│       ├── client.ts           # TikTokClient (raw fetch API wrapper)
│       ├── oauth.ts            # OAuth flow (arctic integration)
│       ├── media.ts            # Media upload (chunked upload)
│       ├── types.ts            # TikTok-specific types
│       ├── publisher.ts        # TikTokPublisher implements PlatformPublisher ← NEW
│       └── index.ts           # Barrel export
│
├── trigger/
│   ├── publish-post.ts         # Trigger.dev task (orchestration only) ← REFACTOR
│   ├── token-refresher.ts      # Background token refresh task
│   ├── notification-dispatcher.ts # Notification dispatching
│   └── [other tasks]          # Existing tasks unchanged
│
└── shared/
    ├── token-manager.ts        # Token refresh, validation, encryption ← NEW
    ├── error-handlers.ts       # Rate limit handling, retry logic ← NEW
    └── rate-limiter.ts        # Unified rate limit handling ← NEW
```

### Structure Rationale

**`src/core/db/`**: Database access layer. `connection.ts` provides factory functions for HTTP (serverless) and WebSocket (local/dev) connections. Schema definitions in `schema.ts` match database structure.

**`src/core/types/`**: Shared type definitions. `PlatformPublisher` interface defines contract for all publishers. Separating platform, post, and hub types enables focused imports.

**`src/platforms/<platform>/`**: Platform-specific implementations. Each platform has its own directory with client, OAuth, media, types, and publisher. `publisher.ts` is NEW — implements `PlatformPublisher` interface. `index.ts` barrel exports public API only.

**`src/trigger/`**: Trigger.dev tasks. `publish-post.ts` refactored to orchestration only (<200 lines). Other tasks unchanged.

**`src/shared/`**: Cross-cutting concerns. NEW — `token-manager.ts` consolidates token refresh logic (currently duplicated across platforms). `error-handlers.ts` unifies rate limit and error handling. `rate-limiter.ts` provides unified rate limit tracking.

## Architectural Patterns

### Pattern 1: Strategy Pattern for Platform Publishing

**What:** Define `PlatformPublisher` interface with `publish()` method. Each platform implements the interface. Orchestrator delegates to appropriate publisher based on platform.

**When to use:** When you have multiple algorithms (platform-specific publishing) that can be swapped at runtime. Use when you want to add new platforms without changing orchestration logic.

**Trade-offs:**
- **Pros:** Open/closed principle (open for extension, closed for modification), easy to test (mock interfaces), clear contracts
- **Cons:** Slightly more code (interface + implementations), indirection (one extra layer)

**Example:**

```typescript
// src/core/types/platform.ts (NEW)
export interface PlatformPublisher {
  /**
   * Publish content to the platform.
   *
   * @param context - Publishing context (post, credentials, metadata)
   * @returns Promise resolving to published post data with ID and URL
   * @throws {RateLimitError} When platform rate limit is exceeded (429)
   * @throws {AuthenticationError} When token is invalid or expired
   */
  publish(context: PublishContext): Promise<PublishResult>;
}

export interface PublishContext {
  db: HubDb;
  post: PostRow;
  platform: Platform;
  encryptionKey: Buffer;
  token: OAuthTokenRow;
  env: Record<string, string | undefined>;
}

export interface PublishResult {
  status: "published" | "failed";
  externalPostId?: string;
  error?: string;
}

// src/platforms/x/publisher.ts (NEW)
export class XPublisher implements PlatformPublisher {
  async publish(context: PublishContext): Promise<PublishResult> {
    // X-specific logic
    const client = new XClient(context.token.accessToken);
    const mediaIds = await this.uploadMediaIfNeeded(context, client);
    const result = await client.createTweet({
      text: context.post.content,
      mediaIds,
    });
    return { status: "published", externalPostId: result.id };
  }

  private async uploadMediaIfNeeded(
    context: PublishContext,
    client: XClient,
  ): Promise<string[] | undefined> {
    if (!context.post.mediaUrls || context.post.mediaUrls.length === 0) {
      return undefined;
    }
    // Media upload logic
  }
}
```

### Pattern 2: Factory Pattern for Publisher Selection

**What:** Create factory function that returns appropriate `PlatformPublisher` based on platform string. Orchestrator uses factory without knowing concrete implementations.

**When to use:** When you need to create objects (publishers) based on runtime configuration (platform enum). Use when you want to decouple creation from usage.

**Trade-offs:**
- **Pros:** Centralized creation logic, easy to add new platforms, single source of truth
- **Cons:** Factory grows with each platform (linear complexity)

**Example:**

```typescript
// src/trigger/publish-post.ts (refactored)
import { XPublisher } from "@psn/platforms/x/index.js";
import { LinkedInPublisher } from "@psn/platforms/linkedin/index.js";
import { InstagramPublisher } from "@psn/platforms/instagram/index.js";
import { TikTokPublisher } from "@psn/platforms/tiktok/index.js";

function getPublisher(platform: Platform): PlatformPublisher {
  switch (platform) {
    case "x":
      return new XPublisher();
    case "linkedin":
      return new LinkedInPublisher();
    case "instagram":
      return new InstagramPublisher();
    case "tiktok":
      return new TikTokPublisher();
  }
}

// Usage in orchestration
const publisher = getPublisher(platform);
const result = await publisher.publish(context);
```

### Pattern 3: Dependency Injection via Constructor

**What:** Pass dependencies (database, token manager, encryption key) through constructor rather than global state or environment variables.

**When to use:** When you need to test components in isolation, want explicit dependencies, or need to swap implementations (e.g., mock DB for tests).

**Trade-offs:**
- **Pros:** Testable, explicit dependencies, no global state
- **Cons:** More verbose (pass deps through constructors), slight indirection

**Example:**

```typescript
// BAD: Implicit dependencies via globals
class XPublisher {
  async publish(post: PostRow) {
    const db = getGlobalDb(); // Where does this come from?
    const token = process.env.X_ACCESS_TOKEN; // Hidden dependency
  }
}

// GOOD: Explicit dependencies via constructor
class XPublisher implements PlatformPublisher {
  constructor(
    private readonly tokenManager: TokenManager,
    private readonly mediaUploader: MediaUploader,
    private readonly errorHandlers: ErrorHandlers,
  ) {}

  async publish(context: PublishContext): Promise<PublishResult> {
    const token = await this.tokenManager.getValidToken(context);
    const mediaIds = await this.mediaUploader.upload(context);
    // Publish with error handling
    return this.errorHandlers.withRetry(async () => {
      const client = new XClient(token);
      return client.createTweet({ text: context.post.content, mediaIds });
    });
  }
}
```

### Pattern 4: Barrel Exports for Module Boundaries

**What:** Each platform directory has `index.ts` that exports only public API. Internal files (`client.ts`, `oauth.ts`, `media.ts`) not exported.

**When to use:** When you want to hide implementation details, provide clear public API, and prevent accidental imports of internal modules.

**Trade-offs:**
- **Pros:** Clear API surface, prevents internal access, easy to change internals
- **Cons:** Extra file per directory, need to remember to add exports

**Example:**

```typescript
// src/platforms/x/index.ts (barrel export)
export { XPublisher } from "./publisher.js";           // Public API
export { createXOAuthClient } from "./oauth.js";        // Public API
export type { XClient } from "./client.js";             // Public type

// NOT exported: uploadMedia, RateLimitError (internal only)

// Import from barrel (AI sees clean API)
import { XPublisher, createXOAuthClient } from "@psn/platforms/x/index.js";

// CANNOT import internal (prevents confusion)
// import { uploadMedia } from "@psn/platforms/x/media.js"; // TypeScript error
```

### Pattern 5: Token Management with Decorator Pattern

**What:** `TokenManager` wraps raw tokens with refresh logic. Decorator validates expiry, refreshes if needed, returns decrypted tokens.

**When to use:** When you have cross-cutting concerns (token refresh) that should be transparent to publishers. Use when you want to separate token lifecycle from publishing logic.

**Trade-offs:**
- **Pros:** Centralized token logic, transparent refresh, easy to test
- **Cons:** Indirection, decorator complexity

**Example:**

```typescript
// src/shared/token-manager.ts (NEW)
export class TokenManager {
  constructor(
    private readonly db: HubDb,
    private readonly encryptionKey: Buffer,
    private readonly oauthClients: OAuthClientRegistry,
  ) {}

  /**
   * Get valid access token, refreshing if expired.
   * Updates database with new tokens if refresh occurs.
   */
  async getValidToken(userId: string, platform: Platform): Promise<string> {
    const [tokenRow] = await this.db
      .select()
      .from(oauthTokens)
      .where(
        sql`${oauthTokens.userId} = ${userId}
        AND ${oauthTokens.platform} = ${platform}`,
      )
      .limit(1);

    if (!tokenRow) {
      throw new AuthenticationError(`No OAuth token for ${platform}`);
    }

    // Check if expired
    if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
      return this.refreshToken(tokenRow);
    }

    // Decrypt and return
    return decrypt(tokenRow.accessToken, this.encryptionKey);
  }

  private async refreshToken(tokenRow: OAuthTokenRow): Promise<string> {
    // Platform-specific refresh logic
    switch (tokenRow.platform as Platform) {
      case "x":
        return this.refreshXToken(tokenRow);
      case "linkedin":
        return this.refreshLinkedInToken(tokenRow);
      case "tiktok":
        return this.refreshTikTokToken(tokenRow);
      case "instagram":
        return this.refreshInstagramToken(tokenRow);
    }
  }

  private async refreshXToken(tokenRow: OAuthTokenRow): Promise<string> {
    const { X_CLIENT_ID, X_CLIENT_SECRET } = process.env;
    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
      throw new Error("Missing X OAuth credentials");
    }

    const oauthClient = createXOAuthClient({
      clientId: X_CLIENT_ID,
      clientSecret: X_CLIENT_SECRET,
      callbackUrl: "https://example.com/callback",
    });

    const decryptedRefresh = decrypt(tokenRow.refreshToken!, this.encryptionKey);
    const newTokens = await refreshAccessToken(oauthClient, decryptedRefresh);

    // Update database with new tokens
    const encryptedAccess = encrypt(newTokens.accessToken, this.encryptionKey);
    const encryptedRefresh = encrypt(newTokens.refreshToken, this.encryptionKey);

    await this.db.execute(sql`
      UPDATE oauth_tokens
      SET access_token = ${encryptedAccess},
          refresh_token = ${encryptedRefresh},
          expires_at = ${newTokens.expiresAt},
          updated_at = NOW()
      WHERE id = ${tokenRow.id}
    `);

    return newTokens.accessToken;
  }

  // Similar methods for LinkedIn, TikTok, Instagram...
}
```

## Data Flow

### Request Flow (Single Platform)

```
[Trigger.dev schedules post]
    ↓
[publish-post.ts task starts]
    ↓
[Load post from DB] → [Validate status] → [Check approval for company posts]
    ↓
[Mark post as publishing]
    ↓
[Fetch OAuth token from DB] → [TokenManager validates/refreshes if needed]
    ↓
[Platform dispatcher] → [getPublisher(platform)] → [XPublisher/LinkedInPublisher/etc.]
    ↓
[Publisher.publish(context)] → [Upload media if needed] → [Create post on platform]
    ↓
[Return externalPostId] → [Update post status to published]
    ↓
[Advance series state if applicable] → [Update brand preference model]
    ↓
[Dispatch notification if success/failure]
    ↓
[Return results to Trigger.dev]
```

### Request Flow (Multi-Platform)

```
[Trigger.dev schedules post with targetPlatforms: ["x", "linkedin", "instagram"]]
    ↓
[publish-post.ts loops through platforms]
    ↓
[Platform X] → [XPublisher.publish()] → [Success/Fail] → [Result { status, externalPostId, error? }]
    ↓
[Platform LinkedIn] → [LinkedInPublisher.publish()] → [Success/Fail] → [Result]
    ↓
[Platform Instagram] → [InstagramPublisher.publish()] → [Success/Fail] → [Result]
    ↓
[Aggregate results]
    - All succeeded → status: published, subStatus: null
    - Partial success → status: published, subStatus: partial_failure
    - All failed → status: failed, notify user
    ↓
[Update post with platformStatus metadata]
    ↓
[Return results to Trigger.dev]
```

### State Management

```
[Post status transitions]
draft → scheduled → publishing → published/failed
                       ↓
                      retry (on failure, max 3 attempts)
                       ↓
                    failed (after max retries)

[OAuth token lifecycle]
OAuth flow → [Store encrypted access + refresh tokens in DB]
    ↓
[Publish task] → [Check expiry] → [Refresh if expired] → [Update DB]
    ↓
[Token refresh task] → [Background refresh before expiry] → [Update DB]
    ↓
[Token expired] → [Notify user] → [Re-auth required]
```

### Key Data Flows

1. **Token Refresh Flow:**
   - Publisher requests token from `TokenManager`
   - `TokenManager` fetches from DB, checks expiry
   - If expired: `TokenManager` calls platform-specific refresh, updates DB with new tokens
   - Returns decrypted access token to publisher
   - Publisher uses token to create API client

2. **Media Upload Flow:**
   - Publisher checks `post.mediaUrls`
   - If present: calls platform-specific media upload function
   - X: chunked upload via `uploadMedia()`
   - LinkedIn: register → upload binary → wait for ready
   - Instagram: create container → poll for ready
   - TikTok: init upload → upload chunks → poll for ready
   - Returns `mediaId` or `mediaUrn` to attach to post

3. **Error Handling Flow:**
   - Publisher catches platform-specific errors
   - RateLimitError → `wait.until(resetAt)` → retry
   - AuthenticationError → mark failed, notify user
   - Other errors → mark failed, include error message
   - Orchestrator aggregates platform results
   - Multi-platform: partial success = published with `partial_failure` sub-status

## Integration Points

### Database (Neon Postgres + Drizzle ORM)

| Component | Integration Pattern | Notes |
|-----------|---------------------|-------|
| **Hub connection** | Factory pattern | `createHubConnection(databaseUrl)` returns HTTP driver (serverless) or WebSocket driver (local/dev) |
| **Schema access** | Import from `@psn/core/db/schema.ts` | Direct imports, uses Drizzle ORM queries |
| **Token storage** | Encrypted at rest | `oauth_tokens` table stores `accessToken` and `refreshToken` as encrypted text |
| **Post updates** | Direct DB writes | `db.update(posts).set(...).where(eq(posts.id, postId))` |
| **Post metadata** | JSONB column | `metadata` column stores platform-specific data (LinkedIn personUrn, Instagram accountId, etc.) |

**Database connection patterns:**
- Trigger.dev tasks: Use `createHubConnection()` (HTTP driver, stateless, no pooling)
- Local development: Use `createHubConnectionWs()` (WebSocket driver, pooling)
- Always pass connection as parameter (dependency injection)

### OAuth Token Management

| Component | Integration Pattern | Notes |
|-----------|---------------------|-------|
| **Token storage** | Encrypted in DB | `encrypt(token, key)` before insert, `decrypt(token, key)` on read |
| **Token expiry** | `expiresAt` timestamp | Check before each publish, refresh if `expiresAt < new Date()` |
| **Token refresh** | Platform-specific | X, LinkedIn, TikTok use refresh tokens; Instagram refreshes access token itself |
| **Token metadata** | JSONB column | `metadata` column stores platform-specific data (personUrn, accountId, auditStatus) |
| **Token refresh task** | Background job | `token-refresher.ts` task runs periodically to refresh expiring tokens |

**Current duplication:** Token refresh logic is duplicated across all 4 platforms in `publish-post.ts` (lines 326-361 for X, 504-539 for LinkedIn, 738-770 for Instagram, 937-973 for TikTok).

**Refactored pattern:** `TokenManager` consolidates all refresh logic. Publishers call `tokenManager.getValidToken(userId, platform)` without knowing refresh implementation.

### Media Upload Flows

| Platform | Upload Pattern | Notes |
|----------|---------------|-------|
| **X** | Chunked upload | `uploadMedia(buffer, mimeType, token)` returns `mediaId`. Upload before tweet creation, attach via `mediaIds` parameter |
| **LinkedIn** | Register → Upload → Wait | `initializeImageUpload()` returns upload URL → `uploadImageBinary()` uploads binary → `waitForMediaReady()` polls for ready. Returns `imageUrn` |
| **Instagram** | Container → Poll → Publish | `createImageContainer()` returns container ID → `waitForContainerReady()` polls → `publishContainer()` publishes. Returns `mediaId` |
| **TikTok** | Init → Chunks → Poll | `initVideoUpload()` returns upload URL and chunk size → `uploadVideoChunks()` uploads in chunks → `checkPublishStatus()` polls. Returns `publishId` |

**Shared concern:** All media uploads require:
1. Sub-status update: `media_uploading` before upload starts
2. Sub-status update: `media_uploaded` after upload succeeds
3. Error handling: Failures mark post as failed with error reason

**Refactored pattern:** `MediaUploader` abstract handles sub-status updates and error handling. Publishers call `mediaUploader.upload(platform, context)` without managing status updates.

### Trigger.dev Job Integration

| Component | Integration Pattern | Notes |
|-----------|---------------------|-------|
| **Task definition** | `task({ id, retry, maxDuration, run })` | `publish-post.ts` is a Trigger.dev task |
| **Payload schema** | Zod validation (optional) | `PublishPostPayload` interface defines expected input |
| **Retry logic** | Built-in retry config | `retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 2000, maxTimeoutInMs: 30000 }` |
| **Error handling** | Try/catch per platform | Individual platform failures don't abort others |
| **Notification dispatch** | Fire-and-forget task trigger | `notificationDispatcherTask.trigger()` for success/failure notifications |

**Current pattern:** `publish-post.ts` defines task, includes all platform logic, handles multi-platform dispatch with partial failure isolation.

**Refactored pattern:** `publish-post.ts` becomes orchestration-only. Platform-specific logic moved to publishers. Retry logic remains in task definition. Multi-platform dispatch unchanged (still iterates through platforms).

### Error Handling & Rate Limiting

| Component | Integration Pattern | Notes |
|-----------|---------------------|-------|
| **RateLimitError** | Platform-specific | X: `RateLimitError`, LinkedIn: `LinkedInRateLimitError`, Instagram: `InstagramRateLimitError`, TikTok: `TikTokRateLimitError` |
| **Rate limit headers** | Extracted by clients | Each client's `request()` method extracts rate limit info from response headers |
| **Retry logic** | `wait.until(resetAt)` | Trigger.dev's `wait.until()` delays until rate limit resets |
| **Error mapping** | Platform API errors → typed errors | `XApiError`, `LinkedInApiError`, `InstagramApiError` throw with status code and body |

**Current duplication:** Rate limit handling is duplicated across all 4 platforms (similar try/catch blocks with `wait.until(resetAt)`).

**Refactored pattern:** `ErrorHandlers` class provides `withRateLimitRetry()` wrapper that catches `RateLimitError`, calls `wait.until()`, and retries. Publishers call `errorHandlers.withRateLimitRetry(async () => { ... })`.

### State Updates

| Component | Integration Pattern | Notes |
|-----------|---------------------|-------|
| **Post status** | Direct DB update | `db.update(posts).set({ status, subStatus, updatedAt }).where(eq(posts.id, postId))` |
| **Series state** | `advanceSeriesState()` | Calls `recordEpisodePublished(db, seriesId)` after successful publish |
| **Brand preference** | `updateBrandPreferenceIfCompany()` | Upserts `preferenceModel` for company posts (userId = hubId) |
| **Notifications** | Fire-and-forget | `notificationDispatcherTask.trigger({ eventType, userId, hubId, payload })` |

**Current pattern:** All state updates in `publish-post.ts`. Direct DB writes after platform publish succeeds.

**Refactored pattern:** State updates remain in orchestration layer (`publish-post.ts`). Publishers don't update DB directly. Orchestrator calls `advanceSeriesState()` and `updateBrandPreferenceIfCompany()` after all platforms complete.

## Build Order and Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: Foundations                       │
├─────────────────────────────────────────────────────────────────┤
│  src/core/types/platform.ts (PlatformPublisher interface)        │
│  src/core/db/connection.ts (DB connection factory)              │
│  src/core/utils/crypto.ts (Encryption/decryption)              │
│  src/shared/token-manager.ts (Token management)                 │
│  src/shared/error-handlers.ts (Error handling wrappers)         │
│  src/shared/rate-limiter.ts (Rate limit handling)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: Publishers                         │
├─────────────────────────────────────────────────────────────────┤
│  src/platforms/x/publisher.ts (XPublisher)                   │
│  src/platforms/linkedin/publisher.ts (LinkedInPublisher)       │
│  src/platforms/instagram/publisher.ts (InstagramPublisher)     │
│  src/platforms/tiktok/publisher.ts (TikTokPublisher)         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│                Layer 3: Barrel Exports                         │
├─────────────────────────────────────────────────────────────────┤
│  src/platforms/x/index.ts                                    │
│  src/platforms/linkedin/index.ts                             │
│  src/platforms/instagram/index.ts                             │
│  src/platforms/tiktok/index.ts                               │
│  src/core/types/index.ts                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────────┐
│              Layer 4: Orchestration (publish-post.ts)         │
├─────────────────────────────────────────────────────────────────┤
│  Refactored to <200 lines                                   │
│  - Load post, validate                                       │
│  - Dispatch to platform publishers                             │
│  - Aggregate results                                          │
│  - Update state, advance series, notify                       │
└─────────────────────────────────────────────────────────────────┘
```

### Build Order (Sequential Phases)

**Phase 1: Define Interface Contracts (Foundation)**
1. Create `src/core/types/platform.ts` with `PlatformPublisher` interface
2. Define `PublishContext` and `PublishResult` types
3. Update `src/core/types/index.ts` to export new types
4. **Why:** Interface must exist before implementations. This provides the contract for all publishers.

**Phase 2: Implement Shared Utilities (Cross-Cutting Concerns)**
1. Create `src/shared/token-manager.ts` with `TokenManager` class
2. Create `src/shared/error-handlers.ts` with `ErrorHandlers` class
3. Create `src/shared/rate-limiter.ts` with `RateLimiter` class
4. **Why:** Shared utilities must exist before publishers can use them. Consolidates duplicate logic.

**Phase 3: Extract Platform Publishers (Implementation)**
1. Create `src/platforms/x/publisher.ts` (XPublisher implements PlatformPublisher)
2. Create `src/platforms/linkedin/publisher.ts` (LinkedInPublisher)
3. Create `src/platforms/instagram/publisher.ts` (InstagramPublisher)
4. Create `src/platforms/tiktok/publisher.ts` (TikTokPublisher)
5. **Why:** Publishers implement interface. Can be built in parallel after Phase 1-2 complete.

**Phase 4: Create Barrel Exports (Module Boundaries)**
1. Create/update `src/platforms/x/index.ts` (export XPublisher, public types)
2. Create/update `src/platforms/linkedin/index.ts`
3. Create/update `src/platforms/instagram/index.ts`
4. Create/update `src/platforms/tiktok/index.ts`
5. **Why:** Barrel exports provide clean public API. Required for orchestration layer.

**Phase 5: Refactor Orchestration (publish-post.ts)**
1. Create `getPublisher(platform)` factory function
2. Replace inline platform logic with `getPublisher(platform).publish(context)`
3. Remove duplicate token refresh code (now in TokenManager)
4. Reduce file to <200 lines (orchestration only)
5. **Why:** Orchestration depends on publishers. Refactor after publishers exist.

**Phase 6: Add Tests (Validation)**
1. Create `src/platforms/x/publisher.test.ts` (interface compliance, error handling)
2. Create `src/platforms/linkedin/publisher.test.ts`
3. Create `src/platforms/instagram/publisher.test.ts`
4. Create `src/platforms/tiktok/publisher.test.ts`
5. Create `src/shared/token-manager.test.ts`
6. **Why:** Tests validate refactoring didn't break behavior. Run after all code changes.

### Dependencies (What Must Be Defined Before What)

| Component | Depends On | Rationale |
|-----------|------------|-----------|
| **PlatformPublisher interface** | None | Foundation, no dependencies |
| **TokenManager** | `core/db/connection.ts`, `core/utils/crypto.ts` | Needs DB access and encryption |
| **ErrorHandlers** | `@trigger.dev/sdk` (wait.until) | Needs Trigger.dev SDK |
| **XPublisher** | `PlatformPublisher`, `TokenManager`, `XClient`, `uploadMedia` | Needs interface, token manager, existing client |
| **LinkedInPublisher** | `PlatformPublisher`, `TokenManager`, `LinkedInClient`, media functions | Same pattern |
| **InstagramPublisher** | `PlatformPublisher`, `TokenManager`, `InstagramClient`, media functions | Same pattern |
| **TikTokPublisher** | `PlatformPublisher`, `TokenManager`, `TikTokClient`, media functions | Same pattern |
| **publish-post.ts (refactored)** | All publishers, barrel exports | Must import from all platforms |
| **Tests** | All components | Validate after implementation |

### Parallel Execution Opportunities

After Phase 1-2 complete (interface + utilities), Phase 3 (publishers) can be executed in parallel:

```
Phase 3 (Parallel):
├── XPublisher (platforms/x/publisher.ts)
├── LinkedInPublisher (platforms/linkedin/publisher.ts)
├── InstagramPublisher (platforms/instagram/publisher.ts)
└── TikTokPublisher (platforms/tiktok/publisher.ts)

Each platform team (or AI assistant) can work independently
without blocking others.
```

This enables efficient agentic development — AI can focus on one platform at a time.

## Backward Compatibility Considerations

### Database Schema (No Changes)

- **Schema unchanged:** `posts`, `oauth_tokens`, `preferenceModel` tables remain identical
- **Migration not required:** Refactoring is code-only, no schema changes
- **Metadata column unchanged:** Still stores platform-specific data (personUrn, accountId, etc.)

### Trigger.dev Task Interface (No Changes)

- **Task ID unchanged:** `publish-post` task retains same ID
- **Payload schema unchanged:** `PublishPostPayload` interface unchanged
- **Retry configuration unchanged:** Same maxAttempts, factor, timeouts
- **Return value unchanged:** Same structure `{ status, results, partialFailure? }`

**Existing scheduled posts continue working.** Trigger.dev runs same task with same payload.

### External APIs (No Changes)

- **OAuth flows unchanged:** `oauth.ts` files not modified
- **Client libraries unchanged:** `client.ts` files not modified
- **Media upload functions unchanged:** `media.ts` files not modified

**Users continue authenticating with same OAuth flow.**

### Breaking Changes (None)

- **Internal refactoring only:** No public API changes
- **CLI commands unchanged:** All `/post:*` commands work identically
- **Notification system unchanged:** `notificationDispatcherTask` same interface

**Migration path:** Deploy refactored code to production, Trigger.dev picks up new `publish-post.ts` implementation. No manual migration required.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Current architecture fine. HTTP DB driver sufficient. No pooling needed. |
| 1k-100k users | Monitor rate limits. Consider rate limit throttling at orchestration level. WebSocket driver for local dev. |
| 100k+ users | Consider caching tokens in memory (reduce DB queries). Connection pooling for WebSocket driver. Rate limit coordination across users (queue throttled requests). |

### Scaling Priorities

1. **First bottleneck:** Rate limits (platform-specific)
   - **Problem:** Instagram 200 req/hr, X pay-per-use ($0.01/post), LinkedIn partner approval
   - **Fix:** Implement rate limit queue, delay requests approaching limits, notify users before limits hit
   - **Architecture:** `RateLimiter` class tracks rate limits per user/platform, enforces backpressure

2. **Second bottleneck:** Token refresh latency
   - **Problem:** Inline token refresh adds ~500ms per publish (check expiry + refresh)
   - **Fix:** Background refresh task (`token-refresher.ts`) refreshes tokens before expiry
   - **Architecture:** `TokenManager` checks cache (in-memory) before DB query

3. **Third bottleneck:** Media upload size
   - **Problem:** Large media uploads (videos) timeout in Trigger.dev (max 300s)
   - **Fix:** Pre-upload media to external storage (S3, Cloudflare R2), pass URL to platform
   - **Architecture:** `MediaUploader` uploads to external storage, returns URL, platform client attaches URL

## Anti-Patterns

### Anti-Pattern 1: God Object (All Platform Logic in One File)

**What people do:** Put all platform publishing logic in `publish-post.ts` (1,239 lines). Import all clients, handle token refresh inline, mix orchestration with implementation.

**Why it's wrong:**
- AI can't understand individual platforms (too much context)
- Modifying one platform risks breaking others (coupling)
- Duplicate code (token refresh repeated 4 times)
- File exceeds AI deep understanding threshold

**Do this instead:**
- Extract platform-specific logic into `src/platforms/<platform>/publisher.ts`
- Define `PlatformPublisher` interface (contract)
- Use strategy pattern: orchestration delegates to publishers
- Keep files <200 lines

### Anti-Pattern 2: Implicit Dependencies (Global State)

**What people do:** Access globals (`process.env.X_CLIENT_ID`) inside publishers. Assume database connection exists globally.

**Why it's wrong:**
- Difficult to test (can't mock globals)
- Unclear dependencies (what does this class need?)
- Violates dependency injection principle

**Do this instead:**
- Pass dependencies via constructor: `constructor(db: HubDb, env: Record<string, string | undefined>)`
- Explicit parameters: `publish(context: PublishContext)` where `context` contains all dependencies
- Test with mocks: `const mockDb = { select: vi.fn(), update: vi.fn() }`

### Anti-Pattern 3: Duplicate Token Refresh Logic

**What people do:** Copy-paste token refresh code for each platform in `publish-post.ts`. Same pattern repeated 4 times (X lines 326-361, LinkedIn 504-539, Instagram 738-770, TikTok 937-973).

**Why it's wrong:**
- Maintenance burden: bug fix must be applied 4 times
- Inconsistency: refresh logic drifts between platforms
- Code bloat: 500+ lines of duplicate token refresh

**Do this instead:**
- Create `TokenManager` class with `getValidToken(userId, platform)`
- Platform-specific refresh methods (`refreshXToken`, `refreshLinkedInToken`, etc.)
- Publishers call `tokenManager.getValidToken()`, don't know refresh implementation

### Anti-Pattern 4: Direct Platform Client Imports in Orchestration

**What people do:** Import `XClient`, `LinkedInClient`, `InstagramClient`, `TikTokClient` directly in `publish-post.ts`. Instantiate clients inside orchestration logic.

**Why it's wrong:**
- Coupling: Orchestration knows about platform client implementations
- Hard to test: Can't mock individual platforms without mocking all
- Violates interface principle: Should depend on abstraction, not implementation

**Do this instead:**
- Import publishers from barrel exports: `import { XPublisher } from "@psn/platforms/x/index.js"`
- Use factory function: `getPublisher(platform)` returns `PlatformPublisher` (interface)
- Orchestration only knows about `PlatformPublisher` interface

### Anti-Pattern 5: Missing Barrel Exports

**What people do:** Import internal files directly: `import { uploadMedia } from "@psn/platforms/x/media.js"`.

**Why it's wrong:**
- Internal implementation leaked: Users can depend on internal details
- Breaking changes risk: Refactoring internals breaks imports
- Confusing API surface: Unclear what's public vs. internal

**Do this instead:**
- Create `index.ts` in each platform directory
- Export only public API: `XPublisher`, `createXOAuthClient`, public types
- Internal files (`media.ts`, `client.ts`) not exported
- Import from barrel: `import { XPublisher } from "@psn/platforms/x/index.js"`

## Testing Strategy

### Unit Tests (Per Platform)

```typescript
// src/platforms/x/publisher.test.ts (NEW)
import { describe, it, expect, vi } from "vitest";
import { XPublisher } from "./publisher.js";
import { XClient } from "./client.js";
import type { PlatformPublisher } from "@psn/core/types/platform.js";

// Mock external dependencies
vi.mock("./client.js");
vi.mock("@psn/shared/token-manager.js");

describe("XPublisher", () => {
  it("implements PlatformPublisher interface", () => {
    const publisher = new XPublisher(/* deps */);
    expect(publisher).toMatchObject<PlatformPublisher>({
      publish: expect.any(Function),
    });
  });

  it("publishes tweet with content", async () => {
    const mockClient = {
      createTweet: vi.fn().mockResolvedValue({ id: "123" }),
    };
    vi.mocked(XClient).mockReturnValue(mockClient);

    const publisher = new XPublisher(/* deps */);
    const context = {
      db: mockDb,
      post: mockPost,
      platform: "x",
      encryptionKey: mockKey,
      token: mockToken,
      env: {},
    };

    const result = await publisher.publish(context);

    expect(result.status).toBe("published");
    expect(result.externalPostId).toBe("123");
    expect(mockClient.createTweet).toHaveBeenCalledWith({
      text: mockPost.content,
    });
  });

  it("throws RateLimitError on 429 response", async () => {
    const mockClient = {
      createTweet: vi.fn().mockRejectedValue(new RateLimitError(/* ... */)),
    };
    vi.mocked(XClient).mockReturnValue(mockClient);

    const publisher = new XPublisher(/* deps */);
    await expect(publisher.publish(mockContext)).rejects.toThrow("RateLimitError");
  });
});
```

### Integration Tests (End-to-End Publishing)

```typescript
// src/trigger/publish-post.integration.test.ts (NEW)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHubConnection } from "@psn/core/db/connection.js";

describe("publish-post integration", () => {
  let db: HubDb;
  let testPostId: string;

  beforeAll(async () => {
    db = createHubConnection(process.env.TEST_DATABASE_URL!);
    // Create test post, test OAuth token
    const [post] = await db.insert(posts).values(/* ... */).returning();
    testPostId = post.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(posts).where(eq(posts.id, testPostId));
  });

  it("publishes post to X successfully", async () => {
    const result = await publishPost({ postId: testPostId });
    expect(result.status).toBe("published");
    expect(result.results[0].status).toBe("published");
  });

  it("handles multi-platform partial failure", async () => {
    // Create post with multiple platforms, one with invalid token
    const result = await publishPost({ postId: testPostId, targetPlatforms: ["x", "linkedin"] });
    expect(result.status).toBe("published");
    expect(result.partialFailure).toBe(true);
  });
});
```

### Mock Infrastructure

```typescript
// tests/mocks/token-manager.mock.ts (NEW)
import { vi } from "vitest";

export const mockTokenManager = {
  getValidToken: vi.fn().mockResolvedValue("mock-access-token"),
  refreshToken: vi.fn().mockResolvedValue("refreshed-access-token"),
};

// tests/mocks/error-handlers.mock.ts (NEW)
export const mockErrorHandlers = {
  withRateLimitRetry: vi.fn(async (fn) => fn()),
  withRetry: vi.fn(async (fn) => fn()),
};
```

## Sources

- [Context Engineering for AI Assistants](https://github.com/coleam00/context-engineering-intro) — Code structure for agentic development
- [TypeScript dependency injection patterns](https://dev.to/vad3x/typesafe-almost-zero-cost-dependency-injection-in-typescript-112) — Interface-based DI patterns
- [Vibe Coding - 深度学习驱动的智能体编程最佳实践](https://m.blog.csdn.net/yangshangwei/article/details/158319117) — AI-native coding patterns
- [2026 AI开发变局：TypeScript碾压Python？4大核心优势](https://m.toutiao.com/a7605583772906324520/) — TypeScript dominance in AI era
- [Claude Code最佳实践：官方心法](https://m.toutiao.com/w/1857885021073411/) — CLAUDE.md patterns, project-specific context
- [AI API Middleware for Faster, More Accurate Responses](https://www.linkedin.com/posts/shekhar-dube-457b2713_ai-intelligent-api-key-technical-points-activity-7414581115270647809-Q7LW) — MCP protocol, interface boundaries
- [Agentic coding architecture patterns](https://openai.com/zh-Hans-CN/index/harness-engineering/) — Codex architecture, layered domain design
- [Claude Code Plugin Architecture](https://www.jdon.com/82382-wshobson-agents-CC-plugin.html) — Multi-agent orchestration, plugin boundaries
- [TypeScript monorepo configuration](https://juejin.cn/entry/7578811288819908651) — Path aliases, barrel exports
- [Trigger.dev SDK documentation](https://trigger.dev/docs/sdk) — Task definition, retry logic, wait.until()
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview) — Schema, connection patterns
- [Arctic OAuth documentation](https://arctic.js.org/) — OAuth 2.0 PKCE flow
- Existing codebase analysis — `publish-post.ts` (1,239 lines), platform clients, database schema

---
*Architecture research for: Platform Handler Refactoring - Post Shit Now v1.2*
*Researched: 2026-02-25*
