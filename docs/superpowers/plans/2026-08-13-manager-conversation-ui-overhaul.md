# Manager Conversation UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Rebuild the Manager's Office and conversation into a restrained, ChatGPT-caliber work surface with compact turn results, sequential composer questions, canonical song-scoped uploads, and one unified Manager working state.

**Architecture:** Preserve existing routes and Manager stream semantics while extracting the oversized Manager presentation into focused components. Use pure presentation projections for turn ownership and guided questions, reuse `MusicRepository.uploadAsset` and `music_assets` for uploads, persist only validated canonical asset references in artist-message metadata, and render every active Manager run through one existing `AppThinkingOrb` that is replaced in place by prose, result, or failure.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, `thinking-orbs`, Vitest, Testing Library, Vite, Supabase client/storage, and Supabase Edge Functions with SSE.

---

## Scope guardrails

Do not add conversation search, filters, grouping, pinning, archive, rename, thread switching, general-conversation uploads, a song picker in chat, temporary attachment storage, drag-and-drop, a new preview system, a split-pane editor, a new route, a new stream event, parallel Manager runs, or new background execution semantics.

Preserve starting and opening conversations, title stability, streaming, retry, context-answer contracts, task-draft expansion, existing navigation, release approval, opportunity actions, scroll ownership, composer safe-area behavior, canonical Files ownership, and existing durable activity-center behavior.

## LunaMax implementation protocol

This plan is intentionally prescriptive. LunaMax should implement it task by task in order and must not substitute a different product pattern because another pattern is faster to generate.

At the start of implementation:

1. Create an isolated `codex/manager-conversation-overhaul` worktree or branch from the commit containing this plan.
2. Read the complete design spec at `docs/superpowers/specs/2026-08-13-manager-conversation-ui-overhaul-design.md` before editing code.
3. Record the existing untracked `.playwright-cli` files and leave them untouched.
4. Run the focused baseline tests used by Tasks 1, 7, and 8 before changing implementation.
5. Complete one task, run its named tests, inspect the diff, and commit before beginning the next task.

Non-negotiable product invariants:

- A general or project conversation has no paperclip, disabled upload control, song selector, or explanatory upload copy.
- A file is uploaded only after a durable `music_item` is already attached to the conversation.
- Upload creates one canonical `music_assets` record through `MusicRepository.uploadAsset`; conversation metadata stores only its validated reference.
- Preset context questions advance locally. No repository call, loading state, or Manager run occurs between questions.
- Exactly one Manager activity indicator is visible. It uses one existing `AppThinkingOrb`; prose/result/failure replaces it.
- The Office conversation list remains title plus optional time only.
- Do not retain both old and new UI behind flags. Remove superseded form, card, and loader markup after the replacement passes tests.

If repository behavior differs from a code snippet in this plan, preserve the invariant and existing security boundary, make the smallest compatible adjustment, and document that adjustment in the task commit. Do not broaden scope without user approval.

Composer state precedence is fixed:

| Priority | Condition | Visible composer |
|---|---|---|
| 1 | Latest Manager context request is unresolved | One guided question; no chat textarea or paperclip |
| 2 | Ordinary song conversation | Textarea, song-only paperclip, staged canonical uploads, Send |
| 3 | General or project conversation | Textarea and Send only |

Manager-turn state precedence is also fixed:

| Priority | Condition | Visible Manager turn |
|---|---|---|
| 1 | Failed Manager message/run | Plain failure and Retry; no orb |
| 2 | Manager prose has started | Streamed prose; no orb or activity history |
| 3 | Active run before prose | One 16–18px `AppThinkingOrb` and one status sentence |
| 4 | Completed run | Final prose/result only; no loading receipt |

Visual constants LunaMax should use unless an existing token already expresses the same value: 768px conversation maximum width, 16px mobile page margin, 24px tablet margin, 32px desktop clearance, 15–16px conversation text, 12–13px activity/supporting text, 40–44px interactive targets, neutral alpha borders, and elevation only on the floating composer or temporary overlays.

## File map

Create:

- src/features/manager/managerPresentation.ts
- src/features/manager/managerPresentation.test.ts
- src/features/manager/ManagerOfficeScreen.tsx
- src/features/manager/ConversationWorkspace.tsx
- src/features/manager/ManagerMessage.tsx
- src/features/manager/ManagerArtifacts.tsx
- src/features/manager/ManagerComposer.tsx
- src/features/manager/managerContextFlow.ts
- src/features/manager/managerContextFlow.test.ts
- src/features/manager/ManagerSongAttachments.tsx
- src/features/manager/ManagerActivity.tsx
- src/features/music/musicUploadClassification.ts
- src/features/music/musicUploadClassification.test.ts
- supabase/functions/_shared/manager-conversation/attachments.ts

Modify:

- src/features/manager/ManagerScreens.tsx
- src/features/manager/ReleaseSuccessArtifact.tsx
- src/features/manager/OpportunityArtifact.tsx
- src/features/music/MusicScreens.tsx
- src/design-system/components.tsx
- src/types/cleanProduction.ts
- src/services/productionSupabase.ts
- src/services/fixtureRepositories.ts
- src/app/ProductionApp.tsx
- supabase/functions/_shared/manager-conversation/context.ts
- supabase/functions/manager-conversation/index.ts
- supabase/functions/manager-conversation-stream/index.ts
- src/index.css
- src/production-app-shell.test.tsx
- src/production-supabase-service.test.ts
- src/manager-conversation-context.test.ts
- src/manager-conversation-attachments.test.ts
- src/openai-manager-conversation-function.test.ts

Do not create a migration: `conversation_messages.metadata` already stores structured context data and can hold canonical attachment references. Do not modify unrelated Manager tools, `src/services/managerConversationStream.ts`, storage buckets, or upload authorization.

