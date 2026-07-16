# Payment Security Best-Practices Report

## Executive summary

The payment architecture has strong server-side foundations: provider secrets remain in Supabase, both webhooks verify signatures, Paddle events enter a durable retry queue, fulfillment is atomic and service-role-only, and browser callbacks do not grant access. The audit found one high-severity Paystack verification weakness and one Paddle sandbox configuration failure. Both are corrected in this change. The remaining low-severity item is to move the current Content Security Policy from report-only to enforcement after production checkout telemetry confirms the allowlist is complete.

## High severity

### PAY-001: Paystack allowed material underpayment

- **Rule ID:** PAY-001
- **Severity:** High
- **Location:** `supabase/functions/_shared/paystackFulfillment.ts`, `validatePaystackTransaction`, lines 46-65
- **Evidence:** The previous implementation accepted an absolute difference of up to 200,000 kobo (NGN 2,000) between the server-created checkout and Paystack's verified transaction.
- **Impact:** A successful lower-value Paystack transaction within that tolerance could activate the same paid workspace and entitlement as the canonical subscription price.
- **Fix:** Verification now requires an explicit successful status, exact minor-unit amount, exact currency, and the canonical plan code whenever Paystack returns plan information. Regression tests cover one-kobo underpayment and overpayment.
- **Mitigation:** Paystack plan prices and the Supabase amount secrets must be updated together. Provider fees must never be handled by weakening transaction amount verification.
- **False-positive notes:** Paystack's verified `amount` is the customer transaction amount in minor units, not the merchant settlement after fees.

## Medium severity

### PAY-002: Paddle sandbox checkout prerequisites were missing

- **Rule ID:** PAY-002
- **Severity:** Medium
- **Location:** Paddle sandbox dashboard, Checkout Settings and Website Approval
- **Evidence:** The sandbox default payment link was empty. Only `www.ordersounds.com` was approved; Paddle explicitly treats `desk.ordersounds.com` as a separate subdomain.
- **Impact:** Paddle.js could initialize and show its overlay shell, then fail with Paddle's generic `Something went wrong` message before presenting the payment form.
- **Fix:** The sandbox default payment link is now `https://desk.ordersounds.com`, and `desk.ordersounds.com` is approved in sandbox Website Approval.
- **Mitigation:** The live Paddle account must repeat these settings with live website approval before `PADDLE_ENVIRONMENT` changes to `production`.
- **False-positive notes:** Sandbox domain approval is immediate, but the domain must still be added. Sandbox and live settings are separate.

## Low severity

### PAY-003: Content Security Policy is report-only

- **Rule ID:** PAY-003
- **Severity:** Low
- **Location:** `netlify.toml`, line 19
- **Evidence:** The application sends `Content-Security-Policy-Report-Only` with Paddle and Supabase allowlists, but it does not yet enforce the policy.
- **Impact:** The policy provides telemetry but does not block a script, frame, or connection that violates it. Other application controls still prevent the payment-specific attacks reviewed here.
- **Fix:** No enforcement change is bundled with the checkout repair because enforcing an unobserved policy can break third-party checkout. Review violation telemetry after Paddle smoke testing, then promote the validated policy to `Content-Security-Policy` in a separate deployment.
- **Mitigation:** Existing `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, referrer policy, permissions policy, React escaping, fixed provider endpoints, and URL validation reduce exposure.
- **False-positive notes:** Netlify or another edge layer could add a second enforced policy; runtime headers currently show only the report-only policy.

## Confirmed payment controls

- Paystack verifies `x-paystack-signature` with HMAC SHA-512 before processing (`supabase/functions/paystack-webhook/index.ts`, lines 14-20 and 195-208).
- Paddle verifies `Paddle-Signature` against the raw request body before queueing (`supabase/functions/paddle-webhook/index.ts`, lines 17-29).
- Paddle webhook events are durably stored and claimed through a retryable queue (`supabase/functions/paddle-webhook/index.ts`, line 35; `supabase/functions/paddle-process-webhooks/index.ts`, line 27).
- Paddle fulfillment reloads provider subscription and customer records, validates catalog and totals, then invokes the atomic `fulfill_verified_checkout` RPC (`supabase/functions/paddle-process-webhooks/index.ts`, lines 115-174).
- Checkout pricing and catalog identifiers come from server configuration; the browser cannot choose arbitrary amounts, products, prices, or plan codes.
- Paystack authorization URLs require HTTPS, while Paddle customer-portal URLs require HTTPS and the exact Paddle portal hostname.
- Browser success URLs and callback references only trigger status verification. They do not grant entitlements directly.
- Paid setup requires durable completed transaction and subscription evidence.

## Live-mode checklist

### Paddle

1. Complete the live Paddle business/account review.
2. Recreate or verify the live product and monthly/yearly price IDs.
3. Create a live API key and live client-side token.
4. Approve `desk.ordersounds.com` in the live Website Approval screen.
5. Set the live default payment link to `https://desk.ordersounds.com`.
6. Create the live notification destination for the Supabase `paddle-webhook` function and subscribe to the six events used by the worker.
7. Store the matching live webhook secret and billing worker secret in Supabase.
8. Switch all Paddle secrets and `PADDLE_ENVIRONMENT=production` as one coordinated deployment.
9. Run a low-risk real checkout only with explicit operator approval.

### Paystack

1. Confirm the monthly and yearly live plan codes and exact plan amounts.
2. Confirm the Supabase amount secrets match those plan amounts in kobo.
3. Confirm `PAYSTACK_CALLBACK_URL=https://desk.ordersounds.com/welcome`.
4. Confirm the Paystack dashboard webhook targets the deployed Supabase `paystack-webhook` function.
5. Confirm the live Paystack secret key is stored only in Supabase.
6. Run callback, webhook, duplicate-event, failed-renewal, and cancellation smoke tests before general release.
