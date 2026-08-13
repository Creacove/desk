import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureAppError } from "../_shared/appError.ts";
import { withAppErrorCapture } from "../_shared/appFunction.ts";

const MAX_MESSAGE_LENGTH = 8_192;
const MAX_STACK_LENGTH = 32_768;
const MAX_CONTEXT_BYTES = 16_384;
const ALLOWED_OPERATIONS = new Set([
  "window_error",
  "unhandled_rejection",
  "react_error_boundary",
  "service_call_failed",
]);

type BrowserErrorInput = {
  operation?: unknown;
  message?: unknown;
  stack?: unknown;
  route?: unknown;
  requestId?: unknown;
  context?: unknown;
};

Deno.serve(withAppErrorCapture("capture-browser-error", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Unauthorized." }, 401);
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized." }, 401);

  const input = await request.json().catch(() => null) as BrowserErrorInput | null;
  if (!input || typeof input.operation !== "string" || !ALLOWED_OPERATIONS.has(input.operation)) {
    return json({ error: "Invalid browser error operation." }, 400);
  }
  if (typeof input.message !== "string" || !input.message.trim()) {
    return json({ error: "Browser error message is required." }, 400);
  }

  const identity = await loadActiveIdentity(supabaseUrl, serviceRoleKey, user.id);
  const error = new Error(bounded(input.message, MAX_MESSAGE_LENGTH));
  if (typeof input.stack === "string" && input.stack.trim()) error.stack = bounded(input.stack, MAX_STACK_LENGTH);
  const errorEventId = await captureAppError(error, {
    functionName: "capture-browser-error",
    operation: input.operation,
    source: "client",
    route: typeof input.route === "string" ? bounded(input.route, 1_024) : undefined,
    requestId: typeof input.requestId === "string" ? input.requestId : request.headers.get("x-request-id") ?? undefined,
    userId: user.id,
    accountEmail: user.email,
    accountId: identity.accountId,
    artistWorkspaceId: identity.artistWorkspaceId,
    artistId: identity.artistId,
    refs: { stage: readContextStage(input.context) },
    context: boundedContext(input.context),
  });
  return json({ ok: true, errorEventId }, 202);
}));

async function loadActiveIdentity(supabaseUrl: string, serviceRoleKey: string, userId: string) {
  const db = createClient(supabaseUrl, serviceRoleKey);
  const { data: membership } = await db.from("account_memberships")
    .select("account_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership?.account_id) return {};
  const { data: workspace } = await db.from("artist_workspaces")
    .select("id,artist_id")
    .eq("account_id", membership.account_id)
    .in("status", ["setup", "active"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return {
    accountId: membership.account_id as string,
    artistWorkspaceId: workspace?.id as string | undefined,
    artistId: workspace?.artist_id as string | undefined,
  };
}

function readContextStage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const stage = (value as Record<string, unknown>).stage;
  return typeof stage === "string" ? bounded(stage, 120) : undefined;
}

function boundedContext(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const text = JSON.stringify(value);
    if (new TextEncoder().encode(text).length > MAX_CONTEXT_BYTES) return { truncated: true };
    return JSON.parse(text);
  } catch {
    return { serializationFailed: true };
  }
}

function bounded(value: string, maximum: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, maximum);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    },
  });
}
