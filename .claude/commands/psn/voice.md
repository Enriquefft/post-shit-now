---
description: Voice profile management — interview, calibration, and tweaks
---

# /psn:voice — Voice profile management

## What this does
Manages your voice profile — the foundation that makes AI-generated posts sound like you, not generic AI. Covers the full lifecycle: interview, content import, editing, calibration, and recalibration.

## Arguments
$ARGUMENTS

## Sub-commands

Parse $ARGUMENTS to determine which workflow to run. If no arguments provided, show the profile status overview.

---

### /psn:voice (no args) — Profile status

Show the current voice profile status:

```
bun run src/voice/profile.ts validate
```

If a profile exists, display:
- **Calibration status:** uncalibrated / calibrating / calibrated
- **Confidence score:** percentage
- **Content pillars:** list of pillars
- **Style traits:** formality, humor, technical depth, storytelling, controversy (as X/10)
- **Active platforms:** which platforms have personas configured
- **Languages:** which languages are configured
- **Posts reviewed:** how many posts have been through calibration

Also list all available profiles:
```
bun run src/voice/calibration.ts list-profiles
```

Show each profile with its type (personal, brand-operator, brand-ambassador) and path.

If no profile exists, suggest: "Run `/psn:voice interview` to create your voice profile."

---

### /psn:voice interview — Full voice interview

Run a guided voice interview to create or update your voice profile. This should feel like a conversation with a social media strategist, not a form to fill out.

**Start the interview:**
```
bun run src/cli/voice-interview.ts start
```

This returns the interview state and initial questions.

**Interview flow:**
1. Present questions one at a time, conversationally
2. Adapt based on answers — the interview engine detects experience level and branches accordingly
3. After each answer, submit it:
   ```
   bun run src/cli/voice-interview.ts submit --question-id {id} --answer "{answer}"
   ```
4. Get the next question(s) based on the answer
5. The user can stop anytime — whatever has been captured so far becomes their profile
6. Blank-slate users (never posted before) get starter archetypes to choose from

**When the interview is complete (or user stops):**
```
bun run src/cli/voice-interview.ts complete --profile-path content/voice/personal.yaml
```

This saves the voice profile and optionally generates a strategy.yaml.

Show the user:
- A summary of their voice profile
- Calibration status (will be "uncalibrated" for new profiles)
- Suggestion to import existing content for faster calibration
- Suggestion to create a test post with `/psn:post`

---

### /psn:voice import — Import existing content

Import content from various sources to enrich the voice profile and accelerate calibration.

**Ask the user which sources they want to import from:**
1. **X post history** — Uses existing OAuth token
2. **Blog/website URLs** — Scrape and analyze
3. **Raw text** — Paste directly

**For X history:**
```
bun run src/cli/voice-interview.ts import --x
```

**For blog URLs:**
```
bun run src/cli/voice-interview.ts import https://example.com/blog1 https://example.com/blog2
```

**For raw text:**
Ask the user to paste their content samples. Save to a temp file and run:
```
bun run src/cli/voice-interview.ts import --raw "{text}"
```

**After import:**
Show the analysis results:
- Number of samples imported
- Detected tone (formal / casual / balanced)
- Common patterns found
- Vocabulary fingerprint (distinctive words)
- Topic clusters

Ask if the user wants to update their voice profile with the imported patterns. If yes, the analysis is merged into the existing profile.

---

### /psn:voice edit — Guided profile editing

Walk through the voice profile section by section, allowing targeted edits.

**Load the profile:**
```
bun run src/voice/profile.ts validate
```

**For each section, show current values and ask if the user wants to change:**

1. **Identity**
   - Content pillars (topics to be known for)
   - Boundaries (avoid topics, cautious topics)
   - Reference voices (accounts they admire)

2. **Style traits**
   - Formality (1-10)
   - Humor (1-10)
   - Technical depth (1-10)
   - Storytelling (1-10)
   - Controversy tolerance (1-10)

3. **Platform personas**
   - For each configured platform: tone, format preferences, hashtag style, emoji usage
   - Option to add new platform personas

