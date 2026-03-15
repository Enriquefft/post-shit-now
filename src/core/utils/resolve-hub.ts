// ─── Hub Routing ────────────────────────────────────────────────────────────

/**
 * Determine which hub a post routes to based on persona.
 *
 * - personal / brand-ambassador -> "personal" (Personal Hub)
 * - brand-operator -> "company" (Company Hub, Phase 7)
 */
export function resolveHub(persona: string): "personal" | "company" {
	if (persona === "brand-operator") return "company";
	return "personal";
}
