# Manager + Song System V2

Status: implementation source of truth

## Product invariant

Desk has one music domain. Overview, Files, Details, Rights, Share and Manager are projections/controllers over that domain. Conversation text, Manager memory, Manager Read, packets and generated outputs are never competing sources of current song truth.

For an attached song, Manager is the control plane: it receives a fresh current-song snapshot before it speaks and can execute safe structured writes. For an unattached conversation, Manager remains artist/workspace scoped and must never mutate an arbitrary song without explicit subject resolution.

## Truth hierarchy

1. Canonical structured music state
2. Current verified external/provider facts
3. Explicit current-turn user facts
4. Durable artist/team memory
5. Conversation history
6. Older derived Manager Reads and outputs

A lower level can never override a newer/current higher-level fact.

## Canonical domains

### Identity and release
- `music_items.title`
- lifecycle
- canonical planned release date
- released state

### Identifiers
- `music_identifiers`
- ISRC is not an upload prerequisite
- an unreleased song can legitimately have no ISRC until distribution
- once assigned, the same recording keeps the same ISRC

### People
A contributor is a person identity shared by Credits and Rights.

Credit answers **what did this person do?**
Ownership answers **what do they own?**

A mixing engineer can have 0% publishing and 0% master while remaining fully credited. Zero is valid data, not missing data.

### Assets and documents
A file belongs to the song, not the screen where it was uploaded. Uploads from Manager, Files or Rights must immediately project everywhere relevant.

### Rights
Rights uses canonical contributors plus split relationships and confirmation state. Ownership changes require explicit confirmation. Sending split confirmation emails requires explicit external-action approval.

## Manager context

Every attached-song turn gets `ManagerSubjectSnapshot` before model reasoning. It includes at minimum:
- identity and lifecycle
- release date
- identifiers
- primary metadata
- assets
- canonical documents
- contributors and credits
- splits/rights/confirmations
- relevant opportunities/missions
- recent changes
- Manager Read last, marked as derived

`Manager Intelligence Packet` remains artist/workspace strategic intelligence. `memory_entries` stores durable preferences/history, not current release date, ISRC, split percentages or final-master presence.

## Manager writes

Use explicit domain commands instead of generic `manual_details` for structured facts.

Low-risk explicit facts can write directly:
- title/basic metadata
- initial release date
- ISRC/UPC after validation
- credits/roles when identity is clear
- safe lifecycle changes

Interpreted changes require concise confirmation when ambiguity exists.

High-impact changes always require explicit confirmation/permission:
- publishing/master ownership
- rights declarations
- clearances
- external emails/submissions/outreach
- destructive replacement
- operational release-date changes that move an active schedule

## Conversation interaction contract

### Question
Only genuine answer collection can take over the composer.
- single select
- multi select
- free text/date/money
- every finite choice set includes `Something else…`
- `Something else…` opens free text
- `Answer later` restores normal conversation when wired

### Workspace action
Actions such as Add ISRC, Review rights, Upload master are inline underneath the Manager turn that requested them. Never floating. Never encoded as fake questions in new turns.

### Artifact action
Actions on Manager-created work live inside the artifact and reveal progressively.

## Operation contract

Every async action has a durable operation key and lifecycle:
`pending -> running -> completed | failed | cancelled`

Examples:
- `prepare_pitch:<song>:<opportunity>`
- `send_split_confirmation:<split>:<revision>`
- `create_epk:<song>:<version>`

One operation key means one operation across rerenders, refreshes and retries. UI loading state remains until real completion or failure.

## Readiness contract

Readiness is lifecycle-aware.

Early production must not be blocked by ISRC, artwork or distributor delivery.

`uploaded` means the asset's presence is confirmed. It never automatically maps to `at_risk`. Risk requires evidence of an actual problem or conflict.

User-facing states should collapse to:
- Ready
- Needs attention
- At risk
- Not needed yet

Release Success is a derived view of canonical state, not its own truth store.

## UI contract

Keep the current simplified Desk design language.

Artifacts use one grammar:
- small semantic label/icon
- title
- one useful sentence
- one primary action
- optional secondary text action
- optional expanded detail

No nested dashboards inside conversation.

Playlist/press target accordion:
- collapsed: target + fit
- expanded: why it fits + one primary contextual action
- progressive actions: Prepare pitch -> Preparing -> View/Copy pitch -> Mark submitted -> result

Release artifact defaults to a compact list of actionable items. Diagnostic gate detail is secondary.

## Migration constraints

- One production Manager conversation renderer at completion.
- One shared backend turn engine for stream/non-stream transport at completion.
- Historical payload compatibility lives at one repository boundary, never scattered through React.
- Delete `ManagerScreensLegacy.tsx` after V2 renderer reaches parity.
- Delete workspace-action-as-context-question protocol after historical normalization is in place.
- Do not silently merge contributors globally by name.

## Required regression scenarios

- Upload ISRC/file/split sheet -> next Manager turn knows it.
- Confirm release date -> every surface agrees.
- Old memory/Manager Read cannot override current state.
- 0% contributor credit is valid and does not create a rights blocker.
- Ownership change requires confirmation.
- Split confirmation email updates Rights to awaiting; external confirmation updates Rights and Manager.
- 10 rapid Prepare Pitch taps create one operation.
- Loading state remains until work actually completes.
- Workspace actions are inline and persist until domain completion, not until the user merely sends another message.
- Released/catalog music never reopens pre-release blockers.
- ISRC is not required before the release workflow reaches distribution need.
- Uploaded final master is never labeled at risk merely because it was uploaded.
- Free conversation cannot mutate an arbitrary song without subject resolution.

## Definition of done

Given: `Tobi produced Dance and owns 10% publishing. Bola mixed it but owns nothing. September 18 is the release date. Use Final Mix 4 as the master. Send Tobi his split confirmation.`

Desk must resolve identities, update credits, preserve Bola at 0% ownership, confirm and commit Tobi's ownership change, update the canonical release date, designate the master, collect missing contact data only if required, request send permission, send the split confirmation, update Rights/Details/Files/readiness/Share inputs, and make the next Manager turn aware of the committed result. Opening any Song Room surface afterward must show the same truth.
