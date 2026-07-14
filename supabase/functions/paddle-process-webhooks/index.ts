import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPaddleClient, requireEnv, sha256Hex } from "../_shared/paddle.ts";
import { sendPaidSubscriptionActivatedEmail } from "../_shared/accessEmails.ts";

type QueueEvent = {
  id: string;
  event_type: string;
  occurred_at: string | null;
  attempt_count: number;
  payload: { data?: Record<string, any> };
};

const SUPPORTED_EVENTS = new Set([
  "subscription.created", "subscription.updated", "subscription.canceled",
  "customer.created", "customer.updated", "transaction.completed",
]);

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const suppliedSecret = request.headers.get("x-billing-worker-secret") ?? "";
  const expectedSecret = requireEnv("BILLING_WORKER_SECRET");
  if (!constantTimeEqual(suppliedSecret, expectedSecret)) return json({ error: "Unauthorized." }, 401);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await db.rpc("claim_billing_webhook_events", { p_limit: 10 });
  if (error) return json({ error: "Webhook queue could not be claimed." }, 503);

  const results: Array<{ id: string; status: string }> = [];
  for (const event of (data ?? []) as QueueEvent[]) {
    try {
      if (!SUPPORTED_EVENTS.has(event.event_type)) {
        await finishEvent(db, event.id, "ignored");
        results.push({ id: event.id, status: "ignored" });
        continue;
      }
      await processEvent(db, event, supabaseUrl, serviceRoleKey);
      await finishEvent(db, event.id, "processed");
      results.push({ id: event.id, status: "processed" });
    } catch (processingError) {
      await failEvent(db, event, processingError);
      results.push({ id: event.id, status: "failed" });
    }
  }
  return json({ ok: true, processed: results });
});

async function processEvent(db: any, event: QueueEvent, supabaseUrl: string, serviceRoleKey: string) {
  switch (event.event_type) {
    case "customer.created":
    case "customer.updated":
      return mirrorCustomer(db, event.payload.data ?? {}, event.occurred_at);
    case "subscription.created":
    case "subscription.updated":
    case "subscription.canceled":
      return mirrorSubscription(db, event.payload.data ?? {}, event.occurred_at);
    case "transaction.completed":
      return fulfillCompletedTransaction(db, event.payload.data ?? {}, event.occurred_at, supabaseUrl, serviceRoleKey);
  }
}

async function mirrorCustomer(db: any, customer: Record<string, any>, occurredAt: string | null) {
  if (!customer.id || !customer.email) throw new Error("Paddle customer event is incomplete.");
  const { data: existing, error: existingError } = await db.from("billing_customers")
    .select("last_event_occurred_at").eq("provider", "paddle").eq("provider_customer_id", customer.id).maybeSingle();
  if (existingError) throw existingError;
  if (isOlder(occurredAt, existing?.last_event_occurred_at)) return;
  const { error } = await db.from("billing_customers").upsert({
    provider: "paddle", provider_customer_id: customer.id, email: customer.email,
    provider_created_at: customer.createdAt, provider_updated_at: customer.updatedAt,
    last_event_occurred_at: occurredAt,
  }, { onConflict: "provider,provider_customer_id" });
  if (error) throw error;
}

async function mirrorSubscription(db: any, subscription: Record<string, any>, occurredAt: string | null) {
  if (!subscription.id || !subscription.customerId || !subscription.status) {
    throw new Error("Paddle subscription event is incomplete.");
  }
  const [item] = readRecurringItems(subscription.items);
  if (!item?.price?.id || !item.price.productId) throw new Error("Paddle subscription has no recurring catalog item.");
  const { data: existing, error: existingError } = await db.from("billing_subscriptions")
    .select("last_event_occurred_at").eq("provider", "paddle").eq("provider_subscription_code", subscription.id).maybeSingle();
  if (existingError) throw existingError;
  if (isOlder(occurredAt, existing?.last_event_occurred_at)) return;
  const period = subscription.currentBillingPeriod;
  const scheduled = subscription.scheduledChange;
  const { error } = await db.from("billing_subscriptions").upsert({
    provider: "paddle",
    provider_subscription_code: subscription.id,
    provider_customer_code: subscription.customerId,
    provider_plan_code: item.price.id,
    provider_product_id: item.price.productId,
    provider_price_id: item.price.id,
    status: subscription.status,
    currency: subscription.currencyCode,
    current_period_start: period?.startsAt ?? null,
    current_period_end: period?.endsAt ?? null,
    cancel_at_period_end: scheduled?.action === "cancel",
    scheduled_change_action: scheduled?.action ?? null,
    scheduled_change_at: scheduled?.effectiveAt ?? null,
    provider_created_at: subscription.createdAt,
    provider_updated_at: subscription.updatedAt,
    last_event_occurred_at: occurredAt,
    metadata: { source: "paddle_webhook" },
  }, { onConflict: "provider,provider_subscription_code" });
  if (error) throw error;
}

