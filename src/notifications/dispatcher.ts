import { sql } from "drizzle-orm";
import type { createHubConnection } from "../core/db/connection.ts";
import { notificationLog, notificationPreferences, teamMembers } from "../core/db/schema.ts";
import type {
	NotificationEvent,
	NotificationPreference,
	NotificationTier,
	WhatsAppProvider,
	NOTIFICATION_ROUTES,
} from "./types.ts";
import { NOTIFICATION_ROUTES as ROUTES, FATIGUE_LIMITS } from "./types.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

type DrizzleClient = ReturnType<typeof createHubConnection>;

export interface DispatchResult {
	sent: boolean;
	tier: NotificationTier;
	downgraded?: boolean;
	reason?: string;
	messageId?: string;
}

interface FatigueCheckResult {
	allowed: boolean;
	reason?: string;
}

interface FormattedMessage {
	body: string;
	buttons?: Array<{ id: string; body: string }>;
}

// ─── Dispatch Engine ───────────────────────────────────────────────────────

export async function dispatchNotification(params: {
	db: DrizzleClient;
	provider: WhatsAppProvider;
	event: NotificationEvent;
	preferences: NotificationPreference;
	recipient: string; // phone number
}): Promise<DispatchResult> {
	const { db, provider, event, preferences, recipient } = params;
	const tier = ROUTES[event.type];

	// Digest-tier events just get queued
	if (tier === "digest") {
		await db.execute(sql`
			INSERT INTO notification_log (user_id, event_type, tier, provider, recipient, status, dedup_key, created_at)
			VALUES (${event.userId}, ${event.type}, 'digest', ${preferences.provider}, ${recipient}, 'queued',
				${buildDedupKey(event)}, NOW())
		`);
		return { sent: false, tier: "digest", reason: "queued for digest" };
	}

	// Check fatigue limits for push-tier events
	if (tier === "push") {
		if (!preferences.pushEnabled) {
			return { sent: false, tier: "push", reason: "push disabled" };
		}

		const fatigue = await checkFatigueLimits(db, {
			userId: event.userId,
			tier: "push",
			eventType: event.type,
			dedupKey: buildDedupKey(event),
		});

		if (!fatigue.allowed) {
			// Downgrade to digest
			await db.execute(sql`
				INSERT INTO notification_log (user_id, event_type, tier, provider, recipient, status, dedup_key, created_at)
				VALUES (${event.userId}, ${event.type}, 'digest', ${preferences.provider}, ${recipient}, 'queued',
					${buildDedupKey(event)}, NOW())
			`);
			return { sent: false, tier: "push", downgraded: true, reason: fatigue.reason };
		}

		// Check quiet hours
		if (isQuietHours(preferences)) {
			await db.execute(sql`
				INSERT INTO notification_log (user_id, event_type, tier, provider, recipient, status, dedup_key, created_at)
				VALUES (${event.userId}, ${event.type}, 'push', ${preferences.provider}, ${recipient}, 'queued',
					${buildDedupKey(event)}, NOW())
			`);
			return { sent: false, tier: "push", reason: "quiet hours - held for later" };
		}
	}

	// Format and send the message
	const formatted = formatNotificationMessage(event);
	let result;

	if (formatted.buttons && formatted.buttons.length > 0) {
		result = await provider.sendButtons(recipient, formatted.body, formatted.buttons);
	} else {
		result = await provider.sendText(recipient, formatted.body);
	}

	// Log the notification
	await db.execute(sql`
		INSERT INTO notification_log (user_id, event_type, tier, provider, recipient, status, message_id, dedup_key, sent_at, created_at)
		VALUES (${event.userId}, ${event.type}, ${tier}, ${preferences.provider}, ${recipient},
			${result.success ? "sent" : "failed"},
			${result.messageId ?? null},
			${buildDedupKey(event)},
			${result.success ? sql`NOW()` : sql`NULL`},
			NOW())
	`);

	return {
		sent: result.success,
		tier,
		messageId: result.messageId,
		reason: result.error,
	};
}

// ─── Fatigue Limits ────────────────────────────────────────────────────────

export async function checkFatigueLimits(
	db: DrizzleClient,
	params: { userId: string; tier: string; eventType: string; dedupKey: string },
): Promise<FatigueCheckResult> {
	const { userId, tier, dedupKey } = params;

	// Check 1: Daily push count < maxPushPerDay
	const dailyCountResult = await db.execute(sql`
		SELECT COUNT(*)::int as count FROM notification_log
		WHERE user_id = ${userId}
		  AND tier = 'push'
		  AND status = 'sent'
		  AND sent_at > CURRENT_DATE
	`);
	const dailyCount = (dailyCountResult.rows[0] as { count: number }).count;
	if (dailyCount >= FATIGUE_LIMITS.maxPushPerDay) {
		return { allowed: false, reason: "daily limit reached" };
	}

	// Check 2: Cooldown - no push in last N minutes
	const cooldownResult = await db.execute(sql`
		SELECT MAX(sent_at) as last_sent FROM notification_log
		WHERE user_id = ${userId}
		  AND tier = 'push'
		  AND status = 'sent'
	`);
	const lastSent = (cooldownResult.rows[0] as { last_sent: Date | null }).last_sent;
	if (lastSent) {
		const minutesSince = (Date.now() - new Date(lastSent).getTime()) / (1000 * 60);
		if (minutesSince < FATIGUE_LIMITS.cooldownMinutes) {
			return { allowed: false, reason: "cooldown active" };
		}
	}

	// Check 3: Dedup - no same event in last 30 minutes
	const dedupResult = await db.execute(sql`
		SELECT COUNT(*)::int as count FROM notification_log
		WHERE user_id = ${userId}
		  AND dedup_key = ${dedupKey}
		  AND created_at > NOW() - INTERVAL '${sql.raw(String(FATIGUE_LIMITS.dedupWindowMinutes))} minutes'
	`);
	const dedupCount = (dedupResult.rows[0] as { count: number }).count;
	if (dedupCount > 0) {
		return { allowed: false, reason: "duplicate" };
	}

	return { allowed: true };
}

