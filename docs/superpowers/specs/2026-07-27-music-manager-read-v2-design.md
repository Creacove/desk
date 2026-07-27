# Music Manager Read v2 Design

## Objective

Replace the legacy song/project Ask Manager workflow with one durable, backend-owned Manager Read that:

- refreshes Chartmetric evidence before reasoning when the saved evidence is missing or stale;
- uses the same Manager Intelligence foundation, model route, and reasoning standard as Manager Conversation;
- survives browser refreshes, tab closes, mobile suspension, and duplicate clicks;
- stores one current, evidence-grounded `music-manager-read-v2` output per subject;
- removes the obsolete v1 output contract instead of maintaining compatibility code;
- preserves new-account setup, Music, Manager Conversation, Mission Genesis, billing, catalog, rights, files, and splits behavior.

## Product Standard

Ask Manager is not a metadata summary. It is the Manager's current judgment about what a specific song or project means inside this artist's career system.

A successful read must answer:

1. Where does this song or project stand now?
2. What management role does it play for this artist?
3. Which evidence creates that judgment?
4. What should the team decide next?
5. What tempting move should the team avoid?
6. What should the Manager watch for a changed decision?
7. How confident is the Manager, and why?

The read must feel as intelligent and direct as Manager Conversation while remaining a focused, read-only product surface. It does not create conversations, missions, tasks, permissions, memory, or external actions.

## Current Failure

The current client sequence optionally invokes Chartmetric enrichment and then invokes `generate-music-summary`. Both Chartmetric song and project enrichment functions also invoke `generate-music-summary` after saving evidence. A first-time button click can therefore generate the read twice.

The legacy Manager Read generator compounds that duplication:

- one logical generation may make three OpenAI requests for copy validation;
- an outer four-attempt retry wraps the entire generation;
- a single generation path can attempt up to twelve OpenAI requests;
- usage records report one provider request regardless of the real count;
- long-running functions can be terminated before their catch handlers persist failure;
- terminated runs remain `running` and usage rows remain `started`.

The legacy prompt also generates fields that the Music product does not use and then applies brittle post-generation rewriting and validation. This increases latency and failure probability without improving the user-visible read.

## Architectural Decision

The browser initiates and observes the workflow. The backend owns and completes it.

```text
Browser
  -> POST generate-music-summary
  -> backend creates or reuses a durable subject run
  -> backend returns 202 + runId

Backend run
  -> validate workspace, subject, membership, and entitlement
  -> inspect Chartmetric evidence freshness
  -> enrich when missing or stale
  -> reload normalized evidence
  -> build a subject-focused Manager Intelligence context
  -> generate and validate Manager Read v2
  -> stage and atomically activate the new manager_output
  -> complete run and usage records
```

This reuses the existing `manager_synthesis_runs`, `ai_run_usage_events`, `manager_outputs`, `operating_events`, `EdgeRuntime.waitUntil`, and frontend polling patterns. It does not introduce a new queue table, agent framework, conversation, or worker platform.

## Backend Run Identity and Idempotency

Add nullable `subject_type` and `subject_id` columns to `manager_synthesis_runs`. Manager Read v2 populates both fields.

Add a partial unique index scoped to active Music Manager Read v2 runs:

- workspace;
- subject type;
- subject ID;
- classification `music_manager_read_v2`;
- status `queued` or `running`.

When a request races with an existing active run, the endpoint returns the existing run ID. It does not enqueue another Chartmetric or OpenAI operation.

A queued or running Manager Read older than the configured execution window is terminally marked `failed` before a replacement run is created. This prevents permanent loading states while keeping retry behavior explicit.

## Evidence Refresh Policy

Evidence freshness is decided on the backend, not from a client-loaded Music snapshot.

The workflow:

1. Loads the newest Chartmetric evidence timestamp for the requested subject.
2. Skips provider enrichment when evidence is within the configured freshness window.
3. Invokes the relevant Chartmetric enrichment function when evidence is missing or stale.
4. Reloads evidence after enrichment before building model context.

