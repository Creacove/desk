import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readCanonicalPaddlePrice, requireEnv, sha256Hex } from "../_shared/paddle.ts";

type CheckoutInput = {
  interval: "monthly" | "yearly";
  clientRequestId: string;
  existingArtistWorkspaceId?: string;
  selectedArtist?: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    spotifyUri?: string;
    imageUrl?: string;
    genres?: string[];
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return respond(request, { ok: true });
  if (request.method !== "POST") return respond(request, { error: "Method not allowed." }, 405);

  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return respond(request, { error: "Unauthorized." }, 401);
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const auth = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError || !user?.id || !user.email) return respond(request, { error: "Unauthorized." }, 401);

    const input = await request.json() as CheckoutInput;
    if (!isUuid(input.clientRequestId)) return respond(request, { error: "A valid clientRequestId is required." }, 400);
    if (input.interval !== "monthly" && input.interval !== "yearly") {
      return respond(request, { error: "Interval must be monthly or yearly." }, 400);
    }
    validateArtist(input.selectedArtist);
    const selectedArtist = normalizeArtist(input.selectedArtist);
    const { productId, priceId } = readCanonicalPaddlePrice(input.interval);

    const { data: existingRequest, error: requestError } = await db
      .from("billing_checkout_sessions")
      .select("id,provider,provider_product_id,provider_price_id,interval,status,expires_at,artist_workspace_id,selected_artist")
      .eq("user_id", user.id)
      .eq("client_request_id", input.clientRequestId)
      .maybeSingle();
    if (requestError) throw requestError;
    if (existingRequest) {
      const requestedWorkspaceId = input.existingArtistWorkspaceId ?? null;
      if (
        existingRequest.provider !== "paddle" ||
        existingRequest.artist_workspace_id !== requestedWorkspaceId ||
        existingRequest.selected_artist?.spotifyArtistId !== selectedArtist.spotifyArtistId
      ) {
        return respond(request, { error: "This checkout request was already used for a different purchase." }, 409);
      }
      if (existingRequest.provider_price_id !== priceId || existingRequest.interval !== input.interval) {
        return respond(request, { error: "This checkout request was already used for different pricing." }, 409);
      }
      if (!["open", "initialized"].includes(existingRequest.status) || new Date(existingRequest.expires_at).getTime() <= Date.now()) {
        return respond(request, { error: "This checkout request is no longer reusable." }, 409);
      }
      return respond(request, await rotateCorrelationToken(db, existingRequest));
    }

    let existingWorkspace: { id: string; account_id: string } | null = null;
    if (input.existingArtistWorkspaceId) {
      const { data: workspace, error: workspaceError } = await db
        .from("artist_workspaces")
        .select("id,account_id,artists(canonical_spotify_artist_id)")
        .eq("id", input.existingArtistWorkspaceId)
        .maybeSingle();
      if (workspaceError) throw workspaceError;
      const { data: membership, error: membershipError } = await db
        .from("account_memberships")
        .select("id")
        .eq("account_id", workspace?.account_id ?? "00000000-0000-0000-0000-000000000000")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError) throw membershipError;
      const artist = Array.isArray(workspace?.artists) ? workspace.artists[0] : workspace?.artists;
      if (!workspace || !membership || artist?.canonical_spotify_artist_id !== selectedArtist.spotifyArtistId) {
        return respond(request, { error: "Existing artist workspace is not available for this checkout." }, 403);
      }
      existingWorkspace = workspace;
    }

    await db.from("users").upsert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.name ?? selectedArtist.name,
      updated_at: new Date().toISOString(),
    }).throwOnError();

    const now = new Date();
    let reusableQuery = db
      .from("billing_checkout_sessions")
      .select("id,provider_product_id,provider_price_id,interval,expires_at")
      .eq("user_id", user.id)
      .eq("provider", "paddle")
      .eq("provider_price_id", priceId)
      .contains("selected_artist", { spotifyArtistId: selectedArtist.spotifyArtistId })
      .in("status", ["open", "initialized"])
      .gt("expires_at", now.toISOString());
    reusableQuery = applyWorkspaceScope(reusableQuery, existingWorkspace);
    const { data: reusable, error: reusableError } = await reusableQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reusableError) throw reusableError;
    if (reusable) {
      const { data: reused, error: reuseError } = await db.from("billing_checkout_sessions").update({
        client_request_id: input.clientRequestId,
      })
        .eq("id", reusable.id)
        .eq("user_id", user.id)
        .in("status", ["open", "initialized"])
        .select("id")
        .maybeSingle();
      if (reuseError) throw reuseError;
      if (!reused) throw new Error("Checkout changed state while it was being reused.");
      return respond(request, await rotateCorrelationToken(db, reusable));
    }

    const { count: openCount, error: countError } = await db.from("billing_checkout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("provider", "paddle")
      .in("status", ["open", "initialized"]).gt("expires_at", now.toISOString());
    if (countError) throw countError;
    if ((openCount ?? 0) >= 3) return respond(request, { error: "Too many open checkout sessions. Try again shortly." }, 429);

    const correlationToken = createCorrelationToken();
    const expiresAt = new Date(now.getTime() + 45 * 60_000).toISOString();
    const providerReference = `paddle_${crypto.randomUUID()}`;
    const { data: session, error: insertError } = await db
      .from("billing_checkout_sessions")
      .insert({
        user_id: user.id,
        account_id: existingWorkspace?.account_id ?? null,
        artist_workspace_id: existingWorkspace?.id ?? null,
        provider: "paddle",
        provider_reference: providerReference,
        provider_plan_code: priceId,
        provider_product_id: productId,
        provider_price_id: priceId,
        client_request_id: input.clientRequestId,
        checkout_correlation_hash: await sha256Hex(correlationToken),
        interval: input.interval,
        status: "open",
        selected_artist: selectedArtist,
        expires_at: expiresAt,
        // The token is returned once. Keeping it in metadata would defeat hashing, so omit it.
        metadata: { checkout_version: 1 },
      })
      .select("id,provider_product_id,provider_price_id,interval,expires_at")
      .single();
    if (insertError) throw insertError;

    return respond(request, checkoutResponse(session, correlationToken));
  } catch (error) {
    return respond(request, { error: error instanceof Error ? error.message : "Checkout could not be created." }, 500);
  }
});

