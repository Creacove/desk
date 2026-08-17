import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type {
  DrawerKind,
  MissionCheckpointViewModel,
  MissionEventViewModel,
  MissionNoteViewModel,
  MissionTaskDeliverableViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";
import { SongContextAttachment } from "../music/SongRoomAttachments";

type MissionRoomTab = "pulse" | "tasks" | "checkpoints" | "activity";
type MissionSurface = "work" | "updates";
type CompletionIntent = "completed" | "blocked";

type TaskMutationState = {
  kind: "approve" | "complete" | "block" | "upload";
  status: "pending" | "error";
  message?: string;
};

export function MissionsWorkspace({
  missions,
  selectedMissionId,
  onSelectMission,
  onCreateFirstMission,
  onOpenManager,
  onOpenMusicSubject,
  onWorkWithManager,
  firstMissionPending,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
  onDrawer,
  openRoomRequestKey = 0,
  openRoomTab,
  openTaskId,
  listRequestKey = 0,
  onRoomModeChange,
}: {
  missions: MissionViewModel[];
  selectedMissionId: string;
  onSelectMission: (id: string) => void;
  onCreateFirstMission: () => void;
  onOpenManager: () => void;
  onOpenMusicSubject?: (subject: { id: string; title: string; type: "music_item" | "music_project" }) => void;
  onWorkWithManager?: (taskId: string) => void;
  firstMissionPending: boolean;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[], managerOutputId?: string) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  onDrawer: (drawer: DrawerKind) => void;
  openRoomRequestKey?: number;
  openRoomTab?: MissionRoomTab;
  openTaskId?: string | null;
  listRequestKey?: number;
  onRoomModeChange?: (roomOpen: boolean) => void;
}) {
  const [roomMode, setRoomMode] = useState<"list" | "room">("list");
  const [surface, setSurface] = useState<MissionSurface>("work");

  const activeMissions = missions.filter((mission) => mission.status !== "complete");
  const completedMissions = missions.filter((mission) => mission.status === "complete");
  const selected = missions.find((mission) => mission.id === selectedMissionId) ?? activeMissions[0] ?? missions[0] ?? null;

  useEffect(() => {
    if (openRoomRequestKey <= 0) return;
    setRoomMode("room");
    setSurface(openRoomTab === "activity" ? "updates" : "work");
  }, [openRoomRequestKey, openRoomTab]);

  useEffect(() => {
    if (listRequestKey <= 0) return;
    setRoomMode("list");
    setSurface("work");
  }, [listRequestKey]);

  useEffect(() => {
    onRoomModeChange?.(roomMode === "room");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [roomMode, onRoomModeChange]);

  function openMission(mission: MissionViewModel) {
    onSelectMission(mission.id);
    setSurface("work");
    setRoomMode("room");
  }

  if (!missions.length) {
    return (
      <section className="app-workspace app-workspace-reveal">
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <EmptyMissionState
          onCreateFirstMission={onCreateFirstMission}
          onOpenManager={onOpenManager}
          firstMissionPending={firstMissionPending}
        />
      </section>
    );
  }

  if (!selected || roomMode === "list") {
    return (
      <section className="app-workspace app-workspace-reveal">
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <MissionList
          activeMissions={activeMissions}
          completedMissions={completedMissions}
          onOpen={openMission}
        />
      </section>
    );
  }

  return (
    <MissionRoom
      mission={selected}
      surface={surface}
      onSurface={setSurface}
      onBack={() => setRoomMode("list")}
      onApproveTask={onApproveTask}
      onCompleteTask={onCompleteTask}
      onUploadTaskDeliverable={onUploadTaskDeliverable}
      onWorkWithManager={onWorkWithManager}
      onOpenMusicSubject={onOpenMusicSubject}
      onDrawer={onDrawer}
      targetTaskId={openTaskId ?? undefined}
    />
  );
}

function EmptyMissionState({
  onCreateFirstMission,
  onOpenManager,
  firstMissionPending,
}: {
  onCreateFirstMission: () => void;
  onOpenManager: () => void;
  firstMissionPending: boolean;
}) {
  return (
    <section className="mt-8 max-w-[760px] border-t border-foreground/8 pt-8">
      <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[32px]">
        Nothing is in motion yet.
      </p>
      <p className="mt-3 max-w-xl text-[14px] font-medium leading-relaxed text-muted-foreground">
        Start with the Manager. Once there is a real objective worth coordinating, the work will appear here automatically.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ProductButton onClick={onCreateFirstMission} disabled={firstMissionPending}>
          {firstMissionPending ? "Opening Manager" : "Create first mission"}
        </ProductButton>
        <button
          type="button"
          onClick={onOpenManager}
          className="inline-flex min-h-11 items-center rounded-[12px] px-4 text-[13px] font-bold text-foreground transition-colors hover:bg-foreground/[0.045]"
        >
          Talk to Manager
        </button>
      </div>
    </section>
  );
}

function MissionList({
  activeMissions,
  completedMissions,
  onOpen,
}: {
  activeMissions: MissionViewModel[];
  completedMissions: MissionViewModel[];
  onOpen: (mission: MissionViewModel) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const needsYou = activeMissions.filter(missionNeedsUser);
  const inProgress = activeMissions.filter((mission) => !missionNeedsUser(mission));

  return (
    <div data-testid="mobile-mission-switcher" className="mx-auto mt-5 w-full max-w-[940px] pb-12 sm:mt-8">
      {needsYou.length ? (
        <MissionListSection
          title="Needs you"
          description="Work that cannot move forward without you."
          missions={needsYou}
          onOpen={onOpen}
          emphasis
        />
      ) : null}

      {inProgress.length ? (
        <MissionListSection
          title={needsYou.length ? "In progress" : "Current work"}
          description={needsYou.length ? "The Manager or your team is moving these forward." : "Everything currently in motion."}
          missions={inProgress}
          onOpen={onOpen}
        />
      ) : null}

      {completedMissions.length ? (
        <section className="mt-10 border-t border-foreground/8 pt-2">
          <button
            type="button"
            onClick={() => setShowCompleted((value) => !value)}
            className="flex min-h-12 w-full items-center justify-between py-2 text-left"
            aria-expanded={showCompleted}
          >
            <span className="text-[13px] font-bold text-muted-foreground">
              Completed <span className="ml-1 font-semibold text-muted-foreground/65">{completedMissions.length}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", showCompleted && "rotate-180")} />
          </button>
          {showCompleted ? (
            <div className="divide-y divide-foreground/7 border-t border-foreground/7">
              {completedMissions.map((mission) => (
                <MissionRow key={mission.id} mission={mission} onOpen={() => onOpen(mission)} completed />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function MissionListSection({
  title,
  description,
  missions,
  onOpen,
  emphasis = false,
}: {
  title: string;
  description: string;
  missions: MissionViewModel[];
  onOpen: (mission: MissionViewModel) => void;
  emphasis?: boolean;
}) {
  return (
    <section className={cn("mt-8 first:mt-0", emphasis && "rounded-[22px] bg-brand-accent/[0.045] px-3 py-2 sm:px-5 sm:py-3")}>
      <header className="flex items-end justify-between gap-4 px-1 pb-3">
        <div>
          <h2 className={cn("font-display text-[21px] font-semibold tracking-[-0.02em]", emphasis ? "text-foreground" : "text-foreground/92")}>
            {title}
          </h2>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">{description}</p>
        </div>
        <span className="pb-0.5 text-[11px] font-bold text-muted-foreground/60">{missions.length}</span>
      </header>
      <div className="divide-y divide-foreground/8 border-y border-foreground/8">
        {missions.map((mission) => (
          <MissionRow key={mission.id} mission={mission} onOpen={() => onOpen(mission)} attention={emphasis} />
        ))}
      </div>
    </section>
  );
}

function MissionRow({
  mission,
  onOpen,
  attention = false,
  completed = false,
}: {
  mission: MissionViewModel;
  onOpen: () => void;
  attention?: boolean;
  completed?: boolean;
}) {
  const tasks = missionTasks(mission);
  const doneCount = tasks.filter(taskIsDone).length;
  const next = getMissionNextLine(mission, tasks);
  const stage = getCurrentStage(mission, tasks);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid min-h-[88px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-4 text-left sm:min-h-[96px] sm:px-2"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {attention ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand-accent" aria-hidden="true" /> : null}
          <h3 className={cn("truncate font-display text-[17px] font-semibold tracking-[-0.015em] text-foreground sm:text-[18px]", completed && "text-foreground/70")}>
            {mission.title}
          </h3>
        </div>
        <p className={cn("mt-1.5 line-clamp-1 text-[13px] font-medium", attention ? "text-foreground/82" : "text-muted-foreground")}>
          {completed ? "Mission complete" : next}
        </p>
        {!completed ? (
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground/62">
            {stage}{tasks.length ? ` · ${doneCount} of ${tasks.length} done` : ""}
          </p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function MissionRoom({
  mission,
  surface,
  onSurface,
  onBack,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
  onWorkWithManager,
  onOpenMusicSubject,
  onDrawer,
  targetTaskId,
}: {
  mission: MissionViewModel;
  surface: MissionSurface;
  onSurface: (surface: MissionSurface) => void;
  onBack: () => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[], managerOutputId?: string) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  onWorkWithManager?: (taskId: string) => void;
  onOpenMusicSubject?: (subject: { id: string; title: string; type: "music_item" | "music_project" }) => void;
  onDrawer: (drawer: DrawerKind) => void;
  targetTaskId?: string;
}) {
  void onDrawer;
  const tasks = missionTasks(mission);
  const checkpoints = missionCheckpoints(mission);
  const notes = missionNotes(mission);
  const events = missionEvents(mission);
  const openCount = tasks.filter((task) => isOpenArtistTask(task)).length;
  const updateCount = notes.length + events.length;
  const currentStage = getCurrentStage(mission, tasks);

  return (
    <section className="app-workspace app-workspace-reveal mx-auto grid w-full max-w-[1040px] min-w-0 gap-5 overflow-x-clip pb-14 sm:gap-7">
      <header>
        <button
          type="button"
          onClick={onBack}
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] pr-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Missions
        </button>

        <div className="max-w-[820px]">
          <h1 className="break-words font-display text-[30px] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-[42px] lg:text-[50px]">
            {mission.title}
          </h1>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">
            {currentStage}{tasks.length ? ` · ${tasks.filter(taskIsDone).length} of ${tasks.length} done` : ""}
          </p>
        </div>
      </header>

      {mission.subjectType === "music_item" && mission.subjectId && onOpenMusicSubject ? (
        <div className="max-w-[680px]">
          <SongContextAttachment
            title={mission.musicSubject}
            onOpenSong={() => onOpenMusicSubject({ id: mission.subjectId!, title: mission.musicSubject, type: "music_item" })}
          />
        </div>
      ) : null}

      <div data-testid="mobile-mission-tabs" className="flex w-full max-w-[360px] border-b border-foreground/9">
        <SurfaceTab active={surface === "work"} onClick={() => onSurface("work")} label="Work" count={openCount || undefined} />
        <SurfaceTab active={surface === "updates"} onClick={() => onSurface("updates")} label="Updates" count={updateCount || undefined} />
      </div>

      {surface === "work" ? (
        <WorkSurface
          mission={mission}
          checkpoints={checkpoints}
          tasks={tasks}
          targetTaskId={targetTaskId}
          onApproveTask={onApproveTask}
          onCompleteTask={onCompleteTask}
          onUploadTaskDeliverable={onUploadTaskDeliverable}
          onWorkWithManager={onWorkWithManager}
        />
      ) : (
        <UpdatesSurface notes={notes} events={events} />
      )}
    </section>
  );
}

function SurfaceTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative min-h-11 flex-1 px-3 text-[13px] font-bold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {count ? <span className="ml-1.5 text-[10px] font-bold text-muted-foreground/65">{count}</span> : null}
      {active ? <span className="absolute inset-x-3 bottom-[-1px] h-[2px] rounded-full bg-brand-accent" /> : null}
    </button>
  );
}

function WorkSurface({
  mission,
  checkpoints,
  tasks,
  targetTaskId,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
  onWorkWithManager,
}: {
  mission: MissionViewModel;
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
  targetTaskId?: string;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[], managerOutputId?: string) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  onWorkWithManager?: (taskId: string) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(targetTaskId ?? null);
  const [openStageId, setOpenStageId] = useState<string>(() => getInitialCheckpointId(checkpoints, tasks));
  const [optimisticApproved, setOptimisticApproved] = useState<string[]>([]);
  const [optimisticCompleted, setOptimisticCompleted] = useState<string[]>([]);
  const [mutations, setMutations] = useState<Record<string, TaskMutationState>>({});
  const [deliverablesByTask, setDeliverablesByTask] = useState<Record<string, MissionTaskDeliverableViewModel[]>>({});

  useEffect(() => {
    setSelectedTaskId(targetTaskId ?? null);
  }, [targetTaskId]);

  useEffect(() => {
    const next = getInitialCheckpointId(checkpoints, tasks);
    if (!openStageId || !checkpoints.some((checkpoint) => checkpoint.id === openStageId)) setOpenStageId(next);
  }, [checkpoints, tasks, openStageId]);

  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const attentionTask = tasks.find((task) => isOpenArtistTask(task) && !isTaskOptimisticallyDone(task, optimisticCompleted));
  const attentionCheckpoint = attentionTask ? checkpoints.find((checkpoint) => checkpoint.id === attentionTask.checkpointId) : undefined;

  async function approveTask(task: MissionTaskViewModel) {
    setMutations((current) => ({ ...current, [task.id]: { kind: "approve", status: "pending" } }));
    try {
      await onApproveTask(task.id);
      setOptimisticApproved((current) => [...new Set([...current, task.id])]);
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setMutations((current) => ({
        ...current,
        [task.id]: { kind: "approve", status: "error", message: errorMessage(error, "Approval failed. Try again.") },
      }));
    }
  }

  async function completeTask(task: MissionTaskViewModel, intent: CompletionIntent, note: string) {
    setMutations((current) => ({ ...current, [task.id]: { kind: intent === "blocked" ? "block" : "complete", status: "pending" } }));
    const deliverables = resolveTaskDeliverables(task, deliverablesByTask[task.id]);
    try {
      await onCompleteTask(
        task.id,
        intent,
        note.trim(),
        deliverables.map((deliverable) => deliverable.documentId).filter(Boolean) as string[],
        task.managerDraft?.id,
      );
      if (intent === "completed") setOptimisticCompleted((current) => [...new Set([...current, task.id])]);
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setMutations((current) => ({
        ...current,
        [task.id]: {
          kind: intent === "blocked" ? "block" : "complete",
          status: "error",
          message: errorMessage(error, intent === "blocked" ? "Could not report the blocker." : "Could not save this result."),
        },
      }));
    }
  }

  async function uploadDeliverable(task: MissionTaskViewModel, deliverable: MissionTaskDeliverableViewModel, file: File) {
    setMutations((current) => ({ ...current, [task.id]: { kind: "upload", status: "pending" } }));
    const uploading = { ...deliverable, status: "uploading" as const, fileName: file.name };
    setDeliverablesByTask((current) => ({
      ...current,
      [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), uploading),
    }));

    try {
      const uploaded = onUploadTaskDeliverable
        ? await onUploadTaskDeliverable(task.id, { title: deliverable.title, file })
        : {
            ...deliverable,
            status: "uploaded" as const,
            documentId: `local-${task.id}-${Date.now()}`,
            fileName: file.name,
            validationSummary: "Ready for Manager review.",
          };
      setDeliverablesByTask((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), { ...uploaded, id: deliverable.id }),
      }));
      setMutations((current) => omitKey(current, task.id));
    } catch (error) {
      setDeliverablesByTask((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), {
          ...deliverable,
          status: "failed",
          fileName: file.name,
        }),
      }));
      setMutations((current) => ({
        ...current,
        [task.id]: { kind: "upload", status: "error", message: errorMessage(error, "Upload failed. Try again.") },
      }));
    }
  }

  return (
    <div className="grid min-w-0 gap-8">
      <MissionNow
        mission={mission}
        task={attentionTask}
        checkpoint={attentionCheckpoint}
        optimisticApproved={optimisticApproved}
        optimisticCompleted={optimisticCompleted}
        mutations={mutations}
        onOpenTask={(task) => setSelectedTaskId(task.id)}
      />

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Work</p>
            <h2 className="mt-1 font-display text-[23px] font-semibold tracking-[-0.025em] text-foreground">The path from here</h2>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">{tasks.filter(taskIsDone).length}/{tasks.length || 0} done</span>
        </div>

        <div className="border-y border-foreground/9">
          {checkpoints.map((checkpoint) => {
            const stageTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
            const stageDone = stageTasks.filter((task) => isTaskOptimisticallyDone(task, optimisticCompleted)).length;
            const open = openStageId === checkpoint.id;
            const lockedBy = getBlockingDependency(checkpoint, checkpoints);
            const stageComplete = checkpoint.status === "Met" || (stageTasks.length > 0 && stageDone === stageTasks.length);
            const needsAttention = stageTasks.some((task) => isOpenArtistTask(task) && !isTaskOptimisticallyDone(task, optimisticCompleted));

            return (
              <article key={checkpoint.id} className="border-b border-foreground/8 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenStageId((current) => current === checkpoint.id ? "" : checkpoint.id)}
                  className="grid min-h-[72px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3.5 text-left sm:min-h-[78px]"
                  aria-expanded={open}
                >
                  <StageIcon complete={stageComplete} attention={needsAttention || checkpoint.status === "Needs revision"} phase={checkpoint.phase} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold text-foreground">{checkpoint.title}</span>
                    <span className="mt-1 block truncate text-[11px] font-semibold text-muted-foreground">
                      {lockedBy ? `Starts after ${lockedBy.title}` : stageTasks.length ? `${stageDone} of ${stageTasks.length} done` : checkpoint.status === "Watching signal" ? "Manager is watching this" : humanCheckpointStatus(checkpoint.status)}
                    </span>
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground/55 transition-transform", open && "rotate-180")} />
                </button>

                {open ? (
                  <div className="pb-3 pl-10 sm:pl-11">
                    {lockedBy ? (
                      <p className="pb-4 pr-3 text-[12px] font-medium leading-relaxed text-muted-foreground">
                        This stage will open after <span className="font-bold text-foreground">{lockedBy.title}</span>.
                      </p>
                    ) : null}

                    {checkpoint.status === "Needs revision" && checkpoint.blockedReason ? (
                      <div className="mb-3 mr-3 rounded-[14px] bg-[#fff8f3] px-3.5 py-3 text-[12px] font-semibold leading-relaxed text-[#9a3412]">
                        {checkpoint.blockedReason}
                      </div>
                    ) : null}

                    {stageTasks.length ? (
                      <div className="divide-y divide-foreground/7 border-t border-foreground/7">
                        {stageTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            approved={optimisticApproved.includes(task.id) || task.approvalState === "approved"}
                            done={isTaskOptimisticallyDone(task, optimisticCompleted)}
                            mutation={mutations[task.id]}
                            onOpen={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="pb-4 pr-3 text-[12px] font-medium leading-relaxed text-muted-foreground">
                        Nothing is needed from you here. The Manager will surface an action if that changes.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <MissionBrief mission={mission} />

      {selectedTask ? (
        <TaskSheet
          key={selectedTask.id}
          task={selectedTask}
          checkpoint={checkpoints.find((checkpoint) => checkpoint.id === selectedTask.checkpointId)}
          approved={optimisticApproved.includes(selectedTask.id) || selectedTask.approvalState === "approved"}
          done={isTaskOptimisticallyDone(selectedTask, optimisticCompleted)}
          mutation={mutations[selectedTask.id]}
          deliverables={resolveTaskDeliverables(selectedTask, deliverablesByTask[selectedTask.id])}
          onClose={() => setSelectedTaskId(null)}
          onApprove={() => approveTask(selectedTask)}
          onComplete={(intent, note) => completeTask(selectedTask, intent, note)}
          onUpload={(deliverable, file) => uploadDeliverable(selectedTask, deliverable, file)}
          onWorkWithManager={() => onWorkWithManager?.(selectedTask.id)}
        />
      ) : null}
    </div>
  );
}

function MissionNow({
  mission,
  task,
  checkpoint,
  optimisticApproved,
  optimisticCompleted,
  mutations,
  onOpenTask,
}: {
  mission: MissionViewModel;
  task?: MissionTaskViewModel;
  checkpoint?: MissionCheckpointViewModel;
  optimisticApproved: string[];
  optimisticCompleted: string[];
  mutations: Record<string, TaskMutationState>;
  onOpenTask: (task: MissionTaskViewModel) => void;
}) {
  if (!task) {
    return (
      <section className="rounded-[20px] border border-foreground/8 bg-foreground/[0.018] px-4 py-5 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/65">Now</p>
        <h2 className="mt-2 font-display text-[21px] font-semibold tracking-[-0.02em] text-foreground">
          {mission.status === "complete" ? "This mission is complete." : "Nothing needs you right now."}
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-muted-foreground">
          {mission.status === "complete" ? mission.recommendation : `The Manager or your team is moving the next part forward. ${mission.nextTask || mission.summary}`}
        </p>
      </section>
    );
  }

  const approved = optimisticApproved.includes(task.id) || task.approvalState === "approved";
  const done = isTaskOptimisticallyDone(task, optimisticCompleted);
  const mutation = mutations[task.id];

  return (
    <section className="overflow-hidden rounded-[22px] border border-brand-accent/18 bg-brand-accent/[0.045]">
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Needs you</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <h2 className="font-display text-[23px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[27px]">
              {task.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-foreground/70">
              {task.purpose || checkpoint?.dependencyImpact || mission.nextTask}
            </p>
            <p className="mt-3 text-[11px] font-bold text-muted-foreground">
              {checkpoint?.title ? `${checkpoint.title} · ` : ""}{task.deadline}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            disabled={done || mutation?.status === "pending"}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] bg-foreground px-4 text-[12px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-45 sm:w-auto"
          >
            {mutation?.status === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {done ? "Done" : getTaskPrimaryLabel(task, approved)}
          </button>
        </div>
      </div>
    </section>
  );
}

function StageIcon({ complete, attention, phase }: { complete: boolean; attention: boolean; phase: number }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
        complete
          ? "border-brand-accent bg-brand-accent text-white"
          : attention
            ? "border-brand-accent/35 bg-brand-accent/[0.08] text-brand-accent"
            : "border-foreground/10 bg-background text-muted-foreground",
      )}
    >
      {complete ? <Check className="h-3.5 w-3.5" /> : phase}
    </span>
  );
}

function TaskRow({
  task,
  approved,
  done,
  mutation,
  onOpen,
}: {
  task: MissionTaskViewModel;
  approved: boolean;
  done: boolean;
  mutation?: TaskMutationState;
  onOpen: () => void;
}) {
  const workMode = resolveTaskWorkMode(task);
  const blocked = task.result?.status === "blocked" || task.approvalState === "blocked";
  const pending = mutation?.status === "pending";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid min-h-[64px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-2 text-left"
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-brand-accent bg-brand-accent text-white"
            : blocked
              ? "border-[#f97316]/50 bg-[#fff8f3]"
              : "border-foreground/16 bg-background",
        )}
      >
        {done ? <Check className="h-3 w-3" /> : pending ? <Loader2 className="h-3 w-3 animate-spin text-brand-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-[13px] font-bold text-foreground", done && "text-muted-foreground line-through decoration-foreground/25")}>
          {task.title}
        </span>
        <span className="mt-1 block truncate text-[10.5px] font-semibold text-muted-foreground/72">
          {done ? "Done" : pending ? "Saving…" : blocked ? "Blocked" : workMode === "manager_work" ? "Manager working" : task.approvalState === "needs approval" && !approved ? "Needs approval" : task.deadline}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/42 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function TaskSheet({
  task,
  checkpoint,
  approved,
  done,
  mutation,
  deliverables,
  onClose,
  onApprove,
  onComplete,
  onUpload,
  onWorkWithManager,
}: {
  task: MissionTaskViewModel;
  checkpoint?: MissionCheckpointViewModel;
  approved: boolean;
  done: boolean;
  mutation?: TaskMutationState;
  deliverables: MissionTaskDeliverableViewModel[];
  onClose: () => void;
  onApprove: () => void;
  onComplete: (intent: CompletionIntent, note: string) => void;
  onUpload: (deliverable: MissionTaskDeliverableViewModel, file: File) => void;
  onWorkWithManager: () => void;
}) {
  const [intent, setIntent] = useState<CompletionIntent | null>(null);
  const [note, setNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const workMode = resolveTaskWorkMode(task);
  const completionMode = resolveTaskCompletionMode(task);
  const pending = mutation?.status === "pending";
  const blocked = task.result?.status === "blocked" || task.approvalState === "blocked";
  const missingDeliverable = deliverables.find((deliverable) => !["uploaded", "checking", "accepted"].includes(deliverable.status));
  const canComplete = task.approvalState !== "needs approval" || approved;
  const noteRequired = intent === "blocked" || completionMode === "result_note";

  function pickFile(deliverable: MissionTaskDeliverableViewModel) {
    setUploadTargetId(deliverable.id);
    fileInputRef.current?.click();
  }

  function submitCompletion() {
    if (!intent) return;
    if (noteRequired && !note.trim()) return;
    onComplete(intent, note);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/32 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-task-sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] border border-foreground/10 bg-background shadow-2xl sm:max-w-[620px] sm:rounded-[24px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/8 bg-background/96 px-4 py-3 backdrop-blur-xl sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">{checkpoint?.title || "Mission work"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pb-6">
          <div className="flex items-start gap-3">
            <span className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", done ? "border-brand-accent bg-brand-accent text-white" : "border-foreground/15")}>
              {done ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <div className="min-w-0">
              <h2 id="mission-task-sheet-title" className="font-display text-[25px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
                {task.title}
              </h2>
              <p className="mt-2 text-[12px] font-semibold text-muted-foreground">{task.deadline}</p>
            </div>
          </div>

          {task.purpose ? (
            <p className="mt-5 max-w-[540px] text-[14px] font-medium leading-[1.65] text-foreground/80">{task.purpose}</p>
          ) : null}

          {task.steps.length ? (
            <section className="mt-6 border-t border-foreground/8 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">What to do</p>
              <div className="mt-3 grid gap-2.5">
                {task.steps.map((step, index) => (
                  <div key={`${task.id}-step-${index}`} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground/[0.055] text-[9px] font-bold text-muted-foreground">{index + 1}</span>
                    <p className="pt-0.5 text-[12.5px] font-medium leading-relaxed text-foreground/78">{step}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {deliverables.length ? (
            <section className="mt-6 border-t border-foreground/8 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Required file</p>
              <div className="mt-3 grid gap-2">
                {deliverables.map((deliverable) => (
                  <div key={deliverable.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-foreground/8 px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-bold text-foreground">{deliverable.title}</p>
                      <p className="mt-1 truncate text-[10.5px] font-semibold text-muted-foreground">
                        {deliverable.fileName || humanDeliverableStatus(deliverable.status)}
                      </p>
                    </div>
                    {!["uploaded", "checking", "accepted"].includes(deliverable.status) ? (
                      <button
                        type="button"
                        onClick={() => pickFile(deliverable)}
                        disabled={pending}
                        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[10px] border border-foreground/10 px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04] disabled:opacity-45"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-brand-accent">Ready</span>
                    )}
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const target = deliverables.find((deliverable) => deliverable.id === uploadTargetId);
                  if (file && target) onUpload(target, file);
                  event.currentTarget.value = "";
                }}
              />
            </section>
          ) : null}

          {task.managerDraft ? (
            <section className="mt-6 rounded-[16px] bg-foreground/[0.03] px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Manager draft</p>
              <p className="mt-2 text-[13px] font-bold text-foreground">{task.managerDraft.title}</p>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{task.managerDraft.summary}</p>
            </section>
          ) : null}

          {mutation?.status === "error" ? (
            <p role="alert" className="mt-5 rounded-[12px] bg-red-50 px-3.5 py-3 text-[12px] font-semibold text-red-700">
              {mutation.message}
            </p>
          ) : null}

          {done ? (
            <div className="mt-7 flex min-h-12 items-center gap-2 rounded-[14px] bg-brand-accent/[0.07] px-4 text-[13px] font-bold text-brand-accent">
              <Check className="h-4 w-4" />
              Done
            </div>
          ) : workMode === "manager_work" ? (
            <div className="mt-7 rounded-[14px] bg-foreground/[0.035] px-4 py-4">
              <p className="text-[13px] font-bold text-foreground">Manager is handling this.</p>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">
                You do not need to do anything unless the Manager asks for input.
              </p>
            </div>
          ) : intent ? (
            <div className="mt-7 border-t border-foreground/8 pt-5">
              <label htmlFor={`task-note-${task.id}`} className="text-[11px] font-bold text-foreground">
                {intent === "blocked" ? "What is blocking this?" : completionMode === "result_note" ? "What changed?" : "Add a note (optional)"}
              </label>
              <textarea
                id={`task-note-${task.id}`}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={intent === "blocked" ? "Tell the Manager what is preventing progress." : "Add the outcome so the mission stays accurate."}
                className="mt-2 w-full resize-none rounded-[14px] border border-foreground/10 bg-background px-3.5 py-3 text-[13px] font-medium leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-brand-accent/45"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIntent(null); setNote(""); }}
                  disabled={pending}
                  className="min-h-11 rounded-[11px] border border-foreground/10 text-[12px] font-bold text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitCompletion}
                  disabled={pending || (noteRequired && !note.trim())}
                  className="inline-flex min-h-11 items-center justify-center rounded-[11px] bg-foreground px-4 text-[12px] font-bold text-background disabled:opacity-40"
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {intent === "blocked" ? "Report blocker" : completionMode === "manager_draft" ? "Submit for review" : "Mark complete"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-7 grid gap-2 border-t border-foreground/8 pt-5">
              {task.approvalState === "needs approval" && !approved ? (
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={pending}
                  className="inline-flex min-h-12 items-center justify-center rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-45"
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Approve
                </button>
              ) : completionMode === "manager_draft" && (!task.managerDraft || task.result?.status === "revised") ? (
                <button
                  type="button"
                  onClick={onWorkWithManager}
                  disabled={pending}
                  className="min-h-12 rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-45"
                >
                  {task.result?.status === "revised" ? "Continue with Manager" : "Work with Manager"}
                </button>
              ) : completionMode === "evidence" && missingDeliverable ? (
                <button
                  type="button"
                  onClick={() => pickFile(missingDeliverable)}
                  disabled={pending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-45"
                >
                  <Upload className="h-4 w-4" />
                  Upload {missingDeliverable.title}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIntent("completed")}
                  disabled={pending || blocked || !canComplete}
                  className="min-h-12 rounded-[12px] bg-foreground px-4 text-[13px] font-bold text-background disabled:opacity-40"
                >
                  {completionMode === "manager_draft" ? "Submit for review" : completionMode === "result_note" ? "Add result" : "Mark complete"}
                </button>
              )}

              {!blocked ? (
                <button
                  type="button"
                  onClick={() => setIntent("blocked")}
                  disabled={pending}
                  className="min-h-11 rounded-[11px] text-[12px] font-bold text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground disabled:opacity-45"
                >
                  Report a blocker
                </button>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MissionBrief({ mission }: { mission: MissionViewModel }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-foreground/8 pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-[12px] font-bold text-foreground">Mission brief</span>
          <span className="mt-0.5 block text-[10.5px] font-semibold text-muted-foreground">Objective, Manager read and decision context</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="grid gap-5 pb-5 pt-3 sm:grid-cols-2">
          <BriefItem label="Current read" value={mission.review} />
          <BriefItem label="Manager recommendation" value={mission.recommendation} />
          <BriefItem label="Why this mission exists" value={mission.summary} />
          <BriefItem label="Next move" value={mission.nextTask} />
        </div>
      ) : null}
    </section>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">{label}</p>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}

function UpdatesSurface({ notes, events }: { notes: MissionNoteViewModel[]; events: MissionEventViewModel[] }) {
  const items = useMemo(
    () => [
      ...notes.map((note, index) => ({
        id: `note-${note.id}`,
        order: index,
        label: humanUpdateLabel(note.route || "Manager update"),
        message: note.message,
      })),
      ...events.map((event, index) => ({
        id: `event-${event.type}-${index}`,
        order: notes.length + index,
        label: humanUpdateLabel(event.actor || event.type || "Mission update"),
        message: event.summary,
      })),
    ].sort((a, b) => b.order - a.order),
    [notes, events],
  );

  return (
    <section className="max-w-[820px]">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Updates</p>
        <h2 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.025em] text-foreground">What changed</h2>
      </div>
      {items.length ? (
        <div className="border-y border-foreground/9">
          {items.map((item) => (
            <article key={item.id} className="grid gap-1.5 border-b border-foreground/8 py-4 last:border-b-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">{item.label}</p>
              <p className="text-[13px] font-medium leading-relaxed text-foreground/82">{item.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="border-t border-foreground/8 py-8 text-[13px] font-medium text-muted-foreground">No updates yet.</p>
      )}
    </section>
  );
}

function missionTasks(mission: MissionViewModel): MissionTaskViewModel[] {
  if (mission.tasks?.length) return mission.tasks;
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

function missionCheckpoints(mission: MissionViewModel): MissionCheckpointViewModel[] {
  if (mission.checkpoints?.length) return mission.checkpoints;
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

function missionNotes(mission: MissionViewModel): MissionNoteViewModel[] {
  if (mission.notes?.length) return mission.notes;
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

function missionEvents(mission: MissionViewModel): MissionEventViewModel[] {
  return mission.events ?? [];
}

function missionNeedsUser(mission: MissionViewModel) {
  return missionTasks(mission).some(isOpenArtistTask) || mission.status === "blocked";
}

function isOpenArtistTask(task: MissionTaskViewModel) {
  return resolveTaskWorkMode(task) !== "manager_work" && !taskIsDone(task);
}

function taskIsDone(task: MissionTaskViewModel) {
  return task.result?.status === "completed";
}

function isTaskOptimisticallyDone(task: MissionTaskViewModel, optimisticCompleted: string[]) {
  return taskIsDone(task) || optimisticCompleted.includes(task.id);
}

function resolveTaskWorkMode(task: MissionTaskViewModel) {
  if (task.workMode) return task.workMode;
  if (task.completionMode === "manager_draft") return "collaborative" as const;
  return task.owner.trim().toLowerCase() === "manager" ? "manager_work" as const : "artist_action" as const;
}

function resolveTaskCompletionMode(task: MissionTaskViewModel) {
  if (task.completionMode) return task.completionMode;
  return taskNeedsDeliverable(task) ? "evidence" as const : "result_note" as const;
}

function taskNeedsDeliverable(task: MissionTaskViewModel) {
  if (task.completionMode) return task.completionMode === "evidence";
  if (task.deliverables?.length || task.deliverableTitle) return true;
  return /\b(upload|file|document|master|artwork|split sheet|report|epk|press release|brief|memo)\b/i.test(
    [task.title, task.purpose, ...task.steps].join(" "),
  );
}

function resolveTaskDeliverables(task: MissionTaskViewModel, local?: MissionTaskDeliverableViewModel[]) {
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

function replaceDeliverable(list: MissionTaskDeliverableViewModel[], next: MissionTaskDeliverableViewModel) {
  return list.some((item) => item.id === next.id)
    ? list.map((item) => item.id === next.id ? { ...item, ...next } : item)
    : [...list, next];
}

function getBlockingDependency(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  return checkpoint.dependsOnCheckpointIds
    .map((id) => checkpoints.find((candidate) => candidate.id === id))
    .find((candidate) => candidate && candidate.status !== "Met" && candidate.status !== "Ready for AI review");
}

function getInitialCheckpointId(checkpoints: MissionCheckpointViewModel[], tasks: MissionTaskViewModel[]) {
  const attentionTask = tasks.find(isOpenArtistTask);
  if (attentionTask) return attentionTask.checkpointId;
  return checkpoints.find((checkpoint) => checkpoint.status === "Needs revision")?.id
    ?? checkpoints.find((checkpoint) => checkpoint.status !== "Met")?.id
    ?? checkpoints[0]?.id
    ?? "";
}

function getCurrentStage(mission: MissionViewModel, tasks: MissionTaskViewModel[]) {
  const checkpoints = missionCheckpoints(mission);
  const attentionTask = tasks.find(isOpenArtistTask);
  if (attentionTask) return checkpoints.find((checkpoint) => checkpoint.id === attentionTask.checkpointId)?.title || "In progress";
  return checkpoints.find((checkpoint) => checkpoint.status !== "Met")?.title || (mission.status === "complete" ? "Complete" : "In progress");
}

function getMissionNextLine(mission: MissionViewModel, tasks: MissionTaskViewModel[]) {
  const artistTask = tasks.find(isOpenArtistTask);
  if (artistTask) return artistTask.title;
  const managerTask = tasks.find((task) => resolveTaskWorkMode(task) === "manager_work" && !taskIsDone(task));
  if (managerTask) return `Manager is working on ${managerTask.title.toLowerCase()}`;
  return mission.nextTask || mission.recommendation || mission.summary;
}

function getTaskPrimaryLabel(task: MissionTaskViewModel, approved: boolean) {
  if (task.approvalState === "needs approval" && !approved) return "Review & approve";
  if (resolveTaskCompletionMode(task) === "manager_draft" && (!task.managerDraft || task.result?.status === "revised")) return "Work with Manager";
  const deliverables = resolveTaskDeliverables(task);
  if (resolveTaskCompletionMode(task) === "evidence" && deliverables.some((item) => !["uploaded", "checking", "accepted"].includes(item.status))) return "Add required file";
  if (resolveTaskCompletionMode(task) === "result_note") return "Add result";
  return "Open task";
}

function humanCheckpointStatus(status: MissionCheckpointViewModel["status"]) {
  if (status === "Ready for AI review") return "Ready for Manager review";
  if (status === "Waiting on tasks") return "In progress";
  if (status === "Needs revision") return "Needs attention";
  if (status === "Watching signal") return "Manager watching";
  return "Complete";
}

function humanDeliverableStatus(status: MissionTaskDeliverableViewModel["status"]) {
  if (status === "uploading") return "Uploading…";
  if (status === "uploaded") return "Uploaded";
  if (status === "checking") return "Manager checking";
  if (status === "accepted") return "Accepted";
  if (status === "needs_revision") return "Needs revision";
  if (status === "failed") return "Upload failed";
  return "File required";
}

function humanUpdateLabel(value: string) {
  return value
    .replace(/manager\s*->\s*mission record/i, "Manager")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function omitKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