async function fulfillCompletedTransaction(
  db: any,
  transaction: Record<string, any>,
  occurredAt: string | null,
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  if (transaction.status !== "completed") throw new Error("Paddle transaction is not completed.");
  if (!transaction.id || !transaction.customerId || !transaction.subscriptionId) {
    throw new Error("Paddle recurring transaction identifiers are missing.");
  }
  const customData = transaction.customData ?? {};
  if (customData.version !== 1 || !isUuid(customData.checkoutSessionId) || typeof customData.correlationToken !== "string") {
    throw new Error("Paddle checkout correlation is invalid.");
  }
  const recurringItems = readRecurringItems(transaction.items);
  if (recurringItems.length !== 1) {
    throw new Error("Paddle transaction must contain exactly one recurring plan item.");
  }
  const [item] = recurringItems;
  if (!item?.price?.id || !item.price.productId || item.quantity !== 1) {
    throw new Error("Paddle transaction must contain exactly one recurring plan item.");
  }

  const paddle = createPaddleClient();
  const [subscription, customer] = await Promise.all([
    paddle.subscriptions.get(transaction.subscriptionId),
    paddle.customers.get(transaction.customerId),
  ]) as [any, any];
  const subscriptionItems = readRecurringItems(subscription.items);
  if (subscriptionItems.length !== 1) throw new Error("Paddle subscription must contain exactly one recurring plan item.");
  const [subscriptionItem] = subscriptionItems;
  if (!subscriptionItem?.price?.id || subscriptionItem.price.id !== item.price.id || subscriptionItem.price.productId !== item.price.productId) {
    throw new Error("Paddle subscription catalog does not match the completed transaction.");
  }
  const totals = transaction.details?.totals;
  if (!totals) throw new Error("Paddle transaction totals are missing.");
  const scheduled = subscription.scheduledChange;
  const period = subscription.currentBillingPeriod;
  const { data: fulfilled, error: fulfillmentError } = await db.rpc("fulfill_verified_checkout", {
    p_checkout_session_id: customData.checkoutSessionId,
    p_provider: "paddle",
    p_provider_transaction_id: transaction.id,
    p_provider_customer_id: transaction.customerId,
    p_provider_subscription_id: transaction.subscriptionId,
    p_provider_product_id: item.price.productId,
    p_provider_price_id: item.price.id,
    p_correlation_hash: await sha256Hex(customData.correlationToken),
    p_customer_email: customer.email,
    p_subscription_status: subscription.status,
    p_currency: transaction.currencyCode,
    p_subtotal_minor: toMinor(totals.subtotal),
    p_tax_minor: toMinor(totals.tax),
    p_total_minor: toMinor(totals.total),
    p_current_period_start: period?.startsAt ?? null,
    p_current_period_end: period?.endsAt ?? null,
    p_provider_occurred_at: occurredAt,
    p_scheduled_change_action: scheduled?.action ?? null,
    p_scheduled_change_at: scheduled?.effectiveAt ?? null,
  });
  if (fulfillmentError) throw fulfillmentError;
  const fulfillment = Array.isArray(fulfilled) ? fulfilled[0] : fulfilled;
  if (!fulfillment?.artist_workspace_id) throw new Error("Verified Paddle checkout was not fulfilled.");

  const { data: checkout, error: checkoutError } = await db.from("billing_checkout_sessions")
    .select("*").eq("id", customData.checkoutSessionId).maybeSingle();
  if (checkoutError) throw checkoutError;
  if (!checkout) throw new Error("Fulfilled Paddle checkout could not be reloaded.");
  await sendPaidSubscriptionActivatedEmail({
    db,
    checkout,
    workspace: {
      account_id: fulfillment.account_id,
      artist_workspace_id: fulfillment.artist_workspace_id,
      artist_name: checkout.selected_artist?.name,
    },
    periodStart: period?.startsAt ?? null,
    periodEnd: period?.endsAt ?? null,
  });

  const setupResponse = await fetch(`${supabaseUrl}/functions/v1/paid-workspace-setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ checkoutSessionId: customData.checkoutSessionId, phase: "discovery" }),
  });
  if (!setupResponse.ok) {
    const message = await setupResponse.text().catch(() => "");
    throw new Error(`Discovery dispatch failed (${setupResponse.status}): ${message.slice(0, 300)}`);
  }
}

function readRecurringItems(items: any) {
  return Array.isArray(items) ? items.filter((item) => item?.price?.billingCycle || item?.recurring === true) : [];
}

function isOlder(incoming: string | null, current: string | null | undefined) {
  return Boolean(incoming && current && new Date(incoming).getTime() < new Date(current).getTime());
}

function toMinor(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error("Invalid Paddle minor-unit total.");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Paddle total exceeds the supported range.");
  return number;
}

async function finishEvent(db: any, id: string, status: "processed" | "ignored") {
  const { error } = await db.from("billing_webhook_events").update({
    processing_status: status, processed_at: new Date().toISOString(), claimed_at: null, error: null,
  }).eq("id", id);
  if (error) throw error;
}

async function failEvent(db: any, event: QueueEvent, error: unknown) {
  const exponent = Math.min(Math.max(event.attempt_count, 1), 8);
  const delaySeconds = Math.min(3600, 2 ** exponent * 15);
  await db.from("billing_webhook_events").update({
    processing_status: "failed",
    claimed_at: null,
    next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    error: error instanceof Error ? error.message.slice(0, 2000) : "Webhook processing failed.",
  }).eq("id", event.id);
}

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
