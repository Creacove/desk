---
title: Manager Working File setup presentation
date: 2026-08-23
status: proposed-for-review
---

# Manager Working File setup presentation

## Context

The current setup presentation is visually clean but behaves like a static loading dashboard. Its large headline, thinking orb, and `What Desk knows` panel show aggregate state without making the Manager's work feel active. Setup can take 90 seconds or longer, so this surface should make the wait feel productive and impressive without becoming part of the setup workflow itself.

The intended experience is a live Manager assembling a working file about the artist. Spotify identity and catalogue facts arrive first. Wider audience, platform, playlist, market, momentum, and public-context findings follow. During synthesis, the presentation truthfully shows the Manager preparing the first read. Findings that completed before the artist reached the screen replay in order; later findings join the same queue as they become visible.

Internal provider names, including Chartmetric, must never appear. The user sees what the Manager learned, not which vendor supplied it.

## Advisory lenses

Three independent codebase reviews informed this design:

- A backend reliability review used Martin Kleppmann's publicly documented systems lens: authoritative records, immutable observations, idempotency, bounded projections, and fault isolation.
- A product-motion review used Pasquale D'Silva's publicly documented transitional-interface lens: motion should explain state change through continuity, legibility, and spatial cause and effect.
- A React performance review used Matt Perry's publicly documented animation-engineering lens: interruptible presence, declarative state, compositor-friendly properties, reduced motion, and bounded runtime work.

These are reference lenses only. The named individuals did not participate in or endorse this design.

## Goal

Create a beautiful, motion-led setup presentation in which real persisted findings enter a strict FIFO queue, remain readable, and visibly land in a central Manager's working file. The presentation must remain read-only, disposable, and unable to delay, fail, retry, or mutate the real setup workflow.

## Non-negotiable product rules

1. `workspace_setup_runs` remains the sole setup authority.
2. `ProductionApp` remains the sole authority for entering Desk HQ.
3. The presentation performs no provider calls, AI calls, setup actions, inserts, updates, retries, or stage transitions.
4. Setup completion interrupts the visual queue immediately. The queue never drains before Desk entry.
5. Presentation failure fails open to the existing setup fallback and cannot change setup state.
6. Findings are real persisted facts. The presentation invents no percentages, steps, metrics, brief names, or completion estimates.
7. Vendor and tool names are structurally excluded from the public payload. Artist-facing platform names such as Spotify, TikTok, YouTube, Apple Music, Shazam, Instagram, and Deezer may be shown when the underlying metric explicitly identifies that platform.
8. The first presentation mount replays findings that completed while onboarding continued in the background. A hard refresh may replay the current bounded feed; no acknowledgement is written back to setup.

## Architecture

The dependency is one-way:

```text
workspace_setup_runs and persisted evidence
                |
                +------> authoritative workspace refresh ------> Desk HQ
                |
                +------> read-only presentation projection
                                      |
                                      +------> local FIFO queue
                                                      |
                                                      +------> motion layer
```

There is deliberately no path from the projection, queue, or motion layer back into setup.

### Setup authority

The existing setup sequence remains unchanged:

```text
catalog_bootstrap -> manager_discovery -> setup_brief -> music_reads
```

The setup brief finalizer remains authoritative for setup completion. Music reads may continue in the background after Desk entry. A terminal status observed by the presentation is only an invalidation hint: the parent refreshes the authoritative workspace, and the existing `isWorkspaceReadyForDesk` check decides whether to enter Desk.

The presentation never calls `setView("labelHQ")` based on its own feed.

### Read-only projection

Add a single `STABLE`, security-invoker SQL function:

```sql
get_setup_presentation_feed_v2(p_setup_run_id uuid) returns jsonb
```

The function executes as one read-only statement snapshot, respects the caller's existing RLS permissions, accepts no service credentials, invokes no worker, and performs no write. It replaces the presentation's current multi-round client join with one consistent, bounded projection.

