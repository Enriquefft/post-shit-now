import { sql } from "drizzle-orm";
import type { createHubConnection } from "../core/db/connection.ts";

// ─── Types ─────────────────────────────────────────────────────────────────

type DrizzleClient = ReturnType<typeof createHubConnection>;

export type ParsedCommand =
	| { command: "approve"; postId?: string }
	| { command: "reject"; reason?: string; postId?: string }
	| { command: "select"; index: number }
	| { command: "view"; postId?: string }
	| { command: "retry"; postId?: string }
	| { command: "skip" }
	| { command: "list" }
	| { command: "help" }
	| { command: "edit"; content?: string }
	| { command: "post"; topic?: string }
	| { command: "time"; time?: string };

export interface ConversationState {
	pendingApprovalPostId?: string;
	options?: Array<{ id: string; label: string }>;
	lastEventType?: string;
	lastEventAt?: string;
}

export interface CommandResult {
	response: string;
	buttons?: Array<{ id: string; body: string }>;
	updateState?: Partial<ConversationState>;
}

// ─── Command Parser ────────────────────────────────────────────────────────
// Parses incoming WhatsApp messages into structured commands.
// Supports both button tap IDs and text input (numbered fallback).

export function parseIncomingCommand(message: string, buttonId?: string): ParsedCommand | null {
	// Button tap — direct mapping
	if (buttonId) {
		const lower = buttonId.toLowerCase();
		switch (lower) {
			case "approve":
				return { command: "approve" };
			case "reject":
				return { command: "reject" };
			case "view":
				return { command: "view" };
			case "retry":
				return { command: "retry" };
			case "cancel":
				return { command: "skip" };
			case "reauth":
				return { command: "view" }; // redirect to view for re-auth guidance
			case "view_analytics":
				return { command: "view" };
			case "r1":
				return { command: "select", index: 0 };
			case "r2":
				return { command: "select", index: 1 };
			case "r3":
				return { command: "select", index: 2 };
			default:
				return null;
		}
	}

	// Text message parsing
	const text = message.trim().toLowerCase();

	// Reject with reason: "reject reason: ..." or "reject: ..."
	const rejectReasonMatch = message.match(/^reject(?:\s+reason)?:\s*(.+)/i);
	if (rejectReasonMatch) {
		return { command: "reject", reason: rejectReasonMatch[1]?.trim() };
	}

	// Simple commands
	switch (text) {
		case "approve":
		case "approved":
			return { command: "approve" };
		case "reject":
		case "rejected":
			return { command: "reject" };
		case "skip":
			return { command: "skip" };
		case "list":
			return { command: "list" };
		case "help":
		case "?":
			return { command: "help" };
		case "view":
			return { command: "view" };
		case "retry":
			return { command: "retry" };
	}

	// Selection commands: R1, R2, R3
	const selectionMatch = text.match(/^r([1-3])$/);
	if (selectionMatch) {
		return { command: "select", index: Number(selectionMatch[1]) - 1 };
	}

	// Numeric input: context-dependent (1=approve, 2=reject, or selection)
	if (/^[1-9]$/.test(text)) {
		const num = Number(text);
		if (num <= 3) {
			return { command: "select", index: num - 1 };
		}
	}

	return null;
}

// ─── Command Processor ────────────────────────────────────────────────────

