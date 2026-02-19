# Phase 6: LinkedIn and Multi-Platform - Research

**Researched:** 2026-02-19
**Domain:** LinkedIn API integration, multi-platform content dispatch, partial failure isolation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. LinkedIn Content Adaptation**
- User chooses per post: "adapt this or generate fresh?" with auto-adapt as default suggestion
- All 4 LinkedIn format types: text+image, document/carousel, polls, articles
- Format picker extended for LinkedIn formats; carousels auto-suggested when content fits
- Platform-native length: 1000-1300 chars with hooks, storytelling, CTAs — not padded X content

**2. Multi-Platform Posting Flow**
- Platform targeting: strategy.yaml defaults + Claude suggests + user override
- Platform-optimal stagger: system staggers posts across platforms based on optimal times
- Generate-then-branch UX: generate core content, show platform-specific previews
- One slot, multiple platforms in weekly planning; adaptations at draft time

**3. Partial Failure and Retry**
- Keep successes, retry failures: never roll back a successful platform publish
- Auto-retry with backoff + escalate: 3 retries, then notify user
- Per-platform status on post record (X checkmark, LinkedIn retry 2/3)
- Platform-specific retry windows

**4. LinkedIn Token Lifecycle**
- Progressive warnings: 7 days, 3 days, 1 day before expiry
- Re-auth via same OAuth flow as initial setup
- Auto-refresh when possible via existing token-refresher cron
- Publish attempt + fail gracefully on expired tokens; other platforms unaffected

### Claude's Discretion
None captured — all areas received explicit decisions.

### Deferred Ideas
None captured during discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-02 | LinkedIn OAuth 2.0 3-legged flow using Arctic | Arctic v3 has `LinkedIn` provider; standard 3-legged OAuth with state param; scopes `openid`, `profile`, `w_member_social`, `r_member_postAnalytics` |
| PLAT-02 | LinkedIn posting: text, carousels (PDF), images, scheduling | Posts API (`POST /rest/posts`), Images API, Documents API for carousel PDFs; versioned headers required |
| PLAT-06 | Platform-specific content adaptation | Format picker extension + LinkedIn-specific length/structure rules; document posts for carousels |
| PLAT-07 | Multi-platform posting with partial failure isolation | Independent per-platform dispatch; per-platform status tracking in posts table metadata |
| ANLYT-02 | LinkedIn analytics collection daily | `memberCreatorPostAnalytics` API with `r_member_postAnalytics` scope; metrics: IMPRESSION, REACTION, COMMENT, RESHARE, MEMBERS_REACHED |
| POST-02 | Generate LinkedIn posts in user's voice | Content brain + format picker extended for LinkedIn formats and length norms |
</phase_requirements>

## Summary

Phase 6 extends the existing X-only posting pipeline to LinkedIn and establishes the multi-platform architecture for future platforms. The LinkedIn API is a REST API (not GraphQL) requiring versioned headers (`Linkedin-Version: YYYYMM`) and RestLi protocol headers on every request. Content posting uses the Posts API endpoint (`POST /rest/posts`) for all content types. Media (images, documents) must be uploaded separately first to obtain URNs, then referenced in the post creation payload.

The critical insight: LinkedIn's "carousel" for organic posts is actually a **document post** — you upload a PDF (or PPTX/DOCX) via the Documents API, and LinkedIn renders each page as a swipeable slide. There is no native carousel API for organic posts (only sponsored). This means we need PDF generation capability (pdf-lib) to create carousel slides programmatically.

The multi-platform architecture uses the existing single-post-per-platform-per-row model in the posts table, adding multi-platform dispatch at the Trigger.dev task level with independent publishing per platform and per-platform status tracking in post metadata.

