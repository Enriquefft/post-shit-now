/**
 * Thread auto-splitter for X/Twitter threads.
 *
 * Splits long text into tweet-sized chunks respecting:
 * 1. Paragraph boundaries (\n\n) first
 * 2. Sentence boundaries (.!?) second
 * 3. Word boundaries as last resort
 *
 * Never splits mid-word.
 */

const PARAGRAPH_SEPARATOR = /\n\n+/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

/**
 * Split text into tweet-sized chunks respecting natural boundaries.
 *
 * @param text - The text to split
 * @param maxLen - Maximum characters per tweet (default: 280)
 * @returns Array of tweet strings, empty array for empty/whitespace input
 */
export function splitIntoThread(text: string, maxLen = 280): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	// Step 1: Split by paragraphs first (paragraph boundaries always create separate tweets)
	const paragraphs = trimmed
		.split(PARAGRAPH_SEPARATOR)
		.map((p) => p.trim())
		.filter(Boolean);

	// Single paragraph that fits -> single tweet
	const first = paragraphs[0];
	if (paragraphs.length === 1 && first && first.length <= maxLen) {
		return [first];
	}

	// Step 2: Each paragraph becomes its own tweet; split long paragraphs as needed
	const tweets: string[] = [];

	for (const paragraph of paragraphs) {
		if (paragraph.length <= maxLen) {
			tweets.push(paragraph);
		} else {
			// Paragraph is too long, split by sentence then word boundaries
			tweets.push(...splitBySentences(paragraph, maxLen));
		}
	}

	return tweets;
}

/**
 * Split a long paragraph by sentence boundaries.
 * Falls back to word boundaries for very long sentences.
 */
function splitBySentences(text: string, maxLen: number): string[] {
	const sentences = text.split(SENTENCE_BOUNDARY).filter(Boolean);

	const tweets: string[] = [];
	let current = "";

	for (const sentence of sentences) {
		if (sentence.length > maxLen) {
			// Sentence itself is too long, flush current and split by words
			if (current) {
				tweets.push(current.trim());
				current = "";
			}
			tweets.push(...splitByWords(sentence, maxLen));
		} else {
			const merged = current ? `${current} ${sentence}` : sentence;
			if (merged.length <= maxLen) {
				current = merged;
			} else {
				if (current) tweets.push(current.trim());
				current = sentence;
			}
		}
	}

	if (current) tweets.push(current.trim());

	return tweets;
}

/**
 * Split text by word boundaries as a last resort.
 * Never splits mid-word.
 */
function splitByWords(text: string, maxLen: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const tweets: string[] = [];
	let current = "";

	for (const word of words) {
		const merged = current ? `${current} ${word}` : word;
		if (merged.length <= maxLen) {
			current = merged;
		} else {
			if (current) tweets.push(current);
			current = word;
		}
	}

	if (current) tweets.push(current);

	return tweets;
}

/**
 * Format a thread as a numbered preview with character counts.
 *
 * @param tweets - Array of tweet strings
 * @returns Preview string, tweet count, and optional warning
 */
export function formatThreadPreview(tweets: string[]): {
	preview: string;
	tweetCount: number;
	warning: string | null;
} {
	const total = tweets.length;

	const preview = tweets
		.map((tweet, i) => `${i + 1}/${total} (${tweet.length} chars)\n${tweet}`)
		.join("\n\n");

	const warning = total > 7 ? `Thread has ${total} tweets (recommended max: 7)` : null;

	return { preview, tweetCount: total, warning };
}
