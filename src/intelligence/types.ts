// ─── Intelligence Types ──────────────────────────────────────────────────────

/** Raw trend data from a source adapter before scoring */
export interface RawTrend {
	title: string;
	url?: string;
	source: TrendSource;
	sourceScore?: number;
	publishedAt?: Date;
	tags?: string[];
}

/** Trend after pillar relevance scoring */
export interface ScoredTrend {
	id: string;
	title: string;
	url?: string;
	source: TrendSource;
	sourceScore: number;
	pillarRelevance: Record<string, number>;
	overallScore: number;
	suggestedAngles?: string[];
	detectedAt: Date;
	expiresAt?: Date;
}

/** Search result from an on-demand search provider */
export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	source: SearchProvider;
}

/** Available trend sources */
export type TrendSource = "hackernews" | "reddit" | "producthunt" | "google-trends" | "rss" | "x";

/** Available on-demand search providers */
export type SearchProvider = "perplexity" | "exa" | "tavily" | "brave";

/** Content pillar with weight for scoring */
export interface Pillar {
	name: string;
	weight: number;
}
