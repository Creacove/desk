import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPaddleClient, requireEnv } from "../_shared/paddle.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const MAX_WEBHOOK_BYTES = 1_000_000;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return json({ error: "Content-Type must be application/json." }, 415);
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "Webhook body is too large." }, 413);
  }

  const signature = request.headers.get("Paddle-Signature");
  if (!signature) return json({ error: "Missing Paddle signature." }, 401);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
    return json({ error: "Webhook body is too large." }, 413);
  }

  let event: any;
  try {
    const paddle = createPaddleClient();
    event = await paddle.webhooks.unmarshal(rawBody, requireEnv("PADDLE_WEBHOOK_SECRET"), signature);
  } catch {
    return json({ error: "Invalid Paddle signature." }, 401);
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await db.from("billing_webhook_events").upsert({
    provider: "paddle",
    provider_event_key: event.eventId,
    notification_id: event.notificationId,
    provider_reference: readProviderReference(event),
    event_type: event.eventType,
    signature_valid: true,
    processing_status: "received",
    occurred_at: event.occurredAt,
    next_attempt_at: new Date().toISOString(),
    payload: event,
  }, { onConflict: "provider,provider_event_key", ignoreDuplicates: true });
  if (error) return json({ error: "Webhook could not be durably queued." }, 503);

  EdgeRuntime.waitUntil(fetch(`${supabaseUrl}/functions/v1/paddle-process-webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-billing-worker-secret": requireEnv("BILLING_WORKER_SECRET"),
    },
    body: JSON.stringify({ source: "webhook" }),
  }).catch(() => undefined));

  return json({ ok: true });
});

function readProviderReference(event: any) {
  return event?.data?.id ?? event?.data?.subscriptionId ?? event.eventId;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
