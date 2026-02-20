import { readFile } from "node:fs/promises";
import { and, eq, gte, lte } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";
import { getDueEpisodes } from "../series/episodes.ts";
import type { CalendarState, StrategyConfig } from "./types.ts";

// ─── Strategy YAML Loader ────────────────────────────────────────────────────

async function loadStrategyConfig(
	strategyPath = "content/strategy.yaml",
): Promise<StrategyConfig | null> {
	try {
		const raw = await readFile(strategyPath, "utf-8");

		// Lightweight YAML parsing for strategy files
		const pillars: StrategyConfig["pillars"] = [];
		const platforms: StrategyConfig["platforms"] = [];
		const languages: StrategyConfig["languages"] = { primary: "en", default: "en" };

		let section = "";
		let currentPillar: Partial<StrategyConfig["pillars"][number]> = {};
		let currentPlatform: Partial<StrategyConfig["platforms"][number]> = {};

		for (const line of raw.split("\n")) {
			const trimmed = line.trim();

			// Section detection
			if (trimmed === "pillars:") {
				section = "pillars";
				continue;
			}
			if (trimmed === "platforms:") {
				section = "platforms";
				continue;
			}
			if (trimmed === "languages:") {
				section = "languages";
				continue;
			}
			if (trimmed.match(/^\w+:/) && !trimmed.startsWith("-") && !trimmed.startsWith(" ")) {
				section = "";
			}

			if (section === "pillars") {
				if (trimmed.startsWith("- name:")) {
					if (currentPillar.name) pillars.push(currentPillar as StrategyConfig["pillars"][number]);
					currentPillar = {
						name: trimmed
							.replace("- name:", "")
							.trim()
							.replace(/^["']|["']$/g, ""),
						weight: 1,
					};
				} else if (trimmed.startsWith("weight:")) {
					currentPillar.weight = Number(trimmed.replace("weight:", "").trim());
				}
			}

			if (section === "platforms") {
				if (trimmed.startsWith("- name:")) {
					if (currentPlatform.name)
						platforms.push(currentPlatform as StrategyConfig["platforms"][number]);
					currentPlatform = {
						name: trimmed
							.replace("- name:", "")
							.trim()
							.replace(/^["']|["']$/g, ""),
						frequency: 3,
					};
				} else if (trimmed.startsWith("frequency:")) {
					currentPlatform.frequency = Number(trimmed.replace("frequency:", "").trim());
				} else if (trimmed.startsWith("defaultLanguage:")) {
					currentPlatform.defaultLanguage = trimmed
						.replace("defaultLanguage:", "")
						.trim()
						.replace(/^["']|["']$/g, "");
				}
			}

			if (section === "languages") {
				if (trimmed.startsWith("primary:")) {
					languages.primary = trimmed
						.replace("primary:", "")
						.trim()
						.replace(/^["']|["']$/g, "");
				} else if (trimmed.startsWith("secondary:")) {
					languages.secondary = trimmed
						.replace("secondary:", "")
						.trim()
						.replace(/^["']|["']$/g, "");
				} else if (trimmed.startsWith("default:")) {
					languages.default = trimmed
						.replace("default:", "")
						.trim()
						.replace(/^["']|["']$/g, "");
				}
			}
		}

		// Push last items
		if (currentPillar.name) pillars.push(currentPillar as StrategyConfig["pillars"][number]);
		if (currentPlatform.name)
			platforms.push(currentPlatform as StrategyConfig["platforms"][number]);

		return {
			pillars: pillars.length > 0 ? pillars : [{ name: "general", weight: 1 }],
			platforms: platforms.length > 0 ? platforms : [{ name: "x", frequency: 7 }],
			languages,
		};
	} catch {
		return null;
	}
}

export { loadStrategyConfig };

// ─── Get Calendar State ──────────────────────────────────────────────────────

/**
 * Build the current week's calendar state showing scheduled posts,
 * due series episodes, gaps, and total weekly capacity.
 */
export async function getCalendarState(
	db: HubDb,
	userId: string,
	weekStart: Date,
	strategyPath?: string,
): Promise<CalendarState> {
	const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

	// Query posts scheduled within this week
	const scheduledRows = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.userId, userId),
				gte(posts.scheduledAt, weekStart),
				lte(posts.scheduledAt, weekEnd),
			),
		);

	const scheduledPosts = scheduledRows.map((p) => ({
		id: p.id,
		platform: p.platform,
		content: p.content.slice(0, 100),
		scheduledAt: p.scheduledAt ?? new Date(),
		status: p.status,
		language: p.language,
		seriesId: p.seriesId,
	}));

	// Get due series episodes
	const dueEpisodes = await getDueEpisodes(db, userId, weekEnd);
	const seriesDue = dueEpisodes.map((ep) => ({
		seriesId: ep.series.id,
		seriesName: ep.series.name,
		platform: ep.series.platform,
		nextDueDate: ep.nextDueDate,
		nextEpisodeLabel: ep.nextEpisodeLabel,
		pillar: ep.series.pillar,
	}));

	// Load strategy for capacity calculation
	const strategy = await loadStrategyConfig(strategyPath);
	const totalCapacity = strategy ? strategy.platforms.reduce((sum, p) => sum + p.frequency, 0) : 7; // default: 1 post/day

	// Identify gap days (days with no content scheduled)
	const scheduledDays = new Set<string>();
	for (const post of scheduledPosts) {
		const dateStr = post.scheduledAt.toISOString().split("T")[0];
		if (dateStr) {
			scheduledDays.add(dateStr);
		}
	}

	const gaps: string[] = [];
	for (let d = new Date(weekStart); d < weekEnd; d.setDate(d.getDate() + 1)) {
		const dayStr = d.toISOString().split("T")[0];
		if (dayStr && !scheduledDays.has(dayStr)) {
			gaps.push(dayStr);
		}
	}

	return {
		weekStart,
		weekEnd,
		scheduledPosts,
		seriesDue,
		gaps,
		totalCapacity,
	};
}
