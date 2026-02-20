---
phase: 14b-integration-wiring-fixes-remaining
plan: 01
type: execute
wave: 1
depends_on:
  - 14a-integration-wiring-fixes-critical
files_modified:
  - src/content/generate.ts
  - src/cli/plan.ts
  - src/planning/calendar.ts
  - src/content/topic-suggest.ts
  - src/ideas/check-bank.ts
autonomous: true
gap_closure: true
requirements:
  - POST-11
  - TEAM-07
  - TEAM-08

must_haves:
  truths:
    - "checkIdeaBank() in generate.ts receives db and userId arguments from CLI"
    - "Ready ideas from bank surface as options during /psn:post topic selection"
    - "calendarCommand in plan.ts uses getUnifiedCalendar instead of getCalendarState"
    - "Company hub posts appear during weekly planning with slot claiming"
  artifacts:
    - path: "src/content/generate.ts"
      provides: "Content generation with idea bank integration"
      contains: "checkIdeaBank"
    - path: "src/content/topic-suggest.ts"
      provides: "Topic suggestions including ready ideas from bank"
      contains: "checkIdeaBank"
    - path: "src/cli/plan.ts"
      provides: "Weekly planning command with unified calendar"
      contains: "getUnifiedCalendar"
    - path: "src/planning/calendar.ts"
      provides: "Calendar state and unified calendar functions"
      contains: "getUnifiedCalendar"
  key_links:
    - from: "src/content/generate.ts"
      to: "src/ideas/check-bank.ts"
      via: "checkIdeaBank function call"
      pattern: "checkIdeaBank\\("
    - from: "src/content/topic-suggest.ts"
      to: "src/ideas/check-bank.ts"
      via: "checkIdeaBank function call"
      pattern: "checkIdeaBank\\("
    - from: "src/cli/plan.ts"
      to: "src/approval/calendar.ts"
      via: "getUnifiedCalendar import and call"
      pattern: "getUnifiedCalendar"
---

<objective>
Fix idea bank integration and calendar unification for company hub support during content generation and weekly planning.

Purpose: Close HIGH/MEDIUM integration gaps where idea bank doesn't surface ready ideas during post generation, and weekly planning doesn't show company hub posts in unified calendar view.

Output: Ready ideas from bank appear as topic options in /psn:post, and weekly planning shows all hub posts (personal + company) in unified calendar.
</objective>