## Task 1: Create the turn-owned presentation projection

**Files:**

- Create: src/features/manager/managerPresentation.ts
- Create: src/features/manager/managerPresentation.test.ts

- [ ] **Step 1: Write failing projection tests**

Cover four exact cases:

    const task = {
      type: "task" as const,
      id: "task-1",
      parentMissionId: "mission-1",
      title: "Confirm files",
      body: "Review package",
    };
    const mission = {
      type: "mission" as const,
      id: "mission-1",
      title: "Prepare Summer",
      body: "Release work",
    };
    const song = {
      type: "music_item" as const,
      id: "song-1",
      title: "Summer",
      body: "Song Workspace created.",
    };
    const conversationWithFallbackArtifacts = {
      id: "conversation-1",
      topic: "Summer release",
      status: "Manager responded",
      summary: "Ready",
      prompt: "Prepare Summer",
      messages: [
        { id: "artist-1", speaker: "artist" as const, label: "You", body: "Prepare Summer" },
        { id: "manager-1", speaker: "manager" as const, label: "Manager", body: "The workspace is ready." },
      ],
      createdWork: [mission],
      releaseSuccessArtifacts: [{
        id: "release-1",
        musicItemId: "song-1",
        state: "assessed" as const,
        subject: { title: "Summer", itemType: "song" },
      }],
    } as ConversationViewModel;
    const conversationWithMessageWork = {
      ...conversationWithFallbackArtifacts,
      messages: [
        conversationWithFallbackArtifacts.messages[0],
        { ...conversationWithFallbackArtifacts.messages[1], createdWork: [task] },
      ],
      createdWork: [task],
      releaseSuccessArtifacts: [],
    } as ConversationViewModel;

    it("assigns conversation artifacts to the final Manager turn", () => {
      const turns = buildManagerTurns(conversationWithFallbackArtifacts);
      expect(turns.at(-1)?.createdWork).toHaveLength(1);
      expect(turns.at(-1)?.releaseSuccessArtifacts).toHaveLength(1);
      expect(turns[0].createdWork).toHaveLength(0);
    });

    it("does not repeat fallback work when a message owns it", () => {
      expect(buildManagerTurns(conversationWithMessageWork)[1].createdWork).toEqual([task]);
    });

    it("deduplicates repeated objects by type and id", () => {
      expect(groupCreatedWork([task, task])).toHaveLength(1);
    });

    it("groups a song workspace, mission, and first task", () => {
      expect(groupCreatedWork([song, mission, task])).toEqual([
        expect.objectContaining({
          kind: "workspace",
          title: "Summer",
          musicItemId: "song-1",
          missionId: "mission-1",
          taskCount: 1,
        }),
      ]);
    });

