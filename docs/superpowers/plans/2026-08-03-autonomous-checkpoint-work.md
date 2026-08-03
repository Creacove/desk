# Autonomous Checkpoint Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make checkpoints deliver an evidence-backed Manager read while keeping uploads optional and showing artists only work that genuinely requires human action.

**Architecture:** Extend the Mission Genesis checkpoint contract with `managerRead` and `nextAction`, persist both into existing checkpoint columns, and allow plans with no artist tasks. Treat exact `Manager` ownership as internal work in legacy projections and review completion checks; keep the current upload pipeline as optional enrichment rather than adding schema or orchestration infrastructure.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Supabase Edge Functions (Deno/TypeScript), PostgreSQL finalizer SQL.

---

## File map

- `supabase/functions/_shared/openaiMissionGenesis.ts`: generation schema, prompt, parser, and contract validation.
- `supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts`: pattern hints that must distinguish Manager analysis from human work.
- `supabase/functions/_shared/missionGraphPersistence.ts`: direct Edge Function graph persistence.
- `supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql`: source of the current SQL finalizer definition; read but do not edit.
- `supabase/migrations/20260803000100_autonomous_checkpoint_work.sql`: deployed SQL finalizer replacement with checkpoint-read semantics; no table or data changes.
- `src/services/productionSupabase.ts`: legacy task projection and checkpoint display-state normalization.
- `src/types/cleanProduction.ts`: artist-facing task semantics helper input remains unchanged; no new persisted type is required.
- `src/features/missions/MissionScreens.tsx`: optional attachment UX and zero-artist-task empty state.
- `supabase/functions/manager-review-task-result/index.ts`: optional document review and legacy Manager-row completion filtering.
- `src/openai-mission-genesis-function.test.ts`: generation contract regression tests.
- `src/mission-pattern-registry.test.ts`: registry guidance regression tests.
- `src/production-supabase-service.test.ts`: legacy projection coverage.
- `src/mission-task-deliverables.test.tsx`: optional attachment and zero-task UI coverage.
- `src/manager-review-task-result-function.test.ts`: backend source-contract coverage.

### Task 1: Correct the Mission Genesis ownership contract

**Files:**
- Modify: `src/openai-mission-genesis-function.test.ts`
- Modify: `supabase/functions/_shared/openaiMissionGenesis.ts`

- [ ] **Step 1: Write failing contract tests for checkpoint reads, zero-task plans, and internal analysis rejection**

Add focused tests beside the existing Mission Genesis validation tests:

```ts
it("accepts a useful checkpoint with a Manager read and no artist task", () => {
  const output = activeOutput();
  output.checkpoints[0].managerRead = "London attention is credible, but the packet does not yet prove repeat artist attachment.";
  output.checkpoints[0].nextAction = "Nothing needed from the artist; keep watching repeat listening and profile movement.";
  output.tasks = [];

  const parsed = parseMissionGenesisOutput(output, packet, "initial");

  expect(parsed.tasks).toEqual([]);
  expect(parsed.checkpoints[0]).toMatchObject({
    managerRead: expect.stringContaining("does not yet prove"),
    nextAction: expect.stringContaining("Nothing needed"),
  });
});

it("rejects Manager analysis disguised as a visible task", () => {
  const output = activeOutput();
  output.checkpoints[0].managerRead = "The existing packet supports a cautious hold.";
  output.checkpoints[0].nextAction = "Nothing needed from the artist.";
  output.tasks[0] = {
    ...output.tasks[0],
    ownerRole: "Manager",
    completionMode: "evidence",
    title: "Validate whether attention becomes artist leverage",
    steps: ["Review stream and playlist evidence.", "Issue a continue, pause, or scale recommendation."],
  };

  expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/Manager analysis.*checkpoint read/i);
});

it("rejects a generated upload gate", () => {
  const output = activeOutput();
  output.checkpoints[0].managerRead = "Proceed with limited confidence from available evidence.";
  output.checkpoints[0].nextAction = "Continue the low-risk validation path.";
  output.tasks[0] = { ...output.tasks[0], completionMode: "evidence" };

  expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/uploads.*optional/i);
});
```

