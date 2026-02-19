import type { TikTokClient } from "./client.ts";
import { TikTokApiError, TikTokUploadExpiredError, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE, MAX_PHOTOS_PER_POST } from "./types.ts";

const DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB default
const STATUS_POLL_INTERVAL_MS = 5_000; // 5 seconds
const STATUS_POLL_MAX_ATTEMPTS = 60; // 5 minutes max

// ─── Video Upload ───────────────────────────────────────────────────────────

/**
 * Initialize a video upload with optimal chunk sizing.
 * Calculates chunk size within the 5MB-64MB range and initializes the upload.
 *
 * @param client - TikTokClient instance
 * @param videoSize - Total video file size in bytes
 * @param chunkSize - Optional override for chunk size (default 10MB)
 * @returns publishId, uploadUrl, totalChunks, chunkSize
 */
export async function initVideoUpload(
	client: TikTokClient,
	videoSize: number,
	chunkSize?: number,
): Promise<{
	publishId: string;
	uploadUrl: string;
	totalChunks: number;
	chunkSize: number;
}> {
	// Calculate optimal chunk size within valid range
	let effectiveChunkSize = chunkSize ?? DEFAULT_CHUNK_SIZE;
	effectiveChunkSize = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, effectiveChunkSize));

	const totalChunks = Math.ceil(videoSize / effectiveChunkSize);

	const result = await client.initVideoUpload(videoSize, effectiveChunkSize);

	return {
		publishId: result.publishId,
		uploadUrl: result.uploadUrl,
		totalChunks,
		chunkSize: effectiveChunkSize,
	};
}

/**
 * Upload video chunks sequentially using PUT requests with Content-Range headers.
 * Each chunk is sent as: bytes {start}-{end}/{total}
 *
 * Warns if estimated upload time exceeds 45 minutes based on a conservative
 * upload speed estimate.
 *
 * @param uploadUrl - URL from initVideoUpload
 * @param videoBuffer - Full video file as Buffer
 * @param chunkSize - Size of each chunk in bytes
 * @returns success status and number of chunks uploaded
 */
export async function uploadVideoChunks(
	uploadUrl: string,
	videoBuffer: Buffer,
	chunkSize: number,
): Promise<{ success: boolean; chunksUploaded: number }> {
	const totalSize = videoBuffer.length;
	const totalChunks = Math.ceil(totalSize / chunkSize);

	// Warn if estimated upload time is excessive (assuming ~1MB/s upload)
	const estimatedSeconds = totalSize / (1024 * 1024); // seconds at 1MB/s
	if (estimatedSeconds > 45 * 60) {
		console.warn(
			`[TikTok] Large video upload: ${totalChunks} chunks, estimated ${Math.round(estimatedSeconds / 60)} minutes. Consider compressing the video.`,
		);
	}

	let chunksUploaded = 0;

	for (let i = 0; i < totalChunks; i++) {
		const start = i * chunkSize;
		const end = Math.min(start + chunkSize - 1, totalSize - 1);
		const chunk = videoBuffer.subarray(start, end + 1);

		const response = await fetch(uploadUrl, {
			method: "PUT",
			headers: {
				"Content-Type": "video/mp4",
				"Content-Range": `bytes ${start}-${end}/${totalSize}`,
				"Content-Length": String(chunk.length),
			},
			body: chunk,
		});

		// Handle expired upload URLs (403 or 410)
		if (response.status === 403 || response.status === 410) {
			throw new TikTokUploadExpiredError();
		}

		if (!response.ok) {
			const bodyText = await response.text();
			throw new TikTokApiError(
				response.status,
				`Chunk ${i + 1}/${totalChunks} upload failed: ${bodyText}`,
			);
		}

		chunksUploaded++;
	}

	return { success: true, chunksUploaded };
}

// ─── Photo Posting ──────────────────────────────────────────────────────────

/**
 * Post photos via URL pull.
 * Validates photo count (max 35) and delegates to client.postPhotos.
 *
 * @param client - TikTokClient instance
 * @param params - Photo post parameters
 * @returns publishId for status tracking
 */
export async function postPhotos(
	client: TikTokClient,
	params: {
		title: string;
		description: string;
		photoUrls: string[];
	},
): Promise<string> {
	if (params.photoUrls.length === 0) {
		throw new TikTokApiError(400, "At least one photo URL is required");
	}

	if (params.photoUrls.length > MAX_PHOTOS_PER_POST) {
		throw new TikTokApiError(
			400,
			`Maximum ${MAX_PHOTOS_PER_POST} photos per post — received ${params.photoUrls.length}`,
		);
	}

	const result = await client.postPhotos(params);
	return result.data.publish_id;
}

// ─── Publish Status Polling ─────────────────────────────────────────────────

/**
 * Poll publish status until complete or failed.
 * Checks every 5 seconds, up to maxAttempts times (default 60 = 5 minutes).
 *
 * @param client - TikTokClient instance
 * @param publishId - Publish ID from upload/post
 * @param maxAttempts - Max polling attempts (default 60)
 * @returns Final status and publishId
 */
export async function checkPublishStatus(
	client: TikTokClient,
	publishId: string,
	maxAttempts = STATUS_POLL_MAX_ATTEMPTS,
): Promise<{ status: string; publishId: string; publicPostId?: string }> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const result = await client.getPublishStatus(publishId);
		const status = result.data.status;

		// Terminal states
		if (status === "PUBLISH_COMPLETE") {
			return {
				status,
				publishId,
				publicPostId: result.data.public_post_id,
			};
		}

		if (status === "FAILED") {
			throw new TikTokApiError(
				422,
				`Publish failed for ${publishId}: ${result.data.fail_reason ?? "unknown reason"}`,
			);
		}

		// Non-terminal states: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX
		// Wait before next poll
		await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
	}

	// Timed out
	throw new TikTokApiError(
		408,
		`Publish status for ${publishId} did not complete within ${maxAttempts * STATUS_POLL_INTERVAL_MS / 1000} seconds`,
	);
}
