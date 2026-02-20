import { logger } from "@trigger.dev/sdk";
import { and, eq, sql } from "drizzle-orm";
import type { HubDb } from "../core/db/connection.ts";
import { editHistory, posts } from "../core/db/schema.ts";
import { isAdmin } from "../team/members.ts";
import { notificationDispatcherTask } from "../trigger/notification-dispatcher.ts";
import { isValidTransition } from "./types.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApprovalResult {
	success: boolean;
	error?: string;
}

interface ApprovalStatusInfo {
	approvalStatus: string | null;
	reviewerId?: string;
	reviewComment?: string;
	reviewedAt?: Date;
}

interface PendingApproval {
	postId: string;
	userId: string;
	content: string;
	platform: string;
	scheduledAt?: Date;
	submittedAt: Date;
}

interface ApprovalStats {
	pending: number;
	approvedToday: number;
	rejectedToday: number;
}

// ─── Submit for Approval ────────────────────────────────────────────────────

/**
 * Submit a draft post for admin approval.
 * Transitions: draft -> submitted.
 * NOTIF-01: Notify admins about new approval request via notification dispatcher.
 * Already wired: see lines 84-99, approval.requested notification trigger.
 */
export async function submitForApproval(
	db: HubDb,
	params: { postId: string; userId: string; hubId: string },
): Promise<ApprovalResult> {
	const { postId, userId } = params;

	// Fetch post
	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

	if (!post) {
		return { success: false, error: "Post not found" };
	}

	if (post.userId !== userId) {
		return { success: false, error: "Post does not belong to this user" };
	}

	// Check current approval status (null or 'draft' allowed)
	const currentStatus = post.approvalStatus ?? "draft";
	if (!isValidTransition(currentStatus, "submitted")) {
		return {
			success: false,
			error: `Cannot submit: post is in '${currentStatus}' status`,
		};
	}

	await db
		.update(posts)
		.set({
			approvalStatus: "submitted",
			updatedAt: new Date(),
		})
		.where(eq(posts.id, postId));

	// Notify admins about new approval request (fire-and-forget)
	try {
		await notificationDispatcherTask.trigger({
			eventType: "approval.requested",
			userId,
			hubId: params.hubId,
			payload: {
				postId,
				title: post.content.slice(0, 60),
			},
		});
	} catch (notifError) {
		logger.warn("Failed to trigger approval.requested notification", {
			postId,
			error: notifError instanceof Error ? notifError.message : String(notifError),
		});
	}

	return { success: true };
}

// ─── Approve Post ───────────────────────────────────────────────────────────

/**
 * Approve a submitted post. Only admins can approve.
 * Optionally edit content during approval (tracked in edit_history).
 */
export async function approvePost(
	db: HubDb,
	params: {
		postId: string;
		reviewerId: string;
		hubId: string;
		comment?: string;
		editedContent?: string;
	},
): Promise<ApprovalResult> {
	const { postId, reviewerId, hubId, comment, editedContent } = params;

	// Verify reviewer is admin
	const adminCheck = await isAdmin(db, { userId: reviewerId, hubId });
	if (!adminCheck) {
		return { success: false, error: "Only admins can approve posts" };
	}

	// Fetch post
	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

	if (!post) {
		return { success: false, error: "Post not found" };
	}

	// Verify post is in submitted status
	if (!isValidTransition(post.approvalStatus ?? "draft", "approved")) {
		return {
			success: false,
			error: `Cannot approve: post is in '${post.approvalStatus ?? "draft"}' status`,
		};
	}

	// If editedContent provided, track in edit_history
	if (editedContent && editedContent !== post.content) {
		const originalLen = post.content.length;
		const editedLen = editedContent.length;
		const editDistance = Math.abs(originalLen - editedLen);
		const editRatio = originalLen > 0 ? Math.round((editDistance / originalLen) * 100) : 0;

		await db.insert(editHistory).values({
			userId: reviewerId,
			postId,
			originalContent: post.content,
			editedContent,
			editDistance,
			editRatio,
			editPatterns: [{ type: "rewrite", description: "Admin edit during approval", count: 1 }],
		});
	}

	const now = new Date();
	await db
		.update(posts)
		.set({
			approvalStatus: "approved",
			reviewerId,
			reviewComment: comment ?? null,
			reviewedAt: now,
			...(editedContent && editedContent !== post.content ? { content: editedContent } : {}),
			updatedAt: now,
		})
		.where(eq(posts.id, postId));

	// Notify author that post was approved (fire-and-forget)
	try {
		await notificationDispatcherTask.trigger({
			eventType: "approval.result",
			userId: post.userId,
			hubId,
			payload: {
				postId,
				result: "approved",
				approvedBy: reviewerId,
			},
		});
	} catch (notifError) {
		logger.warn("Failed to trigger approval.result notification", {
			postId,
			error: notifError instanceof Error ? notifError.message : String(notifError),
		});
	}

	return { success: true };
}

// ─── Reject Post ────────────────────────────────────────────────────────────

/**
 * Reject a submitted post. Only admins can reject.
 * Author can edit and re-submit after rejection (rejected -> draft -> submitted).
 */