- [ ] **Step 2: Verify the tests fail**

    npx vitest run src/features/manager/managerPresentation.test.ts --environment jsdom --pool=vmThreads

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement explicit presentation types and deduplication**

    export type WorkItem = ConversationViewModel["createdWork"][number];

    export type CreatedWorkGroup =
      | { kind: "workspace"; title: string; musicItemId?: string; missionId?: string; taskCount: number; items: WorkItem[] }
      | { kind: "mission"; title: string; missionId?: string; taskCount: number; items: WorkItem[] }
      | { kind: "tasks"; title: string; items: WorkItem[] }
      | { kind: "draft"; title: string; item: WorkItem }
      | { kind: "music"; title: string; item: WorkItem };

    function uniqueWork(items: WorkItem[]) {
      const seen = new Set<string>();
      return items.filter((item) => {
        const key = item.id
          ? item.type + ":" + item.id
          : item.type + ":" + item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

groupCreatedWork must use the existing body.includes("Song Workspace created.") signal. It must group one workspace song, one mission, and that mission's tasks. Independent missions remain separate groups. Task drafts remain draft groups.

- [ ] **Step 4: Implement final-Manager ownership**

    export function buildManagerTurns(conversation: ConversationViewModel): ManagerTurn[] {
      const hasMessageWork = conversation.messages.some((message) => Boolean(message.createdWork?.length));
      const lastManagerIndex = conversation.messages.findLastIndex((message) => message.speaker === "manager");

      return conversation.messages.map((message, index) => {
        const ownsConversationArtifacts = index === lastManagerIndex;
        const createdWork = uniqueWork([
          ...(message.createdWork ?? []),
          ...(ownsConversationArtifacts && !hasMessageWork ? conversation.createdWork : []),
        ]);

        return {
          message,
          createdWork,
          createdWorkGroups: groupCreatedWork(createdWork),
          releaseSuccessArtifacts: ownsConversationArtifacts ? conversation.releaseSuccessArtifacts ?? [] : [],
          opportunityArtifacts: ownsConversationArtifacts ? conversation.releaseOpportunityArtifacts ?? [] : [],
          decisionPackage: ownsConversationArtifacts ? conversation.decisionPackage : undefined,
        };
      });
    }

- [ ] **Step 5: Run tests and commit**

    npx vitest run src/features/manager/managerPresentation.test.ts --environment jsdom --pool=vmThreads
    git add src/features/manager/managerPresentation.ts src/features/manager/managerPresentation.test.ts
    git commit -m "refactor: project manager results into conversation turns"

Expected: PASS before commit.

## Task 2: Extract and simplify the Manager's Office

**Files:**

- Create: src/features/manager/ManagerOfficeScreen.tsx
- Modify: src/features/manager/ManagerScreens.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write a failing sparse-history test**

    const row = screen.getByRole("button", { name: "Summer release planning" });
    expect(within(row).getByText("Summer release planning")).toBeInTheDocument();
    expect(within(row).getByText("14h ago")).toBeInTheDocument();
    expect(screen.queryByText("This summary must stay out of the list.")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager responded")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeInTheDocument();
    expect(screen.queryByText("Conversation History")).not.toBeInTheDocument();

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "sparse conversation history"

Expected: FAIL against the icon-led current list.

- [ ] **Step 3: Extract the existing Office behavior**

Move ManagerOfficeScreen and MissionGenesisManagerPanel without changing props, send handling, pending state, errors, or Mission Genesis actions.

Use a 48rem centered page. The composer heading is "What do you want to work on?" The conversation section label is "Conversations". Each row contains only:

    <button
      key={conversation.id}
      type="button"
      aria-label={conversation.topic}
      onClick={() => onConversation(conversation)}
      className="flex min-h-12 w-full items-center gap-4 rounded-xl px-2 py-3 text-left outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-brand-accent/45"
    >
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-foreground">
        {conversation.topic}
      </span>
      {conversation.lastUpdate ? (
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {conversation.lastUpdate}
        </span>
      ) : null}
    </button>

Do not sort, group, filter, search, add icons, add summaries, or add row menus.

- [ ] **Step 4: Re-export and run integration tests**

Add:

    export { ManagerOfficeScreen } from "./ManagerOfficeScreen";

Run:

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "Manager|conversation"

Expected: PASS.

- [ ] **Step 5: Commit**

    git add src/features/manager/ManagerOfficeScreen.tsx src/features/manager/ManagerScreens.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: simplify manager conversation home"

## Task 3: Establish the compact shell and quiet message rhythm

**Files:**

- Create: src/features/manager/ConversationWorkspace.tsx
- Create: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ManagerScreens.tsx
- Modify: src/design-system/components.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing hierarchy tests**

    expect(screen.getByTestId("manager-conversation-column")).toHaveClass("max-w-[48rem]");
    expect(screen.getByTestId("manager-message-manager")).not.toHaveClass("border", "shadow-sm");
    expect(screen.getByTestId("manager-message-artist")).toHaveClass("items-end");
    expect(screen.queryByTestId("manager-speaker-avatar")).not.toBeInTheDocument();
    expect(screen.queryByText("Direct message")).not.toBeInTheDocument();

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "quiet conversation hierarchy"

Expected: FAIL against avatars, labels, 680px width, and current header.

- [ ] **Step 3: Add an opt-in WorkspaceShell conversation variant**

Add variant?: "default" | "conversation". Preserve the default branch byte-for-byte where practical. The conversation branch uses a compact sticky header with Back to Manager and title only:

    <header className="sticky top-0 z-30 -mx-3 border-b border-foreground/8 bg-background/92 px-3 py-2.5 backdrop-blur-xl lg:-mx-4 lg:px-4">
      <div className="mx-auto flex max-w-[48rem] items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Back to Manager" className="inline-flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h1 className="min-w-0 truncate text-[14px] font-semibold text-foreground sm:text-[15px]">
          {title}
        </h1>
      </div>
    </header>

- [ ] **Step 4: Extract ManagerMessage**

Artist messages are right aligned, neutral, 85% max width on mobile and 75% on desktop. Manager messages are full-width prose. Remove both speaker labels and avatars.

    <article
      data-testid={"manager-message-" + (isArtist ? "artist" : "manager")}
      className={"flex flex-col " + (isArtist ? "items-end" : "items-start")}
    >
      {isArtist ? (
        <div className="max-w-[85%] rounded-[1.25rem] bg-foreground/[0.06] px-4 py-2.5 text-[15px] leading-[1.6] text-foreground sm:max-w-[75%]">
          {message.body}
        </div>
      ) : (
        <div className="w-full text-[15px] leading-[1.65] text-foreground sm:text-[16px]">
          <RichMessageBody body={message.body} streaming={isStreaming} failed={message.status === "failed"} />
          {children}
        </div>
      )}
    </article>

Retain rich text, retry, questions, and streaming semantics.

- [ ] **Step 5: Extract ConversationWorkspace**

Use buildManagerTurns. Render each turn's results inside ManagerMessage. Remove all detached artifact blocks after the transcript.

    <main
      data-testid="manager-conversation-column"
      className="mx-auto w-full max-w-[48rem] px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8 lg:px-0"
    >
      <ConversationContext {...contextProps} />
      <div ref={messageListRef} className="flex flex-col gap-8">
        {buildManagerTurns(conversation).map((turn) => (
          <ManagerMessage key={turn.message.id} message={turn.message} {...messageProps}>
            <ManagerTurnResults turn={turn} {...artifactCallbacks} />
          </ManagerMessage>
        ))}
        <div data-testid="manager-chat-tail" ref={scrollAnchorRef} className="h-32 shrink-0" aria-hidden="true" />
      </div>
    </main>

Keep useConversationScroll as the only scroll owner.

- [ ] **Step 6: Re-export, test, and commit**

    export { ConversationWorkspace } from "./ConversationWorkspace";

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "conversation|Manager composer|scroll"
    git add src/features/manager/ConversationWorkspace.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ManagerScreens.tsx src/design-system/components.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: establish quiet manager conversation shell"

Expected: tests PASS before commit.

## Task 4: Replace object cards with compact turn results

**Files:**

- Create: src/features/manager/ManagerArtifacts.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write a failing grouped-result test**

    const result = screen.getByTestId("manager-workspace-result");
    expect(within(result).getByText("Summer is ready for release planning")).toBeInTheDocument();
    expect(within(result).getByText("Mission and first task are ready")).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Add release files" })).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "View mission" })).toBeInTheDocument();
    expect(screen.queryByText("Mission created")).not.toBeInTheDocument();
    expect(screen.queryByText("Song Workspace ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Music item created")).not.toBeInTheDocument();

Also assert Add release files calls ("music_item", "song-summer", "files") and View mission calls ("mission", "mission-summer", undefined).

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "one workspace result"

Expected: FAIL because current objects render separately.

- [ ] **Step 3: Implement one shared ResultFrame**

    <section data-testid={testId} className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/[0.018] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-snug text-foreground sm:text-[15px]">{title}</h3>
          {detail ? <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p> : null}
          <div className="manager-result-actions mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {primary}
            {secondary}
          </div>
        </div>
      </div>
    </section>

Use it for workspace, mission, standalone task, music, draft, and decision-package groups.

- [ ] **Step 4: Implement the workspace result with existing routes**

Title is group.title + " is ready for release planning". Detail is "Mission is ready", "Mission and first task are ready", or "Mission and N tasks are ready". Primary action calls onOpenCreatedWork("music_item", group.musicItemId, "files"). Secondary calls onOpenCreatedWork("mission", group.missionId).

For independent missions, show mission title, task count, and Open mission. Do not show nested task descriptions. Standalone tasks remain reachable.

- [ ] **Step 5: Preserve draft behavior**

Move existing preview cleanup, exact content, aria-expanded, inline RichMessageBody, and task navigation. Default remains collapsed. Label state as Draft; do not create an editor.

- [ ] **Step 6: Keep decision packages compact**

Show title, one-line summary, and existing Open package action only.

- [ ] **Step 7: Test and commit**

    npx vitest run src/features/manager/managerPresentation.test.ts src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "workspace result|mission artifacts|task drafts|decision package"
    git add src/features/manager/ManagerArtifacts.tsx src/features/manager/ConversationWorkspace.tsx src/production-app-shell.test.tsx
    git commit -m "feat: unify manager work into compact results"

Expected: PASS before commit.

## Task 5: Extract the stable composer shell and simplify conversation context

**Files:**

- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Create: src/features/manager/ManagerComposer.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing assertions**

    expect(screen.getByTestId("conversation-song-context")).not.toHaveClass("shadow-sm");
    expect(screen.getByTestId("manager-composer-dock")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("manager-composer-surface")).toHaveClass("pointer-events-auto", "max-w-[48rem]");

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "composer|song context|scroll"

Expected: FAIL against the current footer and context cards.

- [ ] **Step 3: Simplify existing context**

Song context shows title, lifecycle stage, and existing open action. Task context shows title and Back to task. Remove uppercase labels, descriptive duplication, accent-filled panels, and shadows.

- [ ] **Step 4: Extract ManagerComposer with explicit mode inputs**

Define a focused component that initially supports ordinary chat and accepts optional `guidedQuestion` and `attachments` slots for later tasks:

    type ManagerComposerProps = {
      draft: string;
      onDraftChange(value: string): void;
      onSend(): void;
      sendPending: boolean;
      sendError?: string | null;
      guidedQuestion?: ReactNode;
      attachments?: ReactNode;
      leadingAction?: ReactNode;
    };

Render `guidedQuestion` instead of the ordinary text row when present. Render `attachments` above the row and `leadingAction` before the textarea only in ordinary mode.

- [ ] **Step 5: Float and align ManagerComposer**

    <div
      data-testid="manager-composer-dock"
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-8 sm:px-6 lg:left-[13.5rem]"
    >
      <div
        data-testid="manager-composer-surface"
        className="pointer-events-auto mx-auto max-w-[48rem] rounded-[1.5rem] border border-foreground/12 bg-background/96 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
      >
        <div className="flex items-end gap-2 px-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message the Manager…"
            aria-label="Message the Manager"
            rows={1}
            className="min-h-11 w-full resize-none bg-transparent px-2 py-3 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/45"
            style={{ maxHeight: "200px", overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sendPending}
            aria-label="Send Manager message"
            className="mb-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-25"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {sendError && !hasFailedManagerMessage ? (
          <p role="alert" className="px-4 pb-2 text-[11px] font-medium text-red-600">{sendError}</p>
        ) : null}
      </div>
    </div>

Preserve placeholder, Enter, Shift+Enter, growth to 200px, send lock, error, safe area, rail offset, and verification note. Do not add the song-only attachment action until Task 9; the `leadingAction` slot must remain empty elsewhere.

- [ ] **Step 6: Wire ConversationWorkspace and remove the old inline composer markup**

Keep draft ownership and send handlers in `ConversationWorkspace`; pass state into `ManagerComposer`. Keep `useConversationScroll` as the only transcript scroll owner.

- [ ] **Step 7: Test and commit**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "composer|song context|scroll"
    git add src/features/manager/ManagerComposer.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ConversationWorkspace.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: extract manager conversation composer"

Expected: PASS before commit.

## Task 6: Move preset Manager questions into a sequential composer flow

**Files:**

- Create: src/features/manager/managerContextFlow.ts
- Create: src/features/manager/managerContextFlow.test.ts
- Modify: src/features/manager/ManagerComposer.tsx
- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/app/ProductionApp.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing pure-flow tests**

Test a three-question array containing `short_text`, `single_select`, and `multi_select`. Assert that answering question one changes only local state, Back preserves prior answers, single-select advances, multi-select requires Continue, and `buildContextAnswerPayload` returns all answers once at the final step.

    expect(nextContextQuestionIndex(0, questions)).toBe(1);
    expect(buildContextAnswerPayload(questions, answers)).toEqual([
      { questionKey: "release_date", answer: "August 27" },
      { questionKey: "budget", answer: "Under ₦500,000" },
      { questionKey: "priority", answer: "Playlist pitching, Short-form content" },
    ]);

- [ ] **Step 2: Run the pure tests and verify failure**

    npx vitest run src/features/manager/managerContextFlow.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement deterministic question helpers**

Export these exact functions and keep them free of React and network calls:

    export type ContextDraftAnswers = Record<string, string[]>;

    export function answerValues(answer?: string | string[]) {
      return Array.isArray(answer) ? answer.filter(Boolean) : answer?.trim() ? [answer.trim()] : [];
    }

    export function buildContextAnswerPayload(
      questions: ManagerMissionContextQuestion[],
      answers: ContextDraftAnswers,
    ): ManagerConversationContextAnswer[] {
      return questions.map((question) => ({
        questionKey: question.key,
        answer: (answers[question.key] ?? []).join(", ").trim(),
      })).filter((answer) => answer.answer);
    }

Also export `isContextQuestionAnswered`, bounded previous/next-index helpers, and `formatContextAnswerSummary(questions, answers)`. The summary must use the question text and selected answer, not the internal placeholder sentence.

- [ ] **Step 4: Write failing composer interaction tests**

Assert `1 of 3`, question text, choice buttons, `aria-pressed`, Recommended, I'm not sure, Something else, Back, Continue, Send answers, and preservation after a rejected final submit. Assert the Manager repository is not called while moving from questions one to three and is called exactly once at final submission.

- [ ] **Step 5: Implement GuidedContextComposer inside ManagerComposer**

Use the active question's existing `answerKind`:

- `single_select`: buttons, auto-advance after an ordinary selection;
- `multi_select`: toggle buttons plus Continue;
- `short_text`: composer textarea plus Continue;
- `money_range`: text input with `Enter an amount or range` guidance plus Continue;
- `Something else`: reveal free text and stop auto-advance;
- `recommendedAnswer`: inject or mark one choice with a small `Recommended` label;
- `I'm not sure`: store `I'm not sure — use your best recommendation and state the assumption.`.

Keep all question state in `ConversationWorkspace` so a failed final request does not reset it. During final submission, keep the final step visible and change `Send answers` to `Sending…`. Only clear state after the submitted `contextRequestId` is present on a server-started or completed artist message; do not mark the optimistic-only message resolved. Extend the `onSendContextAnswers` body argument to use `formatContextAnswerSummary` instead of `Context answers for Manager mission decision.`

- [ ] **Step 6: Collapse resolved questions in the owning Manager turn**

Remove `ManagerContextQuestionForm`. An unresolved question message renders no inputs. A resolved one renders `N answers provided` beneath its Manager prose. Use the existing resolved-request comparison and preserve chronological ordering.

- [ ] **Step 7: Test and commit**

    npx vitest run src/features/manager/managerContextFlow.test.ts src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "guided context|context questions|answers provided"
    git add src/features/manager/managerContextFlow.ts src/features/manager/managerContextFlow.test.ts src/features/manager/ManagerComposer.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ConversationWorkspace.tsx src/app/ProductionApp.tsx src/production-app-shell.test.tsx
    git commit -m "feat: answer manager questions through the composer"

Expected: PASS; tests prove zero intermediate sends and one final payload.

## Task 7: Make canonical song uploads return durable attachment references

**Files:**

- Create: src/features/music/musicUploadClassification.ts
- Create: src/features/music/musicUploadClassification.test.ts
- Modify: src/features/music/MusicScreens.tsx
- Modify: src/types/cleanProduction.ts
- Modify: src/services/productionSupabase.ts
- Modify: src/services/fixtureRepositories.ts
- Modify: src/production-supabase-service.test.ts

- [ ] **Step 1: Write failing upload-contract tests**

Add `ManagerConversationAttachmentViewModel` with `id`, `musicItemId`, `title`, `assetType`, `group`, and `status`. Change `MusicRepository.uploadAsset` to return it. In the Supabase service test, assert `music_assets.insert(...).select("id,music_item_id,asset_type,title,status")` and assert the resolved attachment contains the inserted asset ID.

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-supabase-service.test.ts -t "uploads a music asset"

Expected: FAIL because upload currently returns no canonical ID.

- [ ] **Step 3: Return the inserted canonical asset**

Replace the unselected `music_assets` insert with:

    const { data: assetRow, error: assetError } = await client
      .from("music_assets")
      .insert({ ...existingInsert })
      .select("id,music_item_id,asset_type,title,status")
      .single();

Return `{ id: assetRow.id, musicItemId, title, assetType, group: assetGroup(assetType), status: "Uploaded" }`. Update the fixture repository to return the same shape. Do not create a second record or table.

- [ ] **Step 4: Extract and test shared classification**

Move file-to-category logic out of `MusicScreens.tsx` into `musicUploadClassification.ts`. Export `inferMusicUpload(file)` returning `{ group, suggestedAssetType, confidence }`. Preserve current MIME behavior, add only deterministic filename hints for existing types (`master`, `instrumental`, `clean`, `stem`, `cover`, `artwork`, `press`, `lyrics`, `split`), and return `confidence: "needs_confirmation"` when semantic type is ambiguous.

- [ ] **Step 5: Reuse classification in Music Files**

Replace `resolveUploadAsset`'s private MIME logic with the shared helper while preserving existing labels and upload behavior. Do not redesign the Files UI in this task.

- [ ] **Step 6: Test and commit**

    npx vitest run src/features/music/musicUploadClassification.test.ts src/production-supabase-service.test.ts -t "upload|classification"
    git add src/features/music/musicUploadClassification.ts src/features/music/musicUploadClassification.test.ts src/features/music/MusicScreens.tsx src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/production-supabase-service.test.ts
    git commit -m "feat: return canonical song upload references"

Expected: PASS with existing storage and progress behavior unchanged.

## Task 8: Persist and validate song attachments on artist messages

**Files:**

- Modify: src/types/cleanProduction.ts
- Modify: src/services/productionSupabase.ts
- Modify: src/services/fixtureRepositories.ts
- Modify: src/app/ProductionApp.tsx
- Create: supabase/functions/_shared/manager-conversation/attachments.ts
- Modify: supabase/functions/_shared/manager-conversation/context.ts
- Modify: supabase/functions/manager-conversation/index.ts
- Modify: supabase/functions/manager-conversation-stream/index.ts
- Modify: src/production-supabase-service.test.ts
- Modify: src/manager-conversation-context.test.ts
- Create: src/manager-conversation-attachments.test.ts
- Modify: src/openai-manager-conversation-function.test.ts

- [ ] **Step 1: Write failing contract tests**

Add `attachments?: ManagerConversationAttachmentViewModel[]` to artist messages and `attachmentIds?: string[]` to both Manager send methods. Assert the client sends IDs only. Assert loaded message metadata hydrates attachments. Assert the shared edge resolver rejects assets not owned by the active workspace and attached `music_item`; source-contract tests must confirm both edge functions call it before inserting the artist message.

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-supabase-service.test.ts src/manager-conversation-context.test.ts src/manager-conversation-attachments.test.ts src/openai-manager-conversation-function.test.ts -t "attachment"

Expected: FAIL because attachment contracts and normalization do not exist.

- [ ] **Step 3: Add shared normalization types**

Use one persisted metadata shape:

    type ManagerMessageAttachment = {
      id: string;
      musicItemId: string;
      title: string;
      assetType: string;
      group: "Audio" | "Artwork" | "Documents";
      status: string;
    };

Add a bounded browser normalizer in `productionSupabase.ts`. Put edge normalization and validation once in `attachments.ts`; do not copy it into both endpoints. Limit one message to 12 attachments, deduplicate requested IDs, and reject blank IDs/titles.

- [ ] **Step 4: Resolve attachments server-side before inserting the artist message**

Export this exact shared boundary:

    export async function resolveManagerMessageAttachments(
      db: any,
      owner: { accountId: string; artistWorkspaceId: string; artistId: string },
      subject: { type: "music_item" | "music_project"; id: string } | null,
      attachmentIds: unknown,
    ): Promise<ManagerMessageAttachment[]>;

In both Manager edge functions, after `ensureMusicConversationSubjectLink` and before `insertConversationMessage`, call it with the confirmed subject. It returns `[]` when no IDs were requested. If IDs were requested without a `music_item`, throw `Files can only be attached to a song conversation.` Otherwise query `music_assets` using account, workspace, artist, `music_item_id`, and `.in("id", uniqueIds)`. Throw `One or more attached files do not belong to this song.` if the validated count differs from the unique requested count.

Pass the validated rows—not client titles—into `managerArtistMessageMetadata(input, attachments)`.

- [ ] **Step 5: Give the Manager exact attachment context**

Extend `buildManagerConversationModelContext` with validated `attachments` in `common`:

    attachments: normalizeManagerAttachments(input.attachments),

Keep the existing focused-song packet, body, and previous-response behavior. Do not append hidden text to the visible artist body.

- [ ] **Step 6: Hydrate streamed, non-streamed, loaded, and optimistic messages**

Normalize metadata attachments in `toMessageViewModel`, `toConversationViewModel`, `conversationMessageFromRow`, and `conversationViewModel`. Extend `sendManagerMessage` options with attachments; include IDs in `managerInput`, and include full attachment view models in optimistic artist messages so they do not disappear before the completion event.

- [ ] **Step 7: Test and commit**

    npx vitest run src/production-supabase-service.test.ts src/manager-conversation-context.test.ts src/manager-conversation-attachments.test.ts src/openai-manager-conversation-function.test.ts src/production-app-shell.test.tsx -t "attachment"
    git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/app/ProductionApp.tsx supabase/functions/_shared/manager-conversation/attachments.ts supabase/functions/_shared/manager-conversation/context.ts supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/production-supabase-service.test.ts src/manager-conversation-context.test.ts src/manager-conversation-attachments.test.ts src/openai-manager-conversation-function.test.ts src/production-app-shell.test.tsx
    git commit -m "feat: persist manager song attachments"

Expected: PASS; no database migration is present.

## Task 9: Add song-only upload staging to the conversation composer

**Files:**

- Create: src/features/manager/ManagerSongAttachments.tsx
- Modify: src/features/manager/ManagerComposer.tsx
- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/app/ProductionApp.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing visibility tests**

Render general, project, and song conversations. Assert `Add files to Summer` exists only for the song. Assert there is no disabled paperclip, Choose song, Create song, or upload explanation in the other two states.

- [ ] **Step 2: Write failing staging tests**

Select multiple files through a hidden `input[type=file][multiple]`. Assert confident files begin canonical upload, ambiguous files require an existing asset type, progress rows use filename and percent, send remains disabled until every job is complete, failed jobs expose Retry, and removing a completed job does not call a delete method.

- [ ] **Step 3: Implement attachment job state**

Use this discriminated state in `ConversationWorkspace`:

    type ManagerAttachmentJob = {
      localId: string;
      file: File;
      assetType?: string;
      group: "Audio" | "Artwork" | "Documents";
      state: "needs_classification" | "uploading" | "ready" | "failed";
      progress: MusicUploadProgress;
      attachment?: ManagerConversationAttachmentViewModel;
      error?: string;
    };

Upload with the existing `musicRepository.uploadAsset(conversation.musicSubject.id, ...)`. Do not upload before a song ID exists. Revoke no canonical asset when removing a ready job; only remove it from local pending-message state.

- [ ] **Step 4: Build the compact staging UI**

`ManagerSongAttachments` renders bounded rows above the text field: filename, type, textual phase/percent, and remove or retry. Ambiguous type selection uses only existing asset values: Audio (`final_master`, `rough_mix`, `clean_version`, `instrumental`, `stems`), Artwork (`cover_art`, `press_photo`, `alternate_artwork`), and Documents (`lyrics`, `split_sheet`, `rights_document`, `other`). Labels are humanized; raw values never appear in the UI. Keep the list internally scrollable after three rows. The paperclip is 40–44px, has tooltip and `aria-label="Add files to Summer"`, and opens the native picker directly.

- [ ] **Step 5: Send and render ready attachments**

`handleSend` requires non-empty text or at least one ready attachment. For an attachment-only send, construct the visible body as `Attached {filename}.` or `Attached {N} files: {comma-separated filenames}.` so the existing non-empty Manager directive contract remains valid. Send all ready attachment IDs and view models, then clear jobs only after optimistic insertion succeeds. Artist messages render quiet attachment rows beneath the bubble. On click, use `musicRepository.getAssetAccessUrl` when available; otherwise call the existing Files navigation callback. Always expose `Open in Files` as the secondary action.

- [ ] **Step 6: Verify composer-mode precedence**

Guided context mode replaces ordinary chat and hides the paperclip. A file upload in progress prevents entering guided mode only if the current response cannot yet exist; once the Manager has asked context questions, there can be no unsent prior draft jobs. Add an invariant test to prevent both modes rendering simultaneously.

- [ ] **Step 7: Test and commit**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "song attachments|paperclip|upload progress|guided context"
    git add src/features/manager/ManagerSongAttachments.tsx src/features/manager/ManagerComposer.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ConversationWorkspace.tsx src/app/ProductionApp.tsx src/production-app-shell.test.tsx
    git commit -m "feat: upload song files from manager conversations"

Expected: PASS with no upload affordance outside song conversations.

## Task 10: Replace redundant Manager loaders with one evolving activity turn

**Files:**

- Create: src/features/manager/ManagerActivity.tsx
- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/features/manager/ManagerScreens.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing activity hierarchy tests**

Assert a pending turn contains exactly one `AppThinkingOrb`, one normalized status, and no Manager avatar, speaker label, `BorderBeam`, bordered activity card, duplicate orb, or expanded step list. After `assistant.delta`, assert the activity disappears and prose occupies the same Manager turn. After failure, assert only the failure and Retry remain.

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "single manager activity"

Expected: FAIL against `ThinkingIndicator` and `ManagerActivityStatus`.

- [ ] **Step 3: Implement one status normalizer**

Move the useful mappings from `activityStatusLine` into `ManagerActivity.tsx`. Export `normalizeManagerActivityLabel(label, prompt)` and `currentObservableStep(run)`. Preserve existing event-derived specificity, but map internal tool labels to plain actions and never produce percentages, elapsed time, promises, or reasoning claims.

- [ ] **Step 4: Implement one inline activity component**

    export function ManagerActivity({ run, prompt }: Props) {
      const step = currentObservableStep(run);
      return (
        <div data-testid="manager-activity-current" role="status" aria-live="polite" className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <AppThinkingOrb state={orbStateForLabel(step?.label ?? "")} size={18} />
          <span>{normalizeManagerActivityLabel(step?.label ?? "Manager is working", prompt)}</span>
        </div>
      );
    }

Render it only while the active Manager turn has no prose and no failure. Remove `ThinkingIndicator`, `ManagerActivityStatus`, their details disclosure, duplicate icon wrappers, and the manager-feature import of `BorderBeam`.

- [ ] **Step 5: Keep durable background work outside chat**

Add regression assertions that the sparse conversation list still shows only title and optional time; do not add running badges or spinners. Leave `WorkspaceActivityCenter`, `activeWorkspaceRuns`, and full-screen branded loading unchanged.

- [ ] **Step 6: Add reduced-motion behavior**

Pass or style the existing orb so `prefers-reduced-motion` removes decorative motion while retaining text status. Ensure upload progress and guided-question transitions do not instantiate `ManagerActivity`.

- [ ] **Step 7: Test and commit**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "single manager activity|conversation list|reduced motion"
    git add src/features/manager/ManagerActivity.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ConversationWorkspace.tsx src/features/manager/ManagerScreens.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: unify manager conversation loading"

Expected: PASS with exactly one conversation activity indicator.

## Task 11: Make release and research artifacts progressively disclosed

**Files:**

- Modify: src/features/manager/ReleaseSuccessArtifact.tsx
- Modify: src/features/manager/OpportunityArtifact.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing Release Success hierarchy tests**

For assessed state, assert one conclusion and one next action are visible while foundation and campaign groups are not initially visible. For approval, assert exact dates and approval remain visible. For applied and failed states, assert only the current state is present. Retain the current approval callback assertion.

- [ ] **Step 2: Write failing research hierarchy tests**

    expect(within(artifact).getByText("Best match")).toBeInTheDocument();
    expect(within(artifact).getByText("4 matches reviewed")).toBeInTheDocument();
    expect(within(artifact).getByText("Primary Curator")).toBeInTheDocument();
    expect(within(artifact).queryByText("Secondary Curator")).not.toBeInTheDocument();

    fireEvent.click(within(artifact).getByRole("button", { name: "View all matches" }));
    expect(within(artifact).getByText("Secondary Curator")).toBeInTheDocument();

- [ ] **Step 3: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "release|opportunity|research"

Expected: new hierarchy assertions FAIL.

- [ ] **Step 4: Restyle Release Success only**

Keep canApprove, request construction, assessment, review, keep date, approval, applying, receipt, retry, song, mission, error, and error boundary logic. Use one neutral result frame. Default shows headline, supporting line, and one primary action. Approval-required state shows exact consequential change. Details remain behind the existing review/disclosure path. Do not change state derivation or data.

- [ ] **Step 5: Collapse OpportunityArtifact by default**

Keep selected target, pitch preparation, outcome recording, public source, Files, Mission, clipboard, and retry behavior. Add only local detailsExpanded state. Use artifact.shortlist[0] ?? artifact.watch[0] as the strongest existing item; do not rerank.

Default shows "Best match", total reviewed count, strongest target, and View all matches. Expanded state renders the existing target sections and detail controls.

- [ ] **Step 6: Test and commit**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "release|opportunity|research"
    git add src/features/manager/ReleaseSuccessArtifact.tsx src/features/manager/OpportunityArtifact.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: progressively disclose manager results"

Expected: PASS before commit.

## Task 12: Add responsive, accessibility, theme, and motion safeguards

**Files:**

- Modify: src/index.css
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ManagerArtifacts.tsx
- Modify: src/features/manager/ManagerComposer.tsx
- Modify: src/features/manager/ManagerSongAttachments.tsx
- Modify: src/features/manager/ManagerActivity.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing safeguards**

Assert polite activity status, `aria-pressed` on guided choices, labelled question position, text-labelled upload progress, `aria-expanded` on draft and research disclosure, safe-area syntax in ConversationWorkspace, and absence of hover lift and `shadow-md` in ManagerArtifacts.

- [ ] **Step 2: Add CSS safeguards**

    @media (prefers-reduced-motion: reduce) {
      .manager-conversation-motion {
        transition-duration: 0.01ms !important;
      }
    }

    @media (max-width: 359px) {
      .manager-result-actions {
        align-items: stretch;
        flex-direction: column;
      }

      .manager-result-actions > button,
      .manager-result-actions > a {
        justify-content: center;
        min-height: 44px;
        width: 100%;
      }
    }

- [ ] **Step 3: Audit semantics**

Use article for messages, section for contained results, button for actions, anchor only for external URLs, label for inputs, visible focus, and 40–44px minimum controls. Ensure question progress is not conveyed by dots alone, upload state is not conveyed by a bar alone, and color is not the only state signal. Verify both themes use existing tokens. `thinking-orbs` already renders a static frame for `prefers-reduced-motion`; verify that behavior instead of replacing the design-system orb.

- [ ] **Step 4: Run focused tests and commit**

    npx vitest run src/features/manager/managerPresentation.test.ts src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads
    git add src/index.css src/features/manager/ConversationWorkspace.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ManagerArtifacts.tsx src/features/manager/ManagerComposer.tsx src/features/manager/ManagerSongAttachments.tsx src/features/manager/ManagerActivity.tsx src/production-app-shell.test.tsx
    git commit -m "fix: harden manager conversation responsiveness"

Expected: PASS before commit.

## Task 13: Verify the complete application and every key visual state

**Files:**

- Modify only when verification exposes a defect in the planned files.

- [ ] **Step 1: Run all tests**

    npm test

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 2: Run the production build**

    npm run build

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Start the local application**

    npm run dev -- --host 127.0.0.1 --port 5186

Expected: Vite serves http://127.0.0.1:5186/.

- [ ] **Step 4: Inspect the Office at 320×568, 390×844, 768×1024, 1280×800, and 1440×900**

Verify composer priority; title-and-time-only rows; long-title truncation; absence of summaries, previews, badges, row icons, and card walls; existing empty, pending, Mission Genesis, and error behavior; keyboard focus order.

- [ ] **Step 5: Inspect conversation states at all widths**

Verify ordinary dialogue, long rich text, song/task context, the single working indicator, replacement by streaming prose, retry, every guided-question type, Back, final submission failure recovery, general/project conversations without upload, song attachment classification/upload/remove/retry, grouped workspace result, independent missions, draft collapsed/expanded, every release state, research collapsed/expanded, decision package, composer growth, both themes, reduced motion, no 320px overflow, and tail clearance.

- [ ] **Step 6: Verify routes and callbacks**

1. Add release files opens existing song Files.
2. View mission opens existing Mission room.
3. Task actions open existing tasks.
4. Draft expands inline and task navigation works.
5. Release approval shows the exact change and uses the existing approval boundary.
6. Opportunity actions prepare pitch, record outcome, open source, open Files, and retry.
7. Back returns to Manager's Office.
8. General and project conversations expose no upload control.
9. A song conversation uploads to canonical Files and its sent attachment survives conversation reload.
10. Removing a completed staged upload does not delete the canonical song asset.
11. Preset questions make no intermediate Manager request and submit one complete answer payload.
12. Manager thinking shows exactly one small `AppThinkingOrb`; prose, failure, or result replaces it.

- [ ] **Step 7: Inspect the diff**

    git diff --check
    git status --short
    git diff --stat 4703763..HEAD

Expected: no whitespace errors; only files listed in this plan changed; unrelated user files remain untouched.

- [ ] **Step 8: Commit verification corrections only when needed**

    git add src/features/manager src/features/music src/app/ProductionApp.tsx src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts supabase/functions/_shared/manager-conversation/context.ts supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/design-system/components.tsx src/index.css src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/manager-conversation-context.test.ts src/openai-manager-conversation-function.test.ts
    git commit -m "fix: polish manager conversation visual states"

Do not create an empty commit.

## Final acceptance gate

Confirm every acceptance criterion in docs/superpowers/specs/2026-08-13-manager-conversation-ui-overhaul-design.md against implementation and browser evidence. The result fails if it leaves an artifact detached from its turn, repeats created objects, exposes conversation previews in the Office, allows upload without a song, creates temporary attachment storage, sends between preset questions, duplicates Manager loading indicators, or overlaps/overflows on mobile.
