# Manager Working File setup presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static setup loading dashboard with a truthful, read-only Manager Working File that replays persisted findings through a strict FIFO queue, keeps a lone finding pinned, and exits immediately when the authoritative setup workflow is ready for Desk.

**Architecture:** Keep `workspace_setup_runs` and `ProductionApp` as the only setup and Desk authorities. Add one bounded, security-invoker read-only Supabase projection keyed by the exact setup run ID. Validate that feed into display-safe findings, then pass it through a pure queue reducer and one lifecycle hook. Render one active finding over a central dossier with bounded settled history. Presentation reads, retries, timers, artwork, and animation are disposable and cannot invoke setup or provider work.

**Tech Stack:** React 18, TypeScript, Vite, Supabase/Postgres SQL migrations, Vitest + Testing Library + jsdom, CSS transitions using `transform` and `opacity` only. No new animation dependency.

---

## Baseline and working rules

- [ ] Work only in `C:\Users\USER\Desktop\ai-record-label-prototype\.worktrees\manager-working-file-setup` on branch `codex/manager-working-file-setup`.
- [ ] Preserve unrelated changes on the original checkout; do not edit or reset them.
- [ ] Use the approved design spec at `docs/superpowers/specs/2026-08-23-manager-working-file-setup-presentation-design.md` as the contract.
- [ ] Baseline is recorded: `npm test` completed with 165/166 files passing, 1,294 passing tests, 5 skipped, and 5 existing failures in `src/production-app-shell.test.tsx`. Do not attribute those failures to this feature; rerun the focused setup tests and build after each implementation task.
- [ ] Use test-first development for every production module: add a focused failing test, implement the smallest change, then run the focused test before committing.
- [ ] Each task below has a disjoint primary write set. After each implementation task, run a spec-compliance review and a code-quality review before continuing.

## Task 1: Define and validate the public feed and finding projection

**Files:**

- Add `src/services/setupPresentationFindings.ts`.
- Add `src/services/setupPresentationFindings.test.ts`.
- Modify `src/types/setupPresentation.ts`.
- Modify `src/services/setupPresentationProjection.ts` only where compatibility types are required by the new normalizer.

**Implementation:**

- [ ] Add the version-2 `SetupPresentationFeed` and `SetupPresentationFinding` types from the design spec, including the exact setup run ID, phase, destination, stable `id`, `dedupeKey`, `revision`, `persistedAt`, optional approved platform, bounded artwork, and projection metadata.
- [ ] Implement strict envelope validation that rejects unknown versions, missing/invalid authoritative setup fields, wrong run IDs, unsafe strings, non-HTTPS artwork, and malformed arrays at the envelope level.
- [ ] Implement independent finding validation so malformed siblings are skipped while valid findings survive. Bound title/value/detail/alt lengths and keep the finding list at 32.
- [ ] Map only approved metric families to user-facing labels and platform names. Unknown metrics, provider/tool/source fields, raw references, failed/pending actions, and unfinalized output must never reach the public finding type.
- [ ] Sanitize genuine public-context hostnames only; never expose provider names or internal identifiers.
- [ ] Export deterministic initial ordering (`persistedAt`, phase rank, kind rank, `id`) and helpers for stable dedupe/revision comparison.

**Tests first:**

- [ ] Cover valid feed parsing, approved platform labels, unknown metric omission, malformed sibling skipping, unsafe artwork rejection, deterministic ordering, no vendor/provider/raw fields, and exact setup-run scoping.
- [ ] Run `npm test -- src/services/setupPresentationFindings.test.ts`.

## Task 2: Add the bounded read-only Supabase projection

**Files:**

- Add `supabase/migrations/20260823000100_setup_presentation_feed_v2.sql`.
- Add `supabase/tests/setup_presentation_feed_v2_smoke.sql`.
- Add `src/setup-presentation-feed-v2-schema.test.ts`.
- Modify `src/services/setupPresentation.ts`.
- Modify `src/services/setupPresentationProjection.ts` only to remove reliance on presentation-side multi-table joins after the new loader is wired.

**Implementation:**

- [ ] Inspect the existing definitions and RLS for `workspace_setup_runs`, `operating_events`, `evidence_items`, `manager_run_actions`, `manager_synthesis_runs`, `manager_outputs`, `music_items`, and `music_projects` before writing SQL.
- [ ] Create `public.get_setup_presentation_feed_v2(p_setup_run_id uuid) returns jsonb` as `stable`, `security invoker`, authenticated-only, and read-only. It must scope every source row to the exact setup run/workspace and execute as a bounded snapshot.
- [ ] Apply the persisted eligibility gates from the spec: catalogue completion events, applied discovery actions in the exact run, completed discovery outputs, and finalized first Manager read. Exclude pending/failed actions, malformed evidence, unsupported metrics, and unfinalized outputs.
- [ ] Produce at most 32 findings with deterministic IDs, dedupe keys, revisions, persisted timestamps, phase, destination, display-safe labels, and optional HTTPS artwork. Keep quotas per kind so one metric family cannot crowd out all other sections.
- [ ] Serialize only the public version-2 contract. Structurally omit source/source-kind/provider IDs/tool/action names/raw references/provenance and ensure no serialized response can contain the forbidden vendor name.
- [ ] Revoke default/public/anonymous execution and grant execute only to the authenticated role as appropriate for current migration conventions. Do not add a worker, trigger, write, or setup-state mutation.
- [ ] Update the Supabase loader to call the RPC with the exact setup run ID, validate the result through Task 1, and retain the existing loader interface/fallback behavior. Keep an explicit compatibility path until the RPC is unavailable.

