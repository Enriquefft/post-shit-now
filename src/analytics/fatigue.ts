// ─── Types ──────────────────────────────────────────────────────────────────

export interface FatigueResult {
	topic: string;
	status: "fatigued";
	lastScores: number[];
	suggestion: string;
}

export interface FatiguedTopic {
	topic: string;
	cooldownUntil: string;
	lastScores: number[];
}

export interface FatigueInput {
	topic: string;
	score: number;
	publishedAt: Date;
}

// ─── Fatigue Detection ──────────────────────────────────────────────────────

/**
 * Detect topics with declining engagement trends.
 *
 * Groups posts by topic, checks the last 3 posts (sorted by publishedAt ascending).
 * If each score is strictly lower than the previous, the topic is flagged as fatigued.
 *
 * Per CONTEXT.md: "if last 3 posts on a topic each scored lower than previous, flag as fatigued"
 */
export function detectTopicFatigue(posts: FatigueInput[]): FatigueResult[] {
	if (posts.length === 0) return [];

	// Group posts by topic
	const byTopic = new Map<string, FatigueInput[]>();
	for (const post of posts) {
		const existing = byTopic.get(post.topic) ?? [];
		existing.push(post);
		byTopic.set(post.topic, existing);
	}

	const results: FatigueResult[] = [];

	for (const [topic, topicPosts] of byTopic) {
		// Need at least 3 posts to detect a trend
		if (topicPosts.length < 3) continue;

		// Sort by publishedAt ascending (oldest first)
		const sorted = [...topicPosts].sort(
			(a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
		);

		// Check last 3 posts for strictly declining scores
		const last3 = sorted.slice(-3);
		const scores = last3.map((p) => p.score);

		const isDeclined =
			scores.length === 3 &&
			scores[0] !== undefined &&
			scores[1] !== undefined &&
			scores[2] !== undefined &&
			scores[0] > scores[1] &&
			scores[1] > scores[2];

		if (isDeclined) {
			results.push({
				topic,
				status: "fatigued",
				lastScores: scores,
				suggestion: `Topic "${topic}" has been cooling -- consider rotating to a different content pillar`,
			});
		}
	}

	return results;
}

// ─── Fatigue Status Check ───────────────────────────────────────────────────

/**
 * Check if a topic is currently fatigued (in cooldown).
 *
 * Used by content brain to warn during /psn:post when user is about to post on a fatigued topic.
 * Returns true only if the topic is in the fatigued list AND cooldownUntil is in the future.
 */
export function isTopicFatigued(
	topic: string,
	fatiguedTopics: Array<{ topic: string; cooldownUntil: string }>,
): boolean {
	const entry = fatiguedTopics.find((ft) => ft.topic === topic);
	if (!entry) return false;

	return new Date(entry.cooldownUntil) > new Date();
}

// ─── Cooldown Management ────────────────────────────────────────────────────

/**
 * Merge new fatigue detections into the existing fatigued topics list.
 *
 * - New detections get cooldownUntil = now + cooldownDays
 * - Existing entries that match new detections get their cooldown extended
 * - Expired cooldowns are removed
 * - Returns updated list for writing to preferenceModel.fatiguedTopics
 */
export function updateFatiguedTopics(
	currentFatigued: FatiguedTopic[],
	newDetections: FatigueResult[],
	cooldownDays = 14,
): FatiguedTopic[] {
	const now = new Date();
	const cooldownUntil = new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
	const cooldownStr = cooldownUntil.toISOString();

	// Build map from existing (non-expired)
	const topicMap = new Map<string, FatiguedTopic>();

	for (const entry of currentFatigued) {
		// Keep only non-expired entries
		if (new Date(entry.cooldownUntil) > now) {
			topicMap.set(entry.topic, entry);
		}
	}

	// Merge new detections
	for (const detection of newDetections) {
		topicMap.set(detection.topic, {
			topic: detection.topic,
			cooldownUntil: cooldownStr,
			lastScores: detection.lastScores,
		});
	}

	return [...topicMap.values()];
}
