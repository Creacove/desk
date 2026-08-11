import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SendInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId: string;
  appOrigin: string;
};

Deno.serve(withAppErrorCapture("send-split-confirmations", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const input = (await request.json()) as SendInput;
    validateInput(input);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: membership, error: membershipError } = await client.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);
    await assertActiveWorkspaceEntitlement(client, input);

    const { data: split, error: splitError } = await client
      .from("music_splits")
      .select("id,status,publishing_total,master_total,music_items(title)")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("music_item_id", input.musicItemId)
      .limit(1)
      .maybeSingle();
    if (splitError) throw splitError;
    if (!split) return json({ error: "Split proposal not found." }, 404);

    const { data: contributors, error: contributorError } = await client
      .from("music_split_contributors")
      .select("id,name,role,email,publishing_share,master_share,approval_status")
      .eq("music_split_id", split.id);
    if (contributorError) throw contributorError;

    validateReadyToSend(split, contributors ?? []);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const resendApiKey = requireEnv("RESEND_API_KEY");
    const from = Deno.env.get("SPLIT_CONFIRMATION_FROM_EMAIL") ?? "Ordersounds <splits@ordersounds.com>";
    const songTitle = readNestedTitle(split) ?? "Split proposal";
    const sent: string[] = [];
    const failed: string[] = [];
    const recipients = (contributors ?? []).filter((contributor) => !["confirmed", "cleared"].includes(String(contributor.approval_status ?? "").toLowerCase()));

    for (const contributor of recipients) {
      const { error: supersedeError } = await client
        .from("music_split_confirmations")
        .update({ status: "superseded" })
        .eq("music_split_id", split.id)
        .eq("music_split_contributor_id", contributor.id)
        .in("status", ["sent", "opened"]);
      if (supersedeError) throw supersedeError;
      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const confirmation_token_hash = await hashToken(token);
      const confirmationUrl = `${input.appOrigin.replace(/\/$/, "")}/split-confirmation?token=${encodeURIComponent(token)}`;

      const { error: insertError } = await client.from("music_split_confirmations").insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        music_split_id: split.id,
        music_split_contributor_id: contributor.id,
        confirmation_token_hash,
        status: "sent",
        expires_at: expiresAt,
      });
      if (insertError) throw insertError;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: contributor.email,
          subject: `Confirm split details for ${songTitle}`,
          html: renderEmail({
            songTitle,
            contributorName: contributor.name,
            contributorRole: contributor.role,
            publishingShare: formatShare(contributor.publishing_share),
            masterShare: formatShare(contributor.master_share),
            expiresAt,
            confirmationUrl,
          }),
        }),
      });
      if (!emailResponse.ok) {
        failed.push(contributor.email);
        await client.from("music_split_confirmations").update({ status: "revoked" }).eq("confirmation_token_hash", confirmation_token_hash);
        continue;
      }
      sent.push(contributor.email);
      const { error: contributorStatusError } = await client
        .from("music_split_contributors")
        .update({ approval_status: "pending" })
        .eq("id", contributor.id);
      if (contributorStatusError) throw contributorStatusError;
    }

    if (sent.length) {
      const { error: updateSplitError } = await client.from("music_splits").update({
        status: "pending_confirmation",
        summary: failed.length
          ? `Sent ${sent.length} split request${sent.length === 1 ? "" : "s"}. ${failed.length} still need to be sent.`
          : "Split confirmation links sent. Waiting for collaborators to confirm their shares.",
      }).eq("id", split.id);
      if (updateSplitError) throw updateSplitError;
    }
    const { error: eventError } = await client.from("operating_events").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      event_type: "music_split_confirmation_sent",
      actor_type: "user",
      target_type: "music_split",
      target_id: split.id,
      summary: "Sent split confirmation links to collaborators.",
      payload: { music_item_id: input.musicItemId, recipient_count: sent.length, failed_count: failed.length },
    });
    if (eventError) throw eventError;

    return json({ status: "sent", sent: sent.length, failed: failed.length });
  } catch (error) {
    return json({ error: errorMessage(error, "Split confirmation links could not be sent.") }, 500);
  }
}));

function validateInput(input: SendInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.musicItemId || !input.appOrigin) {
    throw new Error("Missing required split confirmation input.");
  }
}

function validateReadyToSend(split: any, contributors: any[]) {
  if (["cleared", "revoked", "superseded"].includes(split.status)) throw new Error("Split proposal cannot be sent.");
  if (!contributors.length) throw new Error("Add split contributors before sending confirmation links.");
  if (contributors.some((contributor) => !String(contributor.email ?? "").trim())) throw new Error("Every contributor needs an email.");
  const publishingTotal = sumShares(contributors.map((contributor) => contributor.publishing_share));
  const masterTotal = sumShares(contributors.map((contributor) => contributor.master_share));
  if (publishingTotal !== 100 || masterTotal !== 100) throw new Error("Publishing and master split totals must both equal 100%.");
}

function renderEmail({
  songTitle,
  contributorName,
  contributorRole,
  publishingShare,
  masterShare,
  expiresAt,
  confirmationUrl,
}: {
  songTitle: string;
  contributorName: string;
  contributorRole: string;
  publishingShare: string;
  masterShare: string;
  expiresAt: string;
  confirmationUrl: string;
}) {
  const expiry = new Date(expiresAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
  return `
    <div style="margin:0 auto;max-width:560px;font-family:Arial,sans-serif;line-height:1.55;color:#111318">
      <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6f42c1">Ordersounds · Song rights</p>
      <h1 style="font-size:24px;line-height:1.2">Review your shares for ${escapeHtml(songTitle)}</h1>
      <p>Hi ${escapeHtml(contributorName)}, the artist team listed you as <strong>${escapeHtml(contributorRole)}</strong>.</p>
      <table role="presentation" style="width:100%;margin:20px 0;border-collapse:collapse"><tr>
        <td style="width:50%;padding:14px;border:1px solid #e4e4e7"><span style="font-size:12px;color:#667085">Publishing</span><br><strong style="font-size:22px">${escapeHtml(publishingShare)}</strong></td>
        <td style="width:50%;padding:14px;border:1px solid #e4e4e7"><span style="font-size:12px;color:#667085">Master</span><br><strong style="font-size:22px">${escapeHtml(masterShare)}</strong></td>
      </tr></table>
      <p><a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;background:#111318;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Review split</a></p>
      <p style="font-size:12px;color:#667085">This request expires ${escapeHtml(expiry)}. Review the complete allocation before confirming.</p>
      <p style="font-size:11px;color:#667085;word-break:break-all">If the button does not open, copy this link:<br>${escapeHtml(confirmationUrl)}</p>
    </div>
  `;
}

function formatShare(value: number | string) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value).replace("%", ""));
  return `${Number.isFinite(parsed) ? parsed : 0}%`;
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readNestedTitle(split: any) {
  const relation = split.music_items;
  if (Array.isArray(relation)) return relation[0]?.title;
  return relation?.title;
}

function sumShares(values: Array<number | string>) {
  return Number(values.reduce<number>((sum, value) => sum + parseShare(value), 0).toFixed(2));
}

function parseShare(value: number | string) {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character] ?? character));
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
