# Post Shit Now

Post Shit Now (PSN) is a Claude Code-first social media growth system — no web app, just slash commands and Trigger.dev automation. It is built for teams who want to post consistently without it feeling like work. The core value: make it so easy to create and publish high-quality, voice-matched content that team members who rarely post start posting consistently.

## Architecture

```
slash command → trigger task → publisher-factory → platform handler → platform client → API
                                      ↓
                               Neon Postgres (analytics, posts, series, teams)
```

Users interact through slash commands in Claude Code. Commands schedule Trigger.dev tasks that call the publisher-factory to resolve the right platform handler. Each handler holds a platform client that talks to the external API. All results (post records, analytics, series state) are written to Neon Postgres via Drizzle ORM.

## Module Map

| Alias | Path | Responsibility |
|-------|------|----------------|
| `@psn/core` | `src/core/` | Shared types, DB connection, crypto utils |
| `@psn/platforms` | `src/platforms/` | Platform handlers + PlatformPublisher contract |
| `@psn/trigger/*` | `src/trigger/` | Trigger.dev scheduled tasks |

Other top-level directories (no alias — relative imports):

- `src/voice/` — voice profile management, interview engine, content generation
- `src/series/` — series tracking and episode sequencing
- `src/approval/` — approval workflow types and state machine
- `src/notifications/` — WhatsApp/email notification dispatching
- `src/team/` — team registry, invite codes, member roles
- `src/media/` — image generation and media upload helpers

## Dev Commands

| Command | Purpose |
|---------|---------|
| `bun test` | Run all tests |
| `bun run typecheck` | TypeScript type check |
| `bun run check:circular` | Detect circular dependencies |
| `biome check src/` | Lint + format check |

Do NOT use `npm`, `npx`, or `yarn` — this project uses Bun exclusively.

## Slash Commands

All commands are under the `/psn:` namespace:

| Command | Description |
|---------|-------------|
| `/psn:post` | Create and schedule voice-matched posts |
| `/psn:plan` | Weekly content planning engine with trend-informed ideation |
| `/psn:voice` | Voice profile management — tweaks, calibration, and imports |
| `/psn:capture` | Fast idea capture and management for the idea bank |
| `/psn:series` | Content series management — create, pause, resume, retire |
| `/psn:approve` | Content approval workflow for Company Hubs |
| `/psn:calendar` | Unified multi-hub content calendar with approval status |
| `/psn:review` | Content performance review and learning loop updates |
| `/psn:engage` | Proactive engagement sessions with triage-then-draft flow |
| `/psn:setup` | Hub setup, team management, and notifications configuration |
