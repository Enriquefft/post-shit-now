# Requirements: Post Shit Now

**Defined:** 2026-02-18
**Core Value:** Make it so easy to create and post high-quality, voice-matched content that team members who rarely post start posting consistently.

## v2 Requirements

*This file has been reset for the next milestone. See `.planning/milestones/v1.0-REQUIREMENTS.md` for the complete v1.0 requirements record.*

### Placeholder for v2

Use `/gsd:new-milestone` to begin defining v2 requirements after completing the v1.0 milestone closure.

## v1.0 Archive

All 148 v1.0 requirements have been completed and archived to `.planning/milestones/v1.0-REQUIREMENTS.md`.

**Completion Date:** 2026-02-20
**Status:** ✅ MILESTONE COMPLETE

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / visual calendar | Competes on competitors' home turf (Buffer, Hootsuite). CLI-first by design. Always inferior to purpose-built web tools. |
| Social inbox / unified DM management | Different product category (customer support, not growth). API access heavily restricted. |
| Fully automated posting (no human review) | AI slop is actively suppressed by all platforms in 2026. One bad auto-post can damage a brand permanently. |
| Paid ad management / boosting | Entirely different domain requiring budget management, audience targeting, conversion tracking. |
| Social listening / brand monitoring at scale | Enterprise feature ($1000+/mo category). Narrow competitive intelligence (5-10 accounts) is sufficient. |
| Real-time collaboration / shared editing | Requires CRDT/OT engineering. Sequential approval workflow handles the use case. |
| Content library / asset management (DAM) | Scope creep into a different product. Git-based media + external tools suffice. |
| Platform-native preview rendering | Each platform's rendering changes constantly. Character counts + media specs are sufficient. |
| Engagement pods / reciprocal liking | Violates every platform's TOS. Accounts get shadowbanned. |
| Languages beyond English and Spanish | Two is enough for v1. Additional languages add complexity to every feature. |
| Offline/degraded mode | Managed services have 99.9%+ uptime. Local fallback/sync layer not worth the complexity. |
| Self-hosted Trigger.dev | Cloud-only for simplicity and features (warm starts, auto-scaling, checkpoints). |

---
*Last updated: 2026-02-20 (v1.0 milestone archived)*