// ─── Quiet Hours ───────────────────────────────────────────────────────────

export function isQuietHours(preferences: NotificationPreference): boolean {
	const start = preferences.quietHoursStart;
	const end = preferences.quietHoursEnd;

	if (!start || !end) return false;

	// Get current time in user's timezone (or UTC)
	const now = new Date();
	const formatter = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: (preferences as NotificationPreference & { timezone?: string }).timezone ?? "UTC",
	});
	const currentTime = formatter.format(now); // "HH:MM"

	const startMinutes = parseTimeToMinutes(start);
	const endMinutes = parseTimeToMinutes(end);
	const currentMinutes = parseTimeToMinutes(currentTime);

	// Handle midnight-crossing ranges (e.g., 22:00-08:00)
	if (startMinutes > endMinutes) {
		return currentMinutes >= startMinutes || currentMinutes < endMinutes;
	}

	return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

function parseTimeToMinutes(time: string): number {
	const parts = time.split(":").map(Number);
	return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

// ─── Message Formatting ───────────────────────────────────────────────────

export function formatNotificationMessage(event: NotificationEvent): FormattedMessage {
	const p = event.payload;

	switch (event.type) {
		case "approval.requested":
			return {
				body: `New post pending approval:\n\n"${p.title ?? "Untitled"}"\n\nBy @${p.author ?? "unknown"} - scheduled for ${p.time ?? "unscheduled"}`,
				buttons: [
					{ id: "approve", body: "Approve" },
					{ id: "reject", body: "Reject" },
					{ id: "view", body: "View" },
				],
			};

		case "post.failed":
			return {
				body: `Post failed after 3 retries:\n\n"${p.title ?? "Untitled"}"\n\nPlatform: ${p.platform ?? "unknown"}\nError: ${p.error ?? "unknown error"}`,
				buttons: [
					{ id: "retry", body: "Retry" },
					{ id: "cancel", body: "Cancel" },
				],
			};

		case "token.expiring":
			return {
				body: `${p.platform ?? "Platform"} token expires in ${p.days ?? "?"} days. Re-authenticate to keep posting.`,
				buttons: [{ id: "reauth", body: "Re-auth Now" }],
			};

		case "post.viral":
			return {
				body: `Your post is going viral! ${p.metric ?? ""}x above average.\n\n"${p.title ?? "Untitled"}"`,
				buttons: [{ id: "view_analytics", body: "View Analytics" }],
			};

		case "approval.result":
			return {
				body: `Your post was ${p.approved ? "approved" : "rejected"}.\n\n"${p.title ?? "Untitled"}"${p.comment ? `\n${p.comment}` : ""}`,
			};

		case "post.published":
			return {
				body: `Post published to ${p.platform ?? "unknown"}.\n\n"${p.title ?? "Untitled"}"`,
			};

		case "schedule.reminder":
			return {
				body: `Reminder: "${p.title ?? "Untitled"}" is scheduled for ${p.time ?? "soon"} on ${p.platform ?? "unknown"}.`,
			};

		default:
			return { body: `Notification: ${event.type}` };
	}
}

// ─── Company Notification Routing ──────────────────────────────────────────

export async function routeCompanyNotification(
	db: DrizzleClient,
	params: { hubId: string; eventType: string; payload: Record<string, unknown> },
): Promise<string[]> {
	const { hubId, eventType, payload } = params;

	switch (eventType) {
		case "approval.requested": {
			// All admins of the hub
			const admins = await db.execute(sql`
				SELECT user_id FROM team_members
				WHERE hub_id = ${hubId} AND role = 'admin' AND left_at IS NULL
			`);
			return (admins.rows as Array<{ user_id: string }>).map((r) => r.user_id);
		}

		case "post.failed": {
			// The post author only
			const author = payload.authorId as string | undefined;
			return author ? [author] : [];
		}

		case "post.viral": {
			// The post author + all admins
			const author = payload.authorId as string | undefined;
			const admins = await db.execute(sql`
				SELECT user_id FROM team_members
				WHERE hub_id = ${hubId} AND role = 'admin' AND left_at IS NULL
			`);
			const adminIds = (admins.rows as Array<{ user_id: string }>).map((r) => r.user_id);
			if (author && !adminIds.includes(author)) {
				adminIds.push(author);
			}
			return adminIds;
		}

		default: {
			// Default: notify all active members
			const members = await db.execute(sql`
				SELECT user_id FROM team_members
				WHERE hub_id = ${hubId} AND left_at IS NULL
			`);
			return (members.rows as Array<{ user_id: string }>).map((r) => r.user_id);
		}
	}
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildDedupKey(event: NotificationEvent): string {
	const p = event.payload;
	const key = (p.postId as string) ?? (p.key as string) ?? "";
	return `${event.type}:${key}`;
}
