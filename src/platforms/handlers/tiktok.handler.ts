import { logger, wait } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { type OAuthTokenMetadata, oauthTokens, posts } from "../../core/db/schema.ts";
import type { PlatformPublishResult, PostMetadata } from "../../core/types/index.ts";
import type {
	DbConnection,
	PlatformPublisher,
	PostRow,
	RateLimitInfo,
} from "../../core/types/publisher.ts";
import { decrypt, encrypt } from "../../core/utils/crypto.ts";
import { registerHandler } from "../../core/utils/publisher-factory.ts";
import { TikTokClient } from "../tiktok/client.ts";
import {
	checkPublishStatus,
	initVideoUpload,
	postPhotos,
	uploadVideoChunks,
} from "../tiktok/media.ts";
import { createTikTokOAuthClient, refreshTikTokToken } from "../tiktok/oauth.ts";
import { TikTokRateLimitError } from "../tiktok/types.ts";

const stringArraySchema = z.array(z.string());

export class TikTokHandler implements PlatformPublisher {
	private currentRateLimit: RateLimitInfo | null = null;

	async publish(db: DbConnection, post: PostRow, encKey: Buffer): Promise<PlatformPublishResult> {
		const { id: postId, userId, content } = post;
		const mediaUrls = post.mediaUrls ?? [];
		const metadata = (post.metadata ?? {}) as PostMetadata & {
			tiktokFormat?: string;
			tiktokTitle?: string;
		};

		const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY;
		const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET;
		if (!tiktokClientKey || !tiktokClientSecret) {
			return {
				platform: "tiktok",
				status: "failed",
				error: "TIKTOK_CLIENT_KEY or TIKTOK_CLIENT_SECRET not set",
			};
		}

		// Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'tiktok'`)
			.limit(1);
		if (!token) return { platform: "tiktok", status: "failed", error: "no_tiktok_oauth_token" };

		// Refresh token if expired
		let accessTokenEncrypted = token.accessToken;
		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				return { platform: "tiktok", status: "failed", error: "tiktok_token_expired_no_refresh" };
			}
			const tiktokOAuthClient = createTikTokOAuthClient({
				clientKey: tiktokClientKey,
				clientSecret: tiktokClientSecret,
				callbackUrl: "https://example.com/callback",
			});
			const decryptedRefresh = decrypt(token.refreshToken, encKey);
			const newTokens = await refreshTikTokToken(tiktokOAuthClient, decryptedRefresh);
			// TikTok rotates BOTH tokens on refresh
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
			logger.info("TikTok token refreshed inline during publish", { postId });
		}

		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const tokenMetadata: OAuthTokenMetadata = token.metadata ?? {};
		const auditStatus = tokenMetadata.auditStatus ?? "unaudited";
		const client = new TikTokClient(accessToken, { auditStatus });

		let description: string;
		try {
			const parsed = JSON.parse(content);
			description = Array.isArray(parsed) ? stringArraySchema.parse(parsed).join("\n\n") : content;
		} catch {
			description = content;
		}

		const title = metadata.tiktokTitle ?? description.slice(0, 90);
		const tiktokFormat = metadata.tiktokFormat ?? metadata.format ?? "video-post";

		try {
			const publishId = await this.publishByFormat(
				db,
				postId,
				client,
				tiktokFormat,
				mediaUrls,
				title,
				description,
				auditStatus,
			);
			logger.info("TikTok post published", {
				postId,
				publishId,
				format: tiktokFormat,
				auditStatus,
			});
			return { platform: "tiktok", status: "published", externalPostId: publishId };
		} catch (error) {
			if (error instanceof TikTokRateLimitError && error.rateLimit) {
				logger.warn("TikTok rate limited, waiting", {
					postId,
					resetAt: error.rateLimit.resetAt.toISOString(),
				});
				await wait.until({ date: error.rateLimit.resetAt });
				throw error;
			}
			throw error;
		}
	}

	private async publishByFormat(
		db: DbConnection,
		postId: string,
		client: TikTokClient,
		format: string,
		mediaUrls: string[],
		title: string,
		description: string,
		auditStatus: string,
	): Promise<string> {
		switch (format) {
			case "reel-script":
			case "video-post":
			case "video": {
				if (!mediaUrls.length) throw new Error("tiktok_video_requires_media");
				const videoBuffer = Buffer.from(await Bun.file(mediaUrls[0] ?? "").arrayBuffer());
				await db
					.update(posts)
					.set({ subStatus: "media_uploading", updatedAt: new Date() })
					.where(eq(posts.id, postId));
				const upload = await initVideoUpload(client, videoBuffer.length);
				await uploadVideoChunks(upload.uploadUrl, videoBuffer, upload.chunkSize);
				await db
					.update(posts)
					.set({ subStatus: "media_uploaded", updatedAt: new Date() })
					.where(eq(posts.id, postId));
				const status = await checkPublishStatus(client, upload.publishId);
				const publishId = status.publicPostId ?? upload.publishId;
				if (auditStatus === "unaudited") {
					logger.info("TikTok video uploaded as SELF_ONLY draft (unaudited app)", {
						postId,
						publishId,
					});
				}
				return publishId;
			}
			case "photo": {
				if (!mediaUrls.length) throw new Error("tiktok_photo_requires_media_urls");
				const publishId = await postPhotos(client, { title, description, photoUrls: mediaUrls });
				if (auditStatus === "unaudited") {
					logger.info("TikTok photo posted as SELF_ONLY draft (unaudited app)", {
						postId,
						publishId,
					});
				}
				return publishId;
			}
			default: {
				if (!mediaUrls.length) throw new Error("tiktok_requires_media");
				const videoBuffer = Buffer.from(await Bun.file(mediaUrls[0] ?? "").arrayBuffer());
				const upload = await initVideoUpload(client, videoBuffer.length);
				await uploadVideoChunks(upload.uploadUrl, videoBuffer, upload.chunkSize);
				const status = await checkPublishStatus(client, upload.publishId);
				return status.publicPostId ?? upload.publishId;
			}
		}
	}

	async validateCredentials(): Promise<boolean> {
		return true;
	}
	getRateLimitInfo(): RateLimitInfo | null {
		return this.currentRateLimit;
	}
	async refreshCredentials(_db: DbConnection, _encKey: Buffer): Promise<void> {}
	isRateLimited(): boolean {
		return this.currentRateLimit?.remaining === 0;
	}
	getRetryAfter(): number {
		if (!this.currentRateLimit) return 0;
		return Math.max(0, Math.ceil((this.currentRateLimit.resetAt.getTime() - Date.now()) / 1000));
	}
}

// Auto-register
registerHandler(
	"tiktok",
	TikTokHandler as unknown as new (
		...args: unknown[]
	) => PlatformPublisher,
);
