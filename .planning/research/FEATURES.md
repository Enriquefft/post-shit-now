# Feature Research

**Domain:** CLI-first social media automation and growth system
**Researched:** 2026-02-18
**Confidence:** HIGH

## Context: CLI-First Changes the Feature Calculus

Traditional social media tools (Buffer, Hootsuite, Sprout Social, Planable) are web dashboards. Their "table stakes" assume a visual UI: drag-and-drop calendars, inline preview, real-time notifications panels. PSN has no UI. This fundamentally shifts what's table stakes vs differentiating.

What web tools do well (visual calendar, WYSIWYG preview, team inbox) PSN cannot compete on. What web tools do poorly (deep AI voice matching, adaptive learning, developer workflow integration, infrastructure-as-code content strategy) is where PSN wins. The feature set must lean hard into strengths the CLI unlocks rather than trying to recreate dashboard features in text.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken for its target audience (developers who want to grow on social media).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-platform posting** (X, LinkedIn, Instagram, TikTok) | Every competitor supports 5+ platforms. Single-platform = toy. | HIGH | Each platform has unique auth, media handling, rate limits. X is easiest (pay-per-use API). LinkedIn needs partner approval. TikTok needs audit. Roll out incrementally: X first. |
| **Scheduling with optimal timing** | Buffer, Hootsuite, Later all do this. Unscheduled posting = manual labor. | MEDIUM | Trigger.dev delayed runs. AI-suggested times based on audience data. Platform-specific windows (X: speed matters, LinkedIn: business hours, TikTok: 2-5 PM). |
| **Content generation in your voice** | Jasper, Copy.ai, Buffer AI Assistant all generate content. But generic AI content gets suppressed by algorithms. Must sound like the user. | HIGH | Voice profiling via interview + content import + calibration. The 20% edit rate target is the real metric. This is table stakes because without it, users just use ChatGPT directly. |
| **Analytics and performance tracking** | Every tool reports engagement. Without data, users can't improve. | MEDIUM | Composite engagement score (saves > shares > comments > likes). Per-platform, per-post. Weekly cadence via `/psn:review`. Key 2026 shift: saves and shares matter more than likes. |
| **Content calendar / queue view** | Users need to see what's coming. Blind scheduling is anxiety-inducing. | LOW | Text-based calendar in `/psn:calendar` and inline in `/psn:plan`. Not visual drag-and-drop -- that's a web tool feature. Structured text output is fine for CLI users. |
| **Draft management** | Content creation is iterative. Users need to save, edit, come back. | LOW | Git-based drafts in `content/drafts/`. Auto-pruned 14 days after publishing. Natural for developer workflow. |
| **Multi-platform content adaptation** | A LinkedIn post is not an X thread is not an Instagram reel. Users expect platform-specific formatting. | MEDIUM | Content brain picks format per platform. Thread structure for X, carousel for LinkedIn, reel script for Instagram/TikTok. Same idea, different expression. |
| **Image generation** | Visual content dominates all platforms. LinkedIn carousels get 11.2x impressions vs text. Instagram is visual-first. | MEDIUM | GPT Image (versatile), Ideogram 3 (text in images), Flux 2 (photorealistic). BYOK model. |
| **OAuth token management** | LinkedIn tokens expire every 60 days. Instagram requires FB Page link. Broken auth = silent failures. | MEDIUM | Automatic refresh via Trigger.dev `token-refresher` task. Alert when manual intervention needed. |
| **Quick capture / idea saving** | Ideas strike randomly. If saving an idea takes >30 seconds, users won't do it. | LOW | `/psn:capture` -- paste URL, screenshot, or thought. Routed to idea bank. Under 30 seconds for saves. |

### Differentiators (Competitive Advantage)

