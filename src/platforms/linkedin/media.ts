import { z } from "zod/v4";
import {
	LinkedInApiError,
	LinkedInDocumentUploadResponseSchema,
	LinkedInImageUploadResponseSchema,
} from "./types.ts";

// ─── Image Upload ───────────────────────────────────────────────────────────

/**
 * Initialize an image upload on LinkedIn.
 * Step 1 of the two-step upload flow.
 * Returns the upload URL and image URN for the binary upload step.
 */
export async function initializeImageUpload(
	accessToken: string,
	ownerUrn: string,
	version = "202602",
): Promise<{ uploadUrl: string; imageUrn: string; expiresAt: number }> {
	const response = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			"LinkedIn-Version": version,
			"X-Restli-Protocol-Version": "2.0.0",
		},
		body: JSON.stringify({
			initializeUploadRequest: {
				owner: ownerUrn,
			},
		}),
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Image upload init failed: ${bodyText}`);
	}

	const json = await response.json();
	const parsed = LinkedInImageUploadResponseSchema.parse(json);

	return {
		uploadUrl: parsed.value.uploadUrl,
		imageUrn: parsed.value.image,
		expiresAt: parsed.value.uploadUrlExpiresAt,
	};
}

/**
 * Upload image binary data to the upload URL.
 * Step 2 of the two-step upload flow.
 * PUT request with the raw binary data.
 */
export async function uploadImageBinary(
	uploadUrl: string,
	accessToken: string,
	imageBuffer: Uint8Array | Buffer,
): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/octet-stream",
		},
		body: imageBuffer,
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Image binary upload failed: ${bodyText}`);
	}
}

/**
 * Check image processing status.
 * After upload, LinkedIn needs time to process the image.
 */
export async function getImageStatus(
	accessToken: string,
	imageUrn: string,
	version = "202602",
): Promise<string> {
	const encodedUrn = encodeURIComponent(imageUrn);
	const response = await fetch(`https://api.linkedin.com/rest/images/${encodedUrn}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"LinkedIn-Version": version,
			"X-Restli-Protocol-Version": "2.0.0",
		},
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Image status check failed: ${bodyText}`);
	}

	const json: unknown = await response.json();
	const statusSchema = z.object({ status: z.string().optional() });
	return statusSchema.parse(json).status ?? "UNKNOWN";
}

// ─── Document Upload ────────────────────────────────────────────────────────

/**
 * Initialize a document upload on LinkedIn.
 * Step 1 of the two-step upload flow.
 * Used for carousel posts (PDF documents).
 */
export async function initializeDocumentUpload(
	accessToken: string,
	ownerUrn: string,
	version = "202602",
): Promise<{ uploadUrl: string; documentUrn: string; expiresAt: number }> {
	const response = await fetch("https://api.linkedin.com/rest/documents?action=initializeUpload", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
			"LinkedIn-Version": version,
			"X-Restli-Protocol-Version": "2.0.0",
		},
		body: JSON.stringify({
			initializeUploadRequest: {
				owner: ownerUrn,
			},
		}),
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Document upload init failed: ${bodyText}`);
	}

	const json = await response.json();
	const parsed = LinkedInDocumentUploadResponseSchema.parse(json);

	return {
		uploadUrl: parsed.value.uploadUrl,
		documentUrn: parsed.value.document,
		expiresAt: parsed.value.uploadUrlExpiresAt,
	};
}

/**
 * Upload document binary data to the upload URL.
 * Step 2 of the two-step upload flow.
 */
export async function uploadDocumentBinary(
	uploadUrl: string,
	accessToken: string,
	documentBuffer: Uint8Array | Buffer,
): Promise<void> {
	const response = await fetch(uploadUrl, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/octet-stream",
		},
		body: documentBuffer,
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Document binary upload failed: ${bodyText}`);
	}
}

/**
 * Check document processing status.
 */
export async function getDocumentStatus(
	accessToken: string,
	documentUrn: string,
	version = "202602",
): Promise<string> {
	const encodedUrn = encodeURIComponent(documentUrn);
	const response = await fetch(`https://api.linkedin.com/rest/documents/${encodedUrn}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"LinkedIn-Version": version,
			"X-Restli-Protocol-Version": "2.0.0",
		},
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new LinkedInApiError(response.status, `Document status check failed: ${bodyText}`);
	}

	const json: unknown = await response.json();
	const statusSchema = z.object({ status: z.string().optional() });
	return statusSchema.parse(json).status ?? "UNKNOWN";
}

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/**
 * Wait for media (image or document) to become AVAILABLE after upload.
 * LinkedIn needs processing time — polls status at intervals.
 *
 * @param accessToken - LinkedIn access token
 * @param urn - Image or document URN
 * @param type - "image" or "document"
 * @param maxWaitMs - Maximum wait time (default 60 seconds)
 * @param intervalMs - Poll interval (default 2 seconds)
 */
export async function waitForMediaReady(
	accessToken: string,
	urn: string,
	type: "image" | "document",
	maxWaitMs = 60_000,
	intervalMs = 2_000,
): Promise<void> {
	const start = Date.now();
	const statusFn = type === "image" ? getImageStatus : getDocumentStatus;

	while (Date.now() - start < maxWaitMs) {
		const status = await statusFn(accessToken, urn);

		if (status === "AVAILABLE") {
			return;
		}

		if (status === "PROCESSING_FAILED" || status === "UPLOAD_FAILED") {
			throw new LinkedInApiError(422, `Media processing failed for ${urn}: status=${status}`);
		}

		// Wait before next poll
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new LinkedInApiError(408, `Media ${urn} did not become AVAILABLE within ${maxWaitMs}ms`);
}
