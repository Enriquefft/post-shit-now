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