export async function rejectPost(
	db: HubDb,
	params: {
		postId: string;
		reviewerId: string;
		hubId: string;
		comment?: string;
	},
): Promise<ApprovalResult> {
	const { postId, reviewerId, hubId, comment } = params;

	// Verify reviewer is admin
	const adminCheck = await isAdmin(db, { userId: reviewerId, hubId });
	if (!adminCheck) {
		return { success: false, error: "Only admins can reject posts" };
	}

	// Fetch post
	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

	if (!post) {
		return { success: false, error: "Post not found" };
	}

	// Verify post is in submitted status
	if (!isValidTransition(post.approvalStatus ?? "draft", "rejected")) {
		return {
			success: false,
			error: `Cannot reject: post is in '${post.approvalStatus ?? "draft"}' status`,
		};
	}

	const now = new Date();
	await db
		.update(posts)
		.set({
			approvalStatus: "rejected",
			reviewerId,
			reviewComment: comment ?? null,
			reviewedAt: now,
			updatedAt: now,
		})
		.where(eq(posts.id, postId));

	// Notify author that post was rejected (fire-and-forget)
	try {
		await notificationDispatcherTask.trigger({
			eventType: "approval.result",
			userId: post.userId,
			hubId,
			payload: {
				postId,
				result: "rejected",
				rejectedBy: reviewerId,
				reason: comment ?? undefined,
			},
		});
	} catch (notifError) {
		logger.warn("Failed to trigger approval.result notification", {
			postId,
			error: notifError instanceof Error ? notifError.message : String(notifError),
		});
	}

	return { success: true };
}

// ─── Resubmit Post ─────────────────────────────────────────────────────────

/**
 * Return a rejected post to draft status for re-editing and re-submission.
 * Clears reviewer fields so the post can go through the approval cycle again.
 */
export async function resubmitPost(
	db: HubDb,
	params: { postId: string; userId: string },
): Promise<ApprovalResult> {
	const { postId, userId } = params;

	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);

	if (!post) {
		return { success: false, error: "Post not found" };
	}

	if (post.userId !== userId) {
		return { success: false, error: "Post does not belong to this user" };
	}

	if (!isValidTransition(post.approvalStatus ?? "draft", "draft")) {
		return {
			success: false,
			error: `Cannot resubmit: post is in '${post.approvalStatus ?? "draft"}' status`,
		};
	}

	await db
		.update(posts)
		.set({
			approvalStatus: "draft",
			reviewerId: null,
			reviewComment: null,
			reviewedAt: null,
			updatedAt: new Date(),
		})
		.where(eq(posts.id, postId));

	return { success: true };
}

// ─── Get Approval Status ────────────────────────────────────────────────────

/**
 * Get the approval status of a specific post.
 * Returns null if post not found.
 */
export async function getApprovalStatus(
	db: HubDb,
	postId: string,
): Promise<ApprovalStatusInfo | null> {
	const [post] = await db
		.select({
			approvalStatus: posts.approvalStatus,
			reviewerId: posts.reviewerId,
			reviewComment: posts.reviewComment,
			reviewedAt: posts.reviewedAt,
		})
		.from(posts)
		.where(eq(posts.id, postId))
		.limit(1);

	if (!post) return null;

	return {
		approvalStatus: post.approvalStatus,
		reviewerId: post.reviewerId ?? undefined,
		reviewComment: post.reviewComment ?? undefined,
		reviewedAt: post.reviewedAt ?? undefined,
	};
}

// ─── List Pending Approvals ─────────────────────────────────────────────────

/**
 * List all posts pending admin approval in a given hub.
 * Ordered by scheduledAt ascending (most urgent first).
 */
export async function listPendingApprovals(db: HubDb, hubId: string): Promise<PendingApproval[]> {
	const rows = await db
		.select({
			id: posts.id,
			userId: posts.userId,
			content: posts.content,
			platform: posts.platform,
			scheduledAt: posts.scheduledAt,
			updatedAt: posts.updatedAt,
		})
		.from(posts)
		.where(and(eq(posts.approvalStatus, "submitted"), sql`${posts.metadata}->>'hubId' = ${hubId}`))
		.orderBy(posts.scheduledAt);

	return rows.map((row) => ({
		postId: row.id,
		userId: row.userId,
		content: row.content,
		platform: row.platform,
		scheduledAt: row.scheduledAt ?? undefined,
		submittedAt: row.updatedAt, // updatedAt is when it was submitted
	}));
}

// ─── Approval Stats ─────────────────────────────────────────────────────────

/**
 * Get approval statistics for a hub: pending count, today's approved/rejected counts.
 * Used in calendar and digest views.
 */
export async function getApprovalStats(db: HubDb, hubId: string): Promise<ApprovalStats> {
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	// Pending count
	const pendingRows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(and(eq(posts.approvalStatus, "submitted"), sql`${posts.metadata}->>'hubId' = ${hubId}`));

	// Approved today
	const approvedRows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(
			and(
				eq(posts.approvalStatus, "approved"),
				sql`${posts.metadata}->>'hubId' = ${hubId}`,
				sql`${posts.reviewedAt} >= ${todayStart.toISOString()}`,
			),
		);

	// Rejected today
	const rejectedRows = await db
		.select({ id: posts.id })
		.from(posts)
		.where(
			and(
				eq(posts.approvalStatus, "rejected"),
				sql`${posts.metadata}->>'hubId' = ${hubId}`,
				sql`${posts.reviewedAt} >= ${todayStart.toISOString()}`,
			),
		);

	return {
		pending: pendingRows.length,
		approvedToday: approvedRows.length,
		rejectedToday: rejectedRows.length,
	};
}
