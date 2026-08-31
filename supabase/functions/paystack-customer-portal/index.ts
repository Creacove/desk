import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PortalInput = { artistWorkspaceId?: string };

Deno.serve(withAppErrorCapture("paystack-customer-portal", async (request) => {
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
      .select("id,account_id")
      .eq("id", input.artistWorkspaceId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;

    const { data: membership, error: membershipError } = await db.from("account_memberships")
      .select("id")
      .eq("account_id", workspace?.account_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!workspace || !membership) return respond(request, { error: "Workspace not found." }, 404);

    const { data: subscription, error: subscriptionError } = await db.from("billing_subscriptions")
      .select("provider_subscription_code")
      .eq("artist_workspace_id", workspace.id)
      .eq("provider", "paystack")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription?.provider_subscription_code) {
      return respond(request, { error: "No Paystack subscription was found for this workspace." }, 404);
    }

    const response = await fetch(
      `https://api.paystack.co/subscription/${encodeURIComponent(subscription.provider_subscription_code)}/manage/link`,
      { headers: { Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}` } },
    );
    const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: { link?: string } } | null;
    if (!response.ok || !payload?.status || !payload.data?.link) {
      throw new Error(payload?.message ?? "Paystack billing management could not be opened.");
    }
    assertPaystackUrl(payload.data.link);
    return respond(request, { url: payload.data.link });
  } catch (error) {
    return respond(request, { error: error instanceof Error ? error.message : "Customer portal could not be opened." }, 500);
  }
}));

function assertPaystackUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !(hostname === "paystack.com" || hostname.endsWith(".paystack.com"))) {
    throw new Error("Paystack returned an unexpected customer portal destination.");
  }
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function respond(request: Request, body: unknown, status = 200) {
  const origin = request.headers.get("Origin");
  const allowed = [requireEnv("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
  headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  return new Response(JSON.stringify(body), { status, headers });
}
