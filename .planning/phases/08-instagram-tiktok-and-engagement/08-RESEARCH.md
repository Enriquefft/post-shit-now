# Phase 8: Instagram, TikTok, and Engagement - Research

**Researched:** 2026-02-19
**Domain:** Platform APIs (Instagram Graph API, TikTok Content Posting API), OAuth 2.0, Engagement Monitoring
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Engagement Strategy
- Niche definition: derive topics from voice profile pillars as baseline, plus manual overrides to add/remove keywords
- Monitor all enabled platforms by default, with per-platform toggle to disable engagement monitoring independently
- Daily engagement caps are user-configurable per platform (set during /psn:setup or via config)
- Opportunity scoring: composite score — relevance (40%), recency (30%), reach (20%), engagement potential (10%)
- Runs as a scheduled Trigger.dev task every 2-4 hours, surfaces batched opportunities for review

#### Reply Drafting & Interaction
- Full spectrum engagement: comments/replies, quote posts, duets (TikTok), stitches, repost-with-commentary across all platforms
- Voice matching: context-adaptive — match the tone of the thread being replied to while keeping user's voice recognizable
- UX flow: triage-then-draft — first pass: quick yes/no on opportunities; second pass: draft and review replies for approved ones
- Engagement outcomes tracked and fed back into opportunity scoring model (same learning loop pattern as post analytics in Phase 4)

#### Instagram Content Handling
- Format selection: Claude auto-picks (Reel, carousel, feed image) based on content analysis, user can override during review
- Reels bias: Claude's discretion based on content type and performance data
- Rate limit budgeting (200 req/hr): Claude's discretion on allocation strategy
- Hashtag strategy: dynamic per post from a cached pool, pool refreshed weekly within the 30-search/week budget

#### TikTok Content Strategy
- Video-first: default to video content — TikTok's algorithm strongly favors video
- Audit fallback: draft-only mode until TikTok audit is approved — generate TikTok-optimized content as local drafts, user posts manually
- Monitoring: Creative Center (free) as default, EnsembleData (~$100/mo) available as premium upgrade
- Cross-posting: smart repurpose — repurpose video content (Reels → TikTok), but create text-based content natively per platform

### Claude's Discretion
- Instagram Reels vs carousel vs feed ratio optimization
- Rate limit budget allocation across posting/analytics/engagement
- Exact composite score weights tuning based on platform
- Engagement session UX details (batch sizes, triage presentation)
- TikTok chunked upload implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-03 | User can authenticate with Instagram via Facebook OAuth flow using Arctic library | Arctic supports Facebook provider; Instagram Platform API (direct login) is the better path — uses `instagram_business_basic` + `instagram_business_content_publish` scopes via graph.instagram.com endpoints |
| AUTH-04 | User can authenticate with TikTok via OAuth 2.0 flow using Arctic library | Arctic has native TikTok provider with PKCE support; scopes: `user.info.basic`, `video.list`, `video.publish`, `video.upload` |
| PLAT-03 | Instagram posting: feed images, carousels (up to 10), Reels, scheduling | Container-based workflow: `POST /{ig-user-id}/media` then `POST /{ig-user-id}/media_publish`; Reels via `media_type=REELS`; carousels via child containers + parent with `media_type=CAROUSEL` |
| PLAT-04 | TikTok posting: video, photos, scheduling | Content Posting API: `/v2/post/publish/content/init/` for photos + direct post; `/v2/post/publish/inbox/video/init/` for video with chunked upload |
| ANLYT-03 | Analytics collector pulls metrics from Instagram API daily (within 200 req/hr budget) | `GET /{ig-media-id}/insights` for impressions, reach, saves; `GET /{ig-user-id}/insights` for account-level metrics; must budget within 200 req/hr |
| ANLYT-04 | Analytics collector pulls metrics from TikTok API daily | TikTok `/v2/video/list/` returns video metrics (views, likes, comments, shares); requires `video.list` scope |
| POST-03 | User can generate a post for Instagram in their voice using /psn:post | Existing format-picker already handles Instagram formats (image-post, carousel, reel-script); extend content generation with Instagram-specific constraints (2200 char caption, 30 hashtags max) |
| POST-04 | User can generate a post for TikTok in their voice using /psn:post | Existing format-picker handles TikTok (video-post, reel-script); content gen creates video scripts + captions (4000 char max, 90 char title max) |
| ENGAGE-01 | Engagement monitor task checks for viral/trending posts in user's niche every 5-15 min during active hours | Scheduled Trigger.dev task (every 2-4 hours per decision); uses X search/timeline API, Instagram hashtag search (30/week budget), TikTok Creative Center scraping |
| ENGAGE-02 | Opportunities scored: relevance x author influence x post velocity x time window remaining | Composite scoring: relevance 40%, recency 30%, reach 20%, engagement potential 10% (locked decision); stored in basis points per existing pattern |
| ENGAGE-03 | Scores 60+: draft 2-3 reply options using voice profile's reply_style; 70+: push notify; 60-69: digest | Voice-matched reply drafting using content brain pattern; notification via existing WhatsApp/notification system from Phase 7 |
| ENGAGE-04 | User can run /psn:engage for proactive 15-minute engagement sessions | New slash command; triage-then-draft UX flow; Claude presents batched opportunities |
| ENGAGE-05 | Human approves every reply — never auto-post | Trigger.dev `wait.forToken` for approval gates in automated flows; slash command flow is inherently human-in-the-loop |
| ENGAGE-06 | Daily caps, cooldowns, and blocklists per platform enforced | New DB table for engagement config (caps, cooldowns, blocklists); checked before surfacing opportunities and before posting replies |
| ENGAGE-07 | After engagement session, Claude bridges to content creation ("Any of these conversations spark a post idea?") | Post-session analysis step in `/psn:engage` command; uses existing idea bank (`src/ideas/bank.ts`) to capture sparked ideas |
</phase_requirements>

