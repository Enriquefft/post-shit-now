import { createHubConnection } from "../core/db/connection.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import {
	getIdeaStats,
	getKilledIdeasSince,
	getReadyIdeas,
	listIdeas,
	searchIdeas,
} from "../ideas/bank.ts";
import { captureIdea, parseInlineTags } from "../ideas/capture.ts";
import { expireTimelyIdeas, getStaleIdeas } from "../ideas/lifecycle.ts";
import type { IdeaStatus, Urgency } from "../ideas/types.ts";

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

// ─── Subcommands ────────────────────────────────────────────────────────────

export async function captureCommand(text: string) {
	const db = await getDb();
	const { text: cleanText, tags } = parseInlineTags(text);
	const idea = await captureIdea(db, "default", {
		text: cleanText,
		tags: Object.keys(tags).length > 0 ? tags : undefined,
		pillar: tags.pillar,
		platform: tags.platform,
		format: tags.format,
		urgency: tags.urgency as Urgency | undefined,
		hub: tags.hub,
	});
	return idea;
}

export async function listCommand(opts: {
	status?: string;
	urgency?: string;
	pillar?: string;
	limit?: number;
	offset?: number;
}) {
	const db = await getDb();
	return listIdeas(db, "default", {
		status: opts.status as IdeaStatus | undefined,
		urgency: opts.urgency as Urgency | undefined,
		pillar: opts.pillar,
		limit: opts.limit,
		offset: opts.offset,
	});
}

export async function readyCommand(opts?: { pillar?: string; platform?: string; limit?: number }) {
	const db = await getDb();
	return getReadyIdeas(db, "default", opts);
}

export async function searchCommand(
	query: string,
	opts?: {
		status?: string;
		limit?: number;
	},
) {
	const db = await getDb();
	return searchIdeas(db, "default", query, {
		status: opts?.status as IdeaStatus | undefined,
		limit: opts?.limit,
	});
}

export async function statsCommand() {
	const db = await getDb();
	return getIdeaStats(db, "default");
}

export async function staleCommand() {
	const db = await getDb();
	return getStaleIdeas(db, "default");
}

export async function expireCommand() {
	const db = await getDb();
	return expireTimelyIdeas(db, "default");
}

export async function killedCommand(days = 7) {
	const db = await getDb();
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	return getKilledIdeasSince(db, "default", since);
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	async function main() {
		switch (command) {
			case "capture": {
				const text = args.slice(1).join(" ");
				if (!text) {
					console.log(
						JSON.stringify({ error: 'Missing idea text. Usage: capture "your idea #pillar:ai"' }),
					);
					process.exit(1);
				}
				const result = await captureCommand(text);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "list": {
				const result = await listCommand({
					status: getArg(args, "status"),
					urgency: getArg(args, "urgency"),
					pillar: getArg(args, "pillar"),
					limit: getArg(args, "limit") ? Number(getArg(args, "limit")) : undefined,
					offset: getArg(args, "offset") ? Number(getArg(args, "offset")) : undefined,
				});
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "ready": {
				const result = await readyCommand({
					pillar: getArg(args, "pillar"),
					platform: getArg(args, "platform"),
					limit: getArg(args, "limit") ? Number(getArg(args, "limit")) : undefined,
				});
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "search": {
				const query = args[1];
				if (!query) {
					console.log(JSON.stringify({ error: 'Missing search query. Usage: search "query"' }));
					process.exit(1);
				}
				const result = await searchCommand(query, {
					status: getArg(args, "status"),
					limit: getArg(args, "limit") ? Number(getArg(args, "limit")) : undefined,
				});
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "stats": {
				const result = await statsCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "stale": {
				const result = await staleCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "expire": {
				const result = await expireCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "killed": {
				const days = getArg(args, "days") ? Number(getArg(args, "days")) : 7;
				const result = await killedCommand(days);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			default: {
				console.log(
					JSON.stringify({
						error: `Unknown command: ${command}`,
						usage:
							"capture <text> | list | ready | search <query> | stats | stale | expire | killed",
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
