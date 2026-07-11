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
    let checkout = await findCheckout(serviceClient, input, user.id);
    if (!checkout) {
      return json({
        checkoutStatus: "missing",
        subscriptionStatus: "none",
        entitlementActive: false,
        setupStatus: "not_started",
        message: "No checkout session was found.",
      });
    }

    let setupDispatched = false;
    if (input.reference && checkout.status !== "paid") {
      const verified = await verifyPaystackTransaction(input.reference, requireEnv("PAYSTACK_SECRET_KEY"));
      if (verified) {
        const activated = await activateVerifiedPaystackCheckout({
          serviceClient,
          checkout,
          transaction: verified,
          supabaseUrl,
          serviceRoleKey,
          source: "billing_status_verify",
        });
        checkout = activated.checkout;
        setupDispatched = setupDispatched || activated.setupDispatched;
      }
    }

    if (checkout.status === "paid") {
      const repaired = await ensureActiveSubscriptionForCheckout({
        serviceClient,
        checkout,
        supabaseUrl,
        serviceRoleKey,
        source: "billing_status_repair",
      });
      checkout = repaired.checkout;
      setupDispatched = setupDispatched || repaired.setupDispatched;
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

    let retryDispatched = false;
    if (input.retrySetup && checkout.status === "paid" && checkout.artist_workspace_id) {
      await invokeSetupFunction({
        supabaseUrl,
        serviceRoleKey,
        functionName: "paid-workspace-setup",
        body: {
          checkoutSessionId: checkout.id,
          phase: setupResult.data?.current_stage === "setup_brief" ? "contextualize" : "discovery",
        },
      });
      retryDispatched = true;
    }

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
      setupStatus: retryDispatched || setupDispatched ? "running" : setupResult.data?.status ?? (checkout.status === "paid" ? "queued" : "not_started"),
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

async function invokeSetupFunction({ supabaseUrl, serviceRoleKey, functionName, body }: {
  supabaseUrl: string;
  serviceRoleKey: string;
  functionName: "paid-workspace-setup";
  body: Record<string, unknown>;
}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Paid workspace setup retry failed with ${response.status}.`);
  }
}

async function verifyPaystackTransaction(reference: string, secretKey: string) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `Paystack verification failed with ${response.status}.`);
  }
  const payload = await response.json().catch(() => null) as { status?: boolean; data?: Record<string, any> } | null;
  const data = payload?.data;
  const status = String(data?.status ?? "").toLowerCase();
  if (payload?.status !== true || !["success", "successful"].includes(status)) {
    return null;
  }
  return data;
}

async function activateVerifiedPaystackCheckout({ serviceClient, checkout, transaction, supabaseUrl, serviceRoleKey, source }: {
  serviceClient: any;
  checkout: any;
  transaction: Record<string, any>;
  supabaseUrl: string;
  serviceRoleKey: string;
  source: string;
}) {
  validatePaystackAmount(checkout, transaction);
  const providerSubscriptionCode = readSubscriptionCode(transaction) ?? checkout.provider_subscription_code ?? `paystack_charge_${checkout.provider_reference}`;
  const providerCustomerCode = readCustomerCode(transaction) ?? checkout.provider_customer_code;
  const { data: updatedCheckout, error: updateError } = await serviceClient
    .from("billing_checkout_sessions")
    .update({
      status: "paid",
      provider_customer_code: providerCustomerCode,
      provider_subscription_code: providerSubscriptionCode,
      paid_at: checkout.paid_at ?? new Date().toISOString(),
    })
    .eq("id", checkout.id)
    .select("*")
    .maybeSingle();
  if (updateError) throw updateError;

  return ensureActiveSubscriptionForCheckout({
    serviceClient,
    checkout: updatedCheckout ?? {
      ...checkout,
      status: "paid",
      provider_customer_code: providerCustomerCode,
      provider_subscription_code: providerSubscriptionCode,
    },
    supabaseUrl,
    serviceRoleKey,
    source,
    transaction,
  });
}

async function ensureActiveSubscriptionForCheckout({ serviceClient, checkout, supabaseUrl, serviceRoleKey, source, transaction }: {
  serviceClient: any;
  checkout: any;
  supabaseUrl: string;
  serviceRoleKey: string;
  source: string;
  transaction?: Record<string, any> | null;
}) {
  const { data: activated, error: activationError } = await serviceClient.rpc("activate_paid_artist_workspace", {
    p_checkout_session_id: checkout.id,
  });
  if (activationError) throw activationError;
  const workspace = Array.isArray(activated) ? activated[0] : activated;
  if (!workspace?.account_id || !workspace?.artist_workspace_id) {
    throw new Error("Paid workspace activation did not return a workspace.");
  }

  const providerSubscriptionCode =
    readSubscriptionCode(transaction ?? {}) ??
    checkout.provider_subscription_code ??
    `paystack_charge_${checkout.provider_reference}`;
  const providerCustomerCode = readCustomerCode(transaction ?? {}) ?? checkout.provider_customer_code ?? null;

  const { error: subscriptionError } = await serviceClient.from("billing_subscriptions").upsert(
    {
      account_id: workspace.account_id,
      artist_workspace_id: workspace.artist_workspace_id,
      user_id: checkout.user_id,
      checkout_session_id: checkout.id,
      provider: "paystack",
      provider_subscription_code: providerSubscriptionCode,
      provider_customer_code: providerCustomerCode,
      provider_plan_code: checkout.provider_plan_code,
      amount_minor: checkout.amount_minor,
      amount: checkout.amount,
      currency: checkout.currency,
      status: "active",
      current_period_start: readPeriodStart(transaction ?? {}),
      current_period_end: readPeriodEnd(transaction ?? {}),
      metadata: { source },
    },
    { onConflict: "provider,provider_subscription_code" },
  );
  if (subscriptionError) throw subscriptionError;

  const { data: updatedCheckout, error: checkoutError } = await serviceClient
    .from("billing_checkout_sessions")
    .select("*")
    .eq("id", checkout.id)
    .maybeSingle();
  if (checkoutError) throw checkoutError;

  // Dispatch setup as best-effort. The subscription and workspace are already active;
  // a transient setup failure should not block the billing-status response.
  let setupDispatched = false;
  try {
    await invokeSetupFunction({
      supabaseUrl,
      serviceRoleKey,
      functionName: "paid-workspace-setup",
      body: {
        checkoutSessionId: checkout.id,
        phase: "discovery",
      },
    });
    setupDispatched = true;
  } catch {
    // Setup will be retried on the next billing-status poll or via retrySetup.
  }

  return { checkout: updatedCheckout ?? { ...checkout, artist_workspace_id: workspace.artist_workspace_id }, setupDispatched };
}

function validatePaystackAmount(checkout: any, data: Record<string, any>) {
  const paidAmount = Number(data.amount ?? checkout.amount_minor);
  const paidCurrency = String(data.currency ?? checkout.currency).toUpperCase();
  if (paidAmount !== Number(checkout.amount_minor)) {
    throw new Error("Paystack amount did not match checkout session.");
  }
  if (paidCurrency !== String(checkout.currency).toUpperCase()) {
    throw new Error("Paystack currency did not match checkout session.");
  }
}

function readSubscriptionCode(data: Record<string, any>) {
  return data.subscription_code ?? data.subscription?.subscription_code ?? data.subscription?.id ?? null;
}

function readCustomerCode(data: Record<string, any>) {
  return data.customer_code ?? data.customer?.customer_code ?? null;
}

function readPeriodStart(data: Record<string, any>) {
  return data.period_start ?? data.subscription?.current_period_start ?? null;
}

function readPeriodEnd(data: Record<string, any>) {
  return data.period_end ?? data.subscription?.current_period_end ?? data.subscription?.next_payment_date ?? null;
}

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
