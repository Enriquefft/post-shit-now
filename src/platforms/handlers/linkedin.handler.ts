import { logger, wait } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { type OAuthTokenMetadata, oauthTokens } from "../../core/db/schema.ts";
import type { PlatformPublishResult, PostMetadata } from "../../core/types/index.ts";
import type { DbConnection, PostRow, RateLimitInfo } from "../../core/types/publisher.ts";
import type { PlatformPublisher } from "../../core/types/publisher.ts";
import { decrypt, encrypt } from "../../core/utils/crypto.ts";
import { registerHandler } from "../../core/utils/publisher-factory.ts";
import { LinkedInClient } from "../linkedin/client.ts";
import {
	initializeDocumentUpload,
	initializeImageUpload,
	uploadDocumentBinary,
	uploadImageBinary,
	waitForMediaReady,
} from "../linkedin/media.ts";
import {
	createLinkedInOAuthClient,
	refreshAccessToken as refreshLinkedInToken,
} from "../linkedin/oauth.ts";
import { LinkedInRateLimitError } from "../linkedin/types.ts";

const stringArraySchema = z.array(z.string());

export class LinkedInHandler implements PlatformPublisher {
	private currentRateLimit: RateLimitInfo | null = null;

	async publish(db: DbConnection, post: PostRow, encKey: Buffer): Promise<PlatformPublishResult> {
		const { id: postId, userId, content } = post;
		const mediaUrls = post.mediaUrls ?? [];
		const metadata = (post.metadata ?? {}) as PostMetadata & {
			linkedinFormat?: string;
			linkedinVisibility?: string;
			carouselTitle?: string;
			imageAltText?: string;
			articleUrl?: string;
			articleTitle?: string;
			articleDescription?: string;
		};

		const linkedInClientId = process.env.LINKEDIN_CLIENT_ID;
		const linkedInClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
		if (!linkedInClientId || !linkedInClientSecret) {
			return { platform: "linkedin", status: "failed", error: "LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET not set" };
		}

		// Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'linkedin'`)
			.limit(1);
		if (!token) return { platform: "linkedin", status: "failed", error: "no_linkedin_oauth_token" };

		// Refresh token if expired
		let accessTokenEncrypted = token.accessToken;
		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				return { platform: "linkedin", status: "failed", error: "linkedin_token_expired_no_refresh" };
			}
			const linkedInOAuthClient = createLinkedInOAuthClient({
				clientId: linkedInClientId,
				clientSecret: linkedInClientSecret,
				callbackUrl: "https://example.com/callback",
			});
			const decryptedRefresh = decrypt(token.refreshToken, encKey);
			const newTokens = await refreshLinkedInToken(linkedInOAuthClient, decryptedRefresh);
			const encryptedAccess = encrypt(newTokens.accessToken, encKey);
			const encryptedRefresh = encrypt(newTokens.refreshToken, encKey);
			await db.execute(sql`
				UPDATE oauth_tokens
				SET access_token = ${encryptedAccess},
				    refresh_token = ${encryptedRefresh},
				    expires_at = ${newTokens.expiresAt},
				    updated_at = NOW(),
				    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{lastRefreshAt}', ${JSON.stringify(new Date().toISOString())}::jsonb)
				WHERE id = ${token.id}
			`);
			accessTokenEncrypted = encryptedAccess;
			logger.info("LinkedIn token refreshed inline during publish", { postId });
		}

		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const client = new LinkedInClient(accessToken);

		const tokenMetadata: OAuthTokenMetadata = token.metadata ?? {};
		const personUrn = tokenMetadata.personUrn;
		if (!personUrn) {
			return { platform: "linkedin", status: "failed", error: "person_urn_not_found_in_token_metadata" };
		}

		const linkedinFormat = metadata.linkedinFormat ?? metadata.format ?? "text";
		const visibility = (metadata.linkedinVisibility ?? "PUBLIC") as "PUBLIC" | "CONNECTIONS";

		let commentary: string;
		try {
			const parsed = JSON.parse(content);
			commentary = Array.isArray(parsed) ? stringArraySchema.parse(parsed).join("\n\n") : content;
		} catch {
			commentary = content;
		}

		try {
			const linkedInPostId = await this.publishByFormat(
				client, accessToken, personUrn, commentary, visibility, linkedinFormat, mediaUrls, metadata
			);
			logger.info("LinkedIn post published", { postId, linkedInPostId, format: linkedinFormat });
			return { platform: "linkedin", status: "published", externalPostId: linkedInPostId };
		} catch (error) {
			if (error instanceof LinkedInRateLimitError && error.rateLimit) {
				logger.warn("LinkedIn rate limited, waiting", { postId, resetAt: error.rateLimit.resetAt.toISOString() });
				await wait.until({ date: error.rateLimit.resetAt });
				throw error;
			}
			throw error;
		}
	}

	private async publishByFormat(
		client: LinkedInClient,
		accessToken: string,
		personUrn: string,
		commentary: string,
		visibility: "PUBLIC" | "CONNECTIONS",
		format: string,
		mediaUrls: string[],
		metadata: { carouselTitle?: string; imageAltText?: string; articleUrl?: string; articleTitle?: string; articleDescription?: string },
	): Promise<string> {
		switch (format) {
			case "carousel":
			case "document": {
				if (!mediaUrls.length) return client.createTextPost(personUrn, commentary, visibility);
				const pdfBuffer = new Uint8Array(await Bun.file(mediaUrls[0] ?? "").arrayBuffer());
				const docUpload = await initializeDocumentUpload(accessToken, personUrn);
				await uploadDocumentBinary(docUpload.uploadUrl, accessToken, pdfBuffer);
				await waitForMediaReady(accessToken, docUpload.documentUrn, "document");
				return client.createDocumentPost(personUrn, commentary, docUpload.documentUrn, metadata.carouselTitle, visibility);
			}
			case "image-post":
			case "image": {
				if (!mediaUrls.length) return client.createTextPost(personUrn, commentary, visibility);
				if (mediaUrls.length === 1) {
					const imgBuffer = new Uint8Array(await Bun.file(mediaUrls[0] ?? "").arrayBuffer());
					const imgUpload = await initializeImageUpload(accessToken, personUrn);
					await uploadImageBinary(imgUpload.uploadUrl, accessToken, imgBuffer);
					await waitForMediaReady(accessToken, imgUpload.imageUrn, "image");
					return client.createImagePost(personUrn, commentary, imgUpload.imageUrn, metadata.imageAltText, visibility);
				}
				const imageUrns: string[] = [];
				for (const imgPath of mediaUrls) {
					const imgBuffer = new Uint8Array(await Bun.file(imgPath).arrayBuffer());
					const imgUpload = await initializeImageUpload(accessToken, personUrn);
					await uploadImageBinary(imgUpload.uploadUrl, accessToken, imgBuffer);
					await waitForMediaReady(accessToken, imgUpload.imageUrn, "image");
					imageUrns.push(imgUpload.imageUrn);
				}
				return client.createMultiImagePost(personUrn, commentary, imageUrns, visibility);
			}
			case "article":
			case "linkedin-article": {
				const articleUrl = metadata.articleUrl ?? "";
				if (!articleUrl) return client.createTextPost(personUrn, commentary, visibility);
				return client.createArticlePost(personUrn, commentary, articleUrl, metadata.articleTitle ?? "", metadata.articleDescription ?? "", undefined, visibility);
			}
			default:
				return client.createTextPost(personUrn, commentary, visibility);
		}
	}

	async validateCredentials(): Promise<boolean> { return true; }
	getRateLimitInfo(): RateLimitInfo | null { return this.currentRateLimit; }
	async refreshCredentials(_db: DbConnection, _encKey: Buffer): Promise<void> {}
	isRateLimited(): boolean { return this.currentRateLimit?.remaining === 0; }
	getRetryAfter(): number {
		if (!this.currentRateLimit) return 0;
		return Math.max(0, Math.ceil((this.currentRateLimit.resetAt.getTime() - Date.now()) / 1000));
	}
}

// Auto-register
registerHandler("linkedin", LinkedInHandler as unknown as new (...args: unknown[]) => PlatformPublisher);
