# Team Access and Mission Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prototype agent-access language and make mission progress, checkpoints, and activity cohesive mobile-first surfaces.

**Architecture:** Keep plan-access presentation inside `StaffScreens.tsx`. Activate the existing responsive `CheckpointsPanel` in `MissionRoom`, retain `CheckpointReviewBody` as shared review content, and restyle the masthead and activity without changing mission data or persistence.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Vite

---

## File Map

- Modify `src/features/staff/StaffScreens.tsx`: team description, availability labels, and locked-agent access copy.
- Modify `src/features/missions/MissionScreens.tsx`: compact masthead, active checkpoint accordion, and contained activity surface.
- Modify `src/production-app-shell.test.tsx`: integrated Team Agents and locked-agent language coverage.
- Modify `src/mission-workspace-simplification.test.tsx`: masthead, checkpoint accordion, desktop workspace, activity, and empty-state coverage.

### Task 1: Plan-based Team Agents language

**Files:**
- Modify: `src/features/staff/StaffScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write the failing Team Agents tests**

Extend the existing Team Agents test to assert the durable introduction and plan states:

```tsx
expect(screen.getByText("Your AI team helps plan, coordinate, and execute the work that moves your career forward.")).toBeInTheDocument();
expect(screen.getAllByText("Available now").length).toBeGreaterThan(0);
expect(screen.getAllByText("Not available on this plan").length).toBeGreaterThan(0);
expect(screen.queryByText(/testing|coming soon|coming online|not live yet/i)).not.toBeInTheDocument();
```

Open one unavailable agent and assert:

```tsx
expect(screen.getByText("You don't have access to this agent on your current plan.")).toBeInTheDocument();
expect(screen.queryByText(/testing|coming soon|not live yet/i)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "presents team agents as plan-based access"`

Expected: FAIL because the current surfaces say testing and coming soon.

- [ ] **Step 3: Implement the copy and labels**

In `StaffWorkspace`, replace the introduction with the approved sentence. For available Manager rows, show `agent.purpose` and `Available now`. For locked rows, show `Not available on this plan` as both the concise support line and state badge. Preserve names, icons, ordering, and click behavior.

In `LockedAgentWorkspace`, replace the placeholder block with:

```tsx
<p className="mt-5 font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Plan access</p>
<h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-foreground">Not available on this plan</h2>
<p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
  You don&apos;t have access to this agent on your current plan.
</p>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/production-app-shell.test.tsx -t "presents team agents as plan-based access"`

Expected: PASS.

### Task 2: Compact mission masthead and responsive checkpoint accordion

**Files:**
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/mission-workspace-simplification.test.tsx`

- [ ] **Step 1: Write failing masthead and checkpoint tests**

Replace the old inspector-selection expectation with assertions that the active checkpoint surface is the responsive accordion/master-detail implementation:

```tsx
expect(screen.getByTestId("checkpoint-accordion")).toHaveClass("xl:hidden");
expect(screen.getByTestId("checkpoint-workspace-grid")).toHaveClass("hidden", "xl:grid");
expect(screen.queryByText("Review & analysis")).not.toBeInTheDocument();

const secondToggle = screen.getByTestId("checkpoint-accordion-toggle-checkpoint-2");
fireEvent.click(secondToggle);
expect(secondToggle).toHaveAttribute("aria-expanded", "true");
expect(within(screen.getByTestId("checkpoint-accordion-item-checkpoint-2")).getByText("Listener response is promising")).toBeInTheDocument();
expect(within(screen.getByTestId("checkpoint-accordion-item-checkpoint-2")).getByText("Run listener interviews")).toBeInTheDocument();
```

Assert the masthead is compact:

```tsx
expect(screen.getByTestId("mission-command-bar")).toHaveClass("grid", "gap-3");
expect(screen.getByTestId("mission-progress-summary")).toHaveClass("grid-cols-[auto_minmax(0,1fr)]", "items-center");
```

- [ ] **Step 2: Run the mission tests and verify RED**

Run: `npm test -- src/mission-workspace-simplification.test.tsx -t "uses inline checkpoint reviews|keeps mission progress compact"`

Expected: FAIL because `MissionRoom` still renders `SimplifiedCheckpointsPanel` and the masthead uses the loose grid.

- [ ] **Step 3: Activate `CheckpointsPanel`**

Change the checkpoints branch in `MissionRoom`:

```tsx
{tab === "checkpoints" ? <CheckpointsPanel checkpoints={checkpoints} tasks={tasks} /> : null}
```

Remove the now-unused `SimplifiedCheckpointsPanel`. Keep mobile review content inside each accordion item and the desktop `checkpoint-workspace-grid`/`CheckpointInspector` path unchanged.

- [ ] **Step 4: Tighten the masthead**

Use a compact header structure with the existing long-title containment:

```tsx
<header data-testid="mission-command-bar" className="grid gap-3 pb-1 pt-1">
  ...
  <div data-testid="mission-progress-summary" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 lg:max-w-[320px]">
    <p className="text-[12px] font-bold text-foreground">{mission.progress}%</p>
    <MissionProgressMeter status={mission.status} progress={mission.progress} />
  </div>
</header>
```

Desktop may place the title and progress summary in two columns, but both remain vertically centered without bottom padding that creates empty space.

- [ ] **Step 5: Run the focused mission tests and verify GREEN**

Run: `npm test -- src/mission-workspace-simplification.test.tsx -t "uses inline checkpoint reviews|keeps mission progress compact"`

Expected: PASS.

### Task 3: Cohesive mission activity surface

**Files:**
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/mission-workspace-simplification.test.tsx`

- [ ] **Step 1: Write failing activity tests**

Extend activity coverage:

```tsx
const activity = screen.getByTestId("mission-activity-surface");
expect(activity).toHaveClass("surface-elevated", "rounded-[22px]", "overflow-hidden");
expect(within(activity).getByText("2 updates")).toBeInTheDocument();
expect(within(activity).getAllByTestId("mission-activity-item")).toHaveLength(2);
```

Render a mission with empty notes/events and assert `No mission activity yet.` remains inside `mission-activity-surface`.

- [ ] **Step 2: Run activity tests and verify RED**

Run: `npm test -- src/mission-workspace-simplification.test.tsx -t "renders activity as a mission surface|keeps the activity empty state contained"`

Expected: FAIL because the current activity is an uncontained border-only feed.

- [ ] **Step 3: Implement the activity surface**

Render a `surface-elevated` section with `data-testid="mission-activity-surface"`, a padded header containing `Activity` and `{items.length} update(s)`, and a divided list. Each update uses `data-testid="mission-activity-item"`, a small status marker, source/type label, and message with responsive grid alignment. Keep the existing chronological combination of notes and events.

- [ ] **Step 4: Run the mission test file**

Run: `npm test -- src/mission-workspace-simplification.test.tsx`

Expected: all tests pass.

### Task 4: Full verification and commit

**Files:**
- Verify: `src/features/staff/StaffScreens.tsx`
- Verify: `src/features/missions/MissionScreens.tsx`
- Verify: `src/production-app-shell.test.tsx`
- Verify: `src/mission-workspace-simplification.test.tsx`

- [ ] **Step 1: Run targeted suites**

Run: `npm test -- src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx src/mission-task-deliverables.test.tsx`

Expected: all targeted tests pass.

- [ ] **Step 2: Run the full suite**

Run: `npm test`

Expected: exit code 0 with zero failures.

- [ ] **Step 3: Build production**

Run: `npm run build`

Expected: Vite exits with code 0.

- [ ] **Step 4: Inspect and commit**

Run: `git diff --check` and inspect the task-owned diff. Stage only the plan, Team Agents, Missions, and regression-test files, then commit:

```bash
git commit -m "feat: polish team access and mission surfaces"
```
