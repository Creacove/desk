# Async Spotify Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Spotify artist identity selection from catalog fetching while still importing a small, verified starter catalog in the background.

**Architecture:** The UI calls a fast `connectSpotifyArtist` operation that saves the artist identity and starts a catalog sync job. The catalog sync runs server-side, stores raw Spotify snapshots first, then normalizes only the latest album/project and up to five starter tracks into Music tables.

**Tech Stack:** React, Vitest, Supabase JS, Supabase Edge Functions, PostgreSQL migrations, Spotify Web API.

**Status as of June 3, 2026:** Locally implemented and covered by tests. Deployment/live Supabase verification is still pending unless confirmed separately.

---

### Task 1: Production UI Flow

**Files:**
- Modify: `src/types/productionApp.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/app/ProductionApp.tsx`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/production-supabase-service.test.ts`

- [x] Write failing tests that selecting a Spotify artist moves to Manager Basics after identity save even when catalog is still running.
- [x] Replace blocking `bootstrapCatalog` on artist selection with a fast `connectSpotifyArtist` call.
- [x] Preserve `latestCatalogSyncStatus` on the workspace so setup and Desk HQ can gate on catalog state.

### Task 2: Backend Async Boundary

**Files:**
- Create: `supabase/functions/connect-spotify-artist/index.ts`
- Modify: `supabase/functions/spotify-catalog-bootstrap/index.ts`
- Test: `src/spotify-artist-search-function.test.ts`

- [x] Add a source-level test that the connect function saves identity and uses `EdgeRuntime.waitUntil` to invoke catalog bootstrap without blocking the response.
- [x] Return a workspace payload with `spotify_connected = true` and `latest_catalog_sync_status = running`.
- [x] Keep errors from the background import inside `source_sync_jobs.error` and `operating_events`, not as artist-selection UI blockers.

### Task 3: Catalog Scope and Storage

**Files:**
- Modify: `src/services/spotifyCatalogBootstrap.ts`
- Modify: `supabase/functions/spotify-catalog-bootstrap/index.ts`
- Test: `src/spotify-catalog-bootstrap.test.ts`

- [x] Write failing tests that only the latest project-like album is normalized as a project.
- [x] Write failing tests that only up to five tracks are normalized from the latest album plus top-track fallback.
- [x] Store raw artist, album-list, selected-album, album-track, and top-track responses in `source_snapshots` before Music writes.
- [x] Store normalized records in `music_projects`, `music_items`, `music_project_items`, and `music_identifiers`.

### Task 4: Verification and Deploy

**Files:**
- Modify only files changed above.

- [x] Run focused tests: `npm test -- src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/spotify-catalog-bootstrap.test.ts src/spotify-artist-search-function.test.ts`.
- [x] Run `npm run build`.
- [ ] Push migrations if added.
- [ ] Deploy `connect-spotify-artist` and `spotify-catalog-bootstrap`.
- [ ] Verify remote functions list shows both active.
