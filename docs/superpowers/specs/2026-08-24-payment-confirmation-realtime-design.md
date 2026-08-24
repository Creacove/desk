# Payment confirmation: backend-authoritative realtime handoff

## Goal

Move a paid customer out of “Still confirming” as soon as the backend has fulfilled the checkout, without granting access from a browser-only payment event.

## Design

The Paddle webhook worker remains the only component that marks a checkout paid, creates the subscription, and grants the workspace entitlement. The browser subscribes to updates for its own `billing_checkout_sessions` row through Supabase Realtime. That update is only a wake-up signal: on receipt, the browser calls `billing-status` and transitions only when that canonical endpoint reports an active entitlement and workspace.

Fast polling remains as a recovery path for missed realtime events, disconnected clients, or delayed channel setup. Realtime and polling are presentation-layer observers and cannot block webhook fulfillment or setup. Existing row-level security limits checkout events to the authenticated owner.

## Failure behavior

- Missed realtime event: fast polling converges.
- Realtime unavailable: polling converges.
- Status endpoint unavailable: access remains locked and the UI reports a confirmation-service connection problem while retrying.
- Duplicate or out-of-order webhook: existing idempotent backend fulfillment remains authoritative.
- Completed setup: the first canonical active status immediately advances the user; theatrics never delay access.