<execution_context>
@/home/hybridz/.claude/get-shit-done/workflows/execute-plan.md
@/home/hybridz/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@src/content/generate.ts
@src/cli/plan.ts
@src/approval/calendar.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify checkIdeaBank implementation and surface ready ideas in topic selection</name>
  <files>
    src/content/generate.ts
    src/ideas/check-bank.ts
    src/content/topic-suggest.ts
  </files>
  <action>
    First, verify checkIdeaBank exists and is properly implemented:

    1. Check if src/ideas/check-bank.ts exists. If not, create it:
    ```typescript
    import { eq, and, inArray, sql } from "drizzle-orm";
    import type { HubDb } from "../core/db/connection.ts";
    import { ideas } from "../core/db/schema.ts";

    export interface IdeaBankStatus {
      hasReadyIdeas: boolean;
      readyCount: number;
      readyIdeas?: Array<{
        id: string;
        topic: string;
        pillar: string;
        state: string;
        maturity: number;
        createdAt: Date;
      }>;
    }

    /**
     * Check idea bank for ready ideas that can be used in content generation.
     * POST-11: Ready ideas should surface as options during /psn:post topic selection.
     */
    export async function checkIdeaBank(
      db?: ReturnType<typeof import("../core/db/connection").createHubConnection>,
      userId?: string,
    ): Promise<IdeaBankStatus> {
      if (!db) {
        return { hasReadyIdeas: false, readyCount: 0 };
      }

      try {
        // Query ideas with state "ready" and maturity >= 2
        const readyIdeas = await db
          .select()
          .from(ideas)
          .where(
            and(
              eq(ideas.userId, userId ?? "default"),
              eq(ideas.state, "ready"),
              sql`${ideas.maturity} >= 2`,
            ),
          )
          .orderBy(ideas.createdAt)
          .limit(10);

        return {
          hasReadyIdeas: readyIdeas.length > 0,
          readyCount: readyIdeas.length,
          readyIdeas: readyIdeas.map((idea) => ({
            id: idea.id,
            topic: idea.topic ?? "",
            pillar: idea.pillar ?? "general",
            state: idea.state ?? "spark",
            maturity: idea.maturity ?? 0,
            createdAt: idea.createdAt ?? new Date(),
          })),
        };
      } catch (error) {
        console.error("Failed to check idea bank:", error);
        return { hasReadyIdeas: false, readyCount: 0 };
      }
    }
    ```

    2. Verify src/content/generate.ts line 395 already calls checkIdeaBank:
    ```typescript
    const ideaBankStatus = await checkIdeaBank(db, options.userId);
    ```
    This is already correct! The function receives db and userId.

    3. Update src/content/topic-suggest.ts to include ready ideas in suggestions:
    - Add a parameter for ideaBankStatus to suggestTopics function
    - If ideaBankStatus.hasReadyIdeas is true, prepend readyIdeas to topic suggestions
    - Format: each ready idea should be a TopicSuggestion with the idea's topic as text
    - Example: "Ready from bank: [idea.topic] (maturity: [idea.maturity])"

    Modify suggestTopics signature:
    ```typescript
    export async function suggestTopics(params: {
      profile: VoiceProfile;
      platform: Platform;
      count?: number;
      fatiguedTopics?: string[];
      ideaBankStatus?: IdeaBankStatus;
    }): Promise<TopicSuggestion[]>
    ```

    In the function body, mix in ready ideas:
    ```typescript
    const suggestions: TopicSuggestion[] = [];

    // Add ready ideas from bank first (if available)
    if (params.ideaBankStatus?.hasReadyIdeas) {
      for (const idea of params.ideaBankStatus.readyIdeas ?? []) {
        suggestions.push({
          text: `Ready: ${idea.topic} (${idea.pillar})`,
          type: "idea-bank",
          source: idea.id,
        });
      }
    }

    // Then add AI-generated suggestions (existing logic)
    // ... existing topic generation code ...

    return suggestions.slice(0, params.count ?? 3);
    ```

    4. Update src/content/generate.ts to pass ideaBankStatus to suggestTopics (around line 425):
    ```typescript
    let topicSuggestions: TopicSuggestion[] | undefined;
    if (!options.topic) {
      topicSuggestions = suggestTopics({
        profile,
        platform: options.platform,
        count: 3,
        fatiguedTopics: earlyLearnings?.fatiguedTopics,
        ideaBankStatus, // Pass idea bank status
      });
    }
    ```

    5. Add a comment in generate.ts documenting POST-11 integration:
    ```typescript
    // POST-11: checkIdeaBank receives db and userId for ready ideas
    // Line 395: const ideaBankStatus = await checkIdeaBank(db, options.userId);
    // Line 425: ideaBankStatus passed to suggestTopics for topic selection
    ```
  </action>
  <verify>
    Run `bun run typecheck` — exits 0.
    Verify src/ideas/check-bank.ts exists and exports checkIdeaBank.
    Verify src/content/generate.ts passes ideaBankStatus to suggestTopics (if no topic provided).
    Verify src/content/topic-suggest.ts includes ready ideas in suggestions.
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    checkIdeaBank is implemented and ready ideas surface during /psn:post topic selection. Users can choose from their curated idea bank or generate AI suggestions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify calendarCommand uses getUnifiedCalendar (already implemented, document test)</name>
  <files>
    src/cli/plan.ts
    src/approval/calendar.ts
  </files>
  <action>
    Review src/cli/plan.ts to verify unified calendar is already wired.

    The code at line 43-67 already implements unified calendar:
    - calendarCommand function (line 43) calls getUnifiedCalendar (line 60)
    - Discovers company hubs via discoverCompanyHubs() (line 51)
    - Creates company hub DB connections (lines 52-55)
    - Passes personalDb, companyHubs, userId, date range to getUnifiedCalendar

    Document this implementation in a test or verification note:
    - Add a comment in plan.ts noting the unified calendar wiring
    - Verify the getUnifiedCalendar call matches the approval/calendar.ts function signature
    - Confirm company hub discovery is graceful (try/catch fallback to personal-only, line 56-58)

    Add a comment at line 67:
    ```typescript
    // TEAM-07: Unified calendar shows all hubs (personal + company)
    // Already implemented: see lines 43-67, getUnifiedCalendar called with companyHubs
    ```

    Verify that getUnifiedCalendar is imported correctly at the top of the file:
    ```typescript
    import { getUnifiedCalendar, type UnifiedCalendar } from "../approval/calendar.ts";
    ```
    This should already exist at line 2.
  </action>
  <verify>
    Confirm getUnifiedCalendar is imported from "../approval/calendar.ts" (line 2).
    Confirm calendarCommand calls getUnifiedCalendar with personalDb and companyHubs (line 60).
    Confirm company hub discovery uses try/catch for graceful fallback (line 50-58).
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    calendarCommand is verified as correctly using getUnifiedCalendar. Documentation comment added. Company hub posts appear in weekly planning calendar.
  </done>
