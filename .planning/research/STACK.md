# Stack Research: Agentic Architecture Improvements

**Domain:** TypeScript/Node.js codebase enhancements for AI-assisted development
**Researched:** 2026-02-25
**Confidence:** HIGH (core stack verified via official docs; agentic patterns verified from 2026 best practices)

## Recommended Stack

### Core Runtime & Build

| Technology | Version | Purpose | Why Recommended for Agentic Development |
|------------|---------|---------|--------------------------------------|
| TypeScript | 5.9.3 | Language | Strict typing with `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals: false` for AI agents. Enables interface-based contracts that AI assistants can reason about. |
| Bun | latest | Runtime | Faster than Node.js for local development. Type checking via `bun run typecheck`. Already in use. |
| tsx | latest | Script runner | Run TypeScript directly without build step. Used for CLI scripts that Claude commands invoke. |
| Biome | 2.4.2 | Lint + Format | Single tool replacing ESLint + Prettier. Runs 10-100x faster. Auto-fixable rules help AI assistants conform to standards. |

### Testing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vitest | 4.0.18 | Unit testing | Native TypeScript support, Jest API compatible. Smart re-runs only affected tests. AI-friendly: can generate tests that pass reliably. |
| @vitest/coverage-v8 | latest | Code coverage | Integrated coverage reporting. Helps AI agents identify untested surface area. |

### TypeScript Configuration

| Setting | Value | Why for AI Assistants |
|---------|--------|----------------------|
| `strict: true` | - | Catches errors before runtime. AI agents produce more reliable code with strict mode. |
| `noUncheckedIndexedAccess: true` | - | Forces explicit undefined checks. Prevents AI from making unsafe assumptions about array/object access. |
| `noImplicitOverride: true` | - | Requires `override` keyword when extending methods. Helps AI understand inheritance hierarchies. |
| `noUnusedLocals: false` | - | **Critical for AI**: AI often declares temporary variables during exploration. Auto-cleanup can block exploration. |
| `noUnusedParameters: false` | - | **Critical for AI**: Similar to locals, AI may reference parameters incrementally. |
| `moduleResolution: "bundler"` | - | Modern resolution compatible with Bun/Trigger.dev bundling. |
| `paths: { "@psn/*": ["./src/*"] }` | - | Path aliases enable clear module boundaries. AI can reason about imports more easily. |

### Interface-Based Architecture

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript interfaces | native | Contracts | Define clear boundaries between modules. AI assistants can read interfaces to understand component contracts without implementation details. |
| Export patterns | - | Module organization | Barrel exports (`index.ts`) at module boundaries. AI discovers public API surface through single entry point. |

### Code Organization Patterns

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| **Interface segregation** | One interface per responsibility | Separate files: `types/platform.ts`, `types/post.ts`, `types/hub.ts` |
| **Module boundaries** | Clear import restrictions | Path aliases (`@psn/platforms/*`, `@psn/core/db/*`) enforce boundaries conceptually |
| **Barrel exports** | Single public API per module | `src/platforms/x/index.ts` exports only public interface, not internals |
| **Domain-based splitting** | Logical code grouping | `src/platforms/x/`, `src/platforms/linkedin/`, `src/core/db/`, `src/core/types/` |

### Documentation for AI Assistants

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CLAUDE.md | - | Project instructions | Automatically included in Claude's context. Keep concise (100-200 lines root, 50-100 subdirs). |
| Directory-level docs | - | Module-specific context | `src/platforms/x/CLAUDE.md` for platform-specific patterns. Progressive disclosure. |
| JSDoc comments | - | Inline documentation | AI reads JSDoc to understand function purpose, parameters, return types. Focus on "why" not "what". |
| README.md per module | - | Overview and usage | High-level module description, key patterns, examples. AI reads this before diving into code. |

---

## Installation

```bash
# Already installed in project
bun install @biomejs/biome vitest @vitest/coverage-v8

# Dev dependencies (already in package.json)
bun install -D @types/bun @types/diff @types/readline-sync @types/ws
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest | Jest | Never for new TypeScript projects. Vitest is faster, native TS support, Jest-compatible API. |
| Biome | ESLint + Prettier | Only if you need ESLint plugins for specific rules not in Biome. Biome covers 95% of cases. |
| Path aliases | Relative imports | Only for small scripts. Path aliases provide clearer boundaries and easier refactoring for AI assistants. |
| `noUnusedLocals: false` | `noUnusedLocals: true` | Only for human-only codebases where unused variables indicate bugs. For AI-assisted code, false enables exploration without blocking. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `drizzle-kit push` | Silently deletes RLS policies. | `drizzle-kit generate` + `drizzle-kit migrate` |
| CommonJS (`require`) | Mixed module systems confuse AI assistants. | ES modules (`import/export`) exclusively |
| Any exports | Explicit imports easier for AI to reason about. | Named exports with explicit imports |
| Inline types in complex functions | Scatters type information. | Extract to `types/` directory |
| God files (500+ lines) | Exceeds AI context window for deep understanding. | Split into focused modules (<200 lines) |
| Deeply nested directories (>5 levels) | AI navigation becomes difficult. | Flat structures or shallow nesting (max 3-4 levels) |
| Generated file patterns | AI may try to modify generated code. | Clearly mark with `// DO NOT EDIT` headers or use separate output directory |

