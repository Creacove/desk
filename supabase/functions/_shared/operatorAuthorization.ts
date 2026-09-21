import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AuthorizedOperator = { userId: string; email?: string };

export class OperatorAuthorizationError extends Error {
  readonly status: 401 | 403 | 503;

  constructor(status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = "OperatorAuthorizationError";
    this.status = status;
  }
}

export async function requireOperatorWorkspaceAccess(
  request: Request,
  targetWorkspaceId?: string,
): Promise<{ actor: AuthorizedOperator; authClient: SupabaseClient; adminClient: SupabaseClient }> {
  const authorization = request.headers.get("Authorization")?.trim() ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    throw new OperatorAuthorizationError(401, "Authentication is required.");
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    throw new OperatorAuthorizationError(401, "Authentication is required.");
  }

  const { data: operator, error: operatorError } = await adminClient
    .from("ordersounds_operators")
    .select("user_id,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();
  if (operatorError) throw new OperatorAuthorizationError(503, "Operator access is unavailable.");

  const { data: config, error: configError } = await adminClient.rpc("operator_access_enabled_v1");
  if (configError) throw new OperatorAuthorizationError(503, "Operator access is unavailable.");

  if (!operator?.active || config !== true) {
    throw new OperatorAuthorizationError(403, "Operator access is not available.");
  }

  if (targetWorkspaceId !== undefined) {
    if (!UUID_PATTERN.test(targetWorkspaceId)) {
      throw new OperatorAuthorizationError(403, "Operator workspace access is not available.");
    }
    const { data: workspace, error: workspaceError } = await adminClient
      .from("artist_workspaces")
      .select("id")
      .eq("id", targetWorkspaceId)
      .maybeSingle();
    if (workspaceError) throw new OperatorAuthorizationError(503, "Operator access is unavailable.");
    if (!workspace) {
      throw new OperatorAuthorizationError(403, "Operator workspace access is not available.");
    }
  }

  return {
    actor: { userId: user.id, ...(user.email ? { email: user.email } : {}) },
    authClient,
    adminClient,
  };
}

export function requiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new OperatorAuthorizationError(503, "Operator access is unavailable.");
  return value;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
