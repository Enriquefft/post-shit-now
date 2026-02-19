import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { monitoredAccounts } from "../core/db/schema.ts";
import { XClient } from "../platforms/x/client.ts";
import type { Pillar } from "./types.ts";

// ---- Types ----------------------------------------------------------------

export interface CompetitorReport {
	account: string;
	platform: string;
	recentTopics: string[];
	postFrequency: number;
	gapSuggestions: string[];
}

// ---- Helpers --------------------------------------------------------------

/**
 * Extract rough topics from tweet texts using simple keyword extraction.
 * Not ML-based -- just extracts notable words (4+ chars, not stop words).
 */
function extractTopics(texts: string[], limit = 10): string[] {
	const stopWords = new Set([
		"this",
		"that",
		"with",
		"from",
		"have",
		"been",
		"will",
		"your",
		"what",
		"when",
		"where",
		"which",
		"about",
		"their",
		"would",
		"could",
		"should",
		"there",
		"these",
		"those",
		"just",
		"more",
		"some",
		"than",
		"them",
		"very",
		"also",
		"into",
		"over",
		"only",
		"then",
		"make",
		"like",
		"even",
		"most",
		"much",
		"such",
		"here",
		"well",
		"back",
		"after",
		"https",
		"http",
	]);

	const wordCounts = new Map<string, number>();

	for (const text of texts) {
		const words = text
			.toLowerCase()
			.replace(/https?:\/\/\S+/g, "")
			.replace(/[^a-z0-9\s]/g, "")
			.split(/\s+/)
			.filter((w) => w.length >= 4 && !stopWords.has(w));

		for (const word of words) {
			wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
		}
	}

	return Array.from(wordCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([word]) => word);
}

/**
 * Suggest content gaps based on competitor topics vs user's pillars.
 * Returns topics the competitor covers that the user's pillars don't.
 */
function suggestGaps(
	competitorTopics: string[],
	pillars: Pillar[],
): string[] {
	const pillarWords = new Set(
		pillars.flatMap((p) => p.name.toLowerCase().split(/\s+/)),
	);

	const gaps = competitorTopics.filter(
		(topic) => !pillarWords.has(topic.toLowerCase()),
	);

	return gaps.slice(0, 5).map((topic) => `Competitor covers "${topic}" -- consider if relevant to your audience`);
}

// ---- Main Function --------------------------------------------------------

/**
 * Check monitored competitor accounts and generate reports.
 * Queries monitoredAccounts table for user's tracked accounts.
 * For X platform accounts, uses XClient to fetch recent tweets.
 * Returns empty array if no monitored accounts or no X token.
 */
export async function checkCompetitors(
	db: NodePgDatabase<Record<string, unknown>>,
	userId: string,
	options?: { xAccessToken?: string; pillars?: Pillar[] },
): Promise<CompetitorReport[]> {
	const xToken = options?.xAccessToken;
	if (!xToken) return [];

	// Query monitored accounts for this user
	const accounts = await db
		.select()
		.from(monitoredAccounts)
		.where(eq(monitoredAccounts.userId, userId));

	if (accounts.length === 0) return [];

	const xClient = new XClient(xToken);
	const reports: CompetitorReport[] = [];

	for (const account of accounts) {
		// Currently only X platform is supported
		if (account.platform !== "x") continue;

		try {
			// Look up user by handle
			const { data: user } = await xClient.getUserByUsername(
				account.accountHandle,
			);

			// Fetch their recent tweets
			const { data: tweets } = await xClient.getUserTweets(user.id, {
				maxResults: 10,
				tweetFields: ["created_at", "public_metrics"],
			});

			const tweetTexts = tweets.map((t) => t.text);
			const recentTopics = extractTopics(tweetTexts);

			// Estimate posting frequency (posts per week based on available data)
			let postFrequency = 0;
			if (tweets.length >= 2) {
				const first = tweets[0];
				const last = tweets[tweets.length - 1];
				if (first?.createdAt && last?.createdAt) {
					const daySpan =
						(new Date(first.createdAt).getTime() -
							new Date(last.createdAt).getTime()) /
						(1000 * 60 * 60 * 24);
					postFrequency =
						daySpan > 0
							? Math.round((tweets.length / daySpan) * 7)
							: tweets.length;
				}
			}

			const gapSuggestions = options?.pillars
				? suggestGaps(recentTopics, options.pillars)
				: [];

			reports.push({
				account: account.accountHandle,
				platform: account.platform,
				recentTopics,
				postFrequency,
				gapSuggestions,
			});
		} catch (err) {
			// Per-account error isolation: log and continue
			console.error(
				`Failed to check competitor @${account.accountHandle}:`,
				err instanceof Error ? err.message : err,
			);
		}
	}

	return reports;
}
