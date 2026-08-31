# Subscription Renewal and Recovery Design

## Goal

Make recurring renewals invisible when payment succeeds and give interrupted customers one standard, provider-affine recovery experience without recreating their workspace or rerunning onboarding.

## Product behavior

- An active Paystack or Paddle subscription renews automatically. A verified renewal extends the stored billing period and records a new billing transaction. The application does not navigate, show setup, or interrupt the customer.
- A failed or ended subscription locks workspace interaction behind a blocking recovery overlay. The existing artist and workspace remain visible but inert underneath it.
- The recovery checkout always reuses the existing artist workspace. A previous Paddle customer stays on Paddle and a previous Paystack customer stays on Paystack. A former beta customer with no billing provider uses the normal country-based provider selection.
- After a reactivation payment is verified server-side, the client reloads workspace entitlement from the database and removes the overlay. Existing work remains in place and setup is not rerun.
- Expired private-beta access cannot be renewed with another code. The overlay says that beta access ended and offers a paid plan. The beta-code field is removed from the purchase UI.
- Active beta customers see a compact global notice during the final seven days of their grant. The notice links to the same paid checkout and Settings exposes the same subscription action.
- Settings has a Billing tab. Paid Paddle and Paystack customers can open their provider's hosted billing-management page there.

## Access states

- `active`: normal application; no renewal UI.
- `non-renewing`: normal application until `current_period_end`.
- `attention` or `past_due`: blocked recovery state once the workspace loader reports no active entitlement.
- `expired`, `inactive`, `paused`, `canceled`, or `cancelled`: blocked recovery state.
- expired `private_beta`: blocked conversion state with `Choose a plan` rather than code redemption.

Backend entitlement checks remain authoritative. Blur and disabled controls are presentation only.

## Billing lifecycle

Initial checkouts continue to use `fulfill_verified_checkout`. A completed workspace reactivation may create an audit setup row, but that row is atomically completed and no setup worker is dispatched.

Paystack checkout sends the selected recurring plan code and does not force a payment channel. Paystack's hosted subscription checkout owns collection and may offer the subscription-compatible Card and Nigerian Direct Debit methods enabled for the merchant. Desk verifies the resulting provider subscription before granting access; it does not convert one-time transfer or USSD payments into subscriptions.

Recurring provider transactions use a separate `record_verified_subscription_renewal` database function. It validates the existing provider subscription, customer, price, currency, and amount; inserts one idempotent transaction per provider transaction ID; and advances the existing subscription period. It never touches setup.

Paddle subscription status events mirror active, past-due, paused, resumed, and canceled states. A recurring `transaction.completed` records a renewal when its correlated checkout was already paid. Paystack `charge.success` records a renewal when it belongs to an existing subscription rather than an open checkout; invoice updates mirror status and period without replaying initial fulfillment.

## Recovery confirmation

The recovery client prepares a checkout with the workspace's previous provider and billing interval. It listens for checkout-session changes and polls `billing-status` while Paddle Checkout is open. It removes the lock only after `billing-status` or a workspace reload returns `entitlementActive: true`.

The application also listens for subscription and beta-grant database changes. This makes automatic renewal recovery, provider retries, cancellation, and externally completed payment updates visible without requiring a manual reload.

## Failure behavior

- Checkout preparation errors remain on the recovery overlay with a retry action.
- A canceled or failed checkout does not unlock the workspace.
- Delayed webhooks show `Confirming payment…` and continue checking the database.
- Provider billing links are validated against the expected Paddle or Paystack host before navigation.
- A recurring webhook can be delivered repeatedly without duplicate billing transactions or duplicate setup work.

## Testing

Tests cover the recovery overlay copy and lock, beta conversion, provider affinity, confirmation-driven unlock, Settings billing for both providers, Paystack hosted management links, recurring transaction schema, webhook renewal routing, and the absence of setup dispatch for renewals/reactivations.
