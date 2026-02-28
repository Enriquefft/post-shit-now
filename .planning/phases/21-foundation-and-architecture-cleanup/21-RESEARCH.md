# Phase 21: Foundation and Architecture Cleanup - Research

**Researched:** 2026-02-25
**Domain:** TypeScript interface design and architecture refactoring
**Confidence:** HIGH

## Summary

Phase 21 requires splitting the 1,239-line monolithic `publish-post.ts` into interface-based platform handlers with strict file size limits (<200 lines). The key to success is implementing a clean interface-first design pattern that enables AI understanding while maintaining the existing functionality. Research shows that TypeScript interface contracts, strict compiler options, and modern development tools provide the foundation needed for this refactoring.

**Primary recommendation:** Extract a `PlatformPublisher` interface with behavioral contracts first, then refactor each platform handler to implement this interface while keeping each file under 200 lines.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Extract PlatformPublisher interface with behavioral contracts | TypeScript interface-first design patterns define clear contracts between components |
| ARCH-02 | Split publish-post.ts into platform-specific handlers (<200 lines each) | Biome can enforce file size limits (files.maxSize) with proper configuration |
| ARCH-03 | Create handler factory for platform selection | Factory pattern is standard for managing platform-specific implementations |
| ARCH-04 | Refactor orchestration layer to use interface-based handlers | Type-safe interface composition prevents runtime errors and improves maintainability |
| ARCH-05 | Move platform clients to use interface pattern | Current clients can be wrapped with interfaces to standardize behavior |
| TOOL-01 | Configure TypeScript (noUnusedLocals, noUnusedParameters) | These strict compiler options eliminate dead code and improve maintainability |
| TOOL-02 | Set up circular dependency checker (madge) | Madge with --circular flag detects circular dependencies before they cause runtime issues |
| TOOL-03 | Configure Biome linting for file size enforcement | Biome's files.maxSize option can enforce the <200 line limit automatically |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9.3 | Type-safe JavaScript development | Industry standard with excellent tooling and strict type checking |
| Zod | 4.3.6 | Schema validation | Runtime type validation with compile-time type inference |
| Biome | 2.4.2 | Linting and formatting | Fast, modern replacement for ESLint and Prettier with built-in file size enforcement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.0.18 | Testing framework | For interface compliance testing and mock infrastructure |
| Madge | Latest | Circular dependency detection | For detecting circular dependencies during development |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Madge | Dependency-cruiser | DPDM has better TypeScript path mapping support but Madge is more established |
| Biome | ESLint + Prettier | Biome is faster and has built-in file size enforcement, but ESLint has more plugins |

**Installation:**
```bash
npm install --save-dev @types/node vitest
npm install -g madge
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── core/
│   ├── types/
│   │   ├── publisher.ts    # PlatformPublisher interface
│   │   └── index.ts        # Core type exports
│   └── utils/
│       └── publisher-factory.ts  # Handler factory
├── platforms/
│   ├── handlers/
│   │   ├── x.handler.ts     # <200 lines
│   │   ├── linkedin.handler.ts  # <200 lines
│   │   ├── instagram.handler.ts # <200 lines
│   │   ├── tiktok.handler.ts    # <200 lines
│   │   └── index.ts        # Handler exports
│   ├── x/
│   │   ├── client.ts       # Platform-specific client
│   │   ├── types.ts        # Platform types
│   │   └── index.ts        # Platform exports
│   └── linkedin/           # Similar structure
│       ├── client.ts
│       ├── types.ts
│       └── index.ts
```

### Pattern 1: Interface-First Design
**What:** Define contracts before implementation to establish clear expectations
**When to use:** When refactoring monolithic code into decoupled components
**Example:**
```typescript
// Source: TypeScript interface design best practices 2024
interface PlatformPublisher {
  publish(
    post: PostRow,
    encKey: Buffer,
    metadata: PostMetadata
  ): Promise<PlatformPublishResult>;

  validateCredentials(userId: string): Promise<boolean>;

  getRateLimitInfo(): RateLimitInfo | null;
}

export class XHandler implements PlatformPublisher {
  constructor(private client: XClient) {}

  async publish(post: PostRow, encKey: Buffer, metadata: PostMetadata) {
    // Platform-specific implementation (<200 lines)
  }

  async validateCredentials(userId: string) {
    // OAuth token validation
  }

  getRateLimitInfo() {
    return this.client.getRateLimitInfo();
  }
}
```

