import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import type { Platform } from "../core/types/index.ts";
import type { PostFormat } from "./format-picker.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DraftFrontmatter {
	id: string;
	platform: Platform;
	format: PostFormat;
	persona: string;
	language: string;
	status: "draft" | "review" | "approved" | "published" | "awaiting-recording";
	createdAt: string;
	publishedAt: string | null;
	hub?: "personal" | "company";
	metadata?: Record<string, unknown>;
}

export interface DraftSummary {
	id: string;
	path: string;
	platform: Platform;
	format: PostFormat;
	status: string;
	createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DRAFTS_DIR = "content/drafts";
const MEDIA_DIR = "content/media";

// ─── Save Draft ─────────────────────────────────────────────────────────────

export async function saveDraft(params: {
	content: string;
	platform: Platform;
	format: PostFormat;
	persona?: string;
	language?: string;
	hub?: "personal" | "company";
	status?: DraftFrontmatter["status"];
	metadata?: Record<string, unknown>;
}): Promise<{ draftPath: string; draftId: string }> {
	const draftId = crypto.randomUUID();
	const frontmatter: DraftFrontmatter = {
		id: draftId,
		platform: params.platform,
		format: params.format,
		persona: params.persona ?? "personal",
		language: params.language ?? "en",
		status: params.status ?? "draft",
		createdAt: new Date().toISOString(),
		publishedAt: null,
		...(params.hub ? { hub: params.hub } : {}),
		...(params.metadata ? { metadata: params.metadata } : {}),
	};

	const fileContent = `---\n${stringify(frontmatter)}---\n${params.content}\n`;
	const draftPath = join(DRAFTS_DIR, `${draftId}.md`);

	await mkdir(DRAFTS_DIR, { recursive: true });
	await writeFile(draftPath, fileContent, "utf-8");

	return { draftPath, draftId };
}

// ─── Load Draft ─────────────────────────────────────────────────────────────

export async function loadDraft(
	draftId: string,
): Promise<{ frontmatter: DraftFrontmatter; content: string }> {
	const draftPath = join(DRAFTS_DIR, `${draftId}.md`);
	const raw = await readFile(draftPath, "utf-8");

	// Parse YAML frontmatter
	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!fmMatch) {
		throw new Error(`Invalid draft format: ${draftPath}`);
	}

	const { parse } = await import("yaml");
	const frontmatter = parse(fmMatch[1] ?? "") as DraftFrontmatter;
	const content = (fmMatch[2] ?? "").trim();

	return { frontmatter, content };
}

// ─── Update Draft ───────────────────────────────────────────────────────────

export async function updateDraft(
	draftId: string,
	updates: Partial<Pick<DraftFrontmatter, "status" | "hub" | "publishedAt" | "metadata">>,
): Promise<{ frontmatter: DraftFrontmatter; content: string }> {
	const { frontmatter, content } = await loadDraft(draftId);

	const updated: DraftFrontmatter = {
		...frontmatter,
		...updates,
		metadata: updates.metadata
			? { ...frontmatter.metadata, ...updates.metadata }
			: frontmatter.metadata,
	};

	const fileContent = `---\n${stringify(updated)}---\n${content}\n`;
	const draftPath = join(DRAFTS_DIR, `${draftId}.md`);
	await writeFile(draftPath, fileContent, "utf-8");

	return { frontmatter: updated, content };
}

// ─── List Drafts ────────────────────────────────────────────────────────────

export async function listDrafts(filter?: {
	platform?: Platform;
	status?: string;
}): Promise<DraftSummary[]> {
	try {
		const files = await readdir(DRAFTS_DIR);
		const mdFiles = files.filter((f) => f.endsWith(".md"));

		const drafts: DraftSummary[] = [];

		for (const file of mdFiles) {
			try {
				const raw = await readFile(join(DRAFTS_DIR, file), "utf-8");
				const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;

				const { parse } = await import("yaml");
				const fm = parse(fmMatch[1] ?? "") as DraftFrontmatter;

				// Apply filters
				if (filter?.platform && fm.platform !== filter.platform) continue;
				if (filter?.status && fm.status !== filter.status) continue;

				drafts.push({
					id: fm.id,
					path: join(DRAFTS_DIR, file),
					platform: fm.platform,
					format: fm.format,
					status: fm.status,
					createdAt: fm.createdAt,
				});
			} catch {
				// Skip malformed draft files
			}
		}

		// Sort by createdAt descending
		return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	} catch {
		// Directory doesn't exist yet
		return [];
	}
}

// ─── Prune Drafts ───────────────────────────────────────────────────────────

export async function pruneDrafts(options?: {
	maxAgeDays?: number;
}): Promise<{ pruned: number; remaining: number }> {
	const maxAge = (options?.maxAgeDays ?? 14) * 24 * 60 * 60 * 1000;
	const now = Date.now();
	let pruned = 0;

	try {
		const files = await readdir(DRAFTS_DIR);
		const mdFiles = files.filter((f) => f.endsWith(".md"));

		for (const file of mdFiles) {
			try {
				const filePath = join(DRAFTS_DIR, file);
				const raw = await readFile(filePath, "utf-8");
				const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
				if (!fmMatch) continue;

				const { parse } = await import("yaml");
				const fm = parse(fmMatch[1] ?? "") as DraftFrontmatter;

				// Only prune published drafts older than maxAge
				if (fm.status === "published" && fm.publishedAt) {
					const publishedTime = new Date(fm.publishedAt).getTime();
					if (now - publishedTime > maxAge) {
						await rm(filePath);
						pruned++;
					}
				}
			} catch {
				// Skip malformed files
			}
		}

		const remaining = (await readdir(DRAFTS_DIR)).filter((f) => f.endsWith(".md")).length;
		return { pruned, remaining };
	} catch {
		return { pruned: 0, remaining: 0 };
	}
}

// ─── Media Storage ──────────────────────────────────────────────────────────

export async function saveMedia(buffer: Buffer, filename: string): Promise<string> {
	await mkdir(MEDIA_DIR, { recursive: true });
	const filePath = join(MEDIA_DIR, filename);
	await writeFile(filePath, buffer);
	return filePath;
}

export async function pruneMedia(options?: { maxAgeDays?: number }): Promise<{ pruned: number }> {
	const maxAge = (options?.maxAgeDays ?? 7) * 24 * 60 * 60 * 1000;
	const now = Date.now();
	let pruned = 0;

	try {
		const files = await readdir(MEDIA_DIR);

		for (const file of files) {
			if (file === ".gitkeep") continue;
			try {
				const filePath = join(MEDIA_DIR, file);
				const fileStat = await stat(filePath);
				if (now - fileStat.mtimeMs > maxAge) {
					await rm(filePath);
					pruned++;
				}
			} catch {
				// Skip inaccessible files
			}
		}
	} catch {
		// Directory doesn't exist
	}

	return { pruned };
}
