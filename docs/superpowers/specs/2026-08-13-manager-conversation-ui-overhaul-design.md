# Manager Conversation UI Overhaul Design

**Date:** 2026-08-13

## Outcome

The Manager's Office and Manager conversation become the visual center of the application. The redesign adopts the restraint, reading rhythm, progressive disclosure, and calm state communication associated with ChatGPT while retaining Ordersounds' existing product identity, routes, storage model, and workflows.

This is primarily a presentation overhaul with two deliberately narrow workflow improvements: canonical song-file upload from an already song-scoped conversation, and sequential answering of existing preset Manager context questions through the conversation composer. It does not add temporary chat storage, a second file model, or a new navigation destination.

## Product principles

1. **Conversation is the primary surface.** Ordinary Manager answers read as prose, not as dashboard cards.
2. **Every element earns its place.** The interface shows only what is needed to understand the current surface and take the next action.
3. **One turn, one outcome.** Backend objects created by one Manager turn are presented as one artist-facing result unless they represent genuinely independent outcomes.
4. **Progress evolves in place.** Loading, tool activity, completion, and recovery occupy one location instead of appending new announcements.
5. **Canonical destinations remain canonical.** Files manages files, Missions manages missions, tasks remain tasks, and substantial release artifacts keep their existing workflows.
6. **Hierarchy comes from typography and spacing.** Borders, accent color, icons, shadows, labels, and uppercase text are used sparingly.
7. **Desktop and mobile preserve the same reading order.** Responsive changes alter density and controls, not meaning.
8. **Capability follows context.** A control appears only when the current conversation has the durable domain context required to complete the action.

## Scope

### Included

- Manager's Office entry composer and conversation history;
- open conversation header, context, message rhythm, activity, questions, artifacts, failures, and composer;
- visual normalization of mission, task, song-workspace, task-draft, release-success, opportunity, and decision-package presentation;
- responsive margins, widths, type scale, spacing, touch targets, safe-area behavior, and reduced motion;
- UI-level suppression and grouping of duplicate `createdWork` results;
- preservation of existing routes from results to Files, Music, Missions, tasks, and decision packages;
- canonical file upload from conversations already attached to a song, using the existing Music asset repository, storage, categories, and progress events;
- sequential, composer-based answering of the existing preset Manager context-question array without a Manager round trip between questions;
- focused component and browser regression coverage.

### Excluded

- uploading from a general Manager conversation, a project-scoped conversation, or the Manager's Office composer;
- a song picker, song-creation flow, disabled upload affordance, or "choose a song first" prompt inside a general conversation;
- temporary chat uploads, duplicate file records, or a second attachment storage system;
- a new file preview inspector or media player beyond reusing an existing preview when one is already available;
- conversation search, filtering, grouping, pinning, renaming, archiving, or a conversation switcher;
- a new document editor, split-pane canvas, or document version behavior;
- unrelated changes to Manager prompts, stream events, persistence, repositories, Supabase, or edge functions;
- changes to the application-wide sidebar or primary information architecture.

The upload improvement may extend the existing Manager message input and message metadata only enough to persist references to canonical `music_assets`. It must not create a conversation-only file entity or move file ownership away from the song.

## Benchmark interpretation

The redesign borrows interaction principles rather than reproducing another product literally.

- ChatGPT demonstrates a quiet reading column, unboxed assistant prose, a composer as the visual anchor, and restrained disclosure of work in progress.
- OpenAI Canvas establishes a boundary between conversation and substantial editable work, but this increment does not add a new canvas because the application already owns documents through song Files and existing editors.
- Claude Artifacts demonstrates that reusable work should be visually distinct from prose, but Ordersounds artifacts remain compact because their canonical details already live elsewhere in the application.

The result should feel designed with the same discipline, not visually copied.

## Manager's Office

### Page hierarchy

The Office contains two primary regions:

1. a new-conversation composer;
2. the existing conversation list.

Mission Genesis appears only when its existing result, question, pending, or error state exists. It becomes a compact contextual block near the composer rather than a competing dashboard panel.

### New-conversation composer

The composer is the page's visual focal point. It uses the existing text input, send behavior, pending state, and error handling. The copy remains grounded in the existing Manager capability.

