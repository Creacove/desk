# Paid subscription and private-beta rollout

## What stays unchanged

- The Paystack `$20/month` plan, configured plan code, amount, currency, signature verification, amount verification, webhook audit, subscription records, and `activate_paid_artist_workspace` RPC remain the paid source of truth.
- A callback URL never grants access. Paid access still begins only after server verification.
- Private-beta access never creates a Paystack transaction, subscription, invoice, or revenue record.

## New environment values

Client build:

```text
VITE_PRIVATE_BETA_ENABLED=false
```

Supabase Edge Function secrets:

```text
PRIVATE_BETA_ENABLED=false
RESEND_API_KEY=<Resend API key>
ORDERSOUNDS_FROM_EMAIL=OrderSounds <hello@ordersounds.com>
ORDERSOUNDS_REPLY_TO_EMAIL=ordersoundsapp@gmail.com
APP_ORIGIN=https://app.ordersounds.com
```

Never expose the Resend key, Paystack secret, or Supabase service-role key as a `VITE_` variable.

## Supabase and Resend dashboard actions

1. Verify `ordersounds.com` in Resend and wait for SPF and DKIM to report as verified. Add the recommended DMARC record.
2. Confirm `hello@ordersounds.com` is permitted by that verified domain.
3. In Supabase Authentication SMTP settings, configure Resend SMTP for password-recovery mail:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: a Resend API key
   - Sender: `OrderSounds <hello@ordersounds.com>`
4. Keep signup confirmation disabled for the controlled beta.
5. Set the production Site URL and allow `https://app.ordersounds.com/update-password` as an Auth redirect URL. Add the staging equivalent before staging QA.
6. Keep `PRIVATE_BETA_ENABLED=false` and `VITE_PRIVATE_BETA_ENABLED=false` through the first paid-path regression.

## Staging deployment order

1. Apply `supabase/migrations/20260713000100_private_beta_access_and_transactional_email.sql`.
2. Deploy:
   - `redeem-private-beta-code`
   - `create-beta-invite-batch`
   - `send-account-welcome`
   - `paid-workspace-setup`
   - `paystack-initialize-checkout`
   - `paystack-webhook`
   - `billing-status`
3. Deploy the client with its beta UI flag off.
4. Complete one Paystack test-mode subscription. Confirm the same plan code and `$20` amount, one subscription row, one setup run, one success toast, and one paid activation email.
5. Turn on the server flag and create one internal invitation code.
6. Redeem it and confirm one grant, one redeemed code, one setup run, discovery dispatch, one success toast, and one beta email.
7. Turn on the client flag and run the full manual matrix.

Rollback is immediate: turn off both private-beta flags. The paid path remains available.

## Creating invitation seats

Load the staging or production URL and service-role key into an untracked local `.env`, then run:

```powershell
npm run beta:batch -- --partner "Person name" --quantity 1 --recipient "person@example.com"
```

For a community leader:

```powershell
npm run beta:batch -- --partner "Community name" --quantity 5 --recipient "leader@example.com"
```

The command emails the codes and prints them once. It never writes raw codes to tracked files. Each code is one transferable seat until its first successful redemption.

## Manual QA matrix

1. New account → artist → Paystack → verified payment → paid toast → discovery → context → first brief → paid email.
2. New account → artist → valid invitation → beta toast → discovery → context → first brief → beta email.
3. Invalid, expired, revoked, and reused codes leave the Desk locked; paid checkout still works.
4. Two simultaneous requests for one code produce exactly one grant.
5. A paid user cannot consume a beta code.
6. A beta user can later pay; paid access takes precedence and the same workspace is reused.
7. Expiry locks access without deleting workspace data; payment restores that workspace.
8. Sign out and return during beta; access and setup resume.
9. Password recovery succeeds in Gmail and a second provider and lands on `/update-password`.
10. Resend shows one account email, one invitation email, and exactly one activation email per paid or beta event.
11. PostHog contains access-source events but no raw code, email, payment detail, or private artist content.

## Local verification

```powershell
$env:NODE_OPTIONS='--max-old-space-size=4096'
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_ANON_KEY='test-anon-key'
npm test
npm run build
deno check supabase/functions/redeem-private-beta-code/index.ts supabase/functions/create-beta-invite-batch/index.ts supabase/functions/send-account-welcome/index.ts supabase/functions/paystack-webhook/index.ts supabase/functions/billing-status/index.ts supabase/functions/paid-workspace-setup/index.ts supabase/functions/paystack-initialize-checkout/index.ts
```

`supabase db lint --local` additionally requires the local Supabase/Postgres stack to be running.
