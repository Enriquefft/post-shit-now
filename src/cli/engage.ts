import { createHubConnection } from "../core/db/connection.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import {
	bridgeToContentCreation,
	createEngagementSession,
	draftForApproved,
	executeEngagement,
	triageOpportunities,
	type ExecuteEngagementInput,
	type TriageDecision,
} from "../engagement/session.ts";
import {
	getEngagementHistory,
	getEngagementStats,
} from "../engagement/tracker.ts";

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// ─── Subcommands ──────────────────────────────────────────────────────────

/**
 * session -- Load pending opportunities and daily caps for engagement session.
 */
export async function runEngagementSession(userId = "default") {
	const db = await getDb();
	const session = await createEngagementSession(db, userId);

	// Also compute content bridge suggestions from any recently engaged opportunities
	return {
		sessionId: session.sessionId,
		opportunityCount: session.opportunities.length,
		opportunities: session.opportunities.map((o) => ({
			id: o.id,
			platform: o.platform,
			authorHandle: o.authorHandle,
			authorFollowerCount: o.authorFollowerCount,
			postSnippet: o.postSnippet.slice(0, 100),
			postUrl: o.postUrl,
			compositeScore: o.score.composite,
			suggestedType: o.suggestedType,
		})),
		capsRemaining: session.capsRemaining,
	};
}

/**
 * triage -- Process user triage decisions and draft replies for approved opportunities.
 */
export async function triageCommand(decisionsJson: string, voiceProfilePath?: string) {
	const db = await getDb();
	const decisions: TriageDecision[] = JSON.parse(decisionsJson);
	const allIds = decisions.map((d) => d.id);

	// Triage opportunities
	const approvedIds = await triageOpportunities(db, allIds, decisions);

	// Draft replies for approved opportunities
	const drafts = await draftForApproved(db, "default", approvedIds, voiceProfilePath);

	return {
		triaged: decisions.length,
		approved: approvedIds.length,
		rejected: decisions.filter((d) => d.decision === "no").length,
		skipped: decisions.filter((d) => d.decision === "skip").length,
		drafts: drafts.map((d) => ({
			opportunityId: d.opportunityId,
			opportunity: {
				platform: d.opportunity.platform,
				authorHandle: d.opportunity.authorHandle,
				postSnippet: d.opportunity.postSnippet,
				suggestedType: d.opportunity.suggestedType,
			},
			draftCount: d.drafts.length,
			drafts: d.drafts,
		})),
	};
}

/**
 * execute -- Post approved engagements after human approval.
 * CRITICAL: Never called without explicit human approval per ENGAGE-05.
 */
export async function executeCommand(engagementsJson: string) {
	const db = await getDb();
	const engagements: ExecuteEngagementInput[] = JSON.parse(engagementsJson);

	const results = await executeEngagement(db, "default", engagements);

	// After execution, generate content bridge suggestions
	// Load the engaged opportunities for bridge analysis
	const engagedOpps = [];
	for (const eng of engagements) {
		if (results.find((r) => r.opportunityId === eng.opportunityId && r.success)) {
			engagedOpps.push({
				id: eng.opportunityId,
				userId: "default",
				platform: eng.platform,
				externalPostId: "",
				authorHandle: "",
				postSnippet: eng.content,
				score: { composite: 70, relevance: 70, recency: 50, reach: 50, potential: 50 },
				status: "engaged" as const,
				suggestedType: eng.type,
			});
		}
	}

	const contentBridge = bridgeToContentCreation(engagedOpps, "default");

	return {
		results: results.map((r) => ({
			opportunityId: r.opportunityId,
			success: r.success,
			error: r.error,
		})),
		succeeded: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		contentBridgeSuggestions: contentBridge.map((s) => ({
			topic: s.topic,
			angle: s.angle,
		})),
	};
}

/**
 * stats -- Show engagement statistics for a period.
 */
export async function engagementStats(period: "day" | "week" | "month" = "week") {
	const db = await getDb();
	return getEngagementStats(db, "default", period);
}

/**
 * history -- Show recent engagement entries.
 */
export async function engagementHistory(limit = 20) {
	const db = await getDb();
	return getEngagementHistory(db, "default", limit);
}

/**
 * list -- List current opportunities (alias for session with more detail).
 */
export async function listOpportunities() {
	return runEngagementSession();
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	async function main() {
		switch (command) {
			case "session": {
				const result = await runEngagementSession();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "triage": {
				const decisionsJson = getArg(args, "decisions");
				if (!decisionsJson) {
					console.log(
						JSON.stringify({
							error: 'Missing --decisions. Usage: triage --decisions \'[{"id":"uuid","decision":"yes"}]\'',
						}),
					);
					process.exit(1);
				}
				const voiceProfile = getArg(args, "voice-profile");
				const result = await triageCommand(decisionsJson, voiceProfile);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "execute": {
				const engagementsJson = getArg(args, "engagements");
				if (!engagementsJson) {
					console.log(
						JSON.stringify({
							error: 'Missing --engagements. Usage: execute --engagements \'[{"opportunityId":"uuid","content":"...","type":"reply","platform":"x"}]\'',
						}),
					);
					process.exit(1);
				}
				const result = await executeCommand(engagementsJson);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "stats": {
				const period = (getArg(args, "period") ?? "week") as "day" | "week" | "month";
				const result = await engagementStats(period);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "history": {
				const limit = getArg(args, "limit") ? Number(getArg(args, "limit")) : 20;
				const result = await engagementHistory(limit);
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			default: {
				console.log(
					JSON.stringify({
						error: `Unknown command: ${command}`,
						usage: "session | triage --decisions <json> | execute --engagements <json> | stats [--period day|week|month] | history [--limit N]",
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
