# Cohesive Song Room Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved Song Room so audio, artwork, native documents, Manager-created drafts, missions, conversations, Details, Rights, sharing, and released/catalog states behave as one restrained product.

**Architecture:** Preserve the four-tab Song Room and existing Ordersounds shell. Reuse `music_assets` for uploaded media, `documents`/`document_versions` for editable or uploaded documents, `manager_outputs` for generated versions, and `artifact_links` to reference one canonical object from song, task, mission, and conversation contexts. Extend the existing share-link snapshot rather than introducing an EPK subsystem, and split the current large Music screen into focused presentation components without changing unrelated navigation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase/Postgres, Supabase Edge Functions, Vitest, Testing Library, Netlify.

---

## File structure

- `src/features/music/SongRoomAttachments.tsx`: compact song, release-work, and conversation context attachments.
- `src/features/music/SongFilesPanel.tsx`: audio, images, documents, upload affordances, native document entry, and file rows.
- `src/features/music/SongDetailsPanel.tsx`: readable grouped facts, inline editing, lyrics editor entry, and review-only statuses.
- `src/features/music/SongDocumentEditor.tsx`: focused editor for native and Manager-generated documents.
- `src/features/music/MusicScreens.tsx`: Song Room orchestration, tab state, playback, dialogs, and repository callbacks.
- `src/features/missions/MissionScreens.tsx`: compact linked-song context only.
- `src/features/manager/ManagerScreens.tsx`: focused-song context strip and canonical document artifact actions.
- `src/types/cleanProduction.ts`: song materials, documents, share snapshot, and repository action contracts.
- `src/services/productionSupabase.ts`: canonical projections and mutations.
- `src/services/fixtureRepositories.ts`: fixture parity.
- `supabase/migrations/20260809000300_song_documents_and_share_snapshots.sql`: additive document-to-song metadata/indexes and versioned share information manifest.
- `supabase/functions/music-share-links/index.ts`: server-authoritative asset/document/information snapshot creation.
- `supabase/functions/public-music-share/index.ts`: backward-compatible public package loading.
- `src/PublicMusicSharePortal.tsx`: media-first recipient renderer shared by preview and public link.

### Task 1: Replace duplicated linked-work UI with compact contextual attachments

**Files:**
- Create: `src/features/music/SongRoomAttachments.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/mission-workspace-simplification.test.tsx`

- [ ] **Step 1: Write failing attachment hierarchy tests**

Add tests that require the Song Overview to render one `Release work` region with the mission title, current task, `Open plan`, and `Talk to Manager`, while removing the `Linked work` heading, linked-conversation card, and linked-mission count. Require Mission Room to render one compact linked-song attachment and song-focused chat to render one context strip without repeating full mission/song artifacts.

```tsx
expect(within(songRoom).getByRole("region", { name: "Release work" })).toHaveTextContent("Add the current working audio");
expect(within(songRoom).queryByText("Linked work")).not.toBeInTheDocument();
expect(within(songRoom).getByRole("button", { name: "Open plan" })).toBeInTheDocument();
expect(within(songRoom).getByRole("button", { name: "Talk to Manager" })).toBeInTheDocument();
expect(within(missionRoom).getByTestId("linked-song-attachment")).toHaveTextContent("Night Bus");
expect(within(conversation).getByTestId("conversation-song-context")).toHaveTextContent("Night Bus");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx -t "Release work|linked song|song context"`

Expected: FAIL because the current Overview renders separate conversation and mission attachments and Mission/Manager do not share the compact attachment language.

- [ ] **Step 3: Implement the attachment components**

Create focused components with these contracts:

```ts
type SongContextAttachmentProps = {
  title: string;
  artworkUrl?: string;
  stage?: string;
  canPlay?: boolean;
  onPlay?: () => void;
  onOpenSong: () => void;
};

type ReleaseWorkAttachmentProps = {
  missionTitle: string;
  currentTask?: string;
  progress?: number;
  blocker?: string;
  onOpenPlan: () => void;
  onTalkToManager: () => void;
};
```

Remove the Overview right-column `Linked work` panel. Keep the Manager recommendation and render the release-work strip below it. Suppress redundant mission artifacts in song/task-scoped conversations using the existing artifact filtering rules.

- [ ] **Step 4: Verify GREEN**

Run the command from Step 2 and then `npm test -- --run src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/features/music/SongRoomAttachments.tsx src/features/music/MusicScreens.tsx src/features/missions/MissionScreens.tsx src/features/manager/ManagerScreens.tsx src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx
git commit -m "feat: unify song work attachments"
```