**Primary recommendation:** Build a `LinkedInClient` mirroring `XClient`'s raw-fetch pattern, add LinkedIn OAuth via Arctic's `LinkedIn` provider, extend the publish-post task with platform dispatch, and add `pdf-lib` for carousel PDF generation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| arctic | v3 (existing) | LinkedIn OAuth 2.0 | Already used for X; has `LinkedIn` provider with 3-legged OAuth |
| pdf-lib | ^1.17 | Generate carousel PDFs | Pure JS, no native deps, works in Node.js and Trigger.dev workers |
| sharp | (existing) | Image processing for LinkedIn specs | Already used for X image processing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | v4 (existing) | LinkedIn API response validation | Same pattern as XClient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-lib | pdfkit | pdfkit has more features but pdf-lib is pure JS with zero native deps — better for Trigger.dev workers |
| raw fetch | linkedin-sdk | No official SDK exists; raw fetch matches XClient pattern |

**Installation:**
```bash
pnpm add pdf-lib
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── platforms/
│   ├── x/               # Existing X platform module
│   │   ├── oauth.ts
│   │   ├── client.ts
│   │   ├── media.ts
│   │   └── types.ts
│   ├── linkedin/         # NEW: LinkedIn platform module (mirrors X structure)
│   │   ├── oauth.ts      # Arctic LinkedIn OAuth
│   │   ├── client.ts     # LinkedInClient (raw fetch, same pattern as XClient)
│   │   ├── media.ts      # Image + Document upload
│   │   ├── carousel.ts   # PDF generation for document/carousel posts
│   │   └── types.ts      # LinkedIn API types + Zod schemas
│   └── adapter.ts        # NEW: Multi-platform content adapter
├── trigger/
│   ├── publish-post.ts   # EXTEND: Multi-platform dispatch
│   └── token-refresher.ts # EXTEND: LinkedIn token refresh
├── content/
│   └── format-picker.ts  # EXTEND: LinkedIn formats
└── analytics/
    └── collector.ts      # EXTEND: LinkedIn metrics collection
```

### Pattern 1: Platform Client Abstraction
**What:** Each platform has a typed client class with raw fetch, rate limit tracking, and Zod-validated responses.
**When to use:** Every API interaction with LinkedIn.
**Example:**
```typescript
// Source: mirrors existing XClient pattern in src/platforms/x/client.ts
const BASE_URL = "https://api.linkedin.com";

export class LinkedInClient {
  private accessToken: string;
  private version: string; // YYYYMM format

  constructor(accessToken: string, version = "202602") {
    this.accessToken = accessToken;
    this.version = version;
  }

  private async request<T>(endpoint: string, options: RequestInit, schema?: ZodType<T>) {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    headers.set("LinkedIn-Version", this.version);
    headers.set("X-Restli-Protocol-Version", "2.0.0");
    // ... rate limit extraction, error handling, Zod validation
  }
}
```

### Pattern 2: Multi-Platform Dispatch with Partial Failure Isolation
**What:** The publish-post task dispatches to each target platform independently, catching failures per platform.
**When to use:** Every multi-platform publish.
**Example:**
```typescript
// Per-platform dispatch with independent error handling
const results: Record<string, { status: "published" | "failed"; error?: string }> = {};

for (const platform of targetPlatforms) {
  try {
    results[platform] = await publishToPlatform(db, post, platform, encKey);
  } catch (err) {
    results[platform] = { status: "failed", error: String(err) };
    logger.error(`Failed to publish to ${platform}`, { error: err });
  }
}
// Update post metadata with per-platform results
// Post overall status: "published" if any succeeded, "failed" if all failed
```

### Pattern 3: LinkedIn Image Upload Flow
**What:** Two-step upload: initialize to get upload URL + URN, then PUT binary to upload URL.
**When to use:** Every image or document post.
**Example:**
```typescript
// Source: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
// Step 1: Initialize upload
const initResponse = await client.initializeImageUpload(ownerUrn);
// Returns: { uploadUrl, image: "urn:li:image:xxx" }

// Step 2: Upload binary to uploadUrl
await fetch(initResponse.uploadUrl, {
  method: "PUT",
  headers: { "Authorization": `Bearer ${token}` },
  body: imageBuffer,
});

// Step 3: Use image URN in post creation
await client.createPost({
  author: personUrn,
  commentary: "Post text",
  content: { media: { id: initResponse.image, altText: "..." } },
  // ...
});
```

