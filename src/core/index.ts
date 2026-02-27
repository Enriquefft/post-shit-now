/**
 * Public API for src/core/
 *
 * Shared types, DB connection, and utilities used across Trigger.dev tasks,
 * platform handlers, and CLI commands.
 * Internal: schema, migration scripts, env utils, thread-splitter, timezone.
 */

// --- Core types (selective re-export — cross-module types excluded to prevent circular deps) ---
// DO NOT add: ApprovalAction, ApprovalStatus, MessageResult, NotificationEvent,
// NotificationEventType, NotificationPreference, NotificationTier, WhatsAppProvider,
// LinkedInOAuthConfig, HubConnection, HubRole, InviteCode, TeamMember
export type {
	HubConfig,
	Platform,
	PlatformPublishResult,
	PlatformStatus,
	PostMetadata,
	PostStatus,
	PostSubStatus,
	SetupResult,
	ThreadTweet,
	ValidationResult,
	ValidationSummary,
	XOAuthConfig,
} from "./types/index.ts";

// --- Publisher contract types ---
export type {
	DbConnection,
	PlatformPublisher,
	PostRow,
	RateLimitInfo,
} from "./types/publisher.ts";

// --- Database connection ---
export { createHubConnection } from "./db/connection.ts";
export type { DbClient, HubDb } from "./db/connection.ts";

// --- Crypto utilities ---
export { decrypt, encrypt, keyFromHex } from "./utils/crypto.ts";
