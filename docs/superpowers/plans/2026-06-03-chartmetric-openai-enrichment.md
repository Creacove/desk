# Chartmetric And OpenAI Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chartmetric as the first paid enrichment source and OpenAI as the source-backed summary generator without breaking the current Spotify/Music spine.

**Architecture:** Build this in small verified slices. Chartmetric first resolves and snapshots provider data server-side, queues setup enrichment for the artist profile, setup project/release, and standalone songs, then normalizes evidence into manager-readable facts. OpenAI only summarizes persisted Music/evidence/limitation records, so generated text never becomes the source of truth.

**Tech Stack:** React, TypeScript, Vitest, Supabase Postgres, Supabase Edge Functions, Chartmetric REST API, OpenAI Responses API.

---

## Current Baseline

The repo is currently at Phase 4 gate verification with Chartmetric enrichment work underway:

- Production app is default; prototype is explicit opt-in.
- Spotify catalog bootstrap is locally implemented and tested.
- Music workspace renders Supabase-backed songs/projects and supports basic Music writes.
- Chartmetric token exchange, artist resolution, artist enrichment, project enrichment, track enrichment, evidence normalization, setup enrichment queueing, and setup worker dispatch are locally implemented and covered by focused tests.
- Spotify setup now queues and dispatches Chartmetric setup enrichment after catalog import, without making Chartmetric queue/dispatch failure block the Spotify setup result.
- Music song overview uses one prose manager read instead of a duplicated source-summary card.
- Full test suite previously passed locally; current Chartmetric-focused slices have focused verification noted below.
- Build passes locally with one non-blocking Vite chunk-size warning.

Live verification still needs to confirm migrations, RLS, deployed functions, and a real Spotify import against Supabase.

## Product Role: What Each Source Does

Spotify has already done the first job: it confirms the artist identity and creates a durable public catalog spine. That gives Ordersounds songs, projects, identifiers, links, artwork, release dates, and public catalog limitations. It does not give private streams, saves, source-of-stream, royalties, ROI, or release conversion.

Chartmetric is the next enrichment layer, not a replacement for Spotify. In setup, Chartmetric should resolve the selected Spotify artist into a broader industry-intelligence identity, queue background enrichment for the artist profile, the latest setup project/release, and up to five standalone songs outside that project, then tell the product what extra source coverage exists. After setup, Chartmetric should keep enriching artist/project/song intelligence with provider-backed evidence such as playlist movement, chart appearances, platform streams when Chartmetric returns them, social/video/platform movement, cross-platform identifiers, and geography when the endpoint supports it. The first testable app win is not a dashboard; it is a Music overview read that feels like a manager briefing from saved sources.

OpenAI enters after data is saved. It should not call Chartmetric directly and should not invent facts. Its role is to turn saved Music state, Spotify public catalog facts, Chartmetric evidence rows, uploaded/private analytics where available, operating events, and limitations into readable song/project/Label HQ summaries. The summary is a derived artifact with provenance and usage records, not evidence.

## Small-Win Sequence For The App

1. **Credential proof:** exchange the Chartmetric refresh token for a bearer token in a tested server-side adapter.
2. **Setup proof:** after Spotify identity is selected and the Spotify catalog import finishes, queue Chartmetric enrichment jobs for the artist profile, setup project/release, and up to five standalone songs.
3. **Track proof:** enrich one imported standalone Music item through Chartmetric and store raw snapshots before evidence rows.
4. **Evidence proof:** normalize safe evidence types, including Chartmetric-reported streams/platform metrics when the source and time window are explicit.
5. **Visible proof:** show one prose manager read in the Music overview from Spotify catalog facts, Chartmetric evidence, and limitations, without duplicating the Details tab.
6. **AI proof:** generate a source-backed OpenAI summary from saved records only, then persist usage/provenance.
7. **HQ proof:** let Desk HQ use the same source-backed summary and limitations for the daily operating read.

## Source Rules

- Never commit API keys, refresh tokens, access tokens, or provider secrets.
- Store Chartmetric and OpenAI credentials only in `.env.local`, Supabase secrets, or deployment secrets.
- Raw provider snapshots must be written before evidence normalization.
- Evidence items must carry source, source kind, time window, freshness, confidence, provenance, and limitation.
- OpenAI summaries must be generated from saved records and must include source limitations.
- Spotify Web API does not provide track stream counts. Chartmetric-provided stream/platform metrics may be used when the evidence row is clearly sourced to Chartmetric and includes the metric name and time window. Spotify for Artists/private exports remain the stronger source for owned private analytics, saves, source-of-stream, revenue, and conversion.