### Pattern 4: Document/Carousel Upload for Organic Carousels
**What:** Organic carousels on LinkedIn are actually document posts (PDF pages = slides).
**When to use:** When format picker selects "carousel" for LinkedIn.
**Example:**
```typescript
// Source: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api
// Step 1: Generate PDF from slides using pdf-lib
import { PDFDocument, rgb } from "pdf-lib";
const pdfDoc = await PDFDocument.create();
for (const slide of slides) {
  const page = pdfDoc.addPage([1080, 1080]); // Square carousel slides
  // Draw slide content (text, embedded images)
}
const pdfBytes = await pdfDoc.save();

// Step 2: Initialize document upload
const initResponse = await client.initializeDocumentUpload(ownerUrn);
// Returns: { uploadUrl, document: "urn:li:document:xxx" }

// Step 3: Upload PDF binary
await fetch(initResponse.uploadUrl, {
  method: "PUT",
  headers: { "Authorization": `Bearer ${token}` },
  body: pdfBytes,
});

// Step 4: Create post with document
await client.createPost({
  author: personUrn,
  commentary: "Carousel post",
  content: { media: { id: initResponse.document, title: "Carousel.pdf" } },
  // ...
});
```

### Anti-Patterns to Avoid
- **Coupling platform publishes:** Never make X success dependent on LinkedIn success or vice versa. Each platform publishes independently.
- **Reusing X content verbatim:** LinkedIn has completely different norms (longer text, professional tone, hooks with line breaks). Content MUST be adapted.
- **Skipping versioned headers:** Every LinkedIn API request MUST include `Linkedin-Version` and `X-Restli-Protocol-Version` headers — omitting them causes 400 errors.
- **Using ugcPosts API:** Deprecated. Use the Posts API (`/rest/posts`) for all content creation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom token exchange | Arctic `LinkedIn` provider | Handles state generation, code exchange, token refresh |
| PDF generation | Canvas-to-PDF or HTML-to-PDF | pdf-lib | Pure JS, no native deps, precise page control |
| Image resizing | Manual buffer manipulation | sharp (existing) | Already in project, handles LinkedIn image specs |
| Rate limit tracking | Custom retry logic | Reuse XClient pattern | Same exponential backoff + wait.until() pattern |

**Key insight:** The LinkedIn API is straightforward REST — the complexity is in the multi-step media uploads and versioned headers, not in the protocol itself. Raw fetch with typed helpers (same as XClient) is the right approach.

## Common Pitfalls

### Pitfall 1: LinkedIn Token 60-Day Expiry
**What goes wrong:** LinkedIn access tokens expire after 60 days (not 2 hours like X). Developers forget to track expiry and tokens silently expire.
**Why it happens:** 60 days feels "long enough" so monitoring gets deprioritized.
**How to avoid:** Store `expiresAt` in oauth_tokens table; token-refresher cron checks LinkedIn tokens with 7-day warning window (matching CONTEXT.md decision). Progressive warnings at 7/3/1 days.
**Warning signs:** 401 errors on LinkedIn API calls that worked recently.

### Pitfall 2: Organic Carousel Misconception
**What goes wrong:** Developers try to use the Carousel API for organic posts and get 403 errors.
**Why it happens:** LinkedIn has a Carousel API, but it's **sponsored-only**. Organic "carousels" are actually document posts (PDF pages).
**How to avoid:** Use Documents API with PDF upload for organic carousels. Only use Carousel API for paid/sponsored content.
**Warning signs:** 403 Forbidden when trying to create carousel content type organically.

