# Fast Subscription Pricing Design

## Goal

Make the recurring-subscription plan dialog show monthly and yearly prices without waiting for a server checkout session to be created, while preserving the existing Paddle/Paystack checkout and payment-confirmation behavior.

## Current problem

The Setup paywall prepares a complete checkout preview before rendering the paywall, so its formatted price is already present when the user sees it. The later plan dialog resets its preview to `null` on every open and calls `prepareWorkspaceSubscriptionCheckout` from its effect. For Paddle, that operation performs pricing-config loading, country detection, Paddle initialization, localized price preview, and `paddle-create-checkout` session creation before returning any price. The dialog therefore displays `Loading price…` for the duration of that chain, and repeats it whenever the dialog is reopened.

## Design

Split subscription pricing from checkout preparation.

1. Add an optional billing-service method for pricing-only data. It returns the selected provider and both interval prices, including localized Paddle totals or Paystack amounts. It must not create or mutate a checkout session.
2. Cache and deduplicate the pricing-only request inside the production billing service. Reuse the existing pricing-config and country caches, Paddle initialization, and provider routing rules.
3. Warm the pricing cache in the background once a signed-in workspace is ready. This keeps the plan dialog fast without delaying Desk startup or creating abandoned checkout rows.
4. Make `SubscriptionPlanDialog` load pricing on open and render the cached interval total. Monthly/yearly switching uses the already-loaded interval options.
5. Move complete checkout preparation to the Pay button. The button creates the provider checkout only for the selected interval, opens it, and invokes the existing confirmation callback. Paddle confirmation, Paystack redirect/reference handling, beta recovery, and customer-portal behavior remain unchanged.

If pricing is not warm when the dialog is opened, the dialog may show its existing loading state for that first request; subsequent opens in the same app session must use the resolved cache. A failed pricing request remains an inline error and must not create a checkout session.

## Data flow

```text
workspace ready
    └─ background loadProviderPricing()
         ├─ billing-pricing-config (cached)
         ├─ country lookup (cached)
         └─ Paddle PricePreview / Paystack configured amounts

open plan dialog
    └─ read cached pricing → show monthly/yearly total

click Pay
    └─ prepareProviderCheckout(selected interval)
         └─ create provider checkout session
              └─ open provider checkout
                   └─ existing payment confirmation flow
```

## Error and safety behavior

- Price preparation failures remain visible in the plan dialog and do not open checkout.
- Checkout-session creation remains server-side and happens only after an explicit Pay action.
- Existing provider preference and workspace-provider affinity are passed through unchanged.
- No hardcoded localized Paddle prices are introduced.
- The existing payment confirmation watcher remains the source of truth for access; pricing readiness never unlocks a workspace.

## Testing

- Add a pricing-service regression proving the pricing-only call returns interval totals without invoking `paddle-create-checkout`.
- Update plan-dialog coverage to prove opening the dialog loads pricing only, displays the price, and defers checkout preparation until Pay.
- Keep coverage for the Setup paywall, expired-beta recovery, Settings payment confirmation, provider routing, and customer portals.
- Run the focused billing/payment suite and the production build.

## Non-goals

- Changing the default Paddle provider or reintroducing Paystack provider switching in the UI.
- Changing renewal, webhook, access-entitlement, or payment-return semantics.
- Prefetching checkout sessions or creating database rows before the user clicks Pay.