## Summary

Phase 8 adds Instagram and TikTok as posting platforms and introduces a proactive engagement engine across all four platforms. The codebase already has well-established patterns for platform integration (OAuth via Arctic, raw fetch API clients, media upload pipelines, analytics collection, multi-platform dispatch) that directly extend to Instagram and TikTok. The engagement engine is the genuinely new capability.

**Instagram** has two OAuth paths: the traditional Facebook Login flow and the newer Instagram Platform API (direct login, launched July 2024). The direct login path is simpler for this project since users are individual creators, not agencies managing multiple accounts. It uses `graph.instagram.com` endpoints and eliminates the Facebook Page requirement. Content publishing uses a container-based workflow: create a media container, wait for processing, then publish. All three content types (feed images, carousels up to 10 items, Reels up to 90 seconds) are supported via the same two-step flow with different `media_type` parameters. Rate limit is 200 req/hr minimum with a dynamic formula: `4800 x (account impressions / 1000) per 24 hours`. Long-lived tokens expire in 60 days with a simple refresh endpoint.

**TikTok** uses Arctic's native provider with PKCE support. The Content Posting API supports both video (chunked upload for files > 5MB) and photos (via URL pull). A critical constraint: unaudited API clients can only post with `SELF_ONLY` visibility and allow max 5 users per 24 hours. The audit fallback (draft-only mode) is essential. TikTok's API has strict chunked upload rules: 5MB-64MB chunks, sequential upload, 1-hour upload URL validity. For analytics, the `video.list` endpoint returns engagement metrics directly.

**The engagement engine** is the most architecturally significant new piece. It requires: (1) a scheduled Trigger.dev task for monitoring trending content across platforms, (2) an opportunity scoring system, (3) a triage-then-draft UX flow in a new `/psn:engage` slash command, (4) per-platform engagement tracking with caps/cooldowns/blocklists, and (5) feedback loop integration with the existing learning system. The Trigger.dev `wait.forToken` pattern is available for human-in-the-loop approval in automated flows, though the primary `/psn:engage` command is inherently interactive.

**Primary recommendation:** Build Instagram and TikTok platform modules following the exact XClient/LinkedInClient pattern (raw fetch, Zod validation, rate limit tracking). Use Instagram Platform API direct login (not Facebook Login). Implement engagement engine as a new `src/engagement/` module with its own DB tables, Trigger.dev scheduled task, and slash command.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| arctic | ^3.7.0 | OAuth 2.0 for Instagram (via Facebook provider) and TikTok | Already in project; has native TikTok provider with PKCE; Facebook provider for Instagram direct login token exchange |
| @trigger.dev/sdk | ^4.3.3 | Scheduled engagement monitor, approval workflows | Already in project; `wait.forToken` enables human-in-the-loop; `schedules.task` for cron-based monitoring |
| zod | ^4.3.6 | API response validation | Already in project; consistent with XClient/LinkedInClient pattern |
| drizzle-orm | ^0.45.1 | DB schema for engagement tables | Already in project; RLS pattern established |
| sharp | ^0.34.5 | Image processing for Instagram content | Already in project; resize/format for Instagram requirements |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fal-ai/client | ^1.9.1 | Video generation for Reels/TikTok | Already in project; used for AI-generated video content |
| pdf-lib | ^1.17.1 | Carousel PDF generation (Instagram carousels as image sets, not PDFs) | Already in project; carousels on Instagram use image arrays, not PDFs like LinkedIn |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Instagram Platform API (direct login) | Facebook Login for Business | Facebook Login requires a Facebook Page connection; direct login is simpler for individual creators; both produce the same Graph API access |
| Raw fetch for TikTok API | node-tiktok-sdk | Unmaintained community SDK; raw fetch is consistent with project pattern (XClient, LinkedInClient) |
| TikTok Creative Center scraping | EnsembleData API ($100/mo) | Creative Center is free but fragile (scraping); EnsembleData is reliable but expensive; user decision: Creative Center default, EnsembleData as premium upgrade |

