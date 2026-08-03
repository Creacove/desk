# Checkpoint Decision Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make Checkpoint Review a calm, decision-first artist surface backed by the live Manager checkpoint evaluation rather than creation-time copy.

**Architecture:** Split immutable checkpoint rationale from live Manager judgment in the mission view model. The task-result Manager workflow writes the complete current checkpoint projection, then the accordion renders a compact state-aware summary, the actual clearing rule, and one next consequence with supporting task detail one click away.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest/Testing Library, Supabase Edge Functions (Deno).

---

## File Map

- \`src/types/cleanProduction.ts\` — explicit checkpoint rationale and Manager-read fields.
- \`src/services/productionSupabase.ts\` — maps checkpoint database columns without masking the recommendation.
- \`src/services/fixtureRepositories.ts\` — aligns fixture checkpoints with the production contract.
- \`src/features/missions/MissionScreens.tsx\` — decision-first, state-aware accordion.
- \`src/mission-workspace-simplification.test.tsx\` — UI contract coverage.
- \`supabase/functions/manager-review-task-result/index.ts\` — persists a complete checkpoint evaluation and validates clear status.
- \`src/manager-review-task-result-function.test.ts\` — guards Edge Function persistence/status behavior.
- \`src/production-supabase-service.test.ts\` — proves source-field projection.

### Task 1: Separate creation rationale from live Manager judgment

**Files:**

- Modify: \`src/types/cleanProduction.ts:226-239\`
- Modify: \`src/services/productionSupabase.ts:5435-5471\`
- Modify: \`src/services/fixtureRepositories.ts:22-106\`
- Modify: \`src/features/missions/MissionScreens.tsx:1135-1170\`
- Test: \`src/production-supabase-service.test.ts:2510-2568\`

- [ ] **Step 1: Write the failing service projection assertion**

Add a checkpoint fixture with different source values:

~~~
reason_for_checkpoint: "This test distinguishes a one-off spike from repeatable response.",
recommendation: "The response is holding; keep the test narrow for one more reporting window.",
~~~

Assert:

~~~
expect(missions[0].checkpoints?.[0]).toMatchObject({
  rationale: "This test distinguishes a one-off spike from repeatable response.",
  managerRead: "The response is holding; keep the test narrow for one more reporting window.",
});
expect(missions[0].checkpoints?.[0]).not.toHaveProperty("resultSummary");
~~~

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

~~~
npx vitest run src/production-supabase-service.test.ts --environment jsdom --pool=vmThreads
~~~

Expected: the new fields are absent because the production mapper still returns \`resultSummary\`.

- [ ] **Step 3: Implement the explicit checkpoint projection**

Replace the view-model field:

~~~
resultSummary: string;
~~~

with:

~~~
rationale: string;
managerRead: string;
~~~

In \`missionFromRow\`, return:

~~~
rationale: checkpoint.reason_for_checkpoint ?? "",
managerRead: checkpoint.recommendation ?? "",
~~~

Update every synthetic fallback and fixture checkpoint to provide those fields. Do not adapt \`rationale\` into \`managerRead\`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run the Step 2 command. Expected: exit code 0.

- [ ] **Step 5: Commit**

~~~
git add -- src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/features/missions/MissionScreens.tsx src/production-supabase-service.test.ts
git commit -m "fix: separate checkpoint rationale from manager read"
~~~

### Task 2: Render the quiet decision-first accordion

**Files:**

- Modify: \`src/features/missions/MissionScreens.tsx:870-960,1300-1330\`
- Test: \`src/mission-workspace-simplification.test.tsx:103-145,179-193\`

- [ ] **Step 1: Write the failing UI contract**

For an evaluated checkpoint, assert:

~~~
expect(within(expandedCheckpoint).getByText("Manager’s read")).toBeInTheDocument();
expect(within(expandedCheckpoint).getByText("Listener response is promising.")).toBeInTheDocument();
expect(within(expandedCheckpoint).getByText("This clears when")).toBeInTheDocument();
expect(within(expandedCheckpoint).getByText("At least three listeners must respond positively.")).toBeInTheDocument();
expect(within(expandedCheckpoint).getByText("What this opened")).toBeInTheDocument();
expect(within(expandedCheckpoint).getByRole("button", { name: "See supporting work" })).toBeInTheDocument();
expect(within(expandedCheckpoint).queryByText("Success condition")).not.toBeInTheDocument();
expect(within(expandedCheckpoint).queryByText(/2 tasks/)).not.toBeInTheDocument();
~~~

For a waiting checkpoint, assert \`What this checkpoint is deciding\` and its question render instead of a Manager-read label.

- [ ] **Step 2: Run the focused UI test to verify it fails**

~~~
npx vitest run src/mission-workspace-simplification.test.tsx --environment jsdom --pool=vmThreads
~~~

Expected: old labels and task-count presentation cause the assertions to fail.

- [ ] **Step 3: Implement state-aware content selection**

Replace \`getCheckpointReviewCopy\` with:

~~~
function checkpointHasManagerRead(checkpoint: MissionCheckpointViewModel) {
  return ["Ready for AI review", "Needs revision", "Watching signal", "Met"].includes(checkpoint.status)
    && Boolean(checkpoint.managerRead.trim());
}

function getCheckpointPrimary(checkpoint: MissionCheckpointViewModel) {
  if (checkpointHasManagerRead(checkpoint)) {
    return { label: "Manager’s read", copy: checkpoint.managerRead };
  }
  return { label: "What this checkpoint is deciding", copy: checkpoint.question };
}
~~~

The collapsed row contains only phase marker, title, status, and one state-derived summary. Remove task-count text. The expanded row renders primary content, \`This clears when\` with \`decisionRule\`, then one tinted next-consequence block. The final block label is \`What this opened\` for \`Met\`, \`What needs attention\` for a concrete hold, and \`Next\` otherwise. Rename the existing task action to \`See supporting work\`.

- [ ] **Step 4: Run the focused UI test to verify it passes**

Run the Step 2 command. Expected: exit code 0.

- [ ] **Step 5: Commit**

~~~
git add -- src/features/missions/MissionScreens.tsx src/mission-workspace-simplification.test.tsx
git commit -m "feat: focus checkpoint review on manager decisions"
~~~

### Task 3: Persist one coherent checkpoint evaluation

**Files:**

- Modify: \`supabase/functions/manager-review-task-result/index.ts:178-184,316-332,447-469\`
- Test: \`src/manager-review-task-result-function.test.ts:41-50\`

- [ ] **Step 1: Write the failing workflow-contract assertions**

~~~
expect(functionSource).toContain("dependency_impact: review.checkpointEffect");
expect(functionSource).toContain("next_action: review.recommendedFollowUp");
expect(functionSource).toContain('blocked_reason: checkpointStatus === "needs_revision" || checkpointStatus === "blocked"');
expect(functionSource).toContain('if (modelStatus === "met" && !allCheckpointTasksCompleted) return "ready_for_manager_check";');
~~~

- [ ] **Step 2: Run the focused Edge Function test to verify it fails**

~~~
npx vitest run src/manager-review-task-result-function.test.ts --environment jsdom --pool=vmThreads
~~~

Expected: only recommendation/status are currently persisted and a final task is forced to \`ready_for_manager_check\`.

- [ ] **Step 3: Implement the complete persisted projection**

Build and use this scoped update payload:

~~~
const checkpointUpdate = {
  status: checkpointStatus,
  recommendation: review.checkpointRecommendation,
  dependency_impact: review.checkpointEffect,
  next_action: review.recommendedFollowUp,
  blocked_reason: checkpointStatus === "needs_revision" || checkpointStatus === "blocked"
    ? review.checkpointEffect
    : null,
  updated_at: now,
};
~~~

Keep blocked and revision outcomes as early status overrides. After computing \`allCheckpointTasksCompleted\`, preserve the Manager’s state except for an unsafe early clear:

~~~
if (modelStatus === "met" && !allCheckpointTasksCompleted) return "ready_for_manager_check";
return modelStatus;
~~~

Add an instruction asking the Manager to choose \`met\`, \`needs_revision\`, or \`watching_signal\` after the final required task and explain it through \`checkpointRecommendation\`.

- [ ] **Step 4: Run the focused Edge Function test to verify it passes**

Run the Step 2 command. Expected: exit code 0.

- [ ] **Step 5: Commit**

~~~
git add -- supabase/functions/manager-review-task-result/index.ts src/manager-review-task-result-function.test.ts
git commit -m "fix: persist complete checkpoint manager evaluations"
~~~

### Task 4: Reconcile fixtures and verify the full change

**Files:**

- Modify only fixtures reported by TypeScript or targeted tests.
- Verify: \`src/mission-workspace-simplification.test.tsx\`
- Verify: \`src/production-supabase-service.test.ts\`
- Verify: \`src/manager-review-task-result-function.test.ts\`

- [ ] **Step 1: Run targeted regression coverage**

~~~
npx vitest run src/mission-workspace-simplification.test.tsx src/production-supabase-service.test.ts src/manager-review-task-result-function.test.ts --environment jsdom --pool=vmThreads
~~~

Expected: exit code 0.

- [ ] **Step 2: Correct any remaining test fixture contract fallout**

For each remaining \`resultSummary\` fixture property, replace it with semantic values:

~~~
rationale: "Why the mission created this checkpoint.",
managerRead: "The current Manager judgment for this checkpoint.",
~~~

Do not add a compatibility adapter that makes rationale visible as a Manager result.

- [ ] **Step 3: Repeat targeted regression coverage**

Run the Step 1 command. Expected: exit code 0.

- [ ] **Step 4: Run complete verification**

~~~
npm test
npm run build
deno check supabase/functions/manager-review-task-result/index.ts
~~~

Expected: each command exits 0. If Deno is not installed, report that exact limitation rather than claiming the Edge Function check ran.

- [ ] **Step 5: Review and commit**

~~~
git diff --check
git status --short
git add -- src/mission-workspace-simplification.test.tsx src/production-supabase-service.test.ts src/manager-review-task-result-function.test.ts src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/features/missions/MissionScreens.tsx supabase/functions/manager-review-task-result/index.ts
git commit -m "test: cover checkpoint decision surface"
~~~

Do not stage or alter the pre-existing \`deno.lock\` change.

## Plan Self-Review

### Spec coverage

- Decision-first accordion and progressive disclosure: Task 2.
- Actual decision rule instead of mislabeled question: Task 2.
- Creation rationale separated from live Manager judgment: Task 1.
- Passed checkpoint explains outcome and unlock: Task 2.
- Full Manager task-result persistence: Task 3.
- Valid final checkpoint state and incomplete-work safety: Task 3.
- Fixture, service, UI, and full-build verification: Task 4.

### Placeholder scan

The plan contains no TODO, TBD, or implementation-later steps. Each code change has a target, assertion, command, and expected outcome.

### Type consistency

The public checkpoint names used throughout are \`rationale\`, \`managerRead\`, \`decisionRule\`, and \`nextAction\`. The Manager workflow persists to the matching database columns \`recommendation\`, \`dependency_impact\`, \`next_action\`, and \`blocked_reason\`.

