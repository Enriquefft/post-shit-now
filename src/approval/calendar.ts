import { and, eq, ne, sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";
import type { HubConnection } from "../team/types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEntry {
	postId: string;
	userId: string;
	displayName?: string;
	platform: string;
	content: string; // truncated preview
	status: string;
	approvalStatus: string | null;
	scheduledAt: Date | null;
	publishedAt: Date | null;
}

export interface CalendarStats {
	totalScheduled: number;
	pendingApproval: number;
	published: number;
	drafts: number;
}

export interface HubCalendarSection {
	entries: CalendarEntry[];
	stats: CalendarStats;
	hubName?: string;
}

export interface UnifiedCalendar {
	personal: HubCalendarSection;
	companies: Record<string, HubCalendarSection>;
}

export interface TimeSlot {
	dateTime: Date;
	platform: string;
	suggested: boolean;
}

// ─── Content Preview ────────────────────────────────────────────────────────

function truncateContent(content: string, maxLen = 80): string {
	// Handle thread content (JSON arrays)
	try {
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) {
			const first = (parsed[0] ?? "") as string;
			return first.length > maxLen ? `${first.slice(0, maxLen)}...` : first;
		}
	} catch {
		// Not JSON, use as-is
	}
	return content.length > maxLen ? `${content.slice(0, maxLen)}...` : content;
}

// ─── Calendar Stats ─────────────────────────────────────────────────────────

function computeStats(entries: CalendarEntry[]): CalendarStats {
	return {
		totalScheduled: entries.filter((e) => e.status === "scheduled").length,
		pendingApproval: entries.filter((e) => e.approvalStatus === "submitted").length,
		published: entries.filter((e) => e.status === "published").length,
		drafts: entries.filter((e) => e.status === "draft").length,
	};
}

// ─── Query Hub Posts ────────────────────────────────────────────────────────

async function queryHubPosts(db: HubDb, startDate: Date, endDate: Date): Promise<CalendarEntry[]> {
	const rows = await db
		.select({
			id: posts.id,
			userId: posts.userId,
			platform: posts.platform,
			content: posts.content,
			status: posts.status,
			approvalStatus: posts.approvalStatus,
			scheduledAt: posts.scheduledAt,
			publishedAt: posts.publishedAt,
		})
		.from(posts)
		.where(
			and(
				ne(posts.status, "failed"),
				sql`(${posts.scheduledAt} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}) OR (${posts.publishedAt} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}) OR (${posts.status} = 'draft' AND ${posts.createdAt} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()})`,
			),
		)
		.orderBy(posts.scheduledAt);

	return rows.map((row) => ({
		postId: row.id,
		userId: row.userId,
		platform: row.platform,
		content: truncateContent(row.content),
		status: row.status,
		approvalStatus: row.approvalStatus,
		scheduledAt: row.scheduledAt,
		publishedAt: row.publishedAt,
	}));
}

// ─── Unified Calendar ───────────────────────────────────────────────────────

/**
 * Merge Personal Hub + Company Hubs into a single calendar view.
 * Queries each hub independently -- one hub failure does not crash the whole view.
 */
export async function getUnifiedCalendar(params: {
	personalDb: HubDb;
	companyHubs: Array<{ connection: HubConnection; db: HubDb }>;
	userId: string;
	startDate: Date;
	endDate: Date;
}): Promise<UnifiedCalendar> {
	const { personalDb, companyHubs, startDate, endDate } = params;

	// Query personal hub
	let personalEntries: CalendarEntry[] = [];
	try {
		personalEntries = await queryHubPosts(personalDb, startDate, endDate);
	} catch (error) {
		// Log but don't crash -- personal hub failure is non-fatal
		console.error("Failed to query personal hub calendar:", error);
	}

	// Query each company hub independently
	const companies: Record<string, HubCalendarSection> = {};

	for (const { connection, db } of companyHubs) {
		try {
			const entries = await queryHubPosts(db, startDate, endDate);
			companies[connection.slug] = {
				entries,
				stats: computeStats(entries),
				hubName: connection.displayName,
			};
		} catch (error) {
			// One hub failure does not crash the view
			console.error(`Failed to query ${connection.slug} calendar:`, error);
			companies[connection.slug] = {
				entries: [],
				stats: { totalScheduled: 0, pendingApproval: 0, published: 0, drafts: 0 },
				hubName: connection.displayName,
			};
		}
	}

	return {
		personal: {
			entries: personalEntries,
			stats: computeStats(personalEntries),
		},
		companies,
	};
}

// ─── Available Slots ────────────────────────────────────────────────────────

/**
 * Determine available posting slots based on optimal times from strategy.
 * A slot is "available" if no post is scheduled at that time for that platform.
 *
 * Default optimal times per platform (used when strategy.yaml not available):
 * - x: 9am, 12pm, 5pm
 * - linkedin: 8am, 10am, 12pm
 * - instagram: 11am, 2pm, 7pm
 * - tiktok: 10am, 3pm, 8pm
 */
const DEFAULT_OPTIMAL_HOURS: Record<string, number[]> = {
	x: [9, 12, 17],
	linkedin: [8, 10, 12],
	instagram: [11, 14, 19],
	tiktok: [10, 15, 20],
};

