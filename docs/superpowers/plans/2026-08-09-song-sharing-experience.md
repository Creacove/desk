# Song Sharing Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the crowded song share modal and generic public file list with an effortless package builder, real preview, dedicated link-result state, designed email handoff, and music-first anonymous recipient page.

**Architecture:** Keep the existing `music_share_links` token, revocation, access-count, storage, and repository boundaries. Extract pure preset/metadata helpers and a shared package renderer so authenticated preview and the public route use one presentation model. Extend Edge Function payloads backward-compatibly; deploy functions before the compatible frontend.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest and Testing Library, Supabase Edge Functions/Deno, Supabase Storage signed URLs, existing transactional email service, Netlify.

---

## File structure

- Create `src/features/music/musicSharePackage.ts`: pure preset selection, available-information mapping, package grouping, and presentation helpers.
- Create `src/features/music/MusicSharePackageView.tsx`: shared recipient/preview renderer with music-first hierarchy.
- Create `src/features/music/MusicShareDialog.tsx`: package builder, exact preview, link-ready result, email handoff, and link management.
- Modify `src/features/music/MusicScreens.tsx`: replace the embedded dialog with the focused component and pass current song/access dependencies.
- Modify `src/features/music/PublicMusicSharePortal.tsx`: keep loading/error ownership and render `MusicSharePackageView`.
- Modify `src/services/publicMusicShare.ts`: normalize the expanded backward-compatible package payload.
- Modify `src/types/cleanProduction.ts`: extend share view models only with fields used by the UI.
- Modify `supabase/functions/music-share-links/index.ts`: canonical manual-detail resolution, truthful manifests, richer list response, and designed email.
- Modify `supabase/functions/public-music-share/index.ts`: identity projection plus separate inline/download signed URLs.
- Test `src/music-share-package.test.ts`, `src/production-app-shell.test.tsx`, `src/public-music-share-portal.test.tsx`, `src/public-music-share-service.test.ts`, and `src/music-share-links-functions.test.ts`.

### Task 1: Canonical package selection

**Files:**
- Create: `src/features/music/musicSharePackage.ts`
- Create: `src/music-share-package.test.ts`

- [ ] **Step 1: Write failing tests for existing-content-only presets**

Cover Listen selecting current audio and identity, Press kit selecting audio/artwork/accepted documents/populated details, Delivery selecting current/final audio/artwork/release details, Custom starting empty, and a manual selection converting the purpose to Custom.

```ts
expect(buildShareSelection("epk_press", inventory)).toEqual({
  assetIds: ["master", "cover"],
  documentIds: ["press-release"],
  informationKeys: ["song_title", "primary_artist", "genre"],
});
expect(availableInformation(inventory)).not.toContainEqual(expect.objectContaining({ key: "release_date" }));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run src/music-share-package.test.ts`  
Expected: FAIL because `musicSharePackage.ts` and its exported selection helpers do not exist.

- [ ] **Step 3: Implement minimal pure helpers**

