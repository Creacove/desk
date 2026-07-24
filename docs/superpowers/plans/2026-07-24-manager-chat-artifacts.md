# Manager Chat Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task drafts read as expandable documents, prevent task chat from re-announcing its mission, and anchor the Manager composer as a stable conversation dock.

**Architecture:** Extend the backward-compatible `createdWork` contract with optional task-draft metadata. Enforce task isolation in both Manager endpoints before mission persistence, then render the exact saved draft through a dedicated inline artifact while suppressing redundant mission artifacts in task context.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library, Supabase Edge Functions.

---

### Task 1: Lock the task-chat server invariant

**Files:**
- Modify: `src/manager-intelligence-v1-architecture.test.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`

- [ ] **Step 1: Write the failing endpoint contract test**

Add assertions for both Manager endpoints:

```ts
expect(source).toContain("input.taskId ? [] : await persistManagerMissionGraphDecisions")
expect(source).toContain('artifactKind: "task_draft"')
expect(source).toContain("content: output.responseBody")
expect(source).toContain("managerOutputId: draft.id")
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/manager-intelligence-v1-architecture.test.ts`

Expected: FAIL because task turns still persist mission graph decisions and draft artifacts expose no document metadata.

- [ ] **Step 3: Implement the invariant and draft metadata**

In both endpoints, replace unconditional mission persistence with:

```ts
const persistedWork = input.taskId
  ? []
  : await persistManagerMissionGraphDecisions(db, input, persistenceContext, output);
```

Return these extra fields from `persistTaskDraftOutput`:

```ts
artifactKind: "task_draft" as const,
content: output.responseBody,
managerOutputId: draft.id,
```

Preserve those optional fields in each endpoint's `normalizeCreatedWork` function.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/manager-intelligence-v1-architecture.test.ts`

Expected: PASS.

### Task 2: Render saved drafts as documents

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render a task-scoped `ConversationWorkspace` whose Manager message contains a `task_draft` artifact and a redundant mission artifact. Assert:

```ts
expect(screen.getByRole("button", { name: "Open draft: REVIVAL positioning thesis" })).toHaveAttribute("aria-expanded", "false")
expect(screen.queryByText("FULL DRAFT CONTENT")).not.toBeInTheDocument()
expect(screen.queryByText("Mission created")).not.toBeInTheDocument()
```

Click the draft button and assert:

```ts
expect(screen.getByText("FULL DRAFT CONTENT")).toBeInTheDocument()
expect(screen.getByRole("button", { name: "Close draft: REVIVAL positioning thesis" })).toHaveAttribute("aria-expanded", "true")
```

- [ ] **Step 2: Run the focused component test and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "renders task drafts"`

Expected: FAIL because task drafts still use the ordinary task card and the long Manager body is still rendered.

- [ ] **Step 3: Extend the view-model contract**

Add optional fields to both created-work shapes:

```ts
artifactKind?: "task_draft";
content?: string;
managerOutputId?: string;
```

Preserve those fields in `normalizeCreatedWork`.

- [ ] **Step 4: Add the focused document artifact**

Add `TaskDraftArtifactCard` with:

- a `FileText` icon and `Working draft` label;
- saved-version status and title;
- a two-line preview while closed;
- an accessible expand/collapse button;
- the existing `RichMessageBody` inside the expanded paper surface;
- an `Open task` secondary action.

When a Manager message contains a task draft, replace its ordinary long body with a short lead-in and render the artifact. In task context, filter mission artifacts from that message.

- [ ] **Step 5: Run the focused component test and verify GREEN**

Run: `npm test -- src/production-app-shell.test.tsx -t "renders task drafts"`

Expected: PASS.

### Task 3: Stabilize the conversation composer

**Files:**
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Add a failing source/UI assertion**

Assert the composer has `data-testid="manager-composer-dock"`, no floating shadow treatment, and uses the rail-aligned conversation dock:

```ts
expect(screen.getByTestId("manager-composer-dock")).toHaveClass("border-t")
expect(source).not.toContain("shadow-[0_8px_40px_rgba(0,0,0,0.1)]")
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "keeps the Manager composer"`

Expected: FAIL because the current composer is a detached floating card.

- [ ] **Step 3: Implement the dock**

Use a fixed pane-level dock aligned to the 13.5rem desktop rail, with a top border, opaque/backdrop background, safe-area padding, mobile navigation clearance, and a centered 680px textarea form. Preserve Enter-to-send, Shift+Enter, disabled state, auto-resize, and errors.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/production-app-shell.test.tsx -t "keeps the Manager composer"`

Expected: PASS.

### Task 4: Verify, deploy, and smoke test

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused and full checks**

Run:

```powershell
npm test -- src/manager-intelligence-v1-architecture.test.ts src/production-app-shell.test.tsx
npm test
npm run build
git diff --check
```

Expected: all tests and build pass; no whitespace errors.

- [ ] **Step 2: Deploy server and frontend changes**

Run:

```powershell
npx supabase functions deploy manager-conversation manager-conversation-stream --project-ref bbwbxmnanccwottrmkqu --use-api
npx netlify deploy --prod --dir=dist
```

Expected: both functions become active and Netlify returns the production URL.

- [ ] **Step 3: Run production smoke checks**

Verify the live frontend returns 200, its deployed JavaScript includes the task-draft artifact contract, both functions reject unauthenticated calls, and an authenticated temporary-workspace upload still prepares, stores, finalizes, extracts, links, and cleans up successfully.

- [ ] **Step 4: Commit and push**

Run:

```powershell
git add docs src supabase
git commit -m "feat: refine Manager task conversations"
git push origin main
```

Expected: local `HEAD` equals `origin/main`.
