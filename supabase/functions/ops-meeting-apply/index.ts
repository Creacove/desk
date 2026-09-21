import { withAppErrorCapture } from "../_shared/appFunction.ts";
import {
  isUuid,
  OperatorAuthorizationError,
  requireOperatorWorkspaceAccess,
} from "../_shared/operatorAuthorization.ts";
import { parseManagerConversationOutput, type ManagerConversationOutput } from "../_shared/openaiManagerConversation.ts";
import { persistManagerMissionGraphDecisions, preflightManagerMissionGraphTasks } from "../_shared/missionGraphPersistence.ts";
import { loadOpsMeetingContext, reviewPayload } from "../_shared/opsMeetingPacket.ts";

type ApplyRequest = {
  opsMeetingId: string;
  artistWorkspaceId: string;
  decision: "apply" | "decline";
  editedPayload?: ManagerConversationOutput;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

Deno.serve(withAppErrorCapture("ops-meeting-apply", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: ApplyRequest | null = null;
  let runId: string | null = null;
  let adminClient: any = null;
  let finalizeOnFailure = false;
  try {
    input = await request.json() as ApplyRequest;
    if (!input || !isUuid(input.opsMeetingId) || !isUuid(input.artistWorkspaceId) || !["apply", "decline"].includes(input.decision)) {
      return json({ error: "A meeting, workspace, and decision are required." }, 400);
    }

    const authorization = await requireOperatorWorkspaceAccess(request, input.artistWorkspaceId);
    adminClient = authorization.adminClient;
    const { actor } = authorization;
    const context = await loadOpsMeetingContext(adminClient, input.opsMeetingId, input.artistWorkspaceId, actor.userId);
    const run = await loadRun(adminClient, input.opsMeetingId, input.artistWorkspaceId);
    if (!run) return json({ error: "This meeting has not been processed for review." }, 409);
    runId = run.id;
    const existingReview = reviewPayload(run);
    if (run.result_payload?.reviewStatus === "applied") {
      return json({ status: "applied", runId: run.id, opsMeetingId: input.opsMeetingId, review: existingReview });
    }
    if (run.result_payload?.reviewStatus === "declined") {
      return json({ status: "declined", runId: run.id, opsMeetingId: input.opsMeetingId, review: existingReview });
    }
    if (run.status !== "completed" || !existingReview) {
      return json({ error: "The meeting review is not ready yet.", status: run.status }, 409);
    }

    if (input.decision === "decline") {
      await updateReviewStatus(adminClient, run.id, "declined", existingReview);
      await writeAudit(adminClient, actor.userId, context, run.id, "meeting_declined", { reviewStatus: "declined" });
      await finalize(adminClient, input.opsMeetingId, run.id, "declined");
      return json({ status: "declined", runId: run.id, opsMeetingId: input.opsMeetingId, review: existingReview });
    }

    finalizeOnFailure = true;
    const output = input.editedPayload
      ? parseManagerConversationOutput(JSON.stringify(input.editedPayload))
      : existingReview;
    await preflightManagerMissionGraphTasks(adminClient, run.id, output);
    const createdWork = await persistManagerMissionGraphDecisions(adminClient, {
      accountId: context.workspace.accountId,
      artistWorkspaceId: context.workspace.id,
      artistId: context.workspace.artistId,
    }, {
      runId: run.id,
      sourceType: "ops_meeting",
      sourceId: context.meeting.id,
      trigger: "ops_meeting",
    }, output);
    await persistOpsMeetingMemory(adminClient, context, run.id, output);
    const appliedOutput = { ...output, createdWork };
    await updateReviewStatus(adminClient, run.id, "applied", appliedOutput);
    await writeAudit(adminClient, actor.userId, context, run.id, "meeting_applied", {
      reviewStatus: "applied",
      createdWorkCount: createdWork.length,
    });
    await finalize(adminClient, input.opsMeetingId, run.id, "applied");
    finalizeOnFailure = false;
    return json({ status: "applied", runId: run.id, opsMeetingId: input.opsMeetingId, review: appliedOutput });
  } catch (error) {
    if (error instanceof OperatorAuthorizationError) return json({ error: error.message }, error.status);
    if (finalizeOnFailure && adminClient && input && runId) {
      try {
        await finalize(adminClient, input.opsMeetingId, runId, "failed", sanitizeError(error));
      } catch (finalizeError) {
        console.error("ops-meeting-apply finalize failed", finalizeError);
      }
    }
    console.error("ops-meeting-apply failed", error);
    return json({ error: sanitizeError(error) }, 500);
  }
}));

