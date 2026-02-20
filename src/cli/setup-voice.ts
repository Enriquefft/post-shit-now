import { existsSync } from "node:fs";
import { join } from "node:path";
import { count, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { oauthTokens, voiceProfiles } from "../core/db/schema";
import type { SetupResult } from "../core/types/index.ts";
import { createEntity, type EntitySummary, listEntities } from "../voice/entity-profiles";
import type { MaturityLevel } from "../voice/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SetupStatus {
	hasHub: boolean;
	hasVoiceProfile: boolean;
	hasEntities: boolean;
	hasPlatforms: boolean;
	entityCount: number;
	platformList: string[];
	incompleteSteps: string[];
	recommendedAction: string;
}

export interface SetupVoiceOptions {
	userId: string;
	entitySlug?: string;
	db: PostgresJsDatabase;
	configDir: string;
}

export interface CreateEntityOptions {
	userId: string;
	displayName: string;
	description?: string;
	maturityLevel?: MaturityLevel;
	db: PostgresJsDatabase;
}

// ─── Setup Status Detection ─────────────────────────────────────────────────

/**
 * Detect current setup status for returning user flow.
 * @param configDir Config directory path
 * @param db Optional database connection for entity/platform detection
 * @param userId Optional user ID for DB queries
 */
export async function getSetupStatus(
	configDir: string,
	db?: PostgresJsDatabase,
	userId?: string,
): Promise<SetupStatus> {
	const status: SetupStatus = {
		hasHub: false,
		hasVoiceProfile: false,
		hasEntities: false,
		hasPlatforms: false,
		entityCount: 0,
		platformList: [],
		incompleteSteps: [],
		recommendedAction: "",
	};

	// Check hub.env exists -> hasHub
	const hubEnvPath = join(configDir, "hub.env");
	status.hasHub = existsSync(hubEnvPath);

	// Check content/voice/personal.yaml (legacy path) OR entities in DB
	const personalYamlPath = join("content/voice/personal.yaml");
	const hasLegacyProfile = existsSync(personalYamlPath);

	if (db && userId) {
		// Query voice_profiles count -> entityCount, hasEntities
		const entityResults = await db
			.select({ count: count() })
			.from(voiceProfiles)
			.where(eq(voiceProfiles.userId, userId));

		status.entityCount = entityResults[0]?.count ?? 0;
		status.hasEntities = status.entityCount > 0;
		status.hasVoiceProfile = hasLegacyProfile || status.hasEntities;

		// Query oauth_tokens -> platformList, hasPlatforms
		const platformResults = await db
			.selectDistinct({ platform: oauthTokens.platform })
			.from(oauthTokens)
			.where(eq(oauthTokens.userId, userId));

		status.platformList = platformResults.map((r) => r.platform);
		status.hasPlatforms = status.platformList.length > 0;
	} else {
		// Without DB, fall back to file-based checks
		status.hasVoiceProfile = hasLegacyProfile;
		status.hasEntities = hasLegacyProfile;
		status.entityCount = hasLegacyProfile ? 1 : 0;
	}

	// Build incompleteSteps array from missing items
	if (!status.hasHub) {
		status.incompleteSteps.push("hub");
	}
	if (!status.hasVoiceProfile) {
		status.incompleteSteps.push("voice");
	}
	if (!status.hasPlatforms) {
		status.incompleteSteps.push("platforms");
	}

	// Determine recommendedAction: first incomplete step
	if (status.incompleteSteps.length === 0) {
		status.recommendedAction = "all-complete";
	} else {
		const first = status.incompleteSteps[0];
		if (first === "hub") {
			status.recommendedAction = "run-setup";
		} else if (first === "voice") {
			status.recommendedAction = "setup-voice";
		} else if (first === "platforms") {
			status.recommendedAction = "connect-platform";
		} else {
			status.recommendedAction = "unknown";
		}
	}

	return status;
}

// ─── Voice Setup Handler ────────────────────────────────────────────────────

/**
 * Handle /psn:setup voice subcommand.
 * Returns interview state for Claude to render.
 */
export async function setupVoice(options: SetupVoiceOptions): Promise<SetupResult> {
	const { userId, entitySlug, db } = options;

	// If entitySlug provided: create/update entity profile
	if (entitySlug) {
		return {
			step: "voice",
			status: "need_input",
			message: `Starting voice interview for entity: ${entitySlug}`,
			data: {
				action: "interview",
				entitySlug,
				instructions: "Run voice interview with entity context",
			},
		};
	}

	// Check for existing entities
	const entities = await listEntities(db, userId);

	if (entities.length === 0) {
		// No entities: start first-run interview
		return {
			step: "voice",
			status: "need_input",
			message: "No voice profiles found. Starting first-run interview.",
			data: {
				action: "first-run-interview",
				instructions: "Create your first entity and complete voice interview",
			},
		};
	}

	// Entities exist: return list for picker
	return {
		step: "voice",
		status: "success",
		message: `${entities.length} voice profile(s) found. Select one or create new.`,
		data: {
			action: "picker",
			entities: entities.map((e: EntitySummary) => ({
				slug: e.slug,
				displayName: e.displayName,
				description: e.description,
				lastUsedAt: e.lastUsedAt?.toISOString(),
			})),
			instructions:
				"Select entity to update, or use --entity flag to specify, or use 'entity --create' to add new",
		},
	};
}

// ─── Entity Creation with Interview ─────────────────────────────────────────

/**
 * Create entity and return interview state for new entity.
 * Claude guides through interview, then calls completeInterview().
 */
export async function createEntityWithInterview(
	options: CreateEntityOptions,
): Promise<SetupResult> {
	const { userId, displayName, description, maturityLevel, db } = options;

	try {
		const slug = await createEntity(db, userId, displayName, description, maturityLevel);

		return {
			step: "entity",
			status: "success",
			message: `Entity created: ${displayName} (${slug})`,
			data: {
				action: "start-interview",
				entitySlug: slug,
				entityDisplayName: displayName,
				instructions: "Entity created. Now run voice interview to complete profile setup.",
			},
		};
	} catch (err) {
		return {
			step: "entity",
			status: "error",
			message: err instanceof Error ? err.message : String(err),
		};
	}
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	const run = async () => {
		// Default config directory
		const configDir = "config";

		if (command === "status") {
			const status = await getSetupStatus(configDir);
			return { step: "status", status: "success", data: status };
		}

		return {
			step: "setup-voice",
			status: "error",
			message: `Unknown command: ${command}`,
		};
	};

	run()
		.then((result) => {
			console.log(JSON.stringify(result, null, 2));
			process.exit(result.status === "success" ? 0 : 1);
		})
		.catch((err) => {
			console.log(
				JSON.stringify({
					step: "setup-voice",
					status: "error",
					message: err instanceof Error ? err.message : String(err),
				}),
			);
			process.exit(1);
		});
}
