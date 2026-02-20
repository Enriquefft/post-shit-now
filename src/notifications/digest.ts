import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import type { createHubConnection } from "../core/db/connection.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

type DrizzleClient = ReturnType<typeof createHubConnection>;

export interface DigestSection {
	title: string;
	content: string;
	count: number;
	priority: number;
}

export interface DigestContent {
	sections: DigestSection[];
	totalEvents: number;
	period: string;
}

const NotificationRowSchema = z.object({
	event_type: z.string(),
	tier: z.string(),
	created_at: z.union([z.date(), z.string()]),
});

// ─── Digest Compiler ───────────────────────────────────────────────────────
// Aggregates queued notification events into a structured digest message.
// Groups by category, respects frequency depth (daily=highlights, weekly=full).

export async function compileDigest(
	db: DrizzleClient,
	params: { userId: string; frequency: "daily" | "twice_daily" | "weekly"; since: Date },
): Promise<DigestContent> {
	const { userId, frequency, since } = params;

	// Fetch queued events since the cutoff
	const eventsResult = await db.execute(sql`
		SELECT event_type, tier, created_at
		FROM notification_log
		WHERE user_id = ${userId}
		  AND status = 'queued'
		  AND created_at > ${since}
		ORDER BY created_at ASC
	`);

	const events = z.array(NotificationRowSchema).parse(eventsResult.rows);
	const sections: DigestSection[] = [];

	// Group events by category
	const published = events.filter((e) => e.event_type === "post.published");
	const approvals = events.filter(
		(e) => e.event_type === "approval.requested" || e.event_type === "approval.result",
	);
	const failures = events.filter((e) => e.event_type === "post.failed");
	const viral = events.filter((e) => e.event_type === "post.viral");
	const tokens = events.filter((e) => e.event_type === "token.expiring");
	const downgraded = events.filter(
		(e) =>
			e.tier === "digest" && e.event_type !== "digest.daily" && e.event_type !== "digest.weekly",
	);

	// Published posts section
	if (published.length > 0) {
		sections.push({
			title: "Published",
			content: `${published.length} post${published.length !== 1 ? "s" : ""} published`,
			count: published.length,
			priority: 2,
		});
	}

	// Pending approvals section
	if (approvals.length > 0) {
		const pending = approvals.filter((e) => e.event_type === "approval.requested");
		const resolved = approvals.filter((e) => e.event_type === "approval.result");
		const parts: string[] = [];
		if (pending.length > 0) parts.push(`${pending.length} awaiting review`);
		if (resolved.length > 0) parts.push(`${resolved.length} resolved`);
		sections.push({
			title: "Approvals",
			content: parts.join(", "),
			count: approvals.length,
			priority: 1, // highest priority
		});
	}

	// Failed posts section
	if (failures.length > 0) {
		sections.push({
			title: "Failures",
			content: `${failures.length} post${failures.length !== 1 ? "s" : ""} failed`,
			count: failures.length,
			priority: 1,
		});
	}

	// Viral alerts section
	if (viral.length > 0) {
		sections.push({
			title: "Going Viral",
			content: `${viral.length} post${viral.length !== 1 ? "s" : ""} performing above average`,
			count: viral.length,
			priority: 2,
		});
	}

	// Token warnings
	if (tokens.length > 0) {
		sections.push({
			title: "Token Alerts",
			content: `${tokens.length} token${tokens.length !== 1 ? "s" : ""} expiring soon`,
			count: tokens.length,
			priority: 3,
		});
	}

	// Downgraded push events (fatigue-limited)
	const uniqueDowngraded = downgraded.filter(
		(e) =>
			!published.includes(e) &&
			!approvals.includes(e) &&
			!failures.includes(e) &&
			!viral.includes(e) &&
			!tokens.includes(e),
	);
	if (uniqueDowngraded.length > 0) {
		sections.push({
			title: "Missed Pushes",
			content: `${uniqueDowngraded.length} notification${uniqueDowngraded.length !== 1 ? "s" : ""} held due to limits`,
			count: uniqueDowngraded.length,
			priority: 4,
		});
	}

	// Sort by priority (lower = more important)
	sections.sort((a, b) => a.priority - b.priority);

	const periodLabel =
		frequency === "weekly" ? "weekly" : frequency === "twice_daily" ? "half-day" : "daily";

	return {
		sections,
		totalEvents: events.length,
		period: periodLabel,
	};
}

// ─── Message Formatter ────────────────────────────────────────────────────

const WHATSAPP_CHAR_LIMIT = 4096;

export function formatDigestMessage(digest: DigestContent): string {
	if (digest.totalEvents === 0) return "";

	const greeting =
		digest.period === "weekly"
			? "Here's your weekly digest:"
			: digest.period === "half-day"
				? "Here's your update:"
				: "Good morning! Here's your daily digest:";

	const parts: string[] = [greeting, ""];

	for (const section of digest.sections) {
		parts.push(`*${section.title}:* ${section.content}`);
	}

	let message = parts.join("\n");

	// Truncate if exceeding WhatsApp limit
	if (message.length > WHATSAPP_CHAR_LIMIT) {
		message = `${message.substring(0, WHATSAPP_CHAR_LIMIT - 20)}\n\n[truncated]`;
	}

	return message;
}
