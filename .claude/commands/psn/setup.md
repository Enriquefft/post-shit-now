---
description: Hub setup, team management, and notifications configuration
---

# /psn:setup -- Hub Setup and Team Management

You are running the Post Shit Now setup wizard. Supports Personal Hub provisioning, Company Hub creation, team joining, notification configuration, and voice profile management.

## Arguments
$ARGUMENTS

## Usage
- `/psn:setup` -- Personal Hub setup wizard (default)
- `/psn:setup status` -- show what's configured and recommended next action
- `/psn:setup voice` -- voice profile setup (absorbs /psn:voice interview)
- `/psn:setup voice --entity <slug>` -- update specific entity voice
- `/psn:setup entity` -- list entities or create new one
- `/psn:setup entity --list` -- list all entities
- `/psn:setup entity --create "My Project"` -- create new entity
- `/psn:setup entity --create "My Project" --description "Description"` -- create with description
- `/psn:setup hub` -- create a new Company Hub
- `/psn:setup join <invite_bundle>` -- join a Company Hub with invite bundle
- `/psn:setup disconnect <slug>` -- disconnect from a Company Hub
- `/psn:setup invite <slug>` -- generate an invite code for a Company Hub (admin only)
- `/psn:setup team <slug>` -- list team members of a Company Hub
- `/psn:setup promote <slug> <userId>` -- promote a member to admin (admin only)
- `/psn:setup notifications` -- configure WhatsApp notification preferences

---

## /psn:setup status -- Show Setup Status

### Returning User Flow

When user runs `/psn:setup status`:

```bash
bun run src/cli/setup.ts status
```

Show the status screen with checkmarks for completed steps and gaps highlighted:

```
Setup Status
------------
[x] Personal Hub configured
[x] Voice profile created (2 entities)
[ ] Platform connections (0 connected)

Recommended: Connect a platform to start posting
```

**If all steps complete:**
```
Setup Status
------------
[x] Personal Hub configured
[x] Voice profile created (3 entities)
[x] Platform connections (x, linkedin)

All set! You're ready to post.
```

Offer shortcuts: "Want to [add voice] / [connect platform] / [create entity]?"

---

## /psn:setup voice -- Voice Setup Flow

Voice interviews are now managed through `/psn:setup voice`:

```bash
bun run src/cli/setup.ts voice
```

### Flow

1. **If no entities exist:** First-run interview creates default entity
   - Present the voice interview questions from `/psn:voice interview`
   - Guide through identity, style, platforms, language phases
   - Create the entity with the captured profile

2. **If entities exist:** Show picker
   ```
   Voice Profiles
   --------------
   1. psn-founder (Personal) - last used 2 days ago
   2. my-side-project (Project) - last used 1 week ago

   Select entity to update, or create new with: /psn:setup entity --create "Name"
   ```

3. **After selection:** Start/update voice interview

4. **For specific entity:**
   ```bash
   bun run src/cli/setup.ts voice --entity my-project
   ```

Preserves existing /psn:voice interview functionality through unified entry point.

---

## /psn:setup entity -- Entity Management

### List Entities

```bash
bun run src/cli/setup.ts entity --list
```

Shows all entities with slug, display name, description, and last used date.

### Create Entity

```bash
bun run src/cli/setup.ts entity --create "My Side Project"
bun run src/cli/setup.ts entity --create "My Side Project" --description "My personal project for X"
```

### Entity Creation Flow

1. Create entity with auto-slugified name (e.g., "My Side Project" -> "my-side-project")
2. Start voice interview for new entity
3. After interview: suggest platform connections
4. Smart defaults: if existing entity has X connected, suggest X for new entity

---

## Personal Hub Setup (default -- no subcommand)

### Prerequisites

