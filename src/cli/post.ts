import { runs } from "@trigger.dev/sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { createHubConnection } from "../core/db/connection.ts";
import { posts } from "../core/db/schema.ts";
import type { Platform } from "../core/types/index.ts";
import { loadHubEnv } from "../core/utils/env.ts";
import { formatThreadPreview, splitIntoThread } from "../core/utils/thread-splitter.ts";
import { userTimeToUtc, utcToUserTime } from "../core/utils/timezone.ts";
import { publishPost } from "../trigger/publish-post.ts";

// ─── Result Types ───────────────────────────────────────────────────────────

interface CreatePostResult {
	postId?: string;
	status: "draft" | "preview";
	content: string;
	platform: Platform;
	isThread: boolean;
	tweetCount?: number;
	preview?: string;
	warning?: string | null;
}

interface SchedulePostResult {
	postId: string;
	scheduledAt: string;
	scheduledAtLocal: string;
	triggerRunId: string;
}

interface PostNowResult {
	postId: string;
	triggerRunId: string;
	status: "publishing";
}

interface CancelResult {
	postId: string;
	status: "cancelled";
}

interface EditResult {
	postId: string;
	status: "scheduled";
	triggerRunId: string;
}

interface FailedPost {
	postId: string;
	content: string;
	failReason: string | null;
	failedAt: string | null;
	platform: string;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Create a new post. If content > 280 chars for X, returns a thread preview
 * for user approval before inserting into DB.
 */
export async function createPost(params: {
	content: string;
	platform: Platform;
	mediaFiles?: string[];
	scheduledAt?: string;
	scheduledTime?: string;
	timezone?: string;
}): Promise<CreatePostResult> {
	const { content, platform, mediaFiles } = params;

	// Check if thread splitting needed for X
	if (platform === "x" && content.length > 280) {
		const tweets = splitIntoThread(content);
		const { preview, tweetCount, warning } = formatThreadPreview(tweets);

		return {
			status: "preview",
			content,
			platform,
			isThread: true,
			tweetCount,
			preview,
			warning,
		};
	}

	// Insert post into DB as draft
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	const isThread = false;
	const contentToStore = content;

	// For threads that have been approved, store as JSON array
	// (this path is reached when createPost is called after preview approval)

	const rows = await db
		.insert(posts)
		.values({
			userId: "default",
			platform,
			content: contentToStore,
			mediaUrls: mediaFiles ?? null,
			status: "draft",
		})
		.returning({ id: posts.id });

	const inserted = rows[0];
	if (!inserted) throw new Error("Failed to insert post");

	return {
		postId: inserted.id,
		status: "draft",
		content: contentToStore,
		platform,
		isThread,
	};
}

/**
 * Create a post from an approved thread (array of tweets).
 * Called after user approves the thread preview from createPost.
 */
export async function createThreadPost(params: {
	tweets: string[];
	platform: Platform;
	mediaFiles?: string[];
}): Promise<{ postId: string; status: "draft"; tweetCount: number }> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	const threadRows = await db
		.insert(posts)
		.values({
			userId: "default",
			platform: params.platform,
			content: JSON.stringify(params.tweets),
			mediaUrls: params.mediaFiles ?? null,
			status: "draft",
		})
		.returning({ id: posts.id });

	const inserted = threadRows[0];
	if (!inserted) throw new Error("Failed to insert thread post");

	return {
		postId: inserted.id,
		status: "draft",
		tweetCount: params.tweets.length,
	};
}

/**
 * Schedule a post for a specific date/time.
 * Triggers publishPost with a delay.
 */