### Anti-Patterns to Avoid
- **Large interface files:** Keep interfaces small and focused on single responsibilities
- **Deep inheritance chains:** Use composition with intersection types instead
- **Platform-specific leaks:** Keep the interface platform-agnostic
- **Missing error handling:** Include standard error handling patterns in interface definition

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular dependency detection | Custom script that analyzes import files | Madge with --circular flag | Handles complex module graphs and provides visual output |
| File size enforcement | Custom lint rule | Biome files.maxSize configuration | Built-in, performant, and integrated with the dev workflow |
| Type-safe interfaces | Runtime validation only | TypeScript interfaces + Zod | Compile-time type checking with runtime validation |
| OAuth token management | Custom refresh logic | Platform-specific OAuth clients | Handles edge cases and refresh token rotation automatically |

**Key insight:** TypeScript's type system and modern development tools provide comprehensive solutions that would be complex and error-prone to implement manually.

## Common Pitfalls

### Pitfall 1: Interface Inflation
**What goes wrong:** Interfaces grow too large with multiple unrelated responsibilities
**Why it happens:** Adding functionality without considering the single responsibility principle
**How to avoid:** Start with minimal interfaces and add only what's necessary for the contract
**Warning signs:** Interfaces with more than 5-6 methods or mixed concerns

### Pitfall 2: Breaking Existing Functionality
**What goes wrong:** Refactoring breaks existing platform integration
**Why it happens:** Moving platform-specific logic to interfaces without thorough testing
**How to avoid:** Extract interface first, then implement handlers with comprehensive tests
**Warning signs:** Platform-specific methods leaking into the interface definition

### Pitfall 3: File Size Blindness
**What goes wrong:** Refactored files exceed the 200-line limit
**Why it happens:** Not breaking down logic sufficiently during extraction
**How to avoid:** Use Biome's file size limit as a hard constraint and break into multiple handlers
**Warning signs:** Files close to 200 lines during development without clear breaking points

### Pitfall 4: Circular Dependencies
**What goes wrong:** New interface-based architecture introduces circular imports
**Why it happens:** Shared dependencies between handlers creating circular references
**How to avoid:** Use dependency injection and avoid direct imports between handlers
**Warning signs:** Madge reports circular dependencies that weren't present before

## Code Examples

### Interface Definition
```typescript
// Source: TypeScript interface design patterns 2024
interface PlatformPublisher {
  // Core publish contract
  publish(
    db: ReturnType<typeof createHubConnection>,
    post: PostRow,
    encKey: Buffer,
    metadata: PostMetadata
  ): Promise<PlatformPublishResult>;

  // Authentication contract
  refreshCredentials(
    db: ReturnType<typeof createHubConnection>,
    userId: string,
    encKey: Buffer
  ): Promise<boolean>;

  // Rate limiting contract
  isRateLimited(): boolean;
  getRetryAfter(): Date | null;
}
```

### Handler Factory Pattern
```typescript
// Source: Design patterns for platform abstractions
type PlatformHandlerConstructor = new (client: PlatformClient) => PlatformPublisher;

const handlerRegistry: Record<Platform, PlatformHandlerConstructor> = {
  x: XHandler,
  linkedin: LinkedInHandler,
  instagram: InstagramHandler,
  tiktok: TikTokHandler,
};

export function createPlatformHandler(
  platform: Platform,
  client: PlatformClient
): PlatformPublisher {
  const HandlerClass = handlerRegistry[platform];
  return new HandlerClass(client);
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "strict": true,
    "paths": {
      "@psn/*": ["./src/*"]
    }
  }
}
```