Features that set PSN apart from Buffer/Hootsuite/Sprout Social. These justify the CLI-first approach.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deep voice profiling with learning loop** | No competitor does RLHF-style voice learning. Jasper has "brand voice" but it's static -- upload guidelines, done. PSN tracks every edit, correlates with engagement, and evolves. The 3-channel feedback (engagement signals, edit signals, explicit feedback) is genuinely novel. | HIGH | This is the core differentiator. If the voice model is mediocre, the product is just a worse Buffer. Investment here pays for everything else. |
| **Autonomous learning with transparent changelog** | The brain auto-adjusts pillar weights, posting times, format preferences, topic fatigue -- and tells you what it changed. No competitor does autonomous tactical optimization. They all require manual strategy adjustments. | HIGH | Requires sufficient analytics data to be meaningful. Cold start problem: first 2-4 weeks of data collection before autonomy kicks in. Rate-limited adjustments prevent wild swings. |
| **Three posting personas** (personal, brand operator, brand ambassador) | Employee advocacy tools exist (Sprout Social charges $249/seat for this). PSN gives individuals the ambassador model for free -- your voice + company context. The persona system changes everything downstream: idea generation, voice, approval flow. | MEDIUM | Brand ambassador is the unique one. Personal and brand operator are standard. The cross-Hub read (personal model + company model) for ambassador posts is architecturally complex but high-value. |
| **Idea bank with maturity pipeline** | No competitor has a structured idea pipeline (spark > seed > ready > claimed > developed > used). Most have a "content library" which is just a folder. The maturity model means ideas are always progressing, never rotting. | MEDIUM | Six stages may be overengineered for solo users. But for teams, claiming/locking prevents duplicate work. Timely vs evergreen urgency classification is valuable. |
| **Content series system** | Recurring formats with identity, tracking, auto-slotting into weekly plans. Competitors offer "recurring posts" (same content repeated). PSN series are creative frameworks that generate fresh installments. | MEDIUM | Series reduce ideation friction massively. Monday Myths, Friday Failures -- the format is fixed, you just need fresh content. Pattern detection ("you've posted 5 similar threads -- formalize as a series?") is clever. |
| **Semi-automated engagement engine** | Strategic replies to viral posts with AI-drafted responses. No SaaS tool offers this -- they all focus on publishing, not replying. Engagement data shows replies within 15 min on X get 300% more impressions. | HIGH | Platform TOS risk if automation is too aggressive. Must be human-in-the-loop. WhatsApp alerts with draft replies + structured commands (R1/R2/R3) is the right UX. Daily caps essential. |
| **Intelligence layer (trend collection + on-demand research)** | Background trend monitoring (HN, Reddit, PH, Google Trends, RSS) + real-time search (Perplexity, Exa, Tavily). No competitor does intelligence gathering -- they just schedule what you write. PSN tells you WHAT to write about. | HIGH | Cost tiers ($0/free to $175/full) let users scale. The manual capture path for walled gardens (LinkedIn, TikTok) is pragmatic. Competitive intelligence tracking adds strategic depth. |
| **Content remixing and recycling** | One idea becomes 5-10 pieces across platforms. High-performing past content resurfaced with fresh angles. This is how prolific creators operate -- "content atoms" not "posts." Competitors don't think in atoms. | MEDIUM | Requires a good published archive + engagement data. Recycling needs content fatigue tracking to avoid reposting too soon. Re-angle suggestions ("LinkedIn carousel that crushed -> X thread version") are high-value. |
| **Bilingual content (English + Spanish)** | Not translation -- independently crafted content per language with language-specific voice sections. No competitor handles bilingual content creation where the voice differs by language. | MEDIUM | Niche but powerful for the target market. Language-specific voice profiles, per-language performance tracking, per-language preference models. Adds complexity to every feature. |
| **CLI-native developer workflow** | Git-based content management, YAML config, slash commands, BYOK. The entire system is infrastructure-as-code for social media. Version-controlled strategy, auditable changes, zero vendor lock-in. | LOW | This IS the product. Not a feature to build, but a constraint that shapes everything. Developers who live in the terminal get a workflow that fits their muscle memory. |
| **WhatsApp interactive notifications** | Not just alerts -- structured commands to approve, post, skip from WhatsApp. "Saw the alert but forgot to open Claude Code" problem solved. | MEDIUM | WAHA self-hosted is free but requires Docker. Twilio fallback for users who prefer managed services. The conversation state machine (`whatsapp_sessions` table) adds complexity. |
| **Company coordination without shared repos** | Invite codes, RLS-isolated data, approval workflows, calendar conflict detection. Each team member has their own workspace -- company data stays in the Company Hub. Leaving = delete one file. | HIGH | This is PSN's answer to Sprout Social's $249/seat team features. The architecture (Personal Hub + Company Hubs) is complex but the UX is simple. |

