# Feature Landscape

**Domain:** CLI-first social media management and growth automation
**Researched:** 2026-02-18
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features users expect from any social media management tool. Missing these means the product feels incomplete, regardless of how innovative the differentiators are.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-platform posting | Every competitor (Buffer, Hootsuite, Later, SocialPilot) supports 8-30+ platforms. Users won't adopt a tool that posts to only one. | High | PSN targets 4 platforms (X, LinkedIn, Instagram, TikTok). Each has distinct API flows, media requirements, and auth. This is the right scope -- these are the growth platforms. Pinterest/YouTube/Facebook can wait. |
| Post scheduling | No platform offers native scheduling. Every SMM tool provides it. Users plan ahead; real-time-only posting is a dealbreaker. | Medium | Trigger.dev delayed runs handle this. The mechanism is proven. |
| Content calendar / queue view | Users need to see what's coming. Buffer, Later, Hootsuite all center on a visual calendar. Without it, scheduling is a black box. | Medium | `/psn:calendar` command. In CLI, this is a formatted list with dates, not a drag-and-drop calendar. Acceptable tradeoff for the target audience. |
| Analytics and performance tracking | Every tool from free Buffer to enterprise Sprout Social includes cross-platform analytics. "Did my post work?" is a fundamental question. | Medium | `analytics-collector` cron + `/psn:review`. The data is table stakes; the AI-powered interpretation layered on top is the differentiator. |
| AI-assisted content generation | As of 2026, AI caption/post generation is table stakes. Buffer, SocialBee, Hootsuite, and even Later offer AI writing. Users expect it. | Medium | This is PSN's core interaction model. Every post goes through Claude. The voice-matching depth is the differentiator (see below). |
| Image/media support | Social media is visual. Text-only tools are incomplete. Instagram and TikTok are media-first platforms. | High | Multi-step upload flows on every platform. GPT Image, Ideogram 3, Flux 2 for generation. Media handling is complex but non-negotiable. |
| Multi-account support | Hootsuite, Sprout Social, SocialPilot all support managing multiple brands/accounts. Individuals often have personal + company accounts. | Medium | Two-Hub architecture (Personal + Company) handles this elegantly. Connection files per company. |
| OAuth/token management | All platform APIs require OAuth. Tokens expire (LinkedIn 60 days, Instagram similar). If tokens break silently, users lose trust. | Medium | `token-refresher` Trigger.dev task. Must be rock-solid and surface clear errors when refresh fails. |
| Content drafts / editing workflow | Every tool allows saving drafts, editing before publish. Users never want one-click publish without review. | Low | Drafts in local git (`content/drafts/`). Natural fit for CLI workflow. |
| Setup/onboarding flow | Users need to go from zero to posting. API keys, platform auth, basic configuration. If this takes more than 30 minutes, abandonment spikes. | High | `/psn:setup`. This is the highest-risk table stakes feature. BYOK complexity (users sourcing their own API keys) raises the bar significantly vs. competitors where auth is built in. |

## Differentiators

