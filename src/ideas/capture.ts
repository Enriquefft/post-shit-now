import type { HubDb } from "../core/db/connection.ts";
import { ideas } from "../core/db/schema.ts";
import type { CaptureInput, Idea, Urgency } from "./types.ts";

// ─── Inline Tag Parsing ─────────────────────────────────────────────────────

const RECOGNIZED_KEYS = new Set(["pillar", "platform", "format", "urgency", "hub"]);

export function parseInlineTags(input: string): {
	text: string;
	tags: Record<string, string>;
} {
	const tags: Record<string, string> = {};
	const text = input
		.replace(/#(\w+):(\S+)/g, (_match, key: string, value: string) => {
			if (RECOGNIZED_KEYS.has(key)) {
				tags[key] = value;
			}
			return "";
		})
		.replace(/\s{2,}/g, " ")
		.trim();

	return { text, tags };
}

// ─── Urgency Inference ──────────────────────────────────────────────────────

const TIMELY_KEYWORDS = [
	"breaking",
	"just announced",
	"today",
	"this week",
	"trending now",
	"just dropped",
	"just released",
	"happening now",
];

const SEASONAL_KEYWORDS = [
	"holiday",
	"new year",
	"black friday",
	"cyber monday",
	"q4",
	"q1",
	"q2",
	"q3",
	"christmas",
	"thanksgiving",
	"summer",
	"winter",
	"spring",
	"fall",
	"back to school",
	"year end",
	"end of year",
];

export function inferUrgency(text: string): Urgency {
	const lower = text.toLowerCase();

	for (const keyword of TIMELY_KEYWORDS) {
		if (lower.includes(keyword)) return "timely";
	}

	for (const keyword of SEASONAL_KEYWORDS) {
		if (lower.includes(keyword)) return "seasonal";
	}

	return "evergreen";
}

// ─── Capture Idea ───────────────────────────────────────────────────────────

export async function captureIdea(db: HubDb, userId: string, input: CaptureInput): Promise<Idea> {
	const urgency =
		input.urgency ?? (input.tags?.urgency as Urgency | undefined) ?? inferUrgency(input.text);

	// Calculate expiry for timely/seasonal ideas
	let expiresAt: Date | null = null;
	if (urgency === "timely") {
		expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
	} else if (urgency === "seasonal") {
		expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
	}

	const pillar = input.pillar ?? input.tags?.pillar ?? null;
	const platform = input.platform ?? input.tags?.platform ?? null;
	const format = input.format ?? input.tags?.format ?? null;
	const hubId = input.hub ?? input.tags?.hub ?? null;

	const rows = await db
		.insert(ideas)
		.values({
			userId,
			hubId,
			title: input.text,
			tags: input.tags ? Object.entries(input.tags).map(([k, v]) => `${k}:${v}`) : null,
			status: "spark",
			urgency,
			pillar,
			platform,
			format,
			expiresAt,
			sourceType: "capture",
		})
		.returning();

	const row = rows[0];
	if (!row) throw new Error("Failed to insert idea");

	return {
		id: row.id,
		userId: row.userId,
		hubId: row.hubId,
		title: row.title,
		notes: row.notes,
		tags: row.tags,
		status: row.status as Idea["status"],
		urgency: row.urgency as Idea["urgency"],
		pillar: row.pillar,
		platform: row.platform,
		format: row.format,
		claimedBy: row.claimedBy,
		killReason: row.killReason,
		expiresAt: row.expiresAt,
		lastTouchedAt: row.lastTouchedAt,
		sourceType: row.sourceType as Idea["sourceType"],
		sourceId: row.sourceId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
