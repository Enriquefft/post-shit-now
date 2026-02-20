import type { RawTrend } from "../types.ts";

/**
 * Fetch trending posts from specified subreddits.
 * Requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars.
 */
export async function fetchRedditTrending(subreddits: string[], limit = 10): Promise<RawTrend[]> {
	const clientId = process.env.REDDIT_CLIENT_ID;
	const clientSecret = process.env.REDDIT_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return [];
	}

	// Get OAuth app-only token
	const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "post-shit-now/1.0",
		},
		body: "grant_type=client_credentials",
	});

	if (!tokenResponse.ok) {
		throw new Error(`Reddit auth failed: ${tokenResponse.status}`);
	}

	const tokenData = (await tokenResponse.json()) as { access_token: string };
	const accessToken = tokenData.access_token;

	const allTrends: RawTrend[] = [];

	for (const subreddit of subreddits) {
		const res = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot.json?limit=${limit}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "post-shit-now/1.0",
			},
		});

		if (!res.ok) continue;

		const data = (await res.json()) as {
			data: {
				children: Array<{
					data: {
						title: string;
						url: string;
						score: number;
						created_utc: number;
						link_flair_text?: string;
					};
				}>;
			};
		};

		for (const child of data.data.children) {
			const post = child.data;
			allTrends.push({
				title: post.title,
				url: post.url,
				source: "reddit",
				sourceScore: post.score,
				publishedAt: new Date(post.created_utc * 1000),
				tags: post.link_flair_text ? [post.link_flair_text] : undefined,
			});
		}
	}

	return allTrends;
}
