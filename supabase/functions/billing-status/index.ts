import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type BillingStatusInput = {
  reference?: string;
  latestOpenCheckout?: boolean;
  checkoutSessionId?: string;
  retrySetup?: boolean;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);

    const input = (await request.json()) as BillingStatusInput;
    const checkout = await findCheckout(serviceClient, input, user.id);
    if (!checkout) {
      return json({
        checkoutStatus: "missing",
        subscriptionStatus: "none",
        entitlementActive: false,
        setupStatus: "not_started",
        message: "No checkout session was found.",
      });
    }

    if (input.retrySetup && checkout.status === "paid") {
      await serviceClient.rpc("activate_paid_artist_workspace", { p_checkout_session_id: checkout.id });
    }

    const [subscriptionResult, setupResult, workspaceResult] = await Promise.all([
      checkout.artist_workspace_id
        ? serviceClient
            .from("billing_subscriptions")
            .select("status,current_period_end")
            .eq("artist_workspace_id", checkout.artist_workspace_id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      checkout.artist_workspace_id
        ? serviceClient
            .from("workspace_setup_runs")
            .select("status,current_stage,last_error")
            .eq("checkout_session_id", checkout.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      checkout.artist_workspace_id ? loadWorkspace(serviceClient, checkout.artist_workspace_id) : Promise.resolve(null),
    ]);

    if (subscriptionResult.error) throw subscriptionResult.error;
    if (setupResult.error) throw setupResult.error;

    const subscription = subscriptionResult.data;
    const entitlementActive = Boolean(
      subscription &&
        ["active", "non-renewing", "attention"].includes(subscription.status) &&
        (!subscription.current_period_end || new Date(subscription.current_period_end).getTime() > Date.now()),
    );

    const response = {
      checkoutSessionId: checkout.id,
      checkoutStatus: checkout.status,
      subscriptionStatus: subscription?.status ?? "none",
      entitlementActive,
      setupStatus: setupResult.data?.status ?? (checkout.status === "paid" ? "queued" : "not_started"),
      setupStage: setupResult.data?.current_stage,
      workspace: workspaceResult,
      authorizationUrl: checkout.authorization_url,
      accessCode: checkout.access_code,
      message: setupResult.data?.last_error ?? undefined,
      preview: toPreview(checkout),
    };

    return json(response);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Billing status could not be loaded." }, 500);
  }
});

async function findCheckout(serviceClient: any, input: BillingStatusInput, userId: string) {
  const baseQuery = serviceClient.from("billing_checkout_sessions").select("*").eq("user_id", userId);
  if (input.reference) {
    const { data, error } = await baseQuery.eq("provider_reference", input.reference).maybeSingle();
    if (error) throw error;
    return data;
  }
  if (input.checkoutSessionId) {
    const { data, error } = await baseQuery.eq("id", input.checkoutSessionId).maybeSingle();
    if (error) throw error;
    return data;
  }
  if (input.latestOpenCheckout) {
    const { data, error } = await baseQuery
      .in("status", ["open", "initialized"])
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
  return null;
}

async function loadWorkspace(serviceClient: any, artistWorkspaceId: string) {
  const { data, error } = await serviceClient
    .from("artist_workspaces")
    .select(`
      id,
      account_id,
      artist_id,
      name,
      status,
      artists(display_name, canonical_spotify_artist_id, canonical_spotify_url),
      artist_profiles(spotify_identity, artist_direction, current_goal, budget_context),
      source_sync_jobs(status, created_at)
    `)
    .eq("id", artistWorkspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const artist = Array.isArray(data.artists) ? data.artists[0] : data.artists;
  const profile = Array.isArray(data.artist_profiles) ? data.artist_profiles[0] : data.artist_profiles;
  const latestSync = [...(data.source_sync_jobs ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];

  return {
    accountId: data.account_id,
    artistWorkspaceId: data.id,
    artistId: data.artist_id,
    artistName: artist?.display_name ?? data.name,
    workspaceName: data.name,
    status: data.status,
    spotifyConnected: Boolean(artist?.canonical_spotify_artist_id),
    spotifyArtistId: artist?.canonical_spotify_artist_id ?? undefined,
    spotifyArtistName: artist?.display_name ?? undefined,
    spotifyArtistUrl: artist?.canonical_spotify_url ?? undefined,
    spotifyImageUrl: profile?.spotify_identity?.imageUrl ?? undefined,
    contextComplete: Boolean(profile?.artist_direction || profile?.current_goal || profile?.budget_context),
    latestCatalogSyncStatus: latestSync?.status,
  };
}

function toPreview(checkout: any) {
  return {
    checkoutSessionId: checkout.id,
    reference: checkout.provider_reference,
    status: checkout.status,
    artist: checkout.selected_artist,
    amount: Number(checkout.amount),
    amountMinor: Number(checkout.amount_minor),
    currency: checkout.currency,
    interval: checkout.interval,
    expiresAt: checkout.expires_at,
    authorizationUrl: checkout.authorization_url,
    accessCode: checkout.access_code,
  };
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
