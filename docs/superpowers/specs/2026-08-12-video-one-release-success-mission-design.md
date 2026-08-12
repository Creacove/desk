# Video One and Release Success Mission Design

Status: Approved on August 12, 2026

## Purpose

Make the real production application capable of the first social product demo, **Your release date is wrong**, while creating a reusable release-success foundation for later playlist, press, EPK, content, splits, launch, and post-release demos.

The product promise is not merely that Desk helps an artist become release-ready. Desk helps an upcoming or mid-level artist execute the strongest realistic release campaign available to them at their current stage.

Readiness is the diagnostic layer. Successful campaign execution is the product outcome.

## Approved V1 boundary

V1 will:

- evolve the release mission already attached to a song into one Release Success Mission;
- assess release foundation, campaign preparation, and unknown information separately;
- recommend whether to keep or move the release date;
- preview and, after explicit approval, apply the date change and update only release-bound mission deadlines;
- research suitable independent playlists, press outlets, and writers from public sources;
- distinguish Spotify editorial pitching from independent curator outreach;
- return verified public email addresses, submission forms, or contact pages where available;
- create tailored pitches, EPKs, target lists, release one-sheets, content plans, and share packages;
- attach every created document to the song and mission automatically;
- make canonical documents appear in the song's Files area and share-package selector;
- allow the artist to record manual submission and outreach outcomes; and
- capture operational failures in the existing central error telemetry with enough correlation to diagnose and retry them.

V1 will not:

- send email or submit external forms;
- promise playlist placement, press coverage, streams, or campaign success;
- create a general-purpose contact CRM;
- scrape private contact information;
- recommend guaranteed paid playlist placement;
- perform automated audio technical QC;
- infer sample clearance or legal certainty from audio;
- replace the existing Music, Missions, Files, sharing, rights, evidence, or operating-event systems; or
- introduce a multi-agent architecture solely for this workflow.

## Product principles

### One song, one operating mission

An unreleased song has one attached Release Success Mission. Rescheduling, playlist research, press preparation, and launch work evolve that mission rather than creating parallel missions.

### Everything starts and can finish in Desk

The artist can ask, decide, research, create, revise, approve, and prepare sharing from the Manager conversation. Music, Missions, and Files provide durable drill-down surfaces; they are not mandatory detours in the primary flow.

External submission is the only V1 handoff. Desk leaves the artist with the correct public contact or submission link, tailored copy, and a shareable package.

### Evidence, not decorative checkboxes

Every readiness or opportunity claim must identify its evidence, source, freshness, and limitations. Missing evidence is `unknown`, not automatically failed or passed.

### Inspect, act, and recheck

Every meaningful issue follows one loop:

`Inspect -> explain -> fix in Desk or guide external action -> collect evidence -> recheck`

### Model judgment, deterministic mutations

The model interprets intent, researches, judges fit, explains trade-offs, and drafts material. Application code validates records, deduplicates candidates, calculates dates, enforces approval, performs database mutations, versions documents, and records outcomes.

## Video One production workflow

### Opening request

The user asks:

> My song drops in 14 days. Are we actually ready?

The conversation uses its attached song. If there is no unambiguous subject, Manager presents a compact inline song picker and does not guess.

### Investigation

One restrained activity area evolves from real tool events:

```text
Checking Glass House...

Release materials checked
Rights and approvals checked
Campaign preparation checked
Mission deadlines checked
```

The interface does not expose chain of thought and does not simulate completed work with fixed demo delays.

### Decision

Manager leads with the operating judgment:

> You can technically release on August 26, but I wouldn't. The campaign is underprepared.

The chat contains one evolving Release Success artifact:

```text
RELEASE AT RISK

Release foundation       6 of 8 confirmed
Campaign execution       3 of 7 prepared
Unknown                  2 checks

Highest-impact problems
- One split is awaiting confirmation
- Distributor delivery is not confirmed
- Spotify editorial pitch is not prepared
- No independent playlist targets have been researched
- The press package is incomplete

Recommendation
Move the release from August 26 to September 9.
```

The UI does not present one opaque readiness percentage. It distinguishes confirmed, blocked, at-risk, unknown, and not-applicable states.

### Impact preview

The same artifact changes to a proposal state:

```text
IF YOU MOVE TO SEPTEMBER 9

Release date              August 26 -> September 9
Distributor delivery      August 14 -> August 28
Spotify editorial pitch   August 19 -> September 1
Playlist shortlist        August 20 -> September 2
EPK and press package     August 21 -> September 3
Content rollout           August 22 -> September 5

9 release-bound deadlines move
1 fixed external commitment stays unchanged
```

Actions:

- `Approve September 9 and update mission`
- `Keep August 26 and show recovery plan`
- `Review all changes`

Keeping the date is a valid path. Manager then creates the strongest realistic 14-day recovery plan and states which opportunities may no longer be viable.

### Approval and application

Approval is explicit and describes the exact mutation. The approval command:

1. verifies that the preview and release-plan revision are current;
2. locks the release plan;
3. updates the approved operational release date;
4. recalculates only explicitly release-bound tasks;
5. preserves fixed, manual, completed, and external commitments;
6. records approval and an operating event;
7. invalidates the old readiness assessment; and
8. returns the persisted result.

These writes occur in one database transaction. A critical failure rolls back the transaction rather than leaving the song and mission inconsistent.

### Persisted receipt

The final state is driven by the transaction result:

```text
RELEASE PLAN UPDATED

Glass House now releases September 9.

Release date updated
9 linked deadlines recalculated
1 fixed commitment preserved
Release Success Mission updated

Next move
Build the playlist and press target shortlist
```

The artist can continue by selecting `Start research with Manager` or typing another request. Refreshing the application must preserve the same date, mission schedule, and receipt truth.

## Release Success Mission

The current release mission pattern evolves into six workstreams. Workstreams activate progressively from the artist's stage, strategy, constraints, and available evidence.

### 1. Release foundation

- designated master presence;
- approved artwork presence;
- required release metadata;
- credits and contributor information;
- splits and conversational clearance declarations;
- approved operational release date;
- identifiers when applicable; and
- distributor delivery state and evidence.

Automated audio QC and automated sample detection are deferred. Manager may ask a focused question such as whether the recording contains samples, leased beats, cover material, or uncleared featured performances when that fact is not stored.

### 2. Playlist and discovery

- Spotify editorial pitch eligibility and preparation;
- independent playlist research;
- target judgment and prioritization;
- personalized pitch drafts;
- public submission routes;
- share-package preparation; and
- manually recorded submission outcomes.

### 3. Press and media

- artist and song narrative;
- release-specific press angle;
- EPK and one-sheet preparation;
- relevant outlet and writer research;
- personalized press pitches;
- public contact or submission routes; and
- manually recorded coverage outcomes.

### 4. Content rollout

- campaign objective and audience;
- strategy-specific content concepts;
- existing and missing assets;
- owners and deadlines; and
- rollout calendar.

V1 must not enforce a universal arbitrary asset count such as nine. Required content depends on the selected campaign.

### 5. Launch

- live-link verification;
- final approved packages;
- manual outreach/submission state;
- release-day actions; and
- unresolved risk summary.

### 6. Post-release

- public playlist additions and removals where supported;
- coverage and outreach outcomes;
- available audience or discovery evidence;
- limitations of missing private analytics; and
- recommended next actions.

### Manager work versus artist work

Research, comparison, fit judgment, drafting, document creation, and schedule calculation are Manager work. The artist receives concrete decisions and finished work products rather than vague tasks such as `research playlists`.

The artist owns private intent, approvals, external submissions, external messages, and facts that cannot be researched.

## Release-success assessment

### Foundation states

Foundation requirements are common to upcoming and mid-level artists, while applicability may vary by release type:

- final master present and designated;
- artwork present and designated;
- typed required metadata confirmed;
- credits captured;
- splits confirmed;
- samples, beat licences, covers, and other clearances declared resolved or not applicable;
- operational release date approved;
- distributor delivery status recorded; and
- identifiers captured when applicable.

### Campaign states

Campaign checks activate only when the chosen strategy needs them:

- Spotify editorial pitch;
- independent playlist outreach;
- press campaign;
- EPK;
- pre-save or smart link;
- creator outreach;
- paid advertising;
- alternate audio versions; and
- post-release measurement.

### Status vocabulary

Each check returns:

- `confirmed`: current evidence supports completion;
- `blocked`: a required condition is unresolved;
- `at_risk`: possible but timing or quality is materially weak;
- `unknown`: required evidence is absent or stale; or
- `not_applicable`: the release strategy does not require it.

