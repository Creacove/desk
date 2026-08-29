import type { SupabaseClient } from "@supabase/supabase-js";
import {
  projectTodayExecution,
  type TodayCheckpointState,
  type TodayExecutionProjection,
  type TodayMissionState,
  type TodayPermissionState,
  type TodayQuestionState,
  type TodayRuntimePacket,
  type TodayTaskState,
} from "../features/desk/todayProjection";

export async function loadTodayExecutionProjection(
  client: SupabaseClient,
  now = new Date(),
): Promise<TodayExecutionProjection> {
  const workspace = await loadActiveWorkspaceIdentity(client);
  if (!workspace) return emptyProjection(now);

  const { data: missionData, error: missionError } = await client
    .from("missions")
    .select("id,title,status,priority,health,current_recommendation,active_plan_version_id,created_at")
    .eq("account_id", workspace.accountId)
    .eq("artist_workspace_id", workspace.artistWorkspaceId)
    .eq("artist_id", workspace.artistId)
    .in("status", ["active", "blocked"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (missionError) throw missionError;
  const missions = ((missionData ?? []) as Record<string, unknown>[]).map(readMission).filter(Boolean) as TodayMissionState[];
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
      .select("id,mission_id,task_id,conversation_id,context_request_id,status,question,reason,expires_at,created_at")
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

async function loadActiveWorkspaceIdentity(client: SupabaseClient) {
  const { data: memberships, error: membershipError } = await client
    .from("account_memberships")
    .select("account_id")
    .eq("status", "active")
    .limit(1);
  if (membershipError) throw membershipError;
  const accountId = text((memberships?.[0] as Record<string, unknown> | undefined)?.account_id);
  if (!accountId) return null;

  const { data: workspaces, error: workspaceError } = await client
    .from("artist_workspaces")
    .select("id,artist_id")
    .eq("account_id", accountId)
    .in("status", ["setup", "active"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (workspaceError) throw workspaceError;
  const row = workspaces?.[0] as Record<string, unknown> | undefined;
  const artistWorkspaceId = text(row?.id);
  const artistId = text(row?.artist_id);
  return artistWorkspaceId && artistId ? { accountId, artistWorkspaceId, artistId } : null;
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
  const question = text(row.question);
  if (!id || !contextRequestId || !question) return null;
  return {
    id,
    missionId: optionalText(row.mission_id),
    taskId: optionalText(row.task_id),
    conversationId: optionalText(row.conversation_id),
    contextRequestId,
    status: text(row.status) || "pending",
    question,
    reason: text(row.reason) || "Desk needs this answer before it can safely continue.",
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
