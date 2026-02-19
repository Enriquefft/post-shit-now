---
description: Create and schedule voice-matched posts
---

# /psn:post — Create and schedule voice-matched posts

## What this does
Creates, schedules, and manages posts across platforms. Integrates voice profiling, AI content generation, format picking, media generation, edit tracking, and the full draft lifecycle.

Accepts anything from a single word ("AI agents") to a detailed brief with angle, tone, and format specified. Adapt to what the user provides.

## Arguments
$ARGUMENTS

## Flow

### 1. Check for recent failures
Run `bun run src/cli/post.ts failures` and show any failed posts. If there are failures, briefly mention them and ask if the user wants to retry any before creating a new post.

### 2. Voice profile check
Check if a voice profile exists by running:
```
bun run src/voice/profile.ts validate
```

- **No profile:** Suggest the user run `/psn:voice interview` first to create one. They can still proceed without one, but content won't be voice-matched.
- **Profile exists but uncalibrated:** Mention that calibration improves over time as they review and edit posts. Continue normally.
- **Profile calibrated:** Proceed silently — the system is working as intended.

### 3. Persona selection (POST-06)
Check for available voice profiles:
```
bun run src/voice/calibration.ts list-profiles
```

- **Single profile (personal):** Use it automatically — no need to ask.
- **Multiple profiles (personal + brand-operator, brand-ambassador):** Ask which persona to use for this post. Show available profiles with their type.
- Store the selected profile path for all subsequent steps.

### 3b. Language selection (POST-07)
Check the user's voice profile for language configuration.

If the profile has bilingual configured (both en and es in languages section):
- Ask: "What language for this post? (en / es / both)"
- If **"both"**: Suggest approach based on platform:
  - **X, TikTok:** "I'll create two separate posts -- one in English, one in Spanish"
  - **LinkedIn:** "Want two separate posts or one combined post with both languages?"
- User confirms approach
- Pass the selected language to all subsequent steps

If the profile is monolingual: use the default language silently, skip the prompt.

### 4. Topic gathering
If the user already provided a topic or content in $ARGUMENTS, use it directly.

**Due series check (SERIES-03):**
Before checking the idea bank, check for due series episodes:
```
bun run src/cli/series.ts due
```

- **Due episodes exist:** Present them first with series name, episode label, and format template:
  > "You have a series episode due: [Series Name] #[Episode]. Want to create this episode?"
  - If the user picks a series episode: use the series template, pillar, and format for generation. Pass seriesId to the draft.
  - If the user declines: proceed to normal flow below.
- **No due episodes:** Proceed silently.

If not using a series episode, check the idea bank:
```
bun run src/content/generate.ts check-ideas
```

- **Ready ideas exist:** Show them and let the user pick one, or provide their own.
- **No ready ideas:** Generate topic suggestions:
  ```
  bun run src/content/generate.ts suggest-topics --platform {platform} --count 3
  ```
  Present the 3 suggestions with their angles and suggested formats. The user can pick one, modify one, or provide their own topic entirely.

### 5. Format suggestion (POST-05)
Based on the topic and platform, suggest the best format:
```
bun run src/content/generate.ts pick-format --platform {platform} --topic "{topic}"
```

Present the recommended format with reasoning, plus alternatives. For example:
> **Recommended: Thread** — This topic has enough depth for a multi-part thread on X.
> Alternatives: Short post (condense to key insight), Image post (visual with key points)

The user can accept the recommendation or choose a different format.

### 6. Content generation
Build voice-matched context for generation:
```
bun run src/content/generate.ts build-context --platform {platform} --persona {persona} --language {language}
```

This returns the voice context (style traits, platform persona, language patterns, boundaries, reference voices, calibration status). Use this context to generate the actual post content.

**Generation rules:**
- Write in the user's voice using the voice context as your guide
- Respect all boundaries (avoid topics, cautious topics)
- Match the platform persona (tone, hashtag style, emoji usage)
- Use language-specific vocabulary and patterns
- If the user requested multiple variations: generate N variations (default: 1 best draft)
- For threads: generate the full thread with tweet numbers
- For carousels: generate slide-by-slide content

### 7. Human review (POST-09)
Present the generated content inline for review.

If the format is visual (carousel, infographic, image post, quote-image):
- Generate a high-fidelity visual preview showing how it would look on the platform
- Use image generation to create the visual — do NOT just describe it

**User options:**
- **Approve:** Move to media generation / scheduling
- **Edit:** User provides edits. Track the edit silently:
  ```
  bun run src/voice/calibration.ts track-edit --post-id {draftId} --original "{original}" --edited "{edited}"
  ```
  This feeds calibration — the system learns from every edit to improve future posts.
- **Regenerate:** Generate a new version with the same or modified parameters
- **Change format:** Switch to a different format and regenerate

### 8. Media generation (if applicable)
After content is approved, ask if the user wants to add an image or video.

**IMPORTANT: Never auto-attach media. Always show generated media to the user for approval.**