Realtime remains an optional accelerator only. Relevant setup-scoped `operating_events` may trigger an immediate projection refetch, but the event payload is never trusted as the finding itself. Visible-tab polling every three seconds remains the completeness fallback. Realtime failure therefore changes freshness, not correctness or setup progress.

The exact setup run ID must be passed into the projection. Selecting an unspecified latest run is not safe across retries or multiple checkout histories.

## Public feed contract

```ts
export type SetupPresentationFeed = {
  version: 2;
  observedAt: string;
  setup: {
    runId: string;
    artistWorkspaceId: string;
    status: "queued" | "running" | "completed" | "failed";
    phase: "catalogue" | "discovery" | "synthesis" | "ready";
    startedAt?: string;
    phaseStartedAt?: string;
    updatedAt: string;
  };
  artist?: {
    name: string;
    imageUrl?: string;
    genres: string[];
  };
  findings: SetupPresentationFinding[];
  projection: {
    bounded: true;
    maxFindings: 32;
    omittedMalformed: number;
  };
};

export type SetupPresentationFinding = {
  id: string;
  dedupeKey: string;
  revision: string;
  persistedAt: string;
  phase: "catalogue" | "discovery" | "synthesis";
  kind:
    | "identity"
    | "catalogue"
    | "audience"
    | "playlist"
    | "market"
    | "momentum"
    | "music"
    | "public_context"
    | "manager_read";
  destination: "catalogue" | "audience" | "markets" | "momentum" | "manager_read";
  platform?:
    | "spotify"
    | "apple_music"
    | "tiktok"
    | "instagram"
    | "youtube"
    | "shazam"
    | "deezer";
  title: string;
  value?: string;
  detail?: string;
  artwork?: {
    url: string;
    alt: string;
  };
};
```

`id` is derived from a persisted source ID, not generated in the browser. `dedupeKey` describes semantic identity, such as `audience:spotify-monthly-listeners`. `revision` permits a newer persisted form of the same finding to update its existing queue position without creating a duplicate. `persistedAt` is the source timestamp and is never `Date.now()` from the browser.

The feed is bounded to 32 findings. This is large enough to create the desired abundant catch-up sequence while keeping the database response, validation work, and client registry small. The projection uses fixed per-kind quotas so one noisy metric family cannot crowd out catalogue, market, momentum, or Manager findings.

### Eligible persisted facts

The projection may expose only facts that have crossed an existing persistence boundary:

- Artist identity from the authorized workspace.
- Catalogue counts and covers after the persisted Spotify catalogue completion event.
- Discovery evidence joined from `evidence_items` through `applied` actions in the exact setup-scoped discovery run.
- Markets only from a completed discovery result.
- Focus music and project identity from persisted catalogue records.
- The first Manager read only from the completed setup brief run and finalized `setup_first_manager_read` output.

Display-safe metric families include Spotify monthly listeners, followers, playlist reach and counts; Instagram followers; TikTok followers, likes, posts, creates, and top-video views; YouTube subscribers and views; Apple Music playlist and play activity; Shazams; Deezer fans; listener cities and markets; career stage and trend; and persisted track momentum. Unknown metrics are skipped rather than humanized automatically.

Low-confidence public-social metrics may still be shown as public signals, but the UI must not add a verification checkmark or stronger certainty than the stored evidence supports.

### Data that must never cross the contract

The projection does not serialize:

- Vendor names, including Chartmetric.
- `source`, `source_kind`, provider IDs, tool names, or action names.
- Raw references, provenance URLs, request payloads, or internal identifiers.
- Unsupported metrics, malformed evidence, pending actions, failed actions, or unfinalized outputs.
- Guessed values, empty zeros, or narrative claims reconstructed from titles alone.

Public domains may be shown only for genuine public-context findings and only as sanitized hostnames. They are not used for platform metrics.

## Ordering and FIFO semantics

No new writer-side outbox is added because that would couple presentation concerns to setup execution. Therefore strict FIFO means first-observed semantic order, not a mathematically global transaction order across unrelated tables.

