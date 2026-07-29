export type DurableLease = {
  token: string;
  expiresAt: string;
  attempt: number;
};

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

const DEFAULT_LEASE_SECONDS = 300;

export async function claimWorkspaceSetupStage(
  client: RpcClient,
  input: { setupRunId: string; stage: string; expectedStatus: string; leaseSeconds?: number },
): Promise<DurableLease | null> {
  const { data, error } = await client.rpc("claim_workspace_setup_stage", {
    setup_run_id: input.setupRunId,
    stage_key: input.stage,
    expected_status: input.expectedStatus,
    lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });
  if (error) throw error;
  return readLease(data);
}

export async function mergeWorkspaceSetupStage(
  client: RpcClient,
  input: { setupRunId: string; stage: string; leaseToken: string; patch: Record<string, unknown> },
): Promise<boolean> {
  const { data, error } = await client.rpc("merge_workspace_setup_stage", {
    setup_run_id: input.setupRunId,
    stage_key: input.stage,
    current_lease_token: input.leaseToken,
    stage_patch: input.patch,
  });
  if (error) throw error;
  return data === true;
}

export async function heartbeatWorkspaceSetupStage(
  client: RpcClient,
  input: { setupRunId: string; stage: string; leaseToken: string; leaseSeconds?: number },
): Promise<boolean> {
  const { data, error } = await client.rpc("heartbeat_workspace_setup_stage", {
    setup_run_id: input.setupRunId,
    stage_key: input.stage,
    current_lease_token: input.leaseToken,
    lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });
  if (error) throw error;
  return data === true;
}

export async function claimSourceSyncJob(
  client: RpcClient,
  input: { jobId: string; leaseSeconds?: number },
): Promise<DurableLease | null> {
  const { data, error } = await client.rpc("claim_source_sync_job", {
    job_id: input.jobId,
    lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });
  if (error) throw error;
  return readLease(data);
}

export async function heartbeatSourceSyncJob(
  client: RpcClient,
  input: { jobId: string; leaseToken: string; leaseSeconds?: number },
): Promise<boolean> {
  const { data, error } = await client.rpc("heartbeat_source_sync_job", {
    job_id: input.jobId,
    current_lease_token: input.leaseToken,
    lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });
  if (error) throw error;
  return data === true;
}

export async function finishSourceSyncJob(
  client: RpcClient,
  input: {
    jobId: string;
    leaseToken: string;
    status: "completed" | "completed_with_limits" | "failed";
    error?: string;
  },
): Promise<boolean> {
  const { data, error } = await client.rpc("finish_source_sync_job", {
    job_id: input.jobId,
    current_lease_token: input.leaseToken,
    next_status: input.status,
    public_error: input.error ?? null,
  });
  if (error) throw error;
  return data === true;
}

export function nextAvailableAt(attempt: number, now = new Date()): string {
  const normalizedAttempt = Math.max(1, Math.floor(attempt));
  const delaySeconds = Math.min(300, 5 * (2 ** (normalizedAttempt - 1)));
  return new Date(now.getTime() + delaySeconds * 1000).toISOString();
}

function readLease(value: unknown): DurableLease | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const lease = value as Record<string, unknown>;
  const token = typeof lease.token === "string" ? lease.token : typeof lease.lease_token === "string" ? lease.lease_token : "";
  const expiresAt = typeof lease.expiresAt === "string"
    ? lease.expiresAt
    : typeof lease.expires_at === "string"
      ? lease.expires_at
      : "";
  const attempt = Number(lease.attempt);
  return token && expiresAt && Number.isInteger(attempt) && attempt > 0 ? { token, expiresAt, attempt } : null;
}
