const TRIGGER_API_BASE = "https://api.trigger.dev";

export interface TriggerOrg {
	id: string;
	title: string;
	slug: string;
}

export interface TriggerProject {
	id: string;
	externalRef: string;
	name: string;
	slug: string;
}

/**
 * List all organizations accessible to the given Personal Access Token.
 */
export async function listTriggerOrgs(pat: string): Promise<TriggerOrg[]> {
	const res = await fetch(`${TRIGGER_API_BASE}/api/v1/orgs`, {
		headers: { Authorization: `Bearer ${pat}` },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Failed to list orgs (${res.status}): ${body}`);
	}
	return res.json() as Promise<TriggerOrg[]>;
}

/**
 * List all projects in an organization.
 */
async function listTriggerProjects(pat: string, orgId: string): Promise<TriggerProject[]> {
	const res = await fetch(`${TRIGGER_API_BASE}/api/v1/orgs/${orgId}/projects`, {
		headers: { Authorization: `Bearer ${pat}` },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Failed to list projects (${res.status}): ${body}`);
	}
	return res.json() as Promise<TriggerProject[]>;
}

/**
 * Find an existing project by name in an organization.
 * Returns null if not found.
 */
export async function findExistingProject(
	pat: string,
	orgId: string,
	name: string,
): Promise<TriggerProject | null> {
	const projects = await listTriggerProjects(pat, orgId);
	return projects.find((p) => p.name === name) ?? null;
}

/**
 * Create a new project in an organization.
 */
export async function createTriggerProject(
	pat: string,
	orgId: string,
	name: string,
): Promise<TriggerProject> {
	const res = await fetch(`${TRIGGER_API_BASE}/api/v1/orgs/${orgId}/projects`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name }),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Failed to create project (${res.status}): ${body}`);
	}
	return res.json() as Promise<TriggerProject>;
}

/**
 * Build the direct dashboard URL to the API keys page for a project.
 */
export function getSecretKeyDashboardUrl(orgSlug: string, projectSlug: string): string {
	return `https://cloud.trigger.dev/orgs/${orgSlug}/projects/${projectSlug}/apikeys`;
}
