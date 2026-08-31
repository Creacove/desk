import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPaidSubscriptionActivatedEmail } from "../_shared/accessEmails.ts";
import { ensurePaystackCardSubscription, fulfillVerifiedPaystackCheckout, validatePaystackTransaction } from "../_shared/paystackFulfillment.ts";

type PaystackEvent = {
  event: string;
  data?: Record<string, any>;
};

Deno.serve(withAppErrorCapture("paystack-webhook", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") ?? "";
  const secretKey = requireEnv("PAYSTACK_SECRET_KEY");
  const signatureValid = await verifyPaystackSignature(rawBody, signature, secretKey);

  if (!signatureValid) {
    return json({ error: "Invalid signature." }, 401);
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody) as PaystackEvent;
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(supabaseUrl, serviceRoleKey);
  const providerEventKey = eventKey(event);
  const providerReference = readReference(event);

  const { data: storedEvent, error: storeError } = await db
    .from("billing_webhook_events")
    .upsert(
      {
        provider: "paystack",
        provider_event_key: providerEventKey,
        provider_reference: providerReference,
        event_type: event.event,
        signature_valid: true,
        processing_status: "received",
        payload: event,
      },
      { onConflict: "provider,provider_event_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();

  if (storeError) {
    return json({ error: "Webhook audit failed." }, 500);
  }

  let eventToProcess = storedEvent as { id: string; processing_status?: string } | null;
  if (!eventToProcess) {
    const { data: existingEvent, error: existingError } = await db.from("billing_webhook_events")
      .select("id,processing_status")
      .eq("provider", "paystack")
      .eq("provider_event_key", providerEventKey)
      .maybeSingle();
    if (existingError) return json({ error: "Webhook audit lookup failed." }, 500);
    eventToProcess = existingEvent;
  }

  const retryStoredFailure = eventToProcess?.processing_status === "failed";
  const retryStoredReceived = eventToProcess?.processing_status === "received";
  const processNewDelivery = Boolean(storedEvent?.id);
  if (eventToProcess?.id && (processNewDelivery || retryStoredFailure || retryStoredReceived)) {
    try {
      await processPaystackEvent(db, event, eventToProcess.id, secretKey);
    } catch (error) {
      await recordWebhookFailure(db, eventToProcess.id, error);
      return json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, 500);
    }
  }

  return json({ ok: true });
}));

async function processPaystackEvent(db: any, event: PaystackEvent, webhookEventId: string, secretKey: string) {
  switch (event.event) {
    case "charge.success":
      await activateSubscription(db, event, secretKey);
      break;
    case "subscription.create":
      await mirrorSuccessfulInvoice(db, event);
      break;
    case "invoice.payment_failed":
      await markSubscriptionAttention(db, event, "past_due");
      break;
    case "invoice.update":
      await markInvoiceUpdate(db, event);
      break;
    case "subscription.not_renew":
      await markSubscriptionAttention(db, event, "non-renewing");
      break;
    case "subscription.disable":
      await markSubscriptionAttention(db, event, "inactive");
      break;
    default:
      await db.from("billing_webhook_events").update({
        processing_status: "ignored",
        processed_at: new Date().toISOString(),
      }).eq("id", webhookEventId);
      return;
  }

  await db.from("billing_webhook_events").update({
    processing_status: "processed",
    processed_at: new Date().toISOString(),
  }).eq("id", webhookEventId);
}

