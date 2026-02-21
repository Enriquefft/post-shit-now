# Phase 3: Voice Profiling and Content Generation - Research

**Researched:** 2026-02-19
**Domain:** Voice profiling, AI content generation, image generation, video generation, draft management
**Confidence:** HIGH

## Summary

Phase 3 is the core differentiator of the system. It spans five major subsystems: (1) voice profiling via adaptive interviews and content import, (2) AI-powered post generation in the user's authentic voice, (3) image generation using three providers (GPT Image, Ideogram 3, Flux 2), (4) video generation using three providers (Kling, Runway, Pika), and (5) draft lifecycle management. The existing codebase already has the post creation/scheduling pipeline (Phase 2), so Phase 3 builds the "content brain" layer that sits upstream of it.

The stack converges on a clean pattern: OpenAI SDK for GPT Image and content generation, fal.ai client for Flux 2/Kling/Pika, raw fetch for Ideogram direct API (or fal.ai proxy), Runway SDK for Runway, and sharp for all image processing. Voice profiles are YAML files in the repo (git-stored, not DB-stored per architecture decisions). The `yaml` package is already a dependency.

**Primary recommendation:** Use fal.ai as the unified gateway for Flux 2, Kling, and Pika (single SDK, pay-per-use, no minimums). Use OpenAI SDK for GPT Image. Use Ideogram direct API or fal.ai proxy for Ideogram 3. Use Runway SDK for Runway. All media generation goes through a provider abstraction layer so Claude can pick the best tool per content type.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Voice Interview Flow
- **Adaptive depth interview**: Starts with 5-8 core questions, branches deeper based on answers. User can stop anytime and profile improves over time.
- **Spectrum-aware design**: Users are NOT binary (never-posted vs power-poster). The interview adapts to where the user falls on the experience spectrum. Detect from their answers and imported content how much social media experience they have, and adjust question depth/framing accordingly.
- **Profile contains 4 data dimensions beyond writing style**:
  1. Content pillars (3-5 topics they want to be known for)
  2. Comfort boundaries (topics/tones they explicitly avoid)
  3. Platform personas (different voice parameters per platform)
  4. Reference voices (accounts/people whose style they admire)
- **Both editing modes**: YAML is the source of truth and always directly editable. `/psn:voice edit` provides guided interactive experience for those who prefer it. Claude validates profile on next use.

#### Content Import & Calibration
- **Import sources**: X post history (via OAuth), blog/website URLs (scrape + analyze), raw text samples (paste directly), and other user-created content sources (flexible input)
- **Adaptive threshold**: No hard minimum for content samples. Start generating with whatever's available. Profile improves as more content is added over time. Quality and diversity of samples matter more than quantity.
- **Dual calibration signals**: Track edits silently (what user changes in drafts) AND occasionally ask for explicit feedback. Both signals refine the voice profile.
- **Calibration convergence**: After N approved posts with consistently low edit distance, mark profile as "calibrated" with confidence score. Continue learning after calibration.

#### Post Generation Experience
- **Flexible input**: Accept anything from a single word to detailed instructions. Claude adapts to how much the user provides.
- **Configurable variations**: Default to 1 best draft. User can request multiple variations when they want options.
- **Both inline + file drafts**: Default to inline conversation. Also save to `drafts/` folder. Preference is configurable.
- **High-fidelity visual previews**: For visual posts (carousels, image posts, infographics), Claude generates a high-fidelity storyboard or mockup. Only when it makes sense.
- **Smart format suggestion**: Claude picks the best format based on content + platform strengths. Shows what other formats could work.

#### Media Generation
- **Provider selection**: User can set default image and video generators in config. Claude auto-selects the best tool when another would be clearly better. User preference respected but Claude suggests switching when appropriate.
- **Video scope**: Claude has full liberty to determine the right scope for video generation based on platform requirements and API capabilities.
- **Always approve media**: Never auto-attach generated media. Show generated image/video to user, who says "use this" or "regenerate". Safer flow.
- **3 attempts max**: Generate up to 3 times. After 3 failed attempts, suggest refining the prompt or providing their own image/video instead.