### Task 2: Project uploaded files and canonical documents into one song material library

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Create: `supabase/migrations/20260809000300_song_documents_and_share_snapshots.sql`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/music-share-links-schema.test.ts`

- [ ] **Step 1: Write failing projection and schema tests**

Require `MusicObjectViewModel` to expose uploaded media and linked documents without copying one document per context.

```ts
expect(song.materials).toEqual(expect.arrayContaining([
  expect.objectContaining({ id: "asset-master", kind: "file", group: "Audio", materialType: "final_master" }),
  expect.objectContaining({ id: "document-press", kind: "document", group: "Documents", materialType: "press_release", reviewState: "needs_review" }),
]));
expect(song.materials.filter((item) => item.id === "document-press")).toHaveLength(1);
expect(migration).toContain("information_manifest jsonb not null default '{}'::jsonb");
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-supabase-service.test.ts src/music-share-links-schema.test.ts -t "song material|information manifest"`

Expected: FAIL because Files projects only `music_assets` and share links have no information snapshot.

- [ ] **Step 3: Add the narrow additive schema and types**

Add nullable/additive fields only:

```sql
alter table public.music_share_links
  add column if not exists information_manifest jsonb not null default '{}'::jsonb;

create index if not exists artifact_links_song_documents_idx
  on public.artifact_links (target_type, target_id, source_type)
  where target_type = 'music_item' and source_type = 'document';
```

Define a discriminated `SongMaterialViewModel` for `file` and `document`, including `group`, `materialType`, `title`, optional filename/size/date/thumbnail, `reviewState`, and `origin`. Preserve `fileAssets` temporarily as a compatibility projection until all consumers migrate.

- [ ] **Step 4: Load linked documents once**

In `productionSupabase`, query `artifact_links` from `document` to the exact `music_item`, load current document/version/Manager output rows, and merge them with uploaded assets by canonical ID. Do not infer links from titles. Map `manager_generated + draft/needs_revision` to `needs_review`; accepted/user-saved items remain quiet.

- [ ] **Step 5: Verify GREEN and migration compatibility**

Run: `npm test -- --run src/production-supabase-service.test.ts src/music-share-links-schema.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts supabase/migrations/20260809000300_song_documents_and_share_snapshots.sql src/production-supabase-service.test.ts src/music-share-links-schema.test.ts
git commit -m "feat: project canonical song materials"
```

### Task 3: Add native song documents and Manager draft promotion

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/manager-conversation-tool-executor.test.ts`

- [ ] **Step 1: Write failing native-document mutation tests**

Define and test repository actions:

```ts
createSongDocument?(musicItemId: string, input: {
  documentType: SongDocumentType;
  title: string;
  body: string;
}): Promise<SongMaterialViewModel>;
updateSongDocument?(documentId: string, input: { title?: string; body: string }): Promise<SongMaterialViewModel>;
acceptSongDocument?(musicItemId: string, documentId: string): Promise<SongMaterialViewModel>;
```

Require creation to insert one `documents` row, one text-backed `document_versions` row, and one document-to-song `artifact_links` row. Require accepting a Manager draft to update the same document, preserve version history, emit one event, and complete only an exactly linked collaborative task.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-supabase-service.test.ts src/openai-manager-conversation-function.test.ts src/manager-conversation-tool-executor.test.ts -t "song document|Manager press release"`

- [ ] **Step 3: Implement native document persistence**

Store native body text in the current version metadata or an existing Manager output reference; do not create a fake uploaded file. Link the document to the song and optional exact task. Emit `song_document_created`, `song_document_updated`, or `song_document_accepted` with song/mission scope. Preserve AI failure isolation.

- [ ] **Step 4: Link Manager-generated deliverables to the song**

When a focused-song Manager task creates a `task_draft` whose document type is one of `press_release`, `artist_biography`, `press_angle`, `one_sheet`, `lyrics`, `credits`, or `distributor_notes`, ensure the persisted document receives the same song artifact link. Return the document ID in the existing created-work artifact; do not create a second document in the browser.

- [ ] **Step 5: Verify GREEN**

Run the full files from Step 2 without the name filter.

- [ ] **Step 6: Commit**

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/production-supabase-service.test.ts src/openai-manager-conversation-function.test.ts src/manager-conversation-tool-executor.test.ts
git commit -m "feat: connect Manager drafts to song documents"
```

### Task 4: Rebuild Files with contextual creation, artwork synchronization, and stable playback

