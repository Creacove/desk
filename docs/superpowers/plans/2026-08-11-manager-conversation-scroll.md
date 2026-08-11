# Manager conversation streaming scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Manager chat keep the latest user/thinking/streaming content visible without competing scroll animations on desktop or mobile.

**Architecture:** Keep the existing document scroll model and fixed composer. `ConversationWorkspace` becomes the sole scroll owner: it scrolls one tail spacer/anchor, coalesces stream-driven updates in animation frames, and pauses follow mode when the user scrolls upward. `useTypewriter` remains a visual renderer only and no longer performs scrolling.

**Tech Stack:** React 18 hooks, TypeScript, Testing Library, Vitest, Tailwind utility classes.

---

### Task 1: Add a failing regression test for competing scroll writers

**Files:**
- Modify: `src/production-app-shell.test.tsx` near the direct `ConversationWorkspace` tests.

- [ ] **Step 1: Write the failing test**

Add a direct component test that installs a `scrollIntoView` spy, renders a pending conversation, rerenders it with a streaming Manager message, and asserts the tail is scrolled by the workspace controller while no per-character scroll call is made. The test should also assert the tail element has bottom-clearance markup:

```tsx
it("uses one tail scroll controller while Manager content streams", async () => {
  const scrollIntoView = vi.fn();
  const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

  const base: ConversationViewModel = {
    id: "conv-scroll",
    topic: "Release planning",
    status: "Manager is thinking",
    summary: "Release planning thread.",
    prompt: "Plan the release.",
    activeRun: { id: "run-scroll", status: "running", streamedText: "", steps: [{ id: "start", label: "Starting Manager run", status: "running" }] },
    messages: [{ id: "artist-1", speaker: "artist", label: "You", body: "Plan the release." }],
    createdWork: [],
  };

  try {
    const { rerender } = render(
      <ConversationWorkspace
        conversation={base}
        onBack={() => undefined}
        onOpenCreatedWork={() => undefined}
        onSendMessage={() => undefined}
        onSendContextAnswers={() => undefined}
        sendPending
        sendError={null}
      />,
    );

    await act(async () => undefined);
    const initialCalls = scrollIntoView.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);
    expect(screen.getByTestId("manager-chat-tail")).toHaveClass("h-32");

    rerender(
      <ConversationWorkspace
        conversation={{
          ...base,
          activeRun: { ...base.activeRun!, streamedText: "The Manager is reviewing the release context." },
          messages: [
            ...base.messages,
            { id: "manager-stream", speaker: "manager", label: "Manager", body: "The Manager is reviewing the release context.", status: "streaming" },
          ],
        }}
        onBack={() => undefined}
        onOpenCreatedWork={() => undefined
        }
        onSendMessage={() => undefined}
        onSendContextAnswers={() => undefined}
        sendPending
        sendError={null}
      />,
    );

    await act(async () => undefined);
    const callsAfterRender = scrollIntoView.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(scrollIntoView.mock.calls.length).toBeLessThanOrEqual(callsAfterRender + 1);
  } finally {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: previousScrollIntoView });
  }
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- --run src/production-app-shell.test.tsx -t "uses one tail scroll controller while Manager content streams"
```

Expected: FAIL because the current typewriter and workspace effects both write to the tail, and no `manager-chat-tail` spacer exists.

### Task 2: Make `ConversationWorkspace` the single scroll owner

**Files:**
- Modify: `src/features/manager/ManagerScreens.tsx:5-76,337-575`.

- [ ] **Step 1: Remove the typewriter scroll side effect**

Delete the `useTypewriter` effect that calls `document.getElementById("chat-scroll-anchor").scrollIntoView`. Keep the typewriter requestAnimationFrame loop and rendered output unchanged.

- [ ] **Step 2: Add one local tail controller**

Import `useCallback` and `useLayoutEffect`. Add refs for the message list, tail spacer, pending animation frame, follow mode, and previous stream state. Implement `scrollToTail(behavior)` with a guarded `scrollIntoView({ block: "end", behavior })`; schedule stream updates through one `requestAnimationFrame`; use `useLayoutEffect` for the initial/pending reposition and the first streamed reply; and observe the message list with `ResizeObserver` so typewriter layout growth stays attached without per-character scroll calls.

- [ ] **Step 3: Pause follow mode on upward user scroll**

Listen to the document scroll position in a passive effect. When the page moves upward, set the follow ref false; when it reaches the latest threshold (`innerHeight + scrollY >= documentElement.scrollHeight - 160`), set it true. `handleSend` resets follow mode before invoking `onSendMessage`.

- [ ] **Step 4: Reserve composer clearance**

Attach the message-list ref to the existing message flex column and replace the zero-height `chat-scroll-anchor` with a `data-testid="manager-chat-tail"` spacer using `h-32 shrink-0`. Keep the existing bottom page padding for artifact/decision content. This spacer is the scroll target, so the thinking indicator and streamed tail remain above the fixed composer.

### Task 3: Run the regression and existing Manager coverage

**Files:**
- Test only: `src/production-app-shell.test.tsx`.

- [ ] **Step 1: Run the new regression test**

```bash
npm test -- --run src/production-app-shell.test.tsx -t "uses one tail scroll controller while Manager content streams"
```

Expected: PASS.

- [ ] **Step 2: Run the existing Manager stream tests**

```bash
npm test -- --run src/production-app-shell.test.tsx -t "continues Manager chat messages in place|opens a new Manager conversation immediately and streams the reply in place|keeps a completed streamed Manager reply"
```

Expected: PASS with the pending indicator, stream deltas, and final reply still rendered.

### Task 4: Verify the complete change

- [ ] **Step 1: Run the full Vitest suite**

```bash
npm test
```

Expected: exit code 0 with no failed tests.

- [ ] **Step 2: Build the production bundle**

```bash
npm run build
```

Expected: exit code 0 with a generated `dist` bundle.

- [ ] **Step 3: Review the diff and commit**

```bash
git diff --check
git status --short
git add src/features/manager/ManagerScreens.tsx src/production-app-shell.test.tsx
git commit -m "fix: stabilize manager conversation streaming scroll"
```

The existing untracked `.playwright-cli` files must remain unstaged.
