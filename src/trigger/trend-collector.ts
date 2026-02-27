import { readFile } from "node:fs/promises";
import { logger, schedules } from "@trigger.dev/sdk";
import { sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { oauthTokens } from "../core/db/schema.ts";
import { decrypt, keyFromHex } from "../core/utils/crypto.ts";
import { collectTrends } from "../intelligence/collector.ts";
import { scoreTrends } from "../intelligence/scoring.ts";
import type { Pillar } from "../intelligence/types.ts";
import { CRYPTO_ENV_VARS, requireEnvVars } from "./env-validation.ts";

// ─── Strategy YAML helpers ───────────────────────────────────────────────────

/**
 * Load pillars from strategy.yaml using lightweight YAML parsing.
 * Returns empty array if file not found (still collect trends, just no relevance scoring).
 */
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
				// New list item
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

				// Non-matching line after pillars section -- end of pillars
				if (trimmed !== "" && !trimmed.startsWith("-") && !trimmed.startsWith("weight:")) {
					break;
				}
			}
		}

		// Push last pillar
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

// ─── Trend Collector Task ────────────────────────────────────────────────────

/**
 * Daily trend collector.
 * Fetches trends from all available sources, scores them against content pillars,
 * generates angle stubs for high-scoring trends, stores in DB, and prunes expired entries.
 * Runs at 6 AM UTC daily via Trigger.dev cron.
 */
export const trendCollector = schedules.task({
	id: "trend-collector",
	cron: "0 6 * * *",
	maxDuration: 300, // 5 minutes
	run: async () => {
		const env = requireEnvVars(CRYPTO_ENV_VARS, "trend-collector");

		const db = createHubConnection(env.DATABASE_URL);
		const userId = "default";

		// Load pillars from strategy.yaml
		const pillars = await loadPillars();
		if (pillars.length === 0) {
			logger.warn(
				"No pillars found in strategy.yaml -- collecting trends without relevance scoring",
			);
		}

		// Get X access token if available (for X trending source)
		let xAccessToken: string | undefined;
		{
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
				logger.warn("Could not load X token for trending -- skipping X source", {
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		// Collect trends from all available sources
		const collectResult = await collectTrends(pillars, { xAccessToken });

		if (collectResult.errors.length > 0) {
			logger.warn("Some trend sources had errors", {
				errors: collectResult.errors,
			});
		}

		// Score trends against pillars
		const scoredTrends = scoreTrends(collectResult.trends, pillars);

		// Store scored trends in DB with upsert (ON CONFLICT update if higher score)
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

		// Prune expired trends (30+ days old)
		let pruned = 0;
		try {
			const result = await db.execute(
				sql`DELETE FROM trends WHERE expires_at < NOW() AND user_id = ${userId}`,
			);
			pruned = Number(result.rowCount ?? 0);
		} catch (err) {
			logger.warn("Failed to prune old trends", {
				error: err instanceof Error ? err.message : String(err),
			});
		}

		const summary = {
			totalCollected: collectResult.trends.length,
			stored,
			highScore,
			pruned,
			errors: collectResult.errors.length,
		};

		logger.info("Trend collection complete", summary);

		return { status: "success", ...summary };
	},
});