Every result includes evidence references, freshness, limitations, an actionable next step, and the release-plan revision assessed.

Changing a relevant source record invalidates dependent assessments. Examples include replacing the master, changing the song title, changing splits, changing the release date, replacing the EPK, or recording a distributor receipt.

## Playlist opportunity workflow

Spotify editorial pitching and independent curator pitching are separate paths.

### Spotify editorial path

Desk:

- determines eligibility from the release state;
- prepares the pitch fields from song metadata, story, genre, mood, culture, instrumentation, markets, and campaign plan;
- identifies missing information;
- creates a canonical Spotify pitch document;
- provides the Spotify for Artists handoff; and
- lets the artist record manual submission confirmation.

Desk does not search for Spotify editor emails or claim that a pitch guarantees placement.

### Independent playlist path

Manager:

1. reads the song campaign packet and connected evidence;
2. forms a research brief from genre, mood, language, market, comparable artists, release stage, and artist scale;
3. searches public sources and supported provider evidence;
4. deduplicates playlist candidates;
5. judges recent musical fit, market fit, artist-stage fit, activity, submission route, and safety concerns;
6. saves only evidence-backed candidates;
7. leads with a shortlist of approximately five to eight strong opportunities;
8. creates target-specific pitch drafts and package recommendations; and
9. lets the artist record manual submission and outcome state.

Each saved opportunity contains:

- playlist name and platform;
- public playlist/source URL;
- public curator or organization name when verified;
- public email, submission form, or contact page when verified;
- date the route was verified;
- fit explanation tied to the song;
- supporting genre, mood, artist, market, and recency evidence;
- confidence and limitations;
- safety or paid-placement concerns;
- submission requirements;
- recommended package;
- linked pitch document;
- status; and
- manually entered outcome.

The system never invents a playlist, curator, email, placement, or result. A strong musical match with no verified contact route remains a `watch` candidate rather than an actionable target.

Any service promising guaranteed placement for payment is excluded and explained as unsafe.

## Press opportunity workflow

Press follows the same opportunity model rather than a separate contact system.

Manager:

1. derives plausible press angles from the song, artist story, market, evidence, and campaign objective;
2. searches for outlets and writers who have recently covered relevant artists, scenes, sounds, or stories;
3. verifies the public article/byline evidence and current public contact route;
4. explains why the target and angle fit;
5. selects the correct package depth;
6. creates a personalized pitch; and
7. records the target and manual outcome against the song and mission.

Returning a generic list of music blogs is not an acceptable result. A recommendation must connect the target's demonstrated editorial interests to this artist and song.

## Documents, Files, and sharing

All Manager-created deliverables are canonical song documents using the existing document system. They are linked automatically to both the song and Release Success Mission and rendered in the conversation.

Supported V1 deliverables include:

- EPK;
- artist bio;
- release one-sheet;
- Spotify editorial pitch;
- playlist target brief;
- independent playlist pitch;
- press target brief;
- press release;
- personalized press pitch;
- content plan; and
- release calendar.

One document has multiple surfaces:

`Manager conversation -> canonical document -> song Files -> Release Success Mission -> share-package selector`

The application must not create separate copies for each surface.

Documents have draft, approved, and superseded states. Updating a document creates a new version of the same logical document. Existing immutable share snapshots retain the version originally shared; new packages default to the latest approved version.

For a selected opportunity, Desk can prepare a target-specific package containing the appropriate canonical documents, artwork, press photograph, private listening link, and tailored pitch. V1 returns copyable contact information and submission links but does not send or submit.

## Chat-native interface

The Release Success artifact is one visual frame that evolves through:

- investigating;
- assessed;
- proposed change;
- awaiting approval;
- applying;
- applied; or
- failed/retryable.

It does not append a new dashboard-like card for every step.

Reusable UI units include:

- conversation subject row;
- investigation status;
- release-success summary;
- evidence disclosure;
- proposed-change diff;
- approval action bar;
- applied-change receipt;
- inline song picker;
- opportunity shortlist;
- opportunity detail;
- canonical document preview; and
- target package preview.

Music, Mission, Files, evidence sources, and public opportunity URLs remain optional drill-down links. Returning from a drill-down restores the conversation and artifact state.

## Reuse and minimal data additions

### Existing systems to reuse