The projection sorts its current bounded set by:

```text
persistedAt ASC, phase rank ASC, kind rank ASC, id ASC
```

The client applies these rules:

1. The initial feed is sorted and enqueued from oldest to newest.
2. Later feeds append unseen findings in response order.
3. Existing active and pending entries never move.
4. The same `dedupeKey` and revision is ignored.
5. A newer revision updates the existing active or pending entry in place.
6. An older revision is ignored.
7. Conflicting reuse of a stable ID is rejected and reported; first-seen valid content wins.
8. Malformed findings are skipped independently without discarding valid siblings.
9. A changed setup run ID resets the presentation queue.

This provides deterministic catch-up without adding any presentation event to setup writers.

## Queue state machine

The queue is a pure reducer with no React, browser, telemetry, or timer dependency. A hook owns one timer and translates lifecycle events into reducer actions.

```ts
type SetupFindingQueueState = {
  sourceKey: string;
  phase: "idle" | "holding" | "landing" | "paused" | "stopped";
  active: SetupPresentationFinding | null;
  pending: SetupPresentationFinding[];
  settled: SetupPresentationFinding[];
  known: Record<string, { revision: string }>;
  activeSinceMs: number | null;
  generation: number;
};
```

Queue behavior:

- `idle + ingest`: promote the first valid finding and queue the remainder.
- `holding + no pending`: keep the active finding indefinitely and schedule no timer.
- `holding + pending`: after a 600ms minimum dwell, enter `landing`.
- `landing + animation complete`: move the active finding into settled state, promote the next FIFO item, and begin its dwell.
- `landing + new ingest`: append or merge without replacing the landing item.
- `hidden`: pause the queue on its current visual and cancel its timer.
- `visible`: perform one immediate consistency fetch, then resume one item at normal speed.
- `stop`: synchronously clear the timer, active item, pending items, and animation handles. Later events are ignored.

The fixed 600ms dwell is deterministic, falls inside the agreed 400–700ms range, and avoids introducing decorative randomness. Rich text is capped so it remains readable within that rhythm. A lone finding stays visible until a successor exists, even if its 600ms dwell elapsed long ago.

Setup completion always dispatches `stop` before the presentation unmounts. It does not wait for `transitionend`, timeout fallback, or the pending queue.

## Visual direction

### Central composition

Replace the current large headline plus right-hand knowledge panel with one central Manager's working file. The file is the visual protagonist within the first second.

On desktop, use a restrained `3 / 6 / 3` editorial grid:

- A compact left rail contains `DESK SETUP`, `Getting to know {artist}`, the current truthful phase, progress-saved language, and the existing long-running reassurance.
- The central column contains the working file, approximately 540–600px wide.
- The active finding sits above and slightly overlaps the file's top edge. Its vertical relationship makes the landing destination obvious.
- The right column remains mostly open. It must not become another static information panel.

On mobile, use one vertical flow: compact header, phase line, active finding, then working file. The active finding overlaps the file by 12–16px. The page may scroll; the file does not create a nested scroll region.

### Working file

The file is a contemporary artist-management dossier, not a manila folder, detective board, basket, sci-fi core, or generic card.

- Main sheet: warm white, 1px neutral border, 14–16px radius.
- Two offset sheets behind it, displaced 5–8px to show accumulation.
- File shadow: `0 18px 60px rgba(17, 19, 24, 0.08)`.
- Top tab: `{ARTIST NAME} / MANAGER FILE`.
- Header: 44–52px rounded-rectangle artist portrait, artist name, up to two genres, and `Building first read`.
- Indexed sections: `01 Catalogue`, `02 Audience`, `03 Markets`, `04 Momentum`, and `05 Manager read`.
- Only sections with real data become populated.
- A restrained purple rule identifies the destination currently receiving a finding.