The composer uses one contained surface with a generous text area and a single send control. It does not add suggestions, tools, file attachment, or mode selectors. File upload is never available from the Manager's Office because no song is attached there.

### Conversation list

The list is intentionally sparse. Each row shows only:

- conversation title; and
- existing `lastUpdate` text when available.

Rows do not show summaries, previews, related songs, missions, categories, icons, decorative badges, or ordinary status. The user opens a conversation to see its context.

The section has one quiet label: **Conversations**. It does not invent date grouping because `lastUpdate` is display text rather than a reliable timestamp. Rows are separated primarily by spacing and hover/focus treatment, not nested cards.

The entire row remains the existing conversation button. Keyboard focus is visible, the title truncates safely, and the timestamp never displaces the title.

### Empty and pending states

- With no conversations, the list region is absent; the composer is sufficient.
- While starting a conversation, the existing pending copy appears immediately below the composer.
- Existing errors appear in the same location with readable contrast and no large alert card unless the Mission Genesis recovery state requires contained controls.

## Conversation shell

### Header

The conversation uses a compact sticky header containing:

- back to Manager's Office;
- the conversation title; and
- no eyebrow, punctuation, conversation dropdown, or decorative status.

The title is one line on mobile and may use up to two lines on desktop. The global application rail remains unchanged.

### Reading column and margins

The conversation uses a centered reading column with a maximum width of `48rem` (768px).

- Mobile below 640px: 16px horizontal page padding.
- Small desktop/tablet from 640px: 24px horizontal padding.
- Large desktop from 1024px: 32px horizontal padding around the centered column.
- Manager prose uses a narrower readable measure inside the column only when long line length requires it; artifacts may use the full column.

The top of the transcript has 24px clearance below the compact header on mobile and 32px on desktop. Major turns use approximately 32px vertical separation; elements within one turn use 12–16px.

### Context

Existing song and task context remain visible because they explain what the Manager is acting on. They are reduced to quiet, single-row context attachments:

- icon or thumbnail only when already available;
- title;
- one short existing stage or task label when useful;
- existing open/back action.

They do not use uppercase headings, descriptive paragraphs, accent-filled panels, or shadows. Context appears once above the transcript and is not repeated in result artifacts.

## Message grammar

### Artist messages

Artist messages remain right aligned with a soft neutral fill. They have no avatar, speaker label, border, shadow, or tail decoration. Maximum width is 85% on mobile and 75% on desktop.

### Manager messages

Manager messages are full-width unboxed prose. They have no repeated avatar, sparkle icon, `Manager` label, background, border, or shadow.

Existing rich text formatting remains supported. Paragraph spacing, lists, links, and headings are normalized for a conversational reading scale. The body uses the existing UI font and theme tokens.

### Turn ownership

Every visible question, activity state, created-work result, release artifact, research artifact, error, or recovery action is rendered directly beneath the Manager message that owns the current outcome.

The existing data does not link every conversation-level artifact to a message. The UI therefore applies a deterministic presentation rule without changing data:

1. message-level `createdWork` stays with its message;
2. conversation-level fallback `createdWork` appears beneath the last Manager message only when no message already contains created work;
3. the current release-success artifact, opportunity artifacts, and decision package appear beneath the last Manager message;
4. active-run activity appears beneath the streaming Manager message, or after the last artist message before Manager text exists.

No artifact summary is rendered after the transcript as a detached footer.

## Activity and loading

The UI communicates observable work, not hidden chain-of-thought.

The current implementation repeats Manager identity and progress through a Manager icon, multiple `AppThinkingOrb` instances, a `BorderBeam`, an activity card, and expandable step cards. The overhaul replaces these with one inline activity state occupying the same turn and position as the forthcoming Manager answer.

### Foreground Manager work

Before Manager text begins, render one low-emphasis row:

> `AppThinkingOrb` Reviewing Summer's files…

- Use the existing theme-aware `AppThinkingOrb` exactly once at 16–18px.
- Show one 12–13px sentence-case status label derived from the latest useful existing run or tool event.
- Render no Manager avatar, speaker label, containing card, border, background, shadow, `BorderBeam`, second spinner, or decorative progress treatment.
- Replace the status sentence in place as existing run events advance. Historical steps never stack in the transcript.
- Use plain, user-understandable actions such as `Reviewing Summer's files…`, `Checking release requirements…`, or `Preparing your release plan…`. Do not expose tool names, internal prompts, hidden reasoning, or implementation vocabulary.

