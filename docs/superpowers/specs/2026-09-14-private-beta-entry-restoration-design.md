# Private Beta Entry Restoration

## Goal

Restore the existing private-beta access flow so demo users can redeem a valid beta code without entering payment details. Keep the interaction behind the existing feature flag and preserve the server-side code gate.

## Context

The private-beta backend flow is already present: the authenticated client sends a checkout session id and code to `redeem-private-beta-code`, which validates the user and code through `activate_beta_artist_workspace`, dispatches the existing setup phase, and returns the workspace. The old paywall UI was removed during the later Desk redesign, but the billing service method, Edge Function, RPC, and production flag remain.

## User Experience

The normal paywall is unchanged when beta access is not being revealed. When `VITE_PRIVATE_BETA_ENABLED` is `true`, a small low-contrast button labeled exactly `BETA` appears in the historical beta-entry location.

Activating `BETA` reveals the historical inline beta-code form on the paywall. The existing price, subscription button, plan or interval controls, artist context, and paywall layout remain unchanged. The form normalizes the submitted code to uppercase and sends it through the existing callback. A successful redemption follows the existing workspace-ready setup transition; invalid, expired, or already-used codes keep the existing friendly error behavior.

The trigger remains a real keyboard-accessible button. It is visually quiet in its resting state and becomes legible on hover or keyboard focus. No new route, modal, authentication restriction, or beta-specific payment mode is introduced.

## Components and Data Flow

1. `PaywallPreviewScreen` regains its historical optional `privateBetaEnabled` and `onRedeemPrivateBeta` inputs and the local state needed to reveal and submit the inline form.
2. The component renders the beta affordance only when both the feature flag prop is enabled and the redemption callback exists.
3. `SpotifyIdentityGate` passes `VITE_PRIVATE_BETA_ENABLED === "true"` and wires the existing `billingService.redeemPrivateBetaCode` callback.
4. The callback uses the already-created checkout preview's checkout session id, tracks the existing beta events, and calls the unchanged billing service method.
5. `createSupabaseBillingService` invokes the unchanged `redeem-private-beta-code` Edge Function. The Edge Function and database RPC remain the authorization boundary.
6. On success, `onWorkspaceReady` continues into the existing Desk setup flow.

## Feature-Flag Behavior

The browser flag controls discoverability only. When disabled, the paywall does not render the beta trigger or form. When enabled, the client can reveal the form, but redemption still requires a valid server-side code and an authenticated user. `VITE_PRIVATE_BETA_ENABLED=true` is already configured for Netlify production. Local development remains controlled by the local environment file and does not require committing any environment change.

## Error and Loading Behavior

The restored form uses the existing paywall pending state and error surface. The submit action is disabled for an empty code or while redemption is pending. Codes are trimmed and uppercased before submission. The existing service and Edge Function errors continue to be converted into the current user-facing message; no raw backend or secret data is exposed.

## Verification

- Update the private-beta UI test to verify the trigger is absent when the flag is disabled.
- Add coverage for the enabled state: the `BETA` trigger is present, the inline form appears after activation, payment controls remain present, and a submitted code is normalized and passed to the callback.
- Preserve the existing billing-service contract test for the `redeem-private-beta-code` invocation.
- Run the focused private-beta tests and the full Vitest suite, followed by a production build.

## Out of Scope

- New beta tables, migrations, RPCs, Edge Functions, or auth behavior.
- Restricting access to a particular email address.
- Adding a new login-page route or a separate beta-only checkout mode.
- Hiding or restructuring the existing paywall payment controls.
