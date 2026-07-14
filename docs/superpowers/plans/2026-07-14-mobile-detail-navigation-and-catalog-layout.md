# Mobile Detail Navigation and Catalog Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page-like transition start at the top while giving nested mobile catalog, mission, manager, and agent screens more usable space.

**Architecture:** `CleanProductionWorkspace` owns global view scroll restoration and the mobile topbar decision. `MusicWorkspace` and `MissionsWorkspace` expose their local list/detail state through optional callbacks and reset scroll on local page transitions. Detail components render immutable release status compactly, remove inherited project blocker summaries, and contain long titles.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Vite

---

## File Map

- Modify `src/app/ProductionApp.tsx`: global view scroll reset, child detail-state tracking, and conditional mobile chrome rendering.
- Modify `src/features/music/MusicScreens.tsx`: local page-state callback/scroll reset, release status treatment, project simplification, and title containment.
- Modify `src/features/missions/MissionScreens.tsx`: local room-state callback/scroll reset and mission-title containment.
- Modify `src/production-app-shell.test.tsx`: integrated navigation, topbar, lifecycle, blocker, and overflow regressions.
- Modify `src/mission-workspace-simplification.test.tsx`: focused mission room callback and scroll regressions.

### Task 1: Global page scroll and mobile topbar policy

**Files:**
- Modify: `src/app/ProductionApp.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing integrated tests**

Extend the existing production shell navigation coverage with a `window.scrollTo` spy. Assert that changing from HQ to Catalog calls `scrollTo({ top: 0, left: 0, behavior: "auto" })`. In the mobile surface test, assert the topbar exists on Catalog, disappears after opening a song room, returns after `Back to Catalog`, disappears in a mission room, remains absent in Manager's Office and a conversation, and is present again on the corresponding top-level list.

```tsx
const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
expect(screen.getByTestId("mobile-app-topbar")).toBeInTheDocument();

fireEvent.click(screen.getByRole("button", { name: "Open mobile song Night Bus" }));
expect(screen.queryByTestId("mobile-app-topbar")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "scrolls each page transition|hides the mobile topbar on detail screens"`

Expected: FAIL because `window.scrollTo` is not called and `MobileChrome` remains mounted on detail screens.

- [ ] **Step 3: Implement global view behavior**

Add child-detail state and a view effect inside `CleanProductionWorkspace`:

```tsx
const [musicDetailOpen, setMusicDetailOpen] = useState(false);
const [missionRoomOpen, setMissionRoomOpen] = useState(false);

useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [view]);

const showMobileChrome =
  view === "labelHQ" ||
  view === "staffWorkspace" ||
  view === "artistProfileWorkspace" ||
  (view === "musicWorkspace" && !musicDetailOpen) ||
  (view === "missionsWorkspace" && !missionRoomOpen);
```

Render `MobileChrome` only when `showMobileChrome` is true. Pass `onDetailModeChange={setMusicDetailOpen}` to `MusicWorkspace` and `onRoomModeChange={setMissionRoomOpen}` to `MissionsWorkspace`. Reset both child states in `navigate` when leaving their owning views so a later visit always begins at list depth.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm test -- src/production-app-shell.test.tsx -t "scrolls each page transition|hides the mobile topbar on detail screens"`

Expected: PASS.

### Task 2: Catalog local transitions, lifecycle status, project cleanup, and overflow

**Files:**
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing catalog detail tests**

Extend the existing song/project room tests to assert:

```tsx
expect(within(songRoom).queryByRole("combobox", { name: "Mobile song stage" })).not.toBeInTheDocument();
expect(within(songRoom).getByTestId("mobile-locked-song-stage")).toHaveTextContent(/Released|Catalog/);
expect(screen.queryByTestId("mobile-app-topbar")).not.toBeInTheDocument();
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });

expect(projectRoom).not.toHaveTextContent(/needs split proof/i);
expect(within(projectRoom).queryByText(/Blocker/i)).not.toBeInTheDocument();
expect(within(projectRoom).queryByText(/Needs split proof/i)).not.toBeInTheDocument();
```

Add an unreleased song fixture by cloning the existing song with `lifecycleStage: "mixing"`, open it, and assert the `Mobile song stage` combobox remains present. Give song, project, and track fixtures long unbroken titles and assert their title elements have `min-w-0`, `break-words`, and `[overflow-wrap:anywhere]` containment classes.

- [ ] **Step 2: Run the focused catalog tests and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "uses mobile-native song and project room layouts|locks released catalog status|contains long music titles"`

Expected: FAIL because released stages still render selects, blocker summaries remain, and the required containment contract is absent.

- [ ] **Step 3: Implement local mode signaling and scroll reset**

Add the optional prop and mode effect:

```tsx
onDetailModeChange?: (detailOpen: boolean) => void;

