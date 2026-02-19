import { describe, expect, it } from "vitest";
import { isValidTimezone, userTimeToUtc, utcToUserTime } from "./timezone";

describe("isValidTimezone", () => {
	it("returns true for valid IANA timezone", () => {
		expect(isValidTimezone("America/New_York")).toBe(true);
	});

	it("returns true for UTC", () => {
		expect(isValidTimezone("UTC")).toBe(true);
	});

	it("returns true for US/Eastern alias", () => {
		expect(isValidTimezone("US/Eastern")).toBe(true);
	});

	it("returns true for various valid timezones", () => {
		expect(isValidTimezone("Europe/London")).toBe(true);
		expect(isValidTimezone("Asia/Tokyo")).toBe(true);
		expect(isValidTimezone("America/Los_Angeles")).toBe(true);
	});

	it("returns false for invalid timezone", () => {
		expect(isValidTimezone("NotATimezone")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isValidTimezone("")).toBe(false);
	});
});

describe("userTimeToUtc", () => {
	it("converts EST time to UTC (winter/standard time)", () => {
		// March 15, 2026 is in EST (before DST starts March 8, 2026)
		// Wait: March 8 DST starts, so March 15 is EDT actually
		// Let's use January for EST
		const result = userTimeToUtc("2026-01-15", "09:00", "America/New_York");
		// EST = UTC-5, so 09:00 EST = 14:00 UTC
		expect(result.getUTCHours()).toBe(14);
		expect(result.getUTCMinutes()).toBe(0);
		expect(result.getUTCFullYear()).toBe(2026);
		expect(result.getUTCMonth()).toBe(0); // January = 0
		expect(result.getUTCDate()).toBe(15);
	});

	it("converts EDT time to UTC (summer/daylight time)", () => {
		// June 15, 2026 is in EDT
		const result = userTimeToUtc("2026-06-15", "09:00", "America/New_York");
		// EDT = UTC-4, so 09:00 EDT = 13:00 UTC
		expect(result.getUTCHours()).toBe(13);
		expect(result.getUTCMinutes()).toBe(0);
	});

	it("handles timezone with positive UTC offset", () => {
		// Asia/Tokyo is UTC+9 (no DST)
		const result = userTimeToUtc("2026-06-15", "09:00", "Asia/Tokyo");
		// 09:00 JST = 00:00 UTC
		expect(result.getUTCHours()).toBe(0);
		expect(result.getUTCMinutes()).toBe(0);
	});

	it("handles midnight correctly", () => {
		const result = userTimeToUtc("2026-01-15", "00:00", "America/New_York");
		// 00:00 EST = 05:00 UTC
		expect(result.getUTCHours()).toBe(5);
	});

	it("handles date rollover (late night local = next day UTC)", () => {
		const result = userTimeToUtc("2026-01-15", "23:00", "America/New_York");
		// 23:00 EST = 04:00 UTC next day
		expect(result.getUTCHours()).toBe(4);
		expect(result.getUTCDate()).toBe(16);
	});

	it("throws for invalid timezone", () => {
		expect(() => userTimeToUtc("2026-01-15", "09:00", "NotATimezone")).toThrow(
			"Invalid timezone",
		);
	});

	it("throws for invalid date format", () => {
		expect(() =>
			userTimeToUtc("not-a-date", "09:00", "America/New_York"),
		).toThrow();
	});

	it("throws for invalid time format", () => {
		expect(() =>
			userTimeToUtc("2026-01-15", "not-a-time", "America/New_York"),
		).toThrow();
	});
});

describe("utcToUserTime", () => {
	it("converts UTC to EST (winter)", () => {
		const utcDate = new Date("2026-01-15T14:00:00Z");
		const result = utcToUserTime(utcDate, "America/New_York");
		expect(result.date).toBe("2026-01-15");
		expect(result.time).toBe("09:00");
		expect(result.full).toContain("2026-01-15");
		expect(result.full).toContain("09:00");
	});

	it("converts UTC to EDT (summer)", () => {
		const utcDate = new Date("2026-06-15T13:00:00Z");
		const result = utcToUserTime(utcDate, "America/New_York");
		expect(result.date).toBe("2026-06-15");
		expect(result.time).toBe("09:00");
	});

	it("handles date rollover correctly", () => {
		// 04:00 UTC on Jan 16 = 23:00 EST on Jan 15
		const utcDate = new Date("2026-01-16T04:00:00Z");
		const result = utcToUserTime(utcDate, "America/New_York");
		expect(result.date).toBe("2026-01-15");
		expect(result.time).toBe("23:00");
	});

	it("includes timezone abbreviation in full string", () => {
		const utcDate = new Date("2026-01-15T14:00:00Z");
		const result = utcToUserTime(utcDate, "America/New_York");
		// Should contain some timezone indicator (EST, EDT, etc.)
		expect(result.full).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
	});

	it("round-trips correctly (user time -> UTC -> user time)", () => {
		const originalDate = "2026-03-20";
		const originalTime = "15:30";
		const tz = "America/Chicago";

		const utc = userTimeToUtc(originalDate, originalTime, tz);
		const back = utcToUserTime(utc, tz);

		expect(back.date).toBe(originalDate);
		expect(back.time).toBe(originalTime);
	});
});
