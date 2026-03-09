import { readFileSync, writeFileSync } from "node:fs";
import type { SetupResult } from "../core/types/index.ts";
import { loadKeysEnv } from "../core/utils/env.ts";
import {
	createTriggerProject,
	findExistingProject,
	getSecretKeyDashboardUrl,
	listTriggerOrgs,
} from "./trigger-api.ts";
import { maskApiKey } from "./utils/masking.ts";
import { runStep } from "./utils/progress.ts";

const TRIGGER_CONFIG_PATH = "trigger.config.ts";
const PLACEHOLDER_REF = "<your-project-ref>";
const PSN_PROJECT_NAME = "post-shit-now";

/**
 * Set up Trigger.dev project configuration using a Personal Access Token.
 *
 * Flow:
 * 1. Skip if trigger.config.ts already configured (idempotent)
 * 2. Load TRIGGER_ACCESS_TOKEN from keys.env
 * 3. List orgs — auto-select if one, return need_input if multiple
 * 4. Find existing PSN project or create a new one
 * 5. Write project externalRef to trigger.config.ts
 * 6. Return need_input with direct dashboard link for TRIGGER_SECRET_KEY
 */
export async function setupTrigger(configDir = "config"): Promise<SetupResult> {
	// Check if trigger.config.ts already has a real project ref
	const configContent = readFileSync(TRIGGER_CONFIG_PATH, "utf-8");
	if (!configContent.includes(PLACEHOLDER_REF)) {
		return {
			step: "trigger",
			status: "skipped",
			message: "Trigger.dev already configured (project ref found in trigger.config.ts)",
		};
	}

	// Load PAT from keys.env
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "trigger", status: "error", message: keysResult.error };
	}

	const pat = keysResult.data.TRIGGER_ACCESS_TOKEN;
	if (!pat) {
		return {
			step: "trigger",
			status: "need_input",
			message: "Provide TRIGGER_ACCESS_TOKEN (Personal Access Token)",
			data: {
				key: "TRIGGER_ACCESS_TOKEN",
				source:
					"Trigger.dev Dashboard → click your avatar → Personal Access Tokens → Create new token",
				format: "tr_pat_*",
			},
		};
	}

	// List orgs
	let orgs: Awaited<ReturnType<typeof listTriggerOrgs>>;
	await runStep("Fetching Trigger.dev organizations", async () => {
		orgs = await listTriggerOrgs(pat);
	});

	// biome-ignore lint/style/noNonNullAssertion: set in runStep above
	const resolvedOrgs = orgs!;

	if (resolvedOrgs.length === 0) {
		return {
			step: "trigger",
			status: "error",
			message: "No organizations found for this PAT. Create an org on Trigger.dev first.",
		};
	}

	// If multiple orgs, ask user to select
	if (resolvedOrgs.length > 1) {
		return {
			step: "trigger",
			status: "need_input",
			message: "Multiple Trigger.dev organizations found. Which one should PSN use?",
			data: {
				key: "TRIGGER_ORG_ID",
				orgs: resolvedOrgs.map((o) => ({ id: o.id, title: o.title, slug: o.slug })),
				instructions:
					"Re-run setup with TRIGGER_ORG_ID set to the organization ID you want to use.",
			},
		};
	}

	// resolvedOrgs.length === 1 at this point (multi-org handled above)
	const org = resolvedOrgs[0] as (typeof resolvedOrgs)[0];

	// Find or create the PSN project
	let projectRef: string;
	let projectSlug: string;
	let projectAction: "found" | "created";

	await runStep("Setting up post-shit-now project", async () => {
		const existing = await findExistingProject(pat, org.id, PSN_PROJECT_NAME);
		if (existing) {
			projectRef = existing.externalRef;
			projectSlug = existing.slug;
			projectAction = "found";
		} else {
			const created = await createTriggerProject(pat, org.id, PSN_PROJECT_NAME);
			projectRef = created.externalRef;
			projectSlug = created.slug;
			projectAction = "created";
		}
	});

	// biome-ignore lint/style/noNonNullAssertion: set in runStep above
	const resolvedRef = projectRef!;
	// biome-ignore lint/style/noNonNullAssertion: set in runStep above
	const resolvedSlug = projectSlug!;
	// biome-ignore lint/style/noNonNullAssertion: set in runStep above
	const resolvedAction = projectAction!;

	// Write project ref to trigger.config.ts
	const updated = configContent.replace(PLACEHOLDER_REF, resolvedRef);
	writeFileSync(TRIGGER_CONFIG_PATH, updated);

	// Check if secret key already exists (e.g. re-running after partial setup)
	const secretKey = keysResult.data.TRIGGER_SECRET_KEY;
	if (secretKey) {
		return {
			step: "trigger",
			status: "success",
			message: `Trigger.dev configured — project ${resolvedRef} (${resolvedAction})`,
			data: { projectRef: resolvedRef, action: resolvedAction },
		};
	}

	// Prompt for secret key with direct dashboard link
	const dashboardUrl = getSecretKeyDashboardUrl(org.slug, resolvedSlug);
	return {
		step: "trigger",
		status: "need_input",
		message: `Project ${resolvedAction}: ${resolvedRef}. Now provide the dev secret key.`,
		data: {
			key: "TRIGGER_SECRET_KEY",
			source: dashboardUrl,
			format: "tr_dev_* or tr_prod_*",
			projectRef: resolvedRef,
			instructions: `Copy your dev secret key from: ${dashboardUrl}`,
		},
	};
}

/**
 * Verify Trigger.dev setup and return detailed status.
 * Used by /psn:setup trigger --verify command.
 */
export async function verifyTriggerSetup(configDir = "config"): Promise<SetupResult> {
	const keysResult = await loadKeysEnv(configDir);
	if (!keysResult.success) {
		return { step: "trigger", status: "error", message: keysResult.error };
	}

	const pat = keysResult.data.TRIGGER_ACCESS_TOKEN;
	const secretKey = keysResult.data.TRIGGER_SECRET_KEY;

	if (!secretKey) {
		return {
			step: "trigger",
			status: "error",
			message: "TRIGGER_SECRET_KEY not found in keys.env",
			suggestedAction: "Run /psn:setup to configure your Trigger.dev secret key",
		};
	}

	if (!secretKey.startsWith("tr_dev_") && !secretKey.startsWith("tr_prod_")) {
		return {
			step: "trigger",
			status: "error",
			message: "TRIGGER_SECRET_KEY has invalid format (must start with tr_dev_ or tr_prod_)",
		};
	}

	// Read project ref from trigger.config.ts
	let projectRef: string | null = null;
	try {
		const config = readFileSync(TRIGGER_CONFIG_PATH, "utf-8");
		if (config.includes(PLACEHOLDER_REF)) {
			return {
				step: "trigger",
				status: "error",
				message: "trigger.config.ts still has placeholder project ref. Run /psn:setup.",
			};
		}
		const match = config.match(/project:\s*["']([^"']+)["']/);
		projectRef = match?.[1] ?? null;
	} catch {
		return {
			step: "trigger",
			status: "error",
			message: "trigger.config.ts not found",
		};
	}

	return {
		step: "trigger",
		status: "success",
		message: `Trigger.dev configured — project ref: ${projectRef ?? "unknown"}`,
		data: {
			projectRef,
			secretKey: maskApiKey(secretKey),
			hasPat: Boolean(pat),
			environment: secretKey.startsWith("tr_prod_") ? "prod" : "dev",
		},
	};
}