</task>

<task type="auto">
  <name>Task 3: Ensure company hub posts are visible during weekly planning with slot claiming</name>
  <files>
    src/approval/calendar.ts
    src/planning/slotting.ts
    src/planning/calendar.ts
  </files>
  <action>
    Review the unified calendar and slotting implementation to ensure company hub integration.

    1. Verify getUnifiedCalendar in src/approval/calendar.ts (lines 116-163):
    - Queries personal hub posts (line 128)
    - Queries each company hub independently (lines 134-154)
    - Returns UnifiedCalendar with personal section and companies object
    - Each company section has entries and stats (lines 156-162)

    2. Check if slot claiming supports hubId:
    - Review src/approval/calendar.ts claimSlot function (lines 254-291)
    - Verify it accepts hubId parameter and stores it in metadata (line 287)
    - Verify slot release checks hubId (implicitly via post metadata)

    3. Review src/planning/slotting.ts to ensure it can handle unified calendar:
    - Check if allocateSlots function can process company hub posts
    - Verify it uses the calendar state that includes company data

    If slotting doesn't support company hubs, update it:
    - Add companyHubId parameter to slot allocation
    - When claiming slots for company posts, include hubId in metadata
    - Ensure slot availability checks include company hub schedules

    4. Add documentation comment in calendar.ts:
    ```typescript
    // TEAM-08: Unified calendar enables slot claiming across all hubs
    // claimSlot accepts hubId for company post claiming (line 287)
    ```

    5. Verify the planning command's slotCommand uses unified calendar data:
    - In src/cli/plan.ts, slotCommand calls getCalendarState (line 100)
    - This should be updated to use unified calendar or at least account for company hubs
    - If slotCommand is used for slot allocation only (not display), current implementation may be acceptable
  </action>
  <verify>
    Verify getUnifiedCalendar returns both personal and company sections.
    Verify claimSlot stores hubId in metadata (line 287 of calendar.ts).
    Verify slot allocation can handle multi-hub scenarios.
    Run `bun run typecheck` — exits 0.
    Run `bun run lint` — exits 0.
  </verify>
  <done>
    Unified calendar shows all hub posts, and slot claiming works across personal and company hubs. Weekly planning displays company hub posts with slot claiming capability.
  </done>
</task>

</tasks>

<verification>
- checkIdeaBank function exists and receives db + userId
- Ready ideas from bank appear as topic options in /psn:post (via topic-suggest.ts)
- calendarCommand uses getUnifiedCalendar with company hubs discovered
- getUnifiedCalendar returns personal + company calendar sections
- claimSlot supports hubId for company post slot claiming
- All integration points documented with comments
- `bun run lint` passes on all modified files
- `bun run typecheck` passes
</verification>

<success_criteria>
- checkIdeaBank is called with db and userId in generate.ts
- Ready ideas surface during /psn:post topic selection
- calendarCommand uses getUnifiedCalendar (verified existing)
- Company hub posts appear in weekly planning calendar
- Slot claiming works for company hub posts
- Documentation comments added
</success_criteria>

<output>
After completion, create `.planning/phases/14b-integration-wiring-fixes-remaining/14b-01-SUMMARY.md`
</output>