- [ ] **Step 2: Run the focused tests and confirm the contract is missing**

Run:

```powershell
npm test -- src/openai-mission-genesis-function.test.ts
```

Expected: FAIL because checkpoints do not parse `managerRead`/`nextAction`, active missions require at least one task, and Manager/evidence tasks are still accepted.

- [ ] **Step 3: Extend the checkpoint type and JSON schemas without adding database fields**

Add the fields to `MissionGenesisCheckpoint`, to both checkpoint schema definitions, and to `readCheckpoints`:

```ts
export type MissionGenesisCheckpoint = {
  key: string;
  title: string;
  question: string;
  decisionRule: string;
  managerRead: string;
  nextAction: string;
  requiredEvidence: string[];
  missingEvidence: string[];
  sourceRefs: string[];
};
```

The schema `required` list must include `managerRead` and `nextAction`, with both properties typed as strings. Parse them as required non-empty strings:

```ts
managerRead: readString(item.managerRead, "checkpoints.managerRead", true),
nextAction: readString(item.nextAction, "checkpoints.nextAction", true),
```

Update every checkpoint literal in `src/openai-mission-genesis-function.test.ts` with concrete `managerRead` and `nextAction` values. Do not make the parser default these fields: a missing read is exactly the broken product state this contract must reject.

- [ ] **Step 4: Replace the “every mission needs a task” rule with the human-work rule**

Update the prompt so it explicitly says:

```ts
"A visible task exists only when the artist or team must decide, approve, perform an external action, or report an offline outcome. Research, comparison, synthesis, monitoring, and recommendations are Manager work: put the result in checkpoint.managerRead and do not create a task.",
"A mission may contain zero tasks when the packet already supports the Manager read and nothing is needed from the artist. Every active mission still requires at least one checkpoint.",
"Uploads are optional context only. Never create completionMode evidence in a new plan, never make an upload a checkpoint gate, and proceed with a limited or conservative recommendation when private data is unavailable.",
"checkpoint.managerRead states what the available evidence means now. checkpoint.nextAction names one human action or explicitly says that nothing is needed from the artist while the Manager watches signals.",
```

Change activation/update/candidate validation from “checkpoints and tasks” to “checkpoints” only. Add one validator called from `validateMissionJudgeSurface`:

```ts
function validateHumanTaskContract(tasks: MissionGenesisTask[], label: string) {
  for (const task of tasks) {
    if (task.ownerRole.trim().toLowerCase() === "manager") {
      throw new Error(`${label} returned Manager analysis as a visible task; put the result in the checkpoint read.`);
    }
    if (task.completionMode === "evidence") {
      throw new Error(`${label} returned a required upload even though uploads must remain optional context.`);
    }
    const taskText = [task.title, task.purpose, ...task.steps].join(" ");
    const analysisOnly = /\b(review|analy[sz]e|compare|research|assess|validate|monitor|issue a recommendation)\b/i.test(taskText)
      && !/\b(approve|choose|decide|publish|send|sign|perform|record|report|confirm|attend|schedule)\b/i.test(taskText);
    if (analysisOnly) {
      throw new Error(`${label} returned analysis-only work as a visible human task.`);
    }
  }
}
```

Include `managerRead` and `nextAction` in visible-plan and judge-surface text so personalization and generic-copy checks cover what the artist sees.

- [ ] **Step 5: Run the focused tests**

Run:

```powershell
npm test -- src/openai-mission-genesis-function.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the generation contract**

```powershell
git add src/openai-mission-genesis-function.test.ts supabase/functions/_shared/openaiMissionGenesis.ts
git commit -m "fix: keep manager analysis out of artist tasks"
```

### Task 2: Make mission patterns suggest human work, not Manager research

**Files:**
- Modify: `src/mission-pattern-registry.test.ts`
- Modify: `supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts`

- [ ] **Step 1: Write a failing registry test for the affected patterns**

Add:

```ts
it("keeps analysis in checkpoint reads and task hints limited to human actions", () => {
  const registry = getMissionPatternRegistry();
  for (const key of ["focus_asset_selection", "collaboration_strategy", "catalog_asset_narrative", "fan_ownership"]) {
    const pattern = registry.find((candidate) => candidate.key === key);
    expect(pattern?.taskTypes.join(" ")).not.toMatch(/\b(compare|map feature attachment|measure artist attachment|review fan language)\b/i);
    expect(pattern?.taskTypes.join(" ")).toMatch(/\b(approve|choose|publish|report|authorize)\b/i);
  }

  const sourcePattern = registry.find((candidate) => candidate.key === "data_source_completeness");
  expect(sourcePattern?.blockageState).toMatch(/limitation|conservative recommendation/i);
  expect(sourcePattern?.taskTypes.join(" ")).not.toMatch(/upload CSV|upload file/i);
});
```

- [ ] **Step 2: Run the registry test and verify it fails**

Run:

```powershell
npm test -- src/mission-pattern-registry.test.ts
```

Expected: FAIL on the current analysis/upload-oriented task hints.

- [ ] **Step 3: Rewrite only the affected task hints**

Keep the registry shape unchanged. Replace analysis-oriented `taskTypes` with human actions:

```ts
// focus_asset_selection
taskTypes: ["choose focus asset", "approve creative rationale", "authorize a low-risk test", "report offline response"],

// collaboration_strategy
taskTypes: ["approve artist-centered narrative", "choose catalog route", "authorize collaborator outreach", "report collaborator outcome"],

// catalog_asset_narrative
taskTypes: ["approve song role", "approve narrative angle", "publish approved catalog route", "report audience response"],

// fan_ownership
taskTypes: ["choose owned fan path", "approve fan-facing language", "publish approved route", "report community response"],

// data_source_completeness
taskTypes: ["choose whether to connect a source", "approve private-data access", "confirm source identity", "accept the stated limitation"],
blockageState: "The source limitation lowers confidence and may require a conservative recommendation, but it does not block use of the app.",
```

Do not rename `taskTypes` or add a new registry layer.

- [ ] **Step 4: Run the registry and Mission Genesis tests**

Run:

```powershell
npm test -- src/mission-pattern-registry.test.ts src/openai-mission-genesis-function.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the pattern correction**

```powershell
git add src/mission-pattern-registry.test.ts supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts
git commit -m "fix: make mission patterns generate human work"
```

### Task 3: Persist useful checkpoint reads in both graph writers

**Files:**
- Modify: `src/openai-mission-genesis-function.test.ts`
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts`
- Create: `supabase/migrations/20260803000100_autonomous_checkpoint_work.sql`

- [ ] **Step 1: Add failing source-contract assertions for persistence parity**

Add a test beside the existing graph/finalizer source checks:

```ts
it("persists checkpoint-specific reads and starts no-task checkpoints in watching state", () => {
  expect(graphPersistenceSource).toContain("recommendation: checkpoint.managerRead");
  expect(graphPersistenceSource).toContain("next_action: checkpoint.nextAction");
  expect(graphPersistenceSource).toContain('status: hasArtistTask ? "waiting" : "watching_signal"');

  expect(existsSync(autonomousCheckpointMigrationPath)).toBe(true);
  expect(autonomousCheckpointMigration).toContain("create or replace function public._apply_mission_genesis_graph_v2");
  expect(autonomousCheckpointMigration).toContain("checkpoint ->> 'managerRead'");
  expect(autonomousCheckpointMigration).toContain("checkpoint ->> 'nextAction'");
  expect(autonomousCheckpointMigration).toContain("'watching_signal'");
});
```

Define `autonomousCheckpointMigrationPath` and `autonomousCheckpointMigration` beside the test file’s existing migration-source constants.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- src/openai-mission-genesis-function.test.ts
```

