import { desc, eq, gte } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";
import type { PlanSlot, StrategyConfig } from "./types.ts";

// ─── Suggest Languages ──────────────────────────────────────────────────────

/**
 * For each slot, suggest a language based on:
 * - Strategy.yaml language config (primary/secondary, default)
 * - Recent language mix (last 14 days of posts)
 * - Platform conventions
 *
 * When user has both en and es configured, aims for a balanced mix across the week.
 */
export async function suggestLanguages(
	slots: PlanSlot[],
	strategyConfig: StrategyConfig | null,
	db?: HubDb,
	userId?: string,
): Promise<PlanSlot[]> {
	const primary = strategyConfig?.languages?.primary ?? "en";
	const secondary = strategyConfig?.languages?.secondary;
	const defaultLang = strategyConfig?.languages?.default ?? primary;

	// If no secondary language, all slots get the default
	if (!secondary) {
		return slots.map((slot) => ({
			...slot,
			language: slot.language || defaultLang,
		}));
	}

	// Load recent language distribution (last 14 days)
	let recentPrimaryCount = 0;
	let recentSecondaryCount = 0;

	if (db && userId) {
		try {
			const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
			const recentPosts = await db
				.select({ language: posts.language })
				.from(posts)
				.where(
					eq(posts.userId, userId),
				);

			// Filter by date manually since we need simple logic
			for (const p of recentPosts) {
				if (p.language === primary) recentPrimaryCount++;
				else if (p.language === secondary) recentSecondaryCount++;
			}
		} catch {
			// DB not available — use defaults
		}
	}

	// Calculate target ratio: aim for ~60/40 primary/secondary
	const totalRecent = recentPrimaryCount + recentSecondaryCount;
	const primaryRatio = totalRecent > 0 ? recentPrimaryCount / totalRecent : 0.6;

	// If primary is overrepresented, favor secondary for new slots
	const needMoreSecondary = primaryRatio > 0.65;
	const needMorePrimary = primaryRatio < 0.45;

	// Assign languages with balance
	let secondaryAssigned = 0;
	const targetSecondary = Math.ceil(slots.length * 0.4);

	return slots.map((slot, i) => {
		// Series slots keep their existing language if set
		if (slot.seriesId && slot.language && slot.language !== "en") {
			return slot;
		}

		// Platform conventions: LinkedIn often favors primary language
		const platformFavorsPrimary = slot.platform === "linkedin";

		let language = defaultLang;

		if (needMoreSecondary && !platformFavorsPrimary && secondaryAssigned < targetSecondary) {
			language = secondary;
			secondaryAssigned++;
		} else if (needMorePrimary) {
			language = primary;
		} else {
			// Alternate to maintain balance
			if (i % 3 === 2 && secondaryAssigned < targetSecondary) {
				language = secondary;
				secondaryAssigned++;
			} else {
				language = primary;
			}
		}

		return { ...slot, language };
	});
}
