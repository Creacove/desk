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
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized." }, 401);
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const auth = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await auth.auth.getUser();
    if (error || !user?.email) return json({ error: "Unauthorized." }, 401);
    const db = createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const origin = requireEnv("APP_ORIGIN").replace(/\/$/, "");
    const result = await sendTransactionalEmail({
      db,
      eventKey: `account-welcome:${user.id}`,
      template: "account_created",
      to: user.email,
      userId: user.id,
      subject: "Your OrderSounds account is ready",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318"><h1>Your OrderSounds account is ready</h1><p>Hi ${escapeHtml(user.user_metadata?.first_name || "there")},</p><p>Select the artist you work with to begin preparing their Desk.</p><p><a href="${escapeHtml(origin)}">Select an artist</a></p><p>Temitope<br>Founder, OrderSounds</p></div>`,
    });
    return json(result);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Welcome email could not be sent." }, 500);
  }
});

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
