# Manager Conversation UI Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Rebuild the existing Manager's Office and conversation presentation into a restrained, ChatGPT-caliber interface without adding capabilities or changing Manager, repository, persistence, upload, or navigation behavior.

**Architecture:** Preserve ConversationViewModel, callbacks, stream handling, and application routes. Extract the oversized Manager presentation into focused components, add a pure UI projection that assigns conversation-level artifacts to the final Manager turn and groups duplicate created-work announcements, then restyle each existing surface around one centered conversation grid and one compact artifact grammar.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Vite.

---

## Scope guardrails

Do not add conversation search, filters, grouping, pinning, archive, rename, thread switching, chat uploads, drag-and-drop, attachment staging, file previews, a split-pane editor, a new route, a new repository method, a new stream event, or a database change.

Preserve starting and opening conversations, title stability, streaming, retry, context answers, task-draft expansion, existing navigation, release approval, opportunity actions, scroll ownership, and composer safe-area behavior.

## File map

Create:

- src/features/manager/managerPresentation.ts
- src/features/manager/managerPresentation.test.ts
- src/features/manager/ManagerOfficeScreen.tsx
- src/features/manager/ConversationWorkspace.tsx
- src/features/manager/ManagerMessage.tsx
- src/features/manager/ManagerArtifacts.tsx

Modify:

- src/features/manager/ManagerScreens.tsx
- src/features/manager/ReleaseSuccessArtifact.tsx
- src/features/manager/OpportunityArtifact.tsx
- src/design-system/components.tsx
- src/index.css
- src/production-app-shell.test.tsx

Do not modify behavior in src/app/ProductionApp.tsx, src/types/cleanProduction.ts, src/services/managerConversationStream.ts, repositories, Supabase, edge functions, or upload services.

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

## Task 5: Normalize context, questions, activity, and composer

**Files:**

- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing assertions**

    expect(screen.getByTestId("conversation-song-context")).not.toHaveClass("shadow-sm");
    expect(screen.getAllByTestId("manager-activity-current")).toHaveLength(1);
    expect(screen.getByTestId("manager-composer-dock")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("manager-composer-surface")).toHaveClass("pointer-events-auto", "max-w-[48rem]");

- [ ] **Step 2: Verify failure**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "activity|composer|song context|context questions"

Expected: FAIL against current stacked activity and footer.

- [ ] **Step 3: Simplify existing context**

Song context shows title, lifecycle stage, and existing open action. Task context shows title and Back to task. Remove uppercase labels, descriptive duplication, accent-filled panels, and shadows.

- [ ] **Step 4: Show one current observable activity**

    const currentStep =
      [...run.steps].reverse().find((step) => step.status === "running") ??
      run.steps.at(-1);
    const label = currentStep?.label ?? "Manager is working";

    <div data-testid="manager-activity-current" role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
      <span className="manager-activity-dot h-1.5 w-1.5 rounded-full bg-muted-foreground/65" aria-hidden="true" />
      <span>{normalizeActivityLabel(label)}</span>
    </div>

Do not add percentages, promises, tool payloads, or reasoning.

- [ ] **Step 5: Restyle the existing question form**

Keep answer kinds, options, recommendation helper, I'm not sure, validation, contextResolved, and submission. Use sentence case, one neutral form boundary, minimum 44px controls, and one primary submit action.

- [ ] **Step 6: Float and align the existing composer**

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

Preserve placeholder, Enter, Shift+Enter, growth to 200px, send lock, error, safe area, rail offset, and verification note. Add no tool or attachment button.

- [ ] **Step 7: Test and commit**

    npx vitest run src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads -t "activity|composer|song context|context questions|scroll"
    git add src/features/manager/ManagerMessage.tsx src/features/manager/ConversationWorkspace.tsx src/production-app-shell.test.tsx
    git commit -m "refactor: calm manager activity and composer states"

Expected: PASS before commit.

## Task 6: Make release and research artifacts progressively disclosed

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

## Task 7: Add responsive, accessibility, theme, and motion safeguards

**Files:**

- Modify: src/index.css
- Modify: src/features/manager/ConversationWorkspace.tsx
- Modify: src/features/manager/ManagerMessage.tsx
- Modify: src/features/manager/ManagerArtifacts.tsx
- Modify: src/production-app-shell.test.tsx

- [ ] **Step 1: Write failing safeguards**

Assert polite activity status, aria-expanded on draft and research disclosure, safe-area syntax in ConversationWorkspace, and absence of hover lift and shadow-md in ManagerArtifacts.

- [ ] **Step 2: Add CSS safeguards**

    @media (prefers-reduced-motion: reduce) {
      .manager-activity-dot {
        animation: none !important;
      }

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

Use article for messages, section for contained results, button for actions, anchor only for external URLs, label for inputs, visible focus, and 40–44px minimum controls. Ensure color is not the only state signal. Verify both themes use existing tokens.

- [ ] **Step 4: Run focused tests and commit**

    npx vitest run src/features/manager/managerPresentation.test.ts src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads
    git add src/index.css src/features/manager/ConversationWorkspace.tsx src/features/manager/ManagerMessage.tsx src/features/manager/ManagerArtifacts.tsx src/production-app-shell.test.tsx
    git commit -m "fix: harden manager conversation responsiveness"

Expected: PASS before commit.

## Task 8: Verify the complete application and every key visual state

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

Verify ordinary dialogue, long rich text, song/task context, thinking, streaming activity, retry, questions before/after submission, grouped workspace result, independent missions, draft collapsed/expanded, every release state, research collapsed/expanded, decision package, composer growth, both themes, reduced motion, no 320px overflow, and tail clearance.

- [ ] **Step 6: Verify routes and callbacks**

1. Add release files opens existing song Files.
2. View mission opens existing Mission room.
3. Task actions open existing tasks.
4. Draft expands inline and task navigation works.
5. Release approval shows the exact change and uses the existing approval boundary.
6. Opportunity actions prepare pitch, record outcome, open source, open Files, and retry.
7. Back returns to Manager's Office.
8. No chat upload or file-preview control exists.

- [ ] **Step 7: Inspect the diff**

    git diff --check
    git status --short
    git diff --stat HEAD~7..HEAD

Expected: no whitespace errors; only planned UI, shell, CSS, and test files changed; unrelated user files remain untouched.

- [ ] **Step 8: Commit verification corrections only when needed**

    git add src/features/manager src/design-system/components.tsx src/index.css src/production-app-shell.test.tsx
    git commit -m "fix: polish manager conversation visual states"

Do not create an empty commit.

## Final acceptance gate

Confirm every acceptance criterion in docs/superpowers/specs/2026-08-13-manager-conversation-ui-overhaul-design.md against implementation and browser evidence. The result fails if it adds a feature, leaves an artifact detached from its turn, repeats created objects, exposes conversation previews in the Office, or overlaps/overflows on mobile.
