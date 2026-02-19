import { createHubConnection } from "../core/db/connection.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import { detectSeriesPatterns } from "../series/detection.ts";
import { getDueEpisodes, recordEpisodePublished } from "../series/episodes.ts";
import {
	createSeries,
	getSeriesAnalytics,
	getSeries,
	listSeries,
	pauseSeries,
	resumeSeries,
	retireSeries,
	updateSeries,
} from "../series/manager.ts";
import type { CreateSeriesInput, SeriesTemplate } from "../series/types.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getDb() {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}
	return createHubConnection(hubEnv.data.databaseUrl);
}

function getArg(args: string[], name: string): string | undefined {
	const idx = args.indexOf(`--${name}`);
	if (idx === -1 || idx + 1 >= args.length) return undefined;
	return args[idx + 1];
}

// ─── Exported Subcommands ───────────────────────────────────────────────────

export async function createCommand(input: CreateSeriesInput) {
	const db = await getDb();
	return createSeries(db, "default", input);
}

export async function listCommand(opts?: {
	status?: string;
	platform?: string;
	hubId?: string;
}) {
	const db = await getDb();
	return listSeries(db, "default", opts);
}

export async function pauseCommand(seriesId: string) {
	const db = await getDb();
	return pauseSeries(db, seriesId);
}

export async function resumeCommand(seriesId: string) {
	const db = await getDb();
	return resumeSeries(db, seriesId);
}

export async function retireCommand(seriesId: string) {
	const db = await getDb();
	return retireSeries(db, seriesId);
}

export async function analyticsCommand(seriesId: string) {
	const db = await getDb();
	return getSeriesAnalytics(db, seriesId);
}

export async function dueCommand() {
	const db = await getDb();
	return getDueEpisodes(db, "default");
}

export async function detectCommand() {
	const db = await getDb();
	return detectSeriesPatterns(db, "default");
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	async function main() {
		switch (command) {
			case "create": {
				const name = getArg(args, "name");
				const platform = getArg(args, "platform") ?? "x";
				const cadence = getArg(args, "cadence") ?? "weekly";
				const pillar = getArg(args, "pillar");
				const templateJson = getArg(args, "template");
				const trackingMode = getArg(args, "tracking-mode");
				const trackingFormat = getArg(args, "tracking-format");
				const cadenceCustomDays = getArg(args, "cadence-days");
				const description = getArg(args, "description");
				const hubId = getArg(args, "hub");

				if (!name) {
					console.log(
						JSON.stringify({ error: "Missing --name argument" }),
					);
					process.exit(1);
				}

				const template: SeriesTemplate = templateJson
					? (JSON.parse(templateJson) as SeriesTemplate)
					: { formatStructure: "standard", sections: [] };

				const input: CreateSeriesInput = {
					name,
					description,
					platform,
					template,
					cadence: cadence as CreateSeriesInput["cadence"],
					cadenceCustomDays: cadenceCustomDays
						? Number(cadenceCustomDays)
						: undefined,
					trackingMode: trackingMode as
						| CreateSeriesInput["trackingMode"]
						| undefined,
					trackingFormat,
					pillar,
					hubId,
				};

				const result = await createCommand(input);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "list": {
				const result = await listCommand({
					status: getArg(args, "status"),
					platform: getArg(args, "platform"),
					hubId: getArg(args, "hub"),
				});
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "pause": {
				const seriesId = args[1];
				if (!seriesId) {
					console.log(
						JSON.stringify({ error: "Missing series ID. Usage: pause <seriesId>" }),
					);
					process.exit(1);
				}
				const result = await pauseCommand(seriesId);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "resume": {
				const seriesId = args[1];
				if (!seriesId) {
					console.log(
						JSON.stringify({ error: "Missing series ID. Usage: resume <seriesId>" }),
					);
					process.exit(1);
				}
				const result = await resumeCommand(seriesId);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "retire": {
				const seriesId = args[1];
				if (!seriesId) {
					console.log(
						JSON.stringify({ error: "Missing series ID. Usage: retire <seriesId>" }),
					);
					process.exit(1);
				}
				const result = await retireCommand(seriesId);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "analytics": {
				const seriesId = args[1];
				if (!seriesId) {
					console.log(
						JSON.stringify({ error: "Missing series ID. Usage: analytics <seriesId>" }),
					);
					process.exit(1);
				}
				const result = await analyticsCommand(seriesId);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "due": {
				const result = await dueCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "detect": {
				const result = await detectCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			default: {
				console.log(
					JSON.stringify({
						error: `Unknown command: ${command}`,
						usage:
							"create | list | pause <id> | resume <id> | retire <id> | analytics <id> | due | detect",
					}),
				);
				process.exit(1);
			}
		}
	}

	main().catch((err) => {
		console.log(
			JSON.stringify({
				error: err instanceof Error ? err.message : String(err),
			}),
		);
		process.exit(1);
	});
}