## Environment Variables

Local `.env.local`:

```powershell
CHARTMETRIC_REFRESH_TOKEN=
CHARTMETRIC_BASE_URL=https://api.chartmetric.com
OPENAI_API_KEY=
OPENAI_SUMMARY_MODEL=
```

Supabase function secrets:

```powershell
supabase secrets set CHARTMETRIC_REFRESH_TOKEN=<paste-chartmetric-refresh-token-locally>
supabase secrets set CHARTMETRIC_BASE_URL=https://api.chartmetric.com
supabase secrets set OPENAI_API_KEY=<paste-openai-api-key-locally>
supabase secrets set OPENAI_SUMMARY_MODEL=<chosen-summary-model>
```

Use the exact model value only after confirming the current model choice for cost/quality from official OpenAI docs. Keep `OPENAI_SUMMARY_MODEL` optional so implementation can default safely server-side.

---

### Task 0: Close Current Phase 4 Gate

**Files:**
- Read: `docs/implementation-phases.md`
- Read: `README.md`
- Run only; no source edits expected unless verification exposes a bug.

- [ ] Run `npm test`.

Expected: all tests pass.

- [ ] Run `npm run build`.

Expected: build passes. The current chunk-size warning is acceptable for this gate.

- [ ] Apply migrations from a fresh Supabase local state or verify remote migrations are current.

Expected: no migration failures.

- [ ] Connect one real Spotify artist in the production app.

Expected: identity saves quickly, catalog import runs in the background, and Music records appear without fixture content.

- [ ] Record the result in `docs/implementation-phases.md` under the current status section.

Expected: Phase 4 is either marked gate closed or the exact blocker is listed.

### Task 1: Chartmetric Auth Adapter

**Files:**
- Create: `supabase/functions/_shared/chartmetricClient.ts`
- Test: `src/chartmetric-client.test.ts`
- Modify: `.env.example`

- [x] Write tests for token exchange.

Test cases:

- posts `{ "refreshtoken": value }` to `/api/token`
- returns the bearer token and expiry
- reuses an unexpired token inside one function invocation
- throws a safe error when the refresh token is missing
- preserves rate-limit headers when returned

- [x] Implement `createChartmetricClient`.

Required behavior:

- `baseUrl` defaults to `https://api.chartmetric.com`
- `refreshToken` is required
- access token exchange uses `POST /api/token`
- API requests send `Authorization: Bearer <token>`
- response metadata includes rate-limit headers when available

- [x] Run `npm test -- src/chartmetric-client.test.ts`.

Expected: tests pass.

### Task 2: Chartmetric Resolution Probe

**Files:**
- Create: `supabase/functions/chartmetric-resolve-artist/index.ts`
- Test: `src/chartmetric-resolve-artist-function.test.ts`
- Modify: `docs/workflows/external-api-source-plan.md`

- [x] Write source-level tests that the function authenticates the Supabase user before calling Chartmetric.

Expected: function source checks `auth.getUser()` or equivalent before provider calls.

- [x] Write tests that the function accepts Spotify artist ID, Spotify URL, artist name, and optional social handles.

Expected: request body is explicit and does not accept arbitrary provider paths from the client.

- [x] Implement a narrow resolver function.

Required writes:

- `source_sync_jobs` with job type `chartmetric_artist_resolve`
- `source_snapshots` for the raw resolution response
- `operating_events` for started/completed/failed

- [x] Run focused tests.

Command: `npm test -- src/chartmetric-client.test.ts src/chartmetric-resolve-artist-function.test.ts`

Expected: tests pass.

### Task 3: Chartmetric Track Enrichment Snapshot

**Files:**
- Create: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Test: `src/chartmetric-track-enrichment-function.test.ts`
- Modify: `supabase/functions/_shared/chartmetricClient.ts`

- [x] Write tests for a single-track enrichment request.

Inputs:

- account ID
- artist workspace ID
- music item ID
- known identifiers from `music_identifiers`
- optional Chartmetric artist/track IDs if already resolved

- [x] Implement one-track enrichment only.

Required behavior:

- load the Music item and identifiers from Supabase
- call Chartmetric server-side
- write one raw `source_snapshots` record per provider response
- do not update visible Music fields until evidence normalization succeeds
- record failed jobs and limitations instead of hiding errors

- [x] Run focused tests.

Command: `npm test -- src/chartmetric-client.test.ts src/chartmetric-track-enrichment-function.test.ts`

Expected: tests pass.