useEffect(() => {
  const detailOpen = mode !== "library";
  onDetailModeChange?.(detailOpen);
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [mode, onDetailModeChange]);
```

Keep tab switches inside an already-open room out of this dependency list so they do not behave as page changes.

- [ ] **Step 4: Implement locked lifecycle presentation**

Add a small helper and use it in both mobile and desktop song detail headers:

```tsx
function isLockedReleasedStage(stage?: string) {
  const normalized = stage?.trim().toLowerCase();
  return normalized === "released" || normalized === "catalog";
}
```

When locked, render a compact badge with `data-testid="mobile-locked-song-stage"` on mobile and no select. For earlier stages, retain the select in a compact row. Apply the same no-dropdown rule to desktop with a compact `Released` or `Catalog` badge.

- [ ] **Step 5: Remove project blocker summaries and contain titles**

Remove `blockedTracks`, `readyTracks`, `blockerRollup`, the header `State`/`Blocker` mini-stats, the tracklist rollup pills, and per-track blocker badges from `MusicProjectDetail`. Keep lifecycle text for each track.

Apply shrink and wrapping classes to detail titles:

```tsx
className="min-w-0 break-words [overflow-wrap:anywhere] font-display ..."
```

Ensure containing flex/grid nodes use `min-w-0 max-w-full` and detail roots retain `overflow-x-clip`. Fixed-column mobile track rows may keep `truncate` on track titles, because their parent already uses `minmax(0,1fr)`.

- [ ] **Step 6: Run catalog tests and verify GREEN**

Run: `npm test -- src/production-app-shell.test.tsx -t "rebuilds Music|uses mobile-native song and project room layouts|locks released catalog status|contains long music titles"`

Expected: PASS with no warnings.

### Task 3: Mission local transitions and title containment

**Files:**
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/mission-workspace-simplification.test.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing focused mission tests**

Render `MissionsWorkspace` with `onRoomModeChange` and spy on `window.scrollTo`. Open a mission from list mode and assert both behaviors, then click `Back to Missions` and assert the inverse callback plus another scroll reset.

```tsx
const onRoomModeChange = vi.fn();
const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
renderMissionList({ onRoomModeChange });

fireEvent.click(screen.getByRole("button", { name: /Define the artist's 90-day position/i }));
expect(onRoomModeChange).toHaveBeenLastCalledWith(true);
expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });

fireEvent.click(screen.getByRole("button", { name: "Back to Missions" }));
expect(onRoomModeChange).toHaveBeenLastCalledWith(false);
```

Set the mission title to a long unbroken value and assert the mission heading uses `min-w-0`, `max-w-full`, `break-words`, and `[overflow-wrap:anywhere]`.

- [ ] **Step 2: Run the mission tests and verify RED**

Run: `npm test -- src/mission-workspace-simplification.test.tsx -t "reports room transitions|contains long mission titles"`

Expected: FAIL because the callback prop and scroll effect do not exist and the heading lacks containment classes.

- [ ] **Step 3: Implement mission room signaling, scroll, and containment**

Add the optional prop and effect:

```tsx
onRoomModeChange?: (roomOpen: boolean) => void;

useEffect(() => {
  onRoomModeChange?.(roomMode === "room");
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}, [roomMode, onRoomModeChange]);
```

Apply `min-w-0 max-w-full break-words [overflow-wrap:anywhere]` to the mission command-bar heading. Do not include the mission tab in the effect dependencies.

- [ ] **Step 4: Run mission and integrated topbar tests and verify GREEN**

Run: `npm test -- src/mission-workspace-simplification.test.tsx src/production-app-shell.test.tsx -t "reports room transitions|contains long mission titles|hides the mobile topbar on detail screens"`

Expected: PASS.

### Task 4: Full verification

**Files:**
- Verify: `src/app/ProductionApp.tsx`
- Verify: `src/features/music/MusicScreens.tsx`
- Verify: `src/features/missions/MissionScreens.tsx`
- Verify: `src/production-app-shell.test.tsx`
- Verify: `src/mission-workspace-simplification.test.tsx`

- [ ] **Step 1: Run targeted suites**

Run: `npm test -- src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx`

Expected: both files pass with zero failed tests.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: exit code 0 and zero failed tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Vite exits with code 0 and emits the production bundle.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git diff -- src/app/ProductionApp.tsx src/features/music/MusicScreens.tsx src/features/missions/MissionScreens.tsx src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx`

Expected: no whitespace errors; the diff contains only the approved scroll, topbar, catalog, mission, overflow, and regression-test changes.
