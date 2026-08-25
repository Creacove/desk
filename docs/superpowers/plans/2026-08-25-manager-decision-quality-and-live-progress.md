# Manager Decision Quality And Live Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give consequential Manager questions a reusable decision-grade reasoning contract while showing the real streamed work phase in the conversation UI.

**Architecture:** Add one pure turn-mode module used by both Manager endpoints. It detects consequential decisions locally, supplies the conditional prompt and reasoning effort, and supplies a truthful analysis-phase label. Reuse the existing SSE run steps and `activeRun.steps`; add one pure UI selector so the V2 conversation renders the latest meaningful status without changing persistence or schemas.

**Tech Stack:** TypeScript, Supabase Edge Functions, OpenAI Responses API wrapper, React 18, Vitest, Testing Library.

---

### Task 1: Consequential-turn classifier and instruction contract

**Files:**
- Create: `supabase/functions/_shared/manager-conversation/decisionGrade.ts`
- Create: `src/manager-decision-quality.test.ts`

- [ ] **Step 1: Write failing classifier and contract tests**

Create table-driven tests that import `classifyManagerTurn`, `decisionGradeInstructions`, and `managerReasoningEffort`. Require five unrelated consequential decisions to classify as `decision_grade`, ordinary questions and document requests to remain `normal`, context answers to participate, the instructions to require objectives/scenarios/mechanics/alternatives/negotiation/open questions, and reasoning effort to be `high` only for decision-grade turns.

```ts
expect(classifyManagerTurn({ body: "Should we take a $30,000 offer for 50% of our masters for seven years?" }).mode).toBe("decision_grade");
expect(classifyManagerTurn({ body: "What does recoupment mean?" }).mode).toBe("normal");
expect(managerReasoningEffort("decision_grade")).toBe("high");
expect(managerReasoningEffort("normal")).toBe("medium");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- --run src/manager-decision-quality.test.ts`

Expected: FAIL because `decisionGrade.ts` does not exist.

- [ ] **Step 3: Implement the pure turn-mode module**

Export:

```ts
export type ManagerTurnMode = "normal" | "decision_grade";
export function classifyManagerTurn(input: { body: string; contextAnswers?: Array<{ questionKey: string; answer: string }> }): { mode: ManagerTurnMode; reason: string };
export function managerReasoningEffort(mode: ManagerTurnMode): "medium" | "high";
export function managerAnalysisPhaseLabel(mode: ManagerTurnMode): string;
export const decisionGradeInstructions: string;
```

Use bounded regular expressions for decision intent, comparison language, and material stakes. Exclude clear artifact-creation requests. The instruction string must be generic, explicitly override the short-paragraph rule for decision-grade turns, distinguish facts/assumptions/unknowns, forbid attention-as-revenue claims, and require the approved decision hierarchy only when relevant.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- --run src/manager-decision-quality.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated domain change**

Run:

```powershell
git add -- 'supabase/functions/_shared/manager-conversation/decisionGrade.ts' 'src/manager-decision-quality.test.ts'
git commit -m "feat: classify decision-grade manager turns"
```

### Task 2: Apply decision-grade mode to both Manager endpoints

**Files:**
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`
- Modify: `src/manager-conversation-stream.test.ts`

- [ ] **Step 1: Write failing endpoint contract tests**

Assert both endpoint sources call `classifyManagerTurn`, append conditional decision-grade instructions, and use `managerReasoningEffort(turn.mode)`. Assert the stream emits `managerAnalysisPhaseLabel(turn.mode)` before provider work and still maps friendly tool labels. Assert no second `runManagerAgentLoop` call is introduced.

```ts
expect(endpointSource).toContain("classifyManagerTurn");
expect(endpointSource).toContain("managerReasoningEffort(turn.mode)");
expect(streamSource).toContain("managerAnalysisPhaseLabel(turn.mode)");
```

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `npm test -- --run src/openai-manager-conversation-function.test.ts src/manager-conversation-stream.test.ts`

Expected: FAIL on the new decision-mode contract assertions.

- [ ] **Step 3: Extend the instruction builder without breaking callers**

Change `buildManagerConversationInstructions` to accept an optional `ManagerTurnMode = "normal"` and append `decisionGradeInstructions` only for `decision_grade`. Preserve the interruption protocol and all existing callers.

- [ ] **Step 4: Wire mode and effort into the non-streamed endpoint**

Classify once from `body` and `contextAnswers` inside the existing call path. Pass the mode to the instruction builder and `managerReasoningEffort`. Do not change tools, output limits, persistence, or provider-call count.

- [ ] **Step 5: Wire mode, effort, and live phase into the streamed endpoint**

Classify once before the agent loop. Emit `run.step` with `managerAnalysisPhaseLabel(turn.mode)` as the running reasoning phase. Pass mode to instructions and effort. Keep existing `tool.started`, `tool.completed`, answer delta, artifact, and completion events unchanged.

- [ ] **Step 6: Run endpoint tests and verify GREEN**

Run: `npm test -- --run src/manager-decision-quality.test.ts src/openai-manager-conversation-function.test.ts src/manager-conversation-stream.test.ts src/manager-agent-loop.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit endpoint integration**

