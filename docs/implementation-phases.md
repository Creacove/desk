# Ordersounds Production Implementation Phases

Purpose: implementation control document for turning the frozen prototype into the production Ordersounds operating system.

The prototype stays reference-only. Production work must progress through small, verified slices so each phase leaves the repo cleaner, safer, and easier to continue.

## Current Project Status - June 4, 2026

Local implementation is currently at **Phase 4 gate verification**, with Phase 5/8 enrichment work now started in verified slices.

Verified locally:

- `npm test` passes across the focused production suite.
- `npm run build` passes.
- Production app is the default run mode; prototype mode is explicit opt-in.
- Supabase migrations define the core operating schema, Spotify catalog support, onboarding RPCs, Music uploads storage, and split confirmation repair/hardening.
- Spotify artist search, artist connection, and catalog bootstrap functions exist and are covered by tests.
- Chartmetric auth, artist resolution, artist enrichment, project enrichment, track enrichment, evidence normalization, setup enrichment job queueing, and setup worker dispatch exist and are covered by focused tests.
- Spotify setup now queues and dispatches Chartmetric setup enrichment after catalog import: artist profile, latest setup project/release, and up to five standalone songs outside that project.
- Music song overview no longer shows a duplicated source summary card; it shows one prose manager read assembled from saved Music state and available evidence.
- Chartmetric project and track enrichment now require exact release/track identity before normalizing evidence: project search results must match UPC or Spotify album ID, and track search results must match ISRC or Spotify track ID. Unmatched searches are recorded as unresolved instead of becoming misleading intelligence.
- Chartmetric artist enrichment now normalizes nested `cm_statistics` into manager-usable evidence for career context, country rank, listener cities, platform scale, playlist footprint, and public social signals.
- Settings now surfaces a first Artist Intelligence read from normalized artist-level Chartmetric evidence so users can inspect what was saved without opening the database.
- Production Music screens load Supabase-backed songs/projects, identifiers, assets, credits, splits, and split confirmation workflows.
- Basic user writes already exist for Music create/edit/upload/splits, but the full direct-write phase is not complete.

Still requiring live gate verification:

- Apply migrations from a fresh local or remote Supabase state.
- Confirm RLS isolation with real authenticated users, not only source-level/static tests.
- Deploy or verify deployed Edge Functions: `spotify-artist-search`, `connect-spotify-artist`, `spotify-catalog-bootstrap`, `chartmetric-resolve-artist`, `chartmetric-setup-enrichment`, `send-split-confirmations`, `load-split-confirmation`, and `confirm-split`. `chartmetric-artist-enrichment`, `chartmetric-project-enrichment`, and `chartmetric-track-enrichment` were redeployed to the linked Supabase project on June 4, 2026 after the Chartmetric trust-gate and normalization changes.
- Run a real Spotify artist connection using server-side credentials and verify source snapshots, normalized Music records, identifiers, operating events, and limitations in the database.
- Run one real Chartmetric setup flow and verify source snapshots/evidence for artist, project, and standalone songs. Use the saved payloads to decide which Chartmetric fields should become first-class UI/manager-read fields.
- Confirm no production screen falls back to Sable Day / Night Bus fixture content unless fixture mode is explicitly selected.

Project management rule: a phase can be marked **locally implemented** when tests/build pass, but it is only **gate closed** after the live verification checks above are complete.

## Phase 0: Cleanup And Production Boundary

Goal: make the repo safe to build production inside.

Status: **gate closed locally**.

- Freeze `src/prototype/AiLabelPrototype.tsx` as reference-only.
- Remove obsolete root replacement scripts that are not referenced by build or package scripts.
- Track production boundaries under `src/app`, `src/features`, `src/services`, `src/lib`, and `src/types`.
- Keep `src/main.tsx` on the prototype entry point until the production shell is ready. Completed, then superseded when production became the default run mode.
- Document the phase order and Spotify catalog bootstrap contract.

Gate: production folders exist, obsolete scripts are gone, prototype remains separate, and the focused production-boundary check passes.

## Phase 1: Supabase Core Schema

Goal: create the minimum real database foundation.

Status: **locally implemented; live fresh-state/RLS verification still required**.

- Add ownership, workspace, profile, source, evidence, Music, operating event, conversation, Manager run, mission, task, checkpoint, review, permission, memory, and usage tables needed by the first workflows.
- Add RLS from day one.
- Add documented state enums and constraints where they protect the initial workflows.

Gate: migrations apply locally, seed smoke checks pass, and cross-account reads/writes are blocked.

## Phase 2: Spotify Catalog Bootstrap

Goal: make Spotify connection immediately populate usable Music records.