### Anti-Features (Deliberately NOT Building)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Web dashboard / visual calendar** | "I want to see my schedule visually" | Massive development effort. Competes on competitors' home turf. Maintenance burden for a feature that will always be worse than Planable/Buffer. Violates CLI-first philosophy. | Text-based calendar output in `/psn:calendar`. Structured, scannable, sortable. If users need a visual calendar, they're not the target audience. |
| **Social inbox / unified DM management** | "I want to respond to all DMs in one place" | DM management is a different product (customer support, not growth). Hootsuite/Sprout Social own this space with $200+/seat. API access for DMs is heavily restricted on most platforms. | Focus on public engagement (replies to trending content). DMs are relationship management -- do those natively on each platform. |
| **Social listening / brand monitoring** | "I want to track mentions of my brand" | Full social listening is an enterprise feature (Brandwatch, Sprinklr, $1000+/mo). Building this means scraping APIs at scale, managing massive data volumes, NLP processing. | Narrow competitive intelligence: track 5-10 specific accounts, not the entire internet. Manual capture via `/psn:capture` for anything the user spots. |
| **Fully automated posting (no human review)** | "Just post it, I trust the AI" | AI slop is actively suppressed by all platforms in 2026. Automated content without human review produces detectable patterns. One bad auto-post can damage a brand permanently. | Human-in-the-loop always. The system generates, the user approves. Semi-automation for engagement replies with structured approval via WhatsApp. |
| **Paid ad management** | "I want to boost posts and manage ad campaigns" | Different domain entirely. Ad optimization requires budget management, audience targeting, A/B testing, conversion tracking. Hootsuite does this and it's their weakest feature. | Organic-only growth. If a post crushes organically, tell the user "boost this one" -- but the actual ad buying happens natively on the platform. |
| **Real-time collaboration / shared editing** | "Multiple people editing the same post simultaneously" | Requires operational transform or CRDT, WebSocket connections, conflict resolution. Google Docs-level engineering for a rare use case. | Sequential workflow: author creates -> reviewer approves/rejects with feedback -> author revises. The approval workflow via `/psn:approve` handles this cleanly. |
| **Content library / asset management** | "I want a searchable library of all my images, templates, brand assets" | Turns into a DAM (Digital Asset Management) system. Scope creep into a different product category. | Git-based media in `content/media/`. Auto-pruned. For persistent brand assets, use an external tool (Google Drive, Figma, etc.) and reference URLs. |
| **Platform-native preview rendering** | "Show me exactly how my post will look on LinkedIn/Instagram" | Each platform's rendering changes constantly. Maintaining pixel-perfect previews is a maintenance nightmare. | Platform-appropriate text formatting + character counts + media specs. The user can spot-check on the platform itself before publishing. |
| **Engagement pod / reciprocal liking groups** | "Auto-engage with my network's posts so they engage with mine" | Violates every platform's TOS. Accounts get flagged and shadowbanned. Artificial engagement teaches the algorithm wrong signals. | Genuine engagement via `/psn:engage` -- find relevant trending content and reply with real value. |

---

## Feature Dependencies

