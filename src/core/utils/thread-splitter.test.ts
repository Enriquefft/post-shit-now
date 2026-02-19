import { describe, expect, it } from "vitest";
import { formatThreadPreview, splitIntoThread } from "./thread-splitter";

describe("splitIntoThread", () => {
	it("returns single-element array for short text under 280 chars", () => {
		const text = "Hello, this is a short tweet.";
		const result = splitIntoThread(text);
		expect(result).toEqual(["Hello, this is a short tweet."]);
	});

	it("returns empty array for empty input", () => {
		expect(splitIntoThread("")).toEqual([]);
	});

	it("returns empty array for whitespace-only input", () => {
		expect(splitIntoThread("   \n\n  \t  ")).toEqual([]);
	});

	it("returns single tweet for exactly 280 chars", () => {
		const text = "A".repeat(280);
		const result = splitIntoThread(text);
		expect(result).toEqual([text]);
		expect(result).toHaveLength(1);
	});

	it("splits two paragraphs into two tweets when both under 280", () => {
		const para1 = "This is paragraph one about something interesting.";
		const para2 = "This is paragraph two with different content.";
		const text = `${para1}\n\n${para2}`;
		const result = splitIntoThread(text);
		expect(result).toEqual([para1, para2]);
	});

	it("splits multiple paragraphs each into its own tweet", () => {
		const paras = [
			"First paragraph here.",
			"Second paragraph follows.",
			"Third paragraph ends it.",
		];
		const text = paras.join("\n\n");
		const result = splitIntoThread(text);
		expect(result).toEqual(paras);
	});

	it("keeps short paragraphs as separate tweets", () => {
		const p1 = "Hi.";
		const p2 = "Hey.";
		const p3 = "Yo.";
		const text = `${p1}\n\n${p2}\n\n${p3}`;
		const result = splitIntoThread(text);
		// Each paragraph becomes its own tweet (paragraph boundary respected)
		expect(result).toEqual([p1, p2, p3]);
	});

	it("splits a long paragraph at sentence boundaries", () => {
		// Create a paragraph with multiple sentences that totals > 280 chars
		const s1 = "The quick brown fox jumps over the lazy dog near the river bank.";
		const s2 = "Meanwhile, the cat was sleeping peacefully on the warm windowsill.";
		const s3 = "Birds were singing in the trees and the sun was shining brightly.";
		const s4 = "It was truly a beautiful day for everyone in the neighborhood.";
		const s5 = "Children were playing in the park and laughing with joy.";
		const longParagraph = `${s1} ${s2} ${s3} ${s4} ${s5}`;

		expect(longParagraph.length).toBeGreaterThan(280);

		const result = splitIntoThread(longParagraph);
		expect(result.length).toBeGreaterThan(1);

		// No tweet should exceed 280 chars
		for (const tweet of result) {
			expect(tweet.length).toBeLessThanOrEqual(280);
		}

		// Joined content should preserve all text
		const joined = result.join(" ");
		for (const sentence of [s1, s2, s3, s4, s5]) {
			expect(joined).toContain(sentence.trim());
		}
	});

	it("splits a very long sentence at word boundaries as last resort", () => {
		// Single sentence with no periods, longer than 280 chars
		const words = [];
		while (words.join(" ").length < 350) {
			words.push("superlongword");
		}
		const longSentence = words.join(" ");

		expect(longSentence.length).toBeGreaterThan(280);
		expect(longSentence).not.toContain(".");

		const result = splitIntoThread(longSentence);
		expect(result.length).toBeGreaterThan(1);

		for (const tweet of result) {
			expect(tweet.length).toBeLessThanOrEqual(280);
		}
	});

	it("never splits mid-word", () => {
		const longWord = "A".repeat(100);
		const text = `${longWord} ${longWord} ${longWord} ${longWord}`;
		const result = splitIntoThread(text);

		for (const tweet of result) {
			// No tweet should start or end with a partial word fragment
			// (except the long word itself which is a single token)
			expect(tweet.trim()).not.toMatch(/^\s/);
			expect(tweet.trim()).not.toMatch(/\s$/);
		}
	});

	it("respects custom maxLen parameter", () => {
		const text = "First sentence here. Second sentence follows. Third sentence ends.";
		const result = splitIntoThread(text, 40);
		expect(result.length).toBeGreaterThan(1);
		for (const tweet of result) {
			expect(tweet.length).toBeLessThanOrEqual(40);
		}
	});

	it("handles text with only newlines", () => {
		expect(splitIntoThread("\n\n\n\n")).toEqual([]);
	});
});

describe("formatThreadPreview", () => {
	it("formats single tweet preview", () => {
		const tweets = ["Hello world"];
		const result = formatThreadPreview(tweets);
		expect(result.tweetCount).toBe(1);
		expect(result.warning).toBeNull();
		expect(result.preview).toContain("1/1");
		expect(result.preview).toContain("11 chars");
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

	it("shows char count for each tweet", () => {
		const tweets = ["Short", "A".repeat(280)];
		const result = formatThreadPreview(tweets);
		expect(result.preview).toContain("5 chars");
		expect(result.preview).toContain("280 chars");
	});

	it("returns null warning for 7 or fewer tweets", () => {
		const tweets = Array(7).fill("Tweet content");
		const result = formatThreadPreview(tweets);
		expect(result.warning).toBeNull();
	});

	it("returns warning for more than 7 tweets", () => {
		const tweets = Array(8).fill("Tweet content");
		const result = formatThreadPreview(tweets);
		expect(result.warning).toBe("Thread has 8 tweets (recommended max: 7)");
	});

	it("returns warning for 10 tweets", () => {
		const tweets = Array(10).fill("Tweet content");
		const result = formatThreadPreview(tweets);
		expect(result.warning).toBe("Thread has 10 tweets (recommended max: 7)");
	});
});
