import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ConfirmInput = {
  token: string;
  decision: "confirmed" | "rejected";
  confirmationText?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const input = (await request.json()) as ConfirmInput;
    if (!input?.token?.trim()) return json({ error: "Split confirmation token is required." }, 400);
    if (!["confirmed", "rejected"].includes(input.decision)) return json({ error: "Confirmation decision must be confirmed or rejected." }, 400);

    const client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const confirmation_token_hash = await hashToken(input.token.trim());
    const { data: confirmation, error } = await client
      .from("music_split_confirmations")
      .select("id,status,expires_at,account_id,artist_workspace_id,artist_id,music_split_id,music_split_contributor_id")
      .eq("confirmation_token_hash", confirmation_token_hash)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!confirmation) return json({ error: "Split confirmation link was not found." }, 404);
    if (["confirmed", "rejected", "expired", "revoked", "superseded"].includes(confirmation.status)) {
      return json({ error: "Split confirmation link is no longer active." }, 410);
    }
    if (new Date(confirmation.expires_at).getTime() < Date.now()) {
      await client.from("music_split_confirmations").update({ status: "expired" }).eq("id", confirmation.id);
      return json({ error: "Split confirmation link has expired." }, 410);
    }

    const now = new Date().toISOString();
    const rejected = input.decision === "rejected";
    await client.from("music_split_confirmations").update({
      status: input.decision,
      confirmed_at: rejected ? null : now,
      rejected_at: rejected ? now : null,
      confirmation_text: input.confirmationText?.trim() ?? null,
    }).eq("id", confirmation.id);
    await client.from("music_split_contributors").update({
      approval_status: rejected ? "rejected" : "confirmed",
    }).eq("id", confirmation.music_split_contributor_id);

    const { data: contributors, error: contributorsError } = await client
      .from("music_split_contributors")
      .select("approval_status")
      .eq("music_split_id", confirmation.music_split_id);
    if (contributorsError) throw contributorsError;

    const statuses = (contributors ?? []).map((contributor: any) => contributor.approval_status);
    const nextStatus = rejected
      ? "disputed"
      : statuses.every((status) => status === "confirmed")
        ? "cleared"
        : "partially_confirmed";
    const summary = nextStatus === "cleared"
      ? "Split details confirmed by all invited collaborators."
      : nextStatus === "disputed"
        ? "A collaborator rejected the proposed split details."
        : "Split details partially confirmed. Waiting for remaining collaborators.";

    await client.from("music_splits").update({ status: nextStatus, summary }).eq("id", confirmation.music_split_id);
    await client.from("operating_events").insert({
      account_id: confirmation.account_id,
      artist_workspace_id: confirmation.artist_workspace_id,
      artist_id: confirmation.artist_id,
      event_type: rejected ? "music_split_rejected" : "music_split_confirmed",
      actor_type: "user",
      target_type: "music_split",
      target_id: confirmation.music_split_id,
      source_type: "music_split_confirmation",
      source_id: confirmation.id,
      summary: rejected ? "Collaborator rejected split details." : "Collaborator confirmed split details.",
      payload: { status: nextStatus, contributor_id: confirmation.music_split_contributor_id },
    });
    await client.from("operating_events").insert({
      account_id: confirmation.account_id,
      artist_workspace_id: confirmation.artist_workspace_id,
      artist_id: confirmation.artist_id,
      event_type: "music_split_status_changed",
      actor_type: "system",
      target_type: "music_split",
      target_id: confirmation.music_split_id,
      source_type: "music_split_confirmation",
      source_id: confirmation.id,
      summary: `Split status changed to ${nextStatus}.`,
      payload: { status: nextStatus },
    });

    return json({ status: nextStatus });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Split confirmation could not be submitted." }, 500);
  }
});

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
