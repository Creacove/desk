# Song Asset Library and Manager Awareness Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the Song Room Files tab into a calm, music-first asset library with non-blocking uploads, clear feedback, and verified Manager/mission awareness, while preserving the existing Ordersounds shell and design language.

**Architecture:** Keep `MusicObjectViewModel` as the UI projection and `MusicRepository` as the action boundary. Reclassify stored assets into Audio, Artwork, and Documents; keep legal split workflow in Rights. Represent an in-flight upload as local UI state until the canonical server projection arrives, while the existing upload service continues to record mission-linked operating events. Add an on-demand signed asset URL repository method for private playback instead of exposing persistent storage URLs.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase, Vitest, Testing Library.

---

## Task 1: Correct the asset projection contract

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Test: `src/production-supabase-service.test.ts`

**Step 1: Write failing projection tests**

Add focused tests proving that general song files are grouped as Audio, Artwork, or Documents and that split-sheet/legal evidence is not duplicated into Files.

```ts
expect(song.fileAssets).toEqual(expect.arrayContaining([
  expect.objectContaining({ label: "Final master", group: "Audio" }),
  expect.objectContaining({ label: "Press release", group: "Documents" }),
]));
expect(song.fileAssets).not.toEqual(expect.arrayContaining([
  expect.objectContaining({ group: "Splits" }),
]));
```

**Step 2: Run the focused tests and confirm failure**

Run: `npm test -- --run src/production-supabase-service.test.ts`

Expected: FAIL because the current contract only supports `Splits` and defaults documents to Audio.

**Step 3: Implement the smallest contract change**

- Change the file group union to `"Audio" | "Artwork" | "Documents"`.
- Classify lyrics, press materials, pitch assets, and general documents as Documents.
- Exclude rights/split/royalty legal records from `buildFileAssets`; they remain in the Rights tab.
- Keep only one stage-appropriate missing primary-audio target, consumed as an empty-state action rather than a fake file row.
- Update fixture repository projections to match production.

**Step 4: Re-run focused tests**

Run: `npm test -- --run src/production-supabase-service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/production-supabase-service.test.ts
git commit -m "fix: clarify song asset projection"
```

## Task 2: Add private, on-demand asset playback access

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Test: `src/production-supabase-service.test.ts`

**Step 1: Write a failing repository test**

Add a test that requests an asset access URL, verifies the asset belongs to the requested song, looks up its uploaded-file storage coordinates through RLS-protected queries, and creates a short-lived signed URL.

```ts
const url = await repository.getAssetAccessUrl?.("song-1", "asset-1");
expect(url).toBe("https://signed.example/master.wav");
expect(storage.createSignedUrl).toHaveBeenCalledWith("private/master.wav", 300);
```

Also test missing/mismatched assets fail with a user-safe error.

**Step 2: Run the focused test and confirm failure**

Run: `npm test -- --run src/production-supabase-service.test.ts`

Expected: FAIL because `MusicRepository` has no access method.

**Step 3: Implement on-demand signed access**

- Add optional `getAssetAccessUrl(musicItemId, assetId)` to `MusicRepository`.
- In production, query the asset and uploaded-file record under existing RLS, verify ownership, and create a five-minute signed URL.
- In fixtures, return the fixture URL or a stable test URL.
- Never persist or project the signed URL into Manager context.

**Step 4: Re-run the focused test**

Run: `npm test -- --run src/production-supabase-service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/production-supabase-service.test.ts
git commit -m "feat: add private song asset playback access"
```

## Task 3: Redesign Files as a restrained song asset library

**Files:**
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

**Step 1: Write failing UI tests for hierarchy and subtraction**

Cover desktop and mobile expectations:

```ts
expect(screen.getByRole("heading", { name: "Song assets" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Upload files" })).toBeInTheDocument();
expect(screen.queryByText(/ready$/i)).not.toBeInTheDocument();
expect(screen.queryByText(/missing$/i)).not.toBeInTheDocument();
expect(screen.queryByText("Rights documents")).not.toBeInTheDocument();
expect(screen.getByText("Artwork & images")).toBeInTheDocument();
expect(screen.getByText("Documents")).toBeInTheDocument();
```

Add a playback test: clicking Play requests a short-lived URL and exposes a native audio control with the current master prioritized above secondary files.

**Step 2: Run the focused UI tests and confirm failure**

Run: `npm test -- --run src/production-app-shell.test.tsx`

Expected: FAIL against the current “File manifest” and readiness-chip UI.

**Step 3: Implement the library layout**

- Preserve the Song Room masthead, stage selector, tab rail, workspace width, typography, Lucide icons, tokens, and app motion timings.
- Replace “File manifest / Assets” with “Song assets” and one short helper line.
- Use one primary `Upload files` button and one secondary `Share` action.
- Remove aggregate ready/missing chips and per-section readiness counters.
- Render only real stored assets in Audio, Artwork & images, and Documents.
- Promote the current master to a compact playable row; secondary versions remain quiet rows.
- Show a single, stage-aware empty-state upload action when no primary audio exists.
- Keep borders, radius, shadows, focus rings, dark mode, and responsive behavior inside existing design tokens.

