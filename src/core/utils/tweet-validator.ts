/**
 * Tweet character counting and validation using X's v3 weighted algorithm.
 *
 * Source: X developer docs + twitter-text v3.json config
 * https://docs.x.com/fundamentals/counting-characters
 * https://github.com/twitter/twitter-text/blob/master/config/v3.json
 *
 * Key rules:
 * - Scale = 100, default weight = 200 (2 chars per grapheme)
 * - Latin-1 + specific punctuation ranges = weight 100 (1 char)
 * - All URLs (with or without protocol) = 23 chars (t.co shortening)
 * - Emoji ZWJ sequences = 1 grapheme = 2 chars
 * - CJK characters = 2 chars each
 * - Text is NFC-normalized before counting
 */

// --- Constants from X's v3.json config ---

const SCALE = 100;
const DEFAULT_WEIGHT = 200;
const URL_WEIGHT = 23;

/** Unicode ranges where each grapheme counts as 1 character (weight 100). */
const WEIGHT_100_RANGES: ReadonlyArray<readonly [number, number]> = [
	[0, 4351], // Latin-1 through extensions
	[8192, 8205], // General punctuation through ZWJ
	[8208, 8223], // Dashes and quotation marks
	[8242, 8247], // Prime marks
];

/**
 * Robust URL regex: matches http(s):// URLs and bare domain URLs.
 * Trailing sentence punctuation (. , ) ; : ! ?) is trimmed if it looks
 * like end-of-sentence rather than part of the URL.
 */
const URL_PATTERN =
	/https?:\/\/[^\s<>"]+|(?:[a-z0-9](?:[-a-z0-9]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>"]*)?/gi;

/** Punctuation that commonly ends a sentence rather than being part of a URL. */
const TRAILING_PUNCT = /[.,);:!?]+$/;

// --- Segmenter (singleton) ---

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

// --- Helpers ---

function codePointWeight(cp: number): number {
	for (const [start, end] of WEIGHT_100_RANGES) {
		if (cp >= start && cp <= end) return 100;
	}
	return DEFAULT_WEIGHT;
}

/** Strip trailing sentence punctuation from a URL match. */
function cleanUrlMatch(url: string): string {
	return url.replace(TRAILING_PUNCT, "");
}

// --- Public API ---

/**
 * Count tweet characters using X's v3 weighted algorithm.
 *
 * - URLs (with or without protocol) always count as 23 chars
 * - Latin-1 characters count as 1
 * - Emoji, CJK, and other characters count as 2
 * - Emoji ZWJ sequences count as a single 2-char unit
 *
 * @param text - Raw tweet text
 * @returns Weighted character count
 */
export function countTweetChars(text: string): number {
	if (!text) return 0;

	// Step 1: NFC normalize
	const normalized = text.normalize("NFC");

	// Step 2: Find URLs (clean trailing punctuation) and calculate fixed contribution
	const urls: string[] = [];
	const textWithoutUrls = normalized.replace(URL_PATTERN, (match) => {
		const cleaned = cleanUrlMatch(match);
		urls.push(cleaned);
		// Return the trimmed punctuation so it gets counted as normal chars
		const trimmedPunct = match.slice(cleaned.length);
		return trimmedPunct;
	});

	const urlWeightedTotal = urls.length * URL_WEIGHT * SCALE;

	// Step 3: Use Intl.Segmenter for proper grapheme clustering
	let charWeightedTotal = 0;

	for (const { segment } of segmenter.segment(textWithoutUrls)) {
		const cp = segment.codePointAt(0) ?? 0;
		charWeightedTotal += codePointWeight(cp);
	}

	return Math.ceil((urlWeightedTotal + charWeightedTotal) / SCALE);
}

/** Result of validating a tweet. */
export interface TweetValidation {
	/** false only for hard errors (char count > 280) */
	valid: boolean;
	/** Weighted character count */
	charCount: number;
	/** Maximum allowed characters (280) */
	maxChars: number;
	/** Hard blockers that prevent publishing */
	errors: string[];
	/** Soft advisories that don't block publishing */
	warnings: string[];
}

/**
 * Validate a tweet and return structured results.
 *
 * Hard errors (blocks publish):
 * - Character count exceeds 280
 *
 * Soft warnings (still publishes):
 * - More than 10 mentions
 * - More than 5 hashtags
 *
 * @param text - Raw tweet text
 * @returns Validation result with errors and warnings
 */
export function validateTweet(text: string): TweetValidation {
	const charCount = countTweetChars(text);
	const errors: string[] = [];
	const warnings: string[] = [];

	if (charCount > 280) {
		errors.push(`Tweet is ${charCount}/280 characters`);
	}

	const mentionCount = (text.match(/@\w+/g) || []).length;
	if (mentionCount > 10) {
		warnings.push(
			`${mentionCount} mentions detected (recommended max: 10)`,
		);
	}

	const hashtagCount = (text.match(/#\w+/g) || []).length;
	if (hashtagCount > 5) {
		warnings.push(
			`${hashtagCount} hashtags detected (recommended max: 5)`,
		);
	}

	return { valid: errors.length === 0, charCount, maxChars: 280, errors, warnings };
}