function validateArtist(artist: CheckoutInput["selectedArtist"]): asserts artist is NonNullable<CheckoutInput["selectedArtist"]> {
  if (!artist?.spotifyArtistId?.trim() || !artist.name?.trim() || !artist.spotifyUrl?.startsWith("https://")) {
    throw new Error("Selected artist is incomplete.");
  }
}

function normalizeArtist(artist: NonNullable<CheckoutInput["selectedArtist"]>) {
  return {
    spotifyArtistId: artist.spotifyArtistId.trim(), name: artist.name.trim(), spotifyUrl: artist.spotifyUrl,
    spotifyUri: artist.spotifyUri, imageUrl: artist.imageUrl, genres: artist.genres ?? [],
  };
}

function checkoutResponse(session: any, correlationToken?: string) {
  if (!correlationToken) throw new Error("Existing checkout correlation token is unavailable; start a new request.");
  return {
    checkoutSessionId: session.id,
    productId: session.provider_product_id,
    priceId: session.provider_price_id,
    interval: session.interval,
    expiresAt: session.expires_at,
    customData: { version: 1, checkoutSessionId: session.id, correlationToken },
  };
}

async function rotateCorrelationToken(db: any, session: any) {
  const correlationToken = createCorrelationToken();
  const { data: updated, error } = await db.from("billing_checkout_sessions")
    .update({ checkout_correlation_hash: await sha256Hex(correlationToken) })
    .eq("id", session.id)
    .in("status", ["open", "initialized"])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updated) throw new Error("Checkout changed state while it was being reused.");
  return checkoutResponse(session, correlationToken);
}

function applyWorkspaceScope(query: any, existingWorkspace: { id: string } | null) {
  return existingWorkspace
    ? query.eq("artist_workspace_id", existingWorkspace.id)
    : query.is("artist_workspace_id", null);
}

function createCorrelationToken() {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return bytesToBase64Url(randomBytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = [requireEnv("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = { "Content-Type": "application/json", Vary: "Origin" };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return new Response(JSON.stringify(body), { status, headers });
}
