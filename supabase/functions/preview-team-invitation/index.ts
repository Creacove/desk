import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { requireEnv } from "../_shared/paddle.ts";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

Deno.serve(withAppErrorCapture("preview-team-invitation", async (request) => {
  const origin = request.headers.get("Origin");
  const appOrigin = Deno.env.get("PUBLIC_APP_URL") ?? requireEnv("APP_ORIGIN");
  const allowedOrigins = [appOrigin, Deno.env.get("APP_ORIGIN"), Deno.env.get("LOCAL_APP_ORIGIN")].filter(Boolean);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin && allowedOrigins.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.includes(origin)) return respond({ error: "Origin is not allowed." }, 403);
  if (request.method === "OPTIONS") return respond({ ok: true });
  if (request.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const raw = await request.text();
    if (raw.length > 2048) return respond({ error: "Request is too large." }, 413);
    const input = JSON.parse(raw) as { token?: unknown };
    if (!input || typeof input !== "object" || typeof input.token !== "string" || !TOKEN.test(input.token)) return respond({ error: "Invalid invitation." }, 400);
    const hashBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.token)));
    const tokenHash = Array.from(hashBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data, error } = await db.rpc("preview_account_invitation_v1", { p_token_hash: tokenHash });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) return respond({ error: "Invitation is unavailable." }, 410);
    const row = data as Record<string, unknown>;
    const teamName = typeof row.teamName === "string" ? row.teamName.trim() : "";
    const artistName = typeof row.artistName === "string" ? row.artistName.trim() : "";
    const expiresAt = typeof row.expiresAt === "string" ? row.expiresAt : "";
    if (!teamName || !artistName || !expiresAt) return respond({ error: "Invitation is unavailable." }, 410);
    return respond({
      teamName,
      artistName,
      operatingTitle: typeof row.operatingTitle === "string" ? row.operatingTitle.trim() || null : null,
      responsibilityTags: Array.isArray(row.responsibilityTags) ? row.responsibilityTags.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean).slice(0, 12) : [],
      expiresAt,
    });
  } catch {
    return respond({ error: "Invalid invitation." }, 400);
  }
}));
