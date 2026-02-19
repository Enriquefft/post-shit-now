# Changelog

All notable changes to Post Shit Now will be documented in this file.

## [0.1.0] - 2026-02-19

Initial pre-release. Core system is functional across all four platforms.

### Core Infrastructure
- Hub provisioning, team management, and invite code onboarding
- Neon Postgres with Drizzle ORM and row-level security
- Trigger.dev integration for scheduling, cron jobs, and automation
- `/psn:setup` wizard for hub configuration

### Content Creation
- Voice profile system with adaptive interviews and YAML storage
- `/psn:post` command with voice-matched generation
- `/psn:capture` for fast idea capture
- `/psn:plan` weekly content planning engine
- `/psn:series` content series management
- Content brain with format picker and topic suggestions
- Bilingual support (English/Spanish) — independently crafted, not translated

### Platform Support
- **X (Twitter)**: OAuth, posting, threads, analytics collection
- **LinkedIn**: OAuth, posting, analytics
- **Instagram**: OAuth, container-based media publishing, hashtag pools, Reels
- **TikTok**: OAuth, chunked upload, photo posting, Creative Center integration

### Media Generation
- Image generation: GPT Image, Ideogram 3, Flux 2
- Video generation: Kling, Runway Gen4, Pika

### Engagement
- `/psn:engage` proactive engagement sessions with triage-then-draft flow
- Opportunity scoring engine and cross-platform monitoring
- Reply drafting engine and engagement outcome tracking

### Team & Notifications
- Multi-hub calendar with slot claiming and conflict resolution
- `/psn:approve` content approval workflow for company hubs
- `/psn:calendar` unified calendar view
- WhatsApp notifications via WAHA/Twilio with structured commands
- Digest compiler and scheduled delivery

### Analytics & Learning
- Analytics collection with tiered cadence per platform
- `/psn:review` performance review and learning loop
- Edit tracking and calibration engine