### Claude's Discretion
- Exact interview question wording and branching logic
- Voice profile YAML schema structure and field names
- Edit distance calculation method for calibration scoring
- Visual preview format and rendering approach
- Draft auto-pruning rules and timing
- How to extract voice patterns from imported content
- Platform-specific media processing (dimensions, formats, compression)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | Voice profiling interview capturing identity, voice patterns, boundaries, platform preferences | Adaptive interview design with branching logic, YAML output |
| VOICE-02 | Import existing content (X history, LinkedIn posts, blog posts) to bootstrap voice | X API GET /2/users/:id/tweets for history; web scraping for blogs; raw text paste |
| VOICE-03 | Generate personal.yaml with language-agnostic traits and language-specific sections | YAML schema design with `yaml` package (already installed) |
| VOICE-04 | Calibration mode tracks edit rates over first 10-15 posts and presents calibration reports | Edit distance tracking in post metadata, Levenshtein or word-level diff |
| VOICE-05 | Blank-slate users get shorter personality-first interview with starter archetypes | Shortened interview branch, archetype templates |
| VOICE-06 | Bilingual voice interview with language-specific voice sections | YAML schema supports per-language sections (`en:`, `es:`) |
| VOICE-07 | Brand-operator voice profiles per connected company | Separate YAML files in company config directory |
| VOICE-08 | Brand-ambassador voice profiles inheriting from personal with company guardrails | YAML inheritance/merge pattern |
| VOICE-09 | Quick voice tweaks via `/psn:config voice` | YAML read-modify-write with `yaml` package |
| VOICE-10 | Full voice recalibration via `/psn:setup voice` | Re-run interview flow, preserve import data |
| POST-01 | Generate a post for X in user's voice using `/psn:post` | Voice profile + OpenAI chat completion + platform constraints |
| POST-05 | Content brain picks optimal format per platform | Format selection logic based on content type + platform strengths |
| POST-06 | User can choose posting persona per post | Persona parameter in generation, loads correct voice profile |
| POST-09 | Human reviews and edits every generated post before scheduling | Inline review flow, draft save, edit tracking |
| POST-10 | Every edit tracked with edit distance and patterns | Levenshtein distance, word-level diff, pattern categorization |
| POST-11 | System checks idea bank for ready ideas before asking for a topic | DB query for ideas with status=ready (Phase 5 dependency -- stub for now) |
| POST-12 | System offers 3 quick topic suggestions when no topic provided | Claude generates suggestions based on voice profile pillars |
| POST-14 | Generated content reflects learnings from preference model | Preference model query (Phase 4 dependency -- stub for now) |
| IMG-01 | Generate images using GPT Image (versatile) | OpenAI SDK `images.generate()` with gpt-image-1 model |
| IMG-02 | Generate images using Ideogram 3 (best text rendering) | Ideogram API POST `api.ideogram.ai/v1/ideogram-v3/generate` or fal.ai `fal-ai/ideogram/v3` |
| IMG-03 | Generate images using Flux 2 via fal.ai (photorealistic) | fal.ai client `fal-ai/flux-2-pro` endpoint |
| IMG-04 | Images processed via sharp for platform-specific format/size | sharp npm package for resize, format conversion, compression |
| IMG-05 | Claude picks best image generation tool based on content type | Provider selection logic in media generation abstraction |
| VID-01 | Animated text/quote videos (fully automated) | Kling or Pika text-to-video via fal.ai |
| VID-02 | B-roll with voiceover using TTS (fully automated) | Kling 2.6 simultaneous audio-visual generation |
| VID-03 | Short video clips using Kling, Runway, or Pika | fal.ai for Kling/Pika, Runway SDK for Runway |
| VID-04 | Claude picks best video generation tool based on content type | Provider selection logic in video generation abstraction |
| VID-05 | Generated video meets platform-specific format/length requirements | Platform specs enforcement, ffmpeg/sharp for post-processing |
| CONTENT-01 | Drafts stored in `content/drafts/` with auto-pruning 14 days after publishing | File-based draft storage, cron-style pruning logic |
| CONTENT-02 | Generated media stored in `content/media/` with auto-pruning 7 days after posting | File-based media storage, pruning logic |
| CONFIG-02 | Strategy.yaml auto-generated from voice interview | YAML generation during interview completion |
| CONFIG-03 | `/psn:config` allows manual overrides | YAML read-modify-write pattern |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^5.x | GPT Image generation, content generation | Official OpenAI SDK, TypeScript-first, handles auth/retry |
| @fal-ai/client | ^1.x | Flux 2, Kling, Pika image/video generation | Unified gateway for multiple AI models, pay-per-use, no minimums |
| @runwayml/sdk | ^1.x | Runway video generation (Gen-4 Turbo, Gen-4.5) | Official SDK, includes task polling helpers |
| sharp | ^0.34.x | Image processing (resize, format convert, compress) | Fastest Node.js image processor, uses libvips |
| yaml | ^2.8.x | Voice profile YAML read/write | Already in project dependencies |
| zod | ^4.x | Schema validation for voice profiles, configs | Already in project dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| diff | ^7.x | Word-level diff for edit distance tracking | Calibration: computing edit patterns between original and user-edited drafts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fal.ai for Ideogram | Ideogram direct API | Direct API has 1M images/month minimum; fal.ai has no minimum, same $0.06/image |
| fal.ai for Kling | Kling direct API | Direct API requires 90-day prepaid packages; fal.ai is pay-per-use at ~$0.07-0.14/sec |
| diff (npm) | Custom Levenshtein | diff gives word-level alignment, not just distance number. More useful for pattern detection |
| together.ai for Ideogram | fal.ai for Ideogram | Together.ai doesn't have Ideogram 3.0 on serverless API (requires dedicated endpoint) |