async function loadRun(db: any, meetingId: string, workspaceId: string) {
  const { data: meeting, error: meetingError } = await db.from("ops_meetings").select("desk_run_id").eq("id", meetingId).maybeSingle();
  if (meetingError) throw meetingError;
  if (!meeting?.desk_run_id) return null;
  const { data, error } = await db.from("manager_synthesis_runs")
    .select("id,status,result_payload,artist_workspace_id,account_id,artist_id,workflow_version")
    .eq("id", meeting.desk_run_id)
    .eq("artist_workspace_id", workspaceId)
    .eq("workflow_version", "ops_meeting_ingestion_v1")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function updateReviewStatus(db: any, runId: string, reviewStatus: string, output: unknown) {
  const { data: current, error: currentError } = await db.from("manager_synthesis_runs").select("result_payload").eq("id", runId).single();
  if (currentError) throw currentError;
  const { error } = await db.from("manager_synthesis_runs").update({
    result_payload: { ...(current?.result_payload ?? {}), reviewStatus, output },
  }).eq("id", runId);
  if (error) throw error;
}

async function persistOpsMeetingMemory(db: any, context: Awaited<ReturnType<typeof loadOpsMeetingContext>>, runId: string, output: ManagerConversationOutput) {
  const candidates = output.durableMemory.map((content) => content.trim()).filter(Boolean).slice(0, 8);
  if (!candidates.length) return;
  const { data: existing, error: existingError } = await db.from("memory_entries")
    .select("content")
    .eq("artist_workspace_id", context.workspace.id)
    .eq("source_type", "ops_meeting")
    .eq("source_id", context.meeting.id)
    .eq("created_from_run_id", runId);
  if (existingError) throw existingError;
  const known = new Set((existing ?? []).map((row: { content?: string }) => row.content));
  const rows = candidates.filter((content) => !known.has(content)).map((content) => ({
    account_id: context.workspace.accountId,
    artist_workspace_id: context.workspace.id,
    artist_id: context.workspace.artistId,
    scope: "artist",
    kind: "fact",
    content,
    source_type: "ops_meeting",
    source_id: context.meeting.id,
    confidence: "medium",
    reason: "Approved Ops meeting review",
    created_from_run_id: runId,
  }));
  if (!rows.length) return;
  const { error } = await db.from("memory_entries").insert(rows);
  if (error) throw error;
}

async function writeAudit(db: any, operatorUserId: string, context: Awaited<ReturnType<typeof loadOpsMeetingContext>>, runId: string, action: string, metadata: Record<string, unknown>) {
  const { error } = await db.from("operator_workspace_events").insert({
    operator_user_id: operatorUserId,
    artist_workspace_id: context.workspace.id,
    target_type: "ops_meeting",
    target_id: context.meeting.id,
    action,
    ops_meeting_id: context.meeting.id,
    manager_synthesis_run_id: runId,
    metadata,
  });
  if (error) throw error;
}

async function finalize(db: any, meetingId: string, runId: string, status: string, errorMessage?: string) {
  const { data, error } = await db.rpc("finalize_ops_meeting_processing_v1", {
    p_ops_meeting_id: meetingId,
    p_run_id: runId,
    p_status: status,
    ...(errorMessage ? { p_error: errorMessage } : {}),
  });
  if (error) throw error;
  return data;
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 300) || "Ops meeting review could not be applied.";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
