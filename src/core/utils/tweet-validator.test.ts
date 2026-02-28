import { describe, expect, it } from "vitest";
import { countTweetChars, validateTweet } from "./tweet-validator.ts";

describe("countTweetChars", () => {
	it("counts plain ASCII text", () => {
		expect(countTweetChars("Hello")).toBe(5);
	});

	it("returns 0 for empty string", () => {
		expect(countTweetChars("")).toBe(0);
	});

	it("counts single emoji as 2 chars", () => {
		expect(countTweetChars("\u{1F600}")).toBe(2); // grinning face
	});

	it("counts ZWJ family emoji as 2 chars (1 grapheme)", () => {
		// Family: man + ZWJ + woman + ZWJ + girl
		expect(countTweetChars("\u{1F468}\u200D\u{1F469}\u200D\u{1F467}")).toBe(2);
	});

	it("counts URLs as 23 chars regardless of length", () => {
		expect(countTweetChars("https://example.com")).toBe(23);
	});

	it("counts long URLs as 23 chars", () => {
		expect(countTweetChars("https://example.com/very/long/path")).toBe(23);
	});

	it("counts bare domain as URL (23 chars)", () => {
		expect(countTweetChars("example.com")).toBe(23);
	});

	it("counts CJK characters as 2 chars each", () => {
		expect(countTweetChars("\u4F60\u597D")).toBe(4); // nihao
	});

	it("counts mixed content correctly", () => {
		// "Hi " (3) + URL (23) + " " (1) + emoji (2) = 29
		expect(countTweetChars("Hi https://example.com \u{1F600}")).toBe(29);
	});

	it("counts flag emoji as 2 chars", () => {
		// Regional indicator sequences (e.g., US flag)
		expect(countTweetChars("\u{1F1FA}\u{1F1F8}")).toBe(2);
	});

	it("counts URL followed by period correctly", () => {
		// URL (23) + period (1) = 24
		expect(countTweetChars("https://example.com.")).toBe(24);
	});

	it("counts multiple URLs correctly", () => {
		// URL (23) + space (1) + URL (23) = 47
		expect(countTweetChars("https://a.com https://b.com")).toBe(47);
	});
});

describe("validateTweet", () => {
	it("returns valid for tweet under 280 chars", () => {
		const result = validateTweet("Hello world");
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
		expect(result.charCount).toBe(11);
		expect(result.maxChars).toBe(280);
	});

	it("returns invalid for tweet over 280 chars", () => {
		const longText = "A".repeat(281);
		const result = validateTweet(longText);
		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toContain("281/280");
	});

	it("returns valid with exactly 280 chars", () => {
		const text = "A".repeat(280);
		const result = validateTweet(text);
		expect(result.valid).toBe(true);
		expect(result.charCount).toBe(280);
	});

	it("warns on 11+ mentions", () => {
		const mentions = Array.from({ length: 11 }, (_, i) => `@user${i}`).join(" ");
		const result = validateTweet(mentions);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("11 mentions");
	});

	it("warns on 6+ hashtags", () => {
		const hashtags = Array.from({ length: 6 }, (_, i) => `#tag${i}`).join(" ");
		const result = validateTweet(hashtags);
		expect(result.valid).toBe(true);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain("6 hashtags");
	});

	it("returns both error and warning for oversized tweet with excess mentions", () => {
		const mentions = Array.from({ length: 11 }, (_, i) => `@user${i}`).join(" ");
		const padding = "X".repeat(250);
		const text = `${mentions} ${padding}`;
		const result = validateTweet(text);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThanOrEqual(1);
		expect(result.warnings.length).toBeGreaterThanOrEqual(1);
	});
});
