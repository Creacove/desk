import type { ConversationViewModel, ConversationMessageViewModel } from "../../types/cleanProduction";

export type ManagerWorkItem = NonNullable<ConversationMessageViewModel["createdWork"]>[number];

export type ManagerWorkspaceResult = {
  kind: "workspace";
  musicItem?: ManagerWorkItem;
  mission?: ManagerWorkItem;
  tasks: ManagerWorkItem[];
};

export type ManagerWorkGroup =
  | ManagerWorkspaceResult
  | { kind: "draft"; item: ManagerWorkItem }
  | { kind: "mission"; mission: ManagerWorkItem; tasks: ManagerWorkItem[] }
  | { kind: "tasks"; tasks: ManagerWorkItem[] }
  | { kind: "music"; item: ManagerWorkItem };

export type ManagerTurnViewModel = {
  message: ConversationMessageViewModel;
  work: ManagerWorkGroup[];
};

function workKey(item: ManagerWorkItem) {
  const label = typeof item.title === "string" ? item.title.trim().toLowerCase() : "untitled";
  const kind = item.artifactKind ?? item.type;
  return `${kind}:${item.id ?? item.managerOutputId ?? label}`;
}

export function dedupeManagerWork(items: ManagerWorkItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = workKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupManagerWork(items: ManagerWorkItem[]): ManagerWorkGroup[] {
  const unique = dedupeManagerWork(items.filter((item) =>
    item.visibility !== "internal"
    && item.presentationRole !== "internal_support"
    && item.presentationRole !== "compatibility"
    && item.documentType !== "release_narrative"
    && item.title.trim().toLowerCase() !== "release narrative"
  ));
  const drafts = unique.filter((item) => item.artifactKind === "task_draft" || item.artifactKind === "song_document");
  const missions = unique.filter((item) => item.type === "mission" && item.artifactKind !== "task_draft" && item.artifactKind !== "song_document");
  const tasks = unique.filter((item) => item.type === "task" && item.artifactKind !== "task_draft" && item.artifactKind !== "song_document");
  const music = unique.filter((item) => item.type === "music_item" && item.artifactKind !== "song_document");
  const groups: ManagerWorkGroup[] = drafts.map((item) => ({ kind: "draft", item }));

  const workspaceMissionIds = new Set(missions.map((item) => item.id).filter(Boolean));
  const workspaceMusic = music.find((item) => item.id);
  const workspaceMission = missions.find((item) => item.id);
  const workspaceTasks = tasks.filter((item) => item.parentMissionId && workspaceMissionIds.has(item.parentMissionId));
  const isWorkspaceBatch = Boolean(workspaceMusic && workspaceMission);

  if (isWorkspaceBatch) {
    groups.push({ kind: "workspace", musicItem: workspaceMusic, mission: workspaceMission, tasks: workspaceTasks });
  }

  missions
    .filter((mission) => !isWorkspaceBatch || mission !== workspaceMission)
    .forEach((mission) => groups.push({
      kind: "mission",
      mission,
      tasks: tasks.filter((task) => task.parentMissionId === mission.id),
    }));

  const attachedTaskIds = new Set(groups.flatMap((group) => group.kind === "mission" || group.kind === "workspace"
    ? group.tasks.map((task) => workKey(task))
    : []));
  const standaloneTasks = tasks.filter((task) => !attachedTaskIds.has(workKey(task)));
  if (standaloneTasks.length) groups.push({ kind: "tasks", tasks: standaloneTasks });

  music
    .filter((item) => !isWorkspaceBatch || item !== workspaceMusic)
    .forEach((item) => groups.push({ kind: "music", item }));

  return groups;
}

export function buildManagerTurns(conversation: ConversationViewModel): ManagerTurnViewModel[] {
  const messageCreatedWork = conversation.messages.flatMap((message) => message.createdWork ?? []);
  const fallbackWork = conversation.createdWork.length && messageCreatedWork.length === 0 ? conversation.createdWork : [];
  const lastManagerIndex = conversation.messages.reduce((last, message, index) => message.speaker === "manager" ? index : last, -1);
  const fallbackIndex = lastManagerIndex >= 0 ? lastManagerIndex : Math.max(0, conversation.messages.length - 1);

  return conversation.messages.map((message, index) => ({
    message,
    work: groupManagerWork([
      ...(message.createdWork ?? []),
      ...(index === fallbackIndex ? fallbackWork : []),
    ]),
  }));
}