Features that set PSN apart from Buffer/Hootsuite/Later/SocialPilot. Not expected, but once experienced, hard to live without. These are the reasons someone chooses PSN over established competitors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deep voice profiling** | Competitors offer "professional/casual" toggles or basic brand voice. PSN builds a 100+ dimension voice model from interviews, content import, and continuous calibration. The difference between "AI slop" and "sounds like me." | High | 3 persona types (personal, brand-operator, brand-ambassador). Language-specific voice sections. This is the moat. If voice quality is mediocre, PSN has no reason to exist. |
| **RLHF-style learning loop** | No competitor tracks edit patterns as implicit feedback, computes weighted engagement scores, or builds an evolving preference model. Most tools are stateless -- every post starts from zero. PSN gets smarter with every post. | High | Three feedback channels: engagement signals, edit tracking, explicit feedback. The preference model is the compound advantage -- it improves over time while competitors stay flat. |
| **Idea bank with maturity pipeline** | Competitors offer basic content libraries or AI-generated idea lists. PSN's spark-to-used pipeline with urgency classification, team claiming, and cross-hub promotion is a genuine content workflow, not a feature checkbox. | Medium | 7 stages (spark/seed/ready/claimed/developed/used/killed). Timely ideas auto-expire. Killed ideas feed negative signals to the preference model. |
| **Intelligence layer (Research Brain)** | Most tools monitor your own analytics. PSN monitors the entire landscape: HN, Reddit, Product Hunt, RSS, Google Trends, competitor accounts, plus on-demand search via Perplexity/Exa/Tavily. Ideas come from intelligence, not a blank page. | High | Three layers: scheduled collection (passive), on-demand research (active), manual capture (locked-down platforms). Cost tiers from $0 to $175/mo. |
| **Content remixing / atoms** | Buffer lets you customize per platform. PSN thinks in "content atoms" -- one core idea becomes 5-10 platform-specific pieces across different formats, personas, and languages. This is how prolific creators actually work. | Medium | Depends on voice profiling being solid. Cross-platform adaptation is only valuable if each version feels native, not like a resize. |
| **Strategic engagement engine** | No scheduling tool helps you reply to other people's posts strategically. PSN's `/psn:engage` finds viral posts in your niche and generates voice-matched replies for growth. This is how most Twitter/LinkedIn growth actually happens. | Medium | Requires trend/engagement monitoring to surface targets. Reply voice is different from posting voice (shorter, more casual). High risk of feeling spammy if not done well. |
| **CLI-first / Claude Code native** | Every competitor is a web app. PSN is slash commands in your terminal. For the target audience (Claude Code users, developers, technical people), this is faster, more flexible, and lower friction than switching to a browser tab. | Low | The distribution model (clone a repo) is novel. The tradeoff: no visual content preview, no drag-and-drop calendar. Target audience accepts this. |
| **Bilingual content (not translation)** | Competitors offer translation. PSN creates independently crafted content in each language with language-specific voice profiles. Spanish content is not translated English content -- it's native Spanish content from a Spanish-thinking voice. | Medium | Per-post language choice. Voice profiles have `languages.en` and `languages.es` sections. Preference model tracks performance per language. |
| **Content series** | Recurring formats with audience expectation ("Monday Myths", "Friday Failures"). Builds audience habits. Few competitors support this as a first-class concept. | Low | Series definitions in YAML. Installments tracked in DB. Auto-slotted during `/psn:plan`. Low complexity, high user value. |
| **Weekly planning workflow** | `/psn:plan` combines intelligence, idea bank, series, calendar gaps, and batch generation into a single planning session. Competitors offer scheduling but not strategic planning. This is the "sit down on Sunday, plan your week" workflow. | Medium | Orchestrates multiple subsystems. Only as good as the intelligence layer and voice profiling feeding it. |
| **WhatsApp notifications with structured commands** | Competitors use email or in-app notifications. PSN uses WhatsApp (via WAHA or Twilio) with 3 tiers and structured command interaction. Meets users where they already are. | Medium | Future path to Claude-powered WhatsApp chatbot. WAHA (self-hosted) is the cost-effective path. |
| **Employee advocacy without a separate tool** | Dedicated tools (DSMN8, GaggleAMP, Hootsuite Amplify) cost $5-15/user/month and require separate platforms. PSN's brand-ambassador persona achieves employee advocacy natively -- team members post as themselves with company context. | Low | The brand-ambassador voice profile is the mechanism. No gamification or leaderboards (anti-feature). The value is authentic personal posts with company relevance, not corporate-approved copy-paste. |
| **Competitive intelligence** | Track competitor accounts, identify content gaps, monitor what's oversaturated vs. underserved. Most SMM tools focus inward; PSN looks outward. | Medium | `competitive-intel.yaml` with structured tracking. Populated by trend-collector. Feeds into ideation. |
| **Content recycling with fresh angles** | Resurface high-performing past content with new angles, updated data, different platform/persona. Not verbatim reposts -- intelligent recycling. | Low | Uses published archive + preference model. Content fatigue tracker prevents over-recycling. Woven into `/psn:plan`, not a separate workflow. |
| **Approval workflow for company posts** | Table stakes for enterprise tools (Sprout Social, Hootsuite), but a differentiator for a CLI tool targeting small teams. `/psn:approve` with clear pending/approved/rejected states. | Low | Company Hub posts have `pending-approval` state. Simple but necessary for any multi-person company posting. |

## Anti-Features