```
[OAuth + Platform Auth]
    |
    +--requires--> [Posting (single platform)]
    |                  |
    |                  +--requires--> [Multi-platform posting]
    |                  |                  |
    |                  |                  +--enhances--> [Content remixing across platforms]
    |                  |
    |                  +--requires--> [Scheduling (Trigger.dev delayed runs)]
    |                  |                  |
    |                  |                  +--enhances--> [Optimal timing AI]
    |                  |
    |                  +--requires--> [Content generation]
    |                                     |
    |                                     +--requires--> [Voice profiling]
    |                                     |                  |
    |                                     |                  +--enhances--> [Learning loop (edit signals)]
    |                                     |
    |                                     +--enhances--> [Image generation]
    |                                     |
    |                                     +--enhances--> [Bilingual content]
    |
    +--requires--> [Analytics collection]
                       |
                       +--requires--> [Performance tracking / review]
                       |                  |
                       |                  +--enhances--> [Preference model updates]
                       |                  |                  |
                       |                  |                  +--enhances--> [Autonomous learning loop]
                       |                  |
                       |                  +--enhances--> [Content fatigue tracking]
                       |
                       +--enhances--> [Engagement scoring]

[Database (Neon + Drizzle)]
    |
    +--requires--> [Idea bank]
    |                  |
    |                  +--enhances--> [Maturity pipeline]
    |                  |
    |                  +--enhances--> [Content series]
    |                  |
    |                  +--enhances--> [Weekly planning (/psn:plan)]
    |
    +--requires--> [Content queue (posts table)]
    |                  |
    |                  +--requires--> [Calendar view]
    |                  |
    |                  +--requires--> [Approval workflow]
    |
    +--requires--> [Preference model storage]

[Trigger.dev Cloud]
    |
    +--requires--> [Post scheduler task]
    +--requires--> [Analytics collector task]
    +--requires--> [Token refresher task]
    +--requires--> [Trend collector task]
    |                  |
    |                  +--enhances--> [Intelligence layer]
    |                                     |
    |                                     +--enhances--> [On-demand research (/psn:plan)]
    |
    +--requires--> [Engagement monitor task]
    |                  |
    |                  +--requires--> [WhatsApp notifications]
    |                                     |
    |                                     +--enhances--> [Structured WhatsApp commands]
    |
    +--requires--> [Notifier task]

[Company Hub (separate)]
    |
    +--requires--> [Team member registry + invite codes]
    +--requires--> [RLS policies]
    +--requires--> [Approval workflow]
    +--enhances--> [Shared brand preference model]
    +--enhances--> [Company idea bank]
    +--enhances--> [Company series]
```

### Dependency Notes

- **Content generation requires voice profiling:** Without a voice profile, generated content is generic AI slop. Voice profiling must be in the onboarding critical path.
- **Learning loop requires analytics + sufficient post history:** The autonomous learning loop is meaningless without 2-4 weeks of engagement data. It must degrade gracefully during cold start.
- **Company features require Personal Hub first:** The architecture mandates Personal Hub exists before connecting to any Company Hub. Company features are always layered on top.
- **Engagement engine requires WhatsApp notifications:** Time-sensitive engagement opportunities (15-min window on X) need push alerts. Without WhatsApp, the engagement engine is degraded to pull-only via `/psn:engage`.
- **Content remixing requires published archive:** You can't remix content that doesn't exist yet. This feature naturally activates after weeks of posting.
- **Intelligence layer enhances but doesn't block posting:** Users can post without trend data. Intelligence makes ideation better but isn't a hard dependency.

---

## MVP Definition

### Launch With (v1) -- Single User, Single Platform (X)

Minimum viable product to validate that CLI-first social media actually works.

- [ ] **`/psn:setup`** (X only) -- OAuth, API keys, Personal Hub creation (Neon + Trigger.dev)
- [ ] **Voice profiling** -- Interview + content import + calibration. The make-or-break feature.
- [ ] **`/psn:post`** -- Generate content in voice, review, schedule on X. Single platform, personal persona only.
- [ ] **`/psn:capture`** -- Quick idea capture to idea bank (spark stage only, no maturity pipeline yet)
- [ ] **`/psn:review`** -- Basic analytics: engagement per post, what worked, what didn't. Manual preference model updates.
- [ ] **`/psn:calendar`** -- View upcoming scheduled posts
- [ ] **Post scheduler task** -- Trigger.dev delayed run that posts at scheduled time
- [ ] **Analytics collector task** -- Cron job pulling X metrics
- [ ] **Token refresher task** -- Keep OAuth tokens alive
- [ ] **Draft management** -- Git-based drafts with basic lifecycle
- [ ] **Image generation** -- At least one provider (GPT Image) for visual content

### Add After Validation (v1.x)

Features to add once the core loop (voice -> generate -> post -> learn) is proven.

