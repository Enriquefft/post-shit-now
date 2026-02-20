import type { InstagramClient } from "./client.ts";
import {
	InstagramApiError,
	type InstagramContainer,
	InstagramContainerSchema,
	type InstagramContainerStatus,
	InstagramContainerStatusSchema,
	type InstagramPublish,
	InstagramPublishSchema,
} from "./types.ts";

// ─── Container Creation ─────────────────────────────────────────────────────

/**
 * Create a feed image container.
 * POST /{accountId}/media with image_url and caption.
 *
 * The container must be polled until FINISHED before publishing.
 */
export async function createImageContainer(
	client: InstagramClient,
	imageUrl: string,
	caption: string,
): Promise<InstagramContainer> {
	return client.post(
		`/${client.getAccountId()}/media`,
		{
			image_url: imageUrl,
			caption,
		},
		InstagramContainerSchema,
	);
}

/**
 * Create a Reels container.
 * POST /{accountId}/media with media_type=REELS, video_url, caption, share_to_feed=true.
 */
export async function createReelsContainer(
	client: InstagramClient,
	videoUrl: string,
	caption: string,
): Promise<InstagramContainer> {
	return client.post(
		`/${client.getAccountId()}/media`,
		{
			media_type: "REELS",
			video_url: videoUrl,
			caption,
			share_to_feed: "true",
		},
		InstagramContainerSchema,
	);
}

/**
 * Create carousel containers (2-10 images).
 * Step 1: Create child containers (is_carousel_item=true) for each image
 * Step 2: Wait for each child to be ready
 * Step 3: Create parent container with media_type=CAROUSEL and children IDs
 *
 * Returns the parent carousel container (ready for publishing).
 */
export async function createCarouselContainers(
	client: InstagramClient,
	imageUrls: string[],
	caption: string,
): Promise<InstagramContainer> {
	// Validate carousel size (2-10 images required)
	if (imageUrls.length < 2 || imageUrls.length > 10) {
		throw new InstagramApiError(400, `Carousel requires 2-10 images, got ${imageUrls.length}`);
	}

	// Step 1: Create child containers
	const childIds: string[] = [];
	for (const imageUrl of imageUrls) {
		const child = await client.post(
			`/${client.getAccountId()}/media`,
			{
				image_url: imageUrl,
				is_carousel_item: "true",
			},
			InstagramContainerSchema,
		);
		childIds.push(child.id);
	}

	// Step 2: Wait for each child to be ready
	for (const childId of childIds) {
		await waitForContainerReady(client, childId);
	}

	// Step 3: Create parent carousel container
	return client.post(
		`/${client.getAccountId()}/media`,
		{
			media_type: "CAROUSEL",
			children: childIds.join(","),
			caption,
		},
		InstagramContainerSchema,
	);
}

// ─── Container Status Polling ───────────────────────────────────────────────

/**
 * Poll container status until FINISHED or ERROR.
 * Instagram requires containers to be processed before publishing.
 *
 * Following waitForMediaReady pattern from LinkedIn media.ts:
 * - Poll every 5 seconds
 * - Max 60 attempts (5 minutes)
 * - Throw on ERROR or timeout
 */
export async function waitForContainerReady(
	client: InstagramClient,
	containerId: string,
	maxAttempts = 60,
): Promise<InstagramContainerStatus> {
	const pollIntervalMs = 5_000; // 5 seconds

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const status = await client.request<InstagramContainerStatus>(
			`/${containerId}?fields=id,status_code`,
			{ method: "GET" },
			InstagramContainerStatusSchema,
		);

		if (status.status_code === "FINISHED") {
			return status;
		}

		if (status.status_code === "ERROR") {
			throw new InstagramApiError(
				422,
				`Container ${containerId} processing failed with status ERROR`,
			);
		}

		// IN_PROGRESS — wait before next poll
		if (attempt < maxAttempts - 1) {
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		}
	}

	throw new InstagramApiError(
		408,
		`Container ${containerId} did not become FINISHED within ${(maxAttempts * pollIntervalMs) / 1000} seconds`,
	);
}

// ─── Container Publishing ───────────────────────────────────────────────────

/**
 * Publish a ready container.
 * POST /{accountId}/media_publish with creation_id.
 *
 * The container must have status_code=FINISHED before publishing.
 */
export async function publishContainer(
	client: InstagramClient,
	containerId: string,
): Promise<InstagramPublish> {
	return client.post(
		`/${client.getAccountId()}/media_publish`,
		{
			creation_id: containerId,
		},
		InstagramPublishSchema,
	);
}