- Music song/project records, identifiers, credits, assets, and splits;
- the song-attached release mission, plan versions, checkpoints, and tasks;
- Manager Responses API conversation and streaming infrastructure;
- web search and connected evidence/provider data;
- Manager outputs and document artifacts;
- canonical song documents and share snapshots;
- permission requests and proposed actions;
- operating events and targeted live refresh; and
- `app_error_events` and `captureAppError()`.

### Operational release plan

Add a minimal operational release-plan record keyed to the song. It distinguishes:

- provider or historical release date;
- approved operational release date;
- proposed date;
- plan status;
- revision; and
- approval identity/time.

Provider history is never overwritten by planning changes.

### Date-change request

Use an append-only proposal record linked to the existing permission system. It stores the current and proposed dates, rationale, expected plan revision, preview hash, status, expiry, idempotency key, requester, approver, and application result.

### Release task schedule binding

Bind only appropriate existing tasks to the approved release date with an offset and applied revision. Existing and legacy tasks remain fixed/manual unless explicitly converted. Completed tasks do not move.

### Opportunity brief

Add one lightweight opportunity structure that can represent playlist and press targets. It stores structured fit, public sources, contact route, verification time, confidence, requirements, status, manual outcome, song, mission, and linked documents.

This is not a global contacts database. If later videos prove the need for reusable relationship history, that can extend the opportunity model after V1.

## OpenAI orchestration

Use the existing Responses API agent loop and conversation state.

### Intent-scoped tools

Expose only tools needed for the active workflow. The conceptual boundaries are:

#### Reads

- read the focused song campaign packet;
- read current release-success state;
- read the attached mission;
- query existing song documents;
- query existing opportunities; and
- query supported music-intelligence evidence.

#### Research

- search playlist opportunities;
- search press opportunities;
- inspect a public opportunity source; and
- verify a public contact route.

#### Internal writes

- save an opportunity shortlist;
- create or update a canonical song document;
- create or update a share package;
- update release mission work; and
- record a manual external outcome.

#### Approval-gated mutation

- propose a release-date change; and
- apply an explicitly approved release-date change through the authoritative transaction.

No V1 tool sends outreach or submits externally.

### Workflow instructions

Use focused operating instructions for:

- release success and rescheduling;
- playlist opportunity research;
- Spotify editorial pitch preparation;
- press opportunity research;
- EPK creation; and
- target-specific package preparation.

These instructions share data and tools. They are not separate databases or autonomous agents.

### Structured outputs and source preservation

Tool results and final artifacts use strict schemas for gate states, opportunity evidence, contact verification, proposal diffs, mutation receipts, and errors. Native citations and public URLs survive normalization and remain visible to the user.

Direct tool calling is the V1 default because individual results can change the next judgment, approval is required for the date mutation, and native citations must be preserved. Programmatic tool calling or multi-agent research is considered only after representative evaluations show a material quality, latency, or cost advantage.

### Prompt discipline

Prompts state the outcome, evidence requirements, hard limitations, approval boundaries, and stopping conditions once. They do not duplicate policies across long instructions. Tool descriptions identify expected return fields and failure behavior.

## Error logging and operational diagnosis

This workflow extends the existing central error telemetry. It does not add another logging table or third-party observability product.

### Required correlation

One user operation keeps a trace/request ID through:

- Manager conversation run;
- each tool call;
- public web/provider request;
- release assessment;
- opportunity normalization and persistence;
- document creation/versioning;
- share-package creation;
- date-change proposal; and
- approval transaction.

Every captured error includes the available account, workspace, artist, song, conversation, Manager run, mission, task, release-plan revision, opportunity, document, proposal, tool name, stage, attempt, provider, provider request ID, and idempotency key.

### Failure categories

Use a bounded stage vocabulary so failures can be grouped and queried:

- `subject_resolution`;
- `release_assessment`;
- `mission_read`;
- `opportunity_search`;
- `source_inspection`;
- `contact_verification`;
- `opportunity_persistence`;
- `document_generation`;
- `document_persistence`;
- `share_package_creation`;
- `reschedule_preview`;
- `reschedule_approval`;
- `schedule_recalculation`;
- `realtime_refresh`; and
- `receipt_render`.

### Logging contract

Unexpected terminal failures call `captureAppError()` with the real credential-scrubbed error, safe user projection, operation, stage, correlation IDs, relevant record revisions, retry metadata, and bounded input context.