- [ ] **Learning loop (3-channel feedback)** -- Edit signal tracking, engagement signal weighting, explicit feedback prompts. Trigger: edit rate data from first 10-15 posts.
- [ ] **`/psn:plan`** -- Weekly batch ideation + generation + scheduling. Trigger: users asking "what should I post this week?"
- [ ] **Idea bank maturity pipeline** -- Full spark > seed > ready > claimed > developed > used flow. Trigger: idea bank accumulates 20+ items.
- [ ] **Content series** -- Recurring format support with auto-slotting. Trigger: users creating similar posts repeatedly.
- [ ] **LinkedIn platform support** -- Second platform. Trigger: partner API approval received.
- [ ] **Content archetypes + pillar balancing** -- Automatic variety management. Trigger: learning loop has enough data to recommend balance.
- [ ] **Intelligence layer (Layer 1)** -- Trend collector (HN, Reddit, PH, RSS). Trigger: users wanting ideation help beyond their own ideas.
- [ ] **Bilingual support (English + Spanish)** -- Language-specific voice sections, per-post language choice. Trigger: user demand from Spanish-speaking users.

### Future Consideration (v2+)

Features to defer until product-market fit and multi-platform are established.

- [ ] **Company Hub + team features** -- Approval workflow, invite codes, shared brand model, calendar coordination. Defer because: team features multiply complexity by 3x and the core product must work for individuals first.
- [ ] **Instagram + TikTok support** -- Defer because: Instagram API rate limits are brutal (200 req/hr), TikTok requires audit. Both need media-heavy workflows (carousels, reels, video).
- [ ] **Engagement engine** -- Semi-automated replies, WhatsApp alerts, structured commands. Defer because: requires stable notification infrastructure + engagement monitoring tasks + voice profile maturity.
- [ ] **WhatsApp interactive notifications** -- Full structured command system. Defer because: requires WAHA/Twilio setup, conversation state machine, webhook handling.
- [ ] **Content remixing + recycling** -- Cross-platform content atoms, recycling past hits. Defer because: needs a published archive with engagement data (months of history).
- [ ] **Autonomous learning loop** -- Fully autonomous tactical adjustments with changelog. Defer because: requires months of preference model data and proven learning loop accuracy.
- [ ] **Brand ambassador persona** -- Cross-Hub reads (personal + company models). Defer because: depends on both Personal Hub and Company Hub being mature.
- [ ] **On-demand research (Layer 2)** -- Perplexity, Exa, Tavily integration during `/psn:plan`. Defer because: adds API cost complexity and the free intelligence layer (Layer 1) should be validated first.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Voice profiling + generation | HIGH | HIGH | P1 |
| X platform posting + scheduling | HIGH | MEDIUM | P1 |
| Basic analytics + review | HIGH | MEDIUM | P1 |
| Quick capture / idea bank | MEDIUM | LOW | P1 |
| Calendar view | MEDIUM | LOW | P1 |
| Image generation | MEDIUM | MEDIUM | P1 |
| Learning loop (3-channel) | HIGH | HIGH | P2 |
| Weekly planning (`/psn:plan`) | HIGH | MEDIUM | P2 |
| Idea maturity pipeline | MEDIUM | MEDIUM | P2 |
| Content series | MEDIUM | MEDIUM | P2 |
| LinkedIn support | HIGH | MEDIUM | P2 |
| Intelligence layer (Layer 1) | MEDIUM | MEDIUM | P2 |
| Bilingual (en/es) | MEDIUM | MEDIUM | P2 |
| Content archetypes + balancing | MEDIUM | LOW | P2 |
| Company Hub + team features | HIGH | HIGH | P3 |
| Instagram + TikTok | MEDIUM | HIGH | P3 |
| Engagement engine | HIGH | HIGH | P3 |
| WhatsApp notifications | MEDIUM | HIGH | P3 |
| Content remixing/recycling | MEDIUM | MEDIUM | P3 |
| Autonomous learning | HIGH | HIGH | P3 |
| On-demand research (Layer 2) | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch (single user, X only, core voice loop)
- P2: Should have, add when core loop is validated (multi-platform, intelligence, learning)
- P3: Nice to have, future consideration (team, engagement, full autonomy)

---

## Competitor Feature Analysis

