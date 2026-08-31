# Workspace Plan Selector Design

## Outcome

Beta users choosing paid access see an Ordersounds-owned plan selector before any provider checkout. The selector reuses the existing billing catalog and upgrades the current workspace without Spotify selection or setup replay.

## Experience

- `Choose a plan` opens a compact modal over the current Desk.
- The modal offers monthly and yearly billing and displays the canonical localized price.
- In Nigeria, the default preview is NGN. The primary action opens a card checkout; a secondary `Pay in USD` action switches the preview to USD before checkout.
- When USD is selected, `Pay in NGN` switches back without exposing Paddle or Paystack names.
- Active beta access remains active while checkout is open or abandoned.
- Expired beta access uses the same selector from the blocking recovery dialog.
- Expired paid access continues to restore through its existing provider and interval.

## Payment behavior

- The selector calls `prepareProviderCheckout` with the existing workspace, selected interval, and explicit provider preference.
- It only calls `openProviderCheckout` after the user presses the displayed payment action.
- Paystack subscription initialization sends `channels: ["card"]`; recurring Paystack subscriptions require a reusable card or Nigerian direct-debit authorization, and this product flow intentionally collects a card.
- Payment confirmation and workspace reactivation remain webhook-driven.

## Failure handling

- Pricing or checkout errors stay inside the modal and remain retryable.
- Closing the modal does not change entitlement or workspace state.
- Provider switching replaces the preview atomically and does not open checkout automatically.

## Verification

- Component tests cover opening without checkout, interval switching, NGN/USD switching, and explicit payment opening.
- Backend contract tests require Paystack card-only subscription initialization.
- Existing renewal, provider, settings, and production workspace tests remain green.
