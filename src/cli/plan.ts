import { eq } from "drizzle-orm";
import { getUnifiedCalendar, type UnifiedCalendar } from "../approval/calendar.ts";
import { createHubConnection } from "../core/db/connection.ts";
import { type PlanSlot as DbPlanSlot, weeklyPlans } from "../core/db/schema.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import { transitionIdea } from "../ideas/lifecycle.ts";
import { getCalendarState, loadStrategyConfig } from "../planning/calendar.ts";
import { generatePlanIdeas } from "../planning/ideation.ts";
import { suggestLanguages } from "../planning/language.ts";
import { getRecycleSuggestions, getRemixSuggestions } from "../planning/recycling.ts";
import { allocateSlots } from "../planning/slotting.ts";
import type { PlanSlot } from "../planning/types.ts";
import { discoverCompanyHubs, getHubDb } from "../team/hub.ts";

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

function getWeekStart(): Date {
	const now = new Date();
	const dayOfWeek = now.getUTCDay();
	const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = start of week
	const weekStart = new Date(now);
	weekStart.setUTCDate(now.getUTCDate() - diff);
	weekStart.setUTCHours(0, 0, 0, 0);
	return weekStart;
}

// ─── Exported Subcommands ───────────────────────────────────────────────────

export async function calendarCommand(): Promise<UnifiedCalendar> {
	const personalDb = await getDb();
	const weekStart = getWeekStart();
	const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

	// Discover company hubs (graceful fallback to personal-only)
	let companyHubs: Array<{
		connection: import("../team/types.ts").HubConnection;
		db: import("../core/db/connection.ts").HubDb;
	}> = [];
	try {
		const connections = await discoverCompanyHubs();
		companyHubs = connections.map((connection) => ({
			connection,
			db: getHubDb(connection),
		}));
	} catch {
		// Hub discovery failed — fall back to personal-only calendar
	}

	// TEAM-07: Unified calendar shows all hubs (personal + company)
	// Already implemented: see lines 43-67, getUnifiedCalendar called with companyHubs
	return getUnifiedCalendar({
		personalDb,
		companyHubs,
		userId: "default",
		startDate: weekStart,
		endDate: weekEnd,
	});
}

export async function ideateCommand(opts?: { count?: number; platform?: string }) {
	const db = await getDb();
	const strategy = await loadStrategyConfig();
	const pillars = strategy?.pillars ?? [{ name: "general", weight: 1 }];
	return generatePlanIdeas(db, "default", pillars, {
		count: opts?.count ?? 12,
		platform: opts?.platform,
	});
}

export async function rateCommand(
	ideaId: string,
	rating: "love" | "maybe" | "kill",
	reason?: string,
) {
	const db = await getDb();

	switch (rating) {
		case "love":
			return transitionIdea(db, ideaId, "ready");
		case "maybe":
			return transitionIdea(db, ideaId, "seed");
		case "kill":
			return transitionIdea(db, ideaId, "killed", { killReason: reason });
		default:
			throw new Error(`Invalid rating: ${rating}. Use: love, maybe, kill`);
	}
}

export async function slotCommand() {
	const db = await getDb();
	const weekStart = getWeekStart();
	const strategy = await loadStrategyConfig();
	const pillars = strategy?.pillars ?? [{ name: "general", weight: 1 }];

	const calendarState = await getCalendarState(db, "default", weekStart);
	const ideas = await generatePlanIdeas(db, "default", pillars);

	return allocateSlots(calendarState, ideas, calendarState.seriesDue, {
		strategyConfig: strategy ?? undefined,
	});
}

export async function languagesCommand() {
	const db = await getDb();
	const weekStart = getWeekStart();
	const strategy = await loadStrategyConfig();
	const pillars = strategy?.pillars ?? [{ name: "general", weight: 1 }];

	const calendarState = await getCalendarState(db, "default", weekStart);
	const ideas = await generatePlanIdeas(db, "default", pillars);
	const slots = allocateSlots(calendarState, ideas, calendarState.seriesDue, {
		strategyConfig: strategy ?? undefined,
	});

	return suggestLanguages(slots, strategy, db, "default");
}

export async function remixCommand(limit?: number) {
	const db = await getDb();
	return getRemixSuggestions(db, "default", limit);
}

export async function recycleCommand(limit?: number) {
	const db = await getDb();
	return getRecycleSuggestions(db, "default", limit);
}

export async function saveCommand(planJson: string) {
	const db = await getDb();
	const plan = JSON.parse(planJson) as { slots: PlanSlot[] };
	const weekStart = getWeekStart();
	const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

	// Convert planning PlanSlot[] to DB PlanSlot[] (seriesEpisode: string -> number)
	const dbSlots: DbPlanSlot[] = plan.slots.map((s) => ({
		...s,
		seriesEpisode: s.seriesEpisode
			? Number.parseInt(s.seriesEpisode.replace(/\D/g, ""), 10) || undefined
			: undefined,
	}));

	const rows = await db
		.insert(weeklyPlans)
		.values({
			userId: "default",
			weekStart,
			weekEnd,
			slots: dbSlots,
			totalSlots: dbSlots.length,
			completedSlots: dbSlots.filter((s) => s.status === "published").length,
		})
		.returning();

	return rows[0];
}

export async function statusCommand() {
	const db = await getDb();
	const weekStart = getWeekStart();

	const rows = await db
		.select()
		.from(weeklyPlans)
		.where(eq(weeklyPlans.weekStart, weekStart))
		.limit(1);

	if (rows.length === 0) {
		return { exists: false, message: "No plan exists for this week." };
	}

	return { exists: true, plan: rows[0] };
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	async function main() {
		switch (command) {
			case "calendar": {
				const result = await calendarCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "ideate": {
				const count = getArg(args, "count");
				const platform = getArg(args, "platform");
				const result = await ideateCommand({
					count: count ? Number(count) : undefined,
					platform,
				});
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "rate": {
				const ideaId = args[1];
				const rating = args[2] as "love" | "maybe" | "kill";
				const reason = getArg(args, "reason");
				if (!ideaId || !rating) {
					console.log(
						JSON.stringify({ error: "Usage: rate <ideaId> <love|maybe|kill> [--reason text]" }),
					);
					process.exit(1);
				}
				const result = await rateCommand(ideaId, rating, reason);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "slot": {
				const result = await slotCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "languages": {
				const result = await languagesCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "remix": {
				const limit = getArg(args, "limit");
				const result = await remixCommand(limit ? Number(limit) : undefined);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "recycle": {
				const limit = getArg(args, "limit");
				const result = await recycleCommand(limit ? Number(limit) : undefined);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "save": {
				const planJson = args[1];
				if (!planJson) {
					console.log(JSON.stringify({ error: "Usage: save '<json>'" }));
					process.exit(1);
				}
				const result = await saveCommand(planJson);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "status": {
				const result = await statusCommand();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			default: {
				console.log(
					JSON.stringify({
						error: `Unknown command: ${command}`,
						usage:
							"calendar | ideate | rate <id> <rating> | slot | languages | remix | recycle | save <json> | status",
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
