// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImportedContent {
	text: string;
	platform: string;
	source: "x-history" | "blog" | "raw-text" | "other";
	engagementSignals?: {
		likes?: number;
		retweets?: number;
		replies?: number;
		views?: number;
	};
	createdAt?: string;
}

export interface ContentAnalysis {
	sampleCount: number;
	avgLength: number;
	detectedTone: string;
	commonPatterns: string[];
	vocabularyFingerprint: string[];
	sentencePatterns: string[];
	topicClusters: string[];
}

// ─── Common Words Filter ────────────────────────────────────────────────────

const COMMON_WORDS = new Set([
	"the",
	"be",
	"to",
	"of",
	"and",
	"a",
	"in",
	"that",
	"have",
	"i",
	"it",
	"for",
	"not",
	"on",
	"with",
	"he",
	"as",
	"you",
	"do",
	"at",
	"this",
	"but",
	"his",
	"by",
	"from",
	"they",
	"we",
	"say",
	"her",
	"she",
	"or",
	"an",
	"will",
	"my",
	"one",
	"all",
	"would",
	"there",
	"their",
	"what",
	"so",
	"up",
	"out",
	"if",
	"about",
	"who",
	"get",
	"which",
	"go",
	"me",
	"when",
	"make",
	"can",
	"like",
	"time",
	"no",
	"just",
	"him",
	"know",
	"take",
	"people",
	"into",
	"year",
	"your",
	"good",
	"some",
	"could",
	"them",
	"see",
	"other",
	"than",
	"then",
	"now",
	"look",
	"only",
	"come",
	"its",
	"over",
	"think",
	"also",
	"back",
	"after",
	"use",
	"two",
	"how",
	"our",
	"work",
	"first",
	"well",
	"way",
	"even",
	"new",
	"want",
	"because",
	"any",
	"these",
	"give",
	"day",
	"most",
	"us",
	"is",
	"are",
	"was",
	"were",
	"been",
	"being",
	"has",
	"had",
	"did",
	"does",
	"very",
	"more",
	"much",
	"really",
	"don't",
	"it's",
	"i'm",
	"that's",
]);

// ─── Import from X History ──────────────────────────────────────────────────

const X_API_BASE = "https://api.x.com";

interface XTweetData {
	id: string;
	text: string;
	created_at?: string;
	public_metrics?: {
		like_count: number;
		retweet_count: number;
		reply_count: number;
		impression_count?: number;
	};
}