### Pitfall 3: Missing Versioned Headers
**What goes wrong:** API calls return 400 or unexpected responses.
**Why it happens:** LinkedIn's REST API requires `Linkedin-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0` on every request. The version format is just YYYYMM (no day), and versions are sunset periodically.
**How to avoid:** Set headers in the client constructor, use a consistent version (202602 current), and monitor LinkedIn's deprecation notices.
**Warning signs:** 400 responses mentioning "version" or "protocol".

### Pitfall 4: Person URN vs Organization URN
**What goes wrong:** Personal posts fail because the wrong author URN format is used.
**Why it happens:** LinkedIn uses `urn:li:person:{id}` for personal posts and `urn:li:organization:{id}` for company page posts. The person ID comes from the OpenID Connect userinfo endpoint, not from the OAuth token directly.
**How to avoid:** Fetch and store the person URN during OAuth setup using `GET /v2/userinfo` (with `openid` scope). Store in oauth_tokens metadata.
**Warning signs:** 403 Forbidden on post creation.

### Pitfall 5: Multi-Platform Post Status Confusion
**What goes wrong:** A post shows "published" but LinkedIn actually failed, or "failed" but X actually succeeded.
**Why it happens:** Single status field can't represent per-platform outcomes.
**How to avoid:** Store per-platform status in post metadata: `{ platformStatus: { x: "published", linkedin: "failed" } }`. Overall post status = "published" if ANY platform succeeded.
**Warning signs:** Users confused about what actually posted where.

### Pitfall 6: LinkedIn Content Length Limits
**What goes wrong:** Posts get truncated or rejected.
**Why it happens:** LinkedIn commentary field has a 3000 character limit, but optimal length is 1000-1300 characters. Long posts get collapsed behind "...see more".
**How to avoid:** Content adapter enforces 1000-1300 char target for standard posts, allows up to 3000 for long-form. Format picker chooses carousel/article for content exceeding 1300 chars.
**Warning signs:** Low engagement on posts that are too long or truncated.

## Code Examples

### LinkedIn OAuth with Arctic v3
```typescript
// Source: https://arcticjs.dev/providers/linkedin
import { LinkedIn, generateState } from "arctic";

export function createLinkedInOAuthClient(config: LinkedInOAuthConfig): LinkedIn {
  return new LinkedIn(config.clientId, config.clientSecret, config.callbackUrl);
}

export function generateAuthUrl(client: LinkedIn): { url: string; state: string } {
  const state = generateState();
  const scopes = ["openid", "profile", "w_member_social", "r_member_postAnalytics"];
  const url = client.createAuthorizationURL(state, scopes);
  return { url: url.toString(), state };
}

export async function exchangeCode(client: LinkedIn, code: string) {
  const tokens = await client.validateAuthorizationCode(code);
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
    expiresAt: tokens.accessTokenExpiresAt(),
  };
}

export async function refreshAccessToken(client: LinkedIn, refreshToken: string) {
  const tokens = await client.refreshAccessToken(refreshToken);
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
    expiresAt: tokens.accessTokenExpiresAt(),
  };
}
```

### LinkedIn Post Creation (Text + Image)
```typescript
// Source: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
async createPost(params: {
  author: string; // urn:li:person:xxx
  commentary: string;
  visibility: "PUBLIC" | "CONNECTIONS";
  content?: { media: { id: string; altText?: string; title?: string } };
}) {
  const body = {
    author: params.author,
    commentary: params.commentary,
    visibility: params.visibility,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(params.content ? { content: params.content } : {}),
  };

  const { data } = await this.request("/rest/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  // Post ID returned in x-restli-id header
  return data;
}
```

