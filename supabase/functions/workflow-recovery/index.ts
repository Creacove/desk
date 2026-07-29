import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECOVERY_BATCH_SIZE = 4;
const PERMANENT_HTTP_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

type RecoveryMode = "observe" | "run";
type WorkflowVersion =
  | "workspace-setup-v1" | "workspace_setup_v1"
  | "source-sync-v1" | "spotify_catalog_bootstrap_v1"
  | "music-manager-read-v2" | "music_manager_read_v2"
  | "mission-genesis-v2"
  | "todays-brief-v1" | "todays_brief_v1";
type RecoveryCandidate = {
  entity_type: "manager_synthesis_run" | "source_sync_job" | "workspace_setup_run";
  id: string;
  workflow_version: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  status: "queued" | "running";
  attempt_count: number;
  max_attempts: number;
  payload: Record<string, unknown>;
};

type RecoveryContext = {
  supabaseUrl: string;
  serviceRoleKey: string;
  candidate: RecoveryCandidate;
};

const handlers = {
  "workspace-setup-v1": recoverWorkspaceSetup,
  "workspace_setup_v1": recoverWorkspaceSetup,
  "source-sync-v1": recoverSourceSync,
  "spotify_catalog_bootstrap_v1": recoverSourceSync,
  "music-manager-read-v2": recoverMusicManagerRead,
  "music_manager_read_v2": recoverMusicManagerRead,
  "mission-genesis-v2": recoverMissionGenesis,
  "todays-brief-v1": recoverTodaysBrief,
  "todays_brief_v1": recoverTodaysBrief,
} as const;

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const suppliedSecret = request.headers.get("x-workflow-worker-secret") ?? "";
  const expectedSecret = requireEnv("WORKFLOW_WORKER_SECRET");
  if (!constantTimeEqual(suppliedSecret, expectedSecret)) return json({ error: "Unauthorized." }, 401);

  const body = await request.json().catch(() => ({ mode: "observe" }));
  const mode: RecoveryMode = body?.mode === "run" ? "run" : "observe";
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(supabaseUrl, serviceRoleKey);

  if (mode === "run") {
    const { error: reapError } = await db.rpc("reap_expired_workflows", { batch_size: RECOVERY_BATCH_SIZE });
    if (reapError) return json({ error: "Expired workflow leases could not be reconciled." }, 503);
  }

  const { data, error } = await db.rpc("list_workflow_recovery_candidates", { batch_size: RECOVERY_BATCH_SIZE });
  if (error) return json({ error: "Recovery candidates could not be listed." }, 503);
  const candidates = Array.isArray(data) ? data.filter(isRecoveryCandidate).slice(0, RECOVERY_BATCH_SIZE) : [];
  if (mode === "observe") {
    return json({ mode: "observe", candidates: candidates.map(candidateSummary) });
  }

  const enabledVersions = new Set(
    (Deno.env.get("WORKFLOW_RECOVERY_ENABLED_VERSIONS") ?? "")
      .split(",").map((value) => value.trim()).filter(Boolean),
  );
  const results: Array<Record<string, unknown>> = [];
  for (const candidate of candidates) {
    if (!isWorkflowVersion(candidate.workflow_version)) {
      console.warn("Ignoring unknown workflow recovery version", { id: candidate.id, workflowVersion: candidate.workflow_version });
      results.push({ ...candidateSummary(candidate), status: "ignored_unknown_version" });
      continue;
    }
    const handler = handlers[candidate.workflow_version];
    if (!enabledVersions.has(candidate.workflow_version)) {
      results.push({ ...candidateSummary(candidate), status: "observed_disabled" });
      continue;
    }

    try {
      await assertRecoveryOwner(db, candidate);
      const response = await handler({ supabaseUrl, serviceRoleKey, candidate });
      if (response.ok) {
        results.push({ ...candidateSummary(candidate), status: "dispatched" });
      } else if (PERMANENT_HTTP_STATUSES.has(response.status)) {
        const message = `Recovery dispatch was permanently rejected (${response.status}).`;
        await terminalizeRecoveryFailure(db, candidate, message);
        results.push({ ...candidateSummary(candidate), status: "failed_permanent" });
      } else {
        await deferRecovery(db, candidate, `Recovery dispatch failed (${response.status}).`);
        results.push({ ...candidateSummary(candidate), status: "deferred" });
      }
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "Recovery dispatch failed.";
      if (dispatchError instanceof PermanentRecoveryError) {
        await terminalizeRecoveryFailure(db, candidate, message);
        results.push({ ...candidateSummary(candidate), status: "failed_permanent" });
      } else {
        await deferRecovery(db, candidate, message);
        results.push({ ...candidateSummary(candidate), status: "deferred" });
      }
    }
  }

  return json({ mode: "run", processed: results });
});

