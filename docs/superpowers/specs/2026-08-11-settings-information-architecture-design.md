# Settings information architecture and profile editing

## Goal

Make Settings easy to understand by separating artist profile editing, workspace access, appearance preferences, and account security into four focused tabs. Ensure every displayed manual profile input can be edited and explicitly saved.

## Tabs and order

1. **Profile** — default tab. Editable artist name, stage, home market, genre, artist goals, monthly budget, and social handles. The connected Spotify artist remains read-only because it is managed by the integration.
2. **Workspace** — workspace access status, dates, and billing actions.
3. **Preferences** — appearance mode controls only.
4. **Account** — authenticated email, password update, and sign out.

The order follows the user’s primary work (artist context), then workspace access, then app preference, then credential/security actions. The tab labels should use “Workspace” and “Preferences” instead of the ambiguous “Access” and the overloaded “Account” grouping.

## Profile editing and save behavior

- Manual profile fields use enabled inputs while the profile is not saving.
- The Connected artist field remains disabled and explains that it is managed by Spotify.
- The Profile tab always renders an explicit Save changes button when the runtime exposes the profile update service. It is disabled when there are no edits or a save is in flight.
- Saving sends the complete profile draft through the existing `update_artist_profile` RPC, updates the local profile only after the RPC succeeds, and displays success or error feedback without discarding an unsaved draft.
- The production runtime must expose `updateArtistProfile` alongside `saveSetupContext`; otherwise the save UI is silently omitted.

## Account and preferences boundaries

- Preferences contains only the appearance selector and its current-mode explanation.
- Account contains the session email as read-only identity information, the password update form, and sign out.
- No email-editing workflow is introduced in this change.

## Verification

- Add SettingsScreen tests for the four-tab order, editable manual fields, read-only Connected artist, and save success/error behavior.
- Add a production app shell test proving the production runtime passes `updateArtistProfile` and renders Save changes.
- Run the focused tests, full test suite, and production build.
