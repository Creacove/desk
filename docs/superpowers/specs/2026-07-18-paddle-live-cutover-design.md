# Paddle Live Cutover Design

## Objective

Move the tested OrderSOUNDS Paddle Billing integration from sandbox to the live Paddle account without exposing a broken checkout or mutating sandbox data.

## Current state

- Sandbox checkout, webhook fulfillment, database writes, entitlement activation, upgrades, and cancellations have been repeatedly verified by the owner and external testers.
- Sandbox contains one active `Pro` product using the standard digital-goods tax category.
- Sandbox prices are USD 20 monthly and USD 200 yearly, with country-specific pricing configured for Great Britain, Ireland, and Australia.
- Sandbox has no reusable discounts.
- The live Paddle account has no products, prices, API keys, client-side tokens, or notification destinations.
- Paddle marks live account setup, verification, and live testing as not started.
- The application already selects Paddle's environment and catalog IDs from Supabase Edge Function secrets. No catalog IDs are hard-coded in browser code.
- The public OrderSOUNDS site has Terms, Privacy, product description, and contact pages. The Desk login domain needs direct legal/contact links and a refund/cancellation policy.

## Selected approach

Use an additive, coordinated cutover:

1. Add public legal and contact links to the Desk sign-in page and publish a Desk refund/cancellation policy.
2. Recreate the single sandbox product and its prices in live, copying regional price overrides exactly.
3. Create one least-privilege live API key, one live client-side token, and one live notification destination for the existing Supabase webhook.
4. Submit `desk.ordersounds.com` for website approval and set it as the default payment link.
5. Complete Paddle business and identity verification before exposing live checkout.
6. Replace the complete set of Paddle Supabase secrets in one coordinated operation, redeploy the Paddle functions, and verify the production pricing configuration.
7. Run a controlled zero-total live checkout after Paddle approves the account and domain.

The live account migration is additive. Existing live entities are never deleted, archived, or recreated. Sandbox remains unchanged.

## Code and content changes

`src/app/ProductionApp.tsx` will add direct links on the signed-out surface to:

- `https://ordersounds.com/terms`
- `https://ordersounds.com/privacy`
- `/refund-cancellation.html`
- `mailto:ordersoundsapp@gmail.com`

`public/refund-cancellation.html` will provide a plain-language policy covering recurring billing, end-of-period cancellation, access after cancellation, refund requests, Paddle buyer support, and non-waivable statutory rights.

`src/production-app-shell.test.tsx` will verify that all four destinations are present before authentication.

The Paddle integration source remains environment-driven. Live product, price, credential, and signing-secret values stay only in Supabase secrets.

## Live Paddle resources

- Product: `Pro`
- Tax category: standard digital goods
- Monthly price: USD 20, monthly recurring
- Yearly price: USD 200, yearly recurring
- Regional pricing: copy the sandbox GB, IE, and AU overrides exactly
- Client token: one active live token for Paddle.js
- API key: least privilege for products, prices, transactions, customers, subscriptions, notification verification, and customer portal operations used by the deployed functions
- Webhook URL: `https://bbwbxmnanccwottrmkqu.supabase.co/functions/v1/paddle-webhook`
- Events: `transaction.completed`, `subscription.created`, `subscription.updated`, `subscription.canceled`, `customer.created`, and `customer.updated`
- Checkout domain/default payment link: `https://desk.ordersounds.com`

## Deployment boundary

The production secrets change only after the live catalog, credentials, notification destination, website approval, and account verification are ready. These values change together:

- `PADDLE_ENVIRONMENT=production`
- `PADDLE_API_KEY`
- `PADDLE_CLIENT_TOKEN`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_NOTIFICATION_DESTINATION_ID`
- `PADDLE_PRO_PRODUCT_ID`
- `PADDLE_PRO_MONTHLY_PRICE_ID`
- `PADDLE_PRO_YEARLY_PRICE_ID`

The Paddle Edge Functions are redeployed after the secret update. The production pricing endpoint must return `production`, a `live_` client token, the new live product ID, and both new live price IDs before checkout testing begins.

## Security and failure handling

- Webhook signatures remain mandatory and are verified against the raw request body before an event is queued.
- Event IDs and provider transaction IDs remain idempotent.
- A failed or partial catalog/credential setup does not trigger the Supabase secret swap.
- The signing secret is captured when the notification destination is created and immediately stored in Supabase; it is never committed to the repository.
- Paddle IP allowlisting is applied only at a trusted upstream boundary that exposes the real source address. The Edge Function does not trust arbitrary forwarding headers.
- `pwCustomer` is not a launch blocker. It will be added separately only when the signed-in user has a verified `ctm_` value available before Paddle.js initialization.

## Verification

- Focused auth-shell and deployment-configuration tests pass.
- The full test suite and production build pass.
- The live domain serves the product description, legal links, contact link, and refund/cancellation policy.
- Paddle reports the checkout domain as approved and account verification as complete.
- Live pricing matches USD 20 monthly and USD 200 yearly plus the copied regional overrides.
- The controlled live checkout verifies transaction completion, 2xx webhook delivery, database records, entitlement activation, upgrade, scheduled cancellation, immediate cancellation, and cleanup.