async function activateSubscription(db: any, event: PaystackEvent, secretKey: string) {
  const data = event.data ?? {};
  const reference = String(data.reference ?? data.transaction_reference ?? "");
  const metadata = data.metadata ?? {};
  const checkoutSessionId = metadata.checkout_session_id;

  const checkout = await findCheckout(db, checkoutSessionId, reference);
  if (!checkout || checkout.status === "paid") {
    const subscriptionCode = readSubscriptionCode(event);
    if (subscriptionCode) {
      await recordPaystackRenewal(db, event, subscriptionCode);
      return;
    }
    if (checkout?.status === "paid") return;
    throw new Error("Checkout session or subscription not found for Paystack event.");
  }

  const transaction = await ensurePaystackCardSubscription({ db, checkout, transaction: data, secretKey });
  const fulfilled = await fulfillVerifiedPaystackCheckout({ db, checkout, transaction });
  const workspace = {
    account_id: fulfilled.fulfillment.account_id,
    artist_workspace_id: fulfilled.fulfillment.artist_workspace_id,
    artist_name: checkout.selected_artist?.name,
  };

  if (await shouldDispatchSetup(db, checkout.id)) await dispatchPaidSetup(checkout.id);
  await sendPaidSubscriptionActivatedEmail({
    db,
    checkout: fulfilled.checkout,
    workspace,
    periodStart: fulfilled.periodStart,
    periodEnd: fulfilled.periodEnd,
  }).catch(() => undefined);
}

async function findCheckout(db: any, checkoutSessionId: string | undefined, reference: string) {
  if (!checkoutSessionId && !reference) return null;
  const checkoutQuery = db.from("billing_checkout_sessions").select("*");
  const { data: checkout, error } = checkoutSessionId
    ? await checkoutQuery.eq("id", checkoutSessionId).maybeSingle()
    : await checkoutQuery.eq("provider_reference", reference).maybeSingle();
  if (error) throw error;
  return checkout;
}

async function recordPaystackRenewal(db: any, event: PaystackEvent, subscriptionCode: string) {
  const { data: subscription, error: subscriptionError } = await db.from("billing_subscriptions")
    .select("*")
    .eq("provider", "paystack")
    .eq("provider_subscription_code", subscriptionCode)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription?.checkout_session_id) throw new Error("Paystack renewal subscription was not found.");

  const { data: checkout, error: checkoutError } = await db.from("billing_checkout_sessions")
    .select("*")
    .eq("id", subscription.checkout_session_id)
    .maybeSingle();
  if (checkoutError) throw checkoutError;
  if (!checkout) throw new Error("Paystack renewal checkout was not found.");

  const data = event.data ?? {};
  const nestedTransaction = data.transaction && typeof data.transaction === "object" ? data.transaction : {};
  const charge = {
    ...data,
    ...nestedTransaction,
    status: nestedTransaction.status ?? data.status,
    subscription_code: subscriptionCode,
    customer: nestedTransaction.customer ?? data.customer,
    plan: nestedTransaction.plan ?? data.plan,
    period_start: readPeriodStart(event),
    period_end: readPeriodEnd(event),
  };
  const normalized = validatePaystackTransaction(checkout, charge);
  const periodStart = normalized.periodStart ?? normalized.occurredAt;
  const periodEnd = normalized.periodEnd ?? addBillingInterval(periodStart, checkout.plan_interval);
  const { error } = await db.rpc("record_verified_subscription_renewal", {
    p_provider: "paystack",
    p_provider_transaction_id: normalized.transactionId,
    p_provider_subscription_id: subscriptionCode,
    p_provider_customer_id: normalized.customerId,
    p_provider_product_id: subscription.provider_product_id ?? null,
    p_provider_price_id: subscription.provider_price_id ?? subscription.provider_plan_code,
    p_subscription_status: "active",
    p_currency: normalized.currency,
    p_subtotal_minor: normalized.amountMinor,
    p_tax_minor: 0,
    p_total_minor: normalized.amountMinor,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
    p_provider_occurred_at: normalized.occurredAt,
    p_scheduled_change_action: null,
    p_scheduled_change_at: null,
  });
  if (error) throw error;
}

async function shouldDispatchSetup(db: any, checkoutSessionId: string) {
  const { data: setup, error } = await db.from("workspace_setup_runs")
    .select("status")
    .eq("checkout_session_id", checkoutSessionId)
    .maybeSingle();
  if (error) throw error;
  return !setup || setup.status !== "completed";
}