**Installation:**
```bash
pnpm add openai @fal-ai/client @runwayml/sdk sharp diff
pnpm add -D @types/diff
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── voice/
│   ├── interview.ts           # Adaptive interview engine
│   ├── import.ts              # Content import (X history, blogs, text)
│   ├── profile.ts             # Voice profile YAML read/write/validate
│   ├── calibration.ts         # Edit tracking, confidence scoring
│   └── types.ts               # Voice profile types, interview state
├── content/
│   ├── generate.ts            # Post generation orchestrator (content brain)
│   ├── format-picker.ts       # Smart format selection per platform
│   ├── topic-suggest.ts       # Topic suggestions from pillars
│   └── drafts.ts              # Draft lifecycle (save, prune, list)
├── media/
│   ├── image-gen.ts           # Image generation abstraction layer
│   ├── video-gen.ts           # Video generation abstraction layer
│   ├── providers/
│   │   ├── gpt-image.ts       # GPT Image provider (OpenAI SDK)
│   │   ├── ideogram.ts        # Ideogram 3 provider (direct API or fal.ai)
│   │   ├── flux.ts            # Flux 2 provider (fal.ai)
│   │   ├── kling.ts           # Kling provider (fal.ai)
│   │   ├── runway.ts          # Runway provider (official SDK)
│   │   └── pika.ts            # Pika provider (fal.ai)
│   ├── processor.ts           # sharp-based image/video processing
│   └── platform-specs.ts      # Platform media requirements (dimensions, formats, sizes)
├── cli/
│   ├── voice-interview.ts     # CLI entry for /psn:setup voice
│   └── voice-config.ts        # CLI entry for /psn:config voice
content/
├── drafts/                    # Generated post drafts (auto-pruned)
├── media/                     # Generated media files (auto-pruned)
└── voice/
    └── personal.yaml          # Voice profile (git-tracked)
```

### Pattern 1: Media Provider Abstraction
**What:** Unified interface for all image/video generation providers
**When to use:** Every media generation call goes through this
**Example:**
```typescript
// src/media/image-gen.ts
interface ImageProvider {
  name: string;
  generate(prompt: string, options: ImageGenOptions): Promise<GeneratedImage>;
  strengths: string[]; // e.g., ["text-rendering", "typography"]
}

interface ImageGenOptions {
  aspectRatio?: string;
  style?: string;
  negativePrompt?: string;
  size?: { width: number; height: number };
}

interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  provider: string;
  cost: number;
}

// Claude picks provider based on content analysis
function selectImageProvider(
  contentType: string,
  userPreference?: string
): ImageProvider {
  // Text overlay needed -> Ideogram 3
  // Photorealistic -> Flux 2
  // General/versatile -> GPT Image
  // User override respected unless clearly wrong
}
```

