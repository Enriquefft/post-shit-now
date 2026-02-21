# Entity Creation Workflow

## Overview

Entities allow you to manage multiple projects, brands, or personas with separate voice profiles. Each entity has its own voice profile, content generation settings, and platform connections.

## Quick Start

1. List existing entities: `/psn:setup entity --list`
2. Create a new entity: `/psn:setup entity --create "My Project"`
3. Start voice interview: `/psn:setup voice start --entity my-project`
4. Complete interview: `/psn:setup voice complete --entity my-project`
5. Connect platforms: `/psn:setup (X, LinkedIn, Instagram, TikTok)`

## Detailed Workflow

### Step 1: Create Entity

Entities are created with a display name and optional description:

```
bun run src/cli/setup.ts entity --create "My Side Project" --description "A project about AI tools"
```

The system automatically generates a URL-friendly slug from the display name:
- "My Side Project" → "my-side-project"
- "Brand Name" → "brand-name"

The slug is used internally to reference the entity in commands and database operations.

### Step 2: Voice Interview

Each entity requires a voice profile to generate content. The voice interview collects your brand's unique voice characteristics:

```
bun run src/cli/setup.ts voice start --entity my-project
```

The interview collects:
- **Maturity level** (never_posted, starting, established, veteran)
- **Brand values** and voice characteristics
- **Content pillars** and topics
- **Platform-specific preferences**

Answer questions naturally. The system analyzes your responses to build a detailed voice profile that will guide content generation.

### Step 3: Complete Interview

After answering all questions, complete the interview to save your voice profile:

```
bun run src/cli/setup.ts voice complete --entity my-project
```

This finalizes the voice profile and saves it to the database. The entity is now ready for content generation.

### Step 4: Connect Platforms

Connect social platforms to publish content:

```
bun run src/cli/setup.ts x
bun run src/cli/setup.ts linkedin
bun run src/cli/setup.ts instagram
bun run src/cli/setup.ts tiktok
```

Platform connections are shared across all entities in your hub. You only need to authenticate each platform once.

## Slug Collisions

If you create multiple entities with similar names, the system automatically handles slug collisions:

- First: "my-project" → slug: "my-project"
- Second: "my-project" → slug: "my-project-2"
- Third: "my-project" → slug: "my-project-3"

You don't need to worry about naming conflicts—the system ensures unique slugs automatically.

## Commands Reference

### Entity Management

- `/psn:setup entity --list` - List all entities
- `/psn:setup entity --create "Name"` - Create new entity
- `/psn:setup entity --create "Name" --description "Description"` - Create entity with description
- `/psn:setup entity --delete <slug>` - Delete entity

### Voice Interview

- `/psn:setup voice start --entity <slug>` - Start voice interview for entity
- `/psn:setup voice status --entity <slug>` - Check interview progress
- `/psn:setup voice complete --entity <slug>` - Complete and save profile

### Platform Setup

- `/psn:setup x` - Connect X (Twitter)
- `/psn:setup linkedin` - Connect LinkedIn
- `/psn:setup instagram` - Connect Instagram
- `/psn:setup tiktok` - Connect TikTok

### Status Checking

- `/psn:setup status` - Check overall setup progress and see what's configured

## Multi-Entity Use Cases

### Personal Brand + Side Project

Manage your personal brand and side projects separately with distinct voices:

1. Create "personal" entity for your main brand
2. Create "side-project" entity for your project
3. Run voice interview for each (different audiences, different voice)
4. Generate content targeted to each audience

### Agency Accounts

Manage multiple client brands from a single hub:

1. Create entities for each client (e.g., "client-a", "client-b")
2. Run voice interview for each client's brand voice
3. Generate and approve content per client
4. Publish to client's connected platforms

## Troubleshooting

### Interview Not Completing

If the interview state persists after completion:

```
bun run src/cli/setup.ts voice complete --entity my-project
```

Check status with:

```
bun run src/cli/setup.ts voice status --entity my-project
```

### Entity Not Found

List entities to find the correct slug:

```
bun run src/cli/setup.ts entity --list
```

Use the slug (not display name) in all commands. The slug is a URL-friendly version of the entity name.

### Setup Status

Check overall setup progress:

```
bun run src/cli/setup.ts status
```

This shows which steps are complete and what remains:
- Hub: Personal Hub configured
- Voice: At least one entity has a completed voice profile
- Platforms: Social platforms connected

## Entity Lifecycle

1. **Created**: Entity record exists in database with blank-slate profile
2. **In Progress**: Voice interview in progress, partial answers saved
3. **Complete**: Voice interview finished, profile finalized
4. **Active**: Entity used for content generation, lastUsedAt updated

Once an entity is complete, you can generate content using it. The system automatically updates the `lastUsedAt` timestamp when you load a profile, helping you track which entities are actively used.
