import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import {
	type CooldownResult,
	type DailyCapResult,
	DEFAULT_COOLDOWN_MINUTES,
	DEFAULT_DAILY_CAPS,
	type EngagementConfig,
} from "./types.ts";

// ─── Load Engagement Config ─────────────────────────────────────────────────

/**
 * Load engagement config from DB, return defaults if no row exists.
 */
export async function loadEngagementConfig(db: HubDb, userId: string): Promise<EngagementConfig> {
	const result = await db.execute(sql`
		SELECT user_id, niche_keywords, platform_toggles, daily_caps, cooldown_minutes, blocklist
		FROM engagement_config
		WHERE user_id = ${userId}
		LIMIT 1
	`);

	const row = result.rows[0] as Record<string, unknown> | undefined;

	if (!row) {
		return {
			userId,
			nicheKeywords: [],
			platformToggles: {},
			dailyCaps: { ...DEFAULT_DAILY_CAPS },
			cooldownMinutes: { ...DEFAULT_COOLDOWN_MINUTES },
			blocklist: [],
		};
	}

	return {
		userId,
		nicheKeywords: (row.niche_keywords as string[] | null) ?? [],
		platformToggles: (row.platform_toggles as Record<string, boolean> | null) ?? {},
		dailyCaps: (row.daily_caps as Record<string, number> | null) ?? { ...DEFAULT_DAILY_CAPS },
		cooldownMinutes: (row.cooldown_minutes as Record<string, number> | null) ?? {
			...DEFAULT_COOLDOWN_MINUTES,
		},
		blocklist: (row.blocklist as string[] | null) ?? [],
	};
}

// ─── Save Engagement Config ─────────────────────────────────────────────────

/**
 * Upsert engagement config for a user.
 */
export async function saveEngagementConfig(
	db: HubDb,
	userId: string,
	config: Partial<EngagementConfig>,
): Promise<void> {
	const nicheKeywords = config.nicheKeywords ? JSON.stringify(config.nicheKeywords) : null;
	const platformToggles = config.platformToggles ? JSON.stringify(config.platformToggles) : null;
	const dailyCaps = config.dailyCaps ? JSON.stringify(config.dailyCaps) : null;
	const cooldownMinutes = config.cooldownMinutes ? JSON.stringify(config.cooldownMinutes) : null;
	const blocklist = config.blocklist ? JSON.stringify(config.blocklist) : null;

	await db.execute(sql`
		INSERT INTO engagement_config (id, user_id, niche_keywords, platform_toggles, daily_caps, cooldown_minutes, blocklist, updated_at)
		VALUES (gen_random_uuid(), ${userId},
			${nicheKeywords}::jsonb, ${platformToggles}::jsonb,
			${dailyCaps}::jsonb, ${cooldownMinutes}::jsonb,
			${blocklist}::jsonb, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			niche_keywords = COALESCE(EXCLUDED.niche_keywords, engagement_config.niche_keywords),
			platform_toggles = COALESCE(EXCLUDED.platform_toggles, engagement_config.platform_toggles),
			daily_caps = COALESCE(EXCLUDED.daily_caps, engagement_config.daily_caps),
			cooldown_minutes = COALESCE(EXCLUDED.cooldown_minutes, engagement_config.cooldown_minutes),
			blocklist = COALESCE(EXCLUDED.blocklist, engagement_config.blocklist),
			updated_at = NOW()
	`);
}

// ─── Derive Niche Keywords ──────────────────────────────────────────────────

/**
 * Load voice profile YAML, extract pillar keywords as baseline niche terms.
 * Uses lightweight YAML parsing (same pattern as trend-poller).
 */
