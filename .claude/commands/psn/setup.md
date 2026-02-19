# /psn:setup — Personal Hub Setup Wizard

You are running the Post Shit Now setup wizard. Guide the user through provisioning their Personal Hub step by step.

## Prerequisites

The user needs:
1. A **Neon** account (https://neon.tech) with an API key
2. A **Trigger.dev** account (https://trigger.dev) with a project and secret key

## Setup Flow

### Step 1: Check existing configuration

Read the following files to determine what's already set up:
- `config/keys.env` — API keys (NEON_API_KEY, TRIGGER_SECRET_KEY)
- `config/hub.env` — Database URL, encryption key
- `trigger.config.ts` — Trigger.dev project ref

### Step 2: Collect API keys

If `config/keys.env` is missing or incomplete, ask the user for:

**[1/5] API Keys**

1. **NEON_API_KEY** — Get from: Neon Console -> Settings -> API Keys -> Generate new key
2. **TRIGGER_SECRET_KEY** — Get from: Trigger.dev Dashboard -> Project Settings -> API Keys

Write each key to `config/keys.env` as `KEY=value` format using `bun run src/cli/setup-keys.ts`.

### Step 3: Provision database

Run: `bun run src/cli/setup-db.ts`

**[2/5] Creating Database**

This will:
- Create a Neon project named `psn-hub-{random}`
- Generate an encryption key for token storage
- Save credentials to `config/hub.env`

**[3/5] Running Migrations**

The database setup automatically runs Drizzle migrations to create tables.

### Step 4: Configure Trigger.dev

Run: `bun run src/cli/setup-trigger.ts`

**[4/5] Setting up Trigger.dev**

This will update `trigger.config.ts` with the project ref.

If auto-detection fails, ask the user for their Trigger.dev project ref (starts with `proj_`).

### Step 5: Validate

Run: `bun run src/cli/validate.ts`

**[5/5] Validating Connections**

Present the validation checklist:

```
Hub Validation
--------------
[PASS/FAIL] Database connectivity
[PASS/FAIL] Trigger.dev configuration
[PASS/FAIL] Config directory structure
[PASS/FAIL] API keys present
```

### Alternatively: Run all at once

You can run the full setup orchestrator:

```bash
bun run src/cli/setup.ts
```

This runs all steps in order, skipping any that are already complete. Parse the JSON output and present results to the user.

## Troubleshooting

- **neonctl not found**: Run `npm i -g neonctl` or `bun add -g neonctl`
- **Migration failed**: Check DATABASE_URL in `config/hub.env`, then re-run setup
- **Trigger.dev init failed**: Manually set project ref in `trigger.config.ts`

## Important

- All credentials are stored locally in `config/` (gitignored)
- Never log or display full database URLs or API keys
- The setup is idempotent — safe to re-run
