import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import type { HubDb } from "../core/db/connection.ts";
import { loadProfile } from "../voice/profile.ts";
import {
	checkCooldown,
	checkDailyCap,
	isBlocked,
	loadEngagementConfig,
	recordEngagement,
} from "./config.ts";
import { draftQuotePost, draftReplies, type QuotePostDraft, type ReplyDraft } from "./drafting.ts";
import { fromBasisPoints } from "./scoring.ts";
import type { DailyCapResult, EngagementOpportunity, SuggestedEngagement } from "./types.ts";
import { suggestedEngagementSchema } from "./types.ts";

// ─── Raw SQL Row Schemas ──────────────────────────────────────────────────

const opportunityRowSchema = z
	.object({
		id: z.string(),
		user_id: z.string(),
		platform: z.string(),
		external_post_id: z.string(),
		author_handle: z.string(),
		author_follower_count: z.coerce.number().nullable(),
		post_snippet: z.string(),
		post_url: z.string().nullable(),
		posted_at: z.coerce.date().nullable(),
		composite_score_bps: z.coerce.number().nullable(),
		relevance_score_bps: z.coerce.number().nullable(),
		recency_score_bps: z.coerce.number().nullable(),
		reach_score_bps: z.coerce.number().nullable(),
		potential_score_bps: z.coerce.number().nullable(),
		suggested_type: suggestedEngagementSchema.nullable(),
		detected_at: z.coerce.date().nullable().optional(),
	})
	.passthrough();

const authorHandleRowSchema = z
	.object({
		author_handle: z.string(),
	})
	.passthrough();

// ─── Session Types ────────────────────────────────────────────────────────

export interface EngagementSession {
	sessionId: string;
	opportunities: EngagementOpportunity[];
	capsRemaining: Record<string, DailyCapResult>;
}

export interface TriageDecision {
	id: string;
	decision: "yes" | "no" | "skip";
}

export interface DraftResult {
	opportunityId: string;
	drafts: ReplyDraft[] | QuotePostDraft[];
	opportunity: EngagementOpportunity;
}

export interface ExecuteEngagementInput {
	opportunityId: string;
	content: string;
	type: SuggestedEngagement;
	platform: string;
}

export interface ExecuteResult {
	opportunityId: string;
	success: boolean;
	error?: string;
	externalReplyId?: string;
}

export interface ContentBridgeSuggestion {
	topic: string;
	angle: string;
	sourceOpportunity: EngagementOpportunity;
}

// ─── Create Engagement Session ────────────────────────────────────────────

/**
 * Load pending opportunities (score >= 60, not expired, not already triaged).
 * Sort by composite score descending. Check daily caps for each platform.
 */