async function dispatchPaidSetup(checkoutSessionId: string) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/functions/v1/paid-workspace-setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ checkoutSessionId, phase: "discovery" }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Paid workspace setup dispatch failed with ${response.status}.`);
  }
}

async function markInvoiceUpdate(db: any, event: PaystackEvent) {
  const status = String(event.data?.status ?? "").toLowerCase();
  if (status.includes("success") || status.includes("paid")) {
    await mirrorSuccessfulInvoice(db, event);
    return;
  }
  await markSubscriptionAttention(db, event, "attention");
}

async function mirrorSuccessfulInvoice(db: any, event: PaystackEvent) {
  const subscriptionCode = readSubscriptionCode(event);
  if (!subscriptionCode) return;
  const periodStart = readPeriodStart(event);
  const periodEnd = readPeriodEnd(event);
  const patch: Record<string, unknown> = {
    status: "active",
    cancel_at_period_end: false,
    last_payment_failed_at: null,
    disabled_at: null,
  };
  if (periodStart) patch.current_period_start = periodStart;
  if (periodEnd) patch.current_period_end = periodEnd;
  const { error } = await db.from("billing_subscriptions")
    .update(patch)
    .eq("provider", "paystack")
    .eq("provider_subscription_code", subscriptionCode);
  if (error) throw error;
}

async function markSubscriptionAttention(db: any, event: PaystackEvent, status: "attention" | "past_due" | "non-renewing" | "inactive") {
  const subscriptionCode = readSubscriptionCode(event);
  if (!subscriptionCode) return;

  await db
    .from("billing_subscriptions")
    .update({
      status,
      cancel_at_period_end: status === "non-renewing",
      last_payment_failed_at: status === "past_due" ? new Date().toISOString() : undefined,
      disabled_at: status === "inactive" ? new Date().toISOString() : undefined,
    })
    .eq("provider", "paystack")
    .eq("provider_subscription_code", subscriptionCode);
}

async function recordWebhookFailure(db: any, webhookEventId: string, error: unknown) {
  await db.from("billing_webhook_events").update({
    processing_status: "failed",
    error: error instanceof Error ? error.message : "Webhook processing failed.",
    processed_at: new Date().toISOString(),
  }).eq("id", webhookEventId);
}

async function verifyPaystackSignature(rawBody: string, signature: string, secretKey: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return timingSafeEqual(toHex(digest), signature);
}

function eventKey(event: PaystackEvent) {
  const reference = readReference(event);
  const subscriptionCode = readSubscriptionCode(event);
  const invoiceCode = event.data?.invoice_code ?? event.data?.invoice?.invoice_code;
  return `${event.event}:${reference ?? subscriptionCode ?? invoiceCode ?? crypto.randomUUID()}`;
}

function readReference(event: PaystackEvent) {
  return event.data?.reference ?? event.data?.transaction_reference ?? event.data?.transaction?.reference ?? event.data?.metadata?.reference ?? null;
}

function readSubscriptionCode(event: PaystackEvent) {
  return event.data?.subscription_code ?? event.data?.subscription?.subscription_code ?? event.data?.subscription?.id ?? null;
}

function readCustomerCode(event: PaystackEvent) {
  return event.data?.customer_code ?? event.data?.customer?.customer_code ?? null;
}

function readPeriodStart(event: PaystackEvent) {
  return event.data?.period_start ?? event.data?.invoice?.period_start ?? event.data?.subscription?.current_period_start ?? null;
}

function readPeriodEnd(event: PaystackEvent) {
  return event.data?.period_end ?? event.data?.invoice?.period_end ?? event.data?.subscription?.current_period_end ?? event.data?.subscription?.next_payment_date ?? null;
}

function addBillingInterval(value: string, interval: unknown) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Paystack renewal period was invalid.");
  if (interval === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString();
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
