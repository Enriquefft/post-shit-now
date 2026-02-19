# Post Shit Now

**Your whole team's social media. One AI-powered workflow.**

Plan, create, and schedule across X, LinkedIn, Instagram, and TikTok. Personal brands and company pages. All through Claude Code.

---

## What is this?

PSN is a social media growth system that runs inside [Claude Code](https://claude.ai/claude-code). No dashboards, no web app — just slash commands and AI. You talk to Claude, and your content gets planned, written in your voice, scheduled, and posted.

It works for individuals and teams. Personal accounts are unrestricted. Company accounts get calendars, approval workflows, and coordinated posting across team members.

### Why this approach?

- **Conversational, not click-heavy.** Describe what you want to post. Claude drafts it in your voice, picks the right format, and schedules it.
- **Team-led growth.** Every team member becomes a distribution channel — not just marketing. Employee advocacy gets 561% more reach than company pages alone.
- **Bring your own keys.** No $200/mo SaaS subscription. You pay API providers directly — typically $2-5/mo for full analytics + posting.
- **Your data stays yours.** The repo is your workspace. Credentials never leave your machine. Company data lives in your company's database, not ours.

## Features

### Content Creation
- **Voice-matched posts** — Claude learns your writing style through an adaptive interview, then writes as you
- **Multi-format** — text posts, threads, carousels, Reels, TikToks
- **Bilingual** — English and Spanish, independently crafted (not translated)
- **Media generation** — AI images (GPT Image, Ideogram, Flux) and video (Kling, Runway, Pika)

### Planning & Scheduling
- **Weekly content plans** — topic suggestions based on trends, your pillars, and what's worked before
- **Content series** — recurring themes with installment tracking
- **Unified calendar** — see all scheduled posts across personal + company accounts
- **Automated scheduling** — posts go out at optimal times via Trigger.dev

### Team Coordination
- **Personal + Company hubs** — your personal data never touches a company database
- **Approval workflows** — company posts require review before publishing
- **Invite codes** — team onboarding without sharing raw credentials
- **Role-based access** — admins, editors, and contributors

### Engagement & Analytics
- **Proactive engagement** — find and respond to relevant conversations across platforms
- **Performance tracking** — analytics collection with learning loop
- **Trend intelligence** — monitor trends relevant to your content pillars

## Commands

Everything happens through `/psn:` slash commands in Claude Code:

| Command | What it does |
|---|---|
| `/psn:setup` | Set up your personal hub and connect to company hubs |
| `/psn:voice` | Create and manage voice profiles |
| `/psn:post` | Create, edit, and schedule posts |
| `/psn:capture` | Quick idea capture |
| `/psn:plan` | Generate weekly content plans |
| `/psn:series` | Manage content series |
| `/psn:calendar` | View your unified content calendar |
| `/psn:approve` | Review and approve company posts |
| `/psn:engage` | Run proactive engagement sessions |
| `/psn:review` | Review performance and update learning loop |

## Quick Start

### Prerequisites

- [Claude Code](https://claude.ai/claude-code)
- [Bun](https://bun.sh/) runtime
- A [Neon](https://neon.tech/) account (free tier works)
- A [Trigger.dev](https://trigger.dev/) account

### Setup

```bash
# Clone the repo — this becomes your workspace
git clone https://github.com/enriquefft/post-shit-now.git
cd post-shit-now

# Install dependencies
bun install

# Copy env template and add your keys
cp .env.example .env

# Open Claude Code and run the setup wizard
/psn:setup
```

The setup wizard walks you through everything: database provisioning, Trigger.dev connection, platform OAuth, and voice profile creation.

## Architecture

PSN has no backend you need to host. It's two things:

1. **This repo** — your local workspace with commands, config, drafts, and media
2. **Cloud services you own** — a Neon Postgres database and a Trigger.dev project

```
You (Claude Code)
 ├── /psn:post → drafts content, schedules via Trigger.dev
 ├── /psn:plan → generates weekly plan, stores in your DB
 └── /psn:engage → finds opportunities, drafts replies

Trigger.dev (your account)
 ├── publish-post → posts to platforms at scheduled time
 ├── analytics-collector → pulls metrics on a cadence
 ├── token-refresher → keeps OAuth tokens fresh
 └── trend-collector → monitors trends for your pillars

Neon Postgres (your database)
 └── posts, analytics, ideas, preferences, team registry
```

### Platform Support

| Platform | Posting | Analytics | Engagement |
|---|---|---|---|
| X (Twitter) | Threads, media | Full metrics | Reply drafting |
| LinkedIn | Text, carousels | Impressions, engagement | Monitoring |
| Instagram | Feed, Reels, carousels | Reach, interactions | Hashtag tracking |
| TikTok | Video, photo posts | Views, engagement | Creative Center |

Only pay for platforms you use. Disabled platforms cost nothing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and how to submit changes.

## Security

If you find a security vulnerability, please email enriquefft2001@gmail.com instead of opening a public issue. See [SECURITY.md](SECURITY.md) for details.

## License

[AGPL-3.0](LICENSE) — use it, modify it, share it. If you run a modified version as a service, you must open-source your changes.