export async function createEngagementSession(
	db: HubDb,
	userId: string,
): Promise<EngagementSession> {
	// Generate session ID
	const sessionId = `eng-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	// Load pending opportunities with score >= 60 (6000 bps)
	const result = await db.execute(sql`
		SELECT
			id, user_id, platform, external_post_id, author_handle,
			author_follower_count, post_snippet, post_url, posted_at,
			composite_score_bps, relevance_score_bps, recency_score_bps,
			reach_score_bps, potential_score_bps,
			status, suggested_type, detected_at
		FROM engagement_opportunities
		WHERE user_id = ${userId}
			AND status = 'pending'
			AND composite_score_bps >= 6000
			AND detected_at >= NOW() - INTERVAL '48 hours'
		ORDER BY composite_score_bps DESC
		LIMIT 50
	`);

	const rows = z.array(opportunityRowSchema).parse(result.rows);

	const opportunities: EngagementOpportunity[] = rows.map((row) => ({
		id: row.id,
		userId: row.user_id,
		platform: row.platform,
		externalPostId: row.external_post_id,
		authorHandle: row.author_handle,
		authorFollowerCount: row.author_follower_count ?? undefined,
		postSnippet: row.post_snippet,
		postUrl: row.post_url ?? undefined,
		postedAt: row.posted_at ?? undefined,
		score: {
			composite: fromBasisPoints(row.composite_score_bps ?? 0),
			relevance: fromBasisPoints(row.relevance_score_bps ?? 0),
			recency: fromBasisPoints(row.recency_score_bps ?? 0),
			reach: fromBasisPoints(row.reach_score_bps ?? 0),
			potential: fromBasisPoints(row.potential_score_bps ?? 0),
		},
		status: "pending",
		suggestedType: row.suggested_type ?? "reply",
		detectedAt: row.detected_at ?? undefined,
	}));

	// Check daily caps for each platform
	const platforms = [...new Set(opportunities.map((o) => o.platform))];
	const capsRemaining: Record<string, DailyCapResult> = {};

	for (const platform of platforms) {
		capsRemaining[platform] = await checkDailyCap(db, userId, platform);
	}

	return { sessionId, opportunities, capsRemaining };
}

// ─── Triage Opportunities ─────────────────────────────────────────────────

/**
 * Batch update opportunity statuses based on user decisions.
 * yes -> triaged_yes, no -> triaged_no, skip -> unchanged.
 */
export async function triageOpportunities(
	db: HubDb,
	opportunityIds: string[],
	decisions: TriageDecision[],
): Promise<string[]> {
	const approvedIds: string[] = [];

	for (const decision of decisions) {
		if (!opportunityIds.includes(decision.id)) continue;

		if (decision.decision === "yes") {
			await db.execute(sql`
				UPDATE engagement_opportunities
				SET status = 'triaged_yes'
				WHERE id = ${decision.id}::uuid
			`);
			approvedIds.push(decision.id);
		} else if (decision.decision === "no") {
			await db.execute(sql`
				UPDATE engagement_opportunities
				SET status = 'triaged_no'
				WHERE id = ${decision.id}::uuid
			`);
		}
		// "skip" -> no status change
	}

	return approvedIds;
}

// ─── Draft for Approved ───────────────────────────────────────────────────

/**
 * For each approved opportunity: load opportunity data, call draftReplies/draftQuotePost
 * based on suggestedType. Returns drafts for Claude to present to user.
 */
export async function draftForApproved(
	db: HubDb,
	_userId: string,
	approvedIds: string[],
	voiceProfilePath?: string,
): Promise<DraftResult[]> {
	if (approvedIds.length === 0) return [];

	const voiceProfile = await loadProfile(voiceProfilePath);
	const results: DraftResult[] = [];

	for (const oppId of approvedIds) {
		// Load opportunity data
		const oppResult = await db.execute(sql`
			SELECT
				id, user_id, platform, external_post_id, author_handle,
				author_follower_count, post_snippet, post_url, posted_at,
				composite_score_bps, relevance_score_bps, recency_score_bps,
				reach_score_bps, potential_score_bps,
				suggested_type
			FROM engagement_opportunities
			WHERE id = ${oppId}::uuid
		`);

		const row = opportunityRowSchema.optional().parse(oppResult.rows[0]);
		if (!row) continue;

		const opportunity: EngagementOpportunity = {
			id: row.id,
			userId: row.user_id,
			platform: row.platform,
			externalPostId: row.external_post_id,
			authorHandle: row.author_handle,
			authorFollowerCount: row.author_follower_count ?? undefined,
			postSnippet: row.post_snippet,
			postUrl: row.post_url ?? undefined,
			postedAt: row.posted_at ?? undefined,
			score: {
				composite: fromBasisPoints(row.composite_score_bps ?? 0),
				relevance: fromBasisPoints(row.relevance_score_bps ?? 0),
				recency: fromBasisPoints(row.recency_score_bps ?? 0),
				reach: fromBasisPoints(row.reach_score_bps ?? 0),
				potential: fromBasisPoints(row.potential_score_bps ?? 0),
			},
			status: "triaged_yes",
			suggestedType: row.suggested_type ?? "reply",
		};

		const suggestedType = opportunity.suggestedType ?? "reply";

		if (suggestedType === "quote") {
			const draft = draftQuotePost({ opportunity, voiceProfile });
			results.push({ opportunityId: oppId, drafts: [draft], opportunity });
		} else {
			const drafts = draftReplies({ opportunity, voiceProfile });
			results.push({ opportunityId: oppId, drafts, opportunity });
		}

		// Update status to drafted
		await db.execute(sql`
			UPDATE engagement_opportunities
			SET status = 'drafted'
			WHERE id = ${oppId}::uuid
		`);
	}

	return results;
}

// ─── Execute Engagement ───────────────────────────────────────────────────

/**
 * Post approved replies via platform clients.
 * CRITICAL: Called ONLY after human approval per ENGAGE-05. Never auto-posts.
 *
 * For each engagement: check daily cap, check cooldown, check not blocked.
 * If all pass: record in engagement_log and update opportunity status.
 *
 * Note: Actual platform API calls are handled by the CLI layer which has
 * access to authenticated platform clients. This function handles the
 * DB recording and guard checks.
 */
export async function executeEngagement(
	db: HubDb,
	userId: string,
	engagements: ExecuteEngagementInput[],
): Promise<ExecuteResult[]> {
	const config = await loadEngagementConfig(db, userId);
	const results: ExecuteResult[] = [];

	for (const engagement of engagements) {
		try {
			// Guard: daily cap
			const capCheck = await checkDailyCap(db, userId, engagement.platform);
			if (!capCheck.allowed) {
				results.push({
					opportunityId: engagement.opportunityId,
					success: false,
					error: `Daily cap reached for ${engagement.platform} (${capCheck.cap}/${capCheck.cap})`,
				});
				continue;
			}

			// Guard: cooldown
			const cooldownCheck = await checkCooldown(db, userId, engagement.platform);
			if (!cooldownCheck.allowed) {
				results.push({
					opportunityId: engagement.opportunityId,
					success: false,
					error: `Cooldown active for ${engagement.platform} (wait ${cooldownCheck.waitMinutes} min)`,
				});
				continue;
			}

			// Guard: blocklist check on opportunity author
			const oppResult = await db.execute(sql`
				SELECT author_handle FROM engagement_opportunities
				WHERE id = ${engagement.opportunityId}::uuid
			`);
			const oppRow = authorHandleRowSchema.optional().parse(oppResult.rows[0]);
			if (oppRow && isBlocked(config, oppRow.author_handle)) {
				results.push({
					opportunityId: engagement.opportunityId,
					success: false,
					error: `Author @${oppRow.author_handle} is blocked`,
				});
				continue;
			}

			// Record engagement in log
			await recordEngagement(
				db,
				userId,
				engagement.opportunityId,
				engagement.platform,
				engagement.type,
				engagement.content,
			);

			// Update opportunity status to engaged
			await db.execute(sql`
				UPDATE engagement_opportunities
				SET status = 'engaged'
				WHERE id = ${engagement.opportunityId}::uuid
			`);

			results.push({
				opportunityId: engagement.opportunityId,
				success: true,
			});
		} catch (err) {
			results.push({
				opportunityId: engagement.opportunityId,
				success: false,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return results;
}

// ─── Bridge to Content Creation ───────────────────────────────────────────

/**
 * Analyze engaged opportunities for content creation potential.
 * Returns suggested post ideas that can be captured into the idea bank.
 *
 * Per ENGAGE-07: After engagement session, bridge to content creation
 * by asking "Any of these conversations spark a post idea?"
 */
export function bridgeToContentCreation(
	opportunities: EngagementOpportunity[],
	_userId: string,
): ContentBridgeSuggestion[] {
	const suggestions: ContentBridgeSuggestion[] = [];

	for (const opp of opportunities) {
		// Only suggest content from engaged opportunities with high relevance
		if (opp.score.relevance < 60) continue;

		// Extract topic and suggest an angle based on the engagement
		const snippet = opp.postSnippet.slice(0, 100);
		const platform = opp.platform;

		suggestions.push({
			topic: `Inspired by @${opp.authorHandle}'s ${platform} post: "${snippet}..."`,
			angle:
				opp.suggestedType === "quote"
					? "Expand your quote post perspective into a full post"
					: opp.suggestedType === "duet" || opp.suggestedType === "stitch"
						? "Turn your video response angle into a standalone piece"
						: "Build on your reply -- expand the conversation into a full post",
			sourceOpportunity: opp,
		});
	}

	// Return top 5 most relevant suggestions
	return suggestions
		.sort((a, b) => b.sourceOpportunity.score.relevance - a.sourceOpportunity.score.relevance)
		.slice(0, 5);
}