Expected: FAIL because both writers currently copy the mission recommendation and always persist `waiting`.

- [ ] **Step 3: Update direct graph persistence**

Before each checkpoint insert, derive whether the checkpoint has a non-Manager task:

```ts
const hasArtistTask = decision.tasks.some((task) =>
  task.primaryCheckpointKey === checkpoint.key && task.ownerRole.trim().toLowerCase() !== "manager"
);
```

Persist:

```ts
status: hasArtistTask ? "waiting" : "watching_signal",
recommendation: checkpoint.managerRead,
next_action: checkpoint.nextAction,
```

Keep `required_evidence` and `missing_evidence` unchanged as context/limitations.

- [ ] **Step 4: Ship a replacement SQL finalizer with equivalent logic**

Create `supabase/migrations/20260803000100_autonomous_checkpoint_work.sql`. Copy the complete current `public._apply_mission_genesis_graph_v2` definition from `20260728000400_todays_brief_and_mission_finalizers.sql` so the deployed function is replaced safely. In its checkpoint insert, add `next_action` to the column list and replace the fixed status and mission-level recommendation with this exact value sequence:

```sql
case when exists (
  select 1
  from jsonb_array_elements(coalesce(decision -> 'tasks', '[]'::jsonb)) as candidate_task(value)
  where candidate_task.value ->> 'primaryCheckpointKey' = checkpoint ->> 'key'
    and lower(trim(coalesce(candidate_task.value ->> 'ownerRole', ''))) <> 'manager'
) then 'waiting'::public.checkpoint_status
else 'watching_signal'::public.checkpoint_status
end,
checkpoint ->> 'managerRead',
checkpoint ->> 'nextAction',
```

The final insert columns and corresponding values must be ordered as:

```sql
question, reason_for_checkpoint, watched_signals, decision_rule, recommendation, next_action,
required_evidence, missing_evidence, custom_reason, created_from_run_id, created_from_action_id
```

```sql
checkpoint ->> 'question', checkpoint ->> 'question',
public._mission_genesis_text_array(checkpoint -> 'sourceRefs'), checkpoint ->> 'decisionRule',
checkpoint ->> 'managerRead', checkpoint ->> 'nextAction',
public._mission_genesis_text_array(checkpoint -> 'requiredEvidence'),
public._mission_genesis_text_array(checkpoint -> 'missingEvidence'),
'Manager-authored checkpoint grounded in packet refs: ' || array_to_string(public._mission_genesis_text_array(checkpoint -> 'sourceRefs'), ', '),
target_run_id, target_action_id
```

Do not modify the old migration and do not add table changes or data rewrites.

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npm test -- src/openai-mission-genesis-function.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit both persistence paths together**

```powershell
git add src/openai-mission-genesis-function.test.ts supabase/functions/_shared/missionGraphPersistence.ts supabase/migrations/20260803000100_autonomous_checkpoint_work.sql
git commit -m "feat: persist checkpoint manager reads"
```

### Task 4: Project legacy Manager analysis as internal work

**Files:**
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/services/productionSupabase.ts`

- [ ] **Step 1: Write a failing legacy-projection test**

Build a mission fixture with one waiting checkpoint, one exact `Manager` task, and one mixed-owner task. Assert:

```ts
expect(mission.tasks?.map((task) => task.id)).toEqual(["task-team-action"]);
expect(mission.nextTask).toBe("Approve the campaign angle");
expect(mission.checkpoints?.[0]).toMatchObject({
  status: "Watching signal",
  requiredTaskIds: ["task-team-action"],
  managerRead: "Public discovery is strong, but artist attachment is not proven yet.",
});
```

Then remove the mixed-owner task from the fixture and assert `requiredTaskIds: []`, `status: "Watching signal"`, and a next action that does not say to complete tasks.

- [ ] **Step 2: Run the service test and verify it fails**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts
```

