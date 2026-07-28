# Music Manager Read Single-Surface Design

## Objective

Refine the durable Music Manager Read workflow into one calm, high-value product surface. A song or project read must show a concise position, its management role, a small set of exact decision-relevant metrics, and one natural-language Manager's Read. The prose carries the complete management judgment; the product does not render separate decision, avoid, watch, confidence, confidence-reason, or signal-meaning sections.

The change must preserve Chartmetric-before-OpenAI sequencing, durable background execution, browser-refresh recovery, usage accounting, the last good read during refresh, new-account access, Manager Conversation, Mission Genesis, and unrelated Music workflows.

## Product Contract

The customer-facing read contains only:

1. `position`: one sharp conclusion naming the requested song or project.
2. `managementRole`: a short, complete role in the artist's current system.
3. `metrics`: two to five exact facts selected because they materially support the judgment.
4. `body`: one cohesive Manager's Read written as natural prose.

The body must naturally explain:

- what the requested song or project currently means;
- why the strongest supplied evidence supports that conclusion;
- the concrete next management move;
- the attractive but wrong move to avoid;
- the observable condition that would materially change the judgment.

Those elements are writing requirements, not separate generated or rendered fields. The prose must not use report headings such as `Decision`, `Avoid`, `Watch`, `Confidence`, or `Signal meaning`.

## Considered Approaches

### Keep generating hidden fields

Rejected. Hiding decision, avoid, watch, confidence, and signal meanings while still generating and validating them wastes tokens, creates additional failure points, and leaves two competing product contracts.

### Let the model generate visible metric labels and values

Rejected. The model can choose relevant evidence, but it should not be responsible for copying or formatting canonical metric facts. That design permits invented units, combined values, truncated figures, and presentation drift.

### Lean model judgment with backend-owned metrics

Selected. OpenAI writes the prose and selects evidence IDs. The backend resolves selected metric evidence into canonical labels and values. This preserves model judgment while making visible metrics exact and deterministic.

## Model Output and Persisted Output

The strict OpenAI Structured Output is an internal generation contract:

```ts
type MusicManagerReadModelOutput = {
  position: string;
  managementRole: string;
  body: string;
  metricEvidenceIds: string[];
  evidenceIds: string[];
};
```

The persisted and frontend-visible contract is:

```ts
type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  metrics: Array<{
    label: string;
    value: string;
    evidenceId: string;
  }>;
  evidenceIds: string[];
};
```

`metricEvidenceIds` is never rendered or persisted as the visible metric representation. The backend expands it into `metrics` after validation. Evidence IDs remain internal and are never displayed.

The existing `music-manager-read-v2` schema version and durable workflow classification remain in place. A transactional migration converts current v2 render payloads from their transitional shape into this final shape, preserving existing reads without maintaining a permanent compatibility parser.

## Evidence Projection

The backend reloads normalized evidence after Chartmetric enrichment and builds two projections.

### Reasoning evidence

The model may receive only safe, decision-relevant fields:

- evidence ID;
- requested or comparison subject identity;
- normalized metric name;
- numeric or bounded text value;
- normalized unit;
- observation or reporting timeframe when known;
- safe freshness state;
- confidence state when it helps calibrate use;
- a bounded, normalized limitation state when material.

Raw provider response text, raw references, provenance strings, database field names, ingestion errors, source limits, and provider-specific diagnostic messages are excluded.

### Metric candidates

Only evidence with a usable metric name, value, and supported display unit becomes a visible metric candidate. The backend creates the candidate's display label and compact display value before the OpenAI call. The model receives the candidate ID, label, value, subject, and timeframe so it can select the two to five facts that best support its argument.

Metric formatting is deterministic:

- ranks use `#N`;
- percentages include `%`;
- large counts use consistent compact notation such as `1.23M` and `18.4K`;
- scores, counts, followers, streams, listeners, posts, plays, Shazams, playlist reach, and other supported units receive human labels;
- metric names are converted from internal snake-case identifiers into product language;
- a metric value never contains multiple facts or a semicolon.

