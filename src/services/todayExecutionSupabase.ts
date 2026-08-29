import type { SupabaseClient } from "@supabase/supabase-js";
import {
  projectTodayExecution,
  type TodayCheckpointState,
  type TodayExecutionProjection,
  type TodayMissionState,
  type TodayPermissionState,
  type TodayQuestionAnswerKind,
  type TodayQuestionState,
  type TodayRuntimePacket,
  type TodayTaskState,
} from "../features/desk/todayProjection";

export async function loadTodayExecutionProjection(
  client: SupabaseClient,
  currentMissionIds: string[],
  now = new Date(),
): Promise<TodayExecutionProjection> {
  const requestedMissionIds = [...new Set(currentMissionIds.map((id) => id.trim()).filter(Boolean))].slice(0, 100);
  if (!requestedMissionIds.length) return emptyProjection(now);

  const { data: missionData, error: missionError } = await client
    .from("missions")
    .select("id,account_id,artist_workspace_id,artist_id,title,status,priority,health,current_recommendation,active_plan_version_id,created_at")
    .in("id", requestedMissionIds)
    .in("status", ["active", "blocked"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (missionError) throw missionError;
  const missionRows = (missionData ?? []) as Record<string, unknown>[];
  const anchor = missionRows[0];
  const workspace = anchor ? {
    accountId: text(anchor.account_id),
    artistWorkspaceId: text(anchor.artist_workspace_id),
    artistId: text(anchor.artist_id),
  } : null;
  if (!workspace?.accountId || !workspace.artistWorkspaceId || !workspace.artistId) return emptyProjection(now);

  const ownedMissionRows = missionRows.filter((row) =>
    text(row.account_id) === workspace.accountId &&
    text(row.artist_workspace_id) === workspace.artistWorkspaceId &&
    text(row.artist_id) === workspace.artistId,
  );
  const missions = ownedMissionRows.map(readMission).filter(Boolean) as TodayMissionState[];
  if (!missions.length) return emptyProjection(now);

  const missionIds = missions.map((mission) => mission.id);
  const activePlanIds = missions.flatMap((mission) => mission.activePlanVersionId ? [mission.activePlanVersionId] : []);
  const nowIso = now.toISOString();

  const [taskResult, checkpointResult, questionResult, permissionResult, checkpointLinkResult] = await Promise.all([
    client
      .from("tasks")
      .select("id,mission_id,mission_plan_version_id,primary_checkpoint_id,title,status,owner_role,work_mode,purpose,deadline,available_from,estimated_minutes,priority,approval_state,dependency,risk_if_late,created_at")
      .eq("account_id", workspace.accountId)
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .eq("artist_id", workspace.artistId)
      .in("mission_id", missionIds)
      .order("created_at", { ascending: true })
      .limit(300),
    client
      .from("checkpoints")
      .select("id,mission_id,mission_plan_version_id,title,status,recommendation,next_action,blocked_reason,dependency_impact,created_at")
      .eq("account_id", workspace.accountId)
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .eq("artist_id", workspace.artistId)
      .in("mission_id", missionIds)
      .order("created_at", { ascending: true })
      .limit(200),
    client
      .from("manager_question_requests")
      .select("id,mission_id,task_id,conversation_id,context_request_id,question_key,status,question,reason,answer_kind,options,expires_at,created_at")
      .eq("account_id", workspace.accountId)
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .eq("artist_id", workspace.artistId)
      .eq("status", "pending")
      .in("mission_id", missionIds)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: true })
      .limit(50),
    client
      .from("permission_requests")
      .select("id,mission_id,task_id,checkpoint_id,request_type,title,body,risk,status,expires_at,created_at")
      .eq("account_id", workspace.accountId)
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .eq("artist_id", workspace.artistId)
      .eq("status", "pending")
      .in("mission_id", missionIds)
      .order("created_at", { ascending: true })
      .limit(50),
    activePlanIds.length
      ? client
          .from("mission_plan_checkpoints")
          .select("mission_plan_version_id,mission_id,checkpoint_id,order_index")
          .eq("account_id", workspace.accountId)
          .eq("artist_workspace_id", workspace.artistWorkspaceId)
          .eq("artist_id", workspace.artistId)
          .in("mission_plan_version_id", activePlanIds)
          .order("order_index", { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (taskResult.error) throw taskResult.error;
  if (checkpointResult.error) throw checkpointResult.error;
  if (questionResult.error) throw questionResult.error;
  if (permissionResult.error) throw permissionResult.error;
  if (checkpointLinkResult.error) throw checkpointLinkResult.error;

  const checkpointOrder = new Map<string, number>();
  for (const row of (checkpointLinkResult.data ?? []) as Record<string, unknown>[]) {
    const checkpointId = text(row.checkpoint_id);
    const order = integer(row.order_index);
    if (checkpointId && order) checkpointOrder.set(checkpointId, order);
  }

  const packet: TodayRuntimePacket = {
    now: nowIso,
    missions,
    tasks: ((taskResult.data ?? []) as Record<string, unknown>[]).map(readTask).filter(Boolean) as TodayTaskState[],
    checkpoints: ((checkpointResult.data ?? []) as Record<string, unknown>[]).map((row) => readCheckpoint(row, checkpointOrder)).filter(Boolean) as TodayCheckpointState[],
    questions: ((questionResult.data ?? []) as Record<string, unknown>[]).map(readQuestion).filter(Boolean) as TodayQuestionState[],
    permissions: ((permissionResult.data ?? []) as Record<string, unknown>[]).map(readPermission).filter((item): item is TodayPermissionState => Boolean(item && !isExpired(item.expiresAt, now))),
  };

  return projectTodayExecution(packet);
}

function readMission(row: Record<string, unknown>): TodayMissionState | null {
  const id = text(row.id);
  const title = text(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    status: text(row.status) || "active",
    priority: integer(row.priority) ?? 0,
    health: optionalText(row.health),
    recommendation: optionalText(row.current_recommendation),
    activePlanVersionId: optionalText(row.active_plan_version_id),
    createdAt: optionalText(row.created_at),
  };
}

function readTask(row: Record<string, unknown>): TodayTaskState | null {
  const id = text(row.id);
  const missionId = text(row.mission_id);
  const title = text(row.title);
  if (!id || !missionId || !title) return null;
  return {
    id,
    missionId,
    planVersionId: optionalText(row.mission_plan_version_id),
    checkpointId: optionalText(row.primary_checkpoint_id),
    title,
    status: text(row.status) || "proposed",
    ownerRole: optionalText(row.owner_role),
    workMode: optionalText(row.work_mode),
    purpose: optionalText(row.purpose),
    deadline: optionalText(row.deadline),
    availableFrom: optionalText(row.available_from),
    estimatedMinutes: integer(row.estimated_minutes),
    priority: integer(row.priority) ?? 0,
    approvalState: optionalText(row.approval_state),
    dependency: optionalText(row.dependency),
    riskIfLate: optionalText(row.risk_if_late),
    createdAt: optionalText(row.created_at),
  };
}

function readCheckpoint(row: Record<string, unknown>, orderById: Map<string, number>): TodayCheckpointState | null {
  const id = text(row.id);
  const missionId = text(row.mission_id);
  const title = text(row.title);
  if (!id || !missionId || !title) return null;
  return {
    id,
    missionId,
    planVersionId: optionalText(row.mission_plan_version_id),
    title,
    status: text(row.status) || "waiting",
    recommendation: optionalText(row.recommendation),
    nextAction: optionalText(row.next_action),
    blockedReason: optionalText(row.blocked_reason),
    dependencyImpact: optionalText(row.dependency_impact),
    orderIndex: orderById.get(id),
    createdAt: optionalText(row.created_at),
  };
}

function readQuestion(row: Record<string, unknown>): TodayQuestionState | null {
  const id = text(row.id);
  const contextRequestId = text(row.context_request_id);
  const questionKey = text(row.question_key);
  const question = text(row.question);
  const answerKind = readAnswerKind(row.answer_kind);
  if (!id || !contextRequestId || !questionKey || !question || !answerKind) return null;
  return {
    id,
    missionId: optionalText(row.mission_id),
    taskId: optionalText(row.task_id),
    conversationId: optionalText(row.conversation_id),
    contextRequestId,
    questionKey,
    status: text(row.status) || "pending",
    question,
    reason: text(row.reason) || "Desk needs this answer before it can safely continue.",
    answerKind,
    options: stringArray(row.options).slice(0, 5),
    expiresAt: optionalText(row.expires_at),
    createdAt: optionalText(row.created_at),
  };
}

function readPermission(row: Record<string, unknown>): TodayPermissionState | null {
  const id = text(row.id);
  const title = text(row.title);
  if (!id || !title) return null;
  return {
    id,
    missionId: optionalText(row.mission_id),
    taskId: optionalText(row.task_id),
    checkpointId: optionalText(row.checkpoint_id),
    requestType: text(row.request_type) || "sensitive_commitment",
    title,
    body: optionalText(row.body),
    risk: optionalText(row.risk),
    status: text(row.status) || "pending",
    expiresAt: optionalText(row.expires_at),
    createdAt: optionalText(row.created_at),
  };
}

function emptyProjection(now: Date): TodayExecutionProjection {
  return {
    headline: "No action needed from you right now.",
    supporting: [],
    watches: [],
    generatedAt: now.toISOString(),
  };
}

function readAnswerKind(value: unknown): TodayQuestionAnswerKind | undefined {
  const kind = text(value) as TodayQuestionAnswerKind;
  return ["short_text", "single_select", "multi_select", "money_range"].includes(kind) ? kind : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function isExpired(value: string | undefined, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown) {
  const valueText = text(value);
  return valueText || undefined;
}

function integer(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number.parseInt(value, 10);
  return undefined;
}
