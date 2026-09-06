import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { handleAccountTeamRequest } from "../_shared/accountTeamHandler.ts";

// This endpoint deliberately never captures raw request bodies: join tokens are credentials.
Deno.serve(withAppErrorCapture("account-team", async (request) => {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return new Response(JSON.stringify({ error: "Team service is unavailable." }), { status: 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const db = createClient(url, service);
  return handleAccountTeamRequest(request, {
    allowedOrigins: [Deno.env.get("APP_ORIGIN"), Deno.env.get("PUBLIC_APP_URL"), Deno.env.get("LOCAL_APP_ORIGIN")].filter((value): value is string => Boolean(value)),
    authenticate: async (authorization) => {
      const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
      const { data, error } = await auth.auth.getUser();
      return error ? null : data.user;
    },
    rpc: (name, args) => db.rpc(name, args),
    token: async () => {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    },
    hash: async (token) => {
      const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
  });
}));