Features to explicitly NOT build. These are tempting but would hurt the product, dilute focus, or conflict with the core philosophy.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Web dashboard / GUI** | The entire value proposition is CLI-first. A web dashboard would split development effort, create maintenance burden, and compete with every existing tool on their turf. PSN wins by being different, not by being a worse Hootsuite. | Terminal-formatted output for calendar, analytics, queue. Rich but text-based. If users need visual preview, they can check the platform's native preview. |
| **Social inbox / DM management** | Hootsuite and Sprout Social center on unified inboxes. Building one requires real-time message sync, read receipts, media rendering, and conversation threading across 4 platforms. Massive complexity for a feature that's better done in the native apps. | `/psn:engage` handles strategic replies to public posts. DMs stay in native apps where they belong. |
| **Social listening / brand monitoring** | Enterprise tools charge $199-500+/mo for comprehensive social listening. Building competitive listening requires processing millions of mentions in real-time. The ROI for PSN's target users (individuals and small teams) doesn't justify it. | Intelligence layer monitors trends and competitors in your niche. This is targeted intelligence, not firehose monitoring. The distinction matters. |
| **Gamification / leaderboards for advocacy** | Employee advocacy tools like GaggleAMP use points, badges, and leaderboards. This incentivizes volume over quality and creates "advocacy theater" -- employees sharing corporate content for points, not because they believe in it. | Brand-ambassador persona creates genuine personal posts with company context. The incentive is personal brand growth, not points. |
| **Auto-posting without review** | Tempting to offer "set and forget" automation. But AI-generated social media content that posts without human review is how brands end up in PR crises. Every platform's algorithm now suppresses AI slop. Human-in-the-loop is not a limitation -- it's the feature. | All posts go through user review before scheduling. The system drafts, the human decides. Edit rate tracking provides the feedback loop. |
| **Visual content editor / Canva competitor** | Image editing in a CLI tool is absurd. Don't compete with Canva, Figma, or even Buffer's built-in editor. | Generate images via API (GPT Image, Ideogram 3, Flux 2). For custom graphics, users use their existing tools and drop files into `content/media/`. |
| **Link-in-bio / landing pages** | Later and Linktree own this space. It's tangential to the core value of content creation and growth. | Users can use any link-in-bio tool they want. PSN doesn't need to touch this. |
| **Ad management** | Hootsuite and Sprout Social offer ad management. This is a completely different domain (paid media vs. organic growth) with different APIs, different metrics, different expertise. | Stay focused on organic content. If users want to boost posts, they do it on the platform. |
| **Review management** (Yelp, Google Reviews) | Some enterprise tools bundle this. Irrelevant to PSN's social media growth mission. | Out of scope. |
| **Chatbot / auto-DM sequences** | Some tools offer automated DM sequences for lead generation. This is spammy, violates platform ToS in many cases, and contradicts the "authentic growth" philosophy. | Strategic engagement via `/psn:engage` on public posts. If users want DM automation, they use dedicated tools. |
| **Pinterest / YouTube / Facebook / Snapchat** | Spreading across too many platforms dilutes quality. X, LinkedIn, Instagram, and TikTok are the growth platforms for PSN's target audience. Pinterest is niche, YouTube requires a different content model, Facebook organic reach is dead, Snapchat is consumer-only. | 4 platforms, done well. Platform-aware architecture means adding platforms later is possible but not a priority. |
| **Mobile app** | CLI-first means terminal. A mobile app would be a completely separate product. The WhatsApp integration is the mobile touchpoint. | WhatsApp notifications + structured commands provide mobile interaction. Quick capture via WhatsApp for on-the-go ideas. |

## Feature Dependencies

```
Setup/Onboarding (/psn:setup)
  |
  +---> Voice Profiling (Phase 1 of setup)
  |       |
  |       +---> Content Generation (/psn:post)
  |       |       |
  |       |       +---> Content Remixing (cross-platform atoms)
  |       |       +---> Bilingual Content (needs voice in both languages)
  |       |       +---> Content Series (needs generation + series definitions)
  |       |
  |       +---> Strategic Engagement (/psn:engage, needs reply voice)
  |
  +---> OAuth/Token Management
  |       |
  |       +---> Post Scheduling (Trigger.dev delayed runs)
  |       |       |
  |       |       +---> Content Calendar (/psn:calendar)
  |       |
  |       +---> Analytics Collection (platform APIs)
  |               |
  |               +---> Performance Review (/psn:review)
  |               +---> Learning Loop (needs engagement data)
  |                       |
  |                       +---> Preference Model (evolves from learning loop)
  |                               |
  |                               +---> Content Recycling (needs performance data)
  |
  +---> Database Setup (Neon + Drizzle)
          |
          +---> Idea Bank (ideas table)
          |       |
          |       +---> Idea Pipeline (spark -> used lifecycle)
          |       +---> Quick Capture (/psn:capture)
          |
          +---> Intelligence Layer
          |       |
          |       +---> Scheduled Collection (trend-collector)
          |       +---> On-Demand Research (at /psn:plan time)
          |       +---> Competitive Intelligence
          |
          +---> Weekly Planning (/psn:plan)
                  (orchestrates: intelligence + idea bank + series + calendar + generation)

Company Hub (builds on Personal Hub)
  |
  +---> Team Registry + Invite Codes
  +---> Approval Workflow (/psn:approve)
  +---> Shared Idea Bank (company-scoped)
  +---> Brand Preference Model (company-scoped)

WhatsApp Notifications (independent, can be added at any phase)
  +---> WAHA/Twilio setup
  +---> Notification tiers (push/digest/standard)
  +---> Structured commands (future: Claude chatbot)
```

