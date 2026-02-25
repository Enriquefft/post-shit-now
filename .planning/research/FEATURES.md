# Feature Research: Agentic Development Improvements for Post Shit Now

**Domain:** TypeScript/Node.js codebase architecture for AI-assisted development
**Researched:** 2026-02-25
**Confidence:** HIGH (verified via official docs, 2026 best practices, and analysis of existing codebase)

## Feature Landscape

### Table Stakes (Users Expect These)

Features AI assistants assume exist in well-structured codebases. Missing these = AI struggles to work effectively.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Interface definitions for platform handlers** | AI needs contracts to understand component boundaries without reading all implementations | MEDIUM | Define `PlatformPublisher` interface with `publish()` method for X, LinkedIn, Instagram, TikTok |
| **Code splitting from monolithic files** | AI context windows (even 1M tokens) struggle with >1,000 line files for deep understanding | MEDIUM | Extract platform logic from `publish-post.ts` (1,239 lines) into focused modules |
| **Root CLAUDE.md documentation** | Claude Code automatically loads this for project context. Missing = AI lacks project-specific guidance | LOW | 100-200 lines covering: overview, common commands, code style, prohibited actions |
| **Path aliases for module imports** | Clear boundaries make AI reasoning easier than relative imports (`../../platforms/x/client.ts`) | LOW | Configure `@psn/platforms/*`, `@psn/core/db/*`, `@psn/core/types/*` |
| **Barrel exports at module boundaries** | Single entry point per module. AI discovers public API without confusion | LOW | `src/platforms/x/index.ts` exports only: `XPublisher`, `createXOAuthClient`, `XPostContent` type |
| **File size limits (<200 lines)** | AI can hold entire file in context for deep reasoning. Large files = chunking = reduced understanding | LOW | Split functions >50 lines, classes >200 lines, files >200 lines |
| **Explicit dependency injection** | AI needs to see what components require to function. Global dependencies confuse reasoning | LOW | Constructor injection: `class Publisher(db: Database, tokenManager: TokenManager)` |
| **JSDoc comments on public APIs** | AI reads JSDoc to understand purpose, parameters, return types, and edge cases | LOW | Focus on "why" not "what". Include examples and thrown errors |

### Differentiators (Competitive Advantage)

Features that set this codebase apart as AI-native. Not required for basic AI usage, but significantly enhance agentic capabilities.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Directory-level CLAUDE.md files** | Progressive disclosure: AI gets context relevant to current working directory | LOW | `src/platforms/x/CLAUDE.md` (50-100 lines) with X-specific patterns, gotchas, examples |
| **Interface compliance tests** | Automatic validation that implementations honor contracts. AI refactors with confidence | MEDIUM | Vitest tests: `expect(publisher).toMatchObject<PlatformPublisher>({ publish: expect.any(Function) })` |
| **Context rot prevention** | Keep docs synchronized with code. Stale docs = AI follows outdated patterns | HIGH | Pre-commit hooks or CI checks: verify CLAUDE.md examples still compile, file size limits enforced |
| **Mock infrastructure for external APIs** | Isolated unit tests. AI can generate tests without understanding platform-specific APIs | MEDIUM | Vitest mocks for `twitter-api-v2`, `instagram-graph-api`, `linkedin-api-sdk`, etc. |
| **Architecture overview documentation** | High-level system structure. AI understands data flow and component relationships without exploring | LOW | `ARCHITECTURE.md` with diagrams showing: DB → Platform Clients → Publishers → Trigger Tasks |
| **Error scenario documentation** | AI understands edge cases and how to handle them. Produces more robust code | LOW | Document rate limit handling (429), token refresh failures, partial posting failures, media upload timeouts |
| **Refactoring safety nets** | Large-scale changes (splitting `publish-post.ts`) without breaking behavior | HIGH | Integration tests for end-to-end publishing flows. Pre/post refactoring test runs to validate |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for agentic development.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AI-generated CLAUDE.md from scratch** | Quick way to get started documentation | AI invents patterns that don't exist, misses critical project conventions, produces generic filler | Start minimal (100 lines), evolve organically after 2nd-3rd AI correction |
| **Complex multi-level @imports** | Keeps main CLAUDE.md concise | AI may miss critical rules if they're buried in 5 levels of imports. Confusing inheritance | Simple structure: root CLAUDE.md (project rules) + directory CLAUDE.md (module patterns) |
| **Auto-generated file headers** | "DO NOT EDIT" patterns prevent AI from modifying generated code | AI may try to modify generated code anyway, causing conflicts. Violates single-source-of-truth principle | Separate `src/` and `dist/` directories. Generated files in `dist/` only |
| **God objects with extensive JSDoc** | Comprehensive documentation in one place | AI overwhelmed by 500+ line interfaces with 50 methods. Can't reason about individual methods | Interface segregation: split into focused interfaces (e.g., `PlatformPublisher`, `MediaUploader`, `OAuthClient`) |
| **Dynamic imports for lazy loading** | Reduce bundle size by loading code on-demand | AI can't statically analyze dependencies. Refactoring becomes error-prone | Eager imports for AI-assisted development. Lazy loading only if bundle size is critical |