**Step 4: Run focused tests**

Run: `npm test -- --run src/production-app-shell.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/music/MusicScreens.tsx src/production-app-shell.test.tsx
git commit -m "feat: redesign song files as asset library"
```

## Task 4: Move upload progress into the asset library

**Files:**
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

**Step 1: Write failing upload interaction tests**

Verify the picker is only for selection, then closes immediately while the Files tab remains usable:

```ts
fireEvent.change(screen.getByLabelText("File"), { target: { files: [file] } });
fireEvent.click(screen.getByRole("button", { name: "Upload" }));
expect(screen.queryByRole("dialog", { name: /Upload/ })).not.toBeInTheDocument();
expect(screen.getByRole("progressbar", { name: /Uploading .*master.wav/ })).toHaveAttribute("aria-valuenow", "42");
expect(screen.getByTestId("music-workspace-content")).not.toHaveClass("blur-[6px]");
```

Add failure and retry coverage: failed rows retain filename and error, Retry reuses the selected `File`, and successful reconciliation removes the transient row after the canonical asset refresh.

**Step 2: Run focused tests and confirm failure**

Run: `npm test -- --run src/production-app-shell.test.tsx`

Expected: FAIL because progress currently stays inside a blocking modal.

**Step 3: Implement local upload state**

- Replace the single modal progress state with a song-scoped upload record containing target, `File`, progress, and error.
- Close the picker immediately on submit.
- Render determinate preparing/uploading/finalizing progress inline in the correct section with filename, percent, and bytes.
- Preserve the active tab and scroll position.
- On failure, keep the row with concise error copy and Retry.
- On success, refresh existing music data and remove the transient row once the canonical asset is available.
- Keep `aria-live` status and labelled progress bars for assistive technology.

**Step 4: Run focused UI tests**

Run: `npm test -- --run src/production-app-shell.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/music/MusicScreens.tsx src/production-app-shell.test.tsx
git commit -m "fix: make song uploads visible and non blocking"
```

## Task 5: Prove Manager and mission awareness remains fresh

**Files:**
- Modify if required: `supabase/functions/manager-conversation/index.ts`
- Modify if required: `supabase/functions/manager-conversation-stream/index.ts`
- Test: `src/manager-conversation-context.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/production-supabase-service.test.ts`

**Step 1: Extend regression tests before changing backend code**

Prove that:

- successful upload writes a mission-linked `music_asset_uploaded` event;
- failed upload writes a mission-linked `music_asset_upload_failed` event;
- each Manager turn freshly queries music assets, evidence, and recent operating events;
- asset titles/types and audio-analysis evidence enter the Manager packet without signed storage URLs.

```ts
expect(context).toMatchObject({
  linkedMusic: expect.objectContaining({ assets: expect.any(Array) }),
  recentActivity: expect.arrayContaining([
    expect.objectContaining({ eventType: "music_asset_uploaded" }),
  ]),
});
```

**Step 2: Run the awareness tests**

Run: `npm test -- --run src/manager-conversation-context.test.ts src/openai-manager-conversation-function.test.ts src/production-supabase-service.test.ts`

Expected: existing architecture should mostly PASS; any failure identifies a real context gap.

**Step 3: Make only evidence-backed corrections**

Do not add a second memory system. Adjust the existing context queries or event payload only if the tests prove missing information.

**Step 4: Re-run awareness tests**

Run the command from Step 2.

Expected: PASS.

**Step 5: Commit only if code changed**

```bash
git add supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/manager-conversation-context.test.ts src/openai-manager-conversation-function.test.ts src/production-supabase-service.test.ts
git commit -m "test: protect manager song asset awareness"
```

## Task 6: Regression, visual QA, and deployment

**Files:**
- Modify only if QA reveals an in-scope defect.

**Step 1: Run formatting/type/build checks**

Run the repository’s available lint, typecheck, and production build scripts from `package.json`.

**Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: PASS with no unrelated regressions.

**Step 3: Browser QA the production-like flow**

Use the existing logged-in Ordersounds Chrome session when available. Check:

- desktop and mobile-width Files layout;
- light and dark themes;
- upload selection, modal dismissal, live progress, success, failure, and retry;
- audio play access;
- Share remains intact;
- Rights still contains split workflow with no Files duplication;
- navigation, stage selector, and tab state do not jump.

Capture before/after screenshots and compare against adjacent unchanged Song Room screens for visual continuity.

**Step 4: Deploy through the repository’s existing deployment path**

Verify the linked site/config first, deploy only the tested build, then smoke-test the deployed URL in the logged-in session.

**Step 5: Final verification and handoff**

Report exact tests/build/deploy evidence and any deliberately deferred scope: share-package redesign, metadata redesign, and released-mode redesign remain the next approved increments.
