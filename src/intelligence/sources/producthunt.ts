import { z } from "zod/v4";
import type { RawTrend } from "../types.ts";

/**
 * Fetch today's featured products from Product Hunt.
 * Requires PRODUCTHUNT_TOKEN env var.
 */
export async function fetchProductHuntFeatured(limit = 10): Promise<RawTrend[]> {
	const token = process.env.PRODUCTHUNT_TOKEN;

	if (!token) {
		return [];
	}

	const query = `
		query ($limit: Int!) {
			posts(first: $limit, order: RANKING) {
				edges {
					node {
						id
						name
						tagline
						url
						votesCount
						createdAt
						topics {
							edges {
								node {
									name
								}
							}
						}
					}
				}
			}
		}
	`;

	const response = await fetch("https://api.producthunt.com/v2/api/graphql", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ query, variables: { limit } }),
	});

	if (!response.ok) {
		throw new Error(`Product Hunt API failed: ${response.status}`);
	}

	const phResponseSchema = z.object({
		data: z.object({
			posts: z.object({
				edges: z.array(
					z.object({
						node: z.object({
							id: z.string(),
							name: z.string(),
							tagline: z.string(),
							url: z.string(),
							votesCount: z.number(),
							createdAt: z.string(),
							topics: z.object({
								edges: z.array(
									z.object({
										node: z.object({ name: z.string() }),
									}),
								),
							}),
						}),
					}),
				),
			}),
		}),
	});
	const json = phResponseSchema.parse(await response.json());

	return json.data.posts.edges.map((edge) => {
		const node = edge.node;
		const topics = node.topics.edges.map((t) => t.node.name);
		return {
			title: `${node.name}: ${node.tagline}`,
			url: node.url,
			source: "producthunt" as const,
			sourceScore: node.votesCount,
			publishedAt: new Date(node.createdAt),
			tags: topics.length > 0 ? topics : undefined,
		};
	});
}
