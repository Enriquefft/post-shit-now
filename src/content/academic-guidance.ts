// ─── Academic Hook Patterns ─────────────────────────────────────────────

export const ACADEMIC_HOOK_PATTERNS = {
	statistics: "Over 70% of students admit procrastination affects their writing quality",
	question: "What if we could reverse climate change within 10 years?",
	problemSolution: "Challenge: Researchers struggle with X. Solution: Our approach reduces time by 40%.",
	authority: "As Einstein once said, 'Education is the most powerful weapon for change.'",
} as const;

// ─── Tone Balance Guidance ───────────────────────────────────────────────

export const TONE_BALANCE_GUIDANCE = {
	academicPeers: {
		description: "Use technical terminology appropriate for field experts",
		formality: "high (8-9/10)",
		citationStyle: "full (author, year, journal)",
	},
	generalPublic: {
		description: "Translate jargon, focus on implications, use analogies",
		formality: "medium (5-7/10)",
		citationStyle: "minimal (link or DOI only)",
	},
	mixedAudience: {
		description: "Lead with implications, include technical details, provide context",
		formality: "medium-high (6-8/10)",
		citationStyle: "moderate (title + link)",
	},
} as const;

// ─── Citation Patterns ───────────────────────────────────────────────────

export const CITATION_PATTERNS = {
	doi: "doi:10.1234/example.doi",
	arxiv: "arXiv:1234.56789",
	titleAuthor: "Paper Title by Author et al. (Journal, 2024)",
	linkOnly: "Read the paper: https://example.com/paper-url",
} as const;
