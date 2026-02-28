/**
 * Thread auto-splitter for X/Twitter threads.
 *
 * Splits long text into tweet-sized chunks respecting:
 * 1. Paragraph boundaries (\n\n) first
 * 2. Sentence boundaries (.!?) second
 * 3. Word boundaries as last resort
 *
 * Uses weighted character counting (countTweetChars) for all size
 * comparisons -- URLs=23, emoji=2, CJK=2, Latin=1.
 *
 * Never splits mid-word. Appends fraction suffix " i/N" to each tweet.
 * Maximum thread length: 10 tweets.
 */

import { countTweetChars } from "./tweet-validator.ts";

const PARAGRAPH_SEPARATOR = /\n\n+/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

/** Maximum number of tweets in a thread. */
const MAX_THREAD_LENGTH = 10;

/**
 * Calculate the character cost of a thread suffix like " 1/3" or " 10/10".
 */
function suffixLength(total: number): number {
	// Format: " i/N" -- space + digits + slash + digits
	const totalDigits = String(total).length;
	// Max index has same digit count as total
	// " " = 1, index digits, "/" = 1, total digits
	return 1 + totalDigits + 1 + totalDigits;
}

/**
 * Split raw tweets (no suffix reservation) from text and a given maxLen.
 */
function splitRaw(paragraphs: string[], maxLen: number): string[] {
	const tweets: string[] = [];

	for (const paragraph of paragraphs) {
		if (countTweetChars(paragraph) <= maxLen) {
			tweets.push(paragraph);
		} else {
			tweets.push(...splitBySentences(paragraph, maxLen));
		}
	}

	return tweets;
}

/**
 * Split text into tweet-sized chunks respecting natural boundaries.
 *
 * Each tweet in the result has a fraction suffix appended (e.g., " 1/3").
 * Space for the suffix is reserved before splitting so tweets never overflow.
 *
 * @param text - The text to split
 * @param maxLen - Maximum characters per tweet (default: 280)
 * @returns Array of tweet strings with fraction suffixes, empty array for empty/whitespace input
 */
export function splitIntoThread(text: string, maxLen = 280): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	// Split by paragraphs first (paragraph boundaries always create separate tweets)
	const paragraphs = trimmed
		.split(PARAGRAPH_SEPARATOR)
		.map((p) => p.trim())
		.filter(Boolean);

	// Single paragraph that fits -> single tweet (no suffix needed for 1 tweet)
	const first = paragraphs[0];
	if (paragraphs.length === 1 && first && countTweetChars(first) <= maxLen) {
		return [first];
	}

	// Two-pass approach for suffix reservation:
	// Pass 1: estimate tweet count with a rough suffix reservation
	const estimatedSuffix = suffixLength(MAX_THREAD_LENGTH); // worst case
	const pass1 = splitRaw(paragraphs, maxLen - estimatedSuffix);

	// If single tweet after splitting, return without suffix
	if (pass1.length === 1) {
		return pass1;
	}

	// Pass 2: re-split with actual suffix length if it differs
	const actualSuffix = suffixLength(Math.min(pass1.length, MAX_THREAD_LENGTH));
	let tweets: string[];

	if (actualSuffix !== estimatedSuffix) {
		tweets = splitRaw(paragraphs, maxLen - actualSuffix);
		// Check if the count changed the suffix length again
		const recheckSuffix = suffixLength(Math.min(tweets.length, MAX_THREAD_LENGTH));
		if (recheckSuffix !== actualSuffix) {
			tweets = splitRaw(paragraphs, maxLen - recheckSuffix);
		}
	} else {
		tweets = pass1;
	}

	// Cap at MAX_THREAD_LENGTH
	if (tweets.length > MAX_THREAD_LENGTH) {
		tweets = tweets.slice(0, MAX_THREAD_LENGTH);
	}

	const total = tweets.length;

	// Append fraction suffix to each tweet
	return tweets.map((tweet, i) => `${tweet} ${i + 1}/${total}`);
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
		if (countTweetChars(sentence) > maxLen) {
			// Sentence itself is too long, flush current and split by words
			if (current) {
				tweets.push(current.trim());
				current = "";
			}
			tweets.push(...splitByWords(sentence, maxLen));
		} else {
			const merged = current ? `${current} ${sentence}` : sentence;
			if (countTweetChars(merged) <= maxLen) {
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
		if (countTweetChars(merged) <= maxLen) {
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
 * Format a thread as a numbered preview with weighted character counts.
 *
 * @param tweets - Array of tweet strings (with or without fraction suffixes)
 * @returns Preview string, tweet count, and optional warning
 */
export function formatThreadPreview(tweets: string[]): {
	preview: string;
	tweetCount: number;
	warning: string | null;
} {
	const total = tweets.length;

	const preview = tweets
		.map((tweet, i) => `${i + 1}/${total} (${countTweetChars(tweet)} chars)\n${tweet}`)
		.join("\n\n");

	const warning =
		total > MAX_THREAD_LENGTH
			? `Thread has ${total} tweets (recommended max: ${MAX_THREAD_LENGTH})`
			: null;

	return { preview, tweetCount: total, warning };
}