| Feature | Buffer ($6-120/mo) | Hootsuite ($99-739/mo) | Sprout Social ($199-399/seat) | PSN (BYOK, ~$0-30/mo) |
|---------|-------|----------|--------------|-----|
| Multi-platform posting | 8+ platforms | 10+ platforms | 10+ platforms | 4 platforms (X, LI, IG, TT) |
| AI content generation | Basic AI assistant | AI writer + Canva | AI Assist (GPT-based) | Deep voice profiling + learning loop |
| Voice/brand consistency | Brand voice (static upload) | Templates | Brand guidelines + static voice | Evolving 3-channel RLHF voice model |
| Analytics | Basic engagement | Advanced + social listening | Premium reports + competitive | Composite scoring + autonomous optimization |
| Team collaboration | Drafts + approvals | Multi-user + approval chains | Full CRM + task management | Invite codes + RLS + approval workflow |
| Employee advocacy | None | None | $249/seat add-on | Built into persona system (free) |
| Content calendar | Visual drag-and-drop | Visual + bulk upload | Visual + campaign view | Text-based structured output |
| Engagement / replies | Reply from inbox | Social inbox | Unified inbox + CRM | Semi-automated strategic reply engine |
| Content ideation | AI suggestions | Holiday calendar | Trend reports | Intelligence layer (HN, Reddit, Perplexity, etc.) |
| Scheduling optimization | Best time to post | Auto-schedule | ViralPost optimal timing | AI timing + autonomous adjustment |
| Developer experience | API available | API available | API available | CLI-native, git-based, YAML config |
| Bilingual support | Manual per platform | Manual per platform | Manual per platform | First-class bilingual with per-language voice |
| Learning over time | None | None | Minimal | Core product feature |
| Pricing model | Per channel, per month | Per user, per month | Per seat, per month | BYOK -- user controls all costs |

### Key Competitive Insights

1. **No competitor does learning.** They all generate content, but none track edits, correlate with engagement, and evolve their generation model. This is PSN's deepest moat.

2. **Employee advocacy is a $249/seat upsell at Sprout Social.** PSN's persona system (personal + brand operator + brand ambassador) delivers this for free. For a 30-person team, that's $7,470/mo saved.

3. **All competitors are visual-first dashboards.** PSN can never win at visual calendar UX. It must win at generation quality, learning speed, and workflow efficiency.

4. **Content ideation is weak everywhere.** Buffer suggests AI ideas. Hootsuite has a holiday calendar. Nobody does systematic intelligence gathering (HN, Reddit, PH, RSS, Perplexity, Exa) and maturity pipelines.

5. **No competitor handles bilingual content as first-class.** They all treat it as "post twice in different languages." PSN's language-specific voice profiles and independent crafting (not translation) is genuinely differentiated.

6. **Pricing is PSN's stealth advantage.** At scale, Sprout Social for a 10-person team costs $2,000-4,000/mo. PSN costs each user ~$30/mo for Trigger.dev + their own API usage. The BYOK model means costs scale linearly with actual usage, not seats.

---

## Sources

- [Buffer resources: Best social media management tools 2026](https://buffer.com/resources/best-social-media-management-tools/)
- [Backlinko: Best social media management tools 2026](https://backlinko.com/best-social-media-management-tools)
- [Sprout Social: Social media metrics to track 2026](https://sproutsocial.com/insights/social-media-metrics/)
- [Hootsuite: 21 social media metrics 2026](https://blog.hootsuite.com/social-media-metrics/)
- [Sprout Social: Employee advocacy features](https://sproutsocial.com/features/employee-advocacy/)
- [Planable: Social media calendar and approval workflows](https://planable.io/)
- [Social Insider: Social media benchmarks 2026](https://www.socialinsider.io/social-media-benchmarks)
- [Hootsuite: Engagement rate benchmarks 2026](https://blog.hootsuite.com/calculate-engagement-rate/)
- [Sprout Social: AI social media tools 2026](https://sproutsocial.com/insights/social-media-ai-tools/)
- [Sintra.ai: Best AI social media schedulers 2026](https://sintra.ai/blog/best-ai-social-media-scheduler)

---
*Feature research for: CLI-first social media automation and growth system*
*Researched: 2026-02-18*