If fewer than two usable exact metrics exist, the workflow may return the available metric rather than inventing filler. A read still requires at least one grounded evidence ID.

## Prompt Design

The prompt is subject-aware and lean. Song instructions refer to a song or track; project instructions refer to a project or release and reason across the tracklist.

It states once that the Manager must:

- lead with the most distinctive conclusion;
- calibrate scale and direction to the artist's stage and goal;
- use supplied exact names, markets, dates, ranks, and figures when decision-relevant;
- select only metric candidate IDs supplied in context;
- write approximately 140 to 280 words in two to four short natural paragraphs;
- weave the recommendation, wrong move, and change condition into the prose;
- omit provider, API, database, prompt, evidence-ID, source-window, and internal-mechanics language;
- avoid generic advice, fake commitments, missions, tasks, and comparison-subject substitution.

The prompt does not ask the model to expose chain-of-thought or confidence. It asks for the final judgment and its visible evidence only. One initial request and at most one focused semantic repair remain the global request ceiling.

## Validation

Code validates:

- exact Structured Output keys;
- configured string and array limits shared by schema and semantic validation;
- exact requested-title presence in `position`;
- song/project subject fidelity;
- body word range and complete prose;
- every evidence ID belongs to the supplied safe context;
- every selected metric ID belongs to the metric-candidate set and is included in root evidence IDs;
- selected metric IDs are unique and within the two-to-five target when enough candidates exist;
- visible fields contain no evidence IDs or unambiguous internal/provider terminology;
- body includes an actionable management recommendation and a decision-changing condition without requiring visible headings.

Validation does not rewrite generated prose. A failed response receives one repair request containing only the exact failures, original context, and invalid structured response. A second invalid response terminally fails the run while preserving the previous good output.

## Persistence and Migration

New outputs retain the existing output types, durable run classification, atomic activation RPC, and `music-manager-read-v2` schema version.

New canonical projections are:

- `summary`: `position`;
- `primary_recommendation_json`: a compact projection containing the complete Manager's Read body;
- `avoid_json`: empty array;
- `confidence_json`: empty object;
- `supporting_evidence_json`: internal evidence IDs plus selected metric references;
- `render_json`: the final visible v2 contract;
- `schema_version`: `music-manager-read-v2`.

An additive migration transactionally converts every existing `music-manager-read-v2` row that still has the transitional fields:

- preserve `position`, `managementRole`, `body`, and `evidenceIds`;
- convert old signals into metrics using their existing label, value, and first supported evidence ID;
- remove decision, avoid, watch, confidence, confidenceReason, signals, and signal meanings from `render_json`;
- replace obsolete projection columns with the new canonical projections;
- leave run identity, output identity, current state, lineage, and timestamps unchanged.

The migration is idempotent and only updates rows matching the old exact render shape. No read is made non-current and no user is required to regenerate.

## Music UI

The current single Manager's Read container remains. No new cards or standalone judgment panels are introduced.

It renders:

1. position;
2. management role;
3. a compact responsive metric strip with label and exact value only;
4. the natural-language Manager's Read.

The UI renders persisted values without trimming roles, splitting values at semicolons, or otherwise repairing model/backend output. Invalid persisted output fails the loader contract instead of being silently altered.

Existing states remain unchanged: not generated, stale, running, refreshing, fresh, failed first run, and failed refresh. A refresh keeps the previous read visible.

## Setup Lifecycle

Today's Brief and Manager Intelligence continue to unlock the workspace. Music reads remain non-blocking background enrichment.

For each setup target, `generate-todays-brief` must:

1. call `generate-music-summary`;
2. require `{ status: "processing", runId }` from the `202` response;
3. retain the exact returned run ID and target tuple;
4. poll only those account/workspace/artist/subject-scoped runs;
5. stop at `completed`, `completed_with_limits`, `failed`, or `cancelled`;
6. treat a bounded timeout as a recorded setup limitation without changing workspace access;
7. mark `music_reads` completed only when all tracked runs are terminal;
8. record mixed failures as `completed_with_limits`.