Expected: FAIL because exact Manager rows are currently included in tasks, counts, and `nextTask`.

- [ ] **Step 3: Add one narrow ownership helper and reuse it throughout projection**

Add:

```ts
function isInternalManagerTask(task: Pick<TaskRow, "owner_role">) {
  return task.owner_role?.trim().toLowerCase() === "manager";
}
```

Derive raw artist tasks once:

```ts
const artistTaskRows = tasks.filter((task) => !isInternalManagerTask(task));
const nextTask = artistTaskRows.find((task) => !["completed", "archived", "rejected", "superseded"].includes(task.status));
const mappedTasks = artistTaskRows.map((task) => {
  const taskSteps = steps.filter((step) => step.task_id === task.id).map((step) => step.body);
  const taskResult = results.find((result) => result.task_id === task.id);
  return {
    id: task.id,
    checkpointId: task.primary_checkpoint_id ?? "",
    title: task.title,
    owner: task.owner_role ?? "Artist / team",
    deadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : "Next review",
    approvalState: mapTaskApprovalState(task.approval_state),
    purpose: task.purpose ?? "",
    steps: taskSteps,
    evidenceIds: task.evidence_needed ?? [],
    deliverables: deliverablesByTask.get(task.id),
    completionMode: task.completion_mode ?? undefined,
    completionExpectation: task.completion_expectation ?? undefined,
    deliverableTitle: task.deliverable_title ?? undefined,
    deliverableRequirements: task.deliverable_requirements ?? [],
    managerResponsibility: task.manager_responsibility ?? undefined,
    userResponsibility: task.user_responsibility ?? undefined,
    managerDraft: managerDraftsByTask.get(task.id),
    dependency: task.dependency ?? "None",
    riskIfLate: task.risk_if_late ?? "None",
    result: taskResult ? mapTaskResult(taskResult) : undefined,
  };
});
```

Extract the current inline result mapping to `mapTaskResult(result: TaskResultRow): MissionTaskResultViewModel` before using the snippet above; move the existing field-for-field mapping unchanged into that helper.

For each checkpoint, derive `checkpointTasks` from `mappedTasks`, then normalize only a legacy waiting checkpoint with no artist tasks and a real recommendation:

```ts
const hasManagerRead = Boolean(checkpoint.recommendation?.trim()) && checkpoint.recommendation !== "No recommendation.";
const projectedStatus = mapCheckpointStatus(checkpoint.status) === "Waiting on tasks"
  && checkpointTasks.length === 0
  && hasManagerRead
    ? "Watching signal"
    : mapCheckpointStatus(checkpoint.status);
```

Use `checkpointTasks.map(...)` for `requiredTaskIds`. When `checkpoint.next_action` is absent and there are no artist tasks, return:

```ts
"Nothing needed from you. The Manager is watching the checkpoint signals."
```

Do not inspect task-title verbs and do not mutate Supabase rows.

- [ ] **Step 4: Run the service test**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the compatibility projection**

```powershell
git add src/production-supabase-service.test.ts src/services/productionSupabase.ts
git commit -m "fix: hide internal manager analysis from artist work"
```

### Task 5: Make attachments optional on the artist task surface

**Files:**
- Modify: `src/mission-task-deliverables.test.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`

- [ ] **Step 1: Replace the required-upload test with optional-context behavior**

Update the first deliverable test to assert:

```ts
expect(screen.getByText("Optional context")).toBeInTheDocument();
expect(screen.queryByText("Missing")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "Mark done" })).toBeEnabled();

fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark done" }));

await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith(
  "task-thesis",
  "completed",
  "",
  [],
  undefined,
));
```

Keep a second assertion path that uploads `thesis.pdf` first and verifies `documentIds` contains `doc-thesis-1`.

- [ ] **Step 2: Add a zero-task checkpoint UI test**

Render a mission whose checkpoint has `requiredTaskIds: []` and `tasks: []`, then assert:

