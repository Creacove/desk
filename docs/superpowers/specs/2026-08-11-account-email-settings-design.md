# Account email in Settings

## Goal

Make the email address used for the signed-in Ordersounds account visible in the existing Account tab. The value must come from the authenticated session so it cannot drift from the credential that controls sign-in and password updates.

## Chosen approach

Pass `ProductionUser.email` from `ProductionApp` through the existing workspace/settings render path into `SettingsScreen`. Render it as a read-only account identity field above the password controls. Do not add an email-editing flow or copy the value into `ArtistProfileViewModel`.

## UI behavior

- The Account tab contains an “Email address” field.
- The field displays the authenticated email and cannot be edited.
- If the auth provider does not return an email, show a neutral “Email unavailable” fallback rather than exposing an empty control.
- The existing appearance, password, billing, and sign-out behavior remain unchanged.

## Data flow

`ProductionApp` already holds `sessionUser` and passes it as `analyticsUser` to `CleanProductionWorkspace`. `CleanProductionWorkspace` passes `analyticsUser.email` to `SettingsScreen` as an optional `accountEmail` prop. `AccountSettings` receives the prop and renders the field.

## Verification

- Add a focused settings regression test that opens Account and asserts the authenticated email is visible and non-editable.
- Run the focused settings test, the relevant production app shell tests, the full test suite, and the production build.
