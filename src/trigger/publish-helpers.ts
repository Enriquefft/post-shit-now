import type { DbConnection, PostRow } from "@psn/core/types/publisher.ts";
import { logger } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import type { PostMetadata } from "../core/db/schema.ts";
import { posts, preferenceModel } from "../core/db/schema.ts";
import { recordEpisodePublished } from "../series/episodes.ts";

/**
 * Helper to mark a post as failed with a reason.
 */
export async function markFailed(
	db: DbConnection,
	postId: string,
	failReason: string,
	extraMetadata?: Record<string, unknown>,
) {
	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
	const existingMetadata = post?.metadata ?? {};

	await db
		.update(posts)
		.set({
			status: "failed",
			subStatus: null,
			failReason,
			updatedAt: new Date(),
			metadata: {
				...existingMetadata,
				...extraMetadata,
				failedAt: new Date().toISOString(),
			},
		})
		.where(eq(posts.id, postId));

	logger.error("Post marked as failed", { postId, failReason });
}

/**
 * Advance series state after a successful publish.
 */
export async function advanceSeriesState(db: DbConnection, post: PostRow) {
	const { id, seriesId } = post;
	if (!seriesId) return;

	try {
		await recordEpisodePublished(db, seriesId);
		logger.info("Series state advanced", { postId: id, seriesId });
	} catch (error) {
		logger.error("Failed to advance series state (publish succeeded)", {
			postId: id,
			seriesId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Update company brand preference model after successful publish.
 * The brand preference model is shared across all team members in a Company Hub.
 * Uses userId = hubId for company-level preference records.
 */
export async function updateBrandPreferenceIfCompany(db: DbConnection, post: PostRow) {
	const metadata: PostMetadata = post.metadata ?? {};
	const hubId = metadata.hubId;
	if (!hubId) return;

	try {
		const platform = post.platform;
		const postFormat = metadata.format ?? "text";
		const postPillar = metadata.pillar ?? "general";

		const [existing] = await db
			.select()
			.from(preferenceModel)
			.where(eq(preferenceModel.userId, hubId))
			.limit(1);

		if (!existing) {
			await db.insert(preferenceModel).values({
				userId: hubId,
				topFormats: [{ format: postFormat, avgScore: 0 }],
				topPillars: [{ pillar: postPillar, avgScore: 0 }],
				bestPostingTimes: [],
				updatedAt: new Date(),
			});
			logger.info("Brand preference model created", { hubId, platform });
		} else {
			const topFormats = existing.topFormats ?? [];
			const topPillars = existing.topPillars ?? [];

			const formatEntry = topFormats.find((f) => f.format === postFormat);
			if (!formatEntry) {
				topFormats.push({ format: postFormat, avgScore: 0 });
			}

			const pillarEntry = topPillars.find((p) => p.pillar === postPillar);
			if (!pillarEntry) {
				topPillars.push({ pillar: postPillar, avgScore: 0 });
			}

			await db
				.update(preferenceModel)
				.set({ topFormats, topPillars, updatedAt: new Date() })
				.where(eq(preferenceModel.userId, hubId));

			logger.info("Brand preference model updated", {
				hubId,
				format: postFormat,
				pillar: postPillar,
			});
		}
	} catch (error) {
		logger.error("Failed to update brand preference model (publish succeeded)", {
			postId: post.id,
			hubId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