**Files:**
- Create: `src/features/music/SongFilesPanel.tsx`
- Create: `src/features/music/SongDocumentEditor.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write failing Files interaction tests**

Require `Add audio`, `Add image`, and `Add document` to be visible in their groups. Test category-filtered types, top-level mixed upload classification, `Write here`, `Ask Manager to draft`, `Upload a file`, native editor save, Manager draft review actions, image thumbnails, and playable audio. Require `cover_art` upload to become the canonical `coverImageUrl`, while `press_photo` does not.

```tsx
expect(within(files).getByRole("button", { name: "Add audio" })).toBeInTheDocument();
expect(within(files).getByRole("button", { name: "Add image" })).toBeInTheDocument();
expect(within(files).getByRole("button", { name: "Add document" })).toBeInTheDocument();
fireEvent.click(within(files).getByRole("button", { name: "Add document" }));
expect(screen.getByRole("menuitem", { name: "Write here" })).toBeInTheDocument();
expect(screen.getByRole("menuitem", { name: "Ask Manager to draft" })).toBeInTheDocument();
expect(screen.getByRole("menuitem", { name: "Upload a file" })).toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx src/production-supabase-service.test.ts -t "Add document|cover artwork|native document|current audio"`

- [ ] **Step 3: Implement the focused Files components**

Move presentation out of `MusicScreens.tsx` without changing repository ownership. Use one calm section per group, real rows, one contextual add button, and no permanent missing scoreboard. The document editor supports direct editing, Save, Cancel, `Ask Manager`, `Use this`, and version-safe errors. The Ask Manager action opens the exact official song conversation with a bounded starter prompt for the chosen document type.

- [ ] **Step 4: Synchronize protected artwork and masthead playback**

Project the newest canonical `cover_art` through a short-lived signed read URL for owner UI only. Refresh Catalog and active Song Room after upload. Reuse `getAssetAccessUrl` for the masthead and Files Play controls; never persist signed URLs or send them to Manager context.

- [ ] **Step 5: Verify GREEN**

Run the full files from Step 2 and confirm mobile class expectations remain green.

- [ ] **Step 6: Commit**

```bash
git add src/features/music/SongFilesPanel.tsx src/features/music/SongDocumentEditor.tsx src/features/music/MusicScreens.tsx src/services/productionSupabase.ts src/production-app-shell.test.tsx src/production-supabase-service.test.ts
git commit -m "feat: complete song material creation"
```

### Task 5: Replace the Details scoreboard with a readable editable record

**Files:**
- Create: `src/features/music/SongDetailsPanel.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write failing Details tests**

Require Song identity, Artists & credits, Release information, and Lyrics sections. Missing values render contextual `Add <field>` actions without Missing pills or section fractions. Saved user values remain quiet; only Suggested and Needs review render status. Provider values remain editable through canonical overrides while identifiers use deliberate replacement.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx src/production-supabase-service.test.ts -t "readable song details|Saved metadata|lyrics editor"`

- [ ] **Step 3: Correct status/provenance semantics**

Map direct user input to `Saved`; trusted matching provider data to `Verified`; inference to `Suggested`; conflicts to `Needs review`. Preserve imported evidence internally. Stop using Draft as the default for explicit user saves.

- [ ] **Step 4: Implement inline Details editing**

Render short fields inline with local Save/Cancel and preserved validation input. Use the native Song Document editor for canonical lyrics. Featured artists use a repeatable person control backed by the existing canonical metadata/contributor model.

- [ ] **Step 5: Verify GREEN and commit**

Run the full files from Step 2.

```bash
git add src/features/music/SongDetailsPanel.tsx src/features/music/MusicScreens.tsx src/services/productionSupabase.ts src/production-app-shell.test.tsx src/production-supabase-service.test.ts
git commit -m "feat: make song details calm and editable"
```

### Task 6: Finish selective EPK packages with canonical information and preview

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `supabase/functions/music-share-links/index.ts`
- Modify: `supabase/functions/public-music-share/index.ts`
- Modify: `src/PublicMusicSharePortal.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/music-share-links-functions.test.ts`
- Test: `src/public-music-share-portal.test.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing server and UI tests**

Require Press, Producer, Distributor, and Custom presets to select only server-eligible files/documents plus chosen canonical information. Require versioned information snapshots, backward-compatible asset-only links, exact preview parity, link-ready state persistence, and email-failure isolation.

