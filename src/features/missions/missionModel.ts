import type {
  MissionCheckpointViewModel,
  MissionEventViewModel,
  MissionNoteViewModel,
  MissionTaskDeliverableViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";

export type MissionRoomTab = "pulse" | "tasks" | "checkpoints" | "activity";
export type MissionSurface = "work" | "updates";
export type CompletionIntent = "completed" | "blocked";

export type TaskMutationState = {
  kind: "approve" | "complete" | "block" | "upload";
  status: "pending" | "error";
  message?: string;
};

export function missionTasks(mission: MissionViewModel): MissionTaskViewModel[] {
  if (mission.tasks) return mission.tasks;
  return [
    {
      id: `${mission.id}-next-task`,
      checkpointId: `${mission.id}-checkpoint`,
      title: mission.nextTask || "Review the Manager recommendation",
      owner: "Artist",
      deadline: mission.review || "Next review",
      approvalState: "active",
      purpose: mission.recommendation || "Move the mission forward with the next concrete action.",
      steps: ["Review the requested work", "Complete the action", "Return the result to the Manager"],
      evidenceIds: [],
      dependency: mission.review || "Manager review",
      riskIfLate: "The mission cannot move forward until this work is resolved.",
    },
  ];
}

export function missionCheckpoints(mission: MissionViewModel): MissionCheckpointViewModel[] {
  if (mission.checkpoints) return mission.checkpoints;
  return [
    {
      id: `${mission.id}-checkpoint`,
      phase: 1,
      title: mission.review || "Mission work",
      status: mission.status === "blocked" ? "Needs revision" : mission.status === "complete" ? "Met" : "Waiting on tasks",
      question: "Does the current work support the next Manager recommendation?",
      requiredTaskIds: [`${mission.id}-next-task`],
      dependsOnCheckpointIds: [],
      unlocks: [],
      blockedReason: mission.status === "blocked" ? mission.nextTask : "",
      dependencyImpact: "Downstream work waits until this stage is resolved.",
      watchedSignals: [mission.musicSubject].filter(Boolean),
      decisionRule: "Move forward when the required work and evidence are complete.",
      recommendation: mission.recommendation,
      rationale: mission.summary,
      managerRead: mission.recommendation,
      nextAction: mission.nextTask,
    },
  ];
}

export function missionNotes(mission: MissionViewModel): MissionNoteViewModel[] {
  if (mission.notes) return mission.notes;
  return mission.summary
    ? [
        {
          id: `${mission.id}-manager-note`,
          route: "Manager",
          subject: mission.title,
          message: mission.summary,
          status: mission.status,
          sourceBasis: mission.review,
          recommendedAction: mission.recommendation,
          resultingChange: mission.nextTask,
          briefType: "Manager update",
        },
      ]
    : [];
}

export function missionEvents(mission: MissionViewModel): MissionEventViewModel[] {
  return mission.events ?? [];
}

export function missionNeedsUser(mission: MissionViewModel) {
  const tasks = missionTasks(mission);
  const checkpoints = missionCheckpoints(mission);
  return Boolean(getNextArtistTask(tasks, checkpoints, [])) || mission.status === "blocked";
}

export function getNextArtistTask(tasks: MissionTaskViewModel[], checkpoints: MissionCheckpointViewModel[], optimisticCompleted: string[]) {
  return tasks.find((task) => {
    if (!isOpenArtistTask(task) || isTaskOptimisticallyDone(task, optimisticCompleted)) return false;
    const checkpoint = checkpoints.find((candidate) => candidate.id === task.checkpointId);
    return !checkpoint || !getBlockingDependency(checkpoint, checkpoints);
  });
}

export function isOpenArtistTask(task: MissionTaskViewModel) {
  return resolveTaskWorkMode(task) !== "manager_work" && !taskIsDone(task);
}

export function taskIsDone(task: MissionTaskViewModel) {
  return task.result?.status === "completed";
}

export function isTaskOptimisticallyDone(task: MissionTaskViewModel, optimisticCompleted: string[]) {
  return taskIsDone(task) || optimisticCompleted.includes(task.id);
}

export function resolveTaskWorkMode(task: MissionTaskViewModel) {
  if (task.workMode) return task.workMode;
  if (task.completionMode === "manager_draft") return "collaborative" as const;
  return task.owner.trim().toLowerCase() === "manager" ? "manager_work" as const : "artist_action" as const;
}

export function resolveTaskCompletionMode(task: MissionTaskViewModel) {
  if (task.completionMode) return task.completionMode;
  return taskNeedsDeliverable(task) ? "evidence" as const : "result_note" as const;
}

export function taskNeedsDeliverable(task: MissionTaskViewModel) {
  if (task.completionMode) return task.completionMode === "evidence";
  if (task.deliverables?.length || task.deliverableTitle) return true;
  return /\b(upload|file|document|master|artwork|split sheet|report|epk|press release|brief|memo)\b/i.test(
    [task.title, task.purpose, ...task.steps].join(" "),
  );
}

export function resolveTaskDeliverables(task: MissionTaskViewModel, local?: MissionTaskDeliverableViewModel[]) {
  if (local?.length) return local;
  if (task.deliverables?.length) return task.deliverables;
  if (!taskNeedsDeliverable(task)) return [];
  return [
    {
      id: `${task.id}-deliverable`,
      title: task.deliverableTitle?.trim() || "Supporting file",
      status: "missing" as const,
    },
  ];
}

export function replaceDeliverable(list: MissionTaskDeliverableViewModel[], next: MissionTaskDeliverableViewModel) {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => item.id === next.id ? { ...item, ...next } : item)
    : [...list, next];
}

