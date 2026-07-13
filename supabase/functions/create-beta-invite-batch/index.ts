import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sendTransactionalEmail } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${serviceRoleKey}`) {
      return json({ error: "Forbidden." }, 403);
    }

    const input = await request.json();
    const partner = String(input?.partner ?? "").trim();
    const recipient = String(input?.recipient ?? "").trim().toLowerCase();
    const quantity = Number(input?.quantity);
    const expiresAt = input?.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!partner || !recipient.includes("@") || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || Number.isNaN(expiresAt.getTime())) {
      return json({ error: "Partner, valid recipient, and quantity from 1 to 100 are required." }, 400);
    }

    const db = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });
    const codes = await Promise.all(Array.from({ length: quantity }, () => generateCode()));
    const { data: batch, error: batchError } = await db.from("private_beta_batches").insert({
      partner_name: partner,
      recipient_email: recipient,
      quantity,
      expires_at: expiresAt.toISOString(),
    }).select("id,expires_at").single();
    if (batchError) throw batchError;

    const records = await Promise.all(codes.map(async (code) => ({
      batch_id: batch.id,
      code_hash: await sha256(code),
      code_hint: `${code.slice(0, 5)}…${code.slice(-4)}`,
    })));
    const { error: codeError } = await db.from("private_beta_codes").insert(records);
    if (codeError) {
      await db.from("private_beta_batches").delete().eq("id", batch.id);
      throw codeError;
    }

    let emailStatus = "sent";
    try {
      await sendTransactionalEmail({
        db,
        eventKey: `private-beta-invitation:${batch.id}`,
        template: "private_beta_invitation",
        to: recipient,
        subject: quantity === 1 ? "Your OrderSounds private-beta access code" : "Your OrderSounds private-beta access codes",
        html: renderInvitation({ partner, codes, signupUrl: `${requireEnv("APP_ORIGIN").replace(/\/$/, "")}/`, expiresAt }),
        metadata: { batch_id: batch.id, quantity },
      });
    } catch {
      emailStatus = "failed";
    }

    return json({
      batchId: batch.id,
      codeCount: quantity,
      codes,
      invitationExpiresAt: batch.expires_at,
      emailStatus,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invitation batch could not be created." }, 500);
  }
});

function renderInvitation(input: { partner: string; codes: string[]; signupUrl: string; expiresAt: Date }) {
  const plural = input.codes.length > 1;
  const list = input.codes.map((code) => `<li><code style="font-size:16px">${escapeHtml(code)}</code></li>`).join("");
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>${plural ? "Your private-beta access codes" : "Your private-beta access code"}</h1><p>Hi ${escapeHtml(input.partner)},</p><p>${plural ? `Here are ${input.codes.length} separate OrderSounds seats for you and your community. Each code can be used once by one person.` : "Here is your single-use OrderSounds private-beta invitation."}</p><ul>${list}</ul><p>Each successful redemption provides 30 days of complimentary access. No card is required and nobody is charged automatically.</p><p><a href="${escapeHtml(input.signupUrl)}">Create an OrderSounds account</a>, select an artist, then choose <strong>Have a private-beta code?</strong> at the paywall.</p><p>Unused codes expire on ${escapeHtml(new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(input.expiresAt))}.</p></div>`;
}

async function generateCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const body = [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
  return `BETA-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.toUpperCase()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