Export typed `SharePurpose`, `ShareInventory`, `availableInformation`, `buildShareSelection`, `groupShareAssets`, and `selectionCount`. Preserve source ordering and never synthesize missing values.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run src/music-share-package.test.ts`  
Expected: all package-selection tests pass.

### Task 2: Shared recipient renderer

**Files:**
- Create: `src/features/music/MusicSharePackageView.tsx`
- Modify: `src/services/publicMusicShare.ts`
- Modify: `src/public-music-share-service.test.ts`
- Modify: `src/public-music-share-portal.test.tsx`
- Modify: `src/features/music/PublicMusicSharePortal.tsx`

- [ ] **Step 1: Write failing service and component tests**

Assert identity/artwork normalization, separate inline/download URLs, one prominent audio player, rendered artwork, readable native press copy, grouped downloads, compact populated facts, omission of unselected/internal content, and compatibility with old asset-only payloads.

```tsx
expect(await screen.findByRole("heading", { name: "Jam" })).toBeInTheDocument();
expect(screen.getByText("Nova Vale")).toBeInTheDocument();
expect(screen.getByLabelText("Listen to Jam")).toHaveAttribute("src", "https://files.example/inline-master");
expect(screen.getByRole("img", { name: "Jam artwork" })).toHaveAttribute("src", "https://files.example/inline-cover");
```

- [ ] **Step 2: Run recipient tests and verify RED**

Run: `npm test -- --run src/public-music-share-service.test.ts src/public-music-share-portal.test.tsx`  
Expected: FAIL on the new identity, media, and hierarchy assertions.

- [ ] **Step 3: Extend the public view model and build the shared renderer**

Add optional `title`, `artist`, `createdAt`, `expiresAt`, `inlineUrl`, and `downloadUrl` fields with old-link fallbacks. Build a restrained Ordersounds renderer with artwork/identity, one primary player, document reading, grouped downloads, and details.

- [ ] **Step 4: Replace portal internals with the renderer**

Keep the portal's loading and unavailable states. Remove generic explanatory copy, repeated audio controls, and dashboard-like file cards.

- [ ] **Step 5: Run recipient tests and verify GREEN**

Run: `npm test -- --run src/public-music-share-service.test.ts src/public-music-share-portal.test.tsx`  
Expected: all recipient tests pass.

### Task 3: Effortless owner builder and exact preview

**Files:**
- Create: `src/features/music/MusicShareDialog.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing owner-flow tests**

Assert the default purpose, populated choices only, no pre-creation email/history/security prose, preset-driven selection, exact preview content, mobile-safe sheet/footer classes, preserved selection after failure, and a single primary `Create link` action.

```tsx
fireEvent.click(within(room).getByRole("button", { name: "Share files" }));
expect(screen.queryByLabelText("Send to email")).not.toBeInTheDocument();
expect(screen.queryByText(/Links stay revocable/)).not.toBeInTheDocument();
expect(screen.queryByText("Release date")).not.toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Preview" }));
expect(screen.getByRole("heading", { name: "QA Release Flow" })).toBeInTheDocument();
expect(screen.getByLabelText("Listen to QA Release Flow")).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused owner tests and verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx -t "share"`  
Expected: FAIL because the current modal exposes email/history/prose and preview is only a count.

- [ ] **Step 3: Implement the focused dialog component**

Use explicit `build | preview | ready | manage` states. Use preset buttons, grouped eligible selections, shared `MusicSharePackageView`, sticky mobile actions, accessible status announcements, and stable error placement. Request short-lived media access only when preview opens.

- [ ] **Step 4: Wire the Song Room to the new component**

Remove the embedded dialog from `MusicScreens.tsx`, pass `song`, create/list/send/revoke functions, and `getAssetAccessUrl`, and preserve Share focus on close.

- [ ] **Step 5: Run owner tests and verify GREEN**

Run: `npm test -- --run src/production-app-shell.test.tsx -t "share"`  
Expected: all share owner-flow tests pass.

### Task 4: Link-ready result, email, and link management

**Files:**
- Modify: `src/features/music/MusicShareDialog.tsx`
- Modify: `src/production-app-shell.test.tsx`
- Modify: `supabase/functions/music-share-links/index.ts`
- Modify: `src/music-share-links-functions.test.ts`

- [ ] **Step 1: Write failing result and email tests**

Assert creation replaces the builder, Copy/Open/Send by email/Create another/Revoke actions work, email is revealed only after creation, email failure preserves the link, Manage links separates active/revoked history, and email HTML has one branded CTA plus fallback URL.

```tsx
expect(await screen.findByText("Link ready")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Send by email" }));
expect(screen.getByLabelText("Recipient email")).toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --run src/production-app-shell.test.tsx -t "share" src/music-share-links-functions.test.ts`  
Expected: FAIL on result-state and designed-email assertions.

- [ ] **Step 3: Implement result and management states**

Make Copy primary, use a selectable URL field as secondary evidence, open the link in a safe new tab, reveal email locally, and keep revoked history collapsed. Do not return to the builder on send/revoke errors.

