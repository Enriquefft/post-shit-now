export type Platform = "x" | "linkedin" | "instagram" | "tiktok";

export interface HubConfig {
	databaseUrl: string;
	triggerProjectRef: string;
	encryptionKey: string;
	apiKeys: Record<string, string>;
}

export interface SetupResult {
	step: string;
	status: "success" | "error" | "skipped" | "need_input";
	message: string;
	data?: Record<string, unknown>;
}

export interface ValidationResult {
	check: string;
	status: "pass" | "fail";
	message: string;
}

export interface ValidationSummary {
	allPassed: boolean;
	results: ValidationResult[];
}

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed" | "retry";

export type PostSubStatus =
	| "retry_1"
	| "retry_2"
	| "retry_3"
	| "rate_limited"
	| "media_uploading"
	| "media_uploaded"
	| "thread_partial"
	| null;

export interface PlatformPublishResult {
	platform: Platform;
	status: "published" | "failed" | "skipped";
	externalPostId?: string;
	error?: string;
}

export interface PlatformStatus {
	status: string;
	externalPostId?: string;
	error?: string;
	retryCount?: number;
}

export interface PostMetadata {
	triggerRunId?: string;
	scheduledTimezone?: string;
	threadTweetIds?: string[];
	failReason?: string;
	retryCount?: number;
	rateLimitResetAt?: string;
	watchdogRetryAt?: string;
	/** Per-platform publish status for multi-platform posts */
	platformStatus?: Record<string, PlatformStatus>;
	/** Group ID linking related cross-platform posts */
	multiPlatformGroupId?: string;
	/** LinkedIn-specific format override */
	linkedinFormat?: string;
	/** Generic format hint */
	format?: string;
	/** Topic for content generation */
	topic?: string;
	/** Content pillar */
	pillar?: string;
}

export interface ThreadTweet {
	position: number;
	content: string;
	charCount: number;
	mediaIds?: string[];
	platformPostId?: string;
	status: "pending" | "posted" | "failed";
}

export interface XOAuthConfig {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
}

export type { ApprovalAction, ApprovalStatus } from "../../approval/types.ts";
export type {
	MessageResult,
	NotificationEvent,
	NotificationEventType,
	NotificationPreference,
	NotificationTier,
	WhatsAppProvider,
} from "../../notifications/types.ts";
export type { LinkedInOAuthConfig } from "../../platforms/linkedin/types.ts";
// Phase 7: Team, Approval, Notification types
export type { HubConnection, HubRole, InviteCode, TeamMember } from "../../team/types.ts";