At most seven settled rows remain expanded. Older settled findings collapse into a quiet count such as `9 earlier findings filed`. Every finding was still presented individually while active; collapsing old rows bounds the long-running DOM without hiding the fact that the Manager collected them.

### Active finding

The active finding is the most elevated object:

- Width: 320–380px on desktop; available width minus 32px on mobile.
- Padding: 16–20px.
- Shadow: `0 14px 36px rgba(17, 19, 24, 0.11)`.
- Header: small platform glyph or semantic icon, an artist-facing source label such as `Spotify catalogue`, and `Found now`.
- Main label: 11px metadata.
- Value or title: 24–30px desktop and 21–24px mobile.
- Detail: 13–14px, maximum two lines during burst playback.
- Optional artwork: 48–64px square with fixed dimensions and 8–10px radius.
- Footer: destination language such as `For Audience` or `For Momentum`.

Platform color does not control the interface. Spotify green, TikTok cyan, and similar colors are not structural. Platform identity is conveyed through neutral words and small glyphs. Purple remains the Desk accent.

### Settled findings

When filed, a finding becomes a quiet 40–56px document row in its destination section. Artwork reduces to 32–36px. The essential label and value remain. Rows use document dividers rather than individual card borders or shadows.

A checkmark means `filed`, not `verified by a provider`.

### Typography and surface treatment

- Keep Manrope and the existing light Desk theme.
- Desktop phase headline: 40–52px, weight 600, line-height approximately 1.02.
- Mobile phase headline: 28–34px.
- File section headings: 10–11px, uppercase, weight 700, tracking `0.10em`.
- Body and finding detail: 14px/21px.
- Metadata: 11–12px/16px.
- Use the existing foreground, muted foreground, background, and purple accent tokens.
- Remove the ambient grid from this surface; the file provides sufficient structure.
- Use no gradients, shimmer, blur, sparkles, generated decoration, or oversized generic AI orb.

Artwork reserves its final dimensions, uses `object-fit: cover` and `decoding="async"`, and falls back once to a monogram or music-document glyph. Broken artwork never blocks queue advancement or retries indefinitely.

## Motion contract

Motion explains one causal story:

```text
finding arrives -> finding remains readable -> finding lands in its file section -> next finding arrives
```

### Initial mount

- The file enters once with opacity and a 10px upward resolve over 300–320ms.
- Existing findings from background setup form the initial FIFO catch-up batch.
- The first finding becomes active immediately after the file is available.
- No decorative loading sequence runs before real data exists.

### Finding enter and hold

- Enter: opacity `0 -> 1` and `translate3d(0, 8px, 0) -> translate3d(0, 0, 0)` over 200–220ms.
- Hold: fully static and readable.
- If no next finding exists, the active card remains indefinitely. It does not pulse, restart, cycle copy, or disappear.
- A quiet line reads `Waiting for the next confirmed finding` when the queue is empty behind the active card.

### Landing

- Once a successor exists and the 600ms dwell is satisfied, the active card moves downward toward the file using only transform and opacity over 260–300ms.
- Scale changes at most from `1` to `0.97`.
- The destination rule receives one finite purple emphasis.
- The settled row resolves as the active card reaches the file.
- Only after landing completes does the next item enter.
- A short timeout fallback completes presence if `transitionend` is lost.

The geometry is fixed by the composition; implementation should not perform repeated layout measurement or general-purpose physics.

### Phase changes

Phase changes do not clear the file. The active section tab moves to the next real section in 220–260ms, and the phase copy crossfades in place. The sequence is:

```text
Catalogue -> Audience and markets -> Momentum and context -> Manager read
```

During synthesis, show `Preparing your first Manager read`. A named Manager document appears only if that actual name exists in finalized output. No sample brief title is fabricated.

### Completion

Authoritative completion cancels all queue timers, presence fallbacks, and in-flight presentation reads. The existing progressive Desk transition runs immediately. There is no success ceremony, countdown, final dwell, or `Enter Desk` button.

## Performance contract

No animation dependency is added. CSS transitions and a small React state machine are sufficient.