The workflow-specific status remains canonical on its own record. The central error row links to it. A logging failure never masks the original error and falls back to structured runtime logging with the same trace ID.

Expected outcomes such as no verified public contact, no strong playlist match, an expired proposal, a user rejection, or a Spotify-ineligible release are modeled product states, not application errors.

### User-facing failures

The user receives a specific, safe explanation and retry behavior:

- research partial failure preserves verified results and allows retrying the failed stage;
- document failure does not create a phantom Files entry;
- share-package failure leaves source documents unchanged;
- stale approval refreshes the preview rather than applying different changes silently;
- transaction failure reports that no release-plan change was applied;
- refresh failure distinguishes persisted success from a screen that could not refresh; and
- unexpected failures include a short support reference derived from the central error event ID.

### Minimal operational queries

The implemented feature must make these questions answerable directly:

- What failed most often in Video One during the last release?
- Which songs or accounts were affected?
- Was the failure in OpenAI, a public source/provider, document persistence, or the approval transaction?
- Did the core transaction roll back or persist successfully?
- Is retry safe, and which idempotency key protects it?
- Which application release introduced or resolved the fingerprint?

No dashboard, alerting system, or incident workflow is required for this increment.

## Error and edge-state behavior

### Ambiguous song

Manager presents likely upcoming releases in chat and waits for selection.

### No upcoming song

Manager explains what it found and offers to select a song or create an unreleased song workspace.

### Conflicting dates

Manager names the conflicting sources and asks the user to confirm operational authority before assessment or rescheduling.

### Partial evidence

Manager states `likely at risk based on X of Y checks` and names unknowns. It does not manufacture confidence.

### No strong opportunity matches

Manager explains which fit criteria were applied, preserves any watch candidates, and suggests one bounded search adjustment. It does not fill the list with weak targets.

### No verified public contact

The target remains a watch candidate with its source evidence and cannot appear as ready for outreach.

### Stale contact

Manager shows the older public source, labels the route unverified, and does not imply it is current.

### Stale proposal or concurrent approval

Only the first approval against the current release-plan revision can succeed. A later attempt receives fresh canonical state and must be reviewed again.

### Partial research persistence

Verified candidates already committed remain available. Failed batches are retryable with idempotency protection and cannot duplicate candidates.

### Apply transaction failure

No date, binding, permission, or event mutation persists. The artifact remains in a retryable failed state with a support reference.

### Persisted mutation followed by refresh failure

The receipt reports that the change persisted but the screen could not refresh. Retrying refresh must not replay the mutation.

## Safety, privacy, and trust

- Research uses public sources and contracted provider evidence only.
- Public contact information retains source URL and verification date.
- Private contact details are not scraped or inferred.
- Prompts, private documents, lyrics, credentials, signed URLs, and raw file contents are excluded from central logs.
- Public Spotify metadata is not described as private Spotify for Artists analytics.
- Playlist reach is not described as fan growth or guaranteed conversion.
- Public attention is not described as campaign ROI.
- Legal and rights declarations are presented as artist-provided operating facts, not legal advice.
- External submission, outreach, spend, publication, and public release-plan mutation retain explicit permission boundaries.

## Testing and evaluations

### Database and transaction tests

- provider/historical dates cannot be overwritten by rescheduling;
- only release-bound tasks move;
- fixed, manual, completed, and external commitments remain unchanged;
- date, bindings, permission, revision, and operating event commit or roll back together;
- two approvals for the same revision cannot both apply;
- idempotent retries do not duplicate events or mutations;
- existing share snapshots remain immutable; and
- legacy songs without operational release plans hydrate as before.

### Readiness tests

- technical foundation and campaign preparation remain separate;
- missing evidence produces `unknown`;
- strategy-dependent checks can be not applicable;
- changing dependent evidence invalidates an assessment;
- released songs do not reopen pre-release requirements; and
- keeping an at-risk date produces a recovery plan rather than a forced reschedule.

### Opportunity research evaluations

Golden scenarios cover:

- a strong genre, mood, market, and artist-stage match;
- a large but musically weak playlist;
- duplicate targets across sources;
- no current submission route;
- stale contact information;
- an attempted invented email or curator;
- guaranteed paid-placement services;
- Spotify editorial versus independent curator routing;
- a press target with strong subject fit but weak artist-stage fit;
- a generic blog list that must fail quality evaluation; and
- no strong targets, where returning fewer results is correct.

