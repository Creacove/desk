import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const { token } = await request.json();
    if (!String(token ?? "").trim()) return json({ error: "Split confirmation token is required." }, 400);

    const client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const confirmation_token_hash = await hashToken(String(token).trim());
    const { data: confirmation, error } = await client
      .from("music_split_confirmations")
      .select("id,status,expires_at,music_split_id,music_split_contributor_id")
      .eq("confirmation_token_hash", confirmation_token_hash)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!confirmation) return json({ error: "Split confirmation link was not found." }, 404);
    if (["expired", "revoked", "superseded"].includes(confirmation.status)) return json({ error: "Split confirmation link is no longer active." }, 410);
    if (new Date(confirmation.expires_at).getTime() < Date.now()) return json({ error: "Split confirmation link has expired." }, 410);

    await client.from("music_split_confirmations").update({ status: confirmation.status === "sent" ? "opened" : confirmation.status }).eq("id", confirmation.id);

    const [{ data: split, error: splitError }, { data: contributor, error: contributorError }, { data: contributors, error: contributorsError }] = await Promise.all([
      client.from("music_splits").select("id,music_item_id,music_items(title)").eq("id", confirmation.music_split_id).maybeSingle(),
      client.from("music_split_contributors").select("id,name,role,publishing_share,master_share,approval_status").eq("id", confirmation.music_split_contributor_id).maybeSingle(),
      client.from("music_split_contributors").select("name,role,publishing_share,master_share,approval_status").eq("music_split_id", confirmation.music_split_id),
    ]);
    if (splitError) throw splitError;
    if (contributorError) throw contributorError;
    if (contributorsError) throw contributorsError;
    if (!split || !contributor) return json({ error: "Split confirmation scope is incomplete." }, 404);

    return json({
      songTitle: readNestedTitle(split) ?? "Split proposal",
      contributorName: contributor.name,
      contributorRole: contributor.role,
      publishingShare: contributor.publishing_share,
      masterShare: contributor.master_share,
      status: confirmation.status,
      contributors: (contributors ?? []).map((item: any) => ({
        name: item.name,
        role: item.role,
        publishingShare: item.publishing_share,
        masterShare: item.master_share,
        approval: item.approval_status,
      })),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Split confirmation could not be loaded." }, 500);
  }
});

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
