import { logger, wait } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { oauthTokens, posts } from "../../core/db/schema.ts";
import type { PlatformPublishResult } from "../../core/types/index.ts";
import type { DbConnection, PostRow, RateLimitInfo } from "../../core/types/publisher.ts";
import type { PlatformPublisher } from "../../core/types/publisher.ts";
import { decrypt, encrypt } from "../../core/utils/crypto.ts";
import { registerHandler } from "../../core/utils/publisher-factory.ts";
import { splitIntoThread } from "../../core/utils/thread-splitter.ts";
import { XClient } from "../x/client.ts";
import { uploadMedia } from "../x/media.ts";
import { createXOAuthClient, refreshAccessToken as refreshXToken } from "../x/oauth.ts";
import { RateLimitError } from "../x/types.ts";

const stringArraySchema = z.array(z.string());
const threadProgressSchema = z.object({
	posted: z.number(),
	total: z.number(),
	lastPostedId: z.string(),
	tweetIds: z.array(z.string()),
});

export class XHandler implements PlatformPublisher {
	private currentRateLimit: RateLimitInfo | null = null;

	async publish(db: DbConnection, post: PostRow, encKey: Buffer): Promise<PlatformPublishResult> {
		const { id: postId, userId, content, metadata } = post;
		const mediaUrls = post.mediaUrls ?? [];

		const xClientId = process.env.X_CLIENT_ID;
		const xClientSecret = process.env.X_CLIENT_SECRET;
		if (!xClientId || !xClientSecret) {
			return { platform: "x", status: "failed", error: "X_CLIENT_ID or X_CLIENT_SECRET not set" };
		}

		// Fetch OAuth token
		const [token] = await db
			.select()
			.from(oauthTokens)
			.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
			.limit(1);
		if (!token) return { platform: "x", status: "failed", error: "no_oauth_token" };

		// Refresh token if expired
		let accessTokenEncrypted = token.accessToken;
		if (token.expiresAt && token.expiresAt < new Date()) {
			if (!token.refreshToken) {
				return { platform: "x", status: "failed", error: "token_expired_no_refresh" };
			}
			const xOAuthClient = createXOAuthClient({
				clientId: xClientId,
				clientSecret: xClientSecret,
				callbackUrl: "https://example.com/callback",
			});
			const decryptedRefresh = decrypt(token.refreshToken, encKey);
			const newTokens = await refreshXToken(xOAuthClient, decryptedRefresh);
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
			logger.info("X token refreshed inline during publish", { postId });
		}

		const accessToken = decrypt(accessTokenEncrypted, encKey);
		const client = new XClient(accessToken);

		// Handle media uploads
		let mediaIds: string[] | undefined;
		if (mediaUrls.length > 0) {
			await db.update(posts).set({ subStatus: "media_uploading", updatedAt: new Date() }).where(eq(posts.id, postId));
			mediaIds = [];
			for (const filePath of mediaUrls) {
				const file = Bun.file(filePath);
				const buffer = Buffer.from(await file.arrayBuffer());
				const { mediaId } = await uploadMedia(buffer, file.type || "image/png", accessToken);
				mediaIds.push(mediaId);
			}
			await db.update(posts).set({ subStatus: "media_uploaded", updatedAt: new Date() }).where(eq(posts.id, postId));
		}

		// Determine if thread or single tweet
		let tweets: string[];
		let isThread = false;
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				tweets = stringArraySchema.parse(parsed);
				isThread = tweets.length > 1;
			} else {
				tweets = [content];
			}
		} catch {
			if (content.length > 280) {
				tweets = splitIntoThread(content);
				isThread = tweets.length > 1;
			} else {
				tweets = [content];
			}
		}

		try {
			if (!isThread) {
				const result = await client.createTweet({ text: tweets[0] ?? content, mediaIds });
				return { platform: "x", status: "published", externalPostId: result.id };
			}
			return await this.postThread(client, tweets, mediaIds, metadata as Record<string, unknown>, postId);
		} catch (error) {
			if (error instanceof RateLimitError && error.rateLimit) {
				await wait.until({ date: error.rateLimit.resetAt });
				throw error;
			}
			throw error;
		}
	}

	private async postThread(
		client: XClient,
		tweets: string[],
		mediaIds: string[] | undefined,
		metadata: Record<string, unknown> | null,
		postId: string,
	): Promise<PlatformPublishResult> {
		const threadProgress = metadata?.threadProgress
			? threadProgressSchema.parse(JSON.parse(metadata.threadProgress as string))
			: undefined;
		const startIndex = threadProgress?.posted ?? 0;
		const tweetIds = threadProgress?.tweetIds ?? [];
		const mediaIdsPerTweet = tweets.map((_, i) => (i === 0 ? mediaIds : undefined));

		for (let i = startIndex; i < tweets.length; i++) {
			const tweetText = tweets[i];
			if (!tweetText) continue;
			try {
				const result = await client.createTweet({
					text: tweetText,
					replyToId: i > 0 ? tweetIds[i - 1] : undefined,
					mediaIds: mediaIdsPerTweet[i],
				});
				tweetIds.push(result.id);
			} catch (tweetError) {
				if (tweetError instanceof RateLimitError && tweetError.rateLimit) {
					logger.warn("X rate limited during thread, waiting", { postId, tweetIndex: i, resetAt: tweetError.rateLimit.resetAt.toISOString() });
					await wait.until({ date: tweetError.rateLimit.resetAt });
					i--;
					continue;
				}
				throw tweetError;
			}
		}
		return { platform: "x", status: "published", externalPostId: tweetIds[0] };
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
registerHandler("x", XHandler as unknown as new (...args: unknown[]) => PlatformPublisher);
