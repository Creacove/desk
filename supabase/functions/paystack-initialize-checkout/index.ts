import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CheckoutInput = {
  clientRequestId: string;
  interval?: "monthly" | "yearly";
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
  if (request.method === "OPTIONS") return json(request, { ok: true });
  if (request.method !== "POST") return json(request, { error: "Method not allowed." }, 405);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json(request, { error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const secretKey = requireEnv("PAYSTACK_SECRET_KEY");
    const monthlyPlanCode = Deno.env.get("PAYSTACK_MONTHLY_PLAN_CODE")?.trim() || requireEnv("PAYSTACK_PLAN_CODE");
    const yearlyPlanCode = requireEnv("PAYSTACK_YEARLY_PLAN_CODE");
    const monthlyAmountMinor = requireMinorAmountWithLegacy("PAYSTACK_MONTHLY_AMOUNT_MINOR", "PAYSTACK_AMOUNT_MINOR");
    const yearlyAmountMinor = requireMinorAmount("PAYSTACK_YEARLY_AMOUNT_MINOR");
    const currency = requireEnv("PAYSTACK_CURRENCY").toUpperCase();
    if (currency !== "NGN") throw new Error("PAYSTACK_CURRENCY must be NGN.");
    const callbackUrl = validateCallbackUrl(requireEnv("PAYSTACK_CALLBACK_URL"), requireEnv("APP_ORIGIN"));

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user?.id || !user.email) return json(request, { error: "Unauthorized." }, 401);

    const input = (await request.json()) as CheckoutInput;
    if (!isUuid(input.clientRequestId)) throw new Error("A valid clientRequestId is required.");
    const interval = input.interval ?? "monthly";
    if (interval !== "monthly" && interval !== "yearly") throw new Error("Interval must be monthly or yearly.");
    const planCode = interval === "monthly" ? monthlyPlanCode : yearlyPlanCode;
    const amountMinor = interval === "monthly" ? monthlyAmountMinor : yearlyAmountMinor;
    const amount = amountMinor / 100;
    validateArtist(input.selectedArtist);
    const selectedArtist = normalizeSelectedArtist(input.selectedArtist);
    const { data: existingRequest, error: existingRequestError } = await serviceClient
      .from("billing_checkout_sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("client_request_id", input.clientRequestId)
      .maybeSingle();
    if (existingRequestError) throw existingRequestError;
    if (existingRequest) {
      const requestedWorkspaceId = input.existingArtistWorkspaceId ?? null;
      if (
        existingRequest.provider !== "paystack" || existingRequest.interval !== interval ||
        existingRequest.provider_price_id !== planCode ||
        existingRequest.artist_workspace_id !== requestedWorkspaceId ||
        existingRequest.selected_artist?.spotifyArtistId !== selectedArtist.spotifyArtistId
      ) {
        return json(request, { error: "This checkout request was already used for a different purchase." }, 409);
      }
      if (existingRequest.status !== "initialized" || !existingRequest.authorization_url) {
        return json(request, { error: "This checkout request is still being initialized. Try again shortly." }, 409);
      }
      return json(request, toPreviewFromCheckout(existingRequest));
    }
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
        return json(request, { error: "Existing artist workspace is not available for this checkout." }, 403);
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
        provider_price_id: planCode,
        client_request_id: input.clientRequestId,
        amount_minor: amountMinor,
        amount,
        currency,
        interval,
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

    return json(request, toPreview({
      id: session.id,
      reference,
      status: "initialized",
      selectedArtist,
      amount,
      amountMinor,
      currency,
      interval,
      expiresAt,
      authorizationUrl,
      accessCode,
    }));
  } catch (error) {
    return json(request, { error: readErrorMessage(error, "Checkout could not be initialized.") }, 500);
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
  interval: "monthly" | "yearly";
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
    interval: input.interval,
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

function toPreviewFromCheckout(checkout: any) {
  return toPreview({
    id: checkout.id,
    reference: checkout.provider_reference,
    status: "initialized",
    selectedArtist: checkout.selected_artist,
    amount: Number(checkout.amount),
    amountMinor: Number(checkout.amount_minor),
    currency: checkout.currency,
    interval: checkout.interval,
    expiresAt: checkout.expires_at,
    authorizationUrl: checkout.authorization_url,
    accessCode: checkout.access_code,
  });
}

function requireMinorAmount(key: string) {
  const value = requireEnv(key);
  if (!/^\d+$/.test(value)) throw new Error(`${key} must be a positive integer in minor units.`);
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`${key} is outside the supported range.`);
  return amount;
}

function requireMinorAmountWithLegacy(key: string, legacyKey: string) {
  const value = Deno.env.get(key)?.trim() || requireEnv(legacyKey);
  if (!/^\d+$/.test(value)) throw new Error(`${key} must be a positive integer in minor units.`);
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`${key} is outside the supported range.`);
  return amount;
}

function validateCallbackUrl(value: string, appOrigin: string) {
  const callback = new URL(value);
  const expectedOrigin = new URL(appOrigin).origin;
  if (callback.origin !== expectedOrigin || callback.pathname !== "/welcome" || callback.search || callback.hash) {
    throw new Error("PAYSTACK_CALLBACK_URL must be the configured APP_ORIGIN followed by /welcome.");
  }
  return callback.href;
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

function json(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = [requireEnv("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