```ts
expect(created.informationManifest).toMatchObject({
  version: 1,
  fields: expect.arrayContaining([expect.objectContaining({ key: "lyrics" })]),
});
expect(screen.getByRole("button", { name: "Preview package" })).toBeInTheDocument();
expect(screen.getByText("Link ready")).toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/music-share-links-functions.test.ts src/public-music-share-portal.test.tsx src/production-app-shell.test.tsx -t "information manifest|Preview package|Link ready"`

- [ ] **Step 3: Implement server-authoritative snapshots**

Accept selected asset IDs, linked document IDs, and allowed canonical field keys. Resolve every value server-side from the exact owned song, document and uploaded-file records. Store a versioned snapshot in `information_manifest`; never trust browser-supplied field values or storage paths. Preserve existing links whose manifest is empty.

- [ ] **Step 4: Implement the three-state composer**

Keep one modal/sheet: Choose, Preview, Link ready. Presets recommend a restrained starting selection. Press package gaps appear only inside the composer. Preview and public portal share the same recipient renderer. The success state exposes Copy, Open, Send, expiration and Revoke without dismissing itself.

- [ ] **Step 5: Verify GREEN and commit**

Run the full files from Step 2.

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts supabase/functions/music-share-links/index.ts supabase/functions/public-music-share/index.ts src/PublicMusicSharePortal.tsx src/features/music/MusicScreens.tsx src/music-share-links-functions.test.ts src/public-music-share-portal.test.tsx src/production-app-shell.test.tsx
git commit -m "feat: finish selective EPK sharing"
```

### Task 7: Adapt the same Song Room for released and imported catalog songs

**Files:**
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/features/music/SongFilesPanel.tsx`
- Modify: `src/features/music/SongDetailsPanel.tsx`
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/manager-conversation-tool-executor.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Cover one unreleased song, one manually released song, and one Spotify-imported catalog song. Released work preserves canonical files/documents and package history, changes guidance to archive/sharing, keeps stage locked, and does not reopen pre-release gates. Imported songs without private assets receive an invitation to attach controlled files rather than missing-release warnings.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx src/manager-conversation-tool-executor.test.ts -t "released Song Room|imported catalog materials"`

- [ ] **Step 3: Implement lifecycle presentation and Manager policy**

Derive operating mode from lifecycle/released date/source kind. Use private Play when available and Open on Spotify otherwise. Released Details prioritizes dates, credits, identifiers and corrections; released Rights preserves history; Manager stops proposing completed pre-release work.

- [ ] **Step 4: Verify GREEN and commit**

Run the full files from Step 2.

```bash
git add src/features/music/MusicScreens.tsx src/features/music/SongFilesPanel.tsx src/features/music/SongDetailsPanel.tsx src/services/productionSupabase.ts src/production-app-shell.test.tsx src/manager-conversation-tool-executor.test.ts
git commit -m "feat: complete released song operation"
```

### Task 8: Production verification, deployment and live QA

**Files:**
- Modify only for defects reproduced by a failing test.

- [ ] **Step 1: Run focused regression suites**

Run:

```bash
npm test -- --run src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx src/mission-task-deliverables.test.tsx src/openai-manager-conversation-function.test.ts src/manager-conversation-tool-executor.test.ts src/music-share-links-functions.test.ts src/public-music-share-portal.test.tsx src/split-confirmation-portal.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run full verification**

Run `npm test -- --run`, `npm run build`, and the repository's configured type/lint commands. Existing unrelated type debt must be reported separately; no new changed-file errors are allowed.

- [ ] **Step 3: Deploy backend additions in compatibility order**

Apply the additive migration, deploy `music-share-links`, `public-music-share`, and changed Manager functions, verify unauthenticated rejection and existing-link compatibility, then deploy the tested frontend.

- [ ] **Step 4: Live browser QA**

Using the logged-in Ordersounds Chrome tab, verify desktop and 390 px mobile:

- compact attachment hierarchy in Song, Mission and Manager;
- audio upload/progress/retry/playback and masthead playback;
- cover upload updates Song Room and Catalog while press photo does not;
- native user document creation/editing;
- Manager press-release draft, revision and acceptance into the same Documents item;
- EPK choose/preview/link-ready/public anonymous recipient/download/revoke;
- Details add/edit/lyrics/provenance behavior;
- Rights split flow remains independent;
- manually released and imported catalog behavior;
- no console errors or horizontal overflow.

- [ ] **Step 5: Push and deploy**

Commit only evidence-backed QA fixes, push `main` as explicitly requested, deploy production, reload the production URL, repeat the smoke checks, and preserve unrelated user-owned untracked files.