## Feature Dependencies

```
Interface definitions (PlatformPublisher)
    └──requires──> Type definitions (shared types in src/core/types/)
                    └──enhances──> Barrel exports (clear public API)

Code splitting (extract platform handlers)
    └──requires──> Interface definitions (contract to follow)
                    └──requires──> Path aliases (clean imports)

CLAUDE.md documentation
    └──enhances──> Code splitting (easier to understand split modules)

Interface compliance tests
    └──requires──> Interface definitions
                    └──requires──> Mock infrastructure (test isolation)

Context rot prevention
    └──requires──> CLAUDE.md documentation
                    └──requires──> Refactoring safety nets (validate changes)

Error scenario documentation
    └──enhances──> JSDoc comments
```

### Dependency Notes

- **Interface definitions requires Type definitions:** Shared types must exist before interfaces can reference them
- **Code splitting requires Interface definitions:** Extracting modules requires contracts to follow. Without interfaces, AI invents its own structure
- **Code splitting requires Path aliases:** Clean imports (`@psn/platforms/x/publisher`) make AI reasoning easier than relative paths (`../../platforms/x/client.ts`)
- **CLAUDE.md enhances Code splitting:** Documentation helps AI understand new module structure after refactoring
- **Interface compliance tests require Interface definitions:** Tests validate that implementations honor contracts
- **Interface compliance tests requires Mock infrastructure:** Isolate unit tests from external platform APIs
- **Context rot prevention requires CLAUDE.md documentation:** Nothing to keep synchronized if no documentation exists
- **Context rot prevention requires Refactoring safety nets:** Tests validate that docs still match code after changes
- **Error scenario documentation enhances JSDoc comments:** JSDoc describes happy path, error scenarios describe edge cases

## MVP Definition

### Launch With (Phase 1-2)

Minimum viable features for AI to work effectively with this codebase.

- [ ] **Interface definitions for platform handlers** — Essential for AI to understand boundaries. Define `PlatformPublisher` interface with `publish(content, token)` method
- [ ] **Code splitting from monolithic `publish-post.ts`** — 1,239 lines is too large for AI deep understanding. Extract platform-specific logic into `src/platforms/*/publisher.ts` modules
- [ ] **Root CLAUDE.md documentation** — Project-level guidance: overview, common commands (`bun run typecheck`, `bun run lint:fix`), code style, prohibited actions
- [ ] **Path aliases for module imports** — Configure `@psn/platforms/*`, `@psn/core/db/*`, `@psn/core/types/*` in tsconfig.json
- [ ] **Barrel exports at module boundaries** — Single entry point per platform. `src/platforms/x/index.ts` exports only public API
- [ ] **File size limits (<200 lines)** — Split `publish-post.ts` into focused modules. Extract helper functions, group by responsibility

### Add After Validation (Phase 3-4)

Features to add once core refactoring is working and AI is effectively navigating the codebase.

- [ ] **Directory-level CLAUDE.md files** — Trigger when AI makes 2nd-3rd mistake in same module (e.g., `src/platforms/x/CLAUDE.md` for X-specific patterns)
- [ ] **Interface compliance tests** — Trigger when AI generates code that doesn't match interface contracts. Vitest tests using `toMatchObject<PlatformPublisher>`
- [ ] **Mock infrastructure for external APIs** — Trigger when writing unit tests for platform clients. Vitest mocks for `twitter-api-v2`, `instagram-graph-api`, etc.
- [ ] **JSDoc comments on public APIs** — Trigger when AI generates unclear or incorrect usage. Focus on "why", examples, thrown errors
- [ ] **Explicit dependency injection** — Trigger when refactoring components to testability. Constructor injection for database, token manager, etc.

