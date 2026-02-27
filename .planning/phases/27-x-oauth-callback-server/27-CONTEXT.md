---
phase: 27
name: X OAuth Callback Server
requirement_ids:
  - OAUTH-01
  - OAUTH-02
  - OAUTH-03
  - OAUTH-04
created_at: 2026-02-27
---

# Phase 27: X OAuth Callback Server — Context & Decisions

## Phase Goal

Users complete X OAuth authorization automatically by capturing the authorization code via a localhost callback server (`http://127.0.0.1:18923/callback`) instead of manually copying the code from the browser redirect URL.

---

## Requirements Overview

| ID | What | Status |
|----|------|--------|
| **OAUTH-01** | Callback server captures authorization code automatically via localhost (127.0.0.1:18923) | Pending |
| **OAUTH-02** | Callback URL is a single constant, reused by all code paths | Pending |
| **OAUTH-03** | OAuth state parameter is validated to prevent CSRF attacks | Pending |
| **OAUTH-04** | Fallback to manual code entry if port 18923 is unavailable | Pending |

---

## Architecture Decisions

### 1. Callback UX Flow

**User journey:**
1. Terminal prints "Opening X authorization..." + spins up server
2. Browser auto-opens (using `open` / `xdg-open`) pointing to X OAuth URL
3. User authorizes in browser
4. Browser redirects to `http://127.0.0.1:18923/callback?code=...&state=...`
5. Callback server captures code, validates state, responds with success HTML page
6. Terminal spinner stops, shows "Authorization complete! Code captured."
7. Setup continues to token exchange

**Implementation details:**
- **Browser opening:** Automatic via `open` (macOS) / `xdg-open` (Linux) / `start` (Windows). Falls back to printing URL if headless or in SSH session.
- **Success page:** Minimal HTML: "Authorization complete! You can close this tab." Browser auto-closes after 3 seconds (or user closes manually).
- **Terminal feedback:** "Waiting for authorization... (press Ctrl+C to cancel)" with a spinner (dots or animated text).
- **Timeout:** 2 minutes. If no callback received, gracefully degrade to manual code entry prompt.

**Rationale:** Auto-opening the browser + auto-capturing the code eliminates the most friction point in the current OAuth flow (copy-paste). The 2-minute timeout balances UX (enough time to log in + 2FA) with cleanup (no zombie servers).

---

### 2. Port & URL Handling

**Fixed port:** 127.0.0.1:18923 (per OAUTH-01). Not configurable, not dynamic.

**Callback URL constant:**
- **Location:** `src/platforms/x/oauth.ts` (single source of truth per OAUTH-02)
- **Value:** `http://127.0.0.1:18923/callback`
- **Usage:** Both `setup-x-oauth.ts` and the callback server import this constant

**Fallback if port is taken:**
- Try to bind to port 18923
- If bind fails (EADDRINUSE), gracefully degrade to manual code entry flow
  - Print the auth URL
  - Prompt: "Port 18923 is in use. Paste the authorization code from the redirect URL:"
  - Wait for user input
  - Continue with token exchange
- **Rationale:** Manual fallback is simple, always works, and uses the same token exchange flow downstream

**URL choice (127.0.0.1 vs localhost):**
- Use **127.0.0.1** (not `localhost`)
- Avoids DNS resolution issues (some systems resolve `localhost` to IPv6 ::1)
- X Developer Portal treats 127.0.0.1 as a reliable loopback address

---

### 3. Server Lifecycle

**Architecture:** Standalone module at `src/cli/oauth-callback-server.ts`

**Rationale:** Enables reuse for LinkedIn/Instagram/TikTok OAuth callbacks (OAUTH-05 in backlog). Clean separation from `setup-x-oauth.ts`.

**Server behavior:**
- Started by `setupXOAuth()` in `setup-x-oauth.ts`
- Listens on `http://127.0.0.1:18923`
- Handles **only** `/callback` requests with valid state parameter (OAUTH-03 validation)
- Ignores other requests (favicon, robots.txt, etc.) — does not respond to non-callback paths
- On first valid `/callback` hit:
  1. Validate state parameter matches what was generated (CSRF check — OAUTH-03)
  2. Extract authorization code
  3. Send success HTML response to browser
  4. Close server cleanly (respond then shut down)
  5. Resolve promise with `{ code, state }` for token exchange
- **Timeout:** 2 minutes with no callback → timeout fires, promise resolves with error, setup degrades to manual code entry
- **Error handling:** Network errors or unexpected request formats are silently ignored (only /callback with state passes validation)

**Rationale:** First-valid-callback-only prevents duplicate processing and favicon noise. Respond-then-shutdown ensures the browser shows the success page before cleanup.

---

### 4. Developer Portal Setup

**User flow (new setup):**

1. `setupXOAuth()` checks for X_CLIENT_ID and X_CLIENT_SECRET in keys.env
2. If missing, show instructions including:
   ```
   Set Callback URL in X Developer Portal to:
   http://127.0.0.1:18923/callback
   ```
3. After credentials are provided:
   - Query X API (using app credentials) to fetch the app's registered callback URL
   - **Block** if it doesn't match `http://127.0.0.1:18923/callback`
   - Show error: "X Developer Portal callback URL must be http://127.0.0.1:18923/callback. Update it in your app settings and try again."
4. If callback URL matches, proceed to authorize

**Existing setups (upgrade):**
- **No migration help provided**
- Assume users who upgrade know to update their Developer Portal callback URL manually
- If they don't, the validation block at step 3 will tell them

**Rationale:** Validation by API call (not manual prompts) is strict and prevents silent failures downstream. No migration help keeps setup simple for new users; existing users are power users who can figure it out.

---

## Technical Notes

### CSRF Protection (OAUTH-03)

- X generates a `state` parameter in the auth URL (done in `generateAuthUrl`)
- Callback server validates incoming `state` matches the stored value
- Reject callback if state mismatch (potential CSRF or replay attack)
- Implementation: Simple string comparison in callback handler

### Error Messages

All error messages should be user-friendly and actionable:
- ❌ "Port 18923 is in use" → Include manual fallback instructions
- ❌ "Callback URL mismatch" → Show expected URL + link to Developer Portal
- ❌ "Timed out" → Offer manual code entry immediately

---

## Implementation Constraints

- **No new dependencies** — use Node built-in `http` module for the server
- **Type safety** — all callback handler logic must be TypeScript with proper error types
- **Testing scope** — Phase 29 (Testing Infrastructure) will add integration tests
- **Logging** — use existing logger for server events (startup, callback received, timeout, fallback)

---

## Next Steps

1. **Research** (gsd-project-researcher): Validate OAuth callback patterns in X API docs, check Node http best practices for localhost servers
2. **Planning** (gsd-planner): Break into tasks (callback server module, integration with setup-x-oauth.ts, manual fallback flow)
3. **Execution** (gsd-executor): Implement, commit atomically, create SUMMARY.md
4. **Verification** (gsd-verifier): Confirm all 4 requirements (OAUTH-01 through OAUTH-04) are met
