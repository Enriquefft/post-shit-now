# Requirements: Post Shit Now

**Defined:** 2026-02-25
**Core Value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.

## v1.3 Requirements

Requirements for real-world reliability fixes. Derived from 342-turn trial session analysis + carried v1.2 items.

### Deployment Infrastructure

- [x] **DEPLOY-01**: Trigger.dev workers receive all required env vars (DATABASE_URL, HUB_ENCRYPTION_KEY, platform credentials) via syncEnvVars build extension
- [ ] **DEPLOY-02**: Missing env vars produce actionable error messages listing each missing variable at task start
- [x] **DEPLOY-03**: syncEnvVars reads from local hub config files at deploy time without requiring manual .env hacking

### Tweet Validation

- [ ] **TVAL-01**: Tweets are validated with weighted character counting (URLs=23, emojis=2, CJK=2) before API submission
- [ ] **TVAL-02**: Oversized tweets produce clear error messages with actual vs max character count instead of misleading 403
- [ ] **TVAL-03**: Thread splitter and tweet validator share a single countTweetChars() utility (single source of truth)

### OAuth Flow

- [ ] **OAUTH-01**: X OAuth callback server captures authorization code automatically via localhost (127.0.0.1:18923)
- [ ] **OAUTH-02**: Callback URL is defined in a single constant used by all code paths (no hardcoded duplicates)
- [ ] **OAUTH-03**: OAuth state parameter is validated to prevent CSRF attacks
- [ ] **OAUTH-04**: Callback server falls back to manual code entry if port is unavailable

### Thread Resilience

- [ ] **THREAD-01**: Thread progress (posted tweet IDs) is persisted to DB after each successful tweet
- [ ] **THREAD-02**: Thread posting resumes from last checkpoint on retry (no duplicate tweets)
- [ ] **THREAD-03**: Checkpoint DB writes retry 2-3 times on failure (checkpoint failure is never swallowed)
- [ ] **THREAD-04**: X Error 187 (duplicate) on retry is treated as "already posted" rather than failure

### Testing Infrastructure (carried from v1.2)

- [ ] **TEST-01**: Vitest configured with TypeScript path alias resolution
- [ ] **TEST-02**: Mock infrastructure exists for all external platform API clients
- [ ] **TEST-03**: Interface compliance tests validate PlatformPublisher behavioral contracts
- [ ] **TEST-04**: Unit tests cover tweet validation and thread checkpoint logic
- [ ] **DOC-03**: JSDoc comments include behavioral contracts on public APIs

### Context Management (carried from v1.2)

- [ ] **CTX-01**: Pre-commit hooks run biome on staged files with auto-fix (lefthook)
- [ ] **CTX-02**: Pre-commit hooks run typecheck in parallel (under 3 seconds total)
- [ ] **CTX-03**: Circular dependency detection at commit time (madge, already configured)
- [ ] **CTX-04**: State consolidation between PROJECT.md and MEMORY.md documented

## v1.4+ Deferred

- **DRY-01**: Dry-run mode for publishing (preview without posting)
- **MULTI-01**: Multi-hub env var resolution (each company hub gets own Trigger.dev project)
- **RESUME-01**: Thread resume CLI UX (`/psn:post --resume`)
- **OAUTH-05**: LinkedIn/Instagram/TikTok OAuth callback servers (same pattern, blocked by partner approvals)
- **TOKEN-01**: Refresh token race condition with optimistic locking for concurrent tasks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Database schema changes | All schema already exists; zero migrations for v1.3 |
| New platform support | Focus on fixing X; other platforms blocked by partner approvals |
| Automatic full-thread retry | X has no idempotency keys; auto-retry is an anti-feature (creates duplicates) |
| twitter-text npm package | Unmaintained 6+ years; custom validator is smaller and maintainable |
| husky + lint-staged | lefthook is lighter (Go binary), Biome-recommended, parallel by default |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 25 | Complete |
| DEPLOY-02 | Phase 25 | Pending |
| DEPLOY-03 | Phase 25 | Complete |
| TVAL-01 | Phase 26 | Pending |
| TVAL-02 | Phase 26 | Pending |
| TVAL-03 | Phase 26 | Pending |
| OAUTH-01 | Phase 27 | Pending |
| OAUTH-02 | Phase 27 | Pending |
| OAUTH-03 | Phase 27 | Pending |
| OAUTH-04 | Phase 27 | Pending |
| THREAD-01 | Phase 28 | Pending |
| THREAD-02 | Phase 28 | Pending |
| THREAD-03 | Phase 28 | Pending |
| THREAD-04 | Phase 28 | Pending |
| TEST-01 | Phase 29 | Pending |
| TEST-02 | Phase 29 | Pending |
| TEST-03 | Phase 29 | Pending |
| TEST-04 | Phase 29 | Pending |
| DOC-03 | Phase 29 | Pending |
| CTX-01 | Phase 30 | Pending |
| CTX-02 | Phase 30 | Pending |
| CTX-03 | Phase 30 | Pending |
| CTX-04 | Phase 30 | Pending |

**Coverage:**
- v1.3 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---

## v1.2 Requirements (Complete)

<details>
<summary>v1.2 requirements -- all architecture items complete, carried items moved to v1.3</summary>

### Code Splitting

- [x] **ARCH-01**: Extract PlatformPublisher interface with behavioral contracts
- [x] **ARCH-02**: Split publish-post.ts into platform-specific handlers (<200 lines each)
- [x] **ARCH-03**: Create handler factory for platform selection
- [x] **ARCH-04**: Refactor orchestration layer to use interface-based handlers
- [x] **ARCH-05**: Move platform clients to use interface pattern

### Documentation

- [x] **DOC-01**: Create root CLAUDE.md (100-200 lines) for project guidance
- [x] **ARCH-06**: Add CLAUDE.md files at module boundaries (platforms/, core/)
- [x] **DOC-02**: Document architecture overview with component relationships

### Module Boundaries

- [x] **ARCH-07**: Configure TypeScript path aliases (@psn/platforms, @psn/core)
- [x] **ARCH-08**: Create barrel exports (index.ts) at directory boundaries
- [x] **ARCH-09**: Define explicit public APIs vs internal modules
- [x] **ARCH-10**: Enforce file size limits (<200 lines) for AI context

### Tooling

- [x] **TOOL-01**: Configure TypeScript (noUnusedLocals, noUnusedParameters)
- [x] **TOOL-02**: Set up circular dependency checker (madge)
- [x] **TOOL-03**: Configure Biome linting for file size enforcement

</details>

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-27 after v1.3 roadmap creation*
