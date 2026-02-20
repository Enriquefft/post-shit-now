import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { compileDigest, formatDigestMessage } from "../notifications/digest.ts";
import { isQuietHours } from "../notifications/dispatcher.ts";
import { createWhatsAppProvider } from "../notifications/provider.ts";
import type { NotificationPreference } from "../notifications/types.ts";

// ─── Digest Compiler Task ──────────────────────────────────────────────────
// Runs every hour. Checks which users need digests at the current time
// (respecting their timezone and frequency settings). Compiles and delivers
// digests, then marks queued events as sent.

interface PreferenceRow {
	user_id: string;
	provider: string;
	digest_enabled: number;
	digest_frequency: string;
	digest_time: string;
	quiet_hours_start: string | null;
	quiet_hours_end: string | null;
	max_push_per_day: number;
	timezone: string;
}

interface SessionRow {
	phone: string;
	session_state: string;
}

export const digestCompilerTask = schedules.task({
	id: "digest-compiler",
	cron: "0 * * * *", // every hour
	maxDuration: 300, // 5 minutes
	run: async () => {
		const databaseUrl = process.env.DATABASE_URL;
		if (!databaseUrl) {
			logger.error("DATABASE_URL not set");
			return { digestsSent: 0, skipped: 0, errors: 0 };
		}

		const db = createHubConnection(databaseUrl);
		const result = { digestsSent: 0, skipped: 0, errors: 0 };

		// Find all users with digest enabled
		const prefsResult = await db.execute(sql`
			SELECT user_id, provider, digest_enabled, digest_frequency, digest_time,
			       quiet_hours_start, quiet_hours_end, max_push_per_day, timezone
			FROM notification_preferences
			WHERE digest_enabled = 1
		`);

		const prefs = prefsResult.rows as unknown as PreferenceRow[];

		for (const pref of prefs) {
			try {
				// Check if current hour matches user's digest time (in their timezone)
				if (!isDigestTimeNow(pref)) {
					continue;
				}

				// Build NotificationPreference for quiet hours check
				const preferences: NotificationPreference & { timezone: string } = {
					userId: pref.user_id,
					provider: pref.provider as "waha" | "twilio",
					pushEnabled: false,
					digestEnabled: true,
					digestFrequency: pref.digest_frequency as "daily" | "twice_daily" | "weekly",
					digestTime: pref.digest_time,
					quietHoursStart: pref.quiet_hours_start ?? undefined,
					quietHoursEnd: pref.quiet_hours_end ?? undefined,
					maxPushPerDay: pref.max_push_per_day,
					timezone: pref.timezone,
				};

				// Respect quiet hours
				if (isQuietHours(preferences)) {
					logger.info("Skipping digest — quiet hours", { userId: pref.user_id });
					result.skipped++;
					continue;
				}

				// Get WhatsApp session
				const sessionResult = await db.execute(sql`
					SELECT phone, session_state FROM whatsapp_sessions
					WHERE user_id = ${pref.user_id}
					LIMIT 1
				`);
				const session = sessionResult.rows[0] as SessionRow | undefined;
				if (!session || session.session_state !== "active") {
					result.skipped++;
					continue;
				}

				// Calculate since date based on frequency
				const since = calculateSinceDate(pref.digest_frequency);

				// Compile digest
				const digest = await compileDigest(db, {
					userId: pref.user_id,
					frequency: pref.digest_frequency as "daily" | "twice_daily" | "weekly",
					since,
				});

				// Skip empty digests
				if (digest.totalEvents === 0) {
					result.skipped++;
					continue;
				}

				// Format and send
				const message = formatDigestMessage(digest);
				const provider = createProviderFromEnv(pref.provider as "waha" | "twilio");
				if (!provider) {
					logger.warn("Cannot create provider for digest", { userId: pref.user_id });
					result.skipped++;
					continue;
				}

				const sendResult = await provider.sendText(session.phone, message);

				if (sendResult.success) {
					// Mark queued events as sent
					await db.execute(sql`
						UPDATE notification_log
						SET status = 'sent', sent_at = NOW()
						WHERE user_id = ${pref.user_id}
						  AND status = 'queued'
						  AND created_at > ${since}
					`);
					result.digestsSent++;
					logger.info("Digest sent", {
						userId: pref.user_id,
						events: digest.totalEvents,
						sections: digest.sections.length,
					});
				} else {
					logger.error("Failed to send digest", { userId: pref.user_id, error: sendResult.error });
					result.errors++;
				}
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				logger.error("Digest compilation failed", { userId: pref.user_id, error: reason });
				result.errors++;
			}
		}

		logger.info("Digest compiler cycle complete", { ...result });
		return result;
	},
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function isDigestTimeNow(pref: PreferenceRow): boolean {
	const now = new Date();

	// Get current hour in user's timezone
	const formatter = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: pref.timezone || "UTC",
	});
	const currentTime = formatter.format(now); // "HH:MM"
	const currentHour = Number(currentTime.split(":")[0]);

	const digestHour = Number(pref.digest_time.split(":")[0]);

	const frequency = pref.digest_frequency;

	if (frequency === "daily") {
		return currentHour === digestHour;
	}

	if (frequency === "twice_daily") {
		// Morning and evening: digestTime and digestTime + 10 hours (wrapping)
		const eveningHour = (digestHour + 10) % 24;
		return currentHour === digestHour || currentHour === eveningHour;
	}

	if (frequency === "weekly") {
		// Only on Mondays (or configured day)
		const dayFormatter = new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			timeZone: pref.timezone || "UTC",
		});
		const dayName = dayFormatter.format(now);
		return dayName === "Mon" && currentHour === digestHour;
	}

	return false;
}

function calculateSinceDate(frequency: string): Date {
	const now = new Date();
	switch (frequency) {
		case "twice_daily":
			return new Date(now.getTime() - 12 * 60 * 60 * 1000);
		case "weekly":
			return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		default:
			return new Date(now.getTime() - 24 * 60 * 60 * 1000);
	}
}

function createProviderFromEnv(providerType: "waha" | "twilio") {
	const { createWhatsAppProvider: create } = { createWhatsAppProvider };

	if (providerType === "waha") {
		const baseUrl = process.env.WAHA_BASE_URL;
		if (!baseUrl) return null;
		return create({
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
	return create({
		provider: "twilio",
		twilio: { accountSid, authToken, fromNumber },
	});
}