export async function schedulePost(params: {
	postId: string;
	date: string;
	time: string;
	timezone?: string;
}): Promise<SchedulePostResult> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const timezone = params.timezone ?? "UTC";
	const utcDate = userTimeToUtc(params.date, params.time, timezone);

	const db = createHubConnection(hubEnv.data.databaseUrl);

	// Update post status and scheduled time
	await db
		.update(posts)
		.set({
			status: "scheduled",
			scheduledAt: utcDate,
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	// Trigger publishPost with delay
	const handle = await publishPost.trigger({ postId: params.postId }, { delay: utcDate });

	// Store triggerRunId
	await db
		.update(posts)
		.set({
			triggerRunId: handle.id,
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	const localTime = utcToUserTime(utcDate, timezone);

	return {
		postId: params.postId,
		scheduledAt: utcDate.toISOString(),
		scheduledAtLocal: localTime.full,
		triggerRunId: handle.id,
	};
}

/**
 * Post immediately without scheduling delay.
 */
export async function postNow(params: { postId: string }): Promise<PostNowResult> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	// Update post status
	await db
		.update(posts)
		.set({
			status: "scheduled",
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	// Trigger publishPost with NO delay (immediate)
	const handle = await publishPost.trigger({ postId: params.postId });

	// Store triggerRunId
	await db
		.update(posts)
		.set({
			triggerRunId: handle.id,
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	return {
		postId: params.postId,
		triggerRunId: handle.id,
		status: "publishing",
	};
}

/**
 * Cancel a scheduled post. Cancels the Trigger.dev run and resets to draft.
 */
export async function cancelPost(params: { postId: string }): Promise<CancelResult> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	const [post] = await db.select().from(posts).where(eq(posts.id, params.postId)).limit(1);

	if (!post) {
		throw new Error(`Post not found: ${params.postId}`);
	}

	// Cancel Trigger.dev run if exists
	if (post.triggerRunId) {
		try {
			await runs.cancel(post.triggerRunId);
		} catch (_error) {
			// Run may already be completed or cancelled — that's fine
		}
	}

	// Reset to draft
	await db
		.update(posts)
		.set({
			status: "draft",
			scheduledAt: null,
			triggerRunId: null,
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	return {
		postId: params.postId,
		status: "cancelled",
	};
}

/**
 * Edit a scheduled post. Cancels old run, updates content/time, creates new run.
 */
export async function editScheduledPost(params: {
	postId: string;
	content?: string;
	date?: string;
	time?: string;
	timezone?: string;
}): Promise<EditResult> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	const [post] = await db.select().from(posts).where(eq(posts.id, params.postId)).limit(1);

	if (!post) {
		throw new Error(`Post not found: ${params.postId}`);
	}

	// Cancel old Trigger.dev run
	if (post.triggerRunId) {
		try {
			await runs.cancel(post.triggerRunId);
		} catch (_error) {
			// Run may already be completed or cancelled
		}
	}

	// Update content if provided
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (params.content) {
		updates.content = params.content;
	}

	// Calculate new scheduled time
	let scheduledAt = post.scheduledAt;
	if (params.date && params.time) {
		const timezone = params.timezone ?? "UTC";
		scheduledAt = userTimeToUtc(params.date, params.time, timezone);
		updates.scheduledAt = scheduledAt;
	}

	await db.update(posts).set(updates).where(eq(posts.id, params.postId));

	// Create new delayed run
	const delay = scheduledAt ?? new Date();
	const handle = await publishPost.trigger({ postId: params.postId }, { delay });

	// Store new triggerRunId
	await db
		.update(posts)
		.set({
			triggerRunId: handle.id,
			status: "scheduled",
			updatedAt: new Date(),
		})
		.where(eq(posts.id, params.postId));

	return {
		postId: params.postId,
		status: "scheduled",
		triggerRunId: handle.id,
	};
}

/**
 * Get recent failed posts from the last 7 days.
 * Surfaced by /psn:post preamble.
 */
export async function getRecentFailures(): Promise<FailedPost[]> {
	const hubEnv = await loadHubEnv();
	if (!hubEnv.success) {
		throw new Error(hubEnv.error);
	}

	const db = createHubConnection(hubEnv.data.databaseUrl);

	const failedPosts = await db
		.select()
		.from(posts)
		.where(and(eq(posts.status, "failed"), sql`${posts.updatedAt} > NOW() - INTERVAL '7 days'`))
		.orderBy(desc(posts.updatedAt))
		.limit(10);

	return failedPosts.map((post) => {
		const metadata = post.metadata as Record<string, unknown> | null;
		return {
			postId: post.id,
			content: post.content.length > 100 ? `${post.content.slice(0, 100)}...` : post.content,
			failReason: post.failReason,
			failedAt: (metadata?.failedAt as string | null) ?? post.updatedAt.toISOString(),
			platform: post.platform,
		};
	});
}

// ─── CLI Entry Point ────────────────────────────────────────────────────────

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args[0];

	function getArg(name: string): string | undefined {
		const idx = args.indexOf(`--${name}`);
		if (idx === -1 || idx + 1 >= args.length) return undefined;
		return args[idx + 1];
	}

	async function main() {
		switch (command) {
			case "create": {
				const content = getArg("content");
				const platform = (getArg("platform") ?? "x") as Platform;
				const mediaFiles = getArg("media")?.split(",");

				if (!content) {
					console.log(JSON.stringify({ error: "Missing --content argument" }));
					process.exit(1);
				}

				const result = await createPost({ content, platform, mediaFiles });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "create-thread": {
				const tweetsJson = getArg("tweets");
				const platform = (getArg("platform") ?? "x") as Platform;
				const mediaFiles = getArg("media")?.split(",");

				if (!tweetsJson) {
					console.log(JSON.stringify({ error: "Missing --tweets argument (JSON array)" }));
					process.exit(1);
				}

				const tweets = JSON.parse(tweetsJson) as string[];
				const result = await createThreadPost({ tweets, platform, mediaFiles });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "schedule": {
				const postId = getArg("post-id");
				const date = getArg("date");
				const time = getArg("time");
				const timezone = getArg("timezone");

				if (!postId || !date || !time) {
					console.log(JSON.stringify({ error: "Missing --post-id, --date, or --time" }));
					process.exit(1);
				}

				const result = await schedulePost({ postId, date, time, timezone });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "now": {
				const postId = getArg("post-id");

				if (!postId) {
					console.log(JSON.stringify({ error: "Missing --post-id" }));
					process.exit(1);
				}

				const result = await postNow({ postId });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "cancel": {
				const postId = getArg("post-id");

				if (!postId) {
					console.log(JSON.stringify({ error: "Missing --post-id" }));
					process.exit(1);
				}

				const result = await cancelPost({ postId });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "edit": {
				const postId = getArg("post-id");
				const content = getArg("content");
				const date = getArg("date");
				const time = getArg("time");
				const timezone = getArg("timezone");

				if (!postId) {
					console.log(JSON.stringify({ error: "Missing --post-id" }));
					process.exit(1);
				}

				const result = await editScheduledPost({ postId, content, date, time, timezone });
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			case "failures": {
				const result = await getRecentFailures();
				console.log(JSON.stringify(result, null, 2));
				break;
			}

			default: {
				console.log(
					JSON.stringify({
						error: `Unknown command: ${command}`,
						usage: "create | create-thread | schedule | now | cancel | edit | failures",
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
