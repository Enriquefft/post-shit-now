# Quick Task Plan: Fix All Lint Errors

**Task:** run bun lint, fix all existing errors, no bandaid/temp fixes, only robust ones. then add & commit all changes

**Date:** 2026-02-20

---

## Summary

Fix all 2 errors and 15 warnings from Biome lint checker with robust, production-quality solutions.

---

## Tasks

### Task 1: Fix unused variables (3 warnings)

**Files:**
- `/home/hybridz/Projects/post-shit-now/src/cli/setup-voice.ts`
- `/home/hybridz/Projects/post-shit-now/src/cli/setup.ts`
- `/home/hybridz/Projects/post-shit-now/src/notifications/dispatcher.ts`

**Action:**
1. **src/cli/setup-voice.ts:133** - Remove unused `configDir` parameter from `setupVoice` function signature and its destructuring
2. **src/cli/setup.ts:27-40** - Remove unused `SetupSubcommand` type alias and `SubcommandParams` interface (these appear to be type-only documentation)
3. **src/notifications/dispatcher.ts:124** - Remove unused `tier` variable from `checkNotificationFatigue` function's destructuring

**Verify:**
- Run `bun lint` and confirm these specific warnings are gone
- Ensure code still compiles with `bun run typecheck`
- Verify no runtime behavior changes

**Done:** All unused variable warnings resolved without affecting functionality

---

### Task 2: Fix non-null assertions (11 warnings)

**Files:**
- `/home/hybridz/Projects/post-shit-now/src/engagement/monitor.ts`
- `/home/hybridz/Projects/post-shit-now/src/intelligence/collector.ts`
- `/home/hybridz/Projects/post-shit-now/src/planning/calendar.ts`
- `/home/hybridz/Projects/post-shit-now/src/planning/recycling.ts`
- `/home/hybridz/Projects/post-shit-now/src/series/episodes.ts`
- `/home/hybridz/Projects/post-shit-now/src/series/manager.ts`

**Action:**
1. **src/engagement/monitor.ts:71,78** - Replace non-null assertions on `platformClients.x` and `platformClients.instagram` with proper null checks using optional chaining or conditional checks before accessing
2. **src/intelligence/collector.ts:100** - Replace non-null assertion on `strategy.customRssFeeds` - the outer `if` already guards this, so the assertion is redundant; simply remove the `!`
3. **src/planning/calendar.ts:148** - Replace `p.scheduledAt!` with proper null check using `??` or conditional
4. **src/planning/calendar.ts:172,177** - Replace non-null assertions on `toISOString().split("T")[0]` results - these are safe after proper array indexing without `!`
5. **src/planning/recycling.ts:91** - Replace `remixOptions[0]!` with proper null check using optional chaining `remixOptions[0]` after the length check
6. **src/series/episodes.ts:101** - Replace `rows[0]!` with proper null handling, throwing a descriptive error if row not found
7. **src/series/manager.ts:73,86,99** - Replace `rows[0]!` with proper null handling, throwing descriptive errors if rows not found

**Verify:**
- Run `bun lint` and confirm all non-null assertion warnings are gone
- Ensure code compiles with `bun run typecheck`
- Verify runtime behavior unchanged (all non-null assertions were logically correct, just not Biome-compliant)

**Done:** All non-null assertions replaced with robust null checks and error handling

---

### Task 3: Fix self-assignment error (1 error)

**Files:**
- `/home/hybridz/Projects/post-shit-now/src/cli/setup.ts`

**Action:**
1. **src/cli/setup.ts:638** - Remove the self-assignment `params.entity = params.entity;` entirely as it has no effect

**Verify:**
- Run `bun lint` and confirm the error is gone
- Ensure code compiles with `bun run typecheck`
- Verify runtime behavior unchanged

**Done:** Self-assignment removed

---

### Task 4: Fix implicit any type error (1 error)

**Files:**
- `/home/hybridz/Projects/post-shit-now/src/notifications/dispatcher.ts`

**Action:**
1. **src/notifications/dispatcher.ts:91** - Add proper type annotation to `result` variable or initialize it with a proper value. Based on the context, this appears to be used for the return value from sending notifications, so type it as `Promise<void>` or `void | Promise<void>`

**Verify:**
- Run `bun lint` and confirm the error is gone
- Ensure code compiles with `bun run typecheck`
- Verify runtime behavior unchanged

**Done:** Implicit any type resolved with proper type annotation

---

### Task 5: Verify all fixes and commit changes

**Files:**
- All modified files from tasks 1-4
- `.planning/STATE.md` (to be updated)

**Action:**
1. Run `bun lint` to confirm all 2 errors and 15 warnings are resolved
2. Run `bun run typecheck` to ensure no TypeScript errors introduced
3. Stage all changes: `git add -A`
4. Commit with message: "fix(lint): resolve all biome lint errors and warnings with robust solutions

- Remove unused variables from setup-voice.ts, setup.ts, dispatcher.ts
- Replace non-null assertions with proper null checks across 6 files
- Remove self-assignment in setup.ts
- Add proper type annotation to dispatcher.ts result variable

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
5. Update STATE.md with quick task completion record
6. Create SUMMARY.md in quick task directory

**Verify:**
- `bun lint` runs with exit code 0
- `bun run typecheck` runs with exit code 0
- Git commit shows all fixes
- STATE.md updated with new quick task row

**Done:** All lint errors resolved, code committed, STATE.md updated
