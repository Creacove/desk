# Mobile Detail Navigation and Catalog Layout Design

## Goal

Make every screen transition begin at the top and reclaim limited mobile viewport space on nested screens. Keep the existing desktop presentation intact while making catalog and mission detail screens behave like focused mobile app views.

## Navigation and Scroll Behavior

The application shell will scroll the document to the top whenever the primary `view` changes. Catalog and Missions will also scroll to the top when their local screen mode changes because song rooms, project rooms, and mission rooms currently use component state rather than top-level application routes.

The same rule applies when returning from a detail screen to its list. Browser reloads already mount the application at its initial screen; a mount-time scroll reset will ensure that screen also starts at the top. Tab changes within a song or mission room are not new pages and will not trigger a scroll reset.

## Mobile Header Visibility

The Ordersounds mobile header remains visible on these top-level destinations:

- Desk HQ
- Catalog list
- Team Agents list
- Missions list
- Settings

It is hidden on focused nested destinations:

- Song rooms and project rooms
- Mission rooms
- Manager's Office and conversations
- Locked agent screens
- Investigation and decision package screens

Catalog and Missions will report whether they are displaying a list or detail room to the application shell. The shell will combine that state with the active top-level view to decide whether to render `MobileChrome`. The desktop rail and desktop headers are unchanged.

## Catalog Song Status

Song lifecycle values `Released` and `Catalog` are immutable display states. On mobile they render as a small status badge near the song-room label and do not render a dropdown. All earlier lifecycle stages retain an editable selector, presented as a compact control that does not dominate the header.

Desktop uses the same lifecycle rule: released/catalog songs show a compact status treatment, while earlier stages retain the existing editable selector. This prevents a released song from being changed back into an unreleased state through the detail header.

## Project Room Simplification

Project rooms will remove summary UI that repeats inherited track state:

- The project-level `State` and `Blocker` boxes in the detail header
- The project tracklist blocker rollup
- Per-track inherited blocker badges

Track titles, artwork, lifecycle state, and the track-opening action remain available. Detailed blocker information remains available in the individual song room where it is actionable and attributable to that song.

## Mobile Overflow Containment

Song, project, mission, and project-track titles will be placed inside explicitly shrinkable containers. Text will wrap across lines and break long unspaced strings when necessary. Parent grids and flex rows will use `min-width: 0` and clipped/hidden horizontal overflow where appropriate, ensuring content cannot widen the page beyond the mobile viewport.

Normal titles remain readable rather than being universally truncated. Compact track rows may continue truncating titles where the row has fixed accessory columns.

## Component Boundaries and Data Flow

- `ProductionApp` owns global scroll reset and mobile header visibility.
- `MusicWorkspace` reports library versus song/project detail mode and performs local-mode scroll resets.
- `MissionsWorkspace` reports list versus room mode and performs local-mode scroll resets.
- `MusicDetailTop` owns lifecycle status presentation and title containment.
- `MusicProjectDetail` owns removal of inherited blocker summaries and track-row overflow containment.
- `MissionRoom` owns mission-title overflow containment.

Callbacks are optional so isolated component tests and existing consumers remain compatible.

## Testing

Regression tests will verify:

- Primary app navigation calls the scroll reset.
- Opening and closing catalog and mission rooms resets scroll position.
- The mobile header is present on top-level screens and absent on nested screens.
- Released and Catalog songs show locked compact status without a selector.
- Unreleased songs retain a compact editable selector.
- Project rooms omit project and inherited track blocker summaries.
- Long song, project, mission, and track titles use shrink/wrap/overflow containment classes.

Existing targeted tests, the full Vitest suite, and the production build will be run before completion is claimed.

## Scope

This change does not introduce URL routing, change stored lifecycle data, alter blocker computation, or redesign desktop navigation. It only changes transition behavior and presentation of existing state.
