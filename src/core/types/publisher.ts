import type { createHubConnection } from "../db/connection.ts";
import type { posts } from "../db/schema.ts";
import type { Platform, PlatformPublishResult } from "./index.ts";

/**
 * Database connection type alias for platform handlers.
 * Uses the HTTP driver connection — suitable for Trigger.dev tasks and serverless.
 */
export type DbConnection = ReturnType<typeof createHubConnection>;

/**
 * Row type inferred directly from the posts schema table.
 * Single source of truth — kept in sync with schema changes automatically.
 */
export type PostRow = typeof posts.$inferSelect;

/**
 * Rate limit information returned from platform APIs.
 *
 * All platform APIs expose some form of rate limiting; this struct
 * normalizes the representation so the orchestrator can apply a
 * unified back-off strategy regardless of platform.
 */
export interface RateLimitInfo {
	/** Total requests allowed per window */
	limit: number;
	/** Requests remaining in the current window */
	remaining: number;
	/** When the window resets and the remaining count refills */
	resetAt: Date;
}

/**
 * PlatformPublisher defines the publish contract for all platform handlers.
 *
 * Every platform handler (X, LinkedIn, Instagram, TikTok) MUST implement
 * this interface. The orchestrator depends exclusively on this contract —
 * it never calls platform-specific methods directly.
 *
 * ## Behavioral contracts
 *
 * ### Preconditions (caller's responsibility)
 * - The OAuth access token stored in the database is decrypted and valid
 * - Post content is non-empty and meets platform character limits
 * - Media URLs (if any) are publicly reachable or already uploaded
 * - The encryption key `encKey` matches the one used to encrypt tokens
 *
 * ### Postconditions (handler's responsibility)
 * - `publish()` always returns a `PlatformPublishResult` — never throws on
 *   "expected" failures (content policy, duplicate, skipped)
 * - Rate limit errors ARE thrown so the orchestrator can schedule retries
 * - Credentials are refreshed transparently before publish when expired
 * - State mutations (token refresh) are persisted to `db` before returning
 *
 * ### Error handling
 * - Rate limit errors: throw `Error` with message starting `"RATE_LIMIT:"`
 * - Auth errors (non-refreshable): throw `Error` with `"AUTH_EXPIRED:"`
 * - Unexpected errors: throw the underlying error as-is
 *
 * ### Thread safety
 * - Handlers are instantiated per-publish-run — no shared mutable state
 *   between concurrent Trigger.dev tasks
 */
export interface PlatformPublisher {
	/**
	 * Publish a post to the platform.
	 *
	 * @precondition OAuth token is decrypted and valid (or will be refreshed)
	 * @precondition `post.content` is non-empty and within platform limits
	 * @postcondition Returns `{ status: "published", externalPostId }` on success
	 * @postcondition Returns `{ status: "skipped" }` for posts that should not publish
	 * @postcondition Returns `{ status: "failed", error }` for non-retryable errors
	 * @postcondition On thread partial failure, checkpoint is persisted before throwing (enables resume on retry)
	 * @throws Error starting with "RATE_LIMIT:" when rate limited (for orchestrator retry)
	 * @throws Error starting with "AUTH_EXPIRED:" when credentials cannot be refreshed
	 * @throws Implementations may throw SkipRetryError internally for duplicate detection (Error 187) -- callers see recovered tweet IDs, not the error
	 * @sideeffect Saves thread checkpoint to DB after each successful tweet in a thread
	 * @sideeffect Sets post subStatus to "thread_partial" during thread posting
	 * @sideeffect Sets post subStatus to "media_uploading"/"media_uploaded" during media upload
	 *
	 * @param db - Active database connection for reading/writing post and token data
	 * @param post - The post row from the database to publish
	 * @param encKey - AES-256 encryption key for decrypting stored OAuth tokens
	 * @returns PlatformPublishResult with status and optional externalPostId
	 */
	publish(
		db: DbConnection,
		post: PostRow,
		encKey: Buffer,
	): Promise<PlatformPublishResult>;

	/**
	 * Validate that stored credentials are still usable.
	 *
	 * Implementations should make a lightweight API call (e.g., "verify credentials"
	 * or "get me") to confirm the token is accepted by the platform. This is
	 * used by health-check tasks — not called before every publish.
	 *
	 * @sideeffect None -- read-only API call
	 * @returns true if the platform accepts the current credentials, false otherwise
	 */
	validateCredentials(): Promise<boolean>;

	/**
	 * Get current rate limit state for this handler instance.
	 *
	 * Returns the rate limit info parsed from the most recent API response headers.
	 * Returns null if no API call has been made yet or the platform does not
	 * expose rate limit headers.
	 *
	 * @returns RateLimitInfo populated from last API response, or null if unavailable
	 */
	getRateLimitInfo(): RateLimitInfo | null;

	/**
	 * Refresh OAuth credentials using the stored refresh token.
	 *
	 * Fetches a new access token from the platform's token endpoint and
	 * persists both the new access token and (if rotated) refresh token
	 * to the database before returning.
	 *
	 * @precondition A valid refresh token exists in the database for this user/platform
	 * @postcondition New access token is persisted to `db` before returning
	 * @sideeffect Persists new access token (and rotated refresh token) to DB before returning
	 * @throws Error if no refresh token is stored
	 * @throws Error if the platform rejects the refresh request (e.g., token revoked)
	 *
	 * @param db - Active database connection for reading refresh token and writing new tokens
	 * @param encKey - AES-256 encryption key for decrypting/re-encrypting tokens
	 */
	refreshCredentials(db: DbConnection, encKey: Buffer): Promise<void>;

	/**
	 * Check whether the handler is currently in a rate-limited state.
	 *
	 * Implementations should track the `resetAt` timestamp from the last
	 * rate limit response and return true until that time has passed.
	 *
	 * @returns true if the platform is currently rate limited and calls should wait
	 */
	isRateLimited(): boolean;

	/**
	 * Get the number of seconds to wait before retrying after a rate limit.
	 *
	 * The orchestrator uses this to schedule retry tasks at the right time.
	 * Returns 0 (not a positive number) when not currently rate limited.
	 *
	 * @returns Seconds to wait before the next publish attempt, or 0 if not rate limited
	 */
	getRetryAfter(): number;
}

/** Re-export Platform for handler convenience — avoids double imports */
export type { Platform };