**Installation:**
```bash
# No new packages needed — all dependencies already in project
# Arctic already supports Facebook and TikTok providers
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── platforms/
│   ├── instagram/
│   │   ├── oauth.ts         # Arctic Facebook provider, Instagram direct login flow
│   │   ├── client.ts        # InstagramClient (raw fetch, container workflow)
│   │   ├── media.ts         # Container creation, Reels upload, carousel assembly
│   │   ├── hashtags.ts      # Hashtag pool management (30 searches/week budget)
│   │   └── types.ts         # Zod schemas for IG API responses
│   ├── tiktok/
│   │   ├── oauth.ts         # Arctic TikTok provider with PKCE
│   │   ├── client.ts        # TikTokClient (raw fetch, content posting)
│   │   ├── media.ts         # Chunked video upload, photo URL posting
│   │   ├── creative-center.ts # Free trending content scraper
│   │   └── types.ts         # Zod schemas for TikTok API responses
│   └── ... (existing x/, linkedin/)
├── engagement/
│   ├── monitor.ts           # Engagement opportunity discovery across platforms
│   ├── scoring.ts           # Composite opportunity scoring (relevance, recency, reach, potential)
│   ├── drafting.ts          # Voice-matched reply/comment generation
│   ├── session.ts           # Triage-then-draft session logic for /psn:engage
│   ├── tracker.ts           # Engagement outcome tracking + feedback loop
│   ├── config.ts            # Per-platform caps, cooldowns, blocklists
│   └── types.ts             # Engagement types and Zod schemas
├── trigger/
│   ├── engagement-monitor.ts # Scheduled task (every 2-4 hours)
│   └── ... (existing tasks)
└── ... (existing modules)
```

### Pattern 1: Instagram Container-Based Publishing
**What:** All Instagram content publishing follows a two-step container workflow
**When to use:** Every Instagram post (feed image, carousel, Reel)

```typescript
// Step 1: Create container
// POST https://graph.instagram.com/{ig-user-id}/media
const container = await createMediaContainer(accountId, accessToken, {
  // For feed image:
  image_url: publicImageUrl,
  caption: "Post caption with #hashtags",
  // For Reels:
  media_type: "REELS",
  video_url: publicVideoUrl,
  share_to_feed: true,
  // For carousel child:
  is_carousel_item: true,
  image_url: childImageUrl,
});

// Step 2: Wait for processing (poll status)
await waitForContainerReady(accountId, container.id, accessToken);

// Step 3: Publish
// POST https://graph.instagram.com/{ig-user-id}/media_publish
const media = await publishContainer(accountId, container.id, accessToken);
```

### Pattern 2: Instagram Carousel Assembly
**What:** Carousels require creating child containers first, then a parent container
**When to use:** Multi-image Instagram posts (2-10 items)

```typescript
// 1. Create child containers (images/videos) — NOT published individually
const childIds: string[] = [];
for (const imageUrl of imageUrls) {
  const child = await createMediaContainer(accountId, accessToken, {
    image_url: imageUrl,
    is_carousel_item: true,
  });
  await waitForContainerReady(accountId, child.id, accessToken);
  childIds.push(child.id);
}

// 2. Create parent carousel container referencing children
const carousel = await createMediaContainer(accountId, accessToken, {
  media_type: "CAROUSEL",
  caption: "Carousel caption",
  children: childIds, // comma-separated string of child IDs
});

// 3. Publish parent (publishes all children automatically)
await publishContainer(accountId, carousel.id, accessToken);
```

### Pattern 3: TikTok Chunked Video Upload
**What:** Videos > 5MB must use chunked upload with sequential PUT requests
**When to use:** All TikTok video uploads (most videos will exceed 5MB)

```typescript
// 1. Initialize upload
// POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/
const init = await initVideoUpload(accessToken, {
  source_info: {
    source: "FILE_UPLOAD",
    video_size: totalBytes,
    chunk_size: chunkSize, // 5MB-64MB
    total_chunk_count: Math.ceil(totalBytes / chunkSize),
  },
});

// 2. Upload chunks sequentially via PUT
for (let i = 0; i < totalChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize - 1, totalBytes - 1);
  await fetch(init.upload_url, {
    method: "PUT",
    headers: {
      "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
      "Content-Length": String(end - start + 1),
      "Content-Type": "video/mp4",
    },
    body: chunks[i],
  });
}
// upload_url is valid for 1 hour after issuance
```

### Pattern 4: TikTok Photo Posting (URL Pull)
**What:** TikTok photos are posted by providing publicly accessible URLs
**When to use:** TikTok photo content (up to 35 images per post)

```typescript
// POST https://open.tiktokapis.com/v2/post/publish/content/init/
const result = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
  },
  body: JSON.stringify({
    post_info: {
      title: "Photo title",          // max 90 UTF-16
      description: "Description",     // max 4000 UTF-16
      privacy_level: "PUBLIC_TO_EVERYONE", // or SELF_ONLY for unaudited
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: ["https://example.com/photo1.jpg"],
      photo_cover_index: 0,
    },
    post_mode: "DIRECT_POST",        // requires video.publish scope
    media_type: "PHOTO",
  }),
});
```

### Pattern 5: Instagram OAuth via Direct Login
**What:** Instagram Platform API uses its own OAuth endpoints (not Facebook OAuth)
**When to use:** Instagram authentication for this project

