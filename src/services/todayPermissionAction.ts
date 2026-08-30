import type { SupabaseClient } from "@supabase/supabase-js";

export type TodayPermissionDecision = "approve" | "reject";

export type TodayPermissionDetail = {
  id: string;
  missionId?: string;
  requestType: string;
  title: string;
  body?: string;
  risk?: string;
  status: string;
  parameters: Record<string, unknown>;
  action?: {
    id: string;
    actionType: string;
    targetType?: string;
    targetId?: string;
    status: string;
    approvalRequired: boolean;
    payload: Record<string, unknown>;
  };
};

export type TodayPermissionEffect = {
  executable: boolean;
  actionLabel: string;
  targetLabel?: string;
  details: string[];
  caution?: string;
};

export async function loadTodayManagerPermission(
  client: SupabaseClient,
  permissionId: string,
): Promise<TodayPermissionDetail> {
  const cleanId = permissionId.trim();
  if (!cleanId) throw new Error("This approval request is no longer available.");

  const { data: permissionData, error: permissionError } = await client
    .from("permission_requests")
    .select("id,mission_id,request_type,title,body,risk,status,parameters,created_from_action_id")
    .eq("id", cleanId)
    .maybeSingle();
  if (permissionError) throw permissionError;

  const permission = permissionData as Record<string, unknown> | null;
  if (!permission?.id) throw new Error("This approval request is no longer available.");

  const actionId = text(permission.created_from_action_id);
  let action: TodayPermissionDetail["action"];
  if (actionId) {
    const { data: actionData, error: actionError } = await client
      .from("manager_run_actions")
      .select("id,action_type,target_type,target_id,status,approval_required,payload")
      .eq("id", actionId)
      .maybeSingle();
    if (actionError) throw actionError;
    const row = actionData as Record<string, unknown> | null;
    if (row?.id) {
      action = {
        id: text(row.id),
        actionType: text(row.action_type),
        targetType: optionalText(row.target_type),
        targetId: optionalText(row.target_id),
        status: text(row.status),
        approvalRequired: row.approval_required === true,
        payload: record(row.payload),
      };
    }
  }

  return {
    id: text(permission.id),
    missionId: optionalText(permission.mission_id),
    requestType: text(permission.request_type) || "sensitive_commitment",
    title: text(permission.title) || "Review Manager action",
    body: optionalText(permission.body),
    risk: optionalText(permission.risk),
    status: text(permission.status) || "pending",
    parameters: record(permission.parameters),
    action,
  };
}

export async function resolveTodayManagerPermission(
  client: SupabaseClient,
  permissionId: string,
  decision: TodayPermissionDecision,
  note?: string,
) {
  const cleanId = permissionId.trim();
  if (!cleanId || !["approve", "reject"].includes(decision)) {
    throw new Error("This approval request cannot be resolved from Today.");
  }

  const { data, error } = await client.functions.invoke("manager-permission-action", {
    body: {
      permissionId: cleanId,
      decision,
      ...(note?.trim() ? { note: note.trim() } : {}),
    },
  });
  if (error) {
    const body = await readFunctionErrorBody(error);
    const message = text(body.error) || text(body.message) || error.message || "Desk could not resolve this approval.";
    const reference = text(body.errorEventId) || text(body.error_event_id);
    throw new Error(reference ? `${message} (Reference: ${reference})` : message);
  }

  const result = record(data);
  if (typeof result.error === "string" && result.error.trim()) {
    throw new Error(result.error.trim());
  }
  return result;
}

async function readFunctionErrorBody(error: { context?: unknown }) {
  const context = error?.context;
  if (!context || typeof context !== "object") return {} as Record<string, unknown>;
  const response = typeof (context as { clone?: unknown }).clone === "function"
    ? (context as { clone: () => Response }).clone()
    : context as Response;
  try {
    const body = await response.json();
    return record(body);
  } catch {
    try {
      const body = await response.text();
      return body.trim() ? { error: body.trim() } : {};
    } catch {
      return {};
    }
  }
}

export function describeTodayPermissionEffect(detail: TodayPermissionDetail): TodayPermissionEffect {
  const payload = Object.keys(detail.action?.payload ?? {}).length
    ? detail.action!.payload
    : detail.parameters;
  const executable = payload.executable === true;
  const actionKind = text(payload.actionKind) || detail.action?.actionType || detail.requestType;

  if (actionKind === "send_split_confirmations") {
    const recipients = Array.isArray(payload.recipients)
      ? payload.recipients.map(record).filter((row) => text(row.email))
      : [];
    const details = recipients.slice(0, 20).map((recipient) => {
      const name = text(recipient.name) || text(recipient.email);
      const role = text(recipient.role);
      const publishing = share(recipient.publishingShare);
      const master = share(recipient.masterShare);
      const shares = [
        publishing ? `${publishing} publishing` : "",
        master ? `${master} master` : "",
      ].filter(Boolean).join(" · ");
      return `${name}${role ? ` — ${role}` : ""}${shares ? ` — ${shares}` : ""} — ${text(recipient.email)}`;
    });
    return {
      executable,
      actionLabel: "Send split confirmation emails",
      targetLabel: text(payload.splitId) ? `Split ${text(payload.splitId).slice(0, 8)}` : undefined,
      details,
      caution: executable
        ? "Approving allows Desk to send these exact confirmation emails once. Approval is not the same as successful delivery; Desk records the real provider result separately."
        : "This request is prepared only. Approving it will not perform an external send.",
    };
  }

  const details = flattenEffect(payload).slice(0, 12);
  return {
    executable,
    actionLabel: humanize(actionKind || "prepared_external_action"),
    targetLabel: detail.action?.targetType && detail.action.targetId
      ? `${humanize(detail.action.targetType)} ${detail.action.targetId.slice(0, 8)}`
      : undefined,
    details,
    caution: executable
      ? "Approving authorizes only the exact frozen effect shown here. Desk records execution separately from approval."
      : "Desk has prepared this move, but no supported external executor is attached. Approval will not be reported as completed work.",
  };
}

function flattenEffect(value: Record<string, unknown>) {
  const ignored = new Set(["executable", "effectVersion", "actionKind"]);
  return Object.entries(value).flatMap(([key, raw]) => {
    if (ignored.has(key) || raw == null || raw === "") return [];
    if (Array.isArray(raw)) return raw.length ? [`${humanize(key)}: ${raw.length} item${raw.length === 1 ? "" : "s"}`] : [];
    if (typeof raw === "object") return [`${humanize(key)}: prepared`];
    return [`${humanize(key)}: ${String(raw)}`];
  });
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function share(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `${numeric}%` : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const valueText = text(value);
  return valueText || undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
