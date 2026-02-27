## Ownership

This module owns all platform-specific publish logic. It is responsible for: implementing the PlatformPublisher contract for X, LinkedIn, Instagram, and TikTok; maintaining platform clients and OAuth flows; exposing the handler factory pattern. It is NOT responsible for: deciding which platforms a post targets (that is the orchestrator's job in `src/trigger/`); storing analytics or post records (that is `src/core/db/`); or generating content (that is `src/voice/`).

## Key Files

**Handler layer (public API surface)**

- `handlers/index.ts` — internal barrel; importing this file registers all four handlers as a side-effect, enabling the factory to resolve them
- `handlers/x.handler.ts` — X (Twitter) platform handler implementing PlatformPublisher
- `handlers/linkedin.handler.ts` — LinkedIn handler supporting text, document, image, and article formats
- `handlers/instagram.handler.ts` — Instagram handler for reels, carousels, and images via container workflow
- `handlers/tiktok.handler.ts` — TikTok handler for video upload and photo post formats

**X platform**

- `x/client.ts` — HTTP client for the X v2 API (tweets, threads, media)
- `x/media.ts` — media upload helpers for X (images, videos)
- `x/oauth.ts` — OAuth 2.0 PKCE flow for X user tokens
- `x/types.ts` — X-specific request/response types

**LinkedIn platform**

- `linkedin/client.ts` — HTTP client for the LinkedIn API (UGC posts, documents)
- `linkedin/carousel.ts` — carousel document builder (slide assembly, PDF generation)
- `linkedin/media.ts` — media upload helpers for LinkedIn
- `linkedin/oauth.ts` — LinkedIn OAuth 2.0 flow and token refresh
- `linkedin/types.ts` — LinkedIn-specific types including LinkedInOAuthConfig

**Instagram platform**

- `instagram/client.ts` — HTTP client for the Instagram Graph API
- `instagram/media.ts` — container workflow helpers (create, wait, publish)
- `instagram/hashtags.ts` — hashtag research and selection helpers
- `instagram/oauth.ts` — Facebook/Instagram OAuth flow
- `instagram/types.ts` — Instagram-specific types

**TikTok platform**

- `tiktok/client.ts` — HTTP client for the TikTok Content Posting API
- `tiktok/media.ts` — video chunk upload and initialization helpers
- `tiktok/creative-center.ts` — TikTok Creative Center trend data client
- `tiktok/oauth.ts` — TikTok OAuth 2.0 flow
- `tiktok/types.ts` — TikTok-specific types
