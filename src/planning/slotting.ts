import type { CalendarState, PlanIdea, PlanSlot, StrategyConfig } from "./types.ts";

// ─── Angle Taxonomy (from topic-suggest.ts) ──────────────────────────────────

const _ANGLES = [
	"hot-take",
	"how-to",
	"story",
	"trend",
	"myth-busting",
	"comparison",
	"prediction",
	"behind-the-scenes",
	"tool-recommendation",
	"quick-tip",
];

// ─── Slotting Options ────────────────────────────────────────────────────────

export interface SlottingOptions {
	maxAngleRepeat?: number; // Max same angle per week (default: 2)
	strategyConfig?: StrategyConfig;
}

// ─── Allocate Slots ──────────────────────────────────────────────────────────

/**
 * Build a week's slot allocation:
 * 1. Series episodes auto-slotted first (locked into their platform's next available day)
 * 2. Distribute remaining slots weighted by pillar weights (round-robin)
 * 3. Archetype/angle balancing (no more than 2 of the same angle per week)
 * 4. Fill remaining gaps with ideas sorted by score/relevance
 */
export function allocateSlots(
	calendarState: CalendarState,
	ideas: PlanIdea[],
	seriesDue: CalendarState["seriesDue"],
	options?: SlottingOptions,
): PlanSlot[] {
	const maxAngle = options?.maxAngleRepeat ?? 2;
	const slots: PlanSlot[] = [];
	const usedDays = new Set<string>();
	const angleCount: Record<string, number> = {};
	const pillarCount: Record<string, number> = {};

	// Determine available days from gaps in the calendar
	const availableDays = [...calendarState.gaps];

	// 1. Series episodes get slotted first (PLAN-06)
	for (const ep of seriesDue) {
		const day = availableDays.shift();
		if (!day) break;

		usedDays.add(day);
		slots.push({
			day,
			platform: ep.platform,
			topic: `${ep.seriesName} ${ep.nextEpisodeLabel ?? ""}`.trim(),
			format: "short-post", // Default; series template overrides in drafting phase
			pillar: ep.pillar ?? "general",
			language: "en", // Will be updated by suggestLanguages
			seriesId: ep.seriesId,
			seriesEpisode: ep.nextEpisodeLabel,
			status: "outlined",
		});

		// Track pillar usage
		const p = ep.pillar ?? "general";
		pillarCount[p] = (pillarCount[p] ?? 0) + 1;
	}

	// 2. Build pillar weight distribution (PLAN-09)
	const pillarWeights = options?.strategyConfig?.pillars ?? [{ name: "general", weight: 1 }];
	const totalWeight = pillarWeights.reduce((sum, p) => sum + p.weight, 0);

	// Sort ideas by pillar need (weighted round-robin)
	const sortedIdeas = [...ideas].sort((a, b) => {
		// Prioritize pillars that are underrepresented
		const aWeight = pillarWeights.find((p) => p.name === a.pillar)?.weight ?? 1;
		const bWeight = pillarWeights.find((p) => p.name === b.pillar)?.weight ?? 1;
		const aCount = pillarCount[a.pillar] ?? 0;
		const bCount = pillarCount[b.pillar] ?? 0;

		// Target proportion based on weight
		const aTarget = (aWeight / totalWeight) * calendarState.totalCapacity;
		const bTarget = (bWeight / totalWeight) * calendarState.totalCapacity;

		// Deficit: how far below target
		const aDeficit = aTarget - aCount;
		const bDeficit = bTarget - bCount;

		// Higher deficit = more needed = sort first
		if (bDeficit !== aDeficit) return bDeficit - aDeficit;

		// Tiebreak: higher score first
		return (b.score ?? 0) - (a.score ?? 0);
	});

	// 3. Fill remaining slots with ideas, respecting angle limits (PLAN-10)
	for (const idea of sortedIdeas) {
		const day = availableDays.find((d) => !usedDays.has(d));
		if (!day) break;

		// Check angle limit
		const currentAngleCount = angleCount[idea.angle] ?? 0;
		if (currentAngleCount >= maxAngle) {
			// Skip this idea if angle is overused
			continue;
		}

		usedDays.add(day);
		angleCount[idea.angle] = currentAngleCount + 1;
		const p = idea.pillar;
		pillarCount[p] = (pillarCount[p] ?? 0) + 1;

		slots.push({
			day,
			platform: idea.format === "reel-script" ? "tiktok" : "x", // Default platform assignment
			topic: idea.topic,
			format: typeof idea.format === "string" ? idea.format : "short-post",
			pillar: idea.pillar,
			language: idea.language ?? "en",
			ideaId: idea.sourceId,
			status: "outlined",
		});
	}

	// Sort slots by day
	slots.sort((a, b) => a.day.localeCompare(b.day));

	return slots;
}
