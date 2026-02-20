import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../core/db/connection.ts";
import { voiceProfiles } from "../core/db/schema";
import { createBlankSlateProfile, type MaturityLevel, type VoiceProfile } from "./types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EntitySummary {
	slug: string;
	displayName: string | null;
	description: string | null;
	lastUsedAt: Date | null;
}

export interface EntityUpdates {
	displayName?: string;
	description?: string;
	profileData?: VoiceProfile;
}

// ─── Slugify Helper ─────────────────────────────────────────────────────────

/**
 * Convert a display name to a URL-safe slug.
 * @param name Display name (e.g., "PSN Founder")
 * @returns URL-safe slug (e.g., "psn-founder")
 */
export function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * List all entities for a user, ordered by lastUsedAt DESC.
 * @param db Database connection
 * @param userId User ID
 * @returns Array of EntitySummary for picker display
 */
export async function listEntities(db: DbClient, userId: string): Promise<EntitySummary[]> {
	const results = await db
		.select({
			slug: voiceProfiles.entitySlug,
			displayName: voiceProfiles.entityDisplayName,
			description: voiceProfiles.entityDescription,
			lastUsedAt: voiceProfiles.lastUsedAt,
		})
		.from(voiceProfiles)
		.where(eq(voiceProfiles.userId, userId))
		.orderBy(desc(voiceProfiles.lastUsedAt));

	return results.map((r) => ({
		slug: r.slug,
		displayName: r.displayName,
		description: r.description,
		lastUsedAt: r.lastUsedAt,
	}));
}

/**
 * Load a voice profile for a specific entity.
 * Updates lastUsedAt timestamp on successful load.
 * @param db Database connection
 * @param userId User ID
 * @param entitySlug Entity slug
 * @returns VoiceProfile if found, null otherwise
 */
export async function loadProfileByEntity(
	db: DbClient,
	userId: string,
	entitySlug: string,
): Promise<VoiceProfile | null> {
	const result = await db
		.select({
			id: voiceProfiles.id,
			profileData: voiceProfiles.profileData,
		})
		.from(voiceProfiles)
		.where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.entitySlug, entitySlug)))
		.limit(1);

	if (result.length === 0) {
		return null;
	}

	const row = result[0];
	if (!row) {
		return null;
	}

	// Update lastUsedAt timestamp
	await db
		.update(voiceProfiles)
		.set({ lastUsedAt: new Date() })
		.where(eq(voiceProfiles.id, row.id));

	return row.profileData;
}

/**
 * Create a new entity with a unique slug.
 * Handles slug collisions by appending -2, -3, etc.
 * @param db Database connection
 * @param userId User ID
 * @param displayName Human-readable entity name
 * @param description Optional description for picker
 * @param maturityLevel Optional maturity level
 * @returns Entity slug
 */
export async function createEntity(
	db: DbClient,
	userId: string,
	displayName: string,
	description?: string,
	maturityLevel?: MaturityLevel,
): Promise<string> {
	const baseSlug = slugify(displayName);
	const slug = await ensureUniqueSlug(db, userId, baseSlug);

	const profile = createBlankSlateProfile();
	profile.entitySlug = slug;
	profile.entityDisplayName = displayName;
	profile.entityDescription = description;
	profile.maturityLevel = maturityLevel;

	await db.insert(voiceProfiles).values({
		userId,
		entitySlug: slug,
		entityDisplayName: displayName,
		entityDescription: description,
		profileData: profile,
	});

	return slug;
}

/**
 * Update an entity's metadata and/or profile data.
 * @param db Database connection
 * @param userId User ID
 * @param entitySlug Entity slug
 * @param updates Fields to update
 */
export async function updateEntity(
	db: DbClient,
	userId: string,
	entitySlug: string,
	updates: EntityUpdates,
): Promise<void> {
	const updateData: Record<string, unknown> = {
		updatedAt: new Date(),
	};

	if (updates.displayName !== undefined) {
		updateData.entityDisplayName = updates.displayName;
	}
	if (updates.description !== undefined) {
		updateData.entityDescription = updates.description;
	}
	if (updates.profileData !== undefined) {
		updateData.profileData = updates.profileData;
	}

	await db
		.update(voiceProfiles)
		.set(updateData)
		.where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.entitySlug, entitySlug)));
}

/**
 * Delete an entity (hard delete).
 * @param db Database connection
 * @param userId User ID
 * @param entitySlug Entity slug
 */
export async function deleteEntity(
	db: DbClient,
	userId: string,
	entitySlug: string,
): Promise<void> {
	await db
		.delete(voiceProfiles)
		.where(and(eq(voiceProfiles.userId, userId), eq(voiceProfiles.entitySlug, entitySlug)));
}

// ─── YAML Export ────────────────────────────────────────────────────────────

const VOICE_DIR = "content/voice";

/**
 * Export a profile to YAML file for backup.
 * @param profile VoiceProfile with entity fields populated
 * @param baseDir Optional base directory (defaults to content/voice)
 */
export async function saveEntityToYaml(profile: VoiceProfile, baseDir?: string): Promise<void> {
	if (!profile.entitySlug) {
		throw new Error("Profile must have entitySlug to export to YAML");
	}

	const { stringify } = await import("yaml");
	const dir = baseDir ?? VOICE_DIR;
	const path = join(dir, `${profile.entitySlug}.yaml`);
	const tmpPath = `${path}.tmp`;

	// Ensure directory exists
	await mkdir(dir, { recursive: true });

	// Update timestamp before export
	const exportProfile = { ...profile, updatedAt: new Date().toISOString() };
	const content = stringify(exportProfile);

	// Atomic write
	await writeFile(tmpPath, content, "utf-8");
	await rename(tmpPath, path);
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Ensure slug is unique by appending -2, -3, etc. if needed.
 */
async function ensureUniqueSlug(db: DbClient, userId: string, baseSlug: string): Promise<string> {
	// Find all slugs that start with the base slug
	const results = await db
		.select({ slug: voiceProfiles.entitySlug })
		.from(voiceProfiles)
		.where(eq(voiceProfiles.userId, userId));

	const existingSlugs = new Set<string>(results.map((r) => r.slug));

	if (!existingSlugs.has(baseSlug)) {
		return baseSlug;
	}

	// Find next available number
	let counter = 2;
	while (existingSlugs.has(`${baseSlug}-${counter}`)) {
		counter++;
	}

	return `${baseSlug}-${counter}`;
}