When the first Manager text arrives, the answer takes over that exact turn position. The activity indicator fades out rather than remaining above or below the response. If an existing tool event genuinely occurs between streamed text segments, the same single activity row may temporarily appear after the current prose and must disappear when streaming resumes.

Completion leaves no permanent thinking receipt, duration, step count, or default `View activity` control. The answer or compact result is the durable record of what happened.

### Durable background work

Do not label ordinary streamed Manager work as background work. Conversation loading remains foreground unless the existing application has a durable run that can continue after navigation and report completion independently.

Existing durable processes continue through the application's existing activity center and completion notifications. This overhaul does not add conversation-list spinners, reconnect controls, parallel Manager runs, or new background execution semantics.

When a Manager action starts existing durable work, the owning turn may confirm that it started and link to the canonical destination. Ongoing global progress remains in the existing activity system rather than being duplicated inside chat.

### Other progress states

- Song file upload uses its compact filename row and real `MusicUploadProgress`; it does not also show the Manager orb.
- Guided context questions have no loading state between preset questions. The Manager activity state begins only after the complete answer set is submitted.
- Pending artifact actions change only the action that was invoked. They do not start a second conversation-level loader.
- The full-screen branded application loader remains separate and must not lend its logo tile, large orb, floating motion, or `BorderBeam` treatment to conversation loading.

### Failure and accessibility

Failure replaces activity in the same Manager turn with one plain-language message and the existing retry action. No spinner or animated border remains after failure.

Rules:

- one active status is visible at a time;
- activity wording is normalized from existing run and step labels;
- no fake percentage, elapsed-time promise, or invented intermediate step;
- the activity row is removed when prose, result, or failure replaces it;
- the status uses one polite live region and does not announce every label change or streamed token;
- under `prefers-reduced-motion`, the orb is visually static while text updates continue.

## Inline result system

### Shared visual grammar

All created-work results use the same restrained anatomy:

1. optional small state icon;
2. artist-facing title;
3. one supporting line when necessary;
4. one primary action;
5. optional quiet secondary action or disclosure.

Cards use a thin neutral border and theme background only when containment aids comprehension. They do not use colored header bars, stacked borders, decorative shadows, uppercase announcement labels, or a full-width button footer.

### UI-level result grouping

`createdWork` is normalized for presentation, not mutated.

When a turn creates a song workspace, mission, and its first task for the same subject, render one result:

> **Summer is ready for release planning**
> Mission and first task are ready
> **Add release files** · View mission

The existing music item, mission, and task identifiers remain available to the existing callbacks. The music-item action routes to Files; the secondary action routes to the mission.

When multiple missions are genuinely independent, one contained result may list their titles as compact rows. It does not repeat full mission descriptions and nested task bodies in the transcript. Each mission retains its existing open action.

Standalone tasks use one compact task result. Repeated objects with the same type and identifier are shown once.

### Task drafts

Task drafts remain collapsed by default. The compact artifact shows:

- document icon;
- title;
- `Draft` or existing saved/review state;
- short plain-text preview;
- existing open/close disclosure;
- existing task navigation when available.

Expanding continues to reveal the existing formatted draft inline. No new editor is introduced.

### Release Success

`ReleaseSuccessArtifact` keeps all existing assessment, preview, approval, receipt, retry, song, and mission behavior. Its presentation changes from a dashboard to an evolving conversational decision/result.

- The collapsed/default view states the conclusion and one next action.
- Detailed checks remain behind the existing review/disclosure interaction.
- Approval-required states remain expanded enough to show the exact consequential change before approval.
- Applied and failed states replace the prior state in the same artifact.
- Internal terms such as foundation, campaign, enum values, and unknown are not promoted as top-level visual categories. Existing evidence remains available in details where required.

### Opportunity research

`OpportunityArtifact` keeps the existing shortlist, watchlist, exclusions, source links, pitch preparation, outcome recording, Files navigation, and retry behavior.

