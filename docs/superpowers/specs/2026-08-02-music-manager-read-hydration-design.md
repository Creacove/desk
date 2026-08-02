# Music Manager Read Hydration Design

## Goal

Opening a song or project must show its last usable Manager Read immediately, including during refresh, without loading every Manager document in the catalog list.

## Root cause

The catalog list intentionally fetches only Manager Read metadata. It can therefore label a subject `fresh`, `stale`, `refreshing`, or `refresh_failed` without a read body. `MusicWorkspace` only hydrates a selected object when its status is `unknown`, so a subject with known existing-read status opens in the empty state. In addition, pre-v2 Manager output is marked `stale` but its saved text is not rendered.

## Design

Keep list queries metadata-only. When a room opens and the selected subject has no `managerRead` but its status indicates an existing or recoverable read (`fresh`, `stale`, `refreshing`, or `refresh_failed`), make one focused `loadMusicObject` request and store the result in the existing focused-object overlay. The guard key includes subject identity and Manager Read revision, preventing repeated requests until server state changes.

The focused object mapper will parse v2 output as it does today and provide a conservative compatibility projection for legacy output containing `render_json.managerRead`. The projection presents the original text as a prior Manager Read without inventing metrics or evidence. A refresh can then replace that compatibility projection with the canonical v2 read.

## Boundaries

- No polling and no catalog-wide `render_json` query.
- No schema migration or rewriting stored documents.
- No automatic Manager generation while opening a room.
- Existing running-read fallback remains responsible only for run completion.

## Verification

- A fresh list item with no body hydrates once when opened and displays the returned read.
- Legacy/stale output hydrates and displays its saved text.
- A prior read remains visible during refresh/failure.
- List data remains metadata-only.
