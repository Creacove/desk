import { escapeHtml, sendTransactionalEmail } from "./transactionalEmail.ts";

export async function sendPaidSubscriptionActivatedEmail(input: {
  db: any;
  checkout: any;
  workspace: any;
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  // The receipt promises a renewal date, so wait for Paystack's provider date
  // instead of inventing one from local time.
  if (!input.periodEnd) return { status: "skipped" };
  const { data: user, error } = await input.db
    .from("users")
    .select("email,display_name")
    .eq("id", input.checkout.user_id)
    .maybeSingle();
  if (error) throw error;
  if (!user?.email) return { status: "skipped" };

  const activatedAt = input.periodStart ?? input.checkout.paid_at ?? new Date().toISOString();
  const renewalAt = input.periodEnd;
  const amountMinor = Number(input.checkout.amount_minor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !input.checkout.currency) {
    return { status: "skipped" };
  }
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: input.checkout.currency,
  }).format(amountMinor / 100);
  const interval = input.checkout.interval === "yearly" ? "year" : "month";
  const date = (value: string) => new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
  const origin = requireEnv("APP_ORIGIN").replace(/\/$/, "");

  return sendTransactionalEmail({
    db: input.db,
    eventKey: `paid-subscription-activated:${input.checkout.id}`,
    template: "paid_subscription_activated",
    to: user.email,
    userId: input.checkout.user_id,
    subject: "Your OrderSounds subscription is active",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>Your OrderSounds subscription is active</h1><p>Hi ${escapeHtml(user.display_name || "there")},</p><p>${escapeHtml(input.workspace.artist_name || "Your artist")}'s Desk is unlocked.</p><dl><dt>Plan</dt><dd>${escapeHtml(amount)} per ${interval}</dd><dt>Activated</dt><dd>${escapeHtml(date(activatedAt))}</dd>${renewalAt ? `<dt>Next renewal</dt><dd>${escapeHtml(date(renewalAt))}</dd>` : ""}</dl><p><a href="${escapeHtml(origin)}">Open your Desk</a></p><p>Temitope<br>Founder, OrderSounds</p></div>`,
    metadata: {
      checkout_session_id: input.checkout.id,
      artist_workspace_id: input.workspace.artist_workspace_id,
      amount_minor: amountMinor,
      currency: input.checkout.currency,
      activated_at: activatedAt,
      renewal_at: renewalAt ?? null,
    },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
