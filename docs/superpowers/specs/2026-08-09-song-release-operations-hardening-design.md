# Song Release Operations Hardening

## Product standard

The release workspace must behave as one continuous system. A file upload, rights edit, or collaborator confirmation is not an isolated form submission: it is durable song state, mission activity, and current Manager context. The interface must acknowledge the action immediately, preserve the user's place, and make the resulting state visible without a reload or a second explanation.

## Existing primitives to keep

- Song Workspace and its Files, Details, Rights, and Overview tabs.
- `uploaded_files`, `music_assets`, `music_splits`, contributor and confirmation tables.
- `operating_events` and existing song-to-mission artifact links.
- The resumable TUS upload path and protected audio-analysis worker contract.
- The focused-song Manager conversation and its existing read tools.

No parallel release wizard, upload product, rights dashboard, or second activity system is introduced.

## End-to-end behavior

### 1. Conversation to Files

The release receipt's **Add files** action opens the exact song on Files. The persistent song subject's **Open** action opens Overview. Navigation intent is consumed once, so later repository refreshes cannot replay it and move the user between tabs.

### 2. Upload

Before submission, the modal shows the chosen filename and size. During upload it becomes a live transfer surface with:

- an accessible progress bar and numeric percentage for resumable uploads;
- plain-language phases: preparing, uploading, saving to the song, complete;
- transferred bytes where available;
- a clear instruction to keep the window open;
- an explicit failure state that preserves the selected file and offers retry.

On success, the modal closes, Files stays active, and the uploaded row appears from the canonical repository refresh. The success event is linked to the song's mission when one exists.

### 3. Analysis

The existing protected audio-analysis worker remains the only authority for BPM, musical key, and duration evidence. Upload completion queues analysis immediately as well as through the recovery cron. The UI and Manager must distinguish uploaded, analysis pending, analysis complete, and analysis unavailable; they must never invent detected metadata.

Production currently has no `AUDIO_ANALYSIS_URL`, so this work will make the lifecycle truthful and immediately triggerable but will not fabricate BPM/key. Enabling actual detection requires a supported analyzer endpoint and credential.

### 4. Manager awareness

Every focused-song Manager turn receives a bounded, current subject snapshot containing assets, rights totals, analysis evidence, and recent song activity. If the artist says they uploaded or changed something, the Manager must read the exact current subject before answering. The upload's operating event also carries the linked mission ID, making it visible in mission activity.

### 5. Rights and splits

Rights uses one hierarchy:

- concise state and confirmation copy;
- one allocation summary for publishing and master shares;
- the contributor ledger;
- one contextual next action.

The add form disappears when both allocations total 100%. To change a full allocation, the user removes a contributor first. Client validation and a database trigger reject totals above 100%, including concurrent writes. Mutations await persistence, preserve the Rights tab, and refresh the ledger before clearing form state. Sending confirmation links is shown only when the proposal is sendable; a disabled duplicate action is not rendered.

### 6. Public confirmation

Load and confirm endpoints are public only at the gateway. They authorize exclusively through high-entropy, hashed, expiring capability tokens and use service-role database access. Required service-role table grants are explicit. Invalid tokens return a useful 404/410 rather than a generic 500, and valid recipients can load and submit without an app session.

## Failure behavior

- Upload failure stays in context and retains the file for retry.
- A failed rights mutation leaves entered values intact and shows one error.
- A confirmation-send failure does not falsely mark all collaborators pending in the browser first.
- Analysis absence is described as unavailable/pending, never completed.
- Refreshes update canonical data without resetting the active song tab.