4. **Language settings**
   - For each configured language: vocabulary, sentence patterns, opening/closing styles, idioms
   - Option to add Spanish (es) if only English configured, or vice versa

The user can skip any section. After changes, validate and save atomically.

**Quick tweaks shortcut:** For single-field changes, suggest `/psn:voice tweak` instead:
```
Examples: "add pillar AI", "formality 8", "ban slang", "tone-x casual"
```

---

### /psn:voice calibrate — Calibration report

Show the current calibration analysis:

```
bun run src/voice/calibration.ts report --profile-path content/voice/personal.yaml
```

Display:
- **Posts reviewed:** total count
- **Average edit distance:** how much the user typically changes generated content
- **Edit distance trend:** improving / stable / worsening
- **Top edit patterns:** what types of edits the user makes most (tone, word choice, structure, length)
- **Confidence score:** overall calibration confidence
- **Calibration status:** uncalibrated / calibrating / calibrated

**Recommendations based on status:**
- **Uncalibrated:** "Generate and review a few posts to start calibration. Use `/psn:post` to create your first voice-matched post."
- **Calibrating + improving:** "Looking good! Your edits are decreasing. Keep reviewing posts."
- **Calibrating + worsening:** "Consider running `/psn:voice tweak` to adjust specific traits, or `/psn:voice recalibrate` for a full refresh."
- **Calibrated:** "Your voice profile is well-calibrated. Posts should closely match your style."

---

### /psn:voice recalibrate — Full recalibration (VOICE-10)

Re-run the voice interview while preserving existing data:

```
bun run src/cli/voice-interview.ts start --recalibrate
```

This starts the interview with the existing profile loaded, so previous answers serve as defaults. The user only needs to update what's changed.

**After recalibration:**
- Save updated profile
- Optionally re-import content from sources
- Reset calibration tracking (posts reviewed, edit history)
- Show new profile summary vs. previous

---

### /psn:voice tweak — Quick config tweaks (VOICE-09, CONFIG-03)

Apply quick tweaks without running a full interview or edit flow.

**Parse tweak arguments from $ARGUMENTS.** Supported formats:

| Command | Example | What it does |
|---------|---------|--------------|
| `add-banned:{word}` | `add-banned:slang` | Add word to avoid list |
| `remove-banned:{word}` | `remove-banned:buzzword` | Remove from avoid list |
| `formality:{1-10}` | `formality:8` | Set formality level |
| `humor:{1-10}` | `humor:3` | Set humor level |
| `add-pillar:{topic}` | `add-pillar:AI` | Add content pillar |
| `remove-pillar:{topic}` | `remove-pillar:crypto` | Remove content pillar |
| `tone-{platform}:{tone}` | `tone-x:casual` | Set platform tone |

Run the tweaks:
```
bun run src/cli/voice-config.ts apply "{tweak1}" "{tweak2}" ...
```

Show what changed and the updated profile summary.

**Examples:**
- `/psn:voice tweak formality:8 add-pillar:AI`
- `/psn:voice tweak add-banned:synergy remove-pillar:crypto`
- `/psn:voice tweak tone-linkedin:thought-leader`

---

## Brand profile management

### Create a brand-operator profile
For posting AS the company:
```
bun run src/voice/calibration.ts create-brand-operator --company "{name}" --tone "{tone}" --pillars "{p1},{p2}"
```

### Create a brand-ambassador profile
For posting as yourself but representing the company:
```
bun run src/voice/calibration.ts create-brand-ambassador --personal-profile content/voice/personal.yaml --company "{name}"
```

This clones your personal profile and applies company guardrails (max controversy, required topics, banned topics, tone override).

## Important notes
- Voice profiles are YAML files in `content/voice/` — they can always be edited directly
- The interview should feel like a conversation, never like a form
- Calibration is invisible to the user most of the time — they just notice posts getting better
- All changes are validated before saving to prevent profile corruption
- The CLI outputs JSON — parse it and present results conversationally