Chartmetric track and project enrichment functions only:

- resolve exact identity;
- call Chartmetric;
- persist raw snapshots;
- normalize and persist evidence;
- record provider usage and completion state.

They never invoke OpenAI or `generate-music-summary`.

An unresolved exact Chartmetric identity does not automatically destroy the read. If saved subject metadata and Manager Intelligence context are sufficient, the workflow produces a low-confidence, explicitly limited read. A hard Chartmetric/provider failure fails the workflow before OpenAI so the Manager does not reason over evidence that was expected to refresh but could not be trusted.

## Manager Intelligence Context

Manager Read v2 uses a compact, subject-centered projection containing:

- requested song or project identity and lifecycle;
- tracklist for projects;
- artist profile direction, stage, home market, goals, and budget context;
- fresh normalized evidence for the requested subject;
- relevant related records and their strongest comparable evidence;
- latest Manager Intelligence profile projection;
- latest strategic diagnosis;
- the requested asset read, when present;
- a small number of relevant comparison asset reads;
- relevant market reads;
- current mission direction and do-not-do guidance from the packet;
- active playbook instructions already selected by Manager Intelligence.

It does not load conversation history, generic conversation tools, every mission/task, or unrelated catalog records. The latest Manager Intelligence packet supplies career context; subject evidence supplies current proof.

## OpenAI Request

Manager Read v2 uses:

- OpenAI Responses API;
- model routing: `OPENAI_MANAGER_READ_MODEL`, then `OPENAI_MANAGER_REASONING_MODEL`, then `OPENAI_SUMMARY_MODEL`, then `gpt-5.6-luna`;
- `reasoning.effort: "medium"`, matching Manager Conversation;
- strict Structured Outputs;
- medium response verbosity;
- a measured output-token ceiling large enough for reasoning plus the compact response;
- `store: false`, because this is a one-shot read and the application persists its own durable result;
- no tools;
- no `previous_response_id`;
- no agent loop.

The request budget is globally bounded:

1. one initial generation;
2. at most one focused semantic repair.

Transport and semantic retries share this two-request ceiling. There is no nested retry wrapper.

## Manager Read v2 Output

The model returns:

```ts
type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  decision: string;
  avoid: string;
  watch: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  signals: Array<{
    label: string;
    value: string;
    meaning: string;
    evidenceIds: string[];
  }>;
  evidenceIds: string[];
};
```

Field responsibilities:

- `position`: one sharp judgment that names the requested subject.
- `managementRole`: the subject's role in this artist's current system.
- `body`: two or three natural paragraphs of evidence-grounded Manager judgment.
- `decision`: the concrete operating decision the team should make next.
- `avoid`: the attractive but wrong move.
- `watch`: the metric or condition that could strengthen or change the decision.
- `confidence` and `confidenceReason`: calibrated conviction.
- `signals`: three to six compact facts and their management meaning.
- `evidenceIds`: the complete internal evidence set used by the response.

The application writes `schema_version = "music-manager-read-v2"`; the model does not generate the version.

## Removed Legacy Contract

The following legacy generated fields are removed from the shared type, parser, persistence mapping, production view model, loader, and UI:

- `headline`
- `situationLine`
- `nextMove`
- `watchNext`
- `generationState`
- `whatMatters`
- `doNotDoYet`
- `missingProof`
- `evidenceIdsUsed`
- `sourcePanelNote`
- `sourceLine`
- `snapshotSummary`
- `intelligenceSnapshot`
- `claimAudit`

Existing v1 rows are not migrated or adapted. A subject with only a v1 row is presented as needing a refreshed Manager Read.

## Prompt Design

The prompt owns composition, formatting, voice, and management quality.

It instructs the model to:

- speak as the artist's senior Manager;
- lead with the management conclusion;
- keep the requested subject central even when comparisons are stronger;
- explain the subject's role against the artist's direction, career condition, strongest assets, market shape, and attention/conversion profile;
- distinguish public attention, discovery, conversion, and durable fandom;
- use exact names, markets, dates, ranks, placements, and trends when they change the decision;
- format compact values such as `5.2M`, `18K`, `#14`, and `24%`;
- write two or three natural paragraphs rather than a report template;
- produce distinct `decision`, `avoid`, and `watch` judgments;
- keep missing information proportional and express it through confidence rather than making it the read;
- avoid generic advice that could apply to another artist;
- avoid fake authority, tasks, missions, permissions, or unapproved external commitments;
- keep providers, APIs, prompts, databases, internal IDs, and source machinery out of visible fields;
- treat projects as release-level systems with carrying tracks and focus-track judgment;
- treat songs as individual assets with a defined role in the wider artist system.

Code does not rewrite, strip, or patch generated prose.

## Validation and Repair

Code validates:

- strict schema adherence;
- requested title presence in `position`;
- meaningful field lengths;
- three to six signals;
- all evidence IDs belong to the supplied context;
- no provider/internal terminology appears in visible fields;
- `decision`, `avoid`, and `watch` are not duplicates or paraphrases;
- the body remains anchored to the requested subject;
- project output addresses the release rather than substituting one song;
- song output does not substitute a comparison track.

If validation fails, the repair request includes:

- the exact validation failures;
- the invalid structured response;
- the original subject context;
- an instruction to preserve correct content and repair only the violations.

A second invalid response fails the run. The application never returns locally generated fallback prose.

## Persistence and Atomic Activation

The workflow inserts a successfully validated v2 output as non-current. A transactional database function then:

1. locks the subject's current output set;
2. retires the previous current song/project Manager Read;
3. activates the new v2 row;
4. records its superseded output link.

If insertion or activation fails, the previous good v2 output remains current.

Canonical `manager_outputs` projections:

- `summary`: `position`;
- `primary_recommendation_json`: `decision` and `watch`;
- `avoid_json`: `avoid`;
- `confidence_json`: `confidence` and `confidenceReason`;
- `supporting_evidence_json`: evidence references from `signals` and `evidenceIds`;
- `render_json`: the complete v2 output;
- `schema_version`: `music-manager-read-v2`;
- `created_from_run_id`: the durable backend run.

Manager Conversation's existing `query_manager_outputs` tool can retrieve these projections without a conversation code change.

## Music UI

The Music page renders:

1. position and management role;
2. key signals with their management meaning;
3. the natural-language Manager read;
4. decision, avoid, and watch;
5. confidence and confidence reason.

Run state is derived from durable backend data:

- active run, no prior v2: show `Manager is reading...`;
- active refresh with prior v2: keep the previous read visible and show a refreshing state;
- successful run: load the new current v2 output;
- failed first run: show a retry action and safe persisted error;
- failed refresh: keep the previous read and show refresh failure;
- v1-only output: hide it and show `Refresh Manager Read`.

While the selected subject has an active run, the Music surface polls existing repository data. Remounting or refreshing the browser recovers the same state from the database.

## New-Account Setup

Today’s Brief and the Manager Intelligence packet remain the new-account activation gate. Per-song/project reads remain post-setup enrichment.

Setup flow:

1. Generate and persist the setup Manager Intelligence packet.
2. Generate and persist Today’s Brief.
3. Mark the workspace setup complete and allow entry to the app.
4. Dispatch Manager Read v2 jobs for selected setup music targets.
5. Track their run IDs in the existing `music_reads` setup substage.
6. Mark that substage `completed` or `completed_with_limits` only after the runs reach terminal states.

The existing setup background finalizer must poll returned run IDs rather than treating HTTP `202` as completed work.

A simultaneous setup dispatch and user button click reuse the same active subject run.

Music-read failure never revokes workspace access or removes the setup brief.

## Failure and Recovery

Each run records explicit steps:

- `evidence_check`
- `chartmetric_enrichment` when required
- `context_build`
- `manager_synthesis`
- `output_validation`
- `output_activation`

Failures record the active step, safe error, provider status where available, completion timestamp, and real request count.

The last good v2 output remains readable during refreshes and after refresh failures. A stale active run is terminally failed before retry. No run should remain `queued` or `running` indefinitely.