---

## Stack Patterns by Variant

**If modifying `publish-post.ts` (1,239 lines):**
- Extract platform-specific logic into `src/platforms/*/publisher.ts` modules
- Define `PlatformPublisher` interface with `publish()` method
- Implement per-platform publishers: `XPublisher`, `LinkedInPublisher`, `InstagramPublisher`, `TikTokPublisher`
- Use strategy pattern: `publish-post.ts` delegates to appropriate publisher based on platform
- Benefits: AI can understand one platform at a time, modify without affecting others

**If creating new platform integrations:**
- Create `src/platforms/<platform>/` directory with: `client.ts`, `oauth.ts`, `media.ts`, `types.ts`, `publisher.ts`
- Define platform-specific types in `types.ts`
- Implement OAuth flow in `oauth.ts`
- Implement API client in `client.ts`
- Implement media upload in `media.ts`
- Implement publishing logic in `publisher.ts` (implements `PlatformPublisher` interface)
- Add barrel export `index.ts` for public API
- Create `CLAUDE.md` with platform-specific patterns
- Benefits: Consistent structure, AI can copy-paste pattern across platforms

**If refactoring core types:**
- Keep all shared types in `src/core/types/`
- Split by domain: `types/platform.ts`, `types/post.ts`, `types/hub.ts`, `types/analytics.ts`
- Use barrel exports in each domain file
- Benefits: Single source of truth, AI finds types via clear import paths

**If adding CLAUDE.md documentation:**
- Root `CLAUDE.md`: 100-200 lines, project-level rules, common commands
- Directory `CLAUDE.md`: 50-100 lines, module-specific patterns
- Focus on "weird rules" not general TypeScript knowledge
- Include examples for common operations
- Evolve organically: add rules after 2nd-3rd correction from AI
- Benefits: AI avoids repeating mistakes, stays within project conventions

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| TypeScript 5.9.3 | Bun latest | Bun uses TypeScript 5.9.3 (peer dependency). Must match. |
| Vitest 4.0.18 | TypeScript 5.x | Native TS support, no extra configuration needed. |
| Biome 2.4.2 | TypeScript 5.x | Linter and formatter work with strict mode. |

---

## Code Splitting Strategy for AI Assistants

### Principle 1: Interface-First Design
```typescript
// Define contract first
interface PlatformPublisher {
  publish(content: PostContent, token: OAuthToken): Promise<PublishResult>;
}

// Implementation per platform
class XPublisher implements PlatformPublisher {
  async publish(content: PostContent, token: OAuthToken) {
    // X-specific logic
  }
}

// Consumer knows contract, not implementation
const publisher: PlatformPublisher = getPublisher(platform);
await publisher.publish(content, token);
```

**Benefits for AI:**
- Can reason about behavior without reading implementation
- Can modify one platform without understanding others
- Interface serves as documentation of contract

### Principle 2: Barrel Exports at Boundaries
```typescript
// src/platforms/x/index.ts
export { XPublisher } from './publisher.js';
export { createXOAuthClient } from './oauth.js';
export type { XPostContent } from './types.js';
// Internal files NOT exported (client.ts internals, etc.)
```

**Benefits for AI:**
- Clear public API surface
- Discovers module capabilities from single file
- Internal implementation hidden, reducing confusion

### Principle 3: Domain-Based Directories
```
src/
  core/
    db/          # Database access, schemas, migrations
    types/        # Shared type definitions
    utils/        # General utilities
  platforms/
    x/            # X platform (client, oauth, media, types, publisher)
    linkedin/     # LinkedIn platform
    instagram/    # Instagram platform
    tiktok/       # TikTok platform
  trigger/
    tasks/        # Trigger.dev task definitions
    middleware/    # Shared middleware for tasks
```

**Benefits for AI:**
- Logical grouping by business domain
- Clear separation of concerns
- Easy to navigate and understand

### Principle 4: File Size Limits (<200 lines)

