# Contributing to Post Shit Now

Thanks for your interest in contributing! PSN is a Claude Code-first system, so the development workflow is a bit different from typical projects.

## Prerequisites

- [Bun](https://bun.sh/) (runtime + package manager)
- [Claude Code](https://claude.ai/claude-code) (the CLI — this is how you interact with PSN)
- A [Neon](https://neon.tech/) Postgres database
- A [Trigger.dev](https://trigger.dev/) account (for scheduling/automation)
- Platform API keys for whichever platforms you're working on

## Getting Started

```bash
# Clone the repo
git clone https://github.com/enriquefft/post-shit-now.git
cd post-shit-now

# Install dependencies
bun install

# Copy the env template and fill in your keys
cp .env.example .env

# Run database migrations
bun run db:migrate

# Start Trigger.dev dev server
bun run dev
```

## Development Workflow

PSN is built around Claude Code slash commands. The main interface lives in `.claude/commands/`.

```bash
# Typecheck
bun run typecheck

# Run tests
bun run test

# Lint
bun run lint

# Auto-fix lint + format
bun run lint:fix
```

## Code Style

- **Formatter**: Biome — tabs, 100 char line width, double quotes, semicolons
- **Linter**: Biome recommended rules
- **Language**: TypeScript (strict)
- **ORM**: Drizzle
- **Validation**: Zod

Run `bun run lint:fix` before committing. CI will reject PRs that fail lint or typecheck.

## Project Structure

```
src/
  analytics/     # Performance tracking and metrics
  approval/      # Content approval workflows
  cli/           # CLI utilities
  content/       # Content creation and formatting
  core/          # Shared types, DB schema, config
  engagement/    # Engagement tracking and reply drafting
  ideas/         # Idea capture and management
  intelligence/  # Trend analysis and content intelligence
  learning/      # Learning loop and preference models
  media/         # Image/video generation
  notifications/ # WhatsApp and alert system
  planning/      # Content planning engine
  platforms/     # Platform-specific API clients (X, LinkedIn, IG, TikTok)
  series/        # Content series management
  team/          # Hub and team management
  trigger/       # Trigger.dev task definitions
  voice/         # Voice profile system
```

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Ensure `bun run typecheck`, `bun run lint`, and `bun run test` all pass
4. Open a PR with a clear description of what and why

## Slash Commands

PSN's user interface is slash commands in Claude Code (`.claude/commands/`). If you're adding a new feature, consider whether it should be exposed as a command.

## Bilingual Support

PSN supports English and Spanish. Content features should handle both languages — not as translations, but as independently crafted content per language.

## Questions?

Open an issue or start a discussion. We're happy to help you get oriented.
