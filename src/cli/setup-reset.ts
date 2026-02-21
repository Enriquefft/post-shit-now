import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

interface ResetResult {
	action: string;
	description: string;
	path?: string;
}

export async function setupReset(
	_configDir = "config",
	projectRoot = ".",
	scope: { db: boolean; files: boolean },
	dryRun = false,
): Promise<{ results: ResetResult[]; error?: string }> {
	const results: ResetResult[] = [];

	// Default behavior: require explicit scope (user decision)
	if (!scope.db && !scope.files) {
		return {
			results: [],
			error: "No scope specified. Use --db, --files, or --all flags.",
		};
	}

	// --db scope: delete drizzle/meta directory
	if (scope.db) {
		const metaDir = join(projectRoot, "drizzle", "meta");
		try {
			const metaStat = await stat(metaDir);
			if (metaStat.isDirectory()) {
				if (dryRun) {
					results.push({
						action: "[DRY RUN] Delete",
						description: "drizzle/meta directory (migration state)",
						path: metaDir,
					});
				} else {
					await rm(metaDir, { recursive: true });
					results.push({
						action: "Deleted",
						description: "drizzle/meta directory (migration state)",
						path: metaDir,
					});
				}
			}
		} catch {
			results.push({
				action: "Skipped",
				description: "drizzle/meta directory not found (already clean)",
			});
		}
	}

	// --files scope: delete .hubs directory
	if (scope.files) {
		const hubsDir = join(projectRoot, ".hubs");
		try {
			const hubsStat = await stat(hubsDir);
			if (hubsStat.isDirectory()) {
				const entries = await readdir(hubsDir);
				const fileCount = entries.filter((e) => e.endsWith(".json")).length;

				if (dryRun) {
					results.push({
						action: "[DRY RUN] Delete",
						description: `.hubs directory (${fileCount} hub connection files)`,
						path: hubsDir,
					});
				} else {
					await rm(hubsDir, { recursive: true });
					results.push({
						action: "Deleted",
						description: `.hubs directory (${fileCount} hub connection files)`,
						path: hubsDir,
					});
				}
			}
		} catch {
			results.push({
				action: "Skipped",
				description: ".hubs directory not found (already clean)",
			});
		}
	}

	return { results };
}