export async function deriveNicheKeywords(
	voiceProfilePath = "content/voice/personal.yaml",
): Promise<string[]> {
	try {
		const raw = await readFile(voiceProfilePath, "utf-8");
		const keywords: string[] = [];
		let inPillars = false;

		for (const line of raw.split("\n")) {
			const trimmed = line.trim();

			// Look for pillars section
			if (trimmed.startsWith("pillars:")) {
				inPillars = true;
				continue;
			}

			if (inPillars) {
				// Extract pillar names (- name: "Pillar Name")
				const nameMatch = trimmed.match(/^-\s*name:\s*(.+)/);
				if (nameMatch?.[1]) {
					const pillarName = nameMatch[1].trim().replace(/^["']|["']$/g, "");
					// Split multi-word pillars into individual keywords
					const words = pillarName.toLowerCase().split(/\s+/);
					keywords.push(pillarName.toLowerCase(), ...words.filter((w) => w.length > 2));
					continue;
				}

				// Also look for topics/keywords within pillars
				const topicMatch = trimmed.match(/^-\s*(?:topic|keyword):\s*(.+)/);
				if (topicMatch?.[1]) {
					keywords.push(
						topicMatch[1]
							.trim()
							.replace(/^["']|["']$/g, "")
							.toLowerCase(),
					);
					continue;
				}

				// End of pillars section
				if (
					trimmed !== "" &&
					!trimmed.startsWith("-") &&
					!trimmed.startsWith("weight:") &&
					!trimmed.startsWith("topic") &&
					!trimmed.startsWith("keyword") &&
					!trimmed.startsWith("description")
				) {
					break;
				}
			}
		}

		// Deduplicate
		return [...new Set(keywords)];
	} catch {
		return [];
	}
}

// ─── Check Daily Cap ────────────────────────────────────────────────────────

/**
 * Count today's engagements in engagement_log for platform.
 * Returns whether user can still engage and remaining count.
 */
export async function checkDailyCap(
	db: HubDb,
	userId: string,
	platform: string,
): Promise<DailyCapResult> {
	// Load config for cap value
	const config = await loadEngagementConfig(db, userId);
	const cap = config.dailyCaps[platform] ?? DEFAULT_DAILY_CAPS[platform] ?? 10;

	const countResult = await db.execute(sql`
		SELECT COUNT(*)::int as count
		FROM engagement_log
		WHERE user_id = ${userId}
			AND platform = ${platform}
			AND engaged_at >= CURRENT_DATE
	`);

	const countRow = countResult.rows[0] as Record<string, unknown> | undefined;
	const used = (countRow?.count as number) ?? 0;
	const remaining = Math.max(0, cap - used);

	return {
		allowed: remaining > 0,
		remaining,
		cap,
	};
}

// ─── Check Cooldown ─────────────────────────────────────────────────────────

/**
 * Check last engagement timestamp for platform.
 * Returns whether cooldown has passed and minutes to wait.
 */
export async function checkCooldown(
	db: HubDb,
	userId: string,
	platform: string,
): Promise<CooldownResult> {
	const config = await loadEngagementConfig(db, userId);
	const cooldown = config.cooldownMinutes[platform] ?? DEFAULT_COOLDOWN_MINUTES[platform] ?? 5;

	const cooldownResult = await db.execute(sql`
		SELECT engaged_at
		FROM engagement_log
		WHERE user_id = ${userId}
			AND platform = ${platform}
		ORDER BY engaged_at DESC
		LIMIT 1
	`);

	const cooldownRow = cooldownResult.rows[0] as Record<string, unknown> | undefined;

	if (!cooldownRow?.engaged_at) {
		return { allowed: true, waitMinutes: 0 };
	}

	const lastEngagedAt = new Date(cooldownRow.engaged_at as string);
	const minutesSinceLast = (Date.now() - lastEngagedAt.getTime()) / 60_000;
	const waitMinutes = Math.max(0, Math.ceil(cooldown - minutesSinceLast));

	return {
		allowed: minutesSinceLast >= cooldown,
		waitMinutes,
	};
}

// ─── Blocklist Check ────────────────────────────────────────────────────────

/**
 * Check if handle is in blocklist.
 */
export function isBlocked(config: EngagementConfig, authorHandle: string): boolean {
	const normalized = authorHandle.toLowerCase().replace(/^@/, "");
	return config.blocklist.some((blocked) => blocked.toLowerCase().replace(/^@/, "") === normalized);
}

// ─── Record Engagement ──────────────────────────────────────────────────────

/**
 * Insert into engagement_log.
 */
export async function recordEngagement(
	db: HubDb,
	userId: string,
	opportunityId: string,
	platform: string,
	type: string,
	content: string,
): Promise<void> {
	await db.execute(sql`
		INSERT INTO engagement_log (id, user_id, opportunity_id, platform, engagement_type, content, engaged_at, created_at)
		VALUES (gen_random_uuid(), ${userId}, ${opportunityId}::uuid, ${platform}, ${type}, ${content}, NOW(), NOW())
	`);
}

// ─── Platform Monitoring Toggle ─────────────────────────────────────────────

/**
 * Check if monitoring is enabled for a platform. Default true if not set.
 */
export function isPlatformMonitoringEnabled(config: EngagementConfig, platform: string): boolean {
	return config.platformToggles[platform] ?? true;
}
