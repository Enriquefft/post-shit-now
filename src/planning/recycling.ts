import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { postMetrics, posts } from "../core/db/schema.ts";

// ─── Remix Suggestion ────────────────────────────────────────────────────────

export interface RemixSuggestion {
	originalPostId: string;
	originalPlatform: string;
	suggestedPlatform: string;
	topic: string;
	suggestedFormat: string;
}

// ─── Recycle Suggestion ──────────────────────────────────────────────────────

export interface RecycleSuggestion {
	originalPostId: string;
	topic: string;
	originalAngle: string;
	suggestedAngle: string;
	daysSincePublished: number;
}

// ─── Platform Remix Map ─────────────────────────────────────────────────────

const PLATFORM_REMIX_MAP: Record<string, { platform: string; format: string }[]> = {
	x: [
		{ platform: "linkedin", format: "carousel" },
		{ platform: "instagram", format: "reel-script" },
	],
	linkedin: [
		{ platform: "x", format: "thread" },
		{ platform: "tiktok", format: "reel-script" },
	],
	instagram: [
		{ platform: "x", format: "short-post" },
		{ platform: "linkedin", format: "carousel" },
	],
	tiktok: [
		{ platform: "x", format: "short-post" },
		{ platform: "instagram", format: "reel-script" },
	],
};

// ─── Angle Rotation for Recycling ───────────────────────────────────────────

const ANGLE_ROTATION: Record<string, string> = {
	"hot-take": "how-to",
	"how-to": "behind-the-scenes",
	story: "quick-tip",
	trend: "prediction",
	"myth-busting": "comparison",
	comparison: "story",
	prediction: "hot-take",
	"behind-the-scenes": "tool-recommendation",
	"tool-recommendation": "myth-busting",
	"quick-tip": "trend",
};

// ─── Get Remix Suggestions ──────────────────────────────────────────────────

/**
 * Query top-performing posts from the last 90 days and suggest
 * adapting them for different platforms.
 * E.g., a high-performing X thread could become a LinkedIn carousel.
 */
export async function getRemixSuggestions(
	db: HubDb,
	userId: string,
	limit = 3,
): Promise<RemixSuggestion[]> {
	const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

	try {
		const topPosts = await db
			.select()
			.from(postMetrics)
			.where(
				and(
					eq(postMetrics.userId, userId),
					gte(postMetrics.collectedAt, ninetyDaysAgo),
				),
			)
			.orderBy(desc(postMetrics.engagementScore))
			.limit(limit * 2); // Extra to allow filtering

		const suggestions: RemixSuggestion[] = [];

		for (const metric of topPosts) {
			if (suggestions.length >= limit) break;

			const remixOptions = PLATFORM_REMIX_MAP[metric.platform];
			if (!remixOptions || remixOptions.length === 0) continue;

			const remix = remixOptions[0]!;
			suggestions.push({
				originalPostId: metric.postId,
				originalPlatform: metric.platform,
				suggestedPlatform: remix.platform,
				topic: metric.postTopic ?? "Untitled",
				suggestedFormat: remix.format,
			});
		}

		return suggestions;
	} catch {
		return [];
	}
}

// ─── Get Recycle Suggestions ─────────────────────────────────────────────────

/**
 * Query top performers older than 60 days and suggest posting the
 * same core idea with a fresh angle.
 */
export async function getRecycleSuggestions(
	db: HubDb,
	userId: string,
	limit = 3,
): Promise<RecycleSuggestion[]> {
	const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
	const now = new Date();

	try {
		const oldTopPosts = await db
			.select()
			.from(postMetrics)
			.where(
				and(
					eq(postMetrics.userId, userId),
					lte(postMetrics.collectedAt, sixtyDaysAgo),
				),
			)
			.orderBy(desc(postMetrics.engagementScore))
			.limit(limit * 2);

		const suggestions: RecycleSuggestion[] = [];

		for (const metric of oldTopPosts) {
			if (suggestions.length >= limit) break;

			const originalAngle = metric.postFormat ?? "short-post";
			const suggestedAngle = ANGLE_ROTATION[originalAngle] ?? "how-to";
			const daysSince = Math.floor(
				(now.getTime() - metric.collectedAt.getTime()) / (24 * 60 * 60 * 1000),
			);

			suggestions.push({
				originalPostId: metric.postId,
				topic: metric.postTopic ?? "Untitled",
				originalAngle,
				suggestedAngle,
				daysSincePublished: daysSince,
			});
		}

		return suggestions;
	} catch {
		return [];
	}
}
