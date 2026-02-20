// ─── Notification Tiers ─────────────────────────────────────────────────────

export type NotificationTier = "push" | "digest" | "standard";

// ─── Notification Event Types ───────────────────────────────────────────────

export type NotificationEventType =
	| "approval.requested"
	| "approval.result"
	| "post.failed"
	| "post.published"
	| "post.viral"
	| "token.expiring"
	| "digest.daily"
	| "digest.weekly"
	| "schedule.reminder";

// ─── Notification Routes ────────────────────────────────────────────────────

export const NOTIFICATION_ROUTES: Record<NotificationEventType, NotificationTier> = {
	"approval.requested": "push",
	"post.failed": "push",
	"token.expiring": "push",
	"post.viral": "push",
	"approval.result": "standard",
	"post.published": "standard",
	"schedule.reminder": "standard",
	"digest.daily": "digest",
	"digest.weekly": "digest",
} as const;

// ─── Notification Event ─────────────────────────────────────────────────────

export interface NotificationEvent {
	type: NotificationEventType;
	userId: string;
	hubId?: string;
	payload: Record<string, unknown>;
	createdAt: Date;
}

// ─── WhatsApp Provider ──────────────────────────────────────────────────────

export interface MessageResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

export interface WhatsAppProvider {
	sendText(to: string, body: string): Promise<MessageResult>;
	sendButtons(
		to: string,
		body: string,
		buttons: Array<{ id: string; body: string }>,
	): Promise<MessageResult>;
	sendList(
		to: string,
		body: string,
		sections: Array<{
			title: string;
			rows: Array<{ id: string; title: string; description?: string }>;
		}>,
	): Promise<MessageResult>;
	sendImage(to: string, imageUrl: string, caption?: string): Promise<MessageResult>;
}

// ─── Notification Preferences ───────────────────────────────────────────────

export interface NotificationPreference {
	userId: string;
	provider: "waha" | "twilio";
	pushEnabled: boolean;
	digestEnabled: boolean;
	digestFrequency: "daily" | "twice_daily" | "weekly";
	digestTime: string;
	quietHoursStart?: string;
	quietHoursEnd?: string;
	maxPushPerDay: number;
	timezone?: string;
}

// ─── Fatigue Limits ─────────────────────────────────────────────────────────

export const FATIGUE_LIMITS = {
	maxPushPerDay: 3,
	cooldownMinutes: 120,
	dedupWindowMinutes: 30,
	defaultQuietStart: "22:00",
	defaultQuietEnd: "08:00",
} as const;