```ts
expect(screen.getByText("Nothing needed from you")).toBeInTheDocument();
expect(screen.getByText(/Manager is handling this read/i)).toBeInTheDocument();
expect(screen.queryByText("0/0 tasks")).not.toBeInTheDocument();
```

Add a second assertion using a `Waiting on tasks` checkpoint with a specific `managerRead`:

```ts
expect(screen.getByText("Public attention is real, but durable artist attachment is not proven yet.")).toBeInTheDocument();
expect(screen.getByText("Manager’s read")).toBeInTheDocument();
```

This locks the rule that the initial read remains valuable even while a real human task is outstanding.

- [ ] **Step 3: Run the UI test and verify it fails**

Run:

```powershell
npm test -- src/mission-task-deliverables.test.tsx
```

Expected: FAIL because evidence mode still synthesizes a missing requirement and disables completion, and zero-task checkpoints have no intentional empty state.

- [ ] **Step 4: Remove attachment gating while preserving uploads**

In `confirmCompletion`, delete the `missingDeliverable` validation. Continue collecting uploaded document IDs:

```ts
const deliverables = task ? resolveTaskDeliverables(task, taskDeliverables[task.id]) : [];
const documentIds = deliverables
  .map((deliverable) => deliverable.documentId)
  .filter(Boolean) as string[];
```

Remove `(completionMode === "evidence" && hasBlockingDeliverable)` from the primary button’s `disabled` expression. Label the primary button `Mark done` for `evidence`, matching `result_note`.

Render the attachment area under the label `Optional context`, with supporting copy:

```tsx
<p className="text-[11px] font-semibold text-muted-foreground/80">
  Add a file only if it gives the Manager useful context. You can finish this task without one.
</p>
```

For a synthesized legacy placeholder, use `task.deliverableTitle?.trim() || "Supporting context"`; never fall back to `task.title`. Render a missing placeholder status as `Optional`, not `Missing`.

- [ ] **Step 5: Add the zero-task empty state and remove `0/0` language**

For a checkpoint with no `phaseTasks`, render:

```tsx
<div className="rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-4">
  <p className="text-[13px] font-bold text-foreground">Nothing needed from you</p>
  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted-foreground/80">
    The Manager is handling this read and will surface a decision or a specific action when one is needed.
  </p>
</div>
```

In the checkpoint stepper, show `Manager watching` instead of the task fraction when `phaseTasks.length === 0`.

Make the checkpoint panel recognize any real read, including a newly generated checkpoint that is still waiting on a human task:

```ts
function checkpointHasManagerRead(checkpoint: MissionCheckpointViewModel) {
  const read = checkpoint.managerRead.trim();
  return Boolean(read) && read !== "No recommendation.";
}
```

Keep the existing progressive disclosure: the Manager read is the primary sentence, while the decision rule and supporting detail remain inside the expanded checkpoint.

- [ ] **Step 6: Run task UI regressions**

Run:

```powershell
npm test -- src/mission-task-deliverables.test.tsx src/production-app-shell.test.tsx
```

Expected: PASS, including Manager-draft flows.

- [ ] **Step 7: Commit the optional attachment UX**

```powershell
git add src/mission-task-deliverables.test.tsx src/features/missions/MissionScreens.tsx
git commit -m "fix: make task attachments optional"
```

### Task 6: Make Manager review accept missing optional files

**Files:**
- Modify: `src/manager-review-task-result-function.test.ts`
- Modify: `supabase/functions/manager-review-task-result/index.ts`

- [ ] **Step 1: Replace required-document source assertions with the optional policy**

Update the submitted-document test:

```ts
it("uses submitted documents as optional review context without gating completion", () => {
  expect(functionSource).toContain("submittedDocuments");
  expect(functionSource).toContain("Optional documents can raise confidence");
  expect(functionSource).not.toContain("This task requires a submitted document");
  expect(functionSource).not.toContain("requiredTaskDeliverablesMustBeSubmittedBeforeCompletion: true");
});
```