### LinkedIn Analytics Collection
```typescript
// Source: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics
// Fetch per-post metrics using memberCreatorPostAnalytics
const metrics = ["IMPRESSION", "REACTION", "COMMENT", "RESHARE", "MEMBERS_REACHED"] as const;

for (const metric of metrics) {
  const response = await client.request(
    `/rest/memberCreatorPostAnalytics?q=entity&entity=(share:${encodedPostUrn})&queryType=${metric}&aggregation=TOTAL`,
    { method: "GET" },
    MemberPostAnalyticsSchema,
  );
  // Extract count from response.elements[0].count
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ugcPosts API | Posts API (`/rest/posts`) | 2024 migration | Must use Posts API; ugcPosts deprecated |
| Assets API for media | Images API + Documents API | 2024 | Separate APIs per media type with simpler flows |
| Unversioned endpoints | Versioned API (`Linkedin-Version: YYYYMM`) | 2023+ | Every request needs version header; versions sunset periodically |
| Company page access via basic app | Community Management API product | 2024+ | Need to apply for CM API access for org-level features |

**Deprecated/outdated:**
- ugcPosts API: Replaced by Posts API. Migration guide available.
- Assets API: Replaced by Images API and Documents API.
- `Share on LinkedIn` product for member posting: Still works via `w_member_social` (self-serve approval on Developer Portal).

## Open Questions

1. **LinkedIn partner API approval status**
   - What we know: Application should have been submitted in Phase 1 (roadmap requirement). `w_member_social` (posting) is available via self-serve. `r_member_postAnalytics` (analytics) is available via simple approval.
   - What's unclear: Whether the partner API approval has been received for org-level features (Company Hub Phase 7)
   - Recommendation: Proceed with personal-level APIs (self-serve) for Phase 6. Org-level features are Phase 7.

2. **LinkedIn API rate limits**
   - What we know: LinkedIn has per-endpoint rate limits, but specific numbers are not publicly documented — they vary by product/access level.
   - What's unclear: Exact requests-per-day for Community Management API posting + analytics
   - Recommendation: Build rate limit extraction from response headers (same pattern as XClient). Start conservative (100 requests/day posting, 500/day analytics). Adjust based on actual headers.

3. **Poll API access for personal accounts**
   - What we know: Poll posts are supported organically via the Posts API. The Poll API exists.
   - What's unclear: Whether `w_member_social` scope is sufficient for poll creation
   - Recommendation: Implement text/image/document first, add poll support as incremental feature if API access allows.

## Sources

### Primary (HIGH confidence)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-01) - Post creation, content types, request format, permissions
- [LinkedIn Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api?view=li-lms-2026-01) - Image upload flow, URN-based reference
- [LinkedIn Documents API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/documents-api?view=li-lms-2026-01) - Document/carousel upload, PDF support
- [LinkedIn Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2025-11) - Analytics metrics, per-post and aggregated
- [LinkedIn Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) - API products, permissions, self-serve vs partner
- [Arctic v3 - LinkedIn Provider](https://arcticjs.dev/providers/linkedin) - OAuth constructor, scopes, token exchange
- [pdf-lib](https://www.npmjs.com/package/pdf-lib) - PDF generation for carousel slides

### Secondary (MEDIUM confidence)
- [LinkedIn Algorithm 2026](https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now) - Document posts 3x engagement, format benchmarks
- [LinkedIn Post Dimensions 2026](https://postiz.com/blog/linkedin-post-dimensions) - Image/carousel sizing specs
- [LinkedIn Analytics Complete Guide](https://sproutsocial.com/insights/linkedin-analytics/) - Engagement benchmarks by format

### Tertiary (LOW confidence)
- LinkedIn API rate limits: Not publicly documented with specific numbers. Must extract from response headers at runtime.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Arctic confirmed LinkedIn support; Posts API well-documented with versioned examples
- Architecture: HIGH - Mirrors proven XClient pattern; multi-platform dispatch is straightforward per-platform isolation
- Pitfalls: HIGH - Official docs explicitly warn about versioned headers, organic carousel limitations, and ugcPosts deprecation

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (LinkedIn API version cycle is quarterly; current version 202602)
