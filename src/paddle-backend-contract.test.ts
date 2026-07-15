import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("Paddle server integration contract", () => {
  it("requires an explicit Paddle environment and uses the official SDK", () => {
    const paddle = source("supabase", "functions", "_shared", "paddle.ts");

    expect(paddle).toContain('requireEnv("PADDLE_ENVIRONMENT")');
    expect(paddle).toContain("Environment.sandbox");
    expect(paddle).toContain("Environment.production");
    expect(paddle).toContain('requireEnv("PADDLE_API_KEY")');
    expect(paddle).not.toContain('?? "sandbox"');
  });

  it("creates checkout sessions from canonical server-side price configuration", () => {
    const checkout = source("supabase", "functions", "paddle-create-checkout", "index.ts");
    const paddle = source("supabase", "functions", "_shared", "paddle.ts");

    expect(paddle).toContain("PADDLE_PRO_MONTHLY_PRICE_ID");
    expect(paddle).toContain("PADDLE_PRO_YEARLY_PRICE_ID");
    expect(checkout).toContain("clientRequestId");
    expect(checkout).toContain("checkout_correlation_hash");
    expect(checkout).toContain("crypto.getRandomValues");
    expect(checkout).toContain('.eq("user_id", user.id)');
    expect(checkout).toContain('.eq("client_request_id", input.clientRequestId)');
  });

  it("returns canonical pricing configuration only after authentication", () => {
    const pricing = source("supabase", "functions", "billing-pricing-config", "index.ts");

    expect(pricing).toContain("auth.getUser()");
    expect(pricing).toContain("readCanonicalPaddlePrice");
    expect(pricing).not.toContain("PAYSTACK_MONTHLY_PLAN_CODE");
    expect(pricing).not.toContain("PAYSTACK_YEARLY_PLAN_CODE");
    expect(pricing).not.toContain("PADDLE_API_KEY");
  });

  it("rotates only the hash when an open checkout is safely reused", () => {
    const checkout = source("supabase", "functions", "paddle-create-checkout", "index.ts");

    expect(checkout).toContain("rotateCorrelationToken");
    expect(checkout).toContain('update({ checkout_correlation_hash: await sha256Hex(correlationToken) })');
    expect(checkout).toContain('.select("id")');
    expect(checkout).toContain("Checkout changed state while it was being reused.");
    expect(checkout).not.toContain("checkout_correlation_token:");
  });

  it("never reuses a Paddle checkout for a different workspace target", () => {
    const checkout = source("supabase", "functions", "paddle-create-checkout", "index.ts");

    expect(checkout).toContain("applyWorkspaceScope");
    expect(checkout).toContain('.eq("artist_workspace_id", existingWorkspace.id)');
    expect(checkout).toContain('.is("artist_workspace_id", null)');
  });

  it("verifies the bounded raw webhook body before durable insertion", () => {
    const webhook = source("supabase", "functions", "paddle-webhook", "index.ts");

    expect(webhook).toContain('request.headers.get("Paddle-Signature")');
    expect(webhook).toContain("await request.text()");
    expect(webhook).toContain("paddle.webhooks.unmarshal(rawBody");
    expect(webhook).toContain('requireEnv("PADDLE_WEBHOOK_SECRET")');
    expect(webhook).toContain('.from("billing_webhook_events")');
    expect(webhook).toContain("EdgeRuntime.waitUntil");
    expect(webhook).not.toMatch(/JSON\.parse\(rawBody\).*unmarshal/s);
  });

  it("processes verified events through the durable claim and fulfillment boundaries", () => {
    const worker = source("supabase", "functions", "paddle-process-webhooks", "index.ts");

    expect(worker).toContain('rpc("claim_billing_webhook_events"');
    expect(worker).toContain('case "transaction.completed"');
    expect(worker).toContain('case "subscription.created"');
    expect(worker).toContain('case "subscription.updated"');
    expect(worker).toContain('case "subscription.canceled"');
    expect(worker).toContain('case "customer.created"');
    expect(worker).toContain('case "customer.updated"');
    expect(worker).toContain('rpc("fulfill_verified_checkout"');
    expect(worker).toContain('phase: "discovery"');
    expect(worker).toContain("sendPaidSubscriptionActivatedEmail");
    expect(worker).toContain("occurred_at");
  });

  it("reclaims crashed workers and rejects multiple recurring transaction items", () => {
    const migration = source("supabase", "migrations", "20260714000200_hardened_multi_provider_billing.sql");
    const worker = source("supabase", "functions", "paddle-process-webhooks", "index.ts");

    expect(migration).toContain("event.processing_status = 'processing'");
    expect(migration).toContain("event.claimed_at < now() - interval '5 minutes'");
    expect(worker).toContain("readRecurringItems");
    expect(worker).toContain("recurringItems.length !== 1");
  });

  it("mints portal sessions only from an authenticated workspace subscription", () => {
    const portal = source("supabase", "functions", "paddle-customer-portal", "index.ts");

    expect(portal).toContain("auth.getUser()");
    expect(portal).toContain('.from("account_memberships")');
    expect(portal).toContain('.from("billing_subscriptions")');
    expect(portal).toContain("customerPortalSessions.create");
    expect(portal).toContain("customer-portal.paddle.com");
    expect(portal).not.toContain("providerCustomerId");
  });

  it("never runs the Paystack verification or repair path for Paddle", () => {
    const status = source("supabase", "functions", "billing-status", "index.ts");

    expect(status).toContain('checkout.provider === "paystack" && input.reference');
    expect(status).toContain('checkout.provider === "paystack" && checkout.status === "paid"');
    expect(status).toContain('.select("provider,status,current_period_end")');
    expect(status).toContain('subscription?.provider === "paddle"');
    expect(status).toContain('["active", "trialing"]');
  });

  it("selects explicit monthly and yearly Nigerian Paystack plans without currency fallbacks", () => {
    const paystack = source("supabase", "functions", "paystack-initialize-checkout", "index.ts");
    expect(paystack).toContain('Deno.env.get("PAYSTACK_MONTHLY_PLAN_CODE")');
    expect(paystack).toContain('requireEnv("PAYSTACK_PLAN_CODE")');
    expect(paystack).toContain('requireEnv("PAYSTACK_YEARLY_PLAN_CODE")');
    expect(paystack).toContain('requireMinorAmountWithLegacy("PAYSTACK_MONTHLY_AMOUNT_MINOR", "PAYSTACK_AMOUNT_MINOR")');
    expect(paystack).toContain('requireMinorAmount("PAYSTACK_YEARLY_AMOUNT_MINOR")');
    expect(paystack).toContain('currency !== "NGN"');
    expect(paystack).not.toContain('?? "USD"');
    expect(paystack).toContain("clientRequestId");
    expect(paystack).toContain("validateCallbackUrl");
    expect(paystack).toContain("provider_price_id: planCode");
  });

  it("reconciles the permanent Paystack catalog through a service-role-only endpoint", () => {
    const catalog = source("supabase", "functions", "paystack-ensure-catalog", "index.ts");
    expect(catalog).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(catalog).toContain("timingSafeEqual");
    expect(catalog).toContain("OrderSounds Pro Monthly NGN");
    expect(catalog).toContain("OrderSounds Pro Yearly NGN");
    expect(catalog).toContain("amount: 3_200_000");
    expect(catalog).toContain("amount: 30_200_000");
    expect(catalog).toContain("https://api.paystack.co/plan");
    expect(catalog).not.toContain("Access-Control-Allow-Origin");
  });

  it("uses origin-aware CORS for authenticated billing endpoints", () => {
    for (const path of ["paystack-initialize-checkout", "billing-status"]) {
      const endpoint = source("supabase", "functions", path, "index.ts");
      expect(endpoint).toContain('request.headers.get("Origin")');
      expect(endpoint).toContain('requireEnv("APP_ORIGIN")');
      expect(endpoint).not.toContain('"Access-Control-Allow-Origin": "*"');
    }
  });

  it("fulfills verified Paystack payments through the same atomic database boundary", () => {
    const shared = source("supabase", "functions", "_shared", "paystackFulfillment.ts");
    const webhook = source("supabase", "functions", "paystack-webhook", "index.ts");
    const status = source("supabase", "functions", "billing-status", "index.ts");

    expect(shared).toContain('rpc("fulfill_verified_checkout"');
    expect(shared).toContain('p_provider: "paystack"');
    expect(shared).toContain("validatePaystackTransaction");
    expect(webhook).toContain("fulfillVerifiedPaystackCheckout");
    expect(status).toContain("fulfillVerifiedPaystackCheckout");
    expect(webhook).not.toContain('rpc("activate_paid_artist_workspace"');
    expect(status).not.toContain('rpc("activate_paid_artist_workspace"');
  });

  it("retries a previously stored failed Paystack delivery without exposing webhook CORS", () => {
    const webhook = source("supabase", "functions", "paystack-webhook", "index.ts");
    expect(webhook).toContain('processing_status === "failed"');
    expect(webhook).toContain('.eq("provider_event_key", providerEventKey)');
    expect(webhook).not.toContain('"Access-Control-Allow-Origin"');
  });

  it("renders activation receipts from provider minor units and the actual billing interval", () => {
    const email = source("supabase", "functions", "_shared", "accessEmails.ts");
    expect(email).toContain("amount_minor");
    expect(email).toContain('interval === "yearly" ? "year" : "month"');
    expect(email).not.toContain("Number(input.checkout.amount)");
  });

  it("exposes webhook and worker endpoints without JWT while protecting the worker with its own secret", () => {
    const config = source("supabase", "config.toml");
    const normalizedConfig = config.replace(/\r\n/g, "\n");
    const worker = source("supabase", "functions", "paddle-process-webhooks", "index.ts");

    expect(normalizedConfig).toContain("[functions.paddle-webhook]\nverify_jwt = false");
    expect(normalizedConfig).toContain("[functions.paddle-process-webhooks]\nverify_jwt = false");
    expect(worker).toContain('requireEnv("BILLING_WORKER_SECRET")');
    expect(worker).toContain('request.headers.get("x-billing-worker-secret")');
  });
});
