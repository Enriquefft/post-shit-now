import { logger, task } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { dispatchNotification, routeCompanyNotification } from "../notifications/dispatcher.ts";
import { createWhatsAppProvider } from "../notifications/provider.ts";
import type {
	NotificationEvent,
	NotificationEventType,
	NotificationPreference,
} from "../notifications/types.ts";

// ─── Notification Dispatcher Task ──────────────────────────────────────────
// Trigger.dev task for async notification dispatch.
// Receives an event, loads user preferences and WhatsApp session,
// then dispatches via the configured provider.
// For company events, routes to appropriate team members first.

interface DispatchPayload {
	eventType: NotificationEventType;
	userId: string;
	hubId?: string;
	payload: Record<string, unknown>;
}

interface SessionRow {
	phone: string;
	provider: string;
	session_state: string;
	conversation_context: Record<string, unknown> | null;
}

interface PreferenceRow {
	user_id: string;
	provider: string;
	push_enabled: number;
	digest_enabled: number;
	digest_frequency: string;
	digest_time: string;
	quiet_hours_start: string | null;
	quiet_hours_end: string | null;
	max_push_per_day: number;
	timezone: string;
}

export const notificationDispatcherTask = task({
	id: "notification-dispatcher",
	maxDuration: 60,
	run: async (input: DispatchPayload) => {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			logger.error("DATABASE_URL not set");
			return { dispatched: 0, skipped: 0, downgraded: 0 };
		}

		const db = createHubConnection(databaseUrl);
		const result = { dispatched: 0, skipped: 0, downgraded: 0 };

		// Determine target users
		let targetUserIds: string[];

		if (input.hubId) {
			// Company event: route to appropriate team members
			targetUserIds = await routeCompanyNotification(db, {
				hubId: input.hubId,
				eventType: input.eventType,
				payload: input.payload,
			});
		} else {
			targetUserIds = [input.userId];
		}

		for (const targetUserId of targetUserIds) {
			try {
				// Load WhatsApp session
				const sessionResult = await db.execute(sql`
					SELECT phone, provider, session_state, conversation_context
					FROM whatsapp_sessions
					WHERE user_id = ${targetUserId}
					LIMIT 1
				`);

				const session = sessionResult.rows[0] as SessionRow | undefined;
				if (!session || session.session_state !== "active") {
					logger.info("No active WhatsApp session — skipping", { userId: targetUserId });
					result.skipped++;
					continue;
				}

				// Load notification preferences
				const prefResult = await db.execute(sql`
					SELECT user_id, provider, push_enabled, digest_enabled, digest_frequency,
					       digest_time, quiet_hours_start, quiet_hours_end, max_push_per_day, timezone
					FROM notification_preferences
					WHERE user_id = ${targetUserId}
					LIMIT 1
				`);

				const prefRow = prefResult.rows[0] as PreferenceRow | undefined;
				const preferences: NotificationPreference = prefRow
					? {
							userId: prefRow.user_id,
							provider: prefRow.provider as "waha" | "twilio",
							pushEnabled: prefRow.push_enabled === 1,
							digestEnabled: prefRow.digest_enabled === 1,
							digestFrequency: prefRow.digest_frequency as "daily" | "twice_daily" | "weekly",
							digestTime: prefRow.digest_time,
							quietHoursStart: prefRow.quiet_hours_start ?? undefined,
							quietHoursEnd: prefRow.quiet_hours_end ?? undefined,
							maxPushPerDay: prefRow.max_push_per_day,
						}
					: {
							userId: targetUserId,
							provider: (session.provider as "waha" | "twilio") ?? "waha",
							pushEnabled: true,
							digestEnabled: true,
							digestFrequency: "daily",
							digestTime: "08:00",
							maxPushPerDay: 3,
						};

				// Create provider from env
				const provider = createProviderFromEnv(preferences.provider);
				if (!provider) {
					logger.warn("Cannot create WhatsApp provider — missing env vars", {
						userId: targetUserId,
						provider: preferences.provider,
					});
					result.skipped++;
					continue;
				}

				const event: NotificationEvent = {
					type: input.eventType,
					userId: targetUserId,
					hubId: input.hubId,
					payload: input.payload,
					createdAt: new Date(),
				};

				const dispatchResult = await dispatchNotification({
					db,
					provider,
					event,
					preferences,
					recipient: session.phone,
				});

				if (dispatchResult.sent) {
					result.dispatched++;
				} else if (dispatchResult.downgraded) {
					result.downgraded++;
				} else {
					result.skipped++;
				}

				logger.info("Notification dispatched", {
					userId: targetUserId,
					eventType: input.eventType,
					sent: dispatchResult.sent,
					tier: dispatchResult.tier,
					downgraded: dispatchResult.downgraded,
				});
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				logger.error("Failed to dispatch notification", { userId: targetUserId, error: reason });
				result.skipped++;
			}
		}

		logger.info("Notification dispatch complete", { ...result });
		return result;
	},
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function createProviderFromEnv(providerType: "waha" | "twilio") {
	if (providerType === "waha") {
		const baseUrl = process.env.WAHA_BASE_URL;
		if (!baseUrl) return null;
		return createWhatsAppProvider({
			provider: "waha",
			waha: {
				baseUrl,
				session: process.env.WAHA_SESSION ?? "default",
				apiKey: process.env.WAHA_API_KEY,
			},
		});
	}

	const accountSid = process.env.TWILIO_ACCOUNT_SID;
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	const fromNumber = process.env.TWILIO_FROM_NUMBER;
	if (!accountSid || !authToken || !fromNumber) return null;
	return createWhatsAppProvider({
		provider: "twilio",
		twilio: { accountSid, authToken, fromNumber },
	});
}
