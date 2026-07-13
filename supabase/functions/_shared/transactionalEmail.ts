type DatabaseClient = {
  from: (table: string) => any;
};

export type TransactionalEmailInput = {
  db: DatabaseClient;
  eventKey: string;
  template: string;
  to: string;
  subject: string;
  html: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const existing = await input.db
    .from("transactional_email_deliveries")
    .select("id,status,provider_message_id")
    .eq("event_key", input.eventKey)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.status === "sent") {
    return { status: "sent", id: existing.data.provider_message_id, deduplicated: true };
  }

  const delivery = existing.data ?? (await input.db
    .from("transactional_email_deliveries")
    .insert({
      event_key: input.eventKey,
      template: input.template,
      recipient_email: input.to,
      user_id: input.userId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id,status")
    .single()).data;

  if (!delivery?.id) {
    const raced = await input.db
      .from("transactional_email_deliveries")
      .select("id,status,provider_message_id")
      .eq("event_key", input.eventKey)
      .single();
    if (raced.error) throw raced.error;
    if (raced.data.status === "sent") {
      return { status: "sent", id: raced.data.provider_message_id, deduplicated: true };
    }
  }

  const deliveryId = delivery?.id ?? existing.data?.id;
  const resendApiKey = requireEnv("RESEND_API_KEY");
  const from = requireEnv("ORDERSOUNDS_FROM_EMAIL");
  const replyTo = requireEnv("ORDERSOUNDS_REPLY_TO_EMAIL");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.eventKey,
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(body?.message ?? `Resend failed with ${response.status}.`));

    await input.db.from("transactional_email_deliveries").update({
      status: "sent",
      provider_message_id: body?.id ?? null,
      attempts: (existing.data?.attempts ?? 0) + 1,
      last_error: null,
      sent_at: new Date().toISOString(),
    }).eq("id", deliveryId);
    return { status: "sent", id: body?.id ?? null, deduplicated: false };
  } catch (error) {
    await input.db.from("transactional_email_deliveries").update({
      status: "failed",
      attempts: (existing.data?.attempts ?? 0) + 1,
      last_error: error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed.",
    }).eq("id", deliveryId);
    throw error;
  }
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
