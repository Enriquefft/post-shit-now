import { describe, expect, test } from "vitest";
import { computeCalibrationFromEdits, computeEditDistance } from "./calibration.ts";

describe("computeEditDistance", () => {
	test("identical strings return distance 0", () => {
		const result = computeEditDistance("Hello world", "Hello world");
		expect(result.distance).toBe(0);
		expect(result.ratio).toBe(0);
		expect(result.patterns).toEqual([]);
	});

	test("minor word replacement yields low distance", () => {
		const result = computeEditDistance(
			"I think this is a great approach to building software",
			"I believe this is a great approach to building software",
		);
		expect(result.distance).toBeLessThanOrEqual(4);
		expect(result.ratio).toBeLessThan(30);
		expect(result.patterns.some((p) => p.type === "word-choice")).toBe(true);
	});

	test("major rewrite yields high distance and rewrite pattern", () => {
		const original = "The quick brown fox jumps over the lazy dog near the river bank";
		const edited = "A fast red cat leaps across the sleepy hound by the stream shore";
		const result = computeEditDistance(original, edited);
		expect(result.ratio).toBeGreaterThan(50);
		expect(result.patterns.some((p) => p.type === "rewrite")).toBe(true);
	});

	test("pure addition detected", () => {
		const result = computeEditDistance("Hello world", "Hello world this is new content added");
		expect(result.distance).toBeGreaterThan(0);
		expect(result.patterns.some((p) => p.type === "addition")).toBe(true);
	});

	test("pure removal detected", () => {
		const result = computeEditDistance(
			"Hello world this is extra content that will be removed",
			"Hello world",
		);
		expect(result.distance).toBeGreaterThan(0);
		expect(result.patterns.some((p) => p.type === "removal")).toBe(true);
	});

	test("significant length change detected", () => {
		const original = "Short post";
		const edited =
			"Short post with a lot more content added to make it significantly longer than the original";
		const result = computeEditDistance(original, edited);
		expect(result.patterns.some((p) => p.type === "length-change")).toBe(true);
	});

	test("handles thread content stored as JSON arrays", () => {
		const original = JSON.stringify(["First tweet in thread", "Second tweet in thread"]);
		const edited = JSON.stringify(["First tweet in thread", "Modified second tweet"]);
		const result = computeEditDistance(original, edited);
		expect(result.distance).toBeGreaterThan(0);
	});

	test("ratio capped at 100", () => {
		const result = computeEditDistance("a", "completely different long text with many words added");
		expect(result.ratio).toBeLessThanOrEqual(100);
	});
});

describe("computeCalibrationFromEdits", () => {
	test("empty ratios return uncalibrated", () => {
		const result = computeCalibrationFromEdits([]);
		expect(result.status).toBe("uncalibrated");
		expect(result.confidence).toBe(0);
		expect(result.trend).toBe("stable");
		expect(result.avgEditDistance).toBe(0);
	});

	test("few posts return calibrating", () => {
		const result = computeCalibrationFromEdits([20, 18, 15]);
		expect(result.status).toBe("calibrating");
		expect(result.confidence).toBeGreaterThan(0);
	});

	test("10 consecutive posts below threshold return calibrated", () => {
		const ratios = [10, 8, 12, 9, 14, 11, 7, 13, 10, 8];
		const result = computeCalibrationFromEdits(ratios);
		expect(result.status).toBe("calibrated");
		expect(result.confidence).toBeGreaterThan(0.8);
	});

	test("posts above threshold remain calibrating", () => {
		const ratios = [10, 8, 12, 9, 14, 11, 7, 13, 10, 20]; // last one is >= 15
		const result = computeCalibrationFromEdits(ratios);
		expect(result.status).toBe("calibrating");
	});

	test("improving trend detected when second half is lower", () => {
		const ratios = [50, 45, 40, 35, 30, 20, 15, 10, 8, 5];
		const result = computeCalibrationFromEdits(ratios);
		expect(result.trend).toBe("improving");
	});

	test("worsening trend detected when second half is higher", () => {
		const ratios = [5, 8, 10, 15, 20, 30, 35, 40, 45, 50];
		const result = computeCalibrationFromEdits(ratios);
		expect(result.trend).toBe("worsening");
	});

	test("stable trend when halves are similar", () => {
		const ratios = [20, 22, 18, 21, 19, 20, 22, 18, 21, 19];
		const result = computeCalibrationFromEdits(ratios);
		expect(result.trend).toBe("stable");
	});

	test("confidence scales inversely with avg edit ratio", () => {
		const low = computeCalibrationFromEdits([5, 5, 5]);
		const high = computeCalibrationFromEdits([80, 80, 80]);
		expect(low.confidence).toBeGreaterThan(high.confidence);
	});

	test("avgEditDistance is rounded to one decimal", () => {
		const result = computeCalibrationFromEdits([10, 15, 20]);
		expect(result.avgEditDistance).toBe(15);
		const result2 = computeCalibrationFromEdits([10, 11, 12]);
		expect(result2.avgEditDistance).toBe(11);
	});
});