**Why:**
- AI context window can hold entire file
- Deep understanding without chunking
- Easier for AI to reason about complete function/class

**When to split:**
- Function >50 lines → extract helper functions
- Class >200 lines → split into multiple focused classes
- File >200 lines → split by responsibility
- Module >5 files → consider subdirectories

### Principle 5: Explicit Dependencies

```typescript
// Bad: implicit dependencies through globals
const db = getGlobalDb(); // Where does this come from?

// Good: explicit constructor injection
class PostPublisher {
  constructor(
    private readonly db: Database,
    private readonly tokenManager: TokenManager
  ) {}

  async publish(postId: string) {
    // Dependencies are explicit and typed
    const token = await this.tokenManager.getToken(postId);
    await this.db.update(postId, { status: 'published' });
  }
}
```

**Benefits for AI:**
- Clear dependency graph
- Easier to test with mocks
- Understands what a class needs to function

---

## Documentation Patterns for AI Assistants

### CLAUDE.md Template (Root)
```markdown
# Post Shit Now - Claude Code Project Instructions

## Project Overview
[2-3 sentence description]

## Common Commands
- `bun run typecheck`: Verify TypeScript types
- `bun run lint`: Run Biome linter
- `bun run test`: Run Vitest tests
- `bun run lint:fix`: Auto-fix lint issues

## Code Style
- Use ES modules (import/export), not CommonJS (require)
- Prefer named exports over default exports
- Keep files under 200 lines
- Use path aliases: `@psn/core/db/*`, `@psn/platforms/x/*`

## Platform Integration Pattern
When adding a new platform:
1. Create `src/platforms/<platform>/` directory
2. Implement `PlatformPublisher` interface
3. Create `CLAUDE.md` with platform-specific notes
4. Add barrel export in `index.ts`

## Prohibited Actions
- Never modify `drizzle/` directory directly (use `bun run db:generate`)
- Never use CommonJS `require()` statements
- Never mix platform logic in `publish-post.ts` (extract to platform-specific publisher)

## Testing
- Run `bun run test` after changes
- Use Vitest for unit tests
- Mock external API calls (X, LinkedIn, etc.)
```

### Directory CLAUDE.md Template
```markdown
# X Platform Integration

## Purpose
X (Twitter) API client, OAuth flow, media upload, and publishing logic.

## Key Files
- `client.ts`: Twitter API client wrapper using `twitter-api-v2`
- `oauth.ts`: OAuth 2.0 PKCE flow via `arctic`
- `media.ts`: Media upload with chunking
- `publisher.ts`: Implements `PlatformPublisher` interface
- `types.ts`: X-specific type definitions

## Common Patterns
- X API uses access tokens (no refresh needed)
- Media upload: call `uploadMedia()` first, then attach media ID to tweet
- Rate limit: `RateLimitError` thrown on 429, use exponential backoff

## X-Specific Notes
- API is pay-per-use as of Jan 2026 ($0.01/post)
- Supports threads via `client.v2.thread()`
- OAuth tokens don't expire (revoke-only)
```

### JSDoc Comment Template
```typescript
/**
 * Publish a post to X (Twitter).
 *
 * Creates a tweet with optional media attachment. If media is provided,
 * it must be uploaded first via `uploadMedia()` to get media ID.
 *
 * @param content - Post content including text and optional media IDs
 * @param token - OAuth access token (from `oauth_tokens` table)
 * @returns Promise resolving to published tweet data with ID and URL
 * @throws {RateLimitError} When X API rate limit is exceeded (429)
 * @throws {AuthenticationError} When token is invalid or expired
 *
 * @example
 * ```typescript
 * const result = await publishTweet(
 *   { text: "Hello world", mediaIds: ["1234567890"] },
 *   accessToken
 * );
 * console.log(result.tweetId); // "12345678901234567890"
 * ```
 */
async function publishTweet(
  content: TweetContent,
  token: string
): Promise<TweetResult> {
  // Implementation
}
```

**Benefits for AI:**
- Explains function purpose, parameters, return type
- Documents exceptions for error handling
- Provides usage examples
- AI can generate correct calls without reading implementation

---

## Testing Strategies for AI-Assisted Code

### Test Organization
```
src/
  platforms/
    x/
      publisher.test.ts      # Unit tests for XPublisher
      oauth.test.ts         # OAuth flow tests
      media.test.ts         # Media upload tests
  core/
    db/
      connection.test.ts     # DB connection tests
    types/
      post.test.ts         # Type validation tests
```

### Test Patterns for AI

**1. Interface Compliance Tests**
```typescript
import { describe, it, expect } from 'vitest';
import { XPublisher } from '../publisher.js';
import type { PlatformPublisher } from '@psn/core/types/index.js';