## MVP Recommendation

The MVP must prove the core thesis: **AI that actually sounds like you, getting smarter over time, beats any scheduling tool.**

### Phase 1 - Prioritize (prove the thesis):
1. **Setup/Onboarding** with voice profiling -- the foundation everything depends on
2. **Single-platform posting** (X first -- easiest API, cheapest, fastest feedback loop)
3. **Basic analytics collection** -- needed to close the learning loop
4. **Edit tracking** -- the fastest feedback signal (no need to wait for engagement data)
5. **Content drafts** -- review before posting, human-in-the-loop

### Phase 2 - Core loop (make it useful daily):
1. **Post scheduling** via Trigger.dev -- the "post later" capability
2. **Quick capture** (`/psn:capture`) -- lowest friction idea input
3. **Idea bank** (basic: spark/seed/ready stages)
4. **Learning loop v1** -- engagement signals feeding back into preference model
5. **Content calendar** view

### Phase 3 - Multi-platform + planning:
1. **LinkedIn support** (second platform)
2. **Content remixing** (same idea, adapted per platform)
3. **Weekly planning** (`/psn:plan`)
4. **Intelligence layer** (scheduled collection from free sources)
5. **Content series**

### Defer:
- **Instagram/TikTok**: Rate limits (200 req/hr for IG) and audit requirements (TikTok) make these harder. Add after X + LinkedIn are solid.
- **Company Hub**: Until personal posting is proven, multi-user features add complexity without validation.
- **WhatsApp notifications**: Nice to have, but the core loop works without them.
- **Full intelligence layer** (paid APIs): Start with free sources (HN, Reddit, PH, RSS). Add Perplexity/Exa/Tavily when ideation quality needs a boost.
- **Strategic engagement** (`/psn:engage`): Powerful but depends on trend monitoring + reply voice calibration. Add after the core posting loop is solid.
- **Bilingual content**: Adds complexity to voice profiling. Ship English-only first, add Spanish once voice profiling is proven.

## Competitive Positioning

PSN does not compete with Hootsuite, Sprout Social, or enterprise SMM tools. Those are web-based platforms for marketing teams managing dozens of accounts with social listening, ad management, and unified inboxes.

PSN competes with:
- **Buffer** (simple scheduling + AI writing for creators) -- PSN offers deeper voice matching, learning loop, intelligence
- **SocialBee** (AI copilot + content categories) -- PSN offers content atoms, competitive intelligence, CLI speed
- **Typefully** (X-focused writing tool) -- PSN is multi-platform with strategic planning
- **RedactAI** (LinkedIn AI ghostwriter) -- PSN covers more platforms with deeper voice modeling

The positioning: **"The social media brain for developers and technical professionals who live in the terminal."** Not a dashboard. Not a scheduling tool. A system that thinks about your content strategy, learns your voice, and makes you more prolific without making you sound like AI.

## Sources

- [Blogging Wizard: 11 Best Social Media Management Tools (2026)](https://bloggingwizard.com/best-social-media-management-tools/) -- comprehensive feature comparison across tools
- [Buffer: Best Social Media Management Tools (2026)](https://buffer.com/resources/best-social-media-management-tools/) -- market landscape
- [Sprout Social: Best Social Media Management Tools (2026)](https://sproutsocial.com/insights/social-media-management-tools/) -- enterprise feature expectations
- [Sprout Social: Social Media Scheduling Tools (2026)](https://sproutsocial.com/insights/social-media-scheduling-tools/) -- scheduling landscape
- [Statusbrew: Social Media Engagement Tools (2026)](https://statusbrew.com/insights/social-media-engagement-tools) -- engagement automation features
- [Hootsuite: Social Media Automation Guide (2026)](https://blog.hootsuite.com/social-media-automation/) -- automation best practices
- [TheCMO: Best Employee Advocacy Software (2026)](https://thecmo.com/tools/best-employee-advocacy-software/) -- advocacy tool landscape
- [NoimosAI: Top AI Agents for Social Media (2026)](https://noimosai.com/en/blog/top-10-ai-agents-for-social-media-to-explode-your-brand-growth-in-2026) -- AI brand voice trend
- [Robotic Marketer: AI Content Generation Brand Voice (2026)](https://www.roboticmarketer.com/ai-content-generation-in-2026-brand-voice-strategy-and-scaling/) -- brand voice AI evolution
- [Spoclearn: Social Media Algorithms 2026](https://www.spoclearn.com/blog/social-media-algorithms-2026/) -- algorithm optimization signals
- [Meta Engineering: Facebook Reels RecSys User Feedback (2026)](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/) -- engagement signal weighting