**Tests first:**

- [ ] Add static SQL/schema assertions for `stable`, `security invoker`, authenticated grants, bounded limit, exact run parameter, no writes, and no provider payload fields.
- [ ] Add smoke SQL assertions for RLS isolation, foreign-workspace exclusion, pending/failed exclusion, malformed evidence exclusion, deterministic ordering, and the 32-finding bound.
- [ ] Run `npm test -- src/setup-presentation-feed-v2-schema.test.ts src/services/setupPresentationFindings.test.ts`.

## Task 3: Implement the pure FIFO queue reducer

**Files:**

- Add `src/features/onboarding/setup-presentation/setupPresentationQueue.ts`.
- Add `src/features/onboarding/setup-presentation/setupPresentationQueue.test.ts`.

**Implementation:**

- [ ] Define the reducer state exactly as `sourceKey`, `phase`, `active`, `pending`, bounded `settled`, bounded `known`, `activeSinceMs`, and `generation`.
- [ ] Implement `ingest`, `dwellElapsed`, `landingComplete`, `pause`, `resume`, and terminal `stop` actions without React, timers, browser APIs, telemetry, or side effects.
- [ ] Sort the initial feed oldest-first; append later unseen findings in response order; preserve active/pending positions; merge newer revisions in place; ignore duplicate/older revisions; reject conflicting stable IDs; reset on a changed run ID.
- [ ] Keep one active finding visible indefinitely when no successor exists. When a successor arrives after the minimum dwell, move only through landing completion to the next item.
- [ ] Bound the known registry to 128 and settled expanded rows to seven, preserving a quiet collapsed count for older findings.
- [ ] Ensure stop is terminal and synchronously clears active, pending, settled, known, and generation-sensitive work.

**Tests first:**

- [ ] Cover initial FIFO, catch-up, lone-item pinning, 600ms dwell, appended successor, revision merge, stale revision, conflict rejection, stale generation, hidden pause/resume, stop terminality, and bounds.
- [ ] Run `npm test -- src/features/onboarding/setup-presentation/setupPresentationQueue.test.ts`.

## Task 4: Add queue lifecycle and presentation loading isolation

**Files:**

- Add `src/features/onboarding/setup-presentation/useSetupPresentationQueue.ts`.
- Add `src/features/onboarding/setup-presentation/useSetupPresentationQueue.test.tsx`.
- Modify `src/features/onboarding/setup-presentation/useSetupPresentation.ts`.
- Modify `src/features/onboarding/SetupActivityScreen.tsx` only for exact setup-run identity, queue stop on authoritative completion, and legacy fallback wiring.

**Implementation:**

- [ ] Own one dwell timer and one bounded landing fallback timer; cancel both on hidden, stop, unmount, source reset, or completion. Never use a permanent interval or `requestAnimationFrame` loop.
- [ ] Pause dwell while `document.visibilityState` is hidden and perform one immediate consistency refresh on visibility restoration. Keep polling as the correctness fallback if realtime is absent or fails.
- [ ] Preserve the last valid feed during transient errors; surface `Updates paused` only after a real read failure; use the existing bounded failure threshold to enter the legacy presentation fallback.
- [ ] Make setup completion terminal for the presentation: dispatch stop, abort in-flight presentation work, and let the existing authoritative workspace refresh/Desk transition proceed without waiting for queue drain.
- [ ] Ensure no presentation callback calls a setup action, provider call, AI call, `setView`, or setup retry.
- [ ] Keep `SetupPresentationErrorBoundary` around the controller and preserve genuine setup failure recovery UI.

**Tests first:**

- [ ] Cover one timer, exact 600ms minimum dwell, lone active no timer, hidden pause/resume, Strict Mode cleanup, stale generation, retry/degraded behavior, last-valid retention, exact-run reset, and immediate completion stop.
- [ ] Run `npm test -- src/features/onboarding/setup-presentation/useSetupPresentationQueue.test.tsx src/features/onboarding/setup-presentation/useSetupPresentation.test.ts src/features/onboarding/SetupActivityScreen.test.tsx` (use the existing matching test paths if names differ).

## Task 5: Build the Manager Working File visual surface

**Files:**

