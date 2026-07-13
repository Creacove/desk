import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CheckoutInput = {
  existingArtistWorkspaceId?: string;
  selectedArtist?: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    spotifyUri?: string;
    imageUrl?: string;
    followers?: number;
    genres?: string[];
  };
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
    const planCode = requireEnv("PAYSTACK_PLAN_CODE");
    const secretKey = requireEnv("PAYSTACK_SECRET_KEY");
    const amountMinor = Number(Deno.env.get("PAYSTACK_AMOUNT_MINOR") ?? "2000");
    const amount = Number(Deno.env.get("PAYSTACK_AMOUNT") ?? "20");
    const currency = Deno.env.get("PAYSTACK_CURRENCY") ?? "USD";
    const callbackUrl = requireEnv("PAYSTACK_CALLBACK_URL");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user?.id || !user.email) return json({ error: "Unauthorized." }, 401);

    const input = (await request.json()) as CheckoutInput;
    validateArtist(input.selectedArtist);
    const selectedArtist = normalizeSelectedArtist(input.selectedArtist);
    let existingWorkspace: { id: string; account_id: string; artist_id: string; artists?: any } | null = null;
    if (input.existingArtistWorkspaceId) {
      const { data, error } = await serviceClient
        .from("artist_workspaces")
        .select("id,account_id,artist_id,artists(canonical_spotify_artist_id)")
        .eq("id", input.existingArtistWorkspaceId)
        .maybeSingle();
      if (error) throw error;
      const { data: membership, error: membershipError } = await serviceClient
        .from("account_memberships")
        .select("id")
        .eq("account_id", data?.account_id ?? "00000000-0000-0000-0000-000000000000")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;
      const artist = Array.isArray(data?.artists) ? data.artists[0] : data?.artists;
      if (!data || !membership || artist?.canonical_spotify_artist_id !== selectedArtist.spotifyArtistId) {
        return json({ error: "Existing artist workspace is not available for this checkout." }, 403);
      }
      existingWorkspace = data;
    }

    const { error: userUpsertError } = await serviceClient.from("users").upsert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.name ?? selectedArtist.name,
      updated_at: new Date().toISOString(),
    });
    if (userUpsertError) throw userUpsertError;

    const reference = `ors_${crypto.randomUUID().replaceAll("-", "")}`;
    const expiresAt = new Date(Date.now() + 45 * 60 * 1000).toISOString();

    const { data: session, error: sessionError } = await serviceClient
      .from("billing_checkout_sessions")
      .insert({
        user_id: user.id,
        account_id: existingWorkspace?.account_id ?? null,
        artist_workspace_id: existingWorkspace?.id ?? null,
        provider: "paystack",
        provider_reference: reference,
        provider_plan_code: planCode,
        amount_minor: amountMinor,
        amount,
        currency,
        status: "open",
        selected_artist: selectedArtist,
        expires_at: expiresAt,
      })
      .select("id, provider_reference")
      .single();
    if (sessionError) throw sessionError;

    const initializeResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: amountMinor,
        currency,
        plan: planCode,
        reference,
        callback_url: callbackUrl,
        metadata: {
          checkout_session_id: session.id,
          user_id: user.id,
          provider: "paystack",
        },
      }),
    });

    const initializePayload = await initializeResponse.json();
    if (!initializeResponse.ok || initializePayload?.status !== true) {
      throw new Error(initializePayload?.message ?? `Paystack initialize failed with ${initializeResponse.status}.`);
    }

    const authorizationUrl = initializePayload.data?.authorization_url;
    const accessCode = initializePayload.data?.access_code;
    await serviceClient
      .from("billing_checkout_sessions")
      .update({
        status: "initialized",
        authorization_url: authorizationUrl,
        access_code: accessCode,
      })
      .eq("id", session.id);

    return json(toPreview({
      id: session.id,
      reference,
      status: "initialized",
      selectedArtist,
      amount,
      amountMinor,
      currency,
      expiresAt,
      authorizationUrl,
      accessCode,
    }));
  } catch (error) {
    return json({ error: readErrorMessage(error, "Checkout could not be initialized.") }, 500);
  }
});

function validateArtist(artist: CheckoutInput["selectedArtist"]): asserts artist is NonNullable<CheckoutInput["selectedArtist"]> {
  if (!artist?.spotifyArtistId || !artist.name || !artist.spotifyUrl) {
    throw new Error("Selected artist is incomplete.");
  }
}

function normalizeSelectedArtist(artist: NonNullable<CheckoutInput["selectedArtist"]>) {
  return {
    spotifyArtistId: artist.spotifyArtistId,
    name: artist.name,
    spotifyUrl: artist.spotifyUrl,
    spotifyUri: artist.spotifyUri,
    imageUrl: artist.imageUrl,
  };
}

function toPreview(input: {
  id: string;
  reference: string;
  status: "open" | "initialized";
  selectedArtist: NonNullable<CheckoutInput["selectedArtist"]>;
  amount: number;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  authorizationUrl?: string;
  accessCode?: string;
}) {
  return {
    checkoutSessionId: input.id,
    reference: input.reference,
    status: input.status,
    artist: { ...input.selectedArtist, genres: [] },
    amount: input.amount,
    amountMinor: input.amountMinor,
    currency: input.currency,
    interval: "monthly",
    expiresAt: input.expiresAt,
    authorizationUrl: input.authorizationUrl,
    accessCode: input.accessCode,
  };
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error", "hint", "details"]) {
      if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
  }
  return fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
