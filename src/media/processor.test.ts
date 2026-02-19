import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { ensureSizeLimit, getImageMetadata, processImageForPlatform } from "./processor.ts";

// ─── Helper: Create test image buffer ────────────────────────────────────────

async function createTestImage(
	width: number,
	height: number,
	format: "png" | "jpeg" = "png",
): Promise<Buffer> {
	const pipeline = sharp({
		create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
	});
	return format === "jpeg" ? pipeline.jpeg().toBuffer() : pipeline.png().toBuffer();
}

// ─── getImageMetadata ────────────────────────────────────────────────────────

describe("getImageMetadata", () => {
	it("returns correct dimensions for PNG", async () => {
		const buf = await createTestImage(640, 480, "png");
		const meta = await getImageMetadata(buf);
		expect(meta.width).toBe(640);
		expect(meta.height).toBe(480);
		expect(meta.format).toBe("png");
		expect(meta.hasAlpha).toBe(false);
		expect(meta.sizeBytes).toBe(buf.length);
	});

	it("returns correct dimensions for JPEG", async () => {
		const buf = await createTestImage(1920, 1080, "jpeg");
		const meta = await getImageMetadata(buf);
		expect(meta.width).toBe(1920);
		expect(meta.height).toBe(1080);
		expect(meta.format).toBe("jpeg");
	});

	it("detects alpha channel", async () => {
		const buf = await sharp({
			create: {
				width: 100,
				height: 100,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0.5 },
			},
		})
			.png()
			.toBuffer();
		const meta = await getImageMetadata(buf);
		expect(meta.hasAlpha).toBe(true);
	});
});

// ─── ensureSizeLimit ─────────────────────────────────────────────────────────

describe("ensureSizeLimit", () => {
	it("returns buffer unchanged if under limit", async () => {
		const buf = await createTestImage(100, 100, "jpeg");
		const result = await ensureSizeLimit(buf, 1_000_000, "jpeg");
		expect(result).toBe(buf);
	});

	it("compresses JPEG to meet size limit", async () => {
		// Create a high-quality JPEG, then verify ensureSizeLimit can reduce it
		const highQBuf = await sharp({
			create: { width: 2000, height: 2000, channels: 3, background: { r: 200, g: 100, b: 50 } },
		})
			.jpeg({ quality: 100 })
			.toBuffer();
		// Get the size at low quality to know a feasible limit
		const lowQBuf = await sharp(highQBuf).jpeg({ quality: 15 }).toBuffer();
		// Set limit between low-quality size and original size
		const limit = Math.floor((highQBuf.length + lowQBuf.length) / 2);
		const result = await ensureSizeLimit(highQBuf, limit, "jpeg");
		expect(result.length).toBeLessThanOrEqual(limit);
		expect(result.length).toBeGreaterThan(0);
	});

	it("throws if cannot compress enough", async () => {
		const buf = await createTestImage(100, 100, "jpeg");
		// Impossibly small limit
		await expect(ensureSizeLimit(buf, 10, "jpeg")).rejects.toThrow("still exceeds");
	});

	it("applies PNG compression level for PNG format", async () => {
		const buf = await createTestImage(500, 500, "png");
		// PNG compression is not iterative, so just verify it doesn't crash
		const result = await ensureSizeLimit(buf, buf.length + 1000, "png");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ─── processImageForPlatform ─────────────────────────────────────────────────

describe("processImageForPlatform", () => {
	it("resizes to X landscape dimensions", async () => {
		const buf = await createTestImage(3000, 2000);
		const result = await processImageForPlatform(buf, "x", { aspectRatio: "16:9" });
		expect(result.width).toBe(1200);
		expect(result.height).toBe(675);
		expect(result.mimeType).toBe("image/jpeg");
	});

	it("resizes to X square dimensions", async () => {
		const buf = await createTestImage(2000, 2000);
		const result = await processImageForPlatform(buf, "x", { aspectRatio: "1:1" });
		expect(result.width).toBe(1080);
		expect(result.height).toBe(1080);
	});

	it("resizes to LinkedIn portrait dimensions", async () => {
		const buf = await createTestImage(2000, 3000);
		const result = await processImageForPlatform(buf, "linkedin", { aspectRatio: "4:5" });
		expect(result.width).toBe(1080);
		expect(result.height).toBe(1350);
	});

	it("converts to JPEG for Instagram", async () => {
		const buf = await createTestImage(1080, 1080, "png");
		const result = await processImageForPlatform(buf, "instagram", { aspectRatio: "1:1" });
		expect(result.mimeType).toBe("image/jpeg");
	});

	it("resizes to TikTok vertical dimensions", async () => {
		const buf = await createTestImage(1080, 1920);
		const result = await processImageForPlatform(buf, "tiktok", { aspectRatio: "9:16" });
		expect(result.width).toBe(1080);
		expect(result.height).toBe(1920);
	});

	it("defaults to first dimension when no aspect ratio given", async () => {
		const buf = await createTestImage(3000, 2000);
		const result = await processImageForPlatform(buf, "x");
		// First dimension for X is landscape: 1200x675
		expect(result.width).toBe(1200);
		expect(result.height).toBe(675);
	});

	it("output is within platform size limit", async () => {
		const buf = await createTestImage(4000, 4000);
		const result = await processImageForPlatform(buf, "instagram", { aspectRatio: "1:1" });
		// Instagram limit: 8MB
		expect(result.sizeBytes).toBeLessThanOrEqual(8_388_608);
	});

	it("respects custom quality option", async () => {
		const buf = await createTestImage(2000, 2000);
		const highQ = await processImageForPlatform(buf, "x", { quality: 95 });
		const lowQ = await processImageForPlatform(buf, "x", { quality: 30 });
		// Lower quality should generally produce smaller files
		expect(lowQ.sizeBytes).toBeLessThan(highQ.sizeBytes);
	});

	it("resizes to Instagram story dimensions", async () => {
		const buf = await createTestImage(1080, 1920);
		const result = await processImageForPlatform(buf, "instagram", { aspectRatio: "9:16" });
		expect(result.width).toBe(1080);
		expect(result.height).toBe(1920);
	});
});
