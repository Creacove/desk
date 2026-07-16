# Payment Provider Choice and Hardening Design

## Objective

Make Paddle sandbox checkout usable, let Nigerian customers explicitly pay in USD through Paddle, and harden Paystack verification before either provider is promoted to live payments.

## Current state

- Country detection routes Nigerian visitors to Paystack and everyone else to Paddle.
- Nigerian visitors have no way to select Paddle, which blocks local testing with an international card.
- Paddle sandbox checkout was blocked because its default payment link was empty and `desk.ordersounds.com` was not in the sandbox website allowlist.
- Paddle sandbox now uses `https://desk.ordersounds.com` as its default payment link, and `desk.ordersounds.com` is approved.
- The Paddle webhook destination is active and subscribes to `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `customer.created`, and `customer.updated`.
- Paystack verification currently accepts an amount difference of up to 200,000 kobo (NGN 2,000). Paystack's verified transaction amount must instead match the server-created checkout exactly.
- `supabase/functions/_shared/paystackFulfillment.ts` has an existing uncommitted change that sets `p_scheduled_change_action` to `"none"`. That user-owned change must be preserved.

## Selected approach

Keep country-based routing as the default while adding an explicit, one-checkout provider choice.

- Nigerian visitors see the normal Paystack subscription action and a secondary text action: `Pay in USD with an international card`.
- Selecting the secondary action prepares a new Paddle checkout for the currently displayed billing interval and opens Paddle's sandbox overlay.
- The explicit choice is represented as a typed provider preference passed through the existing billing service. It is not read from a URL query parameter or browser storage.
- The server creates the canonical checkout session and supplies the canonical Paddle product and price identifiers. The browser cannot supply arbitrary product, price, amount, or currency values.
- Changing monthly/yearly billing preserves the currently selected provider only for the active paywall interaction. Reloading returns to country-based routing.

This is intentionally narrower than a currency picker or permanent billing preference. It solves international-card payment and local Paddle testing without introducing account-level currency state.

## Components and responsibilities

### Paywall presentation

`PaywallPreviewScreen` renders the provider-specific primary action and, for Nigerian Paystack previews, the USD secondary action. It remains presentation-only and calls explicit callbacks supplied by `ProductionApp`.

The primary Paystack action continues to display the localized NGN price. The USD action uses explanatory copy rather than the ambiguous label `Pay USD`.

### Billing orchestration

`ProductionApp` tracks the provider choice for the current paywall interaction and asks the billing service to prepare a replacement preview when the user chooses Paddle or changes interval. Pending and error states use the existing paywall behavior.

The production billing service accepts an optional provider preference:

- `auto`: use the current country-resolution logic;
- `paystack`: allowed only for the Paystack-supported flow;
- `paddle`: explicitly select Paddle, including for a Nigerian visitor.

The provider preference selects which server function is called; it never changes catalog data in the browser.

### Paddle checkout and fulfillment

The existing `paddle-create-checkout` function continues to:

- authenticate the user;
- validate the selected artist and optional existing workspace membership;
- select canonical product and price IDs from server secrets;
- create an expiring, idempotent checkout session;
- issue a one-time correlation token whose hash is stored server-side.

Paddle.js opens only the returned price. Access is granted only after a signed `transaction.completed` webhook is durably queued, verified against Paddle's API, correlated to the checkout, and fulfilled through the atomic database function.

### Paystack checkout and fulfillment

Paystack initialization remains server-only. The verified transaction must satisfy all of these conditions before fulfillment:

- successful status;
- exact amount in minor units;
- exact currency;
- transaction reference associated with the checkout;
- canonical plan code when Paystack returns plan information;
- required customer and recurring-subscription identifiers.

Gateway fees and legacy price drift are not accepted as amount differences. A configuration mismatch fails closed and is corrected in Paystack/Supabase configuration rather than weakening verification.

### Entitlements

Both providers continue through `fulfill_verified_checkout`. Browser callbacks, success URLs, query parameters, and checkout-open events never grant access. Existing paid-or-private-beta entitlement checks remain the authorization boundary for protected functions.

## Error handling

- A failed provider switch leaves the current preview visible and displays a recoverable paywall error.
- A stale or mismatched Paddle preview is rejected before checkout opens.
- An unsafe Paystack authorization URL is rejected before navigation.
- Paystack verification mismatches return an error and do not create a transaction, subscription, workspace, or entitlement.
- Duplicate provider events remain idempotent through provider event and transaction uniqueness constraints.
- Paddle webhook processing remains retryable through the durable queue and scheduled worker.

## Security requirements

- Secret keys remain in Supabase Edge Function secrets; only Paddle's client-side token may reach the browser.
- Provider choice is an allowlisted enum and cannot carry arbitrary URLs, prices, amounts, product IDs, or plan IDs.
- Checkout URLs must use HTTPS and the existing provider-specific hostname checks.
- Webhook signatures are verified against the raw body before parsing or processing.
- Fulfillment stays service-role-only, atomic, correlated, and idempotent.
- Paystack amount verification is exact.
- The existing report-only CSP is not weakened to make Paddle work.

## Testing

Tests are written before production changes and cover:

- Nigerian auto-routing still selects Paystack;
- an explicit Nigerian USD choice selects Paddle;
- the USD action appears only on a Paystack/NGN preview and uses the approved copy;
- monthly/yearly switching preserves the active explicit provider choice;
- arbitrary provider values are rejected by types/runtime validation;
- Paddle opens the exact server-returned price with its correlation data;
- Paystack exact amount succeeds;
- every overpayment and underpayment mismatch fails;
- Paystack currency and returned plan mismatches fail;
- signed webhook fulfillment remains idempotent;
- payment callbacks alone never grant access.

Focused payment tests, the full Vitest suite, a production build, and a browser checkout smoke test must pass before the work is considered complete.

## Live-mode readiness

Sandbox and live Paddle accounts are separate. Moving live requires recreating or verifying live catalog IDs, client token, API key, webhook secret, notification destination, default payment link, and approved `desk.ordersounds.com` website. Supabase secrets must switch as one coordinated release with `PADDLE_ENVIRONMENT=production`.

Paystack live readiness requires exact agreement among Paystack plan prices, Supabase amount secrets, callback URL, webhook URL, and live secret key. No real charge is submitted without the user's action in the provider checkout.

## Success criteria

- Paddle sandbox overlay opens from `desk.ordersounds.com` without the generic error.
- A Nigerian customer can deliberately choose Paddle using `Pay in USD with an international card`.
- Default Nigerian checkout remains Paystack/NGN.
- Paystack cannot grant access for any amount other than the exact server-created checkout amount.
- Both providers grant access only from verified, idempotent server-side fulfillment.
- Existing user-owned worktree changes are preserved.
