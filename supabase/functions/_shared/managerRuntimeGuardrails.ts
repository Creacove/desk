export type RuntimeAdmission = { allowed: boolean; admissionId?: string; reason?: string; [key: string]: unknown };

export async function claimRuntimeAdmission(db: any, input: {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  operationKey: string;
  requestSlots?: number;
  ttlSeconds?: number;
}): Promise<RuntimeAdmission> {
  const { data, error } = await db.rpc("claim_manager_runtime_admission_v1", {
    p_account_id: input.accountId,
    p_artist_workspace_id: input.artistWorkspaceId,
    p_artist_id: input.artistId,
    p_operation_key: input.operationKey,
    p_request_slots: input.requestSlots ?? 1,
    p_ttl_seconds: input.ttlSeconds ?? 180,
  });
  if (error) throw error;
  const result = data && typeof data === "object" && !Array.isArray(data) ? data as RuntimeAdmission : { allowed: false, reason: "invalid_admission_response" };
  return result;
}

export async function finishRuntimeAdmission(db: any, admissionId: string | null | undefined, status: "completed" | "failed", failureReason?: string) {
  if (!admissionId) return;
  const { error } = await db.rpc("finish_manager_runtime_admission_v1", {
    p_admission_id: admissionId,
    p_status: status,
    p_failure_reason: failureReason ?? null,
  });
  if (error) throw error;
}

export function boundedProviderTimeoutMs(raw: string | undefined, fallbackMs = 90_000) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallbackMs;
  return Math.max(10_000, Math.min(120_000, Math.round(parsed)));
}

export function boundedOutputTokens(raw: string | undefined, fallback = 6_000, max = 12_000) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(512, Math.min(max, Math.round(parsed)));
}

export async function fetchProviderWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Provider request timed out.", "TimeoutError")), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
