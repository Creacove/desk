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
  if (Deno.env.get("PRIVATE_BETA_ENABLED") !== "true") return json({ error: "Private beta access is unavailable." }, 404);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const input = await request.json();
    const checkoutSessionId = String(input?.checkoutSessionId ?? "").trim();
    const code = String(input?.code ?? "").trim().toUpperCase();
    if (!checkoutSessionId || !code || code.length > 128) return json({ error: "Checkout session and invitation code are required." }, 400);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await auth.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);

    const db = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });
    const { data, error } = await db.rpc("activate_beta_artist_workspace", {
      p_checkout_session_id: checkoutSessionId,
      p_code: code,
      p_user_id: user.id,
    });
    if (error) return json({ error: safeRedemptionError(error.message) }, 400);
    const workspace = Array.isArray(data) ? data[0] : data;
    if (!workspace?.artist_workspace_id) throw new Error("Private-beta activation did not create a workspace.");

    let setupStatus: "queued" | "running" | "failed" = "running";
    let message: string | undefined;
    const setup = await invokeFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "paid-workspace-setup",
      body: { checkoutSessionId, phase: "discovery" },
    }).catch((setupError) => ({ error: setupError instanceof Error ? setupError.message : "Setup dispatch failed." }));
    if ((setup as any)?.error) {
      setupStatus = "failed";
      message = "Access activated; setup needs retry.";
    }

    await sendTransactionalEmail({
      db,
      eventKey: `private-beta-activated:${workspace.artist_workspace_id}:${user.id}`,
      template: "private_beta_activated",
      to: user.email ?? "",
      userId: user.id,
      subject: "Welcome to the OrderSounds private beta",
      html: renderBetaWelcome({
        firstName: user.user_metadata?.first_name,
        artistName: workspace.artist_name,
        accessEndsAt: workspace.access_ends_at,
        deskUrl: `${requireEnv("APP_ORIGIN").replace(/\/$/, "")}/`,
      }),
      metadata: { artist_workspace_id: workspace.artist_workspace_id, access_ends_at: workspace.access_ends_at },
    }).catch(() => undefined);

    return json({
      workspace: mapWorkspace(workspace),
      setupStatus,
      accessEndsAt: workspace.access_ends_at,
      message,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Private-beta activation failed." }, 500);
  }
});

function mapWorkspace(row: any) {
  return {
    accountId: row.account_id,
    artistWorkspaceId: row.artist_workspace_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    workspaceName: row.workspace_name,
    status: row.status,
    spotifyConnected: row.spotify_connected,
    spotifyArtistId: row.spotify_artist_id,
    spotifyArtistName: row.spotify_artist_name,
    spotifyArtistUrl: row.spotify_artist_url,
    spotifyImageUrl: row.spotify_image_url,
    contextComplete: row.context_complete,
    latestCatalogSyncStatus: row.latest_catalog_sync_status,
    entitlementActive: row.entitlement_active,
    subscriptionStatus: row.subscription_status,
    setupStatus: row.setup_status,
    setupStage: row.setup_stage,
    accessType: row.access_type,
    accessStatus: row.access_status,
    accessStartsAt: row.access_starts_at,
    accessEndsAt: row.access_ends_at,
  };
}

function renderBetaWelcome(input: { firstName?: string; artistName: string; accessEndsAt: string; deskUrl: string }) {
  const expiry = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(input.accessEndsAt));
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>Welcome to the OrderSounds private beta</h1><p>Hi ${escapeHtml(input.firstName || "there")},</p><p>Your invitation is active for ${escapeHtml(input.artistName)} until <strong>${escapeHtml(expiry)}</strong>.</p><p>No card is required, and you will not be charged automatically when access expires.</p><p><a href="${escapeHtml(input.deskUrl)}">Open your Desk</a></p><p>Reply to this email with anything useful, confusing, or missing.</p><p>Temitope<br>Founder, OrderSounds</p></div>`;
}

function safeRedemptionError(message: string) {
  if (message.toLowerCase().includes("subscription is already active")) return "Your subscription is already active.";
  if (message.toLowerCase().includes("checkout session")) return "This artist checkout is no longer available. Select the artist again.";
  return "This invitation code is invalid, expired or has already been used.";
}

async function invokeFunction(input: { supabaseUrl: string; serviceRoleKey: string; functionName: string; body: unknown }) {
  const response = await fetch(`${input.supabaseUrl}/functions/v1/${input.functionName}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(input.body),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.error ?? "Setup dispatch failed."));
  return body;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