The default view shows the strongest actionable result and total relevant matches. Detailed target lists and evidence remain behind disclosure. The artifact does not display three equally weighted metric tiles or all target detail at once.

### Decision packages

The existing decision package appears in the owning Manager turn as a compact result with title, one-line summary, and existing open action. It is not a detached card after the transcript.

### Problems

Failures use ordinary language, one recovery action, and an optional support reference already supplied by the existing error. Red is reserved for the failed state or destructive consequence, not the entire surface.

## Context questions

Existing Manager context questions remain attached to the message that asked them.

The transcript does not render a second form. When the latest unresolved Manager message contains `contextQuestions`, the existing composer changes into a guided answer mode. The Manager's prose remains in the transcript; the active question and its controls occupy the familiar composer surface.

### Preset sequence

All questions are delivered in the existing Manager response before answering begins. The client holds that complete array and advances through it locally.

- Show one question at a time in the supplied order.
- Display quiet position text such as `1 of 3` and minimal progress dots.
- Moving forward or back never starts a Manager run, displays reasoning, or makes a network request.
- Preserve completed answers while navigating between questions.
- Submit one existing `contextAnswers` payload only after the last question is complete.
- While guided answering is active, ordinary free chat is replaced rather than shown as a competing composer.

### Input behavior

The active control is derived from the existing `answerKind`:

- `single_select`: render compact choice buttons; selecting one advances immediately;
- `multi_select`: render toggle choices and a Continue action;
- `short_text`: use the composer text field and a Continue action;
- `money_range`: use a text field with appropriate currency/range guidance and a Continue action, without inventing a rigid numeric schema;
- `Something else`, when offered or provided as a standard fallback for a select question, switches that question to free-text entry;
- `recommendedAnswer` appears as a choice marked `Recommended`, with `recommendationReason` available as quiet supporting text rather than a separate card;
- `I'm not sure` remains a low-emphasis answer that preserves the current semantic instruction for the Manager to use its best recommendation and state the assumption.

Enter submits the current written answer; Shift+Enter adds a line when multiline text is appropriate. Back returns to the preceding question. The final primary action reads `Send answers`; earlier written and multi-select steps use `Continue`. Single-select answers auto-advance unless the selected option requires free text.

### Completion and recovery

On final submission, send every answer together through the existing `contextRequestId` and `contextAnswers` contract. The artist message uses a readable answer summary instead of the internal placeholder `Context answers for Manager mission decision.` The composer returns to ordinary chat while the Manager responds.

The original question area collapses in place to a quiet summary such as `3 answers provided`. The resulting Manager response and artifacts follow in chronological order. If submission fails, retain the complete local answer set, return to the final step, show the existing error in the composer, and offer `Try again`; never force the artist to re-enter previous answers.

## Song-scoped file upload

File upload exists only when `conversation.musicSubject.type === "music_item"`. This requirement is structural, not an error state.

- General conversations expose no attachment button, disabled control, song selector, explanatory tooltip, or upload menu.
- Project-scoped conversations also expose no song-file upload because the existing canonical upload API requires a music item.
- A song conversation opened from Music exposes one quiet attachment control in its composer.
- When an existing flow creates a song and attaches it to the active conversation, the attachment control appears after that durable link is confirmed.
- The conversation never silently changes its subject in response to an upload attempt.

### Upload interaction

The attachment control is a paperclip with the accessible label and tooltip `Add files to {song title}`. It opens the native file picker directly. Selected files enter a compact staging area above the text row inside the composer.

Each staged row shows filename, inferred or selected existing asset type, progress or state, and remove/retry where applicable. Reuse the current Music upload categories, validation, resumable behavior, and `MusicUploadProgress` phases. Ask for classification only when the existing resolver cannot determine a safe asset type; do not add a general-purpose metadata form.

Upload writes directly through `MusicRepository.uploadAsset(musicItemId, ...)`. The resulting object is a canonical song asset and appears in the existing Files surface. The conversation stores only the asset reference and enough display metadata to render the attachment after refresh.

Send is unavailable while a selected file is preparing, uploading, finalizing, failed without resolution, or awaiting required classification. The artist may type during upload. Removing a staged file detaches it from the pending message; once a canonical upload has completed, removal from the draft must not silently delete the asset from Files.