export async function importXHistory(accessToken: string): Promise<ImportedContent[]> {
	// Get user ID
	const meResponse = await fetch(`${X_API_BASE}/2/users/me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!meResponse.ok) {
		throw new Error(`X API error (${meResponse.status}): Failed to get user info`);
	}

	const meData = (await meResponse.json()) as { data?: { id: string } };
	const userId = meData.data?.id;
	if (!userId) {
		throw new Error("X API returned no user ID");
	}

	// Fetch tweets (up to 3 pages)
	const allTweets: ImportedContent[] = [];
	let nextToken: string | undefined;

	for (let page = 0; page < 3; page++) {
		const params = new URLSearchParams({
			max_results: "100",
			"tweet.fields": "created_at,public_metrics,text",
			exclude: "retweets,replies",
		});
		if (nextToken) params.set("pagination_token", nextToken);

		const tweetsResponse = await fetch(
			`${X_API_BASE}/2/users/${userId}/tweets?${params.toString()}`,
			{ headers: { Authorization: `Bearer ${accessToken}` } },
		);

		if (!tweetsResponse.ok) {
			if (tweetsResponse.status === 429) {
				// Rate limited — return what we have
				break;
			}
			throw new Error(`X API error (${tweetsResponse.status}): Failed to fetch tweets`);
		}

		const tweetsData = (await tweetsResponse.json()) as {
			data?: XTweetData[];
			meta?: { next_token?: string };
		};

		if (!tweetsData.data?.length) break;

		for (const tweet of tweetsData.data) {
			// Skip replies (tweets starting with @)
			if (tweet.text.startsWith("@")) continue;

			allTweets.push({
				text: tweet.text,
				platform: "x",
				source: "x-history",
				engagementSignals: {
					likes: tweet.public_metrics?.like_count,
					retweets: tweet.public_metrics?.retweet_count,
					replies: tweet.public_metrics?.reply_count,
					views: tweet.public_metrics?.impression_count,
				},
				createdAt: tweet.created_at,
			});
		}

		nextToken = tweetsData.meta?.next_token;
		if (!nextToken) break;
	}

	return allTweets;
}

// ─── Import from Blog ───────────────────────────────────────────────────────

export async function importBlogContent(urls: string[]): Promise<ImportedContent[]> {
	const allContent: ImportedContent[] = [];
	const MAX_CHUNKS_PER_URL = 50;

	for (const url of urls) {
		try {
			const response = await fetch(url);
			if (!response.ok) continue;

			const html = await response.text();

			// Strip script and style tags
			let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
			text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
			// Strip remaining HTML tags
			text = text.replace(/<[^>]+>/g, " ");
			// Normalize whitespace
			text = text.replace(/\s+/g, " ").trim();
			// Decode HTML entities
			text = text
				.replace(/&amp;/g, "&")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'");

			// Split into paragraphs
			const paragraphs = text
				.split(/\.\s+/)
				.map((p) => p.trim())
				.filter((p) => p.length > 30);

			const chunks = paragraphs.slice(0, MAX_CHUNKS_PER_URL);
			for (const chunk of chunks) {
				allContent.push({
					text: chunk,
					platform: "blog",
					source: "blog",
				});
			}
		} catch {}
	}

	return allContent;
}

// ─── Import Raw Text ────────────────────────────────────────────────────────

export async function importRawText(texts: string[]): Promise<ImportedContent[]> {
	const allContent: ImportedContent[] = [];

	for (const text of texts) {
		const paragraphs = text
			.split(/\n\n+/)
			.map((p) => p.trim())
			.filter(Boolean);

		for (const paragraph of paragraphs) {
			allContent.push({
				text: paragraph,
				platform: "other",
				source: "raw-text",
			});
		}
	}

	return allContent;
}

// ─── Content Analysis ───────────────────────────────────────────────────────

export function analyzeImportedContent(content: ImportedContent[]): ContentAnalysis {
	if (content.length === 0) {
		return {
			sampleCount: 0,
			avgLength: 0,
			detectedTone: "neutral",
			commonPatterns: [],
			vocabularyFingerprint: [],
			sentencePatterns: [],
			topicClusters: [],
		};
	}

	// Basic stats
	const totalLength = content.reduce((sum, c) => sum + c.text.length, 0);
	const avgLength = Math.round(totalLength / content.length);

	// Tone detection
	let formalScore = 0;
	let casualScore = 0;
	const contractions =
		/\b(can't|won't|don't|doesn't|isn't|aren't|wasn't|weren't|i'm|i've|i'll|i'd|we're|they're|it's|that's|there's|here's|what's|who's)\b/gi;
	const formalWords =
		/\b(furthermore|moreover|consequently|therefore|nevertheless|nonetheless|notwithstanding|henceforth|subsequently|accordingly)\b/gi;

	for (const item of content) {
		const text = item.text;
		const contractionCount = (text.match(contractions) || []).length;
		const formalCount = (text.match(formalWords) || []).length;
		casualScore += contractionCount;
		formalScore += formalCount;
	}

	const detectedTone =
		formalScore > casualScore * 2
			? "formal"
			: casualScore > formalScore * 2
				? "casual"
				: "balanced";

	// Opening patterns
	const openingPatterns: Record<string, number> = {};
	for (const item of content) {
		const firstWord = item.text.split(/\s+/)[0]?.toLowerCase() ?? "";
		if (item.text.includes("?")) {
			openingPatterns.question = (openingPatterns.question ?? 0) + 1;
		}
		if (firstWord === "i" || firstWord === "my" || firstWord === "we") {
			openingPatterns["first-person-opener"] = (openingPatterns["first-person-opener"] ?? 0) + 1;
		}
		if (item.text.startsWith('"') || item.text.startsWith("'")) {
			openingPatterns.quote = (openingPatterns.quote ?? 0) + 1;
		}
	}

	const commonPatterns = Object.entries(openingPatterns)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([pattern]) => pattern);

	// Vocabulary fingerprint
	const wordFreq: Record<string, number> = {};
	for (const item of content) {
		const words = item.text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
		for (const word of words) {
			if (!COMMON_WORDS.has(word)) {
				wordFreq[word] = (wordFreq[word] ?? 0) + 1;
			}
		}
	}

	const vocabularyFingerprint = Object.entries(wordFreq)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 20)
		.map(([word]) => word);

	// Sentence patterns
	const sentenceLengths: number[] = [];
	let questionCount = 0;
	let exclamationCount = 0;

	for (const item of content) {
		const sentences = item.text.split(/[.!?]+/).filter(Boolean);
		for (const s of sentences) {
			sentenceLengths.push(s.split(/\s+/).length);
		}
		questionCount += (item.text.match(/\?/g) || []).length;
		exclamationCount += (item.text.match(/!/g) || []).length;
	}

	const avgSentenceLength =
		sentenceLengths.length > 0
			? Math.round(sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length)
			: 0;

	const sentencePatterns = [
		`avg-sentence-length:${avgSentenceLength}`,
		`question-frequency:${Math.round((questionCount / content.length) * 100)}%`,
		`exclamation-frequency:${Math.round((exclamationCount / content.length) * 100)}%`,
	];

	// Topic clusters (simple keyword co-occurrence)
	const topicWords = vocabularyFingerprint.slice(0, 10);
	const topicClusters = topicWords.filter((word) => (wordFreq[word] ?? 0) >= 3);

	return {
		sampleCount: content.length,
		avgLength,
		detectedTone,
		commonPatterns,
		vocabularyFingerprint,
		sentencePatterns,
		topicClusters,
	};
}
