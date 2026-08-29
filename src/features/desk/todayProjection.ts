export type TodayMissionState = {
  id: string;
  title: string;
  status: string;
  priority: number;
  health?: string;
  recommendation?: string;
  activePlanVersionId?: string;
  createdAt?: string;
};

export type TodayTaskState = {
  id: string;
  missionId: string;
  planVersionId?: string;
  checkpointId?: string;
  title: string;
  status: string;
  ownerRole?: string;
  workMode?: string;
  purpose?: string;
  deadline?: string;
  availableFrom?: string;
  estimatedMinutes?: number;
  priority: number;
  approvalState?: string;
  dependency?: string;
  riskIfLate?: string;
  createdAt?: string;
};

export type TodayCheckpointState = {
  id: string;
  missionId: string;
  planVersionId?: string;
  title: string;
  status: string;
  recommendation?: string;
  nextAction?: string;
  blockedReason?: string;
  dependencyImpact?: string;
  orderIndex?: number;
  createdAt?: string;
};

export type TodayQuestionState = {
  id: string;
  missionId?: string;
  taskId?: string;
  conversationId?: string;
  contextRequestId: string;
  status: string;
  question: string;
  reason: string;
  expiresAt?: string;
  createdAt?: string;
};

export type TodayPermissionState = {
  id: string;
  missionId?: string;
  taskId?: string;
  checkpointId?: string;
  requestType: string;
  title: string;
  body?: string;
  risk?: string;
  status: string;
  expiresAt?: string;
  createdAt?: string;
};

export type TodayRuntimePacket = {
  now: string;
  missions: TodayMissionState[];
  tasks: TodayTaskState[];
  checkpoints: TodayCheckpointState[];
  questions: TodayQuestionState[];
  permissions: TodayPermissionState[];
};

export type TodayManagerItem = {
  id: string;
  kind: "question" | "permission" | "task" | "watch";
  missionId: string;
  missionTitle: string;
  priorityTier: 0 | 1 | 2 | 3 | 4;
  priorityRank: number;
  headline: string;
  title: string;
  whyNow: string;
  cta: "answer" | "review" | "start" | "continue" | "fix" | "resolve" | "view";
  taskId?: string;
  conversationId?: string;
  contextRequestId?: string;
  permissionRequestId?: string;
  checkpointId?: string;
  estimatedMinutes?: number;
  owner?: string;
  availableFrom?: string;
  deadline?: string;
  dependencyImpact?: string;
};

export type TodayExecutionProjection = {
  headline: string;
  primary?: TodayManagerItem;
  supporting: TodayManagerItem[];
  watches: TodayManagerItem[];
  generatedAt: string;
};

