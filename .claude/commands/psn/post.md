# /psn:post — Create and schedule posts

## What this does
Creates, schedules, and manages posts for X (Twitter). Handles single tweets, threads (auto-split for content > 280 chars), media attachments, scheduling, and failure recovery.

## Flow

### 1. Check for recent failures
Run `bun run src/cli/post.ts failures` and show any failed posts to the user. If there are failures, briefly mention them and ask if the user wants to retry any before creating a new post.

### 2. Get content
Ask the user what they want to post, or accept content from arguments: $ARGUMENTS

### 3. Thread detection
If content exceeds 280 characters for X:
- Run `bun run src/cli/post.ts create --content "..." --platform x`
- The CLI returns a thread preview with status "preview"
- Show the user the full thread preview with tweet numbers, character counts, and any warnings
- Ask: "Does this thread look good? You can approve, edit specific tweets, or rewrite."
- If approved, create the thread: `bun run src/cli/post.ts create-thread --tweets '[...]' --platform x`

If content fits in a single tweet:
- Run `bun run src/cli/post.ts create --content "..." --platform x`
- This creates the post as a draft immediately

### 4. Schedule or post now
Ask: "Post now or schedule for later?"

**Schedule:**
- Ask for date and time (interpret natural language like "tomorrow at 9am" into the user's configured timezone)
- Run: `bun run src/cli/post.ts schedule --post-id UUID --date 2026-03-15 --time 09:00 --timezone America/New_York`
- Confirm: show post ID, scheduled time in user's timezone, and platform

**Post now:**
- Confirm with user: "Ready to post this immediately?"
- Run: `bun run src/cli/post.ts now --post-id UUID`
- Confirm: show post ID and that it's been queued for immediate publishing

### 5. Confirmation
Show the user:
- Post ID (for future reference)
- Platform: X
- Status: scheduled/publishing
- If scheduled: when it will post (in user's timezone)
- Tip: "Use /psn:post to check on it later or cancel with the post ID"

## Management commands

### Cancel a scheduled post
`bun run src/cli/post.ts cancel --post-id UUID`

### Edit a scheduled post
`bun run src/cli/post.ts edit --post-id UUID --content "new content" --date 2026-03-16 --time 10:00 --timezone America/New_York`

### View recent failures
`bun run src/cli/post.ts failures`

## Media attachments
If the user provides images or files:
- Pass file paths via --media flag (comma-separated): `--media "/path/to/image1.png,/path/to/image2.jpg"`
- X supports up to 4 images per tweet
- Media is uploaded automatically during publishing

## Important notes
- All times should be interpreted in the user's timezone (ask if not configured)
- Post IDs are UUIDs — show them to the user for reference
- Thread previews show character counts per tweet for transparency
- Failed posts preserve their content — they can be retried or edited
- The CLI outputs JSON — parse it and present results conversationally to the user
