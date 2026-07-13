import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPaidSubscriptionActivatedEmail } from "../_shared/accessEmails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PaystackEvent = {
  event: string;
  data?: Record<string, any>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
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

  if (storedEvent?.id) {
    try {
      await processPaystackEvent(db, event, storedEvent.id);
    } catch (error) {
      await recordWebhookFailure(db, storedEvent.id, error);
      return json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, 500);
    }
  }

  return json({ ok: true });
});

async function processPaystackEvent(db: any, event: PaystackEvent, webhookEventId: string) {
  switch (event.event) {
    case "charge.success":
    case "subscription.create":
      await activateSubscription(db, event);
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

async function activateSubscription(db: any, event: PaystackEvent) {
  const data = event.data ?? {};
  const reference = String(data.reference ?? data.transaction_reference ?? "");
  const metadata = data.metadata ?? {};
  const checkoutSessionId = metadata.checkout_session_id;

  const checkoutQuery = db.from("billing_checkout_sessions").select("*");
  const { data: checkout, error: checkoutError } = checkoutSessionId
    ? await checkoutQuery.eq("id", checkoutSessionId).maybeSingle()
    : await checkoutQuery.eq("provider_reference", reference).maybeSingle();
  if (checkoutError) throw checkoutError;
  if (!checkout) throw new Error("Checkout session not found for Paystack event.");

  validatePaystackAmount(checkout, data);

  const subscriptionCode = readSubscriptionCode(event) ?? `paystack_charge_${reference}`;
  const customerCode = readCustomerCode(event);
  const periodEnd = readPeriodEnd(event);
  const periodStart = readPeriodStart(event);

  await db.from("billing_checkout_sessions").update({
    status: "paid",
    provider_customer_code: customerCode,
    provider_subscription_code: subscriptionCode,
    paid_at: new Date().toISOString(),
  }).eq("id", checkout.id);

  const { data: activated, error: activationError } = await db.rpc("activate_paid_artist_workspace", {
    p_checkout_session_id: checkout.id,
  });
  if (activationError) throw activationError;
  const workspace = Array.isArray(activated) ? activated[0] : activated;
  if (!workspace?.account_id || !workspace?.artist_workspace_id) {
    throw new Error("activate_paid_artist_workspace did not return a workspace.");
  }

  const { error: subscriptionError } = await db.from("billing_subscriptions").upsert(
    {
      account_id: workspace.account_id,
      artist_workspace_id: workspace.artist_workspace_id,
      user_id: checkout.user_id,
      checkout_session_id: checkout.id,
      provider: "paystack",
      provider_subscription_code: subscriptionCode,
      provider_customer_code: customerCode,
      provider_plan_code: checkout.provider_plan_code,
      amount_minor: checkout.amount_minor,
      amount: checkout.amount,
      currency: checkout.currency,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      metadata: { source_event: event.event },
    },
    { onConflict: "provider,provider_subscription_code" },
  );
  if (subscriptionError) throw subscriptionError;

  await dispatchPaidSetup(checkout.id);
  await sendPaidSubscriptionActivatedEmail({
    db,
    checkout: { ...checkout, paid_at: new Date().toISOString() },
    workspace,
    periodStart,
    periodEnd,
  }).catch(() => undefined);
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
    await activateSubscription(db, event);
    return;
  }
  await markSubscriptionAttention(db, event, "attention");
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

function validatePaystackAmount(checkout: any, data: Record<string, any>) {
  const paidAmount = Number(data.amount ?? checkout.amount_minor);
  const paidCurrency = String(data.currency ?? checkout.currency).toUpperCase();
  if (paidAmount !== Number(checkout.amount_minor)) {
    throw new Error("Paystack amount did not match checkout session.");
  }
  if (paidCurrency !== String(checkout.currency).toUpperCase()) {
    throw new Error("Paystack currency did not match checkout session.");
  }
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
  return event.data?.period_start ?? event.data?.subscription?.current_period_start ?? null;
}

function readPeriodEnd(event: PaystackEvent) {
  return event.data?.period_end ?? event.data?.subscription?.current_period_end ?? event.data?.subscription?.next_payment_date ?? null;
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
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