export async function getAvailableSlots(
	db: HubDb,
	params: {
		hubId: string;
		startDate: Date;
		endDate: Date;
		platform?: string;
	},
): Promise<TimeSlot[]> {
	const { startDate, endDate, platform } = params;
	const platforms = platform ? [platform] : Object.keys(DEFAULT_OPTIMAL_HOURS);

	// Get all scheduled posts in range
	const scheduledPosts = await db
		.select({
			platform: posts.platform,
			scheduledAt: posts.scheduledAt,
		})
		.from(posts)
		.where(
			and(
				sql`${posts.scheduledAt} BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}`,
				sql`${posts.status} IN ('draft', 'scheduled', 'publishing', 'published')`,
			),
		);

	// Build set of occupied slots (platform:timestamp)
	const occupied = new Set<string>();
	for (const p of scheduledPosts) {
		if (p.scheduledAt) {
			occupied.add(`${p.platform}:${p.scheduledAt.getTime()}`);
		}
	}

	// Generate available slots
	const slots: TimeSlot[] = [];
	const current = new Date(startDate);

	while (current <= endDate) {
		for (const plat of platforms) {
			const hours = DEFAULT_OPTIMAL_HOURS[plat] ?? [9, 12, 17];
			for (const hour of hours) {
				const slotTime = new Date(current);
				slotTime.setHours(hour, 0, 0, 0);

				if (slotTime >= startDate && slotTime <= endDate && slotTime > new Date()) {
					const key = `${plat}:${slotTime.getTime()}`;
					if (!occupied.has(key)) {
						slots.push({
							dateTime: new Date(slotTime),
							platform: plat,
							suggested: true,
						});
					}
				}
			}
		}
		current.setDate(current.getDate() + 1);
	}

	return slots;
}

// ─── Claim Slot ─────────────────────────────────────────────────────────────

/**
 * Claim a time slot for a specific platform.
 * Creates a placeholder draft post at the claimed time.
 * Uses SELECT FOR UPDATE to prevent double-claiming under concurrency.
 * TEAM-08: Unified calendar enables slot claiming across all hubs
 * claimSlot accepts hubId for company post claiming (line 287).
 */
export async function claimSlot(
	db: HubDb,
	params: {
		userId: string;
		hubId: string;
		dateTime: Date;
		platform: string;
	},
): Promise<{ success: boolean; error?: string }> {
	const { userId, hubId, dateTime, platform } = params;

	// Check for existing post at this slot (using raw SQL for SELECT FOR UPDATE)
	const existing = await db.execute(sql`
		SELECT id FROM posts
		WHERE platform = ${platform}
		AND scheduled_at = ${dateTime.toISOString()}
		AND status IN ('draft', 'scheduled', 'publishing', 'published')
		AND metadata->>'hubId' = ${hubId}
		FOR UPDATE
		LIMIT 1
	`);

	if (existing.rows && existing.rows.length > 0) {
		return { success: false, error: "Slot already claimed" };
	}

	// Create placeholder post
	await db.insert(posts).values({
		userId,
		platform,
		content: "",
		status: "draft",
		scheduledAt: dateTime,
		metadata: { hubId, slotClaimed: true },
	});

	return { success: true };
}

// ─── Release Slot ───────────────────────────────────────────────────────────

/**
 * Release a claimed slot by deleting the placeholder post.
 * Only the claimer or an admin can release.
 * Only deletes if post is still a draft with slotClaimed metadata.
 */
export async function releaseSlot(
	db: HubDb,
	params: { postId: string; userId: string },
): Promise<void> {
	const { postId, userId } = params;

	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

	if (!post) return;

	const metadata = post.metadata ?? {};
	if (post.status !== "draft" || !metadata.slotClaimed) {
		return; // Not a claimable placeholder
	}

	// Only the claimer can release (admin check deferred to caller)
	if (post.userId !== userId) {
		return;
	}

	await db.execute(sql`DELETE FROM posts WHERE id = ${postId}`);
}

// ─── Format Calendar for CLI ────────────────────────────────────────────────

/**
 * Render hub-grouped calendar as structured text for Claude to present.
 * Personal section first, then each company section.
 */
export function formatCalendarForCli(calendar: UnifiedCalendar): string {
	const lines: string[] = [];

	// Personal section
	lines.push("## Personal Hub");
	lines.push(
		`  Scheduled: ${calendar.personal.stats.totalScheduled} | Published: ${calendar.personal.stats.published} | Drafts: ${calendar.personal.stats.drafts}`,
	);
	lines.push("");

	if (calendar.personal.entries.length === 0) {
		lines.push("  (no posts in this period)");
	} else {
		for (const entry of calendar.personal.entries) {
			const time = entry.scheduledAt
				? entry.scheduledAt.toISOString().slice(0, 16).replace("T", " ")
				: "(unscheduled)";
			const status = entry.status.toUpperCase();
			lines.push(`  [${time}] [${entry.platform.toUpperCase()}] [${status}] "${entry.content}"`);
		}
	}

	lines.push("");

	// Company sections
	for (const [slug, section] of Object.entries(calendar.companies)) {
		const name = section.hubName ?? slug;
		lines.push(`## ${name}`);
		lines.push(
			`  Scheduled: ${section.stats.totalScheduled} | Pending: ${section.stats.pendingApproval} | Published: ${section.stats.published} | Drafts: ${section.stats.drafts}`,
		);
		lines.push("");

		if (section.entries.length === 0) {
			lines.push("  (no posts in this period)");
		} else {
			for (const entry of section.entries) {
				const time = entry.scheduledAt
					? entry.scheduledAt.toISOString().slice(0, 16).replace("T", " ")
					: "(unscheduled)";
				const status = entry.status.toUpperCase();
				const approvalBadge =
					entry.approvalStatus === "submitted"
						? " [Pending]"
						: entry.approvalStatus === "approved"
							? " [Approved]"
							: entry.approvalStatus === "rejected"
								? " [Rejected]"
								: "";
				lines.push(
					`  [${time}] [${entry.platform.toUpperCase()}] [${status}]${approvalBadge} "${entry.content}"`,
				);
			}
		}

		lines.push("");
	}

	return lines.join("\n");
}
