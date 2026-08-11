# Responsive Catalog Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make Spotify catalog imports responsive, overflow-safe, observable, and non-blocking while preserving the existing import/search contracts.

**Architecture:** Keep the catalog picker as one responsive dialog, but move the long-running import/read orchestration into `MusicWorkspace` state so it survives dialog dismissal. The workspace exposes a compact status notice for background jobs and only opens the imported subject after a successful import, Manager Read, and catalog refresh.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Testing Library, Vite.

---

### Task 1: Add failing coverage for the user-visible import lifecycle

**Files:**
- Modify: `src/production-app-shell.test.tsx` near the existing catalog import test
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add focused tests that render `MusicWorkspace` with controlled repository promises. Assert the dialog uses `h-[100dvh] w-full sm:h-auto`, has `overflow-x-hidden`, shows a title-aware progress state, and exposes `Continue browsing`. Resolve the controlled import/read promises and assert the dialog can be dismissed while an inline status notice remains interactive. Add a failure case where `startManagerRead` rejects and assert the dialog remains open with an alert. Add a success case asserting `onMusicChanged` runs before the completion/open path.

Use the existing `repositoriesFor`, `musicReadSubject`, and `render` helpers, with controlled promises shaped like:

```ts
let resolveImport!: (value: SpotifyImportResult) => void;
const importPromise = new Promise<SpotifyImportResult>((resolve) => {
  resolveImport = resolve;
});
musicRepository.importSpotifySelection = vi.fn(() => importPromise);
musicRepository.searchSpotifyCatalog = vi.fn(async () => ({
  mode: "releases",
  releases: [fixtureRelease],
}));
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run `npm test -- --run src/production-app-shell.test.tsx -t "catalog import"`.

Expected: the new assertions fail because the current dialog is a centered card, close is disabled for the entire operation, and no persistent job notice exists.

### Task 2: Move import/read orchestration into `MusicWorkspace`

**Files:**
- Modify: `src/features/music/MusicScreens.tsx` around `MusicWorkspace`, `startManagerRead`, `openImportedRecord`, and the `MusicImportDialog` call

- [ ] **Step 1: Add the job model and state**

Define `CatalogImportSelection` and `CatalogImportJob` beside the music screen types. Track `id`, `kind`, `title`, `selection`, `phase`, `backgrounded`, optional `result`, `error`, and `refreshError` in `MusicWorkspace`, plus a ref containing the current job and a ref recording whether the sheet was backgrounded.

- [ ] **Step 2: Make Manager Read failures observable**

Change `startManagerRead` to return `Promise<MusicObjectViewModel | null>`. Return the updated object on success and return `null` in the catch branch after setting the existing brief error. This lets the import pipeline distinguish a real failure from a swallowed exception.

- [ ] **Step 3: Implement start, background, retry, open, and dismiss handlers**

Add `startCatalogImport({ kind, title, selection })` that sets phase `import`, awaits `musicRepository.importSpotifySelection`, sets phase `read`, awaits `startManagerRead`, refreshes via `onMusicChanged`, and records either `done` or `failed`. Treat a `null` read as failure. Store refresh failures as `refreshError` without marking the import failed. Add handlers that set `backgrounded` and clear `importKind` without cancelling work, retry the saved selection, retry refresh/open a completed result, and dismiss terminal notices.

- [ ] **Step 4: Wire the dialog to the parent job**

Replace the dialog's direct `onImportSelection`, `onGenerateRead`, and `onDone` props with `onStartImport`, `onContinueBrowsing`, and `importJob`. Keep the existing repository search prop. When a foreground job completes with a successful refresh, select the imported record and clear the job; when backgrounded, leave a terminal notice with Open/Retry actions.

- [ ] **Step 5: Run the focused tests**

Run `npm test -- --run src/production-app-shell.test.tsx -t "catalog import"` and confirm the orchestration tests now pass or fail only on the still-unmodified dialog layout.

### Task 3: Make the picker responsive and overflow-safe

**Files:**
- Modify: `src/features/music/MusicScreens.tsx` in `MusicImportDialog`, `MusicImportProgress`, `ImportRow`, and loading rows

- [ ] **Step 1: Update the dialog shell**

Use a full-height mobile sheet and bounded desktop card:

```tsx
<div className="fixed inset-0 z-[80] grid bg-foreground/24 backdrop-blur-xl sm:place-items-center sm:p-4">
  <div className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[min(90vh,44rem)] sm:w-[min(100%,40rem)] sm:rounded-[22px] sm:border">
```

Keep header/footer `shrink-0`; make the single body `min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain`. Use `min-w-0`, `flex-wrap`, and small-screen padding in header/footer.

- [ ] **Step 2: Make row actions shrink-safe**

Add `min-w-0` to row buttons/content, `shrink-0` to action controls, and a mobile max-width/truncation rule for action labels. Preserve cover art and title/meta hierarchy without allowing text to widen the dialog.

- [ ] **Step 3: Keep progress and loading feedback accessible**

Render the existing skeleton/orb language for search and track loading, add `aria-busy` to the dialog while searching/loading/importing, show the selected title in progress, and provide `Continue browsing` after the handoff. The close control calls backgrounding once work has started instead of remaining disabled for the whole job.

- [ ] **Step 4: Return actionable errors to the selection view**

When a foreground job fails, stop showing the progress-only view and render an alert above the picker with the sanitized message; keep the same row selection available for retry.

- [ ] **Step 5: Run focused layout/lifecycle tests**

Run `npm test -- --run src/production-app-shell.test.tsx -t "catalog import"` and confirm the mobile class, loading, progress, background, and failure assertions pass.

### Task 4: Add the persistent Catalog status notice

**Files:**
- Modify: `src/features/music/MusicScreens.tsx` in the library-mode render

- [ ] **Step 1: Render one compact non-blocking notice**

Add a `CatalogImportNotice` panel after the existing action error. For `import`/`read`, show the title, current phase, and `AppThinkingOrb`; for `done`, show success and `Open`; for `failed`, show the error and `Retry`. Keep it inline, keyboard reachable, and pointer-interactive without a backdrop or workspace blur.

- [ ] **Step 2: Connect terminal actions**

Wire Open to refresh when needed and then select the imported subject, Retry to rerun the saved selection, and Dismiss to clear only terminal job state. Do not offer dismissal that could silently cancel active work.

- [ ] **Step 3: Run the focused tests**

Run `npm test -- --run src/production-app-shell.test.tsx -t "catalog import"` and confirm completion, retry, and background interaction coverage passes.

### Task 5: Verify the full application and publish

**Files:**
- Modify: only files listed above

- [ ] **Step 1: Run the Music test set**

Run `npm test -- --run src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/spotify-import-functions.test.ts`.

- [ ] **Step 2: Run the full Vitest suite**

Run `npm test -- --run` and fix any regressions caused by changed props or asynchronous refresh behavior.

- [ ] **Step 3: Build the production bundle**

Run `npm run build` and confirm Vite completes without TypeScript or bundling errors.

- [ ] **Step 4: Review the diff and commit implementation**

Run `git diff --check` and `git status --short`; stage only `src/features/music/MusicScreens.tsx` and `src/production-app-shell.test.tsx`, then commit with `git commit -m "fix: make catalog imports responsive and non-blocking"`.

- [ ] **Step 5: Push the branch**

Run `git push origin main` only after all verification commands pass. Preserve the pre-existing untracked `.playwright-cli` files.
