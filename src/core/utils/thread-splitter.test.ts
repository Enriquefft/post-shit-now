import { describe, expect, it } from "vitest";
import { formatThreadPreview, splitIntoThread } from "./thread-splitter";
import { countTweetChars } from "./tweet-validator";

describe("splitIntoThread", () => {
	it("returns single-element array for short text under 280 chars (no suffix)", () => {
		const text = "Hello, this is a short tweet.";
		const result = splitIntoThread(text);
		// Single tweets have no fraction suffix
		expect(result).toEqual(["Hello, this is a short tweet."]);
	});

	it("returns empty array for empty input", () => {
		expect(splitIntoThread("")).toEqual([]);
	});

	it("returns empty array for whitespace-only input", () => {
		expect(splitIntoThread("   \n\n  \t  ")).toEqual([]);
	});

	it("returns single tweet for text that fits in 280 weighted chars", () => {
		const text = "A".repeat(280);
		const result = splitIntoThread(text);
		expect(result).toEqual([text]);
		expect(result).toHaveLength(1);
	});

	it("splits two paragraphs into two tweets with fraction suffixes", () => {
		const para1 = "This is paragraph one about something interesting.";
		const para2 = "This is paragraph two with different content.";
		const text = `${para1}\n\n${para2}`;
		const result = splitIntoThread(text);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(`${para1} 1/2`);
		expect(result[1]).toBe(`${para2} 2/2`);
	});

	it("splits multiple paragraphs each into its own tweet with suffixes", () => {
		const paras = [
			"First paragraph here.",
			"Second paragraph follows.",
			"Third paragraph ends it.",
		];
		const text = paras.join("\n\n");
		const result = splitIntoThread(text);
		expect(result).toHaveLength(3);
		expect(result[0]).toBe("First paragraph here. 1/3");
		expect(result[1]).toBe("Second paragraph follows. 2/3");
		expect(result[2]).toBe("Third paragraph ends it. 3/3");
	});

	it("keeps short paragraphs as separate tweets with suffixes", () => {
		const p1 = "Hi.";
		const p2 = "Hey.";
		const p3 = "Yo.";
		const text = `${p1}\n\n${p2}\n\n${p3}`;
		const result = splitIntoThread(text);
		expect(result).toHaveLength(3);
		expect(result[0]).toBe("Hi. 1/3");
		expect(result[1]).toBe("Hey. 2/3");
		expect(result[2]).toBe("Yo. 3/3");
	});

	it("splits a long paragraph at sentence boundaries", () => {
		const s1 = "The quick brown fox jumps over the lazy dog near the river bank.";
		const s2 = "Meanwhile, the cat was sleeping peacefully on the warm windowsill.";
		const s3 = "Birds were singing in the trees and the sun was shining brightly.";
		const s4 = "It was truly a beautiful day for everyone in the neighborhood.";
		const s5 = "Children were playing in the park and laughing with joy.";
		const longParagraph = `${s1} ${s2} ${s3} ${s4} ${s5}`;

		expect(countTweetChars(longParagraph)).toBeGreaterThan(280);

		const result = splitIntoThread(longParagraph);
		expect(result.length).toBeGreaterThan(1);

		// Each tweet (including suffix) should fit in 280 weighted chars
		for (const tweet of result) {
			expect(countTweetChars(tweet)).toBeLessThanOrEqual(280);
		}

		// Each tweet should have a fraction suffix
		for (const tweet of result) {
			expect(tweet).toMatch(/\d+\/\d+$/);
		}
	});

	it("splits a very long sentence at word boundaries as last resort", () => {
		const words = [];
		while (words.join(" ").length < 350) {
			words.push("superlongword");
		}
		const longSentence = words.join(" ");

		expect(countTweetChars(longSentence)).toBeGreaterThan(280);
		expect(longSentence).not.toContain(".");

		const result = splitIntoThread(longSentence);
		expect(result.length).toBeGreaterThan(1);

		for (const tweet of result) {
			expect(countTweetChars(tweet)).toBeLessThanOrEqual(280);
		}
	});

	it("never splits mid-word", () => {
		const longWord = "A".repeat(100);
		const text = `${longWord} ${longWord} ${longWord} ${longWord}`;
		const result = splitIntoThread(text);

		for (const tweet of result) {
			// Strip the fraction suffix before checking
			const content = tweet.replace(/\s\d+\/\d+$/, "");
			expect(content.trim()).not.toMatch(/^\s/);
			expect(content.trim()).not.toMatch(/\s$/);
		}
	});

	it("respects custom maxLen parameter", () => {
		const text = "First sentence here. Second sentence follows. Third sentence ends.";
		const result = splitIntoThread(text, 40);
		expect(result.length).toBeGreaterThan(1);
		for (const tweet of result) {
			expect(countTweetChars(tweet)).toBeLessThanOrEqual(40);
		}
	});

	it("handles text with only newlines", () => {
		expect(splitIntoThread("\n\n\n\n")).toEqual([]);
	});

	it("caps thread at 10 tweets maximum", () => {
		// Create text that would split into more than 10 tweets
		const paragraphs = Array(15)
			.fill(null)
			.map((_, i) => `This is paragraph number ${i + 1} with enough content.`);
		const text = paragraphs.join("\n\n");
		const result = splitIntoThread(text);
		expect(result.length).toBeLessThanOrEqual(10);
	});

	it("uses weighted character counting for URLs", () => {
		// URL should count as 23 chars, not actual length
		const url = "https://example.com/very/long/path/that/is/much/longer/than/23";
		const padding = "A".repeat(250);
		const text = `${padding}\n\n${url}`;
		const result = splitIntoThread(text);
		// URL tweet should fit since URL = 23 chars weighted
		expect(result.length).toBe(2);
	});
});

describe("formatThreadPreview", () => {
	it("formats single tweet preview with weighted char count", () => {
		const tweets = ["Hello world"];
		const result = formatThreadPreview(tweets);
		expect(result.tweetCount).toBe(1);
		expect(result.warning).toBeNull();
		expect(result.preview).toContain("1/1");
		expect(result.preview).toContain(`${countTweetChars("Hello world")} chars`);
		expect(result.preview).toContain("Hello world");
	});

	it("formats multi-tweet preview with correct numbering", () => {
		const tweets = ["First tweet", "Second tweet", "Third tweet"];
		const result = formatThreadPreview(tweets);
		expect(result.tweetCount).toBe(3);
		expect(result.warning).toBeNull();
		expect(result.preview).toContain("1/3");
		expect(result.preview).toContain("2/3");
		expect(result.preview).toContain("3/3");
	});

	it("shows weighted char count for each tweet", () => {
		const tweets = ["Short", "A".repeat(280)];
		const result = formatThreadPreview(tweets);
		expect(result.preview).toContain("5 chars");
		expect(result.preview).toContain("280 chars");
	});

	it("returns null warning for 10 or fewer tweets", () => {
		const tweets = Array(10).fill("Tweet content");
		const result = formatThreadPreview(tweets);
		expect(result.warning).toBeNull();
	});

	it("returns warning for more than 10 tweets", () => {
		const tweets = Array(11).fill("Tweet content");
		const result = formatThreadPreview(tweets);
		expect(result.warning).toBe("Thread has 11 tweets (recommended max: 10)");
	});

	it("uses weighted counting for emoji tweets", () => {
		const tweets = ["Hello \ud83c\udf0d"]; // Hello + globe emoji
		const result = formatThreadPreview(tweets);
		// "Hello " = 6 chars, globe emoji = 2 chars = 8 total
		expect(result.preview).toContain("8 chars");
	});
});