The paid setup function must merge stage state and must not overwrite a terminal `music_reads` state back to `running`. Setup remains completed for access purposes regardless of music-read failures.

## Safe Error Handling

Persisted and client-returned failures use stable application messages and codes. Raw OpenAI response bodies, request IDs, database errors, environment details, provider diagnostics, and Chartmetric payloads are never stored in customer-readable run errors or usage failure reasons.

Restricted runtime logs may contain bounded diagnostic metadata such as provider status, response ID, and internal failure class, without logging secrets or full response bodies.

The endpoint returns safe status-specific responses for authentication, authorization, validation, entitlement, configuration, and internal generation failures.

## Test Strategy

### Model and evidence contract

- new exact model and persisted output shapes parse;
- removed fields are rejected;
- song and project prompts use correct subject terminology;
- body requirements include recommendation, wrong move, and change condition;
- internal/provider leakage fails validation;
- unsupported and duplicate evidence IDs fail;
- exact metric candidates are resolved without model-written values;
- metric units and compact formatting cover representative Chartmetric rows;
- schema and semantic limits agree;
- one repair remains the hard request ceiling.

### Persistence and migration

- staged outputs use only the new projections;
- conversion preserves current output identity and prose;
- transitional signals become visible metrics;
- obsolete fields and projections are removed;
- migration is idempotent;
- atomic activation and last-good-output behavior remain intact.

### Setup lifecycle

- a `202` dispatch without a valid run ID fails that target;
- setup remains `running` while any tracked run is active;
- all-success becomes `completed`;
- mixed terminal results and timeout become `completed_with_limits`;
- paid setup cannot overwrite terminal music-read state;
- workspace access never waits for music-read completion;
- duplicate setup and button requests reuse the active subject run.

### UI and service

- song and project reads render only position, role, metrics, and body;
- obsolete judgment/confidence/signal-meaning text does not render;
- frontend does not rewrite persisted metric values or roles;
- old transitional render shape is rejected after the migration boundary;
- refresh/remount and every durable run state continue to work.

### Release verification

- targeted Vitest suites;
- complete Vitest suite;
- production build;
- Deno checks for affected Edge Functions;
- migration contract tests and remote database lint;
- controlled local or staging smoke tests for fresh evidence, stale enrichment, project generation, refresh recovery, setup tracking, and deliberate OpenAI failure;
- production deployment only after explicit approval, followed by scoped database and UI smoke checks.

## Deployment Order

1. Apply the additive conversion and setup-support migration, if setup polling requires database support.
2. Deploy `generate-music-summary` with the lean model contract, safe evidence projection, exact metric resolution, and safe errors.
3. Deploy `generate-todays-brief` and `paid-workspace-setup` lifecycle fixes.
4. Deploy the frontend loader, type, and UI contract immediately after the backend.
5. Run the controlled production smoke matrix and inspect scoped durable run, usage, output, and setup records.

No production deployment occurs without explicit user approval.

## Acceptance Criteria

The work is complete only when:

- the Music UI shows one Manager's Read and no separate judgment/confidence sections;
- the prose contains the complete useful management judgment;
- visible metrics are exact backend-formatted evidence facts selected for relevance;
- reasoning context retains safe units, timeframes, freshness, and limitations without leaking internal machinery;
- existing current reads survive the migration;
- Chartmetric completes before OpenAI context construction when refresh is required;
- setup tracks exact Manager Read runs to terminal state without blocking account access;
- raw provider/database errors cannot reach persisted or visible error fields;
- browser refresh, duplicate clicks, last-good-read behavior, usage truth, Conversation, Missions, and unrelated Music functions remain intact;
- all targeted, full-suite, build, Edge Function, migration, lint, and smoke checks pass.