### Biome Configuration for File Size Limits
```json
{
  "files": {
    "maxSize": 204800,  // 200KB limit for source files
    "include": ["src/**/*.{ts,js}"],
    "ignore": ["**/node_modules/**", "**/dist/**"]
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic publish-post.ts | Interface-based platform handlers | 2026-02-25 | Enables AI understanding and maintenance |
| Loose TypeScript configuration | Strict compiler options | 2026-02-25 | Eliminates dead code and improves type safety |
| Manual dependency management | Tool-based circular detection | 2026-02-25 | Prevents runtime errors during development |
| No file size limits | Automated enforcement | 2026-02-25 | Maintains AI-friendly code structure |

**Deprecated/outdated:**
- Large single-file implementations - replaced by interface composition
- Manual circular dependency checks - replaced by automated tools
- Loose TypeScript settings - replaced by strict compilation

## Open Questions

1. **How to handle platform-specific extensions?**
   - What we know: Some platforms may need additional methods not in the base interface
   - What's unclear: Whether to extend the interface or use a secondary contract
   - Recommendation: Use composition over inheritance with optional method implementations

2. **What to do with shared utility functions?**
   - What we know: Functions like `splitIntoThread` are used by multiple platforms
   - What's unclear: Where to place shared utilities to avoid circular dependencies
   - Recommendation: Create a shared utilities module that doesn't depend on platform handlers

3. **How to maintain backward compatibility during refactoring?**
   - What we know: Existing clients expect certain method signatures
   - What's unclear: Whether to implement a compatibility layer immediately
   - Recommendation: Extract interface first, then refactor handlers while maintaining external API compatibility

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | vitest.config.ts |
| Quick run command | `vitest run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARCH-01 | PlatformPublisher interface defines publish contract | unit | `vitest run src/core/types/publisher.test.ts` | ❌ Wave 0 |
| ARCH-02 | Each platform handler <200 lines | lint | `biome check --files-only src/platforms/handlers/` | ❌ Wave 0 |
| ARCH-03 | Handler factory creates correct handlers | integration | `vitest run src/core/utils/publisher-factory.test.ts` | ❌ Wave 0 |
| ARCH-04 | Orchestration layer uses interface pattern | unit | `vitest run src/trigger/publish-post.test.ts` | ❌ Wave 0 |
| ARCH-05 | Platform clients implement interface | unit | `vitest run src/platforms/*/client.test.ts` | ❌ Wave 0 |
| TOOL-01 | TypeScript strict mode enabled | build | `npm run typecheck` | ✅ Existing |
| TOOL-02 | No circular dependencies detected | lint | `madge --circular src/` | ❌ Wave 0 |
| TOOL-03 | File size limits enforced | lint | `biome check --files-only src/` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/core/types/publisher.test.ts` — covers PlatformPublisher interface compliance
- [ ] `src/core/utils/publisher-factory.test.ts` — covers handler factory functionality
- [ ] `src/platforms/*/client.test.ts` — covers platform client interface implementation
- [ ] Madge configuration: `madge --circular src/` — if none detected
- [ ] Biome configuration: `biome check --files-only src/` — for file size enforcement
- [ ] Framework install: `npm install --save-dev vitest @types/node` — if none detected

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

## Sources

### Primary (HIGH confidence)
- [TypeScript Interface Design Patterns 2024](https://m.blog.csdn.net/gitblog_00343/article/details/152191354) - Advanced interface design and contract-first development
- [TypeScript Compiler Options Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) - Official documentation for strict TypeScript compilation
- [Biome Configuration Reference](https://biome.nodejs.cn/reference/configuration/) - Official Biome configuration documentation

### Secondary (MEDIUM confidence)
- [Madge Circular Dependency Detection](https://m.blog.csdn.net/gitblog_00244/article/details/141485418) - Best practices for circular dependency detection
- [Biome File Size Limits](https://m.blog.csdn.net/gitblog_00150/article/details/154893742) - Configuration for file size enforcement

### Tertiary (LOW confidence)
- [Interface-First Design Patterns](https://developer.baidu.com/article/detail.html?id=5589995) - General interface design principles (marked for validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeScript, Zod, Biome are well-established tools with clear documentation
- Architecture: HIGH - Interface-first design is a proven pattern for this type of refactoring
- Pitfalls: HIGH - Common issues like circular dependencies and file size limits are well-documented

**Research date:** 2026-02-25
**Valid until:** 2026-03-27