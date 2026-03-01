import { logger, wait } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
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
import { InstagramClient } from "../instagram/client.ts";
import {
	createCarouselContainers,
	createImageContainer,
	createReelsContainer,
	publishContainer,
	waitForContainerReady,
} from "../instagram/media.ts";
import { refreshInstagramToken } from "../instagram/oauth.ts";
import {
	InstagramRateLimitError,
	MAX_POSTS_PER_DAY,
	MAX_REQUESTS_PER_HOUR,
} from "../instagram/types.ts";

const stringArraySchema = z.array(z.string());

export class InstagramHandler implements PlatformPublisher {
	private currentRateLimit: RateLimitInfo | null = null;
	private requestCount = 0;
	private windowStart = Date.now();

	async publish(db: DbConnection, post: PostRow, encKey: Buffer): Promise<PlatformPublishResult> {
		const { id: postId, userId, content } = post;
		const mediaUrls = post.mediaUrls ?? [];
		const metadata = (post.metadata ?? {}) as PostMetadata & { instagramFormat?: string };

		const instagramAppId = process.env.INSTAGRAM_APP_ID;
		const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET;
		if (!instagramAppId || !instagramAppSecret) {
			return {
				platform: "instagram",
				status: "failed",
				error: "INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET not set",
			};
		}

		// Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'instagram'`)
			.limit(1);
		if (!token)
			return { platform: "instagram", status: "failed", error: "no_instagram_oauth_token" };

		// Refresh token if expired (Instagram uses access token itself, not refresh token)
		let accessTokenEncrypted = token.accessToken;
		if (token.expiresAt && token.expiresAt < new Date()) {
			const decryptedAccess = decrypt(token.accessToken, encKey);
			try {
				const refreshed = await refreshInstagramToken(decryptedAccess);
				const encryptedAccess = encrypt(refreshed.accessToken, encKey);
				const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
				await db.execute(sql`
					UPDATE oauth_tokens
					SET access_token = ${encryptedAccess},
					    expires_at = ${expiresAt},
					    updated_at = NOW(),
					    metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{lastRefreshAt}', ${JSON.stringify(new Date().toISOString())}::jsonb)
					WHERE id = ${token.id}
				`);
				accessTokenEncrypted = encryptedAccess;
				logger.info("Instagram token refreshed inline during publish", { postId });
			} catch (error) {
				return {
					platform: "instagram",
					status: "failed",
					error: `instagram_token_refresh_failed: ${error instanceof Error ? error.message : String(error)}`,
				};
			}
		}

		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const tokenMetadata: OAuthTokenMetadata = token.metadata ?? {};
		const accountId = tokenMetadata.accountId;
		if (!accountId) {
			return {
				platform: "instagram",
				status: "failed",
				error: "instagram_account_id_not_in_token_metadata",
			};
		}

		// Check daily post limit
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayPosts = await db
			.select()
			.from(posts)
			.where(
				sql`${posts.userId} = ${userId} AND ${posts.platform} = 'instagram' AND ${posts.status} = 'published' AND ${posts.publishedAt} >= ${todayStart}`,
			);
		if (todayPosts.length >= MAX_POSTS_PER_DAY) {
			return {
				platform: "instagram",
				status: "failed",
				error: `instagram_daily_limit_reached_${MAX_POSTS_PER_DAY}`,
			};
		}

		const client = new InstagramClient(accessToken, accountId);

		let caption: string;
		try {
			const parsed = JSON.parse(content);
			caption = Array.isArray(parsed) ? stringArraySchema.parse(parsed).join("\n\n") : content;
		} catch {
			caption = content;
		}

		const instagramFormat = metadata.instagramFormat ?? metadata.format ?? "image-post";

		try {
			const publishedMediaId = await this.publishByFormat(
				client,
				instagramFormat,
				mediaUrls,
				caption,
			);
			// Each publish cycle involves ~3 API calls (create container, poll status, publish)
			this.updateRateLimit(3);
			logger.info("Instagram post published", {
				postId,
				publishedMediaId,
				format: instagramFormat,
			});
			return { platform: "instagram", status: "published", externalPostId: publishedMediaId };
		} catch (error) {
			if (error instanceof InstagramRateLimitError && error.rateLimit) {
				logger.warn("Instagram rate limited, waiting", {
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
		client: InstagramClient,
		format: string,
		mediaUrls: string[],
		caption: string,
	): Promise<string> {
		switch (format) {
			case "reel-script":
			case "reel":
			case "video-post": {
				if (!mediaUrls.length) throw new Error("reel_requires_video_url");
				const container = await createReelsContainer(client, mediaUrls[0] ?? "", caption);
				await waitForContainerReady(client, container.id);
				const published = await publishContainer(client, container.id);
				return published.id;
			}
			case "carousel": {
				if (!mediaUrls.length) throw new Error("carousel_requires_2_or_more_images");
				if (mediaUrls.length === 1) {
					const container = await createImageContainer(client, mediaUrls[0] ?? "", caption);
					await waitForContainerReady(client, container.id);
					const published = await publishContainer(client, container.id);
					return published.id;
				}
				const carouselContainer = await createCarouselContainers(client, mediaUrls, caption);
				await waitForContainerReady(client, carouselContainer.id);
				const carouselPublished = await publishContainer(client, carouselContainer.id);
				return carouselPublished.id;
			}
			default: {
				if (!mediaUrls.length) throw new Error("instagram_requires_media_url");
				const container = await createImageContainer(client, mediaUrls[0] ?? "", caption);
				await waitForContainerReady(client, container.id);
				const published = await publishContainer(client, container.id);
				return published.id;
			}
		}
	}

	/**
	 * Update handler-level rate limit tracking after API calls.
	 * Instagram doesn't return rate limit headers, so we self-track.
	 */
	private updateRateLimit(count = 1): void {
		const now = Date.now();
		const hourMs = 3_600_000;

		// Reset window if an hour has elapsed
		if (now - this.windowStart > hourMs) {
			this.requestCount = 0;
			this.windowStart = now;
		}

		this.requestCount += count;
		this.currentRateLimit = {
			limit: MAX_REQUESTS_PER_HOUR,
			remaining: Math.max(0, MAX_REQUESTS_PER_HOUR - this.requestCount),
			resetAt: new Date(this.windowStart + hourMs),
		};
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
	"instagram",
	InstagramHandler as unknown as new (
		...args: unknown[]
	) => PlatformPublisher,
);
