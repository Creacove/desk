import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ManagerExecutionInput = {
  permissionRequestId: string;
  managerRunActionId: string;
  executionReceiptId: string;
  executionKey: string;
};

type SendInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId: string;
  appOrigin: string;
  managerExecution?: ManagerExecutionInput;
};

type ManagerExecutionContext = {
  permissionRequestId: string;
  managerRunActionId: string;
  managerRunId: string;
  missionId: string | null;
  executionReceiptId: string;
  executionKey: string;
  actionPayload: Record<string, unknown>;
};

type DeliveryReceipt = {
  contributorId: string;
  email: string;
  confirmationId: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  providerError?: string;
};

Deno.serve(withAppErrorCapture("send-split-confirmations", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const input = (await request.json()) as SendInput;
    validateInput(input);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const workflowDb = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership, error: membershipError } = await client.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);
    await assertActiveWorkspaceEntitlement(client, input);

    const managerContext = input.managerExecution
      ? await loadManagerExecutionContext(workflowDb, input)
      : null;

    const { data: split, error: splitError } = await client
      .from("music_splits")
      .select("id,status,publishing_total,master_total,music_items(title)")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .eq("music_item_id", input.musicItemId)
      .order("created_at", { ascending: false })
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
    if (managerContext) validateFrozenManagerEffect(managerContext, split, contributors ?? [], input.musicItemId);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    const resendApiKey = requireEnv("RESEND_API_KEY");
    const from = Deno.env.get("SPLIT_CONFIRMATION_FROM_EMAIL") ?? "Ordersounds <splits@ordersounds.com>";
    const songTitle = readNestedTitle(split) ?? "Split proposal";
    const sent: string[] = [];
    const failed: string[] = [];
    const deliveries: DeliveryReceipt[] = [];
    const recipients = managerContext
      ? (contributors ?? [])
        .filter((contributor) => String(contributor.approval_status ?? "").toLowerCase() === "draft")
        .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      : (contributors ?? []).filter((contributor) => !["confirmed", "cleared"].includes(String(contributor.approval_status ?? "").toLowerCase()));

    for (const contributor of recipients) {
      const { error: supersedeError } = await client
        .from("music_split_confirmations")
        .update({ status: "superseded" })
        .eq("music_split_id", split.id)
        .eq("music_split_contributor_id", contributor.id)
        .in("status", ["sent", "opened"]);
      if (supersedeError) throw supersedeError;

      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const confirmationTokenHash = await hashToken(token);
      const confirmationUrl = `${input.appOrigin.replace(/\/$/, "")}/split-confirmation?token=${encodeURIComponent(token)}`;

      const { data: confirmation, error: insertError } = await client.from("music_split_confirmations").insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        music_split_id: split.id,
        music_split_contributor_id: contributor.id,
        confirmation_token_hash: confirmationTokenHash,
        status: "sent",
        expires_at: expiresAt,
        created_from_run_id: managerContext?.managerRunId ?? null,
        created_from_action_id: managerContext?.managerRunActionId ?? null,
        manager_action_execution_id: managerContext?.executionReceiptId ?? null,
      }).select("id").single();
      if (insertError) throw insertError;

      const resendIdempotencyKey = managerContext
        ? `${managerContext.executionKey}:contributor:${contributor.id}`
        : null;
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          ...(resendIdempotencyKey ? { "Idempotency-Key": resendIdempotencyKey } : {}),
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
      const providerPayload = await readJsonSafe(emailResponse);
      const providerMessageId = typeof providerPayload?.id === "string" ? providerPayload.id : null;

      if (!emailResponse.ok) {
        const providerError = readProviderError(providerPayload, emailResponse.status);
        failed.push(contributor.email);
        deliveries.push({
          contributorId: String(contributor.id),
          email: String(contributor.email),
          confirmationId: String(confirmation.id),
          status: "failed",
          providerMessageId,
          providerError,
        });
        await client.from("music_split_confirmations")
          .update({ status: "revoked", provider_message_id: providerMessageId })
          .eq("id", confirmation.id);
        continue;
      }

      sent.push(contributor.email);
      deliveries.push({
        contributorId: String(contributor.id),
        email: String(contributor.email),
        confirmationId: String(confirmation.id),
        status: "sent",
        providerMessageId,
      });
      const { error: confirmationUpdateError } = await client
        .from("music_split_confirmations")
        .update({ provider_message_id: providerMessageId })
        .eq("id", confirmation.id);
      if (confirmationUpdateError) throw confirmationUpdateError;

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

    const eventPayload = {
      music_item_id: input.musicItemId,
      recipient_count: sent.length,
      failed_count: failed.length,
      execution_receipt_id: managerContext?.executionReceiptId ?? null,
      deliveries,
    };
    const { error: eventError } = await client.from("operating_events").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      event_type: failed.length ? "music_split_confirmation_partially_sent" : "music_split_confirmation_sent",
      actor_type: managerContext ? "manager" : "user",
      target_type: "music_split",
      target_id: split.id,
      source_type: managerContext ? "manager_action_execution" : "music_split",
      source_id: managerContext?.executionReceiptId ?? split.id,
      manager_synthesis_run_id: managerContext?.managerRunId ?? null,
      manager_run_action_id: managerContext?.managerRunActionId ?? null,
      mission_id: managerContext?.missionId ?? null,
      dedupe_key: managerContext ? `split-confirmation-action:${managerContext.managerRunActionId}` : null,
      summary: failed.length
        ? `Sent ${sent.length} split confirmation${sent.length === 1 ? "" : "s"}; ${failed.length} did not send.`
        : "Sent split confirmation links to collaborators.",
      payload: eventPayload,
    });
    if (eventError && eventError.code !== "23505") throw eventError;

    return json({
      status: failed.length ? "partial" : "sent",
      sent: sent.length,
      failed: failed.length,
      deliveries,
      managerExecution: managerContext
        ? {
          permissionRequestId: managerContext.permissionRequestId,
          managerRunActionId: managerContext.managerRunActionId,
          executionReceiptId: managerContext.executionReceiptId,
        }
        : null,
    });
  } catch (error) {
    return json({ error: errorMessage(error, "Split confirmation links could not be sent.") }, 500);
  }
}));

