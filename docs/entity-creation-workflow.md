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

Entity slugs must be unique within your hub. The system automatically handles slug collisions by incrementing a suffix.

### How It Works

When you create an entity, the system:
1. Generates a base slug from the display name (e.g., "my-project" from "My Project")
2. Queries all existing entity slugs for your hub
3. If the base slug is available, uses it directly
4. If the base slug exists, tries `my-project-2`, `my-project-3`, etc. incrementally
5. Uses the first available slug found

### Examples

| Display Name | Existing Slugs | Generated Slug |
|-------------|---------------|----------------|
| "My Project" | (none) | `my-project` |
| "My Project" | `my-project` | `my-project-2` |
| "My Project" | `my-project`, `my-project-2` | `my-project-3` |
| "My Project" | `my-project`, `my-project-2`, `my-project-4` | `my-project-3` |
| "Brand Name" | `brand-name-2` | `brand-name` |

### Key Behaviors

- **Automatic collision resolution**: No manual intervention needed
- **Incremental pattern**: Always starts at `-2`, then `-3`, `-4`, etc.
- **Gaps allowed**: If you have `my-project` and `my-project-4`, creating another "My Project" gives `my-project-2` (fills gaps)
- **Case insensitive**: "My Project" and "my project" generate the same base slug
- **Preserved display name**: Original display name is stored unchanged—only the slug is normalized

### Case Sensitivity

Slugs are always lowercase with hyphens, while display names preserve original case:

| Display Name | Generated Slug | Notes |
|-------------|---------------|-------|
| "My Project" | `my-project` | Lowercase, hyphens |
| "MY PROJECT" | `my-project` | Case normalized |
| "my-project" | `my-project` | Already valid |
| "My Project (2024)" | `my-project-2024` | Parentheses become hyphens |

### Technical Details

The `ensureUniqueSlug()` function in `src/voice/entity-profiles.ts` implements this logic:
- Queries all existing slugs for the user from the database
- Uses a Set for O(1) collision lookups
- Increments from 2 upwards until finding an available slug
- Returns the unique slug for use in entity creation

### What You Need to Know

**You don't need to worry about naming conflicts.** The system ensures unique slugs automatically. Just use descriptive, memorable names for your entities, and let the system handle collisions.

Examples of good entity names:
- "PSN Founder" → `psn-founder`
- "Tech Newsletter" → `tech-newsletter`
- "Brand Agency" → `brand-agency`

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
