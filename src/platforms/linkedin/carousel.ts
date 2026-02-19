import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * A single slide in a LinkedIn carousel (document post).
 */
export interface CarouselSlide {
	/** Optional title (larger font, top area) */
	title?: string;
	/** Body text (medium font, center area with wrapping) */
	body: string;
	/** Optional embedded image (PNG or JPEG bytes) */
	imageBuffer?: Uint8Array;
	/** Image format for embedding — defaults to "png" */
	imageFormat?: "png" | "jpg";
	/** Background color as hex string (e.g. "#FFFFFF") — defaults to white */
	backgroundColor?: string;
	/** Slide number displayed in corner (optional) */
	slideNumber?: number;
}

// ─── Layout Constants ───────────────────────────────────────────────────────

/** Square format optimal for LinkedIn carousel viewing */
const PAGE_SIZE = 1080;
const MARGIN = 80;
const TITLE_FONT_SIZE = 48;
const BODY_FONT_SIZE = 32;
const SLIDE_NUMBER_FONT_SIZE = 24;
const LINE_HEIGHT_MULTIPLIER = 1.4;
const MAX_TEXT_WIDTH = PAGE_SIZE - 2 * MARGIN;

/**
 * Parse hex color string to RGB values (0-1 range).
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
	const clean = hex.replace("#", "");
	const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
	const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
	const b = Number.parseInt(clean.substring(4, 6), 16) / 255;
	return { r, g, b };
}

/**
 * Wrap text to fit within a maximum width.
 * Uses approximate character width calculation.
 */
function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
	// Approximate character width — Helvetica averages ~0.5 * fontSize
	const avgCharWidth = fontSize * 0.5;
	const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

	const lines: string[] = [];
	const paragraphs = text.split("\n");

	for (const paragraph of paragraphs) {
		if (paragraph.trim() === "") {
			lines.push("");
			continue;
		}

		const words = paragraph.split(" ");
		let currentLine = "";

		for (const word of words) {
			if (currentLine.length + word.length + 1 > maxCharsPerLine) {
				if (currentLine) lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = currentLine ? `${currentLine} ${word}` : word;
			}
		}
		if (currentLine) lines.push(currentLine);
	}

	return lines;
}

/**
 * Generate a multi-page PDF from carousel slides for LinkedIn document posts.
 *
 * Each slide becomes one PDF page (1080x1080 square) with:
 * - Optional title (larger font, top area)
 * - Body text (medium font, center area with wrapping)
 * - Optional embedded image (scaled to fit)
 * - Slide number in bottom-right corner if provided
 *
 * LinkedIn Documents API limits: max 300 pages, 100MB file size.
 * In practice, carousels are 5-15 slides.
 *
 * @returns Uint8Array of the PDF bytes
 */
export async function generateCarouselPdf(slides: CarouselSlide[]): Promise<Uint8Array> {
	if (slides.length === 0) {
		throw new Error("Cannot generate carousel PDF with zero slides");
	}
	if (slides.length > 300) {
		throw new Error("LinkedIn Documents API allows max 300 pages");
	}

	const doc = await PDFDocument.create();
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

	for (const slide of slides) {
		const page = doc.addPage([PAGE_SIZE, PAGE_SIZE]);

		// Background color
		if (slide.backgroundColor) {
			const bg = parseHexColor(slide.backgroundColor);
			page.drawRectangle({
				x: 0,
				y: 0,
				width: PAGE_SIZE,
				height: PAGE_SIZE,
				color: rgb(bg.r, bg.g, bg.b),
			});
		}

		let yPos = PAGE_SIZE - MARGIN;

		// Title (if provided)
		if (slide.title) {
			const titleLines = wrapText(slide.title, TITLE_FONT_SIZE, MAX_TEXT_WIDTH);
			for (const line of titleLines) {
				yPos -= TITLE_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
				page.drawText(line, {
					x: MARGIN,
					y: yPos,
					size: TITLE_FONT_SIZE,
					font: boldFont,
					color: rgb(0.1, 0.1, 0.1),
				});
			}
			// Add spacing after title
			yPos -= TITLE_FONT_SIZE;
		}

		// Embedded image (if provided)
		if (slide.imageBuffer) {
			try {
				const format = slide.imageFormat ?? "png";
				const image =
					format === "png"
						? await doc.embedPng(slide.imageBuffer)
						: await doc.embedJpg(slide.imageBuffer);

				// Scale image to fit within available space
				const maxImageWidth = MAX_TEXT_WIDTH;
				const maxImageHeight = (yPos - MARGIN - 100) * 0.6; // Reserve space for body text
				const scale = Math.min(
					maxImageWidth / image.width,
					maxImageHeight / image.height,
					1, // Don't upscale
				);

				const scaledWidth = image.width * scale;
				const scaledHeight = image.height * scale;

				// Center the image horizontally
				const imageX = MARGIN + (MAX_TEXT_WIDTH - scaledWidth) / 2;
				yPos -= scaledHeight + 20;

				page.drawImage(image, {
					x: imageX,
					y: yPos,
					width: scaledWidth,
					height: scaledHeight,
				});

				yPos -= 20; // Spacing after image
			} catch {
				// Image embed failed — skip and continue with text only
			}
		}

		// Body text
		const bodyLines = wrapText(slide.body, BODY_FONT_SIZE, MAX_TEXT_WIDTH);
		for (const line of bodyLines) {
			yPos -= BODY_FONT_SIZE * LINE_HEIGHT_MULTIPLIER;
			if (yPos < MARGIN) break; // Don't draw below margin
			page.drawText(line, {
				x: MARGIN,
				y: yPos,
				size: BODY_FONT_SIZE,
				font,
				color: rgb(0.2, 0.2, 0.2),
			});
		}

		// Slide number (bottom-right corner)
		if (slide.slideNumber !== undefined) {
			const slideNumText = String(slide.slideNumber);
			page.drawText(slideNumText, {
				x: PAGE_SIZE - MARGIN - SLIDE_NUMBER_FONT_SIZE,
				y: MARGIN / 2,
				size: SLIDE_NUMBER_FONT_SIZE,
				font,
				color: rgb(0.6, 0.6, 0.6),
			});
		}
	}

	return doc.save();
}
