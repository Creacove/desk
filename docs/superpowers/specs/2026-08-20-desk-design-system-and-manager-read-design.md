---
title: Desk design system and Manager's Read
date: 2026-08-20
status: approved-for-implementation
---

# Desk design system and Manager's Read

## Context

The authenticated artist desk currently presents several competing layout systems. Home uses an editorial reading scale, Catalog uses full-width ledger rows, detail pages use oversized hero headers, Manager conversations use a narrow reading column, and Settings uses a separate form system. The Home Manager's Read is the clearest example: it uses a full-width two-column grid, has an index-specific left-padding exception, and allows row height differences to create the appearance of inconsistent padding.

The implementation should make the desk feel like one premium artist-operations product. It should preserve the existing brand, content, navigation, and behavior while making the visual system intentional and repeatable.

## Design direction

The product is a light, editorial operations desk for artists and their teams. The direction is restrained and confident: generous whitespace is used to clarify hierarchy, not to fill the viewport; long-form management copy is treated as a reading surface; structural lists can use the available width, but prose is constrained.

The two design lenses are:

- Dieter Rams: remove arbitrary exceptions, make the system understandable, and use as little visual treatment as needed.
- Julie Zhuo: make each surface answer a clear user problem, create a predictable scan order, and use reusable patterns rather than page-specific decoration.

## Scope

This pass covers:

- The Home Manager's Read component and its responsive behavior.
- Shared width, spacing, typography, and action rules used by the inspected desk surfaces.
- Page and reading containers where the current full-width treatment creates poor hierarchy.
- Loading, empty, and updated-state presentation where blank space makes the interface feel unfinished.
- Mobile parity for the surfaces changed in this pass.

This pass does not change routes, navigation labels, data contracts, content meaning, authentication, or deployment configuration.

## Manager's Read design

Replace the current full-width two-by-two card grid with a centered briefing rail:

- The section header, Evidence action, dividers, and insight content share one left and right boundary.
- The rail is capped at approximately 1,040 to 1,120px on wide screens.
- Each insight has identical vertical padding and no index-specific padding exception.
- Each insight uses a stable metadata column for its number and label, plus a readable body column.
- Body copy is limited to a comfortable reading measure rather than expanding with the viewport.
- Horizontal rules separate insights within the rail, not across the entire page.
- At mobile widths, the number, label, and body collapse into a consistent vertical rhythm.

The component must not rely on neighboring content to determine perceived padding. Content height may vary, but the start and end rhythm of each row must remain predictable.

## Shared visual contract

- Body copy defaults to the readable Home scale: 16px with approximately 26px line-height.
- Page titles use one shared scale; detail titles may be larger but must use an explicit detail token.
- Section headings, metadata, labels, and buttons use shared tokens instead of local values.
- The primary action remains the brand purple. Secondary and tertiary actions use one neutral system.
- Touch targets remain at least 44px on mobile.
- The primary content cap is approximately 1,280px. Narrow reading content uses approximately 720px. Forms use approximately 900px.
- Full-bleed treatment is reserved for structural surfaces such as metric strips and catalog rows.
- Every async surface must show a meaningful loading, empty, error, or updated state.

## Implementation boundaries

Prefer shared primitives and explicit layout classes over page-specific overrides. Remove the Manager's Read `first:pl-0` exception. Do not introduce gradients, decorative cards, new fonts, or unrelated motion. Preserve the existing Manrope typeface, light theme, purple accent, and brand geometry.

## Acceptance criteria

- Manager's Read is visibly centered and no longer stretches across the entire Home content area.
- All four insights have the same horizontal and vertical spacing rules.
- The third insight no longer appears to have extra top padding because of the first row's height.
- Desktop and mobile layouts preserve the same information hierarchy.
- Updated and empty states are explicit rather than blank.
- Existing navigation and content behavior remain unchanged.
- Relevant tests cover the new layout contract and all existing tests remain green.
- The authenticated route and tab matrix is rechecked visually at desktop and 390px mobile widths after implementation.
