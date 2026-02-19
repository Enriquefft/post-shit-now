---
description: Proactive engagement sessions with triage-then-draft flow
---

# /psn:engage -- Proactive engagement sessions with triage-then-draft flow

## What this does
Runs a guided engagement session: discover trending content in your niche, triage opportunities, draft voice-matched replies, and post with human approval on every reply. After the session, bridges to content creation by capturing ideas sparked by conversations.

Target session time: ~15 minutes.

## Arguments
$ARGUMENTS

## Flow

### 1. Load engagement session
```
bun run src/cli/engage.ts session
```

This returns pending opportunities (score >= 60), sorted by composite score, with remaining daily caps per platform.

If no opportunities are found, suggest running `/psn:engage-setup` to configure niche keywords, or note that the engagement monitor may not have run recently.

Show remaining daily caps per platform at the top:
> **Daily caps:** X: 15/20 remaining | LinkedIn: 8/10 | Instagram: 12/15 | TikTok: 9/10

### 2. Pass 1: Triage (batch yes/no/skip)
Present opportunities in summary form, batches of 10-20:

For each opportunity, show:
- Platform badge (X/LI/IG/TT)
- Post snippet (first 50 chars)
- Author handle and follower tier
- Composite score
- Suggested engagement type (reply/quote/duet/stitch/comment)

Example presentation:
> **1.** [X] @techleader (10K+) -- "The future of AI agents is..." -- Score: 82 -- Suggested: Reply
> **2.** [LI] @ceoname (50K+) -- "Three lessons from scaling..." -- Score: 76 -- Suggested: Comment
> **3.** [TT] @creator (100K+) -- "Watch what happens when..." -- Score: 71 -- Suggested: Duet

Ask the user for quick decisions on each: yes/no/skip.
Accept flexible input: "1,2,5 yes / 3,4 no / rest skip" or individual responses.

### 3. Submit triage decisions
```
bun run src/cli/engage.ts triage --decisions '[{"id":"uuid","decision":"yes"},...]'
```

This triages opportunities and returns drafts for approved ones.

### 4. Pass 2: Draft and review (one by one)
For each approved opportunity (typically 3-5):

Present the original post context, then 2-3 reply options:

> **Original post by @techleader on X:**
> "The future of AI agents is not about replacing humans..."
>
> **Option A (Direct):** [concise reply]
> **Option B (Conversational):** [expanded reply]
> **Option C (Unique angle):** [question/perspective]

The draft context blocks from the CLI contain voice profile details. Use them to generate the actual reply text. Write in the user's voice using the context as your guide.

**IMPORTANT: Never auto-post. Every reply requires the user to explicitly approve.**

User options for each:
- **Pick an option** (A/B/C) and approve as-is
- **Edit** an option before approving
- **Regenerate** with different approach
- **Skip** this opportunity

### 5. Execute approved engagements
```
bun run src/cli/engage.ts execute --engagements '[{"opportunityId":"uuid","content":"...","type":"reply","platform":"x"},...]'
```

Show results:
> Posted reply to @techleader on X
> Posted comment on @ceoname's LinkedIn post
> Skipped @creator (TikTok daily cap reached)

### 6. Post-session content bridge (ENGAGE-07)
After executing engagements, ask:

> "Any of these conversations spark a post idea? Here are some angles I noticed:"
> - Expand your take on AI agents into a full thread
> - Turn the scaling lessons discussion into a LinkedIn carousel
>
> Want to capture any of these? (Or share your own idea)

If the user wants to capture an idea, use the `/psn:capture` flow:
```
bun run src/cli/capture.ts capture "idea text #pillar:ai #platform:x"
```

### 7. Session summary
Show engagement stats for the session:
- Total engagements posted
- Platforms used
- Opportunities triaged (yes/no/skip counts)
- Ideas captured (if any)
- Tip: "Run `/psn:engage` again anytime to find new opportunities"

## Other subcommands

### View engagement stats
```
bun run src/cli/engage.ts stats --period week
```
Show engagement summary: total, by platform, by type, top performer.

### View engagement history
```
bun run src/cli/engage.ts history --limit 10
```
Show recent engagement entries with outcomes.

## Important notes
- **NEVER auto-post.** Every single reply, comment, quote post, and repost requires explicit human approval. This is non-negotiable (ENGAGE-05).
- Daily caps and cooldowns are enforced automatically -- if a cap is reached, the engagement is skipped with a clear message.
- Voice matching: replies adapt to the thread's tone (formal/casual/technical/humorous) while keeping the user's voice recognizable.
- The CLI outputs JSON -- parse it and present results conversationally.
- If the user seems rushed, offer to triage only the top 5 opportunities instead of all.
- Blocked authors are automatically filtered out -- never shown in triage.
