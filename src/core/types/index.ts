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

export interface PostMetadata {
	triggerRunId?: string;
	scheduledTimezone?: string;
	threadTweetIds?: string[];
	failReason?: string;
	retryCount?: number;
	rateLimitResetAt?: string;
	watchdogRetryAt?: string;
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

export type { LinkedInOAuthConfig } from "../../platforms/linkedin/types.ts";