```typescript
// Arctic doesn't have a native Instagram provider, but the flow is straightforward:

// 1. Authorization URL
const authUrl = `https://api.instagram.com/oauth/authorize?` +
  `client_id=${appId}&redirect_uri=${redirectUri}` +
  `&scope=instagram_business_basic,instagram_business_content_publish` +
  `&response_type=code&state=${state}`;

// 2. Exchange code for short-lived token
// POST https://api.instagram.com/oauth/access_token
const shortToken = await exchangeCode(code);

// 3. Exchange for long-lived token (60 days)
// GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=...&access_token=...
const longToken = await exchangeForLongLived(shortToken);

// 4. Refresh long-lived token before expiry
// GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
const refreshed = await refreshToken(longToken);
```

**Note:** Since Arctic does not have a native Instagram provider, we implement the Instagram OAuth flow manually using raw fetch (consistent with project pattern). Arctic's Facebook provider could be used as a fallback for the traditional Facebook Login path, but the Instagram direct login path is simpler.

### Pattern 6: Engagement Monitor Scheduled Task
**What:** Trigger.dev scheduled task that discovers engagement opportunities
**When to use:** Every 2-4 hours during configured active hours

```typescript
export const engagementMonitor = schedules.task({
  id: "engagement-monitor",
  cron: "0 */3 * * *", // Every 3 hours
  maxDuration: 300,
  run: async () => {
    // 1. Load user config (enabled platforms, niche keywords from pillars)
    // 2. For each enabled platform, search for trending content in niche
    // 3. Score each opportunity (relevance 40%, recency 30%, reach 20%, potential 10%)
    // 4. Store scored opportunities in DB
    // 5. For score >= 70: trigger push notification
    // 6. For score 60-69: add to digest batch
    // 7. Enforce daily caps (skip if user has hit cap for platform)
  },
});
```

### Pattern 7: Triage-Then-Draft Engagement Session
**What:** Two-pass UX flow for efficient engagement
**When to use:** `/psn:engage` command

```
Pass 1 (Triage): Present 10-20 opportunities in summary form
  - Post snippet, author, platform, score
  - User: quick yes/no/skip on each
  - Fast scan, ~30 seconds per opportunity

Pass 2 (Draft): For approved opportunities (typically 3-5)
  - Claude drafts 2-3 reply options per opportunity
  - Voice-matched to thread tone + user's voice
  - Full spectrum: reply, quote post, repost-with-commentary
  - User reviews, edits, approves each reply

Post-Session: Bridge to content creation
  - "Any of these conversations spark a post idea?"
  - Capture ideas into idea bank