### Pattern 2: Voice Profile Schema
**What:** Typed YAML schema for voice profiles
**When to use:** All voice profile operations
**Example:**
```typescript
// src/voice/types.ts
interface VoiceProfile {
  version: string;  // schema version for migrations
  createdAt: string;
  updatedAt: string;
  calibration: {
    status: "uncalibrated" | "calibrating" | "calibrated";
    confidence: number;  // 0-1
    postsReviewed: number;
    avgEditDistance: number;
  };
  identity: {
    pillars: string[];  // 3-5 content pillars
    boundaries: {
      avoid: string[];  // topics/tones to never use
      cautious: string[];  // topics that need careful handling
    };
    referenceVoices: Array<{
      name: string;
      platform: string;
      whatToEmulate: string;
    }>;
  };
  style: {
    // Language-agnostic traits
    formality: number;  // 1-10 scale
    humor: number;
    technicalDepth: number;
    storytelling: number;
    controversy: number;
  };
  languages: {
    en?: LanguageVoice;
    es?: LanguageVoice;
  };
  platforms: {
    x?: PlatformPersona;
    linkedin?: PlatformPersona;
    instagram?: PlatformPersona;
    tiktok?: PlatformPersona;
  };
}

interface LanguageVoice {
  vocabulary: string[];       // characteristic words/phrases
  sentencePatterns: string[]; // e.g., "short punchy sentences", "rhetorical questions"
  openingStyles: string[];    // how they start posts
  closingStyles: string[];    // how they end posts
  idioms: string[];           // language-specific expressions
}

interface PlatformPersona {
  tone: string;        // e.g., "casual-professional"
  formatPreferences: string[];  // e.g., ["threads", "short-takes"]
  hashtagStyle: string;  // e.g., "minimal", "strategic", "none"
  emojiUsage: string;    // e.g., "rare", "moderate", "heavy"
}
```

### Pattern 3: Draft Lifecycle
**What:** File-based draft storage with metadata and auto-pruning
**When to use:** Every generated post
**Example:**
```typescript
// content/drafts/{postId}.md - draft file format
// YAML frontmatter + content body
`---
id: uuid
platform: x
persona: personal
language: en
format: thread
createdAt: 2026-02-19T10:00:00Z
status: draft | approved | published
publishedAt: null
editHistory:
  - timestamp: 2026-02-19T10:05:00Z
    editDistance: 0.12
    type: tone-adjustment
---
[post content here]
`
```

### Anti-Patterns to Avoid
- **Monolithic generation function:** Don't put voice loading + format picking + content generation + media generation in one function. Each is a distinct concern.
- **Provider-specific code in orchestrator:** The content brain should call `imageGen.generate()` not `openai.images.generate()` directly.
- **Storing voice profiles in DB:** Voice profiles are git-tracked YAML files per architecture decision. DB stores metadata (calibration scores, edit history) but not the profile itself.
- **Auto-posting generated media:** Every generated image/video MUST be shown to user for approval first (locked decision).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image resizing/format conversion | Custom canvas/buffer manipulation | sharp | Handles EXIF rotation, color profiles, ICC, memory-efficient streaming |
| Text diffing for calibration | Character-by-character Levenshtein | diff (npm) | Word-level alignment gives edit patterns, not just a number |
| YAML parsing/serialization | Manual string manipulation | yaml (npm, already installed) | Preserves comments, handles edge cases, supports schema |
| Schema validation | Manual type checks | zod (already installed) | Composable, TypeScript-inferred types, clear error messages |
| OpenAI API calls | Raw fetch to OpenAI | openai SDK | Handles streaming, retry, rate limits, TypeScript types |
| fal.ai API calls | Raw fetch to fal.ai | @fal-ai/client | Queue management, polling, auth, TypeScript types |
| Runway API calls | Raw fetch to Runway | @runwayml/sdk | Task polling helpers, TypeScript types |

**Key insight:** Media generation APIs have complex async patterns (queue submission, polling, timeout handling). SDKs handle these correctly; hand-rolling them invites subtle bugs.

## Common Pitfalls

### Pitfall 1: Voice Profile Overfitting
**What goes wrong:** Interview captures too-specific patterns from a small sample. Generated posts sound like parrots, not the person.
**Why it happens:** Treating 5-10 imported posts as ground truth instead of signal.
**How to avoid:** Use imported content to establish ranges/tendencies, not exact templates. Weight recent content higher. Include "variety" parameters in the profile.
**Warning signs:** All generated posts start the same way, use the same sentence structure.