After send, attachments render as restrained rows beneath the artist message, not as Manager results or announcement cards. Selecting an attachment uses an existing preview/access route when available and otherwise opens the song's Files destination. `Open in Files` remains the canonical secondary route.

## Composer

The existing conversation composer remains fixed to the conversation viewport and owns three mutually exclusive modes:

1. ordinary chat;
2. guided context answering; and
3. ordinary song chat with optional staged file attachments.

It keeps its textarea, Enter-to-send, Shift+Enter, pending lock, error display, safe-area support, and scroll-follow behavior. Mode changes occur within one stable surface so the user does not lose spatial context.

Visual changes:

- centered on the same `48rem` conversation grid;
- floating contained surface rather than a full-width footer bar;
- neutral border, theme background, moderate radius, and minimal elevation;
- 16px mobile outer margin, 24px at small desktop, and correct left offset for the existing application rail;
- textarea starts at one line and grows to the existing maximum height;
- one circular send action in ordinary chat;
- one paperclip only in a conversation already attached to a song;
- no paperclip, disabled upload control, tool menu, song selector, or mode selector in every other conversation;
- guided-answer controls replace the ordinary text row until the preset sequence is submitted or resolved;
- the existing verification note may remain only if it is visually quiet and does not increase composer height materially.

The transcript tail reserves the measured composer height plus safe-area clearance so activity and results are never covered.

## Responsive behavior

### Mobile

- Compact sticky header with back control and truncated title.
- 16px transcript margins.
- Context attachments span the reading width.
- Artist messages use at most 85% width.
- Artifact actions wrap or stack with a minimum 44px touch target.
- Dense details remain collapsed by default.
- Guided questions remain inside the composer, keep the active option and primary action above the keyboard, and never open a full-screen form.
- Song upload progress expands the composer upward without covering the latest transcript turn; long staging lists scroll within a bounded region.
- Fixed composer clears the application mobile navigation and device safe area.
- No horizontal scrolling at 320px width.

### Desktop

- Existing application rail remains visible.
- Conversation content stays centered rather than filling the available canvas.
- Composer aligns exactly with the reading column.
- Artifacts may use the full 768px column; prose retains comfortable line length.
- Hover states never carry information unavailable by keyboard or touch.

## Visual language

### Typography

- Use existing application fonts and theme variables.
- Conversation body: 15–16px with approximately 1.6 line height.
- Artifact title: 14–15px semibold.
- Supporting text: 12–13px with readable contrast.
- Metadata: 11–12px, sentence case.
- Avoid uppercase tracking except for an exceptional compact system label where meaning would otherwise be unclear.

### Surfaces and color

- Page and Manager prose use the base background.
- Artist bubbles and secondary controls use subtle foreground tints.
- Neutral borders use existing foreground alpha tokens.
- Brand accent identifies a primary interactive emphasis, not every artifact.
- Success, warning, and error colors appear only when state meaning requires them.
- Shadows are limited to the floating composer and temporary overlays already present in the application.

### Motion

- Use short opacity/position transitions for new activity and result replacement.
- Do not animate historical messages on load.
- Do not use pulsing borders, decorative beams, hover lift, or large scale changes.
- Honor reduced motion.

## Component boundaries

The current `ManagerScreens.tsx` is too broad for reliable iteration. The UI overhaul may extract focused presentation components while preserving its public exports:

- `ManagerOfficeScreen.tsx`: Office composer, Mission Genesis presentation, sparse history;
- `ConversationWorkspace.tsx`: conversation shell, turn ordering, context, composer, scroll ownership;
- `ManagerMessage.tsx`: artist and Manager message presentation, rich body, resolved-question summary, attachments, and retry;
- `ManagerComposer.tsx`: ordinary chat, guided-answer sequence, song-scoped attachment staging, and composer-local errors;
- `managerContextFlow.ts`: pure question progression, answer normalization, validation, and final payload construction;
- `ManagerSongAttachments.tsx`: canonical song-asset selection, classification, upload progress, retry, and compact message rows;
- `ManagerActivity.tsx`: one inline `AppThinkingOrb`, normalized observable status text, replacement by prose/result/failure, and reduced-motion behavior;
- `ManagerArtifacts.tsx`: created-work normalization and compact task, mission, song, draft, and decision results;
- existing `ReleaseSuccessArtifact.tsx` and `OpportunityArtifact.tsx`: preserve behavior and adopt shared visual grammar;
- `ManagerScreens.tsx`: re-export the public screens and retain unrelated investigation/decision screens until separately redesigned.

