## Ownership

This module owns the shared foundation used by all other modules. It is responsible for: the PlatformPublisher interface definition and behavioral contracts; DB connection management and schema; shared types (Platform, PlatformPublishResult, PostMetadata, PostStatus, etc.); the publisher-factory (handler registration and creation); and utility functions (crypto, thread-splitting, timezone, nanoid). It is NOT responsible for: platform-specific publish logic (that is `src/platforms/`); slash command orchestration (that is `.claude/commands/`); or Trigger.dev task definitions (that is `src/trigger/`).

## Key Files

**Types**

- `types/publisher.ts` — PlatformPublisher interface with full behavioral contracts (preconditions, postconditions, error conventions); also defines DbConnection, PostRow, and RateLimitInfo type aliases
- `types/index.ts` — Platform union type, PlatformPublishResult, PostMetadata, PostStatus, PostSubStatus, HubConfig, and other shared type definitions used across the project

**Database**

- `db/connection.ts` — createHubConnection using the Neon HTTP driver; safe for serverless and edge environments
- `db/schema.ts` — Drizzle schema for all 14 database tables (hubs, posts, analytics, series, teams, etc.)
- `db/schema-zod.ts` — Zod validation schemas generated from the Drizzle schema for runtime input validation
- `db/api-keys.ts` — encrypted API key storage and retrieval helpers (BYOK pattern)
- `db/migrate.ts` — migration runner for applying schema changes to a hub database

**Utilities**

- `utils/publisher-factory.ts` — handler registration registry; createHandler, registerHandler, hasHandler, registeredPlatforms, and unregisterHandler functions
- `utils/crypto.ts` — encrypt, decrypt, and keyFromHex for AES-256 token storage (BYOK credential protection)
- `utils/thread-splitter.ts` — splits long-form content into tweet-sized thread segments respecting word and URL boundaries
- `utils/timezone.ts` — timezone-aware date parsing and scheduling helpers
- `utils/env.ts` — typed environment variable accessors with validation
- `utils/nanoid.ts` — nanoid wrapper for generating short, unique IDs used in DB records