const TERMINAL_TASK_STATUSES = new Set(["completed", "rejected", "archived", "superseded"]);
const TERMINAL_MISSION_STATUSES = new Set(["complete", "archived", "cancelled", "candidate"]);
const TERMINAL_CHECKPOINT_STATUSES = new Set(["met", "skipped"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function projectTodayExecution(packet: TodayRuntimePacket): TodayExecutionProjection {
  const now = safeDate(packet.now) ?? new Date();
  const missions = packet.missions
    .filter((mission) => mission.id && !TERMINAL_MISSION_STATUSES.has(normalize(mission.status)))
    .sort(compareMissions);
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const checkpointById = new Map(packet.checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
  const actionable: TodayManagerItem[] = [];

  for (const question of packet.questions) {
    const mission = question.missionId ? missionById.get(question.missionId) : undefined;
    if (!mission || normalize(question.status) !== "pending" || isExpired(question.expiresAt, now)) continue;
    actionable.push({
      id: question.id,
      kind: "question",
      missionId: mission.id,
      missionTitle: mission.title,
      priorityTier: 0,
      priorityRank: missionRank(mission, 500),
      headline: `Desk needs one thing for ${mission.title}.`,
      title: question.question,
      whyNow: question.reason || mission.recommendation || "Desk needs this answer before it can safely continue the current route.",
      cta: "answer",
      taskId: question.taskId,
      conversationId: question.conversationId,
      contextRequestId: question.contextRequestId,
    });
  }

  for (const permission of packet.permissions) {
    const mission = permission.missionId ? missionById.get(permission.missionId) : undefined;
    if (!mission || normalize(permission.status) !== "pending" || isExpired(permission.expiresAt, now)) continue;
    actionable.push({
      id: permission.id,
      kind: "permission",
      missionId: mission.id,
      missionTitle: mission.title,
      priorityTier: 0,
      priorityRank: missionRank(mission, 450),
      headline: `One approval is blocking ${mission.title}.`,
      title: permission.title,
      whyNow: permission.body || permission.risk || mission.recommendation || "Desk has prepared the next move and needs approval before the external effect.",
      cta: "review",
      taskId: permission.taskId,
      permissionRequestId: permission.id,
      checkpointId: permission.checkpointId,
    });
  }

  const permissionTaskIds = new Set(packet.permissions
    .filter((permission) => normalize(permission.status) === "pending" && !isExpired(permission.expiresAt, now))
    .flatMap((permission) => permission.taskId ? [permission.taskId] : []));

  for (const task of packet.tasks) {
    const mission = missionById.get(task.missionId);
    if (!mission || !isTaskOnCurrentPlan(task, mission) || !isHumanTask(task) || TERMINAL_TASK_STATUSES.has(normalize(task.status))) continue;
    if (permissionTaskIds.has(task.id)) continue;
    if (!isAvailableNow(task.availableFrom, now)) continue;

    const checkpoint = task.checkpointId ? checkpointById.get(task.checkpointId) : undefined;
    const taskStatus = normalize(task.status);
    const approvalState = normalize(task.approvalState);
    const blocked = taskStatus === "blocked" || approvalState === "blocked";
    const needsApproval = approvalState === "needs_approval" || taskStatus === "needs_approval";
    const urgent = isDueSoon(task.deadline, now);
    const inProgress = taskStatus === "in_progress";
    const priorityTier: TodayManagerItem["priorityTier"] = blocked || needsApproval ? 0 : urgent ? 1 : inProgress ? 2 : 3;
    const cta: TodayManagerItem["cta"] = blocked ? "resolve" : needsApproval ? "review" : inProgress ? "continue" : "start";
    const headline = blocked
      ? `Resolve this before ${mission.title} can move.`
      : needsApproval
        ? `One approval is blocking ${mission.title}.`
        : `${mission.title} is the priority today.`;

    actionable.push({
      id: task.id,
      kind: needsApproval ? "permission" : "task",
      missionId: mission.id,
      missionTitle: mission.title,
      priorityTier,
      priorityRank: taskRank(task, mission, checkpoint, now),
      headline,
      title: task.title,
      whyNow: taskWhyNow(task, checkpoint, mission),
      cta,
      taskId: task.id,
      checkpointId: task.checkpointId,
      estimatedMinutes: validMinutes(task.estimatedMinutes),
      owner: task.ownerRole,
      availableFrom: task.availableFrom,
      deadline: task.deadline,
      dependencyImpact: checkpoint?.dependencyImpact || task.dependency || task.riskIfLate,
    });
  }

  actionable.sort(compareItems);
  const primary = actionable[0];
  const supporting = actionable.slice(1, 3);
  const actionableMissionIds = new Set(actionable.map((item) => item.missionId));
  const watches = packet.checkpoints
    .filter((checkpoint) => {
      const mission = missionById.get(checkpoint.missionId);
      return Boolean(
        mission &&
        isCheckpointOnCurrentPlan(checkpoint, mission) &&
        !TERMINAL_CHECKPOINT_STATUSES.has(normalize(checkpoint.status)) &&
        normalize(checkpoint.status) === "watching_signal" &&
        !actionableMissionIds.has(mission.id),
      );
    })
    .map((checkpoint): TodayManagerItem => {
      const mission = missionById.get(checkpoint.missionId)!;
      return {
        id: checkpoint.id,
        kind: "watch",
        missionId: mission.id,
        missionTitle: mission.title,
        priorityTier: 4,
        priorityRank: missionRank(mission, checkpointOrderWeight(checkpoint)),
        headline: "Desk is watching the active plan.",
        title: checkpoint.title,
        whyNow: checkpoint.recommendation || checkpoint.nextAction || "No action needed from you right now.",
        cta: "view",
        checkpointId: checkpoint.id,
      };
    })
    .sort(compareItems)
    .slice(0, 2);

  return {
    headline: primary?.headline ?? (watches.length ? "Desk is watching the active plan." : "No action needed from you right now."),
    primary,
    supporting,
    watches,
    generatedAt: now.toISOString(),
  };
}

function compareItems(a: TodayManagerItem, b: TodayManagerItem) {
  return a.priorityTier - b.priorityTier || b.priorityRank - a.priorityRank || a.id.localeCompare(b.id);
}

function compareMissions(a: TodayMissionState, b: TodayMissionState) {
  return b.priority - a.priority || timestamp(a.createdAt) - timestamp(b.createdAt) || a.id.localeCompare(b.id);
}

function missionRank(mission: TodayMissionState, extra = 0) {
  const healthBoost = normalize(mission.health) === "at_risk" || normalize(mission.health) === "blocked" ? 80 : 0;
  return mission.priority * 1000 + healthBoost + extra;
}

function taskRank(task: TodayTaskState, mission: TodayMissionState, checkpoint: TodayCheckpointState | undefined, now: Date) {
  const status = normalize(task.status);
  const deadline = safeDate(task.deadline);
  const overdueBoost = deadline && deadline.getTime() < now.getTime() ? 350 : 0;
  const dueSoonBoost = deadline && deadline.getTime() >= now.getTime() && deadline.getTime() - now.getTime() <= ONE_DAY_MS ? 250 : 0;
  const continuityBoost = status === "in_progress" ? 180 : 0;
  const blockedBoost = status === "blocked" ? 220 : 0;
  return missionRank(mission) + task.priority * 20 + checkpointOrderWeight(checkpoint) + overdueBoost + dueSoonBoost + continuityBoost + blockedBoost;
}

function checkpointOrderWeight(checkpoint?: TodayCheckpointState) {
  if (!checkpoint?.orderIndex || checkpoint.orderIndex < 1) return 0;
  return Math.max(0, 100 - checkpoint.orderIndex);
}

function taskWhyNow(task: TodayTaskState, checkpoint: TodayCheckpointState | undefined, mission: TodayMissionState) {
  if (normalize(task.status) === "blocked") {
    return task.dependency || checkpoint?.blockedReason || checkpoint?.dependencyImpact || task.riskIfLate || "The current route cannot move until this blocker is resolved.";
  }
  if (normalize(task.approvalState) === "needs_approval" || normalize(task.status) === "needs_approval") {
    return task.purpose || checkpoint?.dependencyImpact || "Desk has prepared the next move and needs approval before continuing.";
  }
  return task.purpose || checkpoint?.dependencyImpact || checkpoint?.recommendation || mission.recommendation || "This is the next ready human action in the current plan.";
}

function isTaskOnCurrentPlan(task: TodayTaskState, mission: TodayMissionState) {
  if (!mission.activePlanVersionId) return !task.planVersionId || true;
  return !task.planVersionId || task.planVersionId === mission.activePlanVersionId;
}

function isCheckpointOnCurrentPlan(checkpoint: TodayCheckpointState, mission: TodayMissionState) {
  if (!mission.activePlanVersionId) return true;
  return !checkpoint.planVersionId || checkpoint.planVersionId === mission.activePlanVersionId;
}

function isHumanTask(task: TodayTaskState) {
  const mode = normalize(task.workMode);
  if (mode) return mode !== "manager_work";
  return normalize(task.ownerRole) !== "manager";
}

function isDueSoon(value: string | undefined, now: Date) {
  const date = safeDate(value);
  if (!date) return false;
  return date.getTime() <= now.getTime() + ONE_DAY_MS;
}

function isAvailableNow(value: string | undefined, now: Date) {
  const date = safeDate(value);
  return !date || date.getTime() <= now.getTime();
}

function isExpired(value: string | undefined, now: Date) {
  const date = safeDate(value);
  return Boolean(date && date.getTime() <= now.getTime());
}

function validMinutes(value: number | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function safeDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timestamp(value: string | undefined) {
  return safeDate(value)?.getTime() ?? 0;
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";
}