## Observability

`ai_run_usage_events` records:

- provider and exact model;
- operation key `music_manager_read_v2`;
- subject type and ID;
- provider request count;
- input tokens;
- cached input tokens;
- output tokens;
- reasoning tokens;
- duration;
- success or failure;
- failure reason.

The OpenAI response ID and Chartmetric enrichment run/job IDs are stored in internal run context or usage metadata for traceability, not in visible output.

Operating events record successful generation and terminal failure without making telemetry failure invalidate an otherwise persisted read.

## Test Strategy

### Contract tests

- valid song and project v2 responses parse;
- legacy fields are absent;
- v1 rows never render;
- subject substitution fails;
- unknown evidence IDs fail;
- provider/internal leakage fails;
- duplicate decision/avoid/watch fails;
- one failed validation produces one repair;
- total OpenAI requests never exceed two.

### Workflow tests

- fresh evidence skips Chartmetric;
- missing and stale evidence invoke Chartmetric before OpenAI;
- evidence reload happens after enrichment;
- unresolved identity produces a limited grounded read when minimum context exists;
- hard enrichment failure prevents OpenAI;
- OpenAI failure preserves the last good output;
- activation failure preserves the last good output;
- duplicate requests return the same run ID;
- stale runs are failed and can be retried;
- usage captures actual provider data.

### Database tests

- partial uniqueness prevents duplicate active subject runs;
- song and project subjects remain isolated;
- atomic activation preserves the previous output on failure;
- RLS prevents cross-account run and output reads;
- only one current output exists per output type and subject.

### UI tests

- v1-only, absent, running, refreshing, completed, failed-first-run, and failed-refresh states;
- browser remount recovers active state;
- polling stops at terminal state;
- all v2 fields render on song and project pages;
- mobile and desktop buttons remain accessible and correctly disabled.

### Setup regression tests

- Today’s Brief still unlocks the workspace;
- music reads do not block activation;
- setup tracks returned run IDs;
- `music_reads` remains running until terminal;
- mixed results become `completed_with_limits`;
- setup and button requests cannot duplicate work;
- browser refresh does not lose setup read progress.

### Release verification

Before production:

- run targeted Manager Read, Chartmetric, setup, service, and UI tests;
- run the complete Vitest suite;
- run the production build;
- reset and migrate a local Supabase database;
- smoke-test locally served functions.

Production smoke tests use a controlled workspace:

- song with fresh Chartmetric evidence;
- song requiring enrichment;
- project with a tracklist;
- new-account setup;
- browser refresh during generation;
- deliberate provider failure;
- Manager Conversation retrieval of a completed v2 read.

Database acceptance:

- no duplicate active runs;
- no runs past the stale threshold;
- one current v2 output per tested subject;
- normal OpenAI request count of one and hard maximum of two;
- no Chartmetric enrichment invoking OpenAI;
- accurate setup and music-read states.

## Deployment Order

1. Apply the additive database migration.
2. Remove OpenAI handoffs from Chartmetric track and project enrichment.
3. Deploy setup finalization that understands background Manager Read run IDs.
4. Deploy the Manager Read v2 backend.
5. Deploy the v2 Music loader and UI immediately afterward.
6. Run the production smoke matrix before broader use.

The deployment does not refactor Manager Conversation, Mission Genesis, billing, catalog import, rights, files, splits, or unrelated Manager Intelligence generation.

## Acceptance Criteria

The change is complete only when:

- one button request creates or reuses exactly one backend subject run;
- Chartmetric enrichment, when required, completes before OpenAI context is built;
- the workflow survives page refresh and tab closure;
- Manager Read uses the same Manager reasoning model and effort as Conversation;
- visible output satisfies the v2 product contract and contains no legacy fields;
- v1 rows are hidden rather than adapted;
- setup access is not blocked by music reads;
- failed refreshes preserve the last successful v2 read;
- usage and run records reflect the real provider work;
- all targeted, full-suite, build, migration, local smoke, and production smoke checks pass.
