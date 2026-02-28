import { readFile } from "node:fs/promises";
import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, keyFromHex } from "../core/utils/crypto.ts";
import { collectBreakingNews } from "../intelligence/collector.ts";
import { scoreTrends } from "../intelligence/scoring.ts";
import type { Pillar } from "../intelligence/types.ts";
import { CRYPTO_ENV_VARS, requireEnvVars } from "./env-validation.ts";

// ─── Pillar Loader (lightweight, same as trend-collector) ────────────────────

async function loadPillars(strategyPath = "content/strategy.yaml"): Promise<Pillar[]> {
	try {
		const raw = await readFile(strategyPath, "utf-8");
		const pillars: Pillar[] = [];
		let inPillars = false;
		let currentPillar: Partial<Pillar> = {};

		for (const line of raw.split("\n")) {
			const trimmed = line.trim();

			if (trimmed.startsWith("pillars:")) {
				inPillars = true;
				continue;
			}

			if (inPillars) {
				const nameMatch = trimmed.match(/^-\s*name:\s*(.+)/);
				if (nameMatch?.[1]) {
					if (currentPillar.name) {
						pillars.push({
							name: currentPillar.name,
							weight: currentPillar.weight ?? 1,
						});
					}
					currentPillar = {
						name: nameMatch[1].trim().replace(/^["']|["']$/g, ""),
					};
					continue;
				}

				const weightMatch = trimmed.match(/^weight:\s*(\d+(?:\.\d+)?)/);
				if (weightMatch?.[1]) {
					currentPillar.weight = Number.parseFloat(weightMatch[1]);
					continue;
				}

				if (trimmed !== "" && !trimmed.startsWith("-") && !trimmed.startsWith("weight:")) {
					break;
				}
			}
		}

		if (currentPillar.name) {
			pillars.push({
				name: currentPillar.name,
				weight: currentPillar.weight ?? 1,
			});
		}

		return pillars;
	} catch {
		return [];
	}
}

// ─── Breaking News Poller Task ───────────────────────────────────────────────

/**
 * Breaking news poller.
 * Lighter version of trend collector: only fetches HN top 10 + X trending.
 * Runs every 3 hours during business hours (8 AM - 8 PM UTC) via Trigger.dev cron.
 * Does NOT prune old trends (the daily collector handles that).
 */
export const trendPoller = schedules.task({
	id: "trend-poller",
	cron: "0 8-20/3 * * *",
	maxDuration: 120, // 2 minutes
	run: async () => {
		const env = requireEnvVars(CRYPTO_ENV_VARS, "trend-poller");

		const db = createHubConnection(env.DATABASE_URL);
		const userId = "default";

		// Load pillars for scoring
		const pillars = await loadPillars();

		// Get X access token if available
		let xAccessToken: string | undefined;
		try {
			const encKey = keyFromHex(env.HUB_ENCRYPTION_KEY);
			const [token] = await db
				.select()
				.from(oauthTokens)
				.where(sql`${oauthTokens.userId} = ${userId} AND ${oauthTokens.platform} = 'x'`)
				.limit(1);

			if (token) {
				xAccessToken = decrypt(token.accessToken, encKey);
			}
		} catch (err) {
			logger.warn("Could not load X token for poller -- skipping X source", {
				error: err instanceof Error ? err.message : String(err),
			});
		}

		// Collect breaking news (HN top 10 + X trending only)
		const collectResult = await collectBreakingNews({ xAccessToken });

		if (collectResult.errors.length > 0) {
			logger.warn("Some poller sources had errors", {
				errors: collectResult.errors,
			});
		}

		// Score trends against pillars
		const scoredTrends = scoreTrends(collectResult.trends, pillars);

		// Store in DB with upsert
		let stored = 0;
		let highScore = 0;

		for (const trend of scoredTrends) {
			try {
				await db.execute(sql`
					INSERT INTO trends (id, user_id, title, url, source, source_score,
						pillar_relevance, overall_score, suggested_angles, detected_at, expires_at)
					VALUES (
						${trend.id}, ${userId}, ${trend.title}, ${trend.url ?? null},
						${trend.source}, ${trend.sourceScore},
						${JSON.stringify(trend.pillarRelevance)}::jsonb,
						${trend.overallScore},
						${trend.suggestedAngles ? JSON.stringify(trend.suggestedAngles) : null}::jsonb,
						${trend.detectedAt.toISOString()}::timestamptz,
						${trend.expiresAt?.toISOString() ?? null}::timestamptz
					)
					ON CONFLICT (user_id, title, source)
					DO UPDATE SET
						overall_score = GREATEST(trends.overall_score, EXCLUDED.overall_score),
						suggested_angles = CASE
							WHEN EXCLUDED.overall_score > trends.overall_score
							THEN EXCLUDED.suggested_angles
							ELSE trends.suggested_angles
						END,
						pillar_relevance = CASE
							WHEN EXCLUDED.overall_score > trends.overall_score
							THEN EXCLUDED.pillar_relevance
							ELSE trends.pillar_relevance
						END
				`);
				stored++;

				if (trend.overallScore >= 70) {
					highScore++;
				}
			} catch (err) {
				logger.warn("Failed to store trend", {
					title: trend.title,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		const summary = {
			totalCollected: collectResult.trends.length,
			stored,
			highScore,
			errors: collectResult.errors.length,
		};

		logger.info("Breaking news poll complete", summary);

		return { status: "success", ...summary };
	},
});