### Task 4: Normalize Chartmetric Evidence

**Files:**
- Create: `supabase/functions/_shared/chartmetricEvidence.ts`
- Test: `src/chartmetric-evidence.test.ts`
- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`

- [x] Write tests for supported evidence rows.

Minimum evidence types:

- playlist movement
- chart appearance
- public/social platform movement
- cross-platform track identity
- unsupported or missing metric limitation

- [x] Implement deterministic normalization.

Rules:

- no unsupported save, ROI, conversion, or source-of-stream claims
- Chartmetric-provided stream/platform metrics are allowed only as Chartmetric evidence with source, metric name, and time window
- every evidence row includes source kind `chartmetric`
- every evidence row includes time window or explicit missing-window limitation
- confidence is no higher than the source supports
- attention/social movement is not conversion proof

- [x] Run focused tests.

Command: `npm test -- src/chartmetric-evidence.test.ts src/chartmetric-track-enrichment-function.test.ts`

Expected: tests pass.

### Task 5: Song Summary Read Model

**Files:**
- Modify: `src/types/productionApp.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [x] Write tests for a song summary assembled from Music, Spotify public catalog, Chartmetric evidence, and limitations.

Expected summary includes:

- song title and lifecycle
- source badges
- identifiers
- known public catalog facts
- Chartmetric evidence when present
- explicit missing private analytics limitation

- [x] Add the manager read to the Music song room overview.

UI rule:

- show one prose read, not a source-packed details card
- show limitations plainly without making missing sources the center of the overview
- do not show fabricated streams, saves, ROI, or source-of-stream; Chartmetric-reported platform streams are allowed when sourced as Chartmetric

- [x] Run focused tests.

Command: `npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx`

Expected: tests pass.

Verified 2026-06-04:
- `npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx` passed: 2 test files, 33 tests.
- `npm test` passed: 18 test files, 89 tests.
- `npm run build` passed with the existing Vite large-chunk warning.

### Task 5A: Chartmetric Setup Enrichment Queue

**Files:**
- Create: `supabase/functions/chartmetric-setup-enrichment/index.ts`
- Test: `src/chartmetric-setup-enrichment-function.test.ts`
- Modify: `supabase/functions/spotify-catalog-bootstrap/index.ts`
- Test: `src/spotify-catalog-bootstrap-function.test.ts`
- Modify: `supabase/functions/_shared/chartmetricEvidence.ts`
- Test: `src/chartmetric-evidence.test.ts`

- [x] Write tests for a setup enrichment orchestrator that authenticates the user before queuing provider work.

Expected queued jobs:

- `chartmetric_artist_enrichment` for the artist profile
- `chartmetric_project_enrichment` for the latest setup project/release
- `chartmetric_track_enrichment` for up to five standalone songs outside the setup project

- [x] Implement queue-only setup orchestration.

Required behavior:

- no Chartmetric provider calls inside the queue function
- source connection metadata records target scope and target IDs
- queued jobs use `status = queued`
- operating event records `chartmetric_setup_enrichment_queued`
- Spotify bootstrap calls this queue after catalog import and logs queue failure without failing Spotify setup
- setup orchestration dispatches queued worker functions with `sourceSyncJobId` and `sourceConnectionId` through `EdgeRuntime.waitUntil`

- [x] Allow Chartmetric-provided stream/platform metrics in evidence normalization.

Required behavior:

- source is `Chartmetric`
- metric names include the platform, for example `spotify_streams`
- metric unit is the returned metric name
- evidence keeps the time window when available
- limitation says this is Chartmetric-reported platform data, not Spotify Web API/private account analytics

Verified 2026-06-04:
- `npm test -- src/spotify-catalog-bootstrap-function.test.ts src/chartmetric-setup-enrichment-function.test.ts src/chartmetric-evidence.test.ts` passed: 3 test files, 12 tests.

### Task 5B: Chartmetric Artist And Project Enrichment Workers

**Files:**
- Create: `supabase/functions/chartmetric-artist-enrichment/index.ts`
- Create: `supabase/functions/chartmetric-project-enrichment/index.ts`
- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Modify: `supabase/functions/_shared/chartmetricEvidence.ts`
- Test: `src/chartmetric-artist-enrichment-function.test.ts`
- Test: `src/chartmetric-project-enrichment-function.test.ts`
- Test: `src/chartmetric-track-enrichment-function.test.ts`
- Test: `src/chartmetric-setup-enrichment-function.test.ts`

- [x] Implement `chartmetric_artist_enrichment`.

Required behavior:

- authenticates user and checks account membership before Chartmetric calls
- consumes queued `chartmetric_artist_enrichment` jobs when `sourceSyncJobId` is supplied
- loads source connection metadata and artist profile context
- writes raw `chartmetric_artist_enrichment` snapshots before evidence rows
- normalizes evidence with `subject_type = artist`
- marks jobs `running`, then `completed` or `failed`

- [x] Implement `chartmetric_project_enrichment`.

Required behavior:

- authenticates user and checks account membership before Chartmetric calls
- consumes queued `chartmetric_project_enrichment` jobs when `sourceSyncJobId` is supplied
- loads the setup project, project identifiers, and tracklist before provider calls
- writes raw `chartmetric_project_enrichment` snapshots before evidence rows
- normalizes evidence with `subject_type = music_project`
- marks jobs `running`, then `completed` or `failed`

- [x] Extend the existing `chartmetric_track_enrichment` worker to consume queued setup jobs for standalone songs.

Verified 2026-06-04:
- `npm test -- src/chartmetric-client.test.ts src/chartmetric-resolve-artist-function.test.ts src/chartmetric-artist-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-setup-enrichment-function.test.ts src/chartmetric-evidence.test.ts src/spotify-catalog-bootstrap-function.test.ts` passed: 8 test files, 35 tests.

Next small win after this task:

- Run one real artist setup to inspect which Chartmetric fields are most useful in the UI, then map those saved evidence rows into the Music/Label HQ manager read before starting OpenAI generation.

### Task 6: OpenAI Source-Backed Summary Function

**Files:**
- Create: `supabase/functions/generate-music-summary/index.ts`
- Create: `supabase/functions/_shared/openaiSummary.ts`
- Test: `src/openai-music-summary-function.test.ts`
- Modify: `docs/workflows/data-source-map.md`

- [ ] Write source-level tests that the function reads saved Music/evidence records before calling OpenAI.

Expected: function does not accept arbitrary source facts from the client.

- [ ] Write tests for unsupported-claim guardrails.

Expected: prompt/input includes explicit instructions that Spotify Web API does not support stream counts, saves, source-of-stream, revenue, or conversion.

- [ ] Implement summary generation with the Responses API.

Required writes:

- `manager_synthesis_runs` or a scoped summary run record if existing schema supports it
- `ai_run_usage_events`
- generated summary artifact or Music metadata field with provenance
- `operating_events`

- [ ] Run focused tests.

Command: `npm test -- src/openai-music-summary-function.test.ts`

Expected: tests pass.

### Task 7: Label HQ Limited Read Projection

**Files:**
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/desk/DeskHQ.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] Write tests for a source-backed Desk HQ projection.

Expected projection includes:

- artist profile
- source readiness
- imported Music summary
- recent operating events
- staff readiness
- active missions
- limitations when Chartmetric/OpenAI/private analytics are missing

- [ ] Implement the read projection without hard-coded Sable Day/Night Bus copy.

Required behavior:

- empty states are honest
- every state-bearing line comes from records or a limitation
- Music summary links to the song room

- [ ] Run focused tests.

Command: `npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx`

Expected: tests pass.

### Task 8: Deployment And Small-Win Verification

**Files:**
- Modify: `docs/implementation-phases.md`
- Modify: `README.md` only if commands or env requirements change.

- [ ] Run full local verification.

Commands:

```powershell
npm test
npm run build
```

Expected: both pass.

- [ ] Set Supabase function secrets.

Required secrets:

- `CHARTMETRIC_REFRESH_TOKEN`
- `CHARTMETRIC_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_SUMMARY_MODEL`

- [ ] Deploy only the functions built in this plan.

Expected: no unrelated function churn.

- [ ] Run one real artist and one real song through the flow.

Expected:

- Chartmetric token exchange succeeds
- raw snapshots exist before evidence
- one song summary renders with sources and limitations
- OpenAI summary does not invent unsupported metrics
- usage events exist for OpenAI work

- [ ] Update `docs/implementation-phases.md` with the exact gate result.

Expected: Phase 5 status is either advanced or blocked with a concrete reason.

## Execution Order

Recommended small-win sequence:

1. Close Phase 4 gate.
2. Chartmetric auth adapter.
3. Chartmetric artist resolution.
4. One-track enrichment.
5. Evidence normalization.
6. Song summary read model.
7. OpenAI generated summary.
8. Label HQ read projection.
9. Deployment verification.

Do not start broad social ingestion, YouTube, TikTok raw scraping, or Manager automation until the one-song Chartmetric/OpenAI loop works end to end.
