import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, keyFromHex } from "../core/utils/crypto.ts";
import { CRYPTO_ENV_VARS, requireEnvVars } from "./env-validation.ts";
import { deriveNicheKeywords, loadEngagementConfig } from "../engagement/config.ts";
import type { PlatformClients } from "../engagement/monitor.ts";
import { discoverOpportunities, expireOldOpportunities } from "../engagement/monitor.ts";
import { InstagramClient } from "../platforms/instagram/client.ts";
import { XClient } from "../platforms/x/client.ts";
import { notificationDispatcherTask } from "./notification-dispatcher.ts";

// ─── Engagement Monitor Task ────────────────────────────────────────────────

/**
 * Scheduled engagement opportunity discovery.
 * Runs every 3 hours (within 2-4 hour range per locked decision).
 * Discovers trending content across X, Instagram, TikTok.
 * LinkedIn excluded (no content discovery API -- walled garden).
 *
 * High-score notifications (70+) trigger push via existing notification system.
 * Scores 60-69 batched into digest for next notification cycle.
 */
export const engagementMonitor = schedules.task({
	id: "engagement-monitor",
	cron: "0 */3 * * *",
	maxDuration: 300, // 5 minutes
	run: async () => {
		const env = requireEnvVars(CRYPTO_ENV_VARS, "engagement-monitor");

		const db = createHubConnection(env.DATABASE_URL);
		const userId = "default";

		// Load engagement config
		const config = await loadEngagementConfig(db, userId);

		// Derive niche keywords (from config or voice profile fallback)
		let nicheKeywords = config.nicheKeywords;
		if (!nicheKeywords || nicheKeywords.length === 0) {
			nicheKeywords = await deriveNicheKeywords();
			logger.info("Derived niche keywords from voice profile", {
				count: nicheKeywords.length,
			});
		}

		if (nicheKeywords.length === 0) {
			logger.warn(
				"No niche keywords available -- skipping engagement monitoring. Configure keywords via engagement config or create a voice profile.",
			);
			return { status: "skipped", reason: "no_keywords" };
		}

		// Create platform clients for enabled platforms
		const platformClients: PlatformClients = {};

		{
			const encKey = keyFromHex(env.HUB_ENCRYPTION_KEY);

			// X client
			try {
				const tokenResult = await db
					.select()
					.from(oauthTokens)
					.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
					.limit(1);

				const xToken = tokenResult[0];
				if (xToken) {
					platformClients.x = new XClient(decrypt(xToken.accessToken, encKey));
				}
			} catch (err) {
				logger.warn("Could not load X token for engagement monitor", {
					error: err instanceof Error ? err.message : String(err),
				});
			}

			// Instagram client
			try {
				const tokenResult = await db
					.select()
					.from(oauthTokens)
					.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'instagram'`)
					.limit(1);

				const igToken = tokenResult[0];
				if (igToken) {
					const accountId = igToken.metadata?.accountId ?? "";
					if (accountId) {
						platformClients.instagram = new InstagramClient(
							decrypt(igToken.accessToken, encKey),
							accountId,
						);
					}
				}
			} catch (err) {
				logger.warn("Could not load Instagram token for engagement monitor", {
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// Discover opportunities across all enabled platforms
		const opportunities = await discoverOpportunities({
			db,
			userId,
			nicheKeywords,
			config,
			platformClients,
		});

		// Categorize by score for notification routing
		const highScore = opportunities.filter((o) => o.score.composite >= 70);
		const mediumScore = opportunities.filter(
			(o) => o.score.composite >= 60 && o.score.composite < 70,
		);
		// NOTIF-04: Push notifications for high-score engagement opportunities (score 70+)
		// Already wired: see lines 128-155, high-score notification trigger.

		// High-score opportunities: trigger push notification via dispatcher
		// Uses notificationDispatcherTask instead of raw INSERT to get fatigue prevention,
		// quiet hours, and provider abstraction. Dispatcher writes to notification_log itself.
		if (highScore.length > 0) {
			for (const opp of highScore) {
				try {
					await notificationDispatcherTask.trigger({
						eventType: "post.viral",
						userId,
						payload: {
							postId: opp.externalPostId,
							platform: opp.platform,
							score: opp.score.composite,
							authorHandle: opp.authorHandle ?? "",
							postSnippet: (opp.postSnippet ?? "").slice(0, 100),
						},
					});
				} catch (notifError) {
					logger.warn("Failed to trigger engagement notification", {
						externalPostId: opp.externalPostId,
						error: notifError instanceof Error ? notifError.message : String(notifError),
					});
				}
			}
			logger.info("Triggered push notifications for high-score opportunities", {
				count: highScore.length,
			});
		}

		// Medium-score opportunities: batch into digest
		if (mediumScore.length > 0) {
			try {
				for (const opp of mediumScore) {
					await db.execute(sql`
						INSERT INTO notification_log (
							id, user_id, event_type, tier, provider, recipient, status,
							dedup_key, created_at
						) VALUES (
							gen_random_uuid(), ${userId}, 'digest.daily', 'digest', 'waha', '',
							'queued',
							${`engagement-digest-${opp.externalPostId}`},
							NOW()
						)
						ON CONFLICT DO NOTHING
					`);
				}
				logger.info("Queued digest entries for medium-score opportunities", {
					count: mediumScore.length,
				});
			} catch (err) {
				logger.warn("Failed to queue engagement digest entries", {
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// Expire old pending opportunities (> 48 hours)
		const expired = await expireOldOpportunities(db, userId);

		// Build per-platform summary
		const platformCounts: Record<string, number> = {};
		for (const opp of opportunities) {
			platformCounts[opp.platform] = (platformCounts[opp.platform] ?? 0) + 1;
		}

		const summary = {
			totalDiscovered: opportunities.length,
			highScore: highScore.length,
			mediumScore: mediumScore.length,
			expired,
			byPlatform: platformCounts,
		};

		logger.info("Engagement monitoring complete", summary);

		return { status: "success", ...summary };
	},
});