```

### Anti-Patterns to Avoid
- **Sharing Instagram tokens via Facebook Login when direct login works:** Direct login is simpler and avoids Facebook Page dependency for individual creators
- **Uploading all TikTok video chunks in parallel:** Chunks MUST be sequential per TikTok API requirement
- **Auto-posting engagement replies:** ENGAGE-05 explicitly requires human approval on every reply — never use automated posting for engagement
- **Using a single rate limit budget across all Instagram operations:** Separate budgets for posting, analytics, and engagement to prevent one operation from starving others
- **Treating TikTok as audited before passing audit:** Always default to SELF_ONLY visibility or draft-only mode until audit passes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Instagram OAuth token lifecycle | Custom token management | Manual raw fetch following Instagram's 3-step flow (short -> long -> refresh) | Instagram's token exchange is non-standard (not pure OAuth2); well-documented 3-step flow is simple enough |
| TikTok chunked upload | Custom binary splitter | Standard ArrayBuffer slicing with Content-Range headers | TikTok's chunked upload spec is strict but simple |
| Engagement opportunity scoring | ML model from scratch | Weighted composite score with configurable weights | Over-engineering; simple weighted scoring is effective and transparent |
| Hashtag research | Custom Instagram scraping | Instagram Hashtag Search API within 30/week budget | API is rate-limited but official and reliable |
| TikTok trend discovery (free tier) | Custom TikTok scraping | TikTok Creative Center public data + Apify scrapers as fallback | Creative Center is free and official; direct scraping is fragile |

**Key insight:** Both Instagram and TikTok APIs are well-documented with clear request/response patterns. The complexity is in the orchestration (container workflows, chunked uploads, rate limit budgeting), not in the individual API calls. The existing XClient/LinkedInClient pattern maps directly to these APIs.

## Common Pitfalls

### Pitfall 1: Instagram Container Processing Delays
**What goes wrong:** Publishing a container immediately after creation fails because Instagram hasn't finished processing the media
**Why it happens:** Container creation returns a container ID instantly, but the media (especially video/Reels) needs time to process
**How to avoid:** Poll `GET /{ig-container-id}?fields=status_code` until status is `FINISHED` before calling `media_publish`. Use the existing `waitForMediaReady` polling pattern from LinkedIn media upload.
**Warning signs:** `media_publish` returns error code 9007 (media not ready)

### Pitfall 2: Instagram 25-Post Daily Limit
**What goes wrong:** Hitting the 25 posts per 24 hours limit, causing all subsequent publishes to fail
**Why it happens:** Graph API enforces a hard limit of 25 published posts per business account per 24-hour rolling window. Carousels count as 1 post.
**How to avoid:** Track published count in DB; check before attempting to publish; surface remaining quota in `/psn:post` output
**Warning signs:** HTTP 400 with error about publishing limit

### Pitfall 3: TikTok Unaudited Client Restrictions
**What goes wrong:** Content posted via API is visible only to the creator (SELF_ONLY) and users are confused about why nobody can see their posts
**Why it happens:** Until the TikTok audit passes, all API-posted content has restricted visibility. Max 5 users per 24 hours can post.
**How to avoid:** Implement draft-only mode as default; clearly communicate audit status to user; provide manual posting instructions for drafts
**Warning signs:** Posts have zero views despite being "published"

### Pitfall 4: Instagram Hashtag Search Budget Exhaustion
**What goes wrong:** Running out of the 30 unique hashtag searches per 7-day rolling window too quickly
**Why it happens:** Each unique hashtag query counts toward the limit; the engagement monitor could burn through the budget in a day if not controlled
**How to avoid:** Cache hashtag results aggressively; batch searches weekly; use a pre-built hashtag pool that refreshes on a schedule; track remaining budget in DB
**Warning signs:** 429 errors on hashtag search endpoint

### Pitfall 5: TikTok Upload URL Expiry
**What goes wrong:** Chunked upload fails partway through because the upload URL expired
**Why it happens:** TikTok upload URLs are valid for only 1 hour after initialization. Large videos or slow connections can exceed this window.
**How to avoid:** Calculate expected upload time before starting; warn if estimated time > 45 minutes; implement retry with new initialization if URL expires
**Warning signs:** PUT request to upload URL returns 403 or 410

### Pitfall 6: Engagement Monitor Spamming APIs
**What goes wrong:** Engagement monitor burns through API rate limits meant for posting and analytics
**Why it happens:** Monitoring trending content requires frequent API calls; if not budgeted separately, it competes with posting/analytics
**How to avoid:** Allocate separate rate limit budgets per operation type; engagement monitor should use the lowest-priority budget; implement backoff when approaching limits
**Warning signs:** Token refresh or post publishing fails due to rate limits consumed by monitoring

### Pitfall 7: Instagram Reels vs Story Confusion
**What goes wrong:** Attempting to publish Stories via the API fails silently or with cryptic errors
**Why it happens:** The Instagram Platform API (direct login) supports Reels publishing but NOT Story publishing via the Content Publishing API. Some older docs suggest Stories are supported.
**How to avoid:** Only implement feed images, carousels, and Reels. Explicitly document that Stories are out of scope for API publishing.
**Warning signs:** Container creation succeeds but publishing fails for Story content

## Code Examples

### Instagram Client Pattern (following XClient/LinkedInClient)
```typescript
// Source: Instagram Graph API + project pattern
const GRAPH_BASE_URL = "https://graph.instagram.com";

export class InstagramClient {
  private accessToken: string;
  private accountId: string;

  constructor(accessToken: string, accountId: string) {
    this.accessToken = accessToken;
    this.accountId = accountId;
  }

  // Container creation for feed image
  async createImageContainer(imageUrl: string, caption: string): Promise<string> {
    const params = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${this.accountId}/media?${params.toString()}`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error(`Container creation failed: ${await response.text()}`);
    const json = await response.json();
    return json.id; // container ID
  }

  // Container creation for Reels
  async createReelsContainer(videoUrl: string, caption: string): Promise<string> {
    const params = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      share_to_feed: "true",
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${this.accountId}/media?${params.toString()}`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error(`Reels container creation failed: ${await response.text()}`);
    const json = await response.json();
    return json.id;
  }