- [ ] **Step 4: Upgrade transactional email copy**

Resolve canonical artist/song identity server-side and render a responsive table-based email with `<artist> shared <song> with you`, package purpose, one `Open private package` CTA, fallback URL, and revocation note. Escape all values.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- --run src/production-app-shell.test.tsx -t "share" src/music-share-links-functions.test.ts`  
Expected: all result/email tests pass.

### Task 5: Backward-compatible server package projection

**Files:**
- Modify: `supabase/functions/music-share-links/index.ts`
- Modify: `supabase/functions/public-music-share/index.ts`
- Modify: `src/music-share-links-functions.test.ts`
- Modify: `src/public-music-share-service.test.ts`

- [ ] **Step 1: Write failing server contract tests**

Assert manual details win over top-level/provider values, empty requested facts are omitted, accepted non-empty documents only are snapshotted, public assets receive separate inline/download URLs, artwork and primary audio identities are exposed, and old manifests remain readable.

```ts
expect(authenticatedSource).toContain("metadata.manual_details");
expect(publicSource).toContain("inlineUrl");
expect(publicSource).toContain("downloadUrl");
expect(publicSource).toContain("createSignedUrl(path, 300)");
```

- [ ] **Step 2: Run server contract tests and verify RED**

Run: `npm test -- --run src/music-share-links-functions.test.ts src/public-music-share-service.test.ts`  
Expected: FAIL on canonical-resolution and dual-URL assertions.

- [ ] **Step 3: Implement canonical snapshot resolution**

Resolve manual overrides first, then canonical metadata, imported provider metadata, and columns. Persist a versioned identity block inside `information_manifest` while preserving existing `fields` and `asset_manifest` readers.

- [ ] **Step 4: Implement public inline/download projection**

Create one inline signed URL and one filename-preserving download signed URL per available stored asset. Return the identity block and omit broken individual assets without exposing storage paths.

- [ ] **Step 5: Run server/service tests and verify GREEN**

Run: `npm test -- --run src/music-share-links-functions.test.ts src/public-music-share-service.test.ts`  
Expected: all package contract tests pass.

### Task 6: Full verification and production deployment

**Files:**
- Modify only if a failing test exposes a scoped sharing defect.

- [ ] **Step 1: Run focused sharing verification**

Run: `npm test -- --run src/music-share-package.test.ts src/public-music-share-service.test.ts src/public-music-share-portal.test.tsx src/music-share-links-functions.test.ts src/production-app-shell.test.tsx`  
Expected: all focused files pass.

- [ ] **Step 2: Run repository verification**

Run: `npm test -- --run`  
Expected: zero failures.  
Run: `npm run build`  
Expected: production build exits 0.  
Run: `git diff --check`  
Expected: no whitespace errors.

- [ ] **Step 3: Deploy backend compatibility layer**

Run:

```powershell
supabase functions deploy music-share-links --project-ref bbwbxmnanccwottrmkqu --no-verify-jwt
supabase functions deploy public-music-share --project-ref bbwbxmnanccwottrmkqu --no-verify-jwt
```

Expected: both functions report deployed.

- [ ] **Step 4: Deploy frontend**

Run: `netlify deploy --prod --dir=dist --json --message "Ship effortless song sharing"`  
Expected: JSON receipt with `https://desk.ordersounds.com`.

- [ ] **Step 5: Run live browser QA**

In the logged-in Order tab, verify package selection, real preview, link creation, copy, open, email send, active-link management, and revoke. Verify the anonymous link at desktop and narrow mobile width, including playback, artwork, documents, details, download, invalid/revoked behavior, and zero console errors.

- [ ] **Step 6: Commit and push**

```powershell
git add src supabase/functions docs/superpowers/plans/2026-08-09-song-sharing-experience.md
git commit -m "feat: rebuild song sharing experience"
git push origin main
```

Expected: `main` is synchronized with `origin/main`; unrelated user-owned untracked files remain untouched.
