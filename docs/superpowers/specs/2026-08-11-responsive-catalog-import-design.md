# Responsive catalog import design

**Date:** 2026-08-11

## Problem

The Music catalog import dialog uses one centered desktop-card layout at every breakpoint. On narrow screens, the bounded card, fixed footer/header, and action rows create horizontal pressure and can hide Import/Choose controls. The import pipeline is connected, but the client currently treats a swallowed Manager Read failure as success and does not explicitly refresh the catalog before opening the imported record.

## Goal

Make catalog import feel reliable and premium on desktop and mobile:

1. The dialog never creates horizontal scrolling.
2. On mobile, the dialog is a full-height sheet with a fixed header/footer and one vertical scrolling content region.
3. Catalog and track actions remain visible without scrolling sideways.
4. Loading, import progress, and failure states are obvious and accessible.
5. A successful import refreshes the catalog before opening the new song/project.
6. A failed Manager Read keeps the dialog open with an actionable error instead of closing as if the import completed.
7. A long import does not block the rest of the Catalog workspace.

## Non-goals

- Do not redesign the Music library or other dialogs.
- Do not change Spotify edge-function contracts or catalog ordering.
- Do not add a new modal framework or multi-screen navigation.

## Design

`MusicImportDialog` keeps its selection state and becomes a full-height, edge-to-edge sheet below the small-screen breakpoint and a bounded centered card at desktop sizes. The header and footer are non-shrinking; the list/progress body is `min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain`. Row content uses `min-w-0` and shrink-safe action controls so title/meta text truncates rather than widening the modal.

The parent `MusicWorkspace` owns a single `catalogImportJob` while the dialog is open or backgrounded. The dialog enters the existing progress phase immediately, but exposes a `Continue browsing` action once the server request has started. Dismissing the sheet does not cancel the job: the Catalog library remains interactive and renders a compact live status notice with the title, current phase, and thinking orb. A completed job shows an `Open` action; a failed job shows the sanitized error and `Retry`.

The existing skeleton and `AppThinkingOrb` progress UI remain the feedback language. While the sheet is visible, its close control is disabled only for the short handoff needed to start the job; after that handoff, the user may continue browsing. Errors return to the selection view when the sheet is visible, remain in the status notice when backgrounded, and allow the same selection to be retried.

`onGenerateRead` returns the refreshed Music object or `null`. The import commit treats `null` as a failed read step. After both import and read succeed, `onDone` refreshes the Music list and then opens the returned subject. A refresh failure is surfaced as a non-blocking notice while keeping the imported subject navigable when possible.

## Verification

Add focused UI tests for:

- mobile-sheet and overflow-safe class contracts;
- catalog and track loading feedback;
- import progress disabling close and showing the selected title;
- backgrounding an in-flight import while the Catalog remains interactive;
- completion and retry actions in the persistent Catalog status notice;
- successful import/read refreshing the list before opening the subject;
- failed Manager Read leaving the dialog open with an alert.

Run the focused Music tests, the full Vitest suite, and the production build.