  // Carousel: create child containers, then parent
  async createCarouselContainers(
    imageUrls: string[],
    caption: string
  ): Promise<string> {
    // Create children
    const childIds: string[] = [];
    for (const url of imageUrls) {
      const params = new URLSearchParams({
        image_url: url,
        is_carousel_item: "true",
        access_token: this.accessToken,
      });
      const response = await fetch(
        `${GRAPH_BASE_URL}/${this.accountId}/media?${params.toString()}`,
        { method: "POST" }
      );
      const json = await response.json();
      childIds.push(json.id);
    }

    // Create parent
    const params = new URLSearchParams({
      media_type: "CAROUSEL",
      caption,
      children: childIds.join(","),
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${this.accountId}/media?${params.toString()}`,
      { method: "POST" }
    );
    const json = await response.json();
    return json.id;
  }

  // Publish any container
  async publishContainer(containerId: string): Promise<string> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${this.accountId}/media_publish?${params.toString()}`,
      { method: "POST" }
    );
    if (!response.ok) throw new Error(`Publish failed: ${await response.text()}`);
    const json = await response.json();
    return json.id; // media ID
  }

  // Check container processing status
  async getContainerStatus(containerId: string): Promise<string> {
    const params = new URLSearchParams({
      fields: "status_code",
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${containerId}?${params.toString()}`,
      { method: "GET" }
    );
    const json = await response.json();
    return json.status_code; // FINISHED, IN_PROGRESS, ERROR
  }

  // Get media insights
  async getMediaInsights(mediaId: string): Promise<Record<string, number>> {
    const params = new URLSearchParams({
      metric: "impressions,reach,likes,comments,shares,saved",
      access_token: this.accessToken,
    });
    const response = await fetch(
      `${GRAPH_BASE_URL}/${mediaId}/insights?${params.toString()}`,
      { method: "GET" }
    );
    const json = await response.json();
    const metrics: Record<string, number> = {};
    for (const item of json.data ?? []) {
      metrics[item.name] = item.values?.[0]?.value ?? 0;
    }
    return metrics;
  }
}
```

### TikTok Client Pattern
```typescript
// Source: TikTok Content Posting API docs + project pattern
const TIKTOK_BASE_URL = "https://open.tiktokapis.com";

export class TikTokClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // Initialize video upload (returns upload URL for chunked PUT)
  async initVideoUpload(videoSize: number, chunkSize: number): Promise<{
    publishId: string;
    uploadUrl: string;
  }> {
    const response = await fetch(
      `${TIKTOK_BASE_URL}/v2/post/publish/inbox/video/init/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          source_info: {
            source: "FILE_UPLOAD",
            video_size: videoSize,
            chunk_size: chunkSize,
            total_chunk_count: Math.ceil(videoSize / chunkSize),
          },
        }),
      }
    );
    const json = await response.json();
    return {
      publishId: json.data.publish_id,
      uploadUrl: json.data.upload_url,
    };
  }

  // Post photos via URL pull
  async postPhotos(params: {
    title: string;
    description: string;
    photoUrls: string[];
    privacyLevel?: string;
    postMode?: "DIRECT_POST" | "MEDIA_UPLOAD";
  }): Promise<string> {
    const response = await fetch(
      `${TIKTOK_BASE_URL}/v2/post/publish/content/init/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title: params.title.slice(0, 90),
            description: params.description.slice(0, 4000),
            privacy_level: params.privacyLevel ?? "PUBLIC_TO_EVERYONE",
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: params.photoUrls.slice(0, 35),
            photo_cover_index: 0,
          },
          post_mode: params.postMode ?? "DIRECT_POST",
          media_type: "PHOTO",
        }),
      }
    );
    const json = await response.json();
    return json.data.publish_id;
  }

  // Get user's video list with metrics
  async getVideoList(cursor?: number, maxCount = 20): Promise<{
    videos: Array<{
      id: string;
      title: string;
      create_time: number;
      like_count: number;
      comment_count: number;
      share_count: number;
      view_count: number;
    }>;
    cursor: number;
    has_more: boolean;
  }> {
    const response = await fetch(
      `${TIKTOK_BASE_URL}/v2/video/list/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          max_count: maxCount,
          ...(cursor ? { cursor } : {}),
        }),
      }
    );
    const json = await response.json();
    return json.data;
  }
}
```

### Instagram OAuth (Direct Login) Flow
```typescript
// Source: Instagram Platform API documentation (July 2024+)
// NOTE: Arctic does NOT have a native Instagram provider.
// Implement manually following the project's raw fetch pattern.

const IG_AUTH_BASE = "https://api.instagram.com";
const IG_GRAPH_BASE = "https://graph.instagram.com";

export function generateInstagramAuthUrl(config: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: "instagram_business_basic,instagram_business_content_publish",
    response_type: "code",
    state: config.state,
  });
  return `${IG_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeInstagramCode(config: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{ accessToken: string; userId: string }> {
  // Step 1: Exchange code for short-lived token
  const response = await fetch(`${IG_AUTH_BASE}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: config.code,
    }),
  });
  const shortLived = await response.json();

  // Step 2: Exchange for long-lived token (60 days)
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: config.appSecret,
    access_token: shortLived.access_token,
  });
  const longResponse = await fetch(`${IG_GRAPH_BASE}/access_token?${params.toString()}`);
  const longLived = await longResponse.json();

  return {
    accessToken: longLived.access_token,
    userId: shortLived.user_id,
  };
}

export async function refreshInstagramToken(accessToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken,
  });
  const response = await fetch(`${IG_GRAPH_BASE}/refresh_access_token?${params.toString()}`);
  const json = await response.json();
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in, // seconds until expiry (~60 days)
  };
}
```

### TikTok OAuth via Arctic
```typescript
// Source: Arctic v3 docs - TikTok provider
import { TikTok, generateState, generateCodeVerifier } from "arctic";

export function createTikTokOAuthClient(config: {
  clientKey: string;
  clientSecret: string;
  callbackUrl: string;
}): TikTok {
  return new TikTok(config.clientKey, config.clientSecret, config.callbackUrl);
}

export function generateTikTokAuthUrl(client: TikTok): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const scopes = ["user.info.basic", "video.list", "video.publish", "video.upload"];
  const url = client.createAuthorizationURL(state, codeVerifier, scopes);
  return { url: url.toString(), state, codeVerifier };
}