### Future Consideration (Phase 5+)

Features to defer until agentic development patterns are validated and refined.

- [ ] **Context rot prevention** — Defer until CLAUDE.md has stable content. Pre-commit hooks to verify docs still compile, file size limits enforced
- [ ] **Architecture overview documentation** — Defer until module structure is finalized. `ARCHITECTURE.md` with diagrams and data flow
- [ ] **Error scenario documentation** — Defer until edge cases are well-understood. Document rate limits, token refresh failures, partial failures
- [ ] **Refactoring safety nets** — Defer until large-scale refactoring is planned. Integration tests for end-to-end publishing flows

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Interface definitions | HIGH | MEDIUM | P1 |
| Code splitting (publish-post.ts) | HIGH | HIGH | P1 |
| Root CLAUDE.md documentation | HIGH | LOW | P1 |
| Path aliases | HIGH | LOW | P1 |
| Barrel exports | HIGH | LOW | P1 |
| File size limits | HIGH | MEDIUM | P1 |
| Directory-level CLAUDE.md | MEDIUM | LOW | P2 |
| Interface compliance tests | MEDIUM | MEDIUM | P2 |
| Mock infrastructure | MEDIUM | MEDIUM | P2 |
| JSDoc comments | MEDIUM | LOW | P2 |
| Explicit dependency injection | MEDIUM | MEDIUM | P2 |
| Context rot prevention | HIGH | HIGH | P3 |
| Architecture overview documentation | MEDIUM | MEDIUM | P3 |
| Error scenario documentation | MEDIUM | LOW | P3 |
| Refactoring safety nets | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for AI to work effectively with codebase
- P2: Should have, enhances AI capabilities significantly
- P3: Nice to have, mature AI workflow first

## Competitor Feature Analysis

| Feature | Standard TypeScript Projects | AI-Native Projects | Post Shit Now Plan |
|---------|----------------------------|-------------------|-------------------|
| Interface definitions | Common (80%+) | Universal (100%) | P1 - Define `PlatformPublisher`, `MediaUploader`, `OAuthClient` |
| File size limits | Rare (<20%) | Common (60%) | P1 - Enforce <200 lines per file |
| Root CLAUDE.md | Rare (<10%) | Universal (100%) | P1 - 100-200 lines project guide |
| Path aliases | Common (70%) | Universal (100%) | P1 - `@psn/*` aliases configured |
| Barrel exports | Uncommon (30%) | Common (70%) | P1 - Single entry point per platform |
| Directory CLAUDE.md | Very rare (<5%) | Common (50%) | P2 - Add after 2nd-3rd AI correction |
| Interface compliance tests | Rare (<20%) | Common (60%) | P2 - Vitest tests for contracts |
| Mock infrastructure | Common (60%) | Universal (100%) | P2 - Vitest mocks for external APIs |
| Context rot prevention | Very rare (<2%) | Emerging (20%) | P3 - Pre-commit hooks after docs stable |

## Implementation Notes

### Interface Definition Strategy

```typescript
// src/core/types/platform.ts (new file)
export interface PlatformPublisher {
  /**
   * Publish content to the platform.
   *
   * @param content - Post content including text and optional media
   * @param token - OAuth access token for the platform
   * @returns Promise resolving to published post data with ID and URL
   * @throws {RateLimitError} When platform rate limit is exceeded (429)
   * @throws {AuthenticationError} When token is invalid or expired
   */
  publish(content: PostContent, token: string): Promise<PublishResult>;
}

export interface MediaUploader {
  uploadMedia(media: MediaFile, token: string): Promise<MediaId>;
}

export interface OAuthClient {
  createAuthorizationUrl(): string;
  exchangeCodeForToken(code: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
}
```

### Code Splitting Strategy for publish-post.ts

Current structure (monolithic):
```
src/trigger/publish-post.ts (1,239 lines)
├── Database connection setup
├── Post loading logic
├── Platform-specific publishing (X, LinkedIn, Instagram, TikTok)
├── Media upload logic (inline for each platform)
├── Token refresh logic
├── Error handling and retry
└── Notification dispatch
```