If the user wants media:
1. Determine the best provider based on content:
   - Text-heavy content (quotes, data) -> Ideogram (best text rendering)
   - Photorealistic needs -> Flux
   - General/versatile -> GPT Image
   - Video -> Kling (realistic motion), Runway (cinematic), Pika (creative/stylized)

2. Generate the media:
   ```
   bun run src/media/image-gen.ts generate --prompt "{prompt}" --platform {platform}
   ```
   or for video:
   ```
   bun run src/media/video-gen.ts generate --prompt "{prompt}" --platform {platform} --duration {seconds}
   ```

3. Show the generated media to the user.

4. **User options:**
   - **Use this:** Attach to the post
   - **Regenerate:** Try again (max 3 attempts total)
   - **Use own media:** User provides their own file path
   - **Skip media:** Post without media

5. If image approved, process for platform compliance:
   ```
   bun run src/media/image-gen.ts process --path "{path}" --platform {platform}
   ```

### 9. Save draft
Save the finalized content as a draft:
```
bun run src/content/drafts.ts save --platform {platform} --format {format} --persona {persona} --language {language} --content "{content}"
```

Present the draft both inline (in conversation) AND saved to file. Show the draft path for reference.

### 10. Schedule or post now
Use the existing scheduling flow:

**Schedule:**
- Ask for date and time (interpret natural language like "tomorrow at 9am" into the user's configured timezone)
- Run: `bun run src/cli/post.ts schedule --post-id {UUID} --date {date} --time {time} --timezone {timezone}`
- Confirm: show post ID, scheduled time in user's timezone, and platform

**Post now:**
- Confirm with user: "Ready to post this immediately?"
- Run: `bun run src/cli/post.ts now --post-id {UUID}`
- Confirm: show post ID and that it's been queued for immediate publishing

**Thread handling for X:**
If the content is a thread on X:
- Run `bun run src/cli/post.ts create-thread --tweets '[...]' --platform x`
- Show the full thread preview with tweet numbers and character counts
- Get approval before scheduling/posting

### 11. Confirmation
Show the user:
- Post ID (for future reference)
- Platform and format used
- Voice persona used
- Calibration note (if applicable): "Edit tracked — calibration is learning your style"
- Status: scheduled/publishing
- If scheduled: when it will post (in user's timezone)
- Draft file location
- Tip: "Use `/psn:post` to create another or check on this post later"

### 12. Hub routing display
After saving a draft, determine which hub it routes to based on persona:
- **Personal / Brand-ambassador:** "This post will go to your Personal Hub"
- **Brand-operator:** "This post will go to the Company Hub (requires approval before publishing)"

Company posts get status "pending_approval". Personal posts proceed normally to scheduling.

---

## Semi-automated format flow

When the selected format is a semi-automated type (video-script, tiktok-stitch, reel-script with user recording):

1. Generate script + talking points as the draft content
2. Save the draft with status `awaiting-recording`
3. Tell the user:
   > Draft saved as awaiting-recording. Record your video using the script above, then run:
   > `/psn:post finish <draft-id> --media <path-to-recording>`
4. Do NOT proceed to scheduling -- the user needs to record first

### Finish subcommand

```
/psn:post finish <draft-id> --media <path>
```

Completes a semi-automated draft:
1. Run `bun run src/cli/post-finish.ts <draft-id> --media <path>`
2. This loads the awaiting-recording draft, verifies status, copies media, and updates to "approved"
3. Show the user the updated draft with attached media
4. Proceed with normal scheduling flow (step 10)

### Fatigue warnings

After generating a draft, check the response for `fatigueWarning`. If present, display prominently:

> **Topic cooling alert:** "Topic X has been cooling -- consider rotating to a different content pillar"
> The system suggests trying a different pillar. You can still proceed with this topic if you prefer.

Also when showing topic suggestions, fatigued topics appear at the bottom marked with "(cooling)".

## Management commands

### Cancel a scheduled post
`bun run src/cli/post.ts cancel --post-id UUID`

### Edit a scheduled post
`bun run src/cli/post.ts edit --post-id UUID --content "new content" --date 2026-03-16 --time 10:00 --timezone America/New_York`

### View recent failures
`bun run src/cli/post.ts failures`

### View drafts
`bun run src/content/drafts.ts list --status draft`
`bun run src/content/drafts.ts list --platform x`

### Prune old drafts
`bun run src/content/drafts.ts prune`

## Media attachments
If the user provides images or files directly:
- Pass file paths via --media flag (comma-separated): `--media "/path/to/image1.png,/path/to/image2.jpg"`
- X supports up to 4 images per tweet
- Media is uploaded automatically during publishing

## Important notes
- All times should be interpreted in the user's timezone (ask if not configured)
- Post IDs are UUIDs — show them to the user for reference
- Thread previews show character counts per tweet for transparency
- Failed posts preserve their content — they can be retried or edited
- The CLI outputs JSON — parse it and present results conversationally to the user
- This command should feel like a conversation, not a rigid form. Adapt to the user's style and pace.
- Bilingual support: if the user's profile has both English and Spanish, ask which language for this post (or both for cross-posting)
- Respect the voice profile boundaries at all times — never generate content that violates avoid topics
