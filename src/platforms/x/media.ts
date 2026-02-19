import { MediaUploadResponseSchema } from "./types.ts";

/**
 * Upload an image to X API v2 using simple media upload.
 * Uses FormData with Blob — does NOT set Content-Type header (browser sets multipart boundary).
 */
export async function uploadMedia(
	imageBuffer: Buffer,
	mimeType: string,
	accessToken: string,
): Promise<{ mediaId: string }> {
	const formData = new FormData();
	formData.append("media", new Blob([imageBuffer], { type: mimeType }));
	formData.append("media_category", "tweet_image");

	const response = await fetch("https://api.x.com/2/media/upload", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		body: formData,
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new Error(`Media upload failed (${response.status}): ${bodyText}`);
	}

	const json = await response.json();
	const result = MediaUploadResponseSchema.parse(json);

	return { mediaId: result.media_id };
}