async function assertRecoveryOwner(db: any, candidate: RecoveryCandidate) {
  const { data, error } = await db.from("artist_workspaces").select("id")
    .eq("id", candidate.artist_workspace_id)
    .eq("account_id", candidate.account_id)
    .eq("artist_id", candidate.artist_id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new PermanentRecoveryError("Recovery owner tuple no longer exists.");
}

async function recoverWorkspaceSetup(context: RecoveryContext) {
  const stage = readString(context.candidate.payload.current_stage);
  return invokeWorkflowFunction(context, "paid-workspace-setup", {
    checkoutSessionId: readString(context.candidate.payload.checkout_session_id),
    phase: ["setup_brief", "music_reads"].includes(stage) ? "contextualize" : "discovery",
  });
}

async function recoverSourceSync(context: RecoveryContext) {
  const target = readRecord(context.candidate.payload.target_payload);
  const jobType = readString(context.candidate.payload.job_type);
  if (!jobType.includes("spotify")) throw new PermanentRecoveryError("Unsupported source-sync recovery job type.");
  const spotifyArtistId = readString(target.spotify_artist_id);
  if (!spotifyArtistId) throw new PermanentRecoveryError("Spotify source-sync recovery target is incomplete.");
  return invokeWorkflowFunction(context, "spotify-catalog-bootstrap", {
    accountId: context.candidate.account_id,
    artistWorkspaceId: context.candidate.artist_workspace_id,
    artistId: context.candidate.artist_id,
    selectedArtist: {
      spotifyArtistId,
      name: readString(target.spotify_artist_name) || "Spotify artist",
      spotifyUrl: readString(target.spotify_url) || `https://open.spotify.com/artist/${spotifyArtistId}`,
    },
    market: readString(target.market) || "US",
    sourceSyncJobId: context.candidate.id,
    setupRunId: readString(context.candidate.payload.workspace_setup_run_id) || undefined,
  });
}

async function recoverMusicManagerRead(context: RecoveryContext) {
  return invokeWorkflowFunction(context, "generate-music-summary", {
    accountId: context.candidate.account_id,
    artistWorkspaceId: context.candidate.artist_workspace_id,
    artistId: context.candidate.artist_id,
    subjectType: readString(context.candidate.payload.subject_type),
    subjectId: readString(context.candidate.payload.subject_id),
    recoveryRunId: context.candidate.id,
  });
}

async function recoverMissionGenesis(context: RecoveryContext) {
  const audit = readRecord(context.candidate.payload.context_payload);
  return invokeWorkflowFunction(context, "mission-genesis", {
    accountId: context.candidate.account_id,
    artistWorkspaceId: context.candidate.artist_workspace_id,
    artistId: context.candidate.artist_id,
    mode: audit.mode === "continuation" ? "continuation" : "initial",
    candidateMissionId: readString(context.candidate.payload.mission_id) || undefined,
    answers: Array.isArray(audit.contextAnswers) ? audit.contextAnswers : undefined,
    recoveryRunId: context.candidate.id,
  });
}

async function recoverTodaysBrief(context: RecoveryContext) {
  const audit = readRecord(context.candidate.payload.context_payload);
  return invokeWorkflowFunction(context, "generate-todays-brief", {
    accountId: context.candidate.account_id,
    artistWorkspaceId: context.candidate.artist_workspace_id,
    artistId: context.candidate.artist_id,
    trigger: audit.generationMode === "setup-map" ? "setup" : "manual",
    generationMode: audit.generationMode === "setup-map" ? "setup-map" : "operating",
    recoveryRunId: context.candidate.id,
  });
}

function invokeWorkflowFunction(context: RecoveryContext, functionName: string, body: Record<string, unknown>) {
  return fetch(`${context.supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.serviceRoleKey}`,
      apikey: context.serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function deferRecovery(db: any, candidate: RecoveryCandidate, message: string) {
  const nextAttempt = Math.max(1, candidate.attempt_count + 1);
  if (nextAttempt >= candidate.max_attempts) {
    await terminalizeRecoveryFailure(db, candidate, "Maximum recovery attempts exhausted.");
    return;
  }
  const table = recoveryTable(candidate.entity_type);
  const counter = candidate.entity_type === "workspace_setup_run" ? "retry_count" : "attempt_count";
  const errorColumn = candidate.entity_type === "workspace_setup_run" ? "last_error" : "error";
  const { error } = await db.from(table).update({
    [counter]: nextAttempt,
    [errorColumn]: bounded(message, 500),
    available_at: nextRetryAt(nextAttempt),
  }).eq("id", candidate.id).eq("status", "queued");
  if (error) throw error;
}

async function terminalizeRecoveryFailure(db: any, candidate: RecoveryCandidate, message: string) {
  const table = recoveryTable(candidate.entity_type);
  const errorColumn = candidate.entity_type === "workspace_setup_run" ? "last_error" : "error";
  const { error } = await db.from(table).update({
    status: "failed",
    [errorColumn]: bounded(message, 500),
    completed_at: new Date().toISOString(),
    lease_token: null,
    lease_expires_at: null,
  }).eq("id", candidate.id).eq("status", "queued");
  if (error) throw error;

  if (candidate.entity_type !== "workspace_setup_run") {
    const foreignKey = candidate.entity_type === "manager_synthesis_run" ? "manager_synthesis_run_id" : "source_sync_job_id";
    const { error: usageError } = await db.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: bounded(message, 500),
      completed_at: new Date().toISOString(),
    }).eq(foreignKey, candidate.id).eq("status", "started");
    if (usageError) throw usageError;
  }
}

function nextRetryAt(attempt: number) {
  const baseSeconds = Math.min(300, 5 * (2 ** Math.max(0, attempt - 1)));
  const jitterSeconds = Math.floor(Math.random() * Math.max(1, Math.floor(baseSeconds * 0.2)));
  return new Date(Date.now() + (baseSeconds + jitterSeconds) * 1000).toISOString();
}

function recoveryTable(entityType: RecoveryCandidate["entity_type"]) {
  if (entityType === "manager_synthesis_run") return "manager_synthesis_runs";
  if (entityType === "source_sync_job") return "source_sync_jobs";
  return "workspace_setup_runs";
}

function isRecoveryCandidate(value: unknown): value is RecoveryCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.workflow_version === "string" &&
    typeof row.account_id === "string" && typeof row.artist_workspace_id === "string" &&
    typeof row.artist_id === "string" && typeof row.entity_type === "string" &&
    (row.status === "queued" || row.status === "running") && row.payload !== null && typeof row.payload === "object";
}

function isWorkflowVersion(value: string): value is WorkflowVersion {
  return Object.prototype.hasOwnProperty.call(handlers, value);
}

function candidateSummary(candidate: RecoveryCandidate) {
  return { id: candidate.id, entityType: candidate.entity_type, workflowVersion: candidate.workflow_version, status: candidate.status };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function bounded(value: string, length: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, length);
}

class PermanentRecoveryError extends Error {}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length, 1);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^
      (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }
  return difference === 0;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}