Status: **locally implemented; live function deployment and real-credential verification still required**.

- Persist selected Spotify artist identity.
- Create a `spotify_catalog_bootstrap` source sync job.
- Store raw Spotify responses as source snapshots before normalization.
- Normalize starter tracks into `music_items`.
- Normalize latest album/project and tracklist into `music_projects` and `music_project_items`.
- Store Spotify IDs, URLs, URIs, ISRC, and UPC in `music_identifiers`.
- Create operating events and public-catalog source limitations.
- Queue Chartmetric setup enrichment after successful import without making Chartmetric queue failure block the Spotify setup result.

Gate: rerunnable bootstrap creates starter Music records without duplicates and without private analytics claims.

## Phase 3: Production App Shell

Goal: build a production shell separate from the prototype.

Status: **gate closed locally**.

- Add production layout, auth/session provider, active workspace loader, and route/view structure.
- Include Connect Artist, Setup Context, Label HQ, Music, Staff, Missions, and Settings.
- Keep the production Supabase client boundary out of the prototype.

Gate: production shell renders with mocked session/workspace and handles missing auth/workspace states.

## Phase 4: Music Workspace From Supabase

Goal: deliver the first real product surface from production data.

Status: **mostly implemented; next gate to close**.

- Implement Music library projections.
- Render Songs and Projects.
- Render song and project details from Music tables.
- Show Spotify source badges, identifiers, links, and public-catalog limitations.
- Support manual song/project creation, lifecycle updates, metadata, credits, identifiers, upload intents, storage-backed assets, split contributors, and split confirmation links.

Gate: seeded or imported Music records render without importing prototype arrays.

Next gate work:

- Verify against fresh Supabase state with imported catalog records.
- Add/confirm a no-fixture smoke path for Music screens.
- Document any remaining Music readiness lines that are still presentational instead of source-backed.

## Phase 5: Label HQ Read Projection

Goal: make the daily operating room real with honest limits.

Status: **started, not complete**.

- Assemble artist profile, active focus, source readiness, imported Music summary, operating events, staff readiness, and active missions.
- Show a limited first brief when evidence is thin.
- Do not invent metrics or claim private analytics.
- Add source-backed song/project summaries from Spotify public catalog, Chartmetric enrichment where available, uploaded/private analytics where available, and explicit limitations where unavailable.
- Keep Music overview as a prose manager read, not a duplicated details/evidence dump.

Gate: Label HQ renders from source records and every state-bearing line has provenance or limitation.

## Phase 6: Direct User Writes

Goal: make basic product state safely editable before AI automation.

Status: **partially started through Music writes only**.

- Save profile/context/social handles.
- Save Manager context answers.
- Create conversation messages.
- Approve or reject permission requests.
- Approve tasks and mark tasks done with notes.
- Allow safe basic Music edits.
- Write operating events for meaningful changes.

Gate: write APIs enforce ownership and valid state transitions.

## Phase 7: Manager Workflow Skeleton

Goal: add deterministic Manager orchestration before AI complexity.

- Create Manager synthesis runs and run actions.
- Persist decision packages.
- Create or update missions, tasks, checkpoints, memory entries, reviews, and permission requests.
- Add AI later behind typed action plans.

Gate: Manager-created artifacts always link to run/action provenance.

## Phase 8: Evidence And Social Enrichment

Goal: broaden inputs after the core spine works.

- Add Chartmetric as the first paid enrichment provider now that credentials are available.
- Use Chartmetric to enrich the artist profile, setup project/release, and up to five standalone songs in background setup jobs.
- Use any Chartmetric-provided streams or platform metrics when the evidence row is clearly sourced to Chartmetric with metric name and time window; do not attribute those metrics to Spotify Web API.
- Use Chartmetric to enrich artist, track, playlist/chart, social, and platform movement evidence where coverage exists.
- Add OpenAI-backed generated summaries only after source snapshots and evidence items exist; summaries must cite source classes and limitations.
- Add YouTube public data.
- Add manual uploads and evidence extraction.
- Add TikTok, Instagram, and X handle source candidates.
- Keep Soundcharts as a future alternative, not the current default.

Gate: raw snapshots precede evidence, source confidence rules hold, and social attention cannot become conversion proof.

## Phase 9: Production Verification And Hardening

Goal: prove the production system is safe enough to keep scaling.

- Keep permanent tests for schema/RLS isolation, Spotify bootstrap, projections, direct writes, state transitions, unsupported claim guards, and Manager provenance.
- Use ignored scratch scripts only for temporary inspection.
- Do not use prototype tests as the production acceptance gate.

Gate: production checks pass from fresh local state.
