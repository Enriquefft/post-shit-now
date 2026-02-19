---
phase: 06-linkedin-and-multi-platform
plan: 01
subsystem: platform
tags: [linkedin, oauth, arctic, api-client, media-upload, carousel, pdf-lib, token-refresher]

requires:
  - phase: 05-06
    provides: "Multi-platform planning slots"
provides:
  - "LinkedIn OAuth 2.0 (Arctic, state-only)"
  - "LinkedInClient with all content types"
  - "Image and document media upload"
  - "Carousel PDF generation (pdf-lib)"
  - "Token refresher extended for LinkedIn 60-day lifecycle"
affects: [06-02, phase-7, phase-8]

requirements-completed: [AUTH-02]

duration: ~8min
completed: 2026-02-19
---

# Plan 06-01 Summary: LinkedIn OAuth, API Client, Media Upload, Token Refresher

## Status: Complete

## What Was Built

### Task 1: LinkedIn Types, OAuth Module, and Setup Integration
- **`src/platforms/linkedin/types.ts`** — LinkedInOAuthConfig, Zod schemas for all API responses (post create, image upload, document upload, analytics, userinfo), LinkedInApiError and LinkedInRateLimitError error classes
- **`src/platforms/linkedin/oauth.ts`** — Arctic LinkedIn OAuth 2.0 (state-only, no PKCE). Functions: createLinkedInOAuthClient, generateAuthUrl, exchangeCode, refreshAccessToken. Scopes: openid, profile, w_member_social, r_member_postAnalytics
- **`src/cli/setup-linkedin-oauth.ts`** — LinkedIn OAuth setup step mirroring X OAuth pattern. Fetches person URN via OpenID Connect userinfo. Stores encrypted tokens with personUrn in metadata
- **`src/cli/setup.ts`** — Added conditional LinkedIn OAuth step (optional, skips gracefully if no credentials)
- **`src/core/types/index.ts`** — Re-exports LinkedInOAuthConfig

### Task 2: LinkedIn API Client, Media Upload, and Carousel PDF
- **`src/platforms/linkedin/client.ts`** — LinkedInClient class with typed methods for all content types (text, image, document, multi-image, article). Versioned headers (LinkedIn-Version, X-Restli-Protocol-Version). Post ID from x-restli-id response header. Analytics methods for memberCreatorPostAnalytics
- **`src/platforms/linkedin/media.ts`** — Two-step initialize-then-upload flow for both images and documents. waitForMediaReady polls until AVAILABLE status
- **`src/platforms/linkedin/carousel.ts`** — PDF generation for organic carousels using pdf-lib. 1080x1080 square pages with title, body text wrapping, optional embedded images, slide numbers

### Task 3: Token Refresher Extension
- **`src/trigger/token-refresher.ts`** — Extended to handle both X and LinkedIn tokens. Platform-specific refresh windows: X 1 day, LinkedIn 7 days. Progressive warning logs at 7/3/1 days before LinkedIn expiry. Lazy OAuth client construction

## Truths Verified
1. User can authenticate with LinkedIn via OAuth 2.0 and receive encrypted tokens stored in Hub DB
2. LinkedIn tokens auto-refresh before 60-day expiry via existing token-refresher cron
3. User can create text posts, image posts, and document/carousel posts on LinkedIn via API
4. LinkedIn image and document upload follows initialize-then-upload two-step flow

## Commits
- `32bd6fa` feat(06-01): LinkedIn types, OAuth module, and setup integration
- `e7fdd60` feat(06-01): LinkedIn API client, media upload, and carousel PDF generation
- `33c4f2f` feat(06-01): extend token-refresher for LinkedIn 60-day token lifecycle