Evaluations score source validity, contact provenance, fit specificity, recency, safety, citation preservation, non-fabrication, package correctness, and usefulness.

### Document and sharing tests

- Manager-created documents appear in song Files and the mission;
- all surfaces resolve the same logical document/version;
- draft and approved versions are distinguished;
- existing share snapshots retain their captured version;
- target packages contain only selected assets;
- failed persistence creates no phantom artifact; and
- copying the public contact, pitch, and share link works on desktop and mobile.

### Error telemetry tests

- controlled failures at every workflow stage create correlated `app_error_events` rows;
- provider/OpenAI request IDs and workflow IDs are preserved;
- credentials and private bodies are scrubbed;
- logging failure does not mask the original failure;
- partial research and transaction rollback are distinguishable;
- retry attempts preserve trace lineage and idempotency; and
- a production acceptance query can identify exact song, stage, code path, release version, and retry safety without reconstructing browser state.

### Video One end-to-end acceptance

Using a real production-like artist workspace:

1. ask whether a song releasing in 14 days is ready;
2. resolve the correct song without fixture data;
3. receive evidence-backed foundation and campaign states;
4. receive a defensible keep/move recommendation;
5. preview every affected and preserved deadline;
6. approve the exact date change;
7. receive a persisted receipt;
8. refresh and confirm the date and mission remain correct; and
9. inspect central telemetry to confirm no hidden terminal failures occurred.

Video One is ready to record only when this flow succeeds without mocks, manual database intervention, duplicate missions, fabricated contacts, or hidden partial writes.

### Release-success infrastructure acceptance

After the playlist, press, and document increments:

1. start playlist or press research from the same song conversation;
2. receive a source-backed shortlist with verified public contact routes;
3. create a canonical EPK or tailored pitch;
4. confirm the document appears in Files and the share-package selector;
5. prepare a target-specific share package without sending externally; and
6. inspect central telemetry to confirm no hidden terminal failures occurred.

This second acceptance flow supports the additional playlist, press, and EPK video angles without changing the Video One rescheduling story.

## Implementation increments

### Increment 1: Release mission foundation

- evolve the existing mission pattern;
- establish operational release-plan truth;
- add release-relative schedule bindings;
- implement deterministic preview and atomic approval; and
- add correlated telemetry to every new boundary.

### Increment 2: Honest release-success assessment

- expand the focused release reader;
- separate foundation, campaign, unknown, and not-applicable states;
- connect existing assets, rights, documents, mission, and delivery facts; and
- add lightweight conversational clearance declarations.

### Increment 3: Chat-native Video One artifact

- implement evolving artifact states;
- connect activity to real tool events;
- add recovery-plan, approval, receipt, retry, and stale-state behavior; and
- verify mobile layout and refresh persistence.

At the end of Increment 3, Video One can be recorded.

### Increment 4: Playlist and press opportunity research

- add intent-scoped research and verification tools;
- normalize, deduplicate, rank, and persist opportunity briefs;
- preserve public citations and contact provenance;
- exclude unsafe or unverifiable recommendations; and
- support manual outcome tracking.

### Increment 5: EPK and target-package workflow

- create and version canonical documents through Manager;
- auto-link documents to song and mission;
- surface them in Files;
- prepare target-specific share packages; and
- return copyable contacts, pitches, and submission links.

### Increment 6: Hardening and release evaluation

- run database, contract, UI, end-to-end, research-quality, and telemetry tests;
- test representative upcoming and mid-level artist scenarios;
- inspect error fingerprints and controlled failures;
- deploy behind a feature flag; and
- enable broadly only after production-like Video One acceptance passes.

At the end of Increment 5, the same production foundation can support the playlist, press, EPK, and package-preparation video variants.

## Future extensions deliberately deferred

- approved email sending;
- form submission automation;
- reusable relationship/contact history;
- email reply and open tracking;
- automated audio technical QC;
- automated sample detection;
- label-scale approval chains;
- radio, sync, physical-product, tour, and international campaign modules;
- programmatic tool calling or parallel research agents; and
- a dedicated observability dashboard or alerting system.

The V1 structures can support these additions without changing the core relationship among song, Release Success Mission, opportunity, canonical document, share package, and Manager conversation.
