import { z } from "zod/v4";

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

export async function importXHistory(accessToken: string): Promise<ImportedContent[]> {
	// Get user ID
	const meResponse = await fetch(`${X_API_BASE}/2/users/me`, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!meResponse.ok) {
		throw new Error(`X API error (${meResponse.status}): Failed to get user info`);
	}

	const meDataSchema = z.object({ data: z.object({ id: z.string() }).optional() });
	const meData = meDataSchema.parse(await meResponse.json());
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

		const xTweetDataSchema = z.object({
			id: z.string(),
			text: z.string(),
			created_at: z.string().optional(),
			public_metrics: z
				.object({
					like_count: z.number(),
					retweet_count: z.number(),
					reply_count: z.number(),
					impression_count: z.number().optional(),
				})
				.optional(),
		});
		const tweetsDataSchema = z.object({
			data: z.array(xTweetDataSchema).optional(),
			meta: z.object({ next_token: z.string().optional() }).optional(),
		});
		const tweetsData = tweetsDataSchema.parse(await tweetsResponse.json());

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

// ─── URL Validation ───────────────────────────────────────────────────────────

export interface ValidationResult {
	valid: boolean;
	error: string | null;
}

/**
 * Validate a URL before attempting to fetch content.
 *
 * Checks:
 * - Must use http:// or https:// protocol (no file://, javascript:, data:)
 * - Must have a valid hostname (no empty or whitespace)
 * - Must not be localhost or 127.0.0.1 (security check for remote execution)
 * - Must be parseable by the URL constructor
 *
 * @param url - URL string to validate
 * @returns ValidationResult with valid flag and error message if invalid
 */
export function validateUrl(url: string): ValidationResult {
	if (!url || typeof url !== "string") {
		return {
			valid: false,
			error: "Invalid URL format. URL must be a non-empty string.",
		};
	}

	const trimmedUrl = url.trim();
	if (trimmedUrl !== url) {
		return {
			valid: false,
			error: "Invalid URL format. URL should not have leading/trailing whitespace.",
		};
	}

	// Check for dangerous protocols before parsing
	if (trimmedUrl.startsWith("file://")) {
		return {
			valid: false,
			error: "Invalid URL protocol. URL must start with http:// or https://",
		};
	}

	if (trimmedUrl.startsWith("javascript:")) {
		return {
			valid: false,
			error: "Invalid URL protocol. JavaScript URLs are not allowed.",
		};
	}

	if (trimmedUrl.startsWith("data:")) {
		return {
			valid: false,
			error: "Invalid URL protocol. Data URLs are not allowed.",
		};
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmedUrl);
	} catch {
		return {
			valid: false,
			error: "Invalid URL format. Could not parse hostname.",
		};
	}

	// Validate protocol
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return {
			valid: false,
			error: "Invalid URL protocol. URL must start with http:// or https://",
		};
	}

	// Validate hostname exists
	if (!parsed.hostname || parsed.hostname.trim() === "") {
		return {
			valid: false,
			error: "Invalid URL format. Hostname is required.",
		};
	}

	// Security check: block localhost and loopback addresses
	const hostnameLower = parsed.hostname.toLowerCase();
	if (
		hostnameLower === "localhost" ||
		hostnameLower === "127.0.0.1" ||
		hostnameLower === "::1" ||
		hostnameLower.startsWith("127.") ||
		hostnameLower.startsWith("0.")
	) {
		return {
			valid: false,
			error: "Localhost URLs are not allowed. Use a publicly accessible URL.",
		};
	}

	return { valid: true, error: null };
}

// ─── Import from Blog ───────────────────────────────────────────────────────

export async function importBlogContent(urls: string[]): Promise<ImportedContent[]> {
	const allContent: ImportedContent[] = [];
	const MAX_CHUNKS_PER_URL = 50;

	// Track validation errors for better error reporting
	const validationErrors: { url: string; error: string }[] = [];

	for (const url of urls) {
		// Validate URL before attempting to fetch
		const validation = validateUrl(url);
		if (!validation.valid) {
			validationErrors.push({ url, error: validation.error ?? "Unknown error" });
			continue;
		}

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

	// If all URLs failed validation, throw a descriptive error with all errors
	if (allContent.length === 0 && validationErrors.length > 0) {
		const errorMessage = validationErrors
			.map(({ url, error }) => `Invalid URL '${url}': ${error}`)
			.join("\n");
		throw new Error(`All URLs failed validation:\n${errorMessage}`);
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