export async function exchangeTikTokCode(
  client: TikTok,
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const tokens = await client.validateAuthorizationCode(code, codeVerifier);
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
    expiresAt: tokens.accessTokenExpiresAt(),
  };
}

export async function refreshTikTokToken(
  client: TikTok,
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const tokens = await client.refreshAccessToken(refreshToken);
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
    expiresAt: tokens.accessTokenExpiresAt(),
  };
}
```

### Engagement Opportunity Scoring
```typescript
// Following existing scoring pattern from src/analytics/scoring.ts

export interface EngagementOpportunity {
  id: string;
  platform: Platform;
  postId: string;
  postSnippet: string;
  authorHandle: string;
  authorFollowerCount: number;
  postMetrics: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  postedAt: Date;
  detectedAt: Date;
  relevanceScore: number;   // 0-100, how well it matches niche
  recencyScore: number;     // 0-100, how fresh the post is
  reachScore: number;       // 0-100, author influence
  potentialScore: number;   // 0-100, engagement velocity
  compositeScore: number;   // Weighted: relevance*0.4 + recency*0.3 + reach*0.2 + potential*0.1
  suggestedEngagement: "reply" | "quote" | "repost" | "duet" | "stitch" | "comment";
}

export function scoreOpportunity(raw: {
  relevance: number;
  recency: number;
  reach: number;
  potential: number;
}): number {
  return Math.round(
    raw.relevance * 0.4 +
    raw.recency * 0.3 +
    raw.reach * 0.2 +
    raw.potential * 0.1
  );
}
// Store in basis points (compositeScore * 100) per existing DB pattern
```

### DB Schema for Engagement
```typescript
// New tables for engagement tracking

