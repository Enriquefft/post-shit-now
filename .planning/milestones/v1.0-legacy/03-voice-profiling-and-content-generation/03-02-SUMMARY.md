---
phase: 03-voice-profiling-and-content-generation
plan: 02
subsystem: media
tags: [sharp, openai, fal-ai, ideogram, flux, image-generation, gpt-image]

# Dependency graph
requires:
  - phase: 01-foundation-infrastructure
    provides: "Core types (Platform), env utilities"
provides:
  - "Three image providers (GPT Image, Ideogram 3, Flux 2) behind unified ImageProvider interface"
  - "Smart provider selection based on content hints"
  - "Platform-specific image processing (resize, format, compression)"
  - "Platform media specifications for all 4 platforms"
affects: [03-voice-profiling-and-content-generation, 05-intelligence-ideation-and-planning]

# Tech tracking
tech-stack:
  added: [sharp, openai, "@fal-ai/client"]
  patterns: [provider-interface-pattern, content-hint-selection, platform-spec-lookup]

key-files:
  created:
    - src/media/platform-specs.ts
    - src/media/processor.ts
    - src/media/processor.test.ts
    - src/media/image-gen.ts
    - src/media/providers/gpt-image.ts
    - src/media/providers/ideogram.ts
    - src/media/providers/flux.ts
  modified: []

key-decisions:
  - "fal.ai as primary path for Ideogram and Flux (no minimum usage requirement)"
  - "GPT Image as default/versatile provider, Ideogram for text-heavy, Flux for photorealism"
  - "Content hint keyword matching for auto-selection (not ML-based)"
  - "Instagram always converted to JPEG; other platforms prefer JPEG for smaller sizes"
  - "Iterative quality reduction (start 85, step -10) for size enforcement"

patterns-established:
  - "ImageProvider interface: name, strengths[], generate() for all image providers"
  - "Platform spec lookup tables: PLATFORM_IMAGE_SPECS, PLATFORM_VIDEO_SPECS"
  - "processImageForPlatform: sharp pipeline for resize, format, compression per platform"

requirements-completed: [IMG-01, IMG-02, IMG-03, IMG-04, IMG-05]

# Metrics
duration: 5min
completed: 2026-02-19
---

# Phase 3 Plan 2: Image Generation Summary

**Three image providers (GPT Image, Ideogram 3, Flux 2) behind unified interface with smart content-based auto-selection and sharp platform processing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-19T07:10:00Z
- **Completed:** 2026-02-19T07:15:00Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Platform media specs covering all 4 platforms (X, LinkedIn, Instagram, TikTok) for both images and video
- Sharp-based image processor with resize, format conversion (Instagram JPEG enforcement), and iterative quality compression
- Three image providers: GPT Image (OpenAI SDK), Ideogram 3 (fal.ai primary / direct API fallback), Flux 2 (fal.ai)
- Smart provider selection: Ideogram for text/typography, Flux for photorealism, GPT Image as versatile default
- 16 tests covering processor resize, format conversion, metadata, and size limit enforcement

## Task Commits

Both tasks were committed together:

1. **Task 1: Platform specs, image processor, and provider interface** - `afc6021` (feat)
2. **Task 2: Image providers and generation orchestrator** - `afc6021` (feat)

## Files Created/Modified
- `src/media/platform-specs.ts` - Platform image and video specs (dimensions, formats, size limits) for all 4 platforms
- `src/media/processor.ts` - Sharp-based image processing: resize, format conversion, iterative quality compression
- `src/media/processor.test.ts` - 16 tests for processor functions using sharp-generated test images
- `src/media/image-gen.ts` - ImageProvider interface, provider registry, content-hint selection, generateImage orchestrator
- `src/media/providers/gpt-image.ts` - GPT Image provider using OpenAI SDK with gpt-image-1 model
- `src/media/providers/ideogram.ts` - Ideogram 3 provider via fal.ai (primary) or direct API (fallback)
- `src/media/providers/flux.ts` - Flux 2 provider via fal.ai with flux-2-pro model

## Decisions Made
- fal.ai as primary path for Ideogram and Flux: no minimum usage requirement, unlike direct Ideogram API
- GPT Image as default provider: most versatile for general content when no content hints match
- Content hint keyword sets for provider selection: simple Set-based matching over ML classification
- Instagram always JPEG: platform requirement enforced at processor level
- Iterative quality reduction for size enforcement: start at 85, step down by 10 until under limit or throw at 10

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
Users need the following API keys in their environment:
- `OPENAI_API_KEY` - For GPT Image generation
- `FAL_KEY` - For Ideogram 3 and Flux 2 via fal.ai (recommended path)
- `IDEOGRAM_API_KEY` (optional) - For direct Ideogram API as fallback

## Next Phase Readiness
- Image generation subsystem complete, ready for use by content brain (03-05)
- Video generation (03-03) follows the same provider interface pattern
- Platform specs shared between image and video processing

## Self-Check: PASSED

All 7 created files verified present. Commit afc6021 verified in git log.

---
*Phase: 03-voice-profiling-and-content-generation*
*Completed: 2026-02-19*
