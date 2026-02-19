// ─── Approval Status ────────────────────────────────────────────────────────

export type ApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

// ─── Approval State Machine ─────────────────────────────────────────────────

export const APPROVAL_TRANSITIONS: Record<string, readonly string[]> = {
	draft: ["submitted"],
	submitted: ["approved", "rejected"],
	approved: ["scheduled", "published"],
	rejected: ["draft"],
} as const;

/**
 * Check if a status transition is valid according to the approval state machine.
 */
export function isValidTransition(current: string, next: string): boolean {
	const allowed = APPROVAL_TRANSITIONS[current];
	if (!allowed) return false;
	return allowed.includes(next);
}

// ─── Approval Action ────────────────────────────────────────────────────────

export interface ApprovalAction {
	postId: string;
	action: "submit" | "approve" | "reject";
	reviewerId?: string;
	comment?: string;
	edits?: string;
}