Run:

```powershell
git add -- 'supabase/functions/_shared/openaiManagerConversation.ts' 'supabase/functions/manager-conversation/index.ts' 'supabase/functions/manager-conversation-stream/index.ts' 'src/openai-manager-conversation-function.test.ts' 'src/manager-conversation-stream.test.ts'
git commit -m "feat: raise reasoning for consequential manager decisions"
```

### Task 3: Render the latest truthful Manager progress step

**Files:**
- Create: `src/features/manager/managerRunStatus.ts`
- Modify: `src/features/manager/ManagerConversationV2.tsx`
- Modify: `src/manager-conversation-polish.test.ts`

- [ ] **Step 1: Write failing status-selector and UI tests**

Test the pure selector with multiple queued/running/completed/failed steps. It should choose the most recent running step, fall back to the latest meaningful completed step, sanitize empty labels, and finally return `Manager is working...`. Render `ManagerConversationV2` with `sendPending` and assert the selected label appears with `role="status"`/`aria-live="polite"`, raw tool IDs do not appear, and the loading line disappears when a streaming Manager message exists.

```ts
expect(managerRunStatusLabel([{ id: "packet", label: "Reading workspace packet", status: "completed" }, { id: "analysis", label: "Working through the economics and trade-offs", status: "running" }])).toBe("Working through the economics and trade-offs...");
```

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- --run src/manager-conversation-polish.test.ts`

Expected: FAIL because the selector and live progress rendering do not exist.

- [ ] **Step 3: Implement the pure selector**

Export `managerRunStatusLabel(steps)` from `managerRunStatus.ts`. Normalize trailing punctuation to one ellipsis, accept only non-empty user-facing labels, prefer the last running step, then the last completed step, then the fallback.

- [ ] **Step 4: Replace the fixed V2 loading copy**

Derive the label from `conversation.activeRun?.steps`. Render one compact status paragraph only while `sendPending` is true and no streaming Manager message exists:

```tsx
<p role="status" aria-live="polite" className="text-[12px] font-medium text-muted-foreground">
  {managerRunStatusLabel(conversation.activeRun?.steps)}
</p>
```

- [ ] **Step 5: Run the UI test and verify GREEN**

Run: `npm test -- --run src/manager-conversation-polish.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the progress UI**

Run:

```powershell
git add -- 'src/features/manager/managerRunStatus.ts' 'src/features/manager/ManagerConversationV2.tsx' 'src/manager-conversation-polish.test.ts'
git commit -m "feat: show live manager work phases"
```

### Task 4: Verification and delivery

**Files:**
- Verify all task-related files and repository state.

- [ ] **Step 1: Run focused Manager verification**

Run:

```powershell
npm test -- --run src/manager-decision-quality.test.ts src/openai-manager-conversation-function.test.ts src/manager-conversation-stream.test.ts src/manager-agent-loop.test.ts src/manager-conversation-context.test.ts src/manager-turn-contract.test.ts src/manager-conversation-polish.test.ts
```

Expected: all selected test files pass with zero failures.

- [ ] **Step 2: Run the full test suite**

Run: `npm test -- --run`

Expected: zero failed tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits with code 0.

- [ ] **Step 4: Audit the final diff and worktree**

Run:

```powershell
git diff HEAD~3 --check
git status --short
git log -4 --oneline --decorate
```

Expected: no whitespace errors; only the pre-existing untracked Playwright artifacts remain; commits are on `main`.

- [ ] **Step 5: Push the authorized branch**

Run: `git push origin main`

Expected: `main` advances on `origin/main` to the final verified commit.