### Pitfall 2: Media Generation Timeout
**What goes wrong:** Video generation takes 2-5 minutes. If the calling process doesn't handle async properly, it times out or blocks.
**Why it happens:** Video APIs are queue-based, not synchronous. Even "fast" models take 30-60 seconds.
**How to avoid:** Use SDK polling helpers (Runway's `.waitForTaskOutput()`, fal.ai's `subscribe()`). Set reasonable timeouts. Show progress to user.
**Warning signs:** CLI appears frozen during generation.

### Pitfall 3: Image Size Rejection
**What goes wrong:** Generated images get rejected by platform API because they exceed size limits or wrong aspect ratio.
**Why it happens:** Each platform has different requirements. X allows 5MB JPEG but Instagram wants specific aspect ratios.
**How to avoid:** Always process through sharp before upload. Define platform specs as a lookup table. Validate before saving.
**Warning signs:** Posts fail at publish time with cryptic platform API errors.

### Pitfall 4: Ideogram API Access Barrier
**What goes wrong:** Ideogram direct API requires 1M images/month minimum usage commitment.
**Why it happens:** Ideogram's API is enterprise-focused. Low-volume users are not the target.
**How to avoid:** Use fal.ai as proxy (`fal-ai/ideogram/v3`) for pay-per-use access. Same model, no minimums. Or use direct API if user has an API key (support both paths).
**Warning signs:** User gets a "contact sales" response when trying to get API key.

### Pitfall 5: YAML Profile Corruption
**What goes wrong:** Partial write during profile update leaves YAML in invalid state.
**Why it happens:** Node.js write isn't atomic by default.
**How to avoid:** Write to temp file first, then atomic rename. The `yaml` package handles serialization; file atomicity is on us.
**Warning signs:** Claude validation fails on next profile load with parse errors.

### Pitfall 6: Edit Distance Miscalculation for Threads
**What goes wrong:** Edit distance is calculated on raw text including thread markers, giving inflated scores.
**Why it happens:** Thread content is stored as JSON string array. Comparing JSON strings instead of content.
**How to avoid:** Normalize content before diffing: strip thread markers, join tweets, compare actual text.
**Warning signs:** Thread posts always show high edit distance even with minor changes.

## Code Examples

### GPT Image Generation
```typescript
// Source: https://platform.openai.com/docs/api-reference/images
import OpenAI from "openai";

const openai = new OpenAI(); // uses OPENAI_API_KEY env var

const result = await openai.images.generate({
  model: "gpt-image-1",
  prompt: "A professional LinkedIn header showing...",
  size: "1024x1024",
  n: 1,
});

const imageBase64 = result.data[0].b64_json;
const imageBuffer = Buffer.from(imageBase64, "base64");
// Process with sharp before saving
```

### Flux 2 via fal.ai
```typescript
// Source: https://fal.ai/models/fal-ai/flux-2-pro
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const result = await fal.subscribe("fal-ai/flux-2-pro", {
  input: {
    prompt: "Photorealistic product shot of...",
    image_size: "landscape_4_3",
    output_format: "jpeg",
  },
});

// result.data.images[0].url -> download and process
```

### Ideogram 3 via fal.ai
```typescript
// Source: https://fal.ai/models/fal-ai/ideogram/v3/api
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const result = await fal.subscribe("fal-ai/ideogram/v3", {
  input: {
    prompt: "Infographic showing top 5 AI trends with text labels...",
    aspect_ratio: "1:1",
    rendering_speed: "DEFAULT",
    magic_prompt: "AUTO",
    style_type: "DESIGN",
  },
});
```

### Ideogram 3 Direct API (alternative)
```typescript
// Source: https://developer.ideogram.ai/api-reference/api-reference/generate-v3
const response = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
  method: "POST",
  headers: {
    "Api-Key": process.env.IDEOGRAM_API_KEY!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Bold typography poster saying 'SHIP IT'...",
    aspect_ratio: "1x1",
    rendering_speed: "DEFAULT",
    magic_prompt: "AUTO",
    num_images: 1,
  }),
});

const data = await response.json();
// data.data[0].url -> download and process
```