function validateInput(input: SendInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.musicItemId || !input.appOrigin) {
    throw new Error("Missing required split confirmation input.");
  }
  if (input.managerExecution) {
    const manager = input.managerExecution;
    if (!manager.permissionRequestId || !manager.managerRunActionId || !manager.executionReceiptId || !manager.executionKey) {
      throw new Error("Manager execution identity is incomplete.");
    }
  }
}

async function loadManagerExecutionContext(db: any, input: SendInput): Promise<ManagerExecutionContext> {
  const manager = input.managerExecution!;
  const { data: receipt, error: receiptError } = await db
    .from("manager_action_execution_receipts")
    .select("id,status,execution_key,request_payload,manager_run_action_id,permission_request_id")
    .eq("id", manager.executionReceiptId)
    .eq("manager_run_action_id", manager.managerRunActionId)
    .eq("permission_request_id", manager.permissionRequestId)
    .eq("execution_key", manager.executionKey)
    .maybeSingle();
  if (receiptError) throw receiptError;
  if (!receipt || receipt.status !== "claimed") throw new Error("Manager execution receipt is not claimable.");

  const { data: action, error: actionError } = await db
    .from("manager_run_actions")
    .select("id,manager_synthesis_run_id,action_type,status,approval_required,payload")
    .eq("id", manager.managerRunActionId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (actionError) throw actionError;
  if (!action
    || action.action_type !== "send_split_confirmations"
    || action.status !== "approval_required"
    || action.approval_required !== true) {
    throw new Error("Manager action is not an approved executable split-confirmation effect.");
  }

  const { data: permission, error: permissionError } = await db
    .from("permission_requests")
    .select("id,status,mission_id,parameters,created_from_action_id")
    .eq("id", manager.permissionRequestId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (permissionError) throw permissionError;
  if (!permission
    || permission.status !== "approved"
    || permission.created_from_action_id !== action.id) {
    throw new Error("Manager action does not have matching approved permission.");
  }

  const actionPayload = asRecord(action.payload);
  if (actionPayload.executable !== true || actionPayload.actionKind !== "send_split_confirmations") {
    throw new Error("Manager action payload is not executable.");
  }
  if (String(actionPayload.musicItemId ?? "") !== input.musicItemId) {
    throw new Error("Manager action music item does not match the requested send.");
  }
  if (!sameJson(action.payload, permission.parameters) || !sameJson(action.payload, receipt.request_payload)) {
    throw new Error("Approved Manager effect no longer matches its execution receipt.");
  }

  return {
    permissionRequestId: String(permission.id),
    managerRunActionId: String(action.id),
    managerRunId: String(action.manager_synthesis_run_id),
    missionId: permission.mission_id ? String(permission.mission_id) : null,
    executionReceiptId: String(receipt.id),
    executionKey: String(receipt.execution_key),
    actionPayload,
  };
}

function validateFrozenManagerEffect(
  manager: ManagerExecutionContext,
  split: any,
  contributors: any[],
  musicItemId: string,
) {
  const expected = manager.actionPayload;
  if (String(expected.musicItemId ?? "") !== musicItemId) throw new Error("Approved music item changed before execution.");
  if (String(expected.splitId ?? "") !== String(split.id)) throw new Error("Approved split changed before execution.");
  if (String(expected.splitStatus ?? "") !== String(split.status)) throw new Error("Approved split status changed before execution.");

  const currentRecipients = contributors
    .filter((contributor) => String(contributor.approval_status ?? "").toLowerCase() === "draft")
    .map((contributor) => ({
      contributorId: String(contributor.id),
      name: String(contributor.name ?? ""),
      role: String(contributor.role ?? ""),
      email: String(contributor.email ?? "").trim(),
      publishingShare: String(contributor.publishing_share ?? ""),
      masterShare: String(contributor.master_share ?? ""),
    }))
    .sort((a, b) => a.contributorId.localeCompare(b.contributorId));
  const expectedRecipients = Array.isArray(expected.recipients)
    ? expected.recipients.map((recipient) => {
      const row = asRecord(recipient);
      return {
        contributorId: String(row.contributorId ?? ""),
        name: String(row.name ?? ""),
        role: String(row.role ?? ""),
        email: String(row.email ?? "").trim(),
        publishingShare: String(row.publishingShare ?? ""),
        masterShare: String(row.masterShare ?? ""),
      };
    }).sort((a, b) => a.contributorId.localeCompare(b.contributorId))
    : [];

  if (!sameJson(currentRecipients, expectedRecipients)) {
    throw new Error("Split recipients or shares changed after approval was requested. Desk will not send a different effect under the old approval.");
  }
}

function validateReadyToSend(split: any, contributors: any[]) {
  if (["cleared", "revoked", "superseded"].includes(split.status)) throw new Error("Split proposal cannot be sent.");
  if (!contributors.length) throw new Error("Add split contributors before sending confirmation links.");
  if (contributors.some((contributor) => !String(contributor.email ?? "").trim())) throw new Error("Every contributor needs an email.");
  const publishingTotal = sumShares(contributors.filter((contributor) => contributor.approval_status !== "revoked").map((contributor) => contributor.publishing_share));
  const masterTotal = sumShares(contributors.filter((contributor) => contributor.approval_status !== "revoked").map((contributor) => contributor.master_share));
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

async function readJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function readProviderError(payload: Record<string, unknown> | null, status: number) {
  const message = payload && typeof payload.message === "string" ? payload.message : null;
  const name = payload && typeof payload.name === "string" ? payload.name : null;
  return [name, message].filter(Boolean).join(": ") || `Resend returned HTTP ${status}.`;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(sortJson(left)) === JSON.stringify(sortJson(right));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)]),
  );
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
  const parsed = Number.parseFloat(String(value).replace("%", ""));
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
