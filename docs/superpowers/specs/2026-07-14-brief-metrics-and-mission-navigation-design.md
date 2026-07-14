# Today's Brief metrics and mission navigation design

## Goal

Today's Brief metric cards must show a meaningful label and a concise human-readable value. The populated Missions page must open Manager Office without automatically asking for a first mission.

## Metric normalization

New generated briefs are normalized before persistence, and saved briefs are normalized again when mapped into the client view model. This two-boundary approach fixes historical malformed briefs immediately and prevents new malformed metrics from being stored.

Numeric display rules:

- ordinary numbers are rounded to whole numbers and use thousands separators;
- compact values at one million or above use at most one decimal, such as `2.1M`;
- compact thousands use no decimal places;
- percent and rank markers are retained;
- already textual values remain unchanged.

Label rules:

- a non-numeric label that differs from the value is retained;
- a numeric label, or a label equal to the value after normalization, is invalid;
- an invalid label is replaced by a meaningful non-numeric context when available, otherwise by the snapshot group title, otherwise by `Metric`.

When a generated label is missing or numeric, the normalizer will recover a readable label from the metric context and then the snapshot group title. This keeps the correction deterministic without inventing a title from the displayed value.

## Missions behavior

`MissionsWorkspace` receives separate actions:

- `onCreateFirstMission` is used only by the zero-mission empty state and submits `Create the first mission for this workspace.` through Manager conversation;
- `onOpenManager` is used by `Talk to Manager` when missions exist and only navigates to Manager Office.

Opening Manager Office from a populated Missions page must not create an optimistic conversation, invoke a Manager repository method, or submit the first-mission directive.

## Verification

Tests will reproduce long decimal values, duplicate numeric label/value pairs, compact million formatting, and the populated Missions navigation behavior. Focused tests must fail before implementation, then pass after the minimal changes. The full test suite and production build are required before completion.
