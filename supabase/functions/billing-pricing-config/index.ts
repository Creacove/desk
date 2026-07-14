import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readCanonicalPaddlePrice, readPaddleEnvironment, requireEnv } from "../_shared/paddle.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return respond(request, { ok: true });
  if (request.method !== "POST") return respond(request, { error: "Method not allowed." }, 405);
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return respond(request, { error: "Unauthorized." }, 401);
    const auth = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user?.id) return respond(request, { error: "Unauthorized." }, 401);

    const environment = readPaddleEnvironment();
    const clientToken = requireEnv("PADDLE_CLIENT_TOKEN");
    const expectedPrefix = environment === "sandbox" ? "test_" : "live_";
    if (!clientToken.startsWith(expectedPrefix)) {
      throw new Error(`PADDLE_CLIENT_TOKEN must start with ${expectedPrefix} in ${environment}.`);
    }
    const monthly = readCanonicalPaddlePrice("monthly");
    const yearly = readCanonicalPaddlePrice("yearly");
    if (monthly.productId !== yearly.productId) throw new Error("Paddle Pro prices must belong to one product.");

    return respond(request, {
      paddle: {
        environment,
        clientToken,
        productId: monthly.productId,
        priceId: { monthly: monthly.priceId, yearly: yearly.priceId },
      },
    });
  } catch (error) {
    return respond(request, { error: error instanceof Error ? error.message : "Pricing is unavailable." }, 500);
  }
});

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = [requireEnv("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = { "Content-Type": "application/json", Vary: "Origin", "Cache-Control": "no-store" };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return new Response(JSON.stringify(body), { status, headers });
}
