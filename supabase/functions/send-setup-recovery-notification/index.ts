import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTransactionalEmail } from "../_shared/transactionalEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Input = { checkoutSessionId?: string };

Deno.serve(withAppErrorCapture("send-setup-recovery-notification", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization");
    if (!isServiceRoleInvocation(authHeader, serviceRoleKey)) return json({ error: "Forbidden." }, 403);

    const input = await request.json() as Input;
    if (!input.checkoutSessionId?.trim()) return json({ error: "checkoutSessionId is required." }, 400);

    const db = createClient(requireEnv("SUPABASE_URL"), serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });
    const { data: setupRun, error: setupError } = await db
      .from("workspace_setup_runs")
      .select("artist_workspace_id")
      .eq("checkout_session_id", input.checkoutSessionId)
      .eq("status", "completed")
      .maybeSingle();
    if (setupError) throw setupError;
    if (!setupRun?.artist_workspace_id) return json({ error: "Completed workspace setup was not found." }, 409);

    const { data: brief, error: briefError } = await db
      .from("manager_outputs")
      .select("id")
      .eq("artist_workspace_id", setupRun.artist_workspace_id)
      .eq("output_type", "setup_first_manager_read")
      .eq("is_current", true)
      .maybeSingle();
    if (briefError) throw briefError;
    if (!brief?.id) return json({ error: "A current Manager brief is required before notifying the user." }, 409);

    const { data: checkout, error: checkoutError } = await db
      .from("billing_checkout_sessions")
      .select("id,user_id")
      .eq("id", input.checkoutSessionId)
      .maybeSingle();
    if (checkoutError) throw checkoutError;
    if (!checkout?.user_id) return json({ error: "Checkout owner was not found." }, 404);

    const { data: userResult, error: userError } = await db.auth.admin.getUserById(checkout.user_id);
    if (userError) throw userError;
    if (!userResult.user?.email) return json({ error: "Account email was not found." }, 404);

    const result = await sendTransactionalEmail({
      db,
      eventKey: `setup-recovered-chartmetric:${checkout.id}`,
      template: "setup_recovered_chartmetric",
      to: userResult.user.email,
      userId: checkout.user_id,
      subject: "Your OrderSounds setup is ready",
      html: "<p>Hi,</p><p>We identified and resolved an issue that affected your account setup. Your workspace is now ready.</p><p>Please sign in, refresh the page, and check your dashboard. If anything still looks off, reply to this email and we&#39;ll take a look.</p>",
      metadata: { checkout_session_id: checkout.id, artist_workspace_id: setupRun.artist_workspace_id },
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Setup recovery notification could not be sent." }, 500);
  }
}));

function isServiceRoleInvocation(authHeader: string | null, serviceRoleKey: string) {
  return authHeader === `Bearer ${serviceRoleKey}` || readBearerJwtRole(authHeader) === "service_role";
}

function readBearerJwtRole(authHeader: string | null) {
  try {
    const token = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.role;
  } catch {
    return undefined;
  }
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