export function getBlockingDependency(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  return checkpoint.dependsOnCheckpointIds
    .map((id) => checkpoints.find((candidate) => candidate.id === id))
    .find((candidate) => candidate && candidate.status !== "Met" && candidate.status !== "Ready for AI review");
}

export function getInitialCheckpointId(checkpoints: MissionCheckpointViewModel[], tasks: MissionTaskViewModel[]) {
  const attentionTask = getNextArtistTask(tasks, checkpoints, []);
  if (attentionTask) return attentionTask.checkpointId;
  return checkpoints.find((checkpoint) => checkpoint.status === "Needs revision" && !getBlockingDependency(checkpoint, checkpoints))?.id
    ?? checkpoints.find((checkpoint) => checkpoint.status !== "Met" && !getBlockingDependency(checkpoint, checkpoints))?.id
    ?? checkpoints[0]?.id
    ?? "";
}

export function getCurrentStage(mission: MissionViewModel, tasks: MissionTaskViewModel[]) {
  const checkpoints = missionCheckpoints(mission);
  const attentionTask = getNextArtistTask(tasks, checkpoints, []);
  if (attentionTask) return checkpoints.find((checkpoint) => checkpoint.id === attentionTask.checkpointId)?.title || "In progress";
  return checkpoints.find((checkpoint) => checkpoint.status !== "Met")?.title || (mission.status === "complete" ? "Complete" : "In progress");
}

export function getMissionNextLine(mission: MissionViewModel, tasks: MissionTaskViewModel[]) {
  const checkpoints = missionCheckpoints(mission);
  const artistTask = getNextArtistTask(tasks, checkpoints, []);
  if (artistTask) return artistTask.title;
  const managerTask = tasks.find((task) => resolveTaskWorkMode(task) === "manager_work" && !taskIsDone(task));
  if (managerTask) return `Manager is working on ${managerTask.title.toLowerCase()}`;
  return mission.nextTask || mission.recommendation || mission.summary;
}

export function managerDraftNeedsRevision(task: MissionTaskViewModel) {
  return task.result?.status === "revised" || task.managerDraft?.status === "needs_revision";
}

export function getTaskPrimaryLabel(task: MissionTaskViewModel, approved: boolean) {
  if (task.approvalState === "needs approval" && !approved) return "Review & approve";
  if (resolveTaskCompletionMode(task) === "manager_draft" && (!task.managerDraft || managerDraftNeedsRevision(task))) return "Work with Manager";
  if (resolveTaskCompletionMode(task) === "result_note") return "Add result";
  return "Open task";
}

export function humanCheckpointStatus(status: MissionCheckpointViewModel["status"]) {
  if (status === "Ready for AI review") return "Ready for Manager review";
  if (status === "Waiting on tasks") return "In progress";
  if (status === "Needs revision") return "Needs attention";
  if (status === "Watching signal") return "Manager watching";
  return "Complete";
}

export function humanDeliverableStatus(status: MissionTaskDeliverableViewModel["status"]) {
  if (status === "uploading") return "Uploading…";
  if (status === "uploaded") return "Uploaded";
  if (status === "checking") return "Manager checking";
  if (status === "accepted") return "Accepted";
  if (status === "needs_revision") return "Needs revision";
  if (status === "failed") return "Upload failed";
  return "Optional file";
}

export function humanUpdateLabel(value: string) {
  return value
    .replace(/manager\s*->\s*mission record/i, "Manager")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function omitKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
