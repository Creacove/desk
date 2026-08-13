# Manager Conversation UI Overhaul Design

**Date:** 2026-08-13

## Outcome

The Manager's Office and Manager conversation become the visual center of the application. The redesign adopts the restraint, reading rhythm, progressive disclosure, and calm state communication associated with ChatGPT while retaining Ordersounds' existing product identity, routes, data contracts, and workflows.

This is a presentation overhaul. It does not add product capabilities, backend behavior, storage models, or navigation destinations.

## Product principles

1. **Conversation is the primary surface.** Ordinary Manager answers read as prose, not as dashboard cards.
2. **Every element earns its place.** The interface shows only what is needed to understand the current surface and take the next action.
3. **One turn, one outcome.** Backend objects created by one Manager turn are presented as one artist-facing result unless they represent genuinely independent outcomes.
4. **Progress evolves in place.** Loading, tool activity, completion, and recovery occupy one location instead of appending new announcements.
5. **Canonical destinations remain canonical.** Files manages files, Missions manages missions, tasks remain tasks, and substantial release artifacts keep their existing workflows.
6. **Hierarchy comes from typography and spacing.** Borders, accent color, icons, shadows, labels, and uppercase text are used sparingly.
7. **Desktop and mobile preserve the same reading order.** Responsive changes alter density and controls, not meaning.

## Scope

### Included

- Manager's Office entry composer and conversation history;
- open conversation header, context, message rhythm, activity, questions, artifacts, failures, and composer;
- visual normalization of mission, task, song-workspace, task-draft, release-success, opportunity, and decision-package presentation;
- responsive margins, widths, type scale, spacing, touch targets, safe-area behavior, and reduced motion;
- UI-level suppression and grouping of duplicate `createdWork` results;
- preservation of existing routes from results to Files, Music, Missions, tasks, and decision packages;
- focused component and browser regression coverage.

### Excluded

- chat file upload, drag-and-drop, attachment staging, or an attachment data model;
- a file preview inspector or new media player;
- conversation search, filtering, grouping, pinning, renaming, archiving, or a conversation switcher;
- a new document editor, split-pane canvas, or document version behavior;
- changes to Manager prompts, response wording, stream events, persistence, repositories, Supabase, or edge functions;
- changes to the application-wide sidebar or primary information architecture.

If a Manager result asks the artist to add files, its action opens the existing song Files tab. The artist uploads through the existing Files experience. The conversation does not pretend to support an upload flow that the product does not currently have.

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

The composer uses one contained surface with a generous text area and a single send control. It does not add suggestions, tools, file attachment, or mode selectors in this increment.

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

Before Manager text begins, one low-emphasis row shows the latest useful existing activity label with a subtle animated indicator. During streaming, the same row sits below the partial Manager text. Completed historical steps are available through the existing activity disclosure only when the current run provides them.

Rules:

- one active status is visible at a time;
- activity wording comes from the existing run and step labels;
- no fake percentage, elapsed-time promise, or invented intermediate step;
- the activity row collapses when the final result is present;
- failure replaces activity in the same turn and preserves the existing retry action;
- animation respects `prefers-reduced-motion`.

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

- Questions use one contained form because they require action.
- Labels use sentence case.
- Inputs retain current answer kinds, options, recommendation helper, `I'm not sure`, validation, and submission behavior.
- The form has one primary submit action.
- When answered, the form collapses to a compact confirmation summary using existing context answers, with no new edit behavior unless the application already supplies it.
- The resulting Manager response and artifacts follow directly below in chronological order.

## Composer

The existing conversation composer remains fixed to the conversation viewport and keeps its textarea, Enter-to-send, Shift+Enter, pending lock, error display, safe-area support, and scroll-follow behavior.

Visual changes:

- centered on the same `48rem` conversation grid;
- floating contained surface rather than a full-width footer bar;
- neutral border, theme background, moderate radius, and minimal elevation;
- 16px mobile outer margin, 24px at small desktop, and correct left offset for the existing application rail;
- textarea starts at one line and grows to the existing maximum height;
- one circular send action;
- no attachment button, tool menu, mode selector, or other inactive control;
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
- `ManagerMessage.tsx`: artist and Manager message presentation, rich body, questions, retry;
- `ManagerArtifacts.tsx`: created-work normalization and compact task, mission, song, draft, and decision results;
- existing `ReleaseSuccessArtifact.tsx` and `OpportunityArtifact.tsx`: preserve behavior and adopt shared visual grammar;
- `ManagerScreens.tsx`: re-export the public screens and retain unrelated investigation/decision screens until separately redesigned.

No server, repository, schema, or type change is required for the visual overhaul.

## Accessibility

- Preserve semantic buttons, headings, forms, labels, lists, and `aria-expanded`.
- Keep focus visible in both themes.
- Status changes use a restrained live region without announcing every streamed token.
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
- Context questions remain attached and collapse after submission.
- Activity uses one visible current status and yields to result or failure.
- Existing release approval, research, draft expansion, retry, and navigation actions still work.
- Composer remains usable and does not cover the transcript.

### Responsive and visual checks

Check at minimum:

- 320×568;
- 390×844;
- 768×1024;
- 1280×800; and
- 1440×900.

At each size verify header, horizontal margins, readable measure, long titles, long artist messages, expanded questions, expanded drafts, loading, failure, grouped result, release decision, research result, composer growth, keyboard focus, dark theme, and reduced motion.

### Regression boundary

The existing Manager stream protocol, conversation persistence, title stability, scroll following, Files route, Mission route, task draft content, approval repository boundary, opportunity actions, and application navigation must remain unchanged.

## Acceptance criteria

The redesign is accepted when:

1. the Manager's Office reads as a quiet entry point with a sparse conversation list;
2. an open conversation reads primarily as dialogue rather than a stack of cards;
3. one Manager turn never announces the same created outcome multiple times;
4. loading, completion, and failure visibly replace one another in the owning turn;
5. every artifact presents only the information required for the next decision, with details disclosed on request;
6. existing actions still reach Files, Music, Missions, tasks, drafts, approvals, and research workflows exactly as before;
7. mobile and desktop share the same hierarchy without overlap or horizontal overflow; and
8. no new application feature or backend contract was introduced to accomplish the overhaul.
