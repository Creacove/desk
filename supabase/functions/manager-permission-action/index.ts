import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PermissionDecisionInput = {
  permissionId: string;
  decision: "approve" | "reject";
  note?: string;
};

Deno.serve(withAppErrorCapture("manager-permission-action", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

  try {
    const input = (await request.json()) as PermissionDecisionInput;
    validateInput(input);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const workflowDb = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized." }, 401);

    const { data: permission, error: permissionError } = await workflowDb
      .from("permission_requests")
      .select("id,account_id,artist_workspace_id,artist_id,mission_id,status,created_from_action_id")
      .eq("id", input.permissionId)
      .maybeSingle();
    if (permissionError) throw permissionError;
    if (!permission) return json({ error: "Permission request not found." }, 404);

    const { data: membership, error: membershipError } = await userClient.rpc("is_account_member", {
      target_account_id: permission.account_id,
    });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);

    await assertActiveWorkspaceEntitlement(userClient, {
      accountId: permission.account_id,
      artistWorkspaceId: permission.artist_workspace_id,
      artistId: permission.artist_id,
    });

    const { data: resolution, error: resolutionError } = await workflowDb.rpc("resolve_manager_permission_v1", {
      target_permission_id: input.permissionId,
      actor_user_id: authData.user.id,
      decision: input.decision,
      note: input.note ?? null,
    });
    if (resolutionError) throw resolutionError;

    const resolved = asRecord(resolution);
    if (input.decision === "reject" || resolved.shouldExecute !== true) {
      return json({ status: "resolved", ...resolved });
    }

    if (resolved.actionType !== "send_split_confirmations") {
      const failure = `Unsupported executable Manager action: ${String(resolved.actionType ?? "unknown")}`;
      await failExecution(workflowDb, String(resolved.executionReceiptId), failure, {}, false);
      return json({ error: failure, status: "failed", ...resolved }, 422);
    }

    const appOrigin = Deno.env.get("DESK_APP_ORIGIN");
    if (!appOrigin) {
      const failure = "DESK_APP_ORIGIN is not configured, so Desk did not perform the approved external action.";
      const failed = await failExecution(workflowDb, String(resolved.executionReceiptId), failure, {}, false);
      return json({ error: failure, status: "failed", resolution: resolved, execution: failed }, 500);
    }

    const actionPayload = asRecord(resolved.actionPayload);
    const sendBody = {
      accountId: String(resolved.accountId),
      artistWorkspaceId: String(resolved.artistWorkspaceId),
      artistId: String(resolved.artistId),
      musicItemId: String(actionPayload.musicItemId ?? ""),
      appOrigin,
      managerExecution: {
        permissionRequestId: String(resolved.permissionId),
        managerRunActionId: String(resolved.actionId),
        executionReceiptId: String(resolved.executionReceiptId),
        executionKey: String(resolved.executionKey),
      },
    };

    let sendResponse: Response;
    let sendResult: Record<string, unknown> | null = null;
    try {
      sendResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/send-split-confirmations`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendBody),
      });
      sendResult = await readJsonSafe(sendResponse);
    } catch (error) {
      const failure = errorMessage(error, "Approved split confirmation send returned an unknown network result.");
      const failed = await failExecution(
        workflowDb,
        String(resolved.executionReceiptId),
        failure,
        { transport: "supabase_edge_function" },
        true,
      );
      return json({ error: failure, status: "indeterminate", resolution: resolved, execution: failed }, 502);
    }

    if (!sendResponse.ok) {
      const failure = typeof sendResult?.error === "string"
        ? sendResult.error
        : `Split confirmation execution returned HTTP ${sendResponse.status}.`;
      const failed = await failExecution(
        workflowDb,
        String(resolved.executionReceiptId),
        failure,
        sendResult ?? { httpStatus: sendResponse.status },
        true,
      );
      return json({ error: failure, status: "indeterminate", resolution: resolved, execution: failed }, 502);
    }

    const failedCount = Number(sendResult?.failed ?? 0);
    const sentCount = Number(sendResult?.sent ?? 0);
    if (!Number.isFinite(sentCount) || sentCount < 1) {
      const failure = "Approved split confirmation execution produced no confirmed outbound delivery.";
      const failed = await failExecution(
        workflowDb,
        String(resolved.executionReceiptId),
        failure,
        sendResult ?? {},
        false,
      );
      return json({ error: failure, status: "failed", resolution: resolved, execution: failed }, 502);
    }

    if (Number.isFinite(failedCount) && failedCount > 0) {
      const failure = `Split confirmations were only partially delivered: ${sentCount} sent, ${failedCount} failed.`;
      const failed = await failExecution(
        workflowDb,
        String(resolved.executionReceiptId),
        failure,
        sendResult ?? {},
        false,
      );
      return json({ status: "partial", resolution: resolved, execution: failed, result: sendResult }, 207);
    }

    const { data: completed, error: completeError } = await workflowDb.rpc("complete_manager_action_execution_v1", {
      target_receipt_id: String(resolved.executionReceiptId),
      actual_result: sendResult ?? {},
    });
    if (completeError) throw completeError;

    return json({
      status: "executed",
      resolution: resolved,
      execution: completed,
      result: sendResult,
    });
  } catch (error) {
    return json({ error: errorMessage(error, "Manager permission could not be resolved.") }, 500);
  }
}));

async function failExecution(
  db: any,
  receiptId: string,
  message: string,
  result: Record<string, unknown>,
  indeterminate: boolean,
) {
  const { data, error } = await db.rpc("fail_manager_action_execution_v1", {
    target_receipt_id: receiptId,
    failure_message: message,
    actual_result: result,
    is_indeterminate: indeterminate,
  });
  if (error) throw error;
  return data;
}

function validateInput(input: PermissionDecisionInput) {
  if (!input?.permissionId || !["approve", "reject"].includes(input.decision)) {
    throw new Error("permissionId and an approve/reject decision are required.");
  }
  if (input.note != null && typeof input.note !== "string") {
    throw new Error("Permission decision note must be text.");
  }
}

async function readJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
