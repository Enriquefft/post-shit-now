import { eq } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { preferenceModel } from "../core/db/schema.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LockedSetting {
	field: string;
	value: unknown;
	lockedAt: string;
}

// ─── Pure Functions ─────────────────────────────────────────────────────────

/**
 * Check if a field is locked. Pure function -- no DB access.
 * Used by the adjustments engine before making changes.
 */
export function isSettingLocked(lockedSettings: LockedSetting[] | null, field: string): boolean {
	if (!lockedSettings) return false;
	return lockedSettings.some((s) => s.field === field);
}

// ─── DB Operations ──────────────────────────────────────────────────────────

/**
 * Lock a setting permanently. If the field is already locked, update its value and timestamp.
 * Per user decision: locks are permanent until explicitly unlocked.
 */
export async function lockSetting(
	db: HubDb,
	userId: string,
	field: string,
	value: unknown,
): Promise<LockedSetting[]> {
	const rows = await db
		.select({ lockedSettings: preferenceModel.lockedSettings })
		.from(preferenceModel)
		.where(eq(preferenceModel.userId, userId))
		.limit(1);

	const current = (rows[0]?.lockedSettings as LockedSetting[] | null) ?? [];

	const newEntry: LockedSetting = {
		field,
		value,
		lockedAt: new Date().toISOString(),
	};

	// Replace existing lock for same field, or add new
	const updated = current.filter((s) => s.field !== field);
	updated.push(newEntry);

	await db
		.update(preferenceModel)
		.set({ lockedSettings: updated, updatedAt: new Date() })
		.where(eq(preferenceModel.userId, userId));

	return updated;
}

/**
 * Unlock a setting. Requires explicit action -- no auto-expiry.
 */
export async function unlockSetting(
	db: HubDb,
	userId: string,
	field: string,
): Promise<LockedSetting[]> {
	const rows = await db
		.select({ lockedSettings: preferenceModel.lockedSettings })
		.from(preferenceModel)
		.where(eq(preferenceModel.userId, userId))
		.limit(1);

	const current = (rows[0]?.lockedSettings as LockedSetting[] | null) ?? [];
	const updated = current.filter((s) => s.field !== field);

	await db
		.update(preferenceModel)
		.set({ lockedSettings: updated, updatedAt: new Date() })
		.where(eq(preferenceModel.userId, userId));

	return updated;
}

/**
 * Get all locked settings for display.
 */
export async function getLockedSettings(db: HubDb, userId: string): Promise<LockedSetting[]> {
	const rows = await db
		.select({ lockedSettings: preferenceModel.lockedSettings })
		.from(preferenceModel)
		.where(eq(preferenceModel.userId, userId))
		.limit(1);

	return (rows[0]?.lockedSettings as LockedSetting[] | null) ?? [];
}
