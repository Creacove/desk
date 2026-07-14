import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPaddleClient, requireEnv } from "../_shared/paddle.ts";

type PortalInput = { artistWorkspaceId?: string };

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
    if (authError || !user) return respond(request, { error: "Unauthorized." }, 401);
    const input = await request.json() as PortalInput;
    if (!input.artistWorkspaceId) return respond(request, { error: "artistWorkspaceId is required." }, 400);

    const { data: workspace, error: workspaceError } = await db.from("artist_workspaces")
      .select("id,account_id").eq("id", input.artistWorkspaceId).maybeSingle();
    if (workspaceError) throw workspaceError;
    const { data: membership, error: membershipError } = await db.from("account_memberships")
      .select("id").eq("account_id", workspace?.account_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (membershipError) throw membershipError;
    if (!workspace || !membership) return respond(request, { error: "Workspace not found." }, 404);

    const { data: subscription, error: subscriptionError } = await db.from("billing_subscriptions")
      .select("provider_subscription_code,provider_customer_code")
      .eq("artist_workspace_id", workspace.id).eq("provider", "paddle")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription?.provider_customer_code || !subscription.provider_subscription_code) {
      return respond(request, { error: "No Paddle subscription was found for this workspace." }, 404);
    }

    const paddle = createPaddleClient();
    const portal = await paddle.customerPortalSessions.create(
      subscription.provider_customer_code,
      [subscription.provider_subscription_code],
    );
    const portalUrl = portal.urls.general.overview;
    assertPortalUrl(portalUrl);
    return respond(request, { url: portalUrl });
  } catch (error) {
    return respond(request, { error: error instanceof Error ? error.message : "Customer portal could not be opened." }, 500);
  }
});

function assertPortalUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "customer-portal.paddle.com") {
    throw new Error("Paddle returned an unexpected customer portal destination.");
  }
}

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = [requireEnv("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = { "Content-Type": "application/json", Vary: "Origin", "Cache-Control": "no-store" };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return new Response(JSON.stringify(body), { status, headers });
}