export const engagementOpportunities = pgTable("engagement_opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull(),
  externalPostId: text("external_post_id").notNull(),
  authorHandle: text("author_handle").notNull(),
  authorFollowerCount: integer("author_follower_count"),
  postSnippet: text("post_snippet").notNull(),
  postUrl: text("post_url"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  compositeScoreBps: integer("composite_score_bps").notNull(), // basis points
  relevanceScoreBps: integer("relevance_score_bps").notNull(),
  recencyScoreBps: integer("recency_score_bps").notNull(),
  reachScoreBps: integer("reach_score_bps").notNull(),
  potentialScoreBps: integer("potential_score_bps").notNull(),
  status: text("status").notNull().default("pending"), // pending | triaged_yes | triaged_no | drafted | engaged | expired
  suggestedType: text("suggested_type"), // reply | quote | repost | duet | stitch | comment
  draftContent: text("draft_content"),
  engagedAt: timestamp("engaged_at", { withTimezone: true }),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("engagement_opportunities_isolation", {
    as: "permissive",
    to: hubUser,
    for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);

export const engagementConfig = pgTable("engagement_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().unique(),
  nicheKeywords: jsonb("niche_keywords").$type<string[]>(), // manual overrides + pillar-derived
  platformToggles: jsonb("platform_toggles").$type<Record<string, boolean>>(),
  dailyCaps: jsonb("daily_caps").$type<Record<string, number>>(), // per-platform
  cooldownMinutes: jsonb("cooldown_minutes").$type<Record<string, number>>(),
  blocklist: jsonb("blocklist").$type<string[]>(), // blocked handles
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("engagement_config_isolation", {
    as: "permissive",
    to: hubUser,
    for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);

export const engagementLog = pgTable("engagement_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  opportunityId: uuid("opportunity_id").notNull(),
  platform: text("platform").notNull(),
  engagementType: text("engagement_type").notNull(), // reply | quote | repost | duet | stitch | comment
  content: text("content").notNull(),
  externalReplyId: text("external_reply_id"), // platform-side ID of our reply
  outcome: jsonb("outcome").$type<{
    impressions?: number;
    likes?: number;
    replies?: number;
  }>(),
  engagedAt: timestamp("engaged_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  pgPolicy("engagement_log_isolation", {
    as: "permissive",
    to: hubUser,
    for: "all",
    using: sql`${table.userId} = current_setting('app.current_user_id')`,
    withCheck: sql`${table.userId} = current_setting('app.current_user_id')`,
  }),
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Instagram Facebook Login only | Instagram Platform API (direct login) | July 2024 | Eliminates Facebook Page requirement; simpler auth flow for individual creators |
| TikTok Share Video API | TikTok Content Posting API v2 | 2024 | New API with chunked upload, photo posting, direct post vs media upload modes |
| Instagram `video_views` metric | Deprecated in Graph API v21 | January 2025 | Use `plays` or `views` instead; non-Reels video_views removed |
| No Instagram Reels API | Reels publishing via `media_type=REELS` | Mid-2022 | Full Reels support up to 90 seconds |
| Instagram `instagram_basic` scope | `instagram_business_basic` scope | 2024+ | Scope renamed for Platform API; old scope deprecated but still works in Facebook Login path |

**Deprecated/outdated:**
- `instagram_basic` scope: Deprecated, replaced by `instagram_business_basic` (for direct login) or `pages_read_engagement` (for Facebook Login)
- `video_views` metric for non-Reels Instagram content: Deprecated in Graph API v21 (January 2025)
- TikTok Share Video API: Migrated to Content Posting API v2; old API deprecated
- `email_contacts`, `profile_views`, `website_clicks`, `phone_call_clicks`, `text_message_clicks` Instagram Insights metrics: Deprecated as of Graph API v21

## Open Questions

1. **Instagram Direct Login App Review**
   - What we know: Instagram Platform API requires app review for production use. Scopes `instagram_business_basic` and `instagram_business_content_publish` need approval.
   - What's unclear: Exact timeline for app review; whether development mode (test users) is sufficient for initial setup
   - Recommendation: Start with development mode (test users), submit for app review early; document the review process in setup guide

2. **TikTok Audit Timeline**
   - What we know: Unaudited clients post as SELF_ONLY visibility. Audit verifies ToS compliance.
   - What's unclear: How long the audit takes in practice (days? weeks?); what criteria TikTok uses
   - Recommendation: Implement draft-only mode as the safe default; make audit status visible in `/psn:setup`; provide clear instructions for submitting audit

3. **Instagram Rate Limit Dynamic Formula**
   - What we know: Rate limit is `4800 x (account impressions / 1000) per 24 hours` with minimum 200/hr
   - What's unclear: How to query current remaining rate budget; whether the formula applies to all endpoints or just publishing
   - Recommendation: Start conservative (200 req/hr assumption); implement adaptive budgeting based on observed rate limit headers

4. **TikTok Content Discovery Without EnsembleData**
   - What we know: Creative Center is free but has no official API; Apify scrapers exist but may break
   - What's unclear: Reliability of Creative Center scraping long-term; whether TikTok's Research API would be accessible for this use case
   - Recommendation: Implement Creative Center scraping with graceful degradation; track failures; upgrade path to EnsembleData when scraping becomes unreliable

5. **Engagement Reply Posting APIs**
   - What we know: X has reply-to-tweet API (already implemented in XClient); LinkedIn has comment API
   - What's unclear: Instagram comment API capabilities for replying to other users' posts; TikTok comment API availability
   - Recommendation: Research Instagram `POST /{ig-media-id}/comments` and TikTok comment endpoints during implementation; start with X and LinkedIn where APIs are well-understood

## Sources

### Primary (HIGH confidence)
- [Arctic v3 documentation](https://arcticjs.dev/) - Facebook and TikTok provider support, OAuth flow patterns
- [Arctic TikTok provider](https://arcticjs.dev/providers/tiktok) - Constructor, PKCE, token exchange, refresh
- [TikTok Content Posting API - Video Upload](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video) - Chunked upload spec, headers, rate limits
- [TikTok Content Posting API - Photo Post](https://developers.tiktok.com/doc/content-posting-api-reference-photo-post) - Photo posting endpoint, URL pull, privacy levels
- [TikTok Scopes Overview](https://developers.tiktok.com/doc/scopes-overview) - video.publish, video.upload, video.list scopes
- [Instagram Platform API Direct Login Guide](https://gist.github.com/PrenSJ2/0213e60e834e66b7e09f7f93999163fc) - Complete OAuth flow, container publishing, token lifecycle
- Trigger.dev SDK docs - `wait.forToken` human-in-the-loop pattern, `schedules.task` cron scheduling

### Secondary (MEDIUM confidence)
- [Instagram Graph API Complete Developer Guide 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/) - Insights endpoints, Reels publishing, rate limits
- [Instagram Reels API Guide](https://www.getphyllo.com/post/a-complete-guide-to-the-instagram-reels-api) - Reels container creation, publishing flow
- [API to Post to Instagram 2026](https://getlate.dev/blog/api-to-post-to-instagram) - Container workflow, carousel assembly, rate limits
- [EnsembleData Pricing](https://ensembledata.com/pricing) - $100/mo starting price, capabilities
- [TikTok Video List API](https://developers.tiktok.com/doc/tiktok-api-v2-video-list) - Video metrics endpoint

### Tertiary (LOW confidence)
- TikTok Creative Center scraping viability - Based on Apify marketplace listings and community tools; no official API stability guarantee
- Instagram `instagram_business_basic` scope availability - Some sources still reference deprecated `instagram_basic`; needs validation during implementation
- Exact Instagram app review timeline - Community reports vary from days to weeks

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project; Arctic confirmed for TikTok; Instagram uses raw fetch (project pattern)
- Architecture: HIGH - Direct extension of XClient/LinkedInClient pattern; container workflows well-documented
- Instagram API specifics: MEDIUM-HIGH - Container workflow is well-documented; direct login path is newer but multiple sources confirm it
- TikTok API specifics: MEDIUM-HIGH - Official docs are authoritative; chunked upload rules are strict but clear
- Engagement engine: MEDIUM - Novel feature in this codebase; scoring/monitoring patterns are standard but untested in this context
- Pitfalls: HIGH - Common issues well-documented across multiple sources; rate limit constraints are well-known

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — APIs are stable, but Instagram/TikTok may update endpoints)