- Add `src/features/onboarding/setup-presentation/ManagerWorkingFile.tsx`.
- Add `src/features/onboarding/setup-presentation/setupPresentationMotion.css`.
- Add `src/features/onboarding/setup-presentation/ManagerWorkingFile.test.tsx`.
- Modify `src/features/onboarding/setup-presentation/SetupPresentationV2.tsx` to be composition-only.
- Modify `src/index.css` only to remove setup-presentation use of blur entrances/infinite pulse if they are not isolated elsewhere.

**Implementation:**

- [ ] Make the central dossier the visual protagonist: warm white main sheet, two offset sheets, artist portrait/name/genres, `MANAGER FILE` tab, indexed sections, and a purple receiving rule.
- [ ] Render one active finding above/overlapping the file and at most seven expanded settled rows. Keep pending findings in state, not the DOM; collapse older settled findings into a count.
- [ ] Use only truthful copy from the feed and queue: no invented percentages, progress estimates, brief names, zero metrics, provider names, or staged wizard steps. Show `Waiting for the next confirmed finding` when appropriate and phase-specific long-running reassurance at the existing thresholds.
- [ ] Use neutral platform/semantic labels and existing Desk tokens. Use fixed artwork boxes with `object-fit: cover`, async decoding, HTTPS only, and a one-time monogram/music glyph fallback.
- [ ] Implement finite motion only: file resolve, finding enter, finding landing, destination emphasis, and phase copy crossfade. Animate only `transform`/`opacity`; no blur, shimmer, gradients, sparkles, infinite pulse, or orb canvas loop.
- [ ] Add mobile single-column layout and desktop 3/6/3 editorial layout. Keep the file out of a nested scroll container and make 200% text zoom readable.
- [ ] Add one polite throttled live region for the latest meaningful finding and collected count; automatic updates never move focus.
- [ ] Respect `prefers-reduced-motion`: remove translation/scale/travel and use instant or 80–120ms opacity replacement while preserving FIFO and dwell.

**Tests first:**

- [ ] Cover central file/active finding/settled semantics, provider-name absence, bounded DOM, artwork fallback, sparse state, phase copy, live region, reduced-motion classes, and no staged progress UI.
- [ ] Run `npm test -- src/features/onboarding/setup-presentation/ManagerWorkingFile.test.tsx src/setupPresentationReleaseSafety.test.ts`.

## Task 6: Integrate without changing Desk authority

**Files:**

- Modify `src/features/onboarding/SetupActivityScreen.tsx`.
- Modify `src/app/ProductionApp.tsx` only if an exact setup run ID must be threaded through existing props; do not change `isWorkspaceReadyForDesk`, `resolveWorkspaceInitialView`, setup finalizers, or Desk transition authority.
- Add or modify `src/setup-presentation-integration.test.tsx`.

**Implementation:**

- [ ] Pass the exact active `workspace_setup_runs.id` from the existing workspace/setup state into the presentation loader and queue `sourceKey`.
- [ ] Keep the existing authoritative workspace reload and `isWorkspaceReadyForDesk` gate as the only path into Desk HQ.
- [ ] Verify completion interrupts active landing immediately and does not wait for `transitionend`, timeout, queue drain, or a final success animation.
- [ ] Verify presentation failures fail open to the legacy setup UI and genuine setup failures retain the real retry path.
- [ ] Ensure post-setup music reads and other background work remain untouched.

**Tests first:**

- [ ] Add release-safety tests proving presentation cannot authorize Desk, cannot mutate setup, cannot add provider/AI calls, and cannot add an infinite animation or permanent RAF loop.
- [ ] Run `npm test -- src/setup-presentation-integration.test.tsx src/setupPresentationReleaseSafety.test.ts src/production-app-shell.test.tsx` and distinguish the five recorded baseline failures from any new failure.

## Task 7: Verify, inspect, and hand off

- [ ] Run `git diff --check` and `npm run build` in the worktree.
- [ ] Run all focused feature tests and the full `npm test` suite fresh. Record exact counts and any unchanged baseline failures; do not claim the suite is green if it is not.
- [ ] Run a local Vite preview or dev server and visually inspect at 1440x900, 1280x800, 1024x768, 390x844, 375x667, and 320x568. Check first finding, lone finding, six-finding burst, phase changes, sparse artist-only state, broken artwork, paused updates, genuine setup failure, reduced motion, and immediate Desk completion.
- [ ] Confirm the generated DOM remains bounded, there is no permanent animation loop, and the browser console has no React key/accessibility errors.
- [ ] Request final code review against the design spec and verification evidence.
- [ ] Commit the completed implementation to `codex/manager-working-file-setup` with a focused message. Do not merge, push, or discard the branch without the user choosing an option.

## Expected handoff

- [ ] Report the implementation commit, changed files, focused test/build results, unchanged baseline failures, and worktree path.
- [ ] Present the four branch options required by the finishing workflow: merge locally, push/create PR, keep the branch, or discard with explicit confirmation.