Update the checkpoint decision assertion so it requires internal Manager rows to be excluded:

```ts
expect(functionSource).toContain("isInternalManagerTask");
expect(functionSource).toContain("!isInternalManagerTask(task)");
```

- [ ] **Step 2: Run the function source test and verify it fails**

Run:

```powershell
npm test -- src/manager-review-task-result-function.test.ts
```

Expected: FAIL because the function still throws when an evidence-mode task has no document and counts legacy Manager rows as required work.

- [ ] **Step 3: Remove only the document gate**

Delete `taskRequiresDocument`, `missingRequiredDeliverable`, and the required-deliverable exception. Keep `loadSubmittedDocuments` and the Manager-draft exception unchanged.

Update the review policy and instructions:

```ts
policy: {
  internalWorkspaceUpdatesAllowed: true,
  externalExpensiveLegalFinancialPublicActionsRequirePermission: true,
  reviewMustUpdateMissionState: true,
  memoryAfterMeaningfulResult: true,
  submittedDocumentsAreOptionalContext: true,
},
```

```ts
"Optional documents can raise confidence when present. Their absence must not prevent task completion; state the evidence limit and choose a safe recommendation from the available packet.",
```

- [ ] **Step 4: Ignore exact Manager rows in checkpoint completion checks**

Add:

```ts
function isInternalManagerTask(task: Record<string, unknown>) {
  return typeof task.owner_role === "string" && task.owner_role.trim().toLowerCase() === "manager";
}
```

Filter before checking completion:

```ts
const checkpointTasks = Array.isArray(context.missionTasks)
  ? context.missionTasks.filter((task: any) =>
      task.primary_checkpoint_id === checkpointId && !isInternalManagerTask(task)
    )
  : [];
const allCheckpointTasksCompleted = checkpointTasks.length === 0 || checkpointTasks.every((task: any) =>
  task.id === taskId || task.status === "completed"
);
```

The zero-length case is intentionally complete because Manager-only analysis is represented by the checkpoint read, not pending artist work.

- [ ] **Step 5: Run backend contract tests**

Run:

```powershell
npm test -- src/manager-review-task-result-function.test.ts src/openai-mission-genesis-function.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit backend review semantics**

```powershell
git add src/manager-review-task-result-function.test.ts supabase/functions/manager-review-task-result/index.ts
git commit -m "fix: review tasks without required uploads"
```

### Task 7: Verify the complete behavior and inspect the diff boundary

**Files:**
- Verify only; no new files.

- [ ] **Step 1: Run the focused product suite**

Run:

```powershell
npm test -- src/openai-mission-genesis-function.test.ts src/mission-pattern-registry.test.ts src/production-supabase-service.test.ts src/mission-task-deliverables.test.tsx src/manager-review-task-result-function.test.ts src/production-app-shell.test.tsx
```

Expected: all focused test files PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test
```

Expected: all tests PASS with no unhandled promise rejections.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vite build completes successfully.

- [ ] **Step 4: Confirm no schema or unrelated-file creep**

Run:

```powershell
git diff --stat
git diff --check
git status --short
```

Expected: no whitespace errors; changes are limited to the files named in Tasks 1–6 plus the approved spec/plan. `deno.lock` and any earlier live-handoff work must remain unstaged unless separately authorized.

- [ ] **Step 5: Perform a manual UI smoke check**

Run:

```powershell
npm run dev
```

Open an existing mission with a legacy `Manager` evidence task and verify:

1. The task is not presented as artist work.
2. The checkpoint shows a Manager read and `Watching signal` rather than an upload blocker.
3. A human task can be marked done without a file.
4. Adding a file remains possible and the filename appears before submission.
5. Manager-draft submission still opens the existing Manager workflow.

- [ ] **Step 6: Commit any test-only correction made during verification**

If verification required a scoped correction, stage only its named files and commit with a message describing that correction. If no correction was needed, do not create an empty commit.