The question redesign uses the existing context request and answer contracts. Song upload reuses the existing Music repository and canonical asset storage. A narrow Manager message contract and persistence extension is allowed only if required to associate uploaded asset IDs with the artist message across reloads.

## Accessibility

- Preserve semantic buttons, headings, forms, labels, lists, and `aria-expanded`.
- Keep focus visible in both themes.
- Status changes use a restrained live region without announcing every streamed token.
- Guided-question position and validation are announced without moving keyboard focus unexpectedly. Auto-advance after a single choice moves focus to the next question heading or first control.
- Choice buttons expose selected state with `aria-pressed`; progress is not communicated by dots alone.
- Upload progress has a text state and filename in addition to any progress bar.
- Loading indicators have accessible text and do not rely on motion.
- Color is never the only state signal.
- All touch controls are at least 44px where layout permits and never below 40px.
- Verify contrast in light and dark themes.

## Verification

### Component behavior

- Office rows render title and optional time only.
- Ordinary Manager messages have no repeated avatar, label, or card surface.
- Artist messages retain clear authorship through position and fill.
- Conversation-level artifacts render under the last Manager turn, never after the transcript.
- Song workspace, mission, and first task collapse into one result with existing Files and Mission callbacks.
- Independent missions remain individually reachable without full nested descriptions.
- Context questions activate one sequential composer flow, advance locally without Manager runs, submit once, and collapse after submission.
- Every existing answer kind renders the appropriate choice, multi-choice, free-text, or money-range control.
- Failed final answer submission preserves every completed answer and can be retried.
- General and project conversations contain no upload affordance.
- Song conversations expose upload, create canonical song assets, block send until staged files are ready, and preserve message attachment references across reloads.
- Removing a completed staged upload from a draft does not delete it from Files.
- Activity uses exactly one small `AppThinkingOrb` and one current status with no identity tile, `BorderBeam`, container, duplicate spinner, or stacked step cards.
- The activity turn is replaced in place by streamed prose, result, or failure and leaves no completed loading receipt.
- Existing durable background jobs remain represented by the activity center rather than duplicated in the conversation or conversation list.
- Existing release approval, research, draft expansion, retry, and navigation actions still work.
- Composer remains usable and does not cover the transcript.

### Responsive and visual checks

Check at minimum:

- 320×568;
- 390×844;
- 768×1024;
- 1280×800; and
- 1440×900.

At each size verify header, horizontal margins, readable measure, long titles, long artist messages, every guided-question input kind, back/forward progression, failed answer retry, song attachment staging and progress, expanded drafts, loading, failure, grouped result, release decision, research result, composer growth, keyboard focus, dark theme, and reduced motion.

### Regression boundary

The existing Manager stream protocol, title stability, scroll following, Files route, Mission route, task draft content, approval repository boundary, opportunity actions, and application navigation must remain unchanged. Persistence may add only durable artist-message references to already canonical song assets.

## Acceptance criteria

The redesign is accepted when:

1. the Manager's Office reads as a quiet entry point with a sparse conversation list;
2. an open conversation reads primarily as dialogue rather than a stack of cards;
3. one Manager turn never announces the same created outcome multiple times;
4. loading, completion, and failure visibly replace one another in the owning turn;
5. every artifact presents only the information required for the next decision, with details disclosed on request;
6. existing actions still reach Files, Music, Missions, tasks, drafts, approvals, and research workflows exactly as before;
7. mobile and desktop share the same hierarchy without overlap or horizontal overflow;
8. general conversations remain simpler because upload controls exist only after a durable song is attached;
9. preset Manager questions are answered one at a time through the same composer with no intermediate Manager run; and
10. conversation uploads reuse canonical song Files rather than introducing temporary or duplicate storage; and
11. Manager work is communicated by one restrained, existing design-system indicator that evolves in place and disappears when the outcome arrives.