### Kling Video via fal.ai
```typescript
// Source: https://fal.ai/models/fal-ai/kling-video/v2.6/pro/text-to-video/api
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/kling-video/v2.6/pro/text-to-video", {
  input: {
    prompt: "Product demo showing a coffee mug rotating...",
    duration: 5,
    aspect_ratio: "16:9",
    generate_audio: false,
    cfg_scale: 0.5,
  },
});

// result.data.video.url -> download
```

### Runway Video Generation
```typescript
// Source: https://docs.dev.runwayml.com/api/
import RunwayML from "@runwayml/sdk";

const client = new RunwayML(); // uses RUNWAYML_API_SECRET env var

// Image-to-video
const task = await client.imageToVideo
  .create({
    model: "gen4_turbo",
    promptImage: "https://example.com/scene.jpg",
    promptText: "Slow camera pan across the landscape",
    duration: 5,
  })
  .waitForTaskOutput();

// task.output[0] -> video URL
```

### Pika via fal.ai
```typescript
// Source: https://blog.fal.ai/pika-api-is-now-powered-by-fal/
import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/pika/v2.2/text-to-video", {
  input: {
    prompt: "Animated text quote appearing letter by letter...",
    duration: 4,
    aspect_ratio: "9:16",
  },
});
```

### Sharp Image Processing
```typescript
// Source: https://sharp.pixelplumbing.com/
import sharp from "sharp";

// Resize and convert for X (max 5MB, JPEG)
const processed = await sharp(inputBuffer)
  .resize(1200, 675, { fit: "cover" })  // 16:9 for X
  .jpeg({ quality: 85 })
  .toBuffer();

// Get metadata for validation
const metadata = await sharp(inputBuffer).metadata();
console.log(metadata.width, metadata.height, metadata.format);
```

### Voice Profile Read/Write
```typescript
// Source: yaml npm package (already installed)
import { parse, stringify } from "yaml";
import { readFile, writeFile, rename } from "fs/promises";

async function loadVoiceProfile(path: string): Promise<VoiceProfile> {
  const raw = await readFile(path, "utf-8");
  const parsed = parse(raw);
  return voiceProfileSchema.parse(parsed); // zod validation
}

async function saveVoiceProfile(path: string, profile: VoiceProfile): Promise<void> {
  const content = stringify(profile);
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, content, "utf-8");
  await rename(tmpPath, path); // atomic rename
}
```

