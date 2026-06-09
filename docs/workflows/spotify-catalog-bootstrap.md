# Spotify Catalog Bootstrap Workflow

Purpose: define the first production integration after artist identity selection. When a user connects or confirms a Spotify artist, Ordersounds should save identity immediately, start a background catalog sync, create a starter operating catalog from public Spotify catalog metadata, and queue Chartmetric enrichment for manager intelligence without blocking the setup form.

## Trigger

The workflow starts when the user selects or confirms a canonical Spotify artist identity during setup. The UI calls `connect-spotify-artist`, which saves identity, creates a running `source_sync_jobs` row, and starts `spotify-catalog-bootstrap` in the background.

## Required Inputs

- authenticated user and account
- active artist workspace
- selected Spotify artist ID
- artist name and Spotify artist URL
- optional market code for catalog availability checks

## Background Steps

1. Save the selected Spotify artist identity to the artist profile and source connection.
2. Create a `source_sync_jobs` row with `job_type = spotify_catalog_bootstrap`.
3. Call Spotify server-side using configured credentials.
4. Store every fetched payload as a raw source snapshot before normalization.
5. Fetch public artist album/single catalog with Spotify's documented artist-albums limit.
6. Select the latest album or project-like release as the starter project when available.
7. Fetch the selected project's full tracklist.
8. Select up to five recent standalone singles from the artist album list where `album_type = single` and `total_tracks = 1`, excluding the selected project.
9. Fetch each selected standalone single through the album endpoint so track metadata and provenance are handled consistently.
10. Normalize the full latest project tracklist plus up to five standalone single tracks, deduping singles against project tracks by track identity.
11. Normalize records into Music tables.
12. Queue and dispatch Chartmetric setup enrichment for the artist profile, selected setup project/release, and up to five standalone songs outside that project.
13. Write operating events and source limitations.

## Writes

Minimum writes:

- `source_connections`: public Spotify catalog connection for the artist.
- `source_sync_jobs`: bootstrap job state.
- `source_snapshots`: raw source snapshot for artist, artist album list, selected project album, selected project tracks, selected standalone single albums, and selected standalone single tracks.
- `music_items`: songs or released tracks from Spotify metadata.
- `music_projects`: latest album, EP, mixtape, compilation, multi-track single, or release container when present.
- `music_project_items`: ordered tracklist membership for imported tracks inside the selected project only.
- `music_identifiers`: Spotify track/album IDs, Spotify URLs, Spotify URIs, ISRC, and UPC when available.
- `music_assets`: cover artwork as external metadata or asset reference when useful; do not treat it as a user-uploaded file.
- `evidence_items`: public catalog evidence only when a visible claim needs proof.
- `operating_events`: catalog import started/completed/failed and Music records created.
- Chartmetric setup writes: `source_connections` with target metadata and queued `source_sync_jobs` for `chartmetric_artist_enrichment`, `chartmetric_project_enrichment`, and `chartmetric_track_enrichment`, then dispatches the matching worker functions with `sourceSyncJobId`.
- `ai_run_usage_events`: provider call usage if the implementation tracks Spotify calls through the usage table.

## Music Normalization Rules

- Dedupe tracks by ISRC first, Spotify track ID second, and normalized title plus duration plus primary artist as a fallback.
- Dedupe projects by Spotify album ID first, UPC second, and normalized title plus release date as a fallback.
- Import every unique track in the selected latest project, not only a preview subset.
- Import up to five recent standalone singles outside the selected project.
- Do not create setup `music_projects` for one-track standalone singles; create `music_items` only.
- Store important Spotify identifiers in `music_identifiers`, not only in JSON metadata.
- Store flexible Spotify payload details in `music_items.metadata.spotify` or `music_projects.metadata.spotify`.
- Mark source kind as public catalog.
- Add a source limitation that public Spotify catalog does not prove private analytics, saves, source-of-stream, revenue, conversion, or campaign ROI.
- Do not call Chartmetric provider endpoints inside the Spotify importer. The importer calls the setup enrichment orchestrator after Spotify records exist; that orchestrator dispatches Chartmetric workers in the background.

## Spotify Metadata Fields

Useful track fields:

- Spotify track ID
- Spotify track URI
- Spotify track URL
- track name
- album ID and album name
- release date and precision
- duration
- explicit flag
- track number and disc number
- ISRC when available
- popularity only as public catalog metadata with low/limited confidence
- preview URL only when returned

Useful project fields:

- Spotify album ID
- Spotify album URI
- Spotify album URL
- album name
- album type
- release date and precision
- total tracks
- UPC when available
- cover artwork URLs with Spotify attribution/linkback

## Safety Rules

- No Spotify audio downloads.
- Do not rip, cache, or store full audio from Spotify.
- Store Spotify links and URIs for playback/navigation.
- `preview_url` is optional, nullable, deprecated, and policy-limited. It must never be required for core product behavior.
- Spotify metadata, cover art, and artist images require Spotify attribution and links back to Spotify where displayed.
- Public Spotify catalog data cannot support private analytics claims.
- If Spotify returns rate limits, unavailable market restrictions, null previews, or partial catalog data, preserve the snapshot and show source limitations instead of failing setup.

## User-Facing Result

After artist identity selection, the user should move directly to artist context while catalog import and enrichment queueing run in the background. Desk HQ should open after required artist context is saved and the catalog job is `completed` or `completed_with_limits`. The setup result should be explainable as: "We pulled the latest project and its full tracklist, plus up to five recent singles outside that project, then started Chartmetric enrichment around the artist, project, and standalone songs." The first Desk HQ read can reference the imported public catalog as context, and later reads can use Chartmetric evidence once enrichment jobs produce snapshots/evidence. Spotify Web API limitations remain visible for private analytics.

## Failure Handling

- If artist identity is ambiguous, do not run bootstrap until the user confirms one artist.
- If Spotify calls fail, mark the sync job failed and keep setup usable.
- If Chartmetric setup queueing or worker dispatch fails after Spotify import, log the failure and keep the Spotify setup result usable.
- If normalization partially succeeds, keep created records and write a limitation event.
- If rerun detects existing tracks/projects, update identifiers/source freshness instead of creating duplicates.

## Acceptance Checks

- Raw source snapshot exists before normalized Music records.
- Bootstrap creates `music_items` for every track in the selected project plus up to five recent standalone singles.
- Bootstrap creates a `music_projects` record and `music_project_items` for the latest album/project when available.
- Bootstrap does not create `music_project_items` for standalone singles outside the selected project.
- Bootstrap queues and dispatches Chartmetric setup enrichment after catalog import: one artist job, one project job when a setup project exists, and standalone song jobs for up to five songs outside the setup project.
- Rerunning bootstrap does not duplicate tracks or projects.
- Every imported Spotify field has public catalog source provenance.
- No private Spotify analytics, revenue, conversion, or source-of-stream claim is generated from this workflow.