export async function processCommand(
	db: DrizzleClient,
	params: { userId: string; command: ParsedCommand; sessionState: ConversationState },
): Promise<CommandResult> {
	const { userId, command, sessionState } = params;

	switch (command.command) {
		case "approve": {
			const postId = command.postId ?? sessionState.pendingApprovalPostId;
			if (!postId) {
				// No context — list pending approvals
				return listPendingApprovals(db, userId);
			}
			await db.execute(sql`
				UPDATE posts
				SET approval_status = 'approved', reviewer_id = ${userId}, reviewed_at = NOW(), updated_at = NOW()
				WHERE id = ${postId}::uuid AND approval_status = 'submitted'
			`);
			return {
				response: `Post approved successfully.`,
				updateState: { pendingApprovalPostId: undefined, lastEventType: undefined },
			};
		}

		case "reject": {
			const postId = command.postId ?? sessionState.pendingApprovalPostId;
			if (!postId) {
				return listPendingApprovals(db, userId);
			}
			await db.execute(sql`
				UPDATE posts
				SET approval_status = 'rejected',
				    reviewer_id = ${userId},
				    review_comment = ${command.reason ?? null},
				    reviewed_at = NOW(),
				    updated_at = NOW()
				WHERE id = ${postId}::uuid AND approval_status = 'submitted'
			`);
			return {
				response: `Post rejected.${command.reason ? ` Reason: ${command.reason}` : ""}`,
				updateState: { pendingApprovalPostId: undefined, lastEventType: undefined },
			};
		}

		case "select": {
			if (!sessionState.options || command.index >= sessionState.options.length) {
				return { response: "No options available. Send 'list' to see pending items." };
			}
			const selected = sessionState.options[command.index];
			if (!selected) {
				return { response: "Invalid selection." };
			}
			// Set selected item as pending approval context
			return {
				response: `Selected: ${selected.label}\n\nReply 'approve' or 'reject [reason]' to proceed.`,
				buttons: [
					{ id: "approve", body: "Approve" },
					{ id: "reject", body: "Reject" },
				],
				updateState: { pendingApprovalPostId: selected.id },
			};
		}

		case "view": {
			const postId = command.postId ?? sessionState.pendingApprovalPostId;
			if (!postId) {
				return { response: "No post selected. Send 'list' to see pending items." };
			}
			const postResult = await db.execute(sql`
				SELECT content, platform, scheduled_at FROM posts
				WHERE id = ${postId}::uuid
				LIMIT 1
			`);
			const post = postResult.rows[0] as { content: string; platform: string; scheduled_at: Date | null } | undefined;
			if (!post) {
				return { response: "Post not found." };
			}
			const preview = post.content.length > 500 ? `${post.content.substring(0, 500)}...` : post.content;
			return {
				response: `Platform: ${post.platform}\nScheduled: ${post.scheduled_at ? new Date(post.scheduled_at).toISOString() : "unscheduled"}\n\n${preview}`,
				buttons: [
					{ id: "approve", body: "Approve" },
					{ id: "reject", body: "Reject" },
				],
			};
		}

		case "retry": {
			const postId = command.postId ?? sessionState.pendingApprovalPostId;
			if (!postId) {
				return { response: "No post selected to retry." };
			}
			await db.execute(sql`
				UPDATE posts SET status = 'scheduled', fail_reason = NULL, updated_at = NOW()
				WHERE id = ${postId}::uuid AND status = 'failed'
			`);
			return {
				response: "Post queued for retry.",
				updateState: { pendingApprovalPostId: undefined },
			};
		}

		case "list":
			return listPendingApprovals(db, userId);

		case "help":
			return { response: HELP_TEXT };

		case "skip":
			return {
				response: "Skipped. Context cleared.",
				updateState: { pendingApprovalPostId: undefined, options: undefined, lastEventType: undefined },
			};

		default:
			return { response: "Unrecognized command. Send 'help' for available commands." };
	}
}

// ─── Conversation State Management ─────────────────────────────────────────

export async function updateConversationState(
	db: DrizzleClient,
	params: { userId: string; state: Partial<ConversationState> },
): Promise<void> {
	const stateJson = JSON.stringify(params.state);
	await db.execute(sql`
		UPDATE whatsapp_sessions
		SET conversation_context = COALESCE(conversation_context, '{}'::jsonb) || ${stateJson}::jsonb,
		    last_activity_at = NOW(),
		    updated_at = NOW()
		WHERE user_id = ${params.userId}
	`);
}

export async function clearConversationState(db: DrizzleClient, userId: string): Promise<void> {
	await db.execute(sql`
		UPDATE whatsapp_sessions
		SET conversation_context = '{}'::jsonb,
		    last_activity_at = NOW(),
		    updated_at = NOW()
		WHERE user_id = ${userId}
	`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function listPendingApprovals(db: DrizzleClient, userId: string): Promise<CommandResult> {
	// Find hubs where user is admin
	const hubsResult = await db.execute(sql`
		SELECT hub_id FROM team_members
		WHERE user_id = ${userId} AND role = 'admin' AND left_at IS NULL
	`);
	const hubIds = (hubsResult.rows as Array<{ hub_id: string }>).map((r) => r.hub_id);

	if (hubIds.length === 0) {
		return { response: "No pending approvals. You are not an admin of any hub." };
	}

	// Find pending posts in those hubs
	const pendingResult = await db.execute(sql`
		SELECT p.id, p.content, p.platform, p.scheduled_at
		FROM posts p
		JOIN team_members tm ON tm.user_id = p.user_id AND tm.left_at IS NULL
		WHERE tm.hub_id = ANY(${hubIds})
		  AND p.approval_status = 'submitted'
		ORDER BY p.scheduled_at ASC NULLS LAST
		LIMIT 5
	`);

	const pending = pendingResult.rows as Array<{
		id: string;
		content: string;
		platform: string;
		scheduled_at: Date | null;
	}>;

	if (pending.length === 0) {
		return { response: "No pending approvals." };
	}

	const options = pending.map((p) => ({
		id: p.id,
		label: `[${p.platform}] ${p.content.substring(0, 60)}${p.content.length > 60 ? "..." : ""}`,
	}));

	const listText = options.map((o, i) => `R${i + 1}. ${o.label}`).join("\n");

	return {
		response: `Pending approvals (${pending.length}):\n\n${listText}\n\nReply R1-R${options.length} to select.`,
		updateState: { options },
	};
}

export const HELP_TEXT = `Available commands:
- approve / 1 - Approve pending post
- reject [reason] / 2 - Reject pending post
- R1/R2/R3 - Select an option
- skip - Skip current item
- list - Show pending items
- help - Show this message`;