### X Post History Import
```typescript
// Source: https://developer.x.com/en/docs/x-api/tweets/timelines/api-reference/get-users-id-tweets
// Uses existing X client from src/platforms/x/client.ts pattern
async function importXHistory(userId: string, accessToken: string): Promise<ImportedContent[]> {
  const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
  url.searchParams.set("max_results", "100");
  url.searchParams.set("tweet.fields", "created_at,public_metrics,text");
  url.searchParams.set("exclude", "retweets,replies");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  // Filter for original content, analyze patterns
  return data.data.map(tweet => ({
    text: tweet.text,
    platform: "x",
    engagementSignals: tweet.public_metrics,
    createdAt: tweet.created_at,
  }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DALL-E 3 for image gen | GPT Image 1 / 1.5 | April 2025 | Better text rendering, editing, versatility |
| Stable Diffusion for photorealism | Flux 2 Pro | Nov 2025 | 4MP resolution, multi-reference, HEX color control |
| Ideogram 2 | Ideogram 3.0 | March 2025 | ~95% text accuracy, style references, character consistency |
| Runway Gen-3 | Runway Gen-4.5 | Nov 2025 | Cinematic quality, consistent characters across scenes |
| Kling 1.x | Kling 2.6 | Dec 2025 | Simultaneous audio-visual generation in single pass |
| Pika 1.x | Pika 2.2 via fal.ai | Dec 2025 | Better quality, accessible via fal.ai pay-per-use |
| Manual video post-processing | Platform-native specs | Ongoing | Each platform has distinct optimal formats |

**Deprecated/outdated:**
- DALL-E 3: Superseded by GPT Image models (1, 1-mini, 1.5)
- Runway Gen-3a: Still available but Gen-4 Turbo is faster/better
- Kling direct API pre-paid packages: fal.ai proxy removes this friction

## Platform Media Specifications

| Platform | Image Max Size | Image Formats | Recommended Aspect Ratios | Video Max Length | Video Format |
|----------|---------------|---------------|---------------------------|-----------------|-------------|
| X | 5MB | JPEG, PNG, GIF, WebP | 16:9 (1200x675), 1:1 (1080x1080) | 2min 20sec (optimal: <15s) | MP4 (H.264) |
| LinkedIn | 10MB | JPEG, PNG | 1.91:1 (1200x627), 1:1 (1080x1080), 4:5 (1080x1350) | 10min (optimal: 30-90s) | MP4 |
| Instagram | 8MB | JPEG | 1:1 (1080x1080), 4:5 (1080x1350), 9:16 (1080x1920) | 90s Reels (optimal: 15-30s) | MP4 |
| TikTok | 10MB | JPEG, PNG | 9:16 (1080x1920) | 10min (optimal: 60s+) | MP4 |

## Pricing Reference

### Image Generation
| Provider | Model | Cost per Image | Speed |
|----------|-------|---------------|-------|
| OpenAI | gpt-image-1 (1024x1024 medium) | ~$0.07 | ~5-10s |
| OpenAI | gpt-image-1-mini (1024x1024) | ~$0.014 | ~3-5s |
| fal.ai | Flux 2 Pro (1MP) | ~$0.03 | ~5-8s |
| fal.ai | Flux 2 Dev Turbo (1MP) | ~$0.008 | ~3s |
| fal.ai / Direct | Ideogram 3.0 | ~$0.06 | ~5-10s |

### Video Generation
| Provider | Model | Cost | Duration |
|----------|-------|------|----------|
| fal.ai | Kling 2.6 Pro (5s, no audio) | ~$0.35 | ~60-120s |
| fal.ai | Kling 2.6 Pro (5s, with audio) | ~$0.70 | ~60-120s |
| Runway | Gen-4 Turbo (5s) | ~$0.50 | ~30-60s |
| fal.ai | Pika 2.2 (4s) | ~$0.30 | ~30-60s |

## Open Questions

1. **Ideogram API access path**
   - What we know: Direct API has 1M/month minimum. fal.ai offers `fal-ai/ideogram/v3` with no minimum.
   - What's unclear: Whether fal.ai Ideogram quality/features are identical to direct API.
   - Recommendation: Default to fal.ai. Support direct API as optional path for users who have enterprise access.

2. **Video post-processing**
   - What we know: sharp handles images well. Videos may need ffmpeg for format conversion, trimming, resolution adjustment.
   - What's unclear: Whether generated videos from these APIs always meet platform specs natively.
   - Recommendation: Start without ffmpeg. If generated videos consistently need post-processing, add fluent-ffmpeg as a dependency later.

3. **Calibration convergence threshold**
   - What we know: Need to track edit distance over N posts.
   - What's unclear: What edit distance threshold indicates calibration. This is domain-specific and per-user.
   - Recommendation: Start with 0.15 (15% edit distance) as "low edits" threshold, converge after 10 consecutive posts below threshold. Make configurable.

## Sources

### Primary (HIGH confidence)
- OpenAI API docs - image generation with gpt-image-1, Node.js SDK examples
- fal.ai model pages - Flux 2 Pro, Kling 2.6, Pika 2.2, Ideogram V3 endpoints and pricing
- Runway API docs - Gen-4 Turbo, @runwayml/sdk, image-to-video and text-to-video endpoints
- Ideogram developer docs - V3 generate endpoint, authentication, parameters
- sharp npm - image processing API, resize, format conversion
- X API docs - GET /2/users/:id/tweets for user timeline

### Secondary (MEDIUM confidence)
- Platform media specifications - compiled from multiple sources, may have minor variations
- Pricing data - verified from official sources but subject to change
- Video generation timings - approximate based on documentation and reviews

### Tertiary (LOW confidence)
- Pika API via fal.ai exact endpoint path - `fal-ai/pika/v2.2/text-to-video` needs verification at implementation time
- Kling 2.6 exact fal.ai feature parity with direct API - assumed same based on fal.ai blog post

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs/APIs
- Architecture: HIGH - Patterns derived from existing codebase patterns + API capabilities
- Image generation: HIGH - All three providers well-documented with clear API examples
- Video generation: MEDIUM - APIs confirmed but exact integration patterns need runtime validation
- Voice profiling: MEDIUM - Design patterns clear but interview flow is custom domain logic
- Pitfalls: MEDIUM - Based on API documentation and common integration patterns

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days - APIs are relatively stable)