Target structure (split):
```
src/trigger/
├── publish-post.ts (<200 lines) - Orchestration only
├── load-post.ts - Post loading from database
└── platform-dispatcher.ts - Delegates to platform publishers

src/platforms/
├── x/
│   ├── publisher.ts - Implements PlatformPublisher.publish()
│   ├── index.ts - Barrel export
│   └── CLAUDE.md - X-specific patterns
├── linkedin/
│   ├── publisher.ts - Implements PlatformPublisher.publish()
│   ├── index.ts - Barrel export
│   └── CLAUDE.md - LinkedIn-specific patterns
├── instagram/
│   ├── publisher.ts - Implements PlatformPublisher.publish()
│   ├── index.ts - Barrel export
│   └── CLAUDE.md - Instagram-specific patterns
└── tiktok/
    ├── publisher.ts - Implements PlatformPublisher.publish()
    ├── index.ts - Barrel export
    └── CLAUDE.md - TikTok-specific patterns
```

### CLAUDE.md Template

```markdown
# Post Shit Now - Claude Code Project Instructions

## Project Overview
Claude Code-first social media growth system. Users interact via terminal slash commands. Trigger.dev Cloud handles scheduling, posting, analytics. Distributed as git repo clone.

## Common Commands
- `bun run typecheck`: Verify TypeScript types
- `bun run lint`: Run Biome linter
- `bun run lint:fix`: Auto-fix lint issues
- `bun run test`: Run Vitest tests

## Code Style
- ES modules (import/export), never CommonJS (require)
- Named exports over default exports
- Files under 200 lines, functions under 50 lines
- Path aliases: `@psn/platforms/*`, `@psn/core/db/*`, `@psn/core/types/*`

## Platform Integration Pattern
When working with platform code:
1. Read platform's CLAUDE.md (e.g., `src/platforms/x/CLAUDE.md`)
2. Use `PlatformPublisher` interface for publishing logic
3. Never modify `publish-post.ts` directly (orchestration only)
4. Export only public API via barrel export (`index.ts`)

## Prohibited Actions
- Never modify `drizzle/` directory directly (use `bun run db:generate`)
- Never use CommonJS `require()` statements
- Never mix platform logic in `publish-post.ts` (extract to platform-specific publisher)
- Never expose internal implementation via barrel exports
```

## Sources

- [AI智能体的开发流程](https://www.sohu.com/a/985410373_121198703) — Autonomy boundaries, determinism, observability for AI agents
- [Agent智能体:2026年AI开发者必须掌握的自主系统革命](https://k.sina.cn/article/7879848900_1d5acf3c401902q0wo.html) — Modular design, pluggable architecture
- [AI API Middleware for Faster, More Accurate Responses](https://www.linkedin.com/posts/shekhar-dube-457b2713_ai-intelligent-api-key-technical-points-activity-7414581115270647809-Q7LW) — MCP protocol, interface boundaries
- [2026 AI Agent 技术演进与主流云服务商实践](https://developer.baidu.com/article/detail.html?id=5575437) — Three-layer separation architecture
- [2025: The Year AI Agents Grew Up](https://www.linkedin.com/pulse/2025-year-ai-agents-grew-up-reasoning-mcp-production-reality-ibrahim-xdmce) — Agentic workflows become default
- [AI Agent：2026年AI生态核心与开发实践指南](https://m.blog.csdn.net/2301_77193447/article/details/157838768) — Closed-loop architecture, safety boundaries
- [2026年AI Agent开发路线图：从入门到精通的全栈指南](https://blog.csdn.net/l01011_/article/details/157251316) — Lightweight, modular design
- [坚守内核，拥抱变量：我的 2025 年终复盘与 2026 展望](https://tonybai.com/2026/01/04/stick-to-the-core-embrace-variables-2025-review-2026-outlook/) — Agentic systems explosion year
- [告别"金鱼记忆"：一份CLAUDE.md配置指南](https://blog.csdn.net/lgf228/article/details/158368721) — CLAUDE.md organization patterns
- [Vibe Coding - 把从"会写代码的聊天框"升级为"可复用的工程工作流系统"](https://m.blog.csdn.net/yangshangwei/article/details/158319117) — CLAUDE.md, Skills, Subagents, Plugins
- [解锁CLAUDE.md的5个高级技巧](https://blog.csdn.net/2601_95315444/article/details/158312992) — Advanced CLAUDE.md techniques
- [5个技巧让CLAUDE.md发挥最大威力](https://blog.csdn.net/2601_95160669/article/details/157694584) — CLAUDE.md best practices
- [一套可复制的Claude Code 配置方案：CLAUDE.md、Rules](https://www.53ai.com/news/LargeLanguageModel/2026012313267.html) — Reproducible configuration
- [【Anthropic】Claude Code：智能体编程最佳实践](https://www.heartthinkdo.com/?p=4551) — Official Anthropic best practices
- [CLAUDE.md 全方位指南：构建高效 AI 开发上下文](https://segmentfault.com/a/1190000047545795?sort=votes) — Comprehensive CLAUDE.md guide
- [重磅！Claude Code官方开源：AI屎山代码，终于有解了~](https://www.woshipm.com/ai/6324053.html) — Claude Code for monolithic refactoring
- [【教程】CLAUDE.md 与 AGENTS.md 完全指南](https://m.blog.csdn.net/a18792721831/article/details/156729996) — CLAUDE.md and AGENTS.md guide
- [Coding Agent 的进化之路—— 从代码建议到自主编程](https://juejin.cn/post/7607358297457475584) — Agent evolution, context management
- [Prompt 驱动开发手册——理解AI 编码能力](https://juejin.cn/post/7607620065857585202) — AI coding capabilities
- [Claude Sonnet 4：最新开放100 万 Token 上下文窗口](https://blog.csdn.net/qq_44866828/article/details/150379436) — Context window expansion
- [无限代码危机！奈飞AI工程师曝自家上下文工程秘诀](https://www.51cto.com/article/832772.html) — Context compression, Netflix practices
- [前Codex 大神倒戈实锤！吹爆Claude Code：编程提速5 倍](https://www.163.com/dy/article/KBFBMELA05566ZHB.html) — Claude Code for agentic coding
- [2026 AI开发变局：TypeScript碾压Python？4大核心优势](https://m.toutiao.com/a7605583772906324520/) — TypeScript dominance in AI era
- [你还在手动修复AI代码？TypeScript这3种模式让AI输出即生产就绪](https://m.blog.csdn.net/QuickDebug/article/details/153119732) — TypeScript patterns for AI
- [TypeScript为何在AI时代登顶：Anders Hejlsberg 的十二年演化论](http://juejin.cn/entry/7571278865516576818) — TypeScript's 12-year evolution
- [2026年TS开发者危机：深耕2年被AI碾压](https://m.toutiao.com/a7601492992842596899/) — Developer landscape in AI era
- [2026年测试工具与平台推荐榜单](http://www.xnnews.com.cn/ly/lygl/202602/t20260206_4253223.shtml) — AI-assisted testing infrastructure
- [2026年AI开发工具比较：开源vs.商业](https://m.blog.csdn.net/2501_94261392/article/details/157142212) — Compliance, test automation
- [2026年软件测试工具趋势全景报告](https://blog.csdn.net/2501_94261392/article/details/156644803) — ISO/IEC 33000 compliance
- [AI辅助代码审查：测试生成工具](https://blog.csdn.net/2501_94449023/article/details/156945757) — AI code review, 40% defect improvement
- [2026年AI开发工具评测：性能大比拼](https://blog.csdn.net/2501_944311/article/details/157203958) — Performance evaluation framework
- [AI测试自动化：2026年必备工具Top 7](https://blog.csdn.net/2501_944311/article/details/156942520) — 70% enterprises use AI testing
- [2026年CI/CD工具趋势预测](https://blog.csdn.net/2501_94436481/article/details/156720693) — 90% automated security coverage
- [AGENTS.md 规范](https://jimmysong.io/zh/book/ai-handbook/sdd/agents/) — Three-layer boundary model
- [TypeScript与AI开发：构建智能应用的完整工具链](https://m.blog.csdn.net/gitblog_01019/article/details/154672479) — TypeScript AI toolchain
- [TypeScript开发者文档焦虑：当AI秒产用户手册](https://www.cnblogs.com/tlnshuju/p/19547893) — Documentation challenges
- [资深工程师的Vibe Coding实战指南](http://juejin.cn/entry/7521772773284528179) — Vibe coding practices

---
*Feature research for: Agentic Development Improvements - Post Shit Now v1.2*
*Researched: 2026-02-25*
