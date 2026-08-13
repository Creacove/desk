# Video One CTO Recovery Design

## Objective

Make the existing Video One Release Success implementation safe and complete enough that the CTO can truthfully recommend a production release. The acceptance phrase is: “I want to release this song in 14 days.” The resulting Manager conversation must assess the attached song, create or reuse its canonical release mission, prepare an exact schedule preview, obtain explicit approval, apply only release-bound deadline changes, preserve an authoritative receipt across refresh, prepare source-backed playlist/press opportunities and canonical Files documents, and surface correlated failures through the existing telemetry system.

## Chosen approach

Use a surgical recovery of Luna’s existing architecture. Do not create a second release, mission, document, contact, approval, or error system. A rewrite was rejected because the existing foundation already has broad test coverage and matches the approved product direction. Disabling incomplete capabilities was rejected because it would leave Video One unable to demonstrate the promised workflow.

## Contract corrections

1. The proposal response uses one canonical field shape from SQL through Edge, Manager stream, persisted output, frontend service, and UI: `requestId`, `previewHash`, and the proposal idempotency key needed by approval.
2. Approval reuses the proposal’s immutable idempotency key. Retries of the same approval return the persisted receipt; a mismatched request remains a conflict.
3. Schedule bindings are synchronized on task insert and update. Removing a schedule key, changing mission, changing to an unsupported key, or archiving/rejecting/superseding a task deactivates the old binding. A changed valid key updates the existing binding’s plan and offset.
4. Applied approval state is hydrated from durable `release_date_change_requests.result_json`, not React state. Refresh must display the applied receipt and must never restore an obsolete approval button.

## Opportunity and document integrity

1. A public contact is actionable only when server-side source inspection confirms the exact normalized email or submission/contact URL is present in the cited public page. Unreachable, mismatched, private, or fabricated contacts remain non-actionable with an explicit limitation.
2. Spotify editorial remains a separate no-contact/manual submission target.
3. Creating a target pitch links the canonical document back to the exact opportunity using `pitch_document_id`.
4. Canonical document creation uses one database transaction/RPC for document, version, links, and event creation. Mission selection comes from the song’s release plan, not an arbitrary linked mission.

## Authority and observability

1. Release mutation tools are supplied only when a valid unreleased `music_item` is attached and the turn’s intent requires release work. Read-only generic Manager tools remain available globally.
2. Existing app-error telemetry records real boundary failures for source inspection, document persistence, schedule preview/recalculation, approval, realtime refresh, and receipt rendering. Error records preserve request/trace/song/mission identifiers and scrub sensitive values.
3. User-visible encoding artifacts are replaced with valid Unicode or plain text.
4. New and modified Edge functions must pass Deno type checking.

## Verification gates

Each defect receives a failing regression test before implementation. No phase advances while its focused tests fail. Final readiness requires:

- all release-focused tests pass;
- Deno checks pass for every touched Edge entry point;
- the complete Vitest suite passes without adding skips;
- the Vite production build passes;
- migration/RLS/RPC checks pass against production-like Supabase;
- the real 14-day proposal → approval → refresh workflow passes;
- playlist, press, document, share-link, and telemetry acceptance passes;
- a functional preview URL uses a backend containing the required migrations/functions;
- independent CTO review reports no critical or important findings.

## Non-goals

No email sending, playlist submission, paid-placement guarantees, audio QA, sample-clearance automation, second mission system, unrelated Hub redesign, merge to `main`, or production deployment is part of this recovery loop.