describe('XPublisher', () => {
  it('implements PlatformPublisher interface', () => {
    const publisher = new XPublisher(/* deps */);
    expect(publisher).toMatchObject<PlatformPublisher>({
      publish: expect.any(Function),
    });
  });
});
```

**2. External API Mocking**
```typescript
import { vi, describe, it, expect } from 'vitest';
import { XPublisher } from '../publisher.js';
import { TwitterApi } from 'twitter-api-v2';

// Mock external dependency
vi.mock('twitter-api-v2', () => ({
  TwitterApi: vi.fn(),
}));

describe('XPublisher', () => {
  it('publishes tweet via Twitter API', async () => {
    const mockClient = {
      v2: {
        tweet: vi.fn().mockResolvedValue({ data: { id: '123' } }),
      },
    };
    vi.mocked(TwitterApi).mockReturnValue(mockClient);

    const publisher = new XPublisher();
    const result = await publisher.publish({ text: 'test' }, 'token');

    expect(result.tweetId).toBe('123');
    expect(mockClient.v2.tweet).toHaveBeenCalledWith({ text: 'test' });
  });
});
```

**3. Error Scenario Tests**
```typescript
describe('XPublisher error handling', () => {
  it('throws RateLimitError on 429 response', async () => {
    const mockClient = {
      v2: {
        tweet: vi.fn().mockRejectedValue({ code: 429 }),
      },
    };
    vi.mocked(TwitterApi).mockReturnValue(mockClient);

    const publisher = new XPublisher();

    await expect(
      publisher.publish({ text: 'test' }, 'token')
    ).rejects.toThrow('RateLimitError');
  });
});
```

**Benefits for AI:**
- Clear test patterns to follow
- Interface compliance tests ensure contracts are honored
- Mocking isolates unit tests from external dependencies
- Error scenario tests help AI understand edge cases

---

## Monorepo Structure (Future Enhancement)

**Current state:** Single package in root.

**Future state (if monorepo needed):**
```
post-shit-now/
  packages/
    core/          # @psn/core - shared library
      package.json
      tsconfig.json
      src/
        db/
        types/
        platforms/  # Platform clients moved here
    trigger/       # @psn/trigger - Trigger.dev tasks
      package.json
      tsconfig.json
      src/
        tasks/
        middleware/
    cli/           # @psn/cli - CLI scripts
      package.json
      tsconfig.json
      src/
        commands/
  apps/
    root/          # Root application (commands trigger CLI)
      package.json
  pnpm-workspace.yaml
```

**When to adopt monorepo:**
- When `src/` exceeds 200 files
- When circular dependencies become common
- When multiple deployable units emerge (CLI vs Trigger.dev tasks)
- When teams work on separate packages

**Path alias strategy:**
```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "paths": {
      "@psn/core/*": ["./packages/core/src/*"],
      "@psn/trigger/*": ["./packages/trigger/src/*"],
      "@psn/cli/*": ["./packages/cli/src/*"]
    }
  }
}
```

---

## Sources

- [Claude Code最佳实践：官方心法](https://m.toutiao.com/w/1857885021073411/) — CLAUDE.md patterns, project-specific context
- [Claude Code最佳实践指南](https://m.blog.csdn.net/xixiluo99/article/details/157723100) — AI development workflows, context management
- [Agentic coding architecture patterns](https://openai.com/zh-Hans-CN/index/harness-engineering/) — Codex architecture, layered domain design
- [Claude Code Plugin Architecture](https://www.jdon.com/82382-wshobson-agents-CC-plugin.html) — Multi-agent orchestration, plugin boundaries
- [TypeScript dependency injection patterns](https://dev.to/vad3x/typesafe-almost-zero-cost-dependency-injection-in-typescript-112) — Interface-based DI patterns
- [AI 时代的前端自动化测试](https://juejin.cn/post/7588745319401406464) — AI-driven testing with Vitest
- [Vitest unit testing framework](https://juejin.im/entry/7578811288819908651) — Vitest advantages for TypeScript
- [TypeScript monorepo configuration](https://juejin.cn/entry/7583970267132821510) — pnpm workspaces, path aliases
- [Context engineering for AI assistants](https://github.com/coleam00/context-engineering-intro) — Code structure for AI coding
- [Nuxt UI rules for AI assistants](https://github.com/HugoRCD/nuxt-ui-rules) — Optimized guidelines for Cursor/Windsurf/Claude Code

---
*Stack research for: Agentic Architecture Improvements - Post Shit Now v1.2*
*Researched: 2026-02-25*