The user needs:
1. A **Neon** account (https://neon.tech) with an API key
2. A **Trigger.dev** account (https://trigger.dev) with a project and secret key

### Step 1: Check existing configuration

Read the following files to determine what's already set up:
- `config/keys.env` -- API keys (NEON_API_KEY, TRIGGER_SECRET_KEY)
- `config/hub.env` -- Database URL, encryption key
- `trigger.config.ts` -- Trigger.dev project ref

### Step 2: Collect API keys

If `config/keys.env` is missing or incomplete, ask the user for:

**[1/5] API Keys**

1. **NEON_API_KEY** -- Get from: Neon Console -> Settings -> API Keys -> Generate new key
2. **TRIGGER_SECRET_KEY** -- Get from: Trigger.dev Dashboard -> Project Settings -> API Keys

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

---

## /psn:setup hub -- Create a Company Hub

### Flow
1. Ask for company name and slug:
   > "What's the company name? (e.g., 'Acme Corp')"
   > "Choose a slug (lowercase, hyphens allowed): (e.g., 'acme-corp')"

2. Verify Neon API key is available (must have run Personal Hub setup first)

3. Create the Company Hub:
   ```typescript
   import { runSetupSubcommand } from "src/cli/setup.ts";

   const result = await runSetupSubcommand("hub", {
     slug: "acme-corp",
     displayName: "Acme Corp",
     adminUserId: currentUserId,
   });
   ```

   Or via CLI:
   ```bash
   bun run src/cli/setup.ts hub --slug acme-corp --displayName "Acme Corp"
   ```

4. On success, show:
   > "Company Hub created: Acme Corp (acme-corp)"
   > "Connection saved to `.hubs/company-acme-corp.json`"
   > "Generate invite codes with `/psn:setup invite acme-corp`"

5. On error (no Neon API key, slug invalid, etc.), show the error and guide recovery.

---

## /psn:setup join -- Join a Company Hub

### Flow
1. Receive invite bundle from `$ARGUMENTS` (base64 JSON string shared by admin):
   > The admin will give you a long base64 string. Paste it here.

2. Decode and join:
   ```typescript
   const result = await runSetupSubcommand("join", {
     inviteBundle: "<base64 string>",
     userId: currentUserId,
     displayName: userDisplayName,
     email: userEmail,
   });
   ```

   Or via CLI:
   ```bash
   bun run src/cli/setup.ts join --inviteBundle "<base64 string>"
   ```

3. On success:
   > "Joined Acme Corp as member. Connection saved to `.hubs/company-acme-corp.json`"
   > "You can now see the company calendar with `/psn:calendar` and create company posts."

4. On error (invalid bundle, expired code, already used):
   > Show the specific error and suggest asking the admin for a new invite.

---

## /psn:setup disconnect -- Disconnect from a Company Hub

### Flow
1. If no slug provided, show connected Company Hubs:
   ```typescript
   import { discoverCompanyHubs } from "src/team/hub.ts";
   const hubs = await discoverCompanyHubs(".");
   ```
   Ask: "Which hub do you want to disconnect from?"

2. Confirm disconnection:
   > "Disconnect from Acme Corp? Your published content will be preserved. (yes/no)"

3. Disconnect:
   ```typescript
   const result = await runSetupSubcommand("disconnect", {
     slug: "acme-corp",
     userId: currentUserId,
   });
   ```

   Or via CLI:
   ```bash
   bun run src/cli/setup.ts disconnect --slug acme-corp
   ```

4. Confirm:
   > "Disconnected from Acme Corp. Your published content is preserved in the hub."

---

## /psn:setup invite -- Generate Invite Code (admin only)

### Flow
1. Verify the user is an admin of the specified hub:
   ```typescript
   import { isAdmin } from "src/team/members.ts";
   import { getHubConnection, getHubDb } from "src/team/hub.ts";

   const connection = await getHubConnection(".", slug);
   const db = getHubDb(connection);
   const admin = await isAdmin(db, { userId: currentUserId, hubId: connection.hubId });
   ```

2. Generate an invite code:
   ```typescript
   import { generateInviteCode } from "src/team/invite.ts";

   const code = await generateInviteCode(db, {
     hubId: connection.hubId,
     createdBy: currentUserId,
   });
   ```

3. Build the invite bundle (base64 encode connection details + code):
   ```typescript
   const bundle = Buffer.from(JSON.stringify({
     code,
     slug: connection.slug,
     displayName: connection.displayName,
     databaseUrl: connection.databaseUrl,
     triggerProjectId: connection.triggerProjectId,
     encryptionKey: connection.encryptionKey,
   })).toString("base64");
   ```

4. Present:
   > "Share this invite bundle with the team member:"
   > `{base64_bundle}`
   > "Expires in 48 hours. One-time use."

5. If not admin:
   > "Only hub admins can generate invite codes. Contact an admin of {hubName}."

---

## /psn:setup team -- List Team Members

### Flow
1. Connect to the Company Hub:
   ```typescript
   import { listTeamMembers } from "src/team/members.ts";
   import { getHubConnection, getHubDb } from "src/team/hub.ts";

   const connection = await getHubConnection(".", slug);
   const db = getHubDb(connection);
   const members = await listTeamMembers(db, connection.hubId);
   ```

2. Display:
   ```
   Acme Corp - Team Members
   -------------------------
   @admin-user (admin) - joined Feb 17, 2026
   @john (member) - joined Feb 18, 2026
   @sarah (member) - joined Feb 19, 2026
   ```

3. If the user is an admin, show management hints:
   > "Promote a member: `/psn:setup promote acme-corp <userId>`"
   > "Generate invite: `/psn:setup invite acme-corp`"

---

## /psn:setup promote -- Promote Member to Admin

### Flow
1. Verify the current user is an admin of the hub
2. Promote the target member:
   ```typescript
   import { promoteToAdmin } from "src/team/members.ts";

   await promoteToAdmin(db, { userId: targetUserId, hubId: connection.hubId });
   ```

3. Confirm:
   > "@{userId} promoted to admin of {hubName}."

4. Errors:
   - Not admin: "Only admins can promote members."
   - Member not found: "No active member with userId '{userId}' in {hubName}."

---

## /psn:setup notifications -- Configure WhatsApp Notifications

### Flow
1. Ask for WhatsApp provider:
   > "Which WhatsApp provider? (waha / twilio)"
   > - **WAHA**: Self-hosted, free tier available. Requires WAHA server URL.
   > - **Twilio**: Cloud-hosted, pay per message. Requires Account SID, Auth Token, From number.

2. Collect provider credentials:

   **WAHA:**
   - WAHA server URL (e.g., `http://localhost:3000` or your hosted instance)
   - Session name (default: "default")

   **Twilio:**
   - Account SID
   - Auth Token
   - From number (WhatsApp sandbox or registered number)

3. Ask for phone number:
   > "Your WhatsApp number (with country code, e.g., +1234567890):"

4. Configure notification preferences:
   ```typescript
   import { registerSession, sendMessage } from "src/notifications/waha.ts";
   // or
   import { sendMessage } from "src/notifications/twilio.ts";
   ```

   Preferences to set:
   - **Push notifications:** enabled/disabled (approval requests, post failures, viral alerts)
   - **Digest frequency:** twice-daily / daily / weekly
   - **Quiet hours:** start and end time (e.g., 10pm-7am -- no push during these hours)

5. Send a test message to verify the connection:
   > "Sending test message to {phone}..."
   > "Test message sent. Did you receive it? (yes/no)"

6. Save preferences to the database:
   ```typescript
   // Save to notification_preferences and whatsapp_sessions tables
   ```

7. Confirm:
   > "WhatsApp notifications configured."
   > "Push: enabled | Digest: twice-daily | Quiet hours: 10pm-7am"
   > "You'll receive notifications for: approvals, failures, viral alerts, and digests."

---

## Troubleshooting

- **neonctl not found**: Run `npm i -g neonctl` or `bun add -g neonctl`
- **Migration failed**: Check DATABASE_URL in `config/hub.env`, then re-run setup
- **Trigger.dev init failed**: Manually set project ref in `trigger.config.ts`
- **Invalid invite bundle**: Ask the admin to generate a new one
- **Hub connection failed**: Check `.hubs/company-{slug}.json` exists and DB URL is valid

## Important
- All credentials are stored locally in `config/` (gitignored)
- Never log or display full database URLs or API keys
- The setup is idempotent -- safe to re-run
- Company Hub creation requires a Personal Hub to exist first (shares Neon project)
- Invite bundles contain the database URL -- share only with trusted team members
- Soft-delete on disconnect preserves content attribution in the hub

> **Note:** `/psn:voice interview` is now accessible via `/psn:setup voice`.
> `/psn:voice` still works for voice-only operations (tweak, calibrate, import).