- Render one active finding and at most one retained landing node.
- Pending findings remain data, not DOM.
- Keep the entire presentation under approximately 100 DOM elements.
- Keep the known-finding registry bounded to 128 entries for the current setup run.
- Animate only `transform` and `opacity`; finite border/color emphasis is allowed.
- Do not animate blur, shadow, dimensions, grid placement, background position, or filters.
- Remove the current presentation blur entrances.
- Remove or pause the canvas thinking orb; it must not run a permanent `requestAnimationFrame` loop on this surface.
- Replace the infinite live pulse with finite emphasis triggered by a real finding.
- Use no interval and no timer when the queue is empty or contains only its pinned active finding.
- Queue ingestion should remain below 4ms at the defensive registry bound.
- Presentation render work should remain below 8ms of a 16.7ms frame and produce no presentation long task above 50ms.
- Hidden tabs pause dwell and presence work. Visibility restoration triggers one consistency fetch.

## Failure isolation

### Projection and transport failure

- Retain the last valid active and settled findings during transient projection failures.
- Change file status to `Updates paused` only after a real read failure.
- Retry with bounded backoff; realtime failure falls back to polling.
- After the existing bounded failure threshold, use the legacy setup presentation.
- No presentation retry invokes setup or provider work.

### Malformed finding

- Validate the feed envelope strictly.
- Validate findings independently.
- Skip one malformed finding and continue the queue.
- Invalid authority fields or an unknown feed version degrade the whole presentation to the legacy setup UI.
- Strings, arrays, and artwork URLs are length- and scheme-bounded. Artwork must be HTTPS.

### Render failure

Keep `SetupPresentationErrorBoundary` around the presentation controller. Its fallback remains powered by setup's existing state and retry behavior. Telemetry is fire-and-forget and may not throw into setup.

### Genuine setup failure

A failed authoritative setup run interrupts presentation and exposes the existing setup recovery UI. The dossier may state that collected work is saved, but only the real setup retry control may restart work.

## Accessibility

- Automatic updates never move focus.
- The visual active card is not announced every 600ms during a burst.
- Use one throttled, atomic, polite live region for the latest meaningful finding and collected count.
- Settled history is a semantic ordered list but does not repeatedly announce.
- Do not rely on motion, color, or checkmarks alone.
- Meaningful metadata meets 4.5:1 contrast.
- At 200% text zoom, findings wrap without clipping and the file remains readable.
- Under `prefers-reduced-motion`, remove translation, scale, pulse, and travel. Preserve FIFO and 600ms reading dwell, then use an instantaneous or 80–120ms opacity replacement. Completion remains immediate.

## Long-running and sparse states

Preserve the existing truthful timing thresholds:

- Before 45 seconds: remain quiet while work is active.
- At 45 seconds: reassure using phase-specific language.
- At 90 seconds: state that work is saved and the user may leave and return.

A 90-second session has no continuous decorative loop. The active finding remains still while waiting, older filed rows collapse into counts, and the file preserves visible accumulation.

If only artist identity exists, show the file header and `Waiting for the first catalogue finding`. Do not render empty rows, zeros, guessed genres, or placeholder metrics.

## Component boundaries

Create focused modules:

- `src/features/onboarding/setup-presentation/setupPresentationQueue.ts`: pure queue reducer, validation handoff, merge rules, selectors, and constants.
- `src/features/onboarding/setup-presentation/useSetupPresentationQueue.ts`: one dwell timer, presence completion, visibility behavior, reduced motion, source reset, and synchronous stop.
- `src/features/onboarding/setup-presentation/ManagerWorkingFile.tsx`: central file, active finding, bounded settled rows, and semantic history.
- `src/features/onboarding/setup-presentation/setupPresentationMotion.css`: feature-scoped transform/opacity motion and reduced-motion rules.

Modify existing responsibilities without merging them:

- `src/types/setupPresentation.ts`: public feed and finding types.
- `src/services/setupPresentation.ts`: invoke and validate the read-only projection; no animation or queue state.
- `src/services/setupPresentationProjection.ts`: retain only compatibility mapping needed during migration, then remove redundant client joins after the RPC rollout is proven.
- `src/features/onboarding/setup-presentation/useSetupPresentation.ts`: polling, realtime invalidation, aborts, freshness, and degraded state only.
- `src/features/onboarding/setup-presentation/SetupPresentationV2.tsx`: page composition only.
- `src/features/onboarding/SetupActivityScreen.tsx`: wire loader, queue, presentation, legacy fallback, and existing error boundary.

`ProductionApp.tsx` and `setupPresentationTransition.ts` retain their current authority and should require no change beyond passing the exact setup run identity or responding to an existing workspace invalidation.

## Testing strategy

### Database projection

- The RPC is `STABLE`, security-invoker, authenticated, RLS-isolated, read-only, and bounded to 32 findings.
- Foreign-workspace rows, pending and failed actions, unfinalized outputs, malformed evidence, and unsupported metrics are excluded.
- Catalogue, discovery, and Manager findings obey their persisted eligibility gates.
- IDs, revisions, and ordering are deterministic.
- No serialized response contains vendor, tool, raw provenance, or provider fields, and no response contains `Chartmetric`.

### Projection and validation

- Display-safe metrics map to approved labels and platform names.
- Unknown metrics are skipped.
- Malformed findings do not reject valid siblings.
- Stale or regressive snapshots cannot remove accepted findings.
- The exact setup run scopes every finding.

### Queue reducer and hook

- Initial hydration is strict FIFO.
- A lone finding remains indefinitely.
- A backlog advances only after 600ms.
- A newly appended finding releases a previously pinned item once its dwell is satisfied.
- Duplicate revisions do not replay; newer revisions update in place.
- Stale timers and generations are ignored.
- Hidden tabs pause and resume without draining.
- `stop` is terminal and synchronously clears timers and retained queue data.
- React Strict Mode remounts leave no duplicate timer.

### Integration and release safety

- Setup completion interrupts an active landing and triggers one authoritative workspace refresh.
- Presentation completion cannot directly authorize Desk entry.
- Realtime loss converges through three-second polling.
- Projection, queue, artwork, and render failures cannot mutate, retry, or stop setup.
- Genuine setup failure preserves the existing recovery UI.
- Existing setup presentation and final integration tests remain green.
- The implementation contains no new Edge Function, provider call, AI call, permanent RAF loop, infinite presentation pulse, filter animation, or staged progress wizard.

### Visual verification

Capture at 1440x900, 1280x800, 1024x768, 390x844, 375x667, and 320x568. Also check 200% text zoom and reduced motion.

At desktop and mobile, verify:

1. Prelude before the first finding.
2. First Spotify catalogue finding active.
3. Lone finding pinned with an empty queue.
4. Six-finding catch-up burst.
5. Audience and market phase.
6. Manager-read synthesis.
7. 90-second long-running state.
8. Sparse artist-only state.
9. Broken artist and release artwork.
10. Recoverable projection failure.
11. Genuine setup failure.
12. An interrupted landing followed by immediate Desk entry.

## Acceptance criteria

- The Manager's working file is the visual protagonist, not an orb, headline, or side panel.
- Every displayed finding is backed by persisted, setup-scoped data.
- Background-completed findings replay one by one on first presentation mount.
- New findings append in first-observed FIFO order.
- A lone finding remains visible until another exists.
- Backlogged findings receive a 600ms minimum dwell and land one at a time.
- Provider and tool names never appear.
- The working file stays visually and technically bounded for 90 seconds or longer.
- Motion uses only transform and opacity and remains clear under reduced motion.
- Presentation errors fail open without affecting setup.
- Authoritative setup completion cancels presentation immediately and enters Desk without waiting for the queue.
- No presentation behavior changes setup stage execution, retry behavior, completion semantics, or post-setup music-read work.
