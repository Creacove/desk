import { ArrowLeft, Check, ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type {
  DrawerKind,
  MissionCheckpointViewModel,
  MissionTaskDeliverableViewModel,
  MissionEventViewModel,
  MissionNoteViewModel,
  MissionRecapViewModel,
  MissionTaskResultViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";

type MissionRoomTab = "pulse" | "tasks" | "checkpoints" | "activity";

export function MissionsWorkspace({
  missions,
  selectedMissionId,
  onSelectMission,
  onCreateFirstMission,
  onOpenManager,
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
  firstMissionPending: boolean;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[]) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  onDrawer: (drawer: DrawerKind) => void;
  openRoomRequestKey?: number;
  openRoomTab?: MissionRoomTab;
  openTaskId?: string | null;
  listRequestKey?: number;
  onRoomModeChange?: (roomOpen: boolean) => void;
}) {
  const [localMissions, setLocalMissions] = useState<MissionViewModel[]>(missions);
  const [roomMode, setRoomMode] = useState<"list" | "room">("list");
  const [tab, setTab] = useState<MissionRoomTab>("pulse");

  useEffect(() => {
    setLocalMissions(missions);
  }, [missions]);

  const activeMissions = localMissions.filter((mission) => mission.status !== "complete");
  const completedMissions = localMissions.filter((mission) => mission.status === "complete");
  const selected = localMissions.find((mission) => mission.id === selectedMissionId) ?? activeMissions[0] ?? localMissions[0] ?? null;

  useEffect(() => {
    if (openRoomRequestKey > 0) {
      setRoomMode("room");
      setTab(openRoomTab ?? "pulse");
    }
  }, [openRoomRequestKey, openRoomTab]);

  useEffect(() => {
    if (listRequestKey > 0) {
      setRoomMode("list");
      setTab("pulse");
    }
  }, [listRequestKey]);

  useEffect(() => {
    onRoomModeChange?.(roomMode === "room");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [roomMode, onRoomModeChange]);

  function openMission(mission: MissionViewModel, nextTab: MissionRoomTab = "pulse") {
    onSelectMission(mission.id);
    setRoomMode("room");
    setTab(nextTab);
  }

  if (!localMissions.length) {
    return (
      <section>
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <EmptyMissionState
          onCreateFirstMission={onCreateFirstMission}
          firstMissionPending={firstMissionPending}
        />
      </section>
    );
  }

  if (!selected || roomMode === "list") {
    return (
      <section>
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <div className="mb-5 flex justify-end">
          <ProductButton onClick={onOpenManager}>
            Talk to Manager
          </ProductButton>
        </div>
        <div data-testid="missions-mobile-picker" className="space-y-8 lg:hidden">
          <MissionShortcutTabs mission={activeMissions[0] ?? localMissions[0]} onOpen={openMission} />
          <MissionList activeMissions={activeMissions} completedMissions={completedMissions} onOpen={openMission} />
        </div>
        <div data-testid="missions-desktop-list" className="hidden lg:block">
          <MissionList activeMissions={activeMissions} completedMissions={completedMissions} onOpen={openMission} />
        </div>
      </section>
    );
  }

  return (
    <MissionRoom
      mission={selected}
      tab={tab}
      onTab={setTab}
      onBack={() => setRoomMode("list")}
      onDrawer={onDrawer}
      onApproveTask={onApproveTask}
      onCompleteTask={onCompleteTask}
      onUploadTaskDeliverable={onUploadTaskDeliverable}
      targetTaskId={openTaskId ?? undefined}
    />
  );
}

function EmptyMissionState({
  onCreateFirstMission,
  firstMissionPending,
}: {
  onCreateFirstMission: () => void;
  firstMissionPending: boolean;
}) {
  return (
    <section className="surface-elevated rounded-[24px] p-6 shadow-sm">
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Active Missions (0)</p>
        <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-foreground">No active missions yet</h2>
        <p className="text-[14px] font-semibold leading-relaxed text-muted-foreground/86">
          The Manager has not activated mission work for this artist yet. Missions appear here after there is a durable objective, source context, checkpoints, and tasks worth coordinating.
        </p>
        <div className="mt-4">
          <ProductButton onClick={onCreateFirstMission} disabled={firstMissionPending}>
            {firstMissionPending ? "Opening Manager" : "Create first mission"}
          </ProductButton>
        </div>
      </div>
    </section>
  );
}

function MissionShortcutTabs({ mission, onOpen }: { mission?: MissionViewModel; onOpen: (mission: MissionViewModel, tab: MissionRoomTab) => void }) {
  if (!mission) return null;

  return (
    <div data-testid="mobile-mission-tabs" className="sr-only">
      <button type="button" onClick={() => onOpen(mission, "tasks")}>tasks</button>
      <button type="button" onClick={() => onOpen(mission, "checkpoints")}>checkpoints</button>
      <button type="button" onClick={() => onOpen(mission, "activity")}>activity</button>
    </div>
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
  return (
    <div data-testid="mobile-mission-switcher" className="space-y-8">
      <div>
        <div className="flex items-center justify-between border-b border-foreground/5 pb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-brand-accent">Active Missions ({activeMissions.length})</h3>
        </div>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {activeMissions.map((mission) => (
            <MissionListCard key={mission.id} mission={mission} onOpen={() => onOpen(mission)} />
          ))}
        </div>
      </div>

      {completedMissions.length ? (
        <div>
          <div className="flex items-center justify-between border-b border-foreground/5 pb-3">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">Completed ({completedMissions.length})</h3>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {completedMissions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                onClick={() => onOpen(mission)}
                className="group rounded-2xl border border-foreground/5 bg-background/50 p-5 text-left transition-all hover:bg-foreground/[0.02]"
              >
                <h4 className="truncate font-display text-[15px] font-bold text-foreground group-hover:text-brand-accent">{mission.title}</h4>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/40">Archived</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MissionListCard({ mission, onOpen }: { mission: MissionViewModel; onOpen: () => void }) {
  const openTaskCount = getOpenTaskCount(mission);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid min-w-0 gap-3 rounded-[14px] border border-foreground/8 bg-background/86 p-4 text-left shadow-sm transition-colors hover:border-foreground/16 hover:bg-foreground/[0.025] sm:grid-cols-[minmax(0,1fr)_132px] sm:items-center sm:p-4"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", getMissionProgressClass(mission.status))} aria-hidden="true" />
          <StatusBadge status={mission.status} />
          <span className="text-[11px] font-semibold text-muted-foreground/82">{formatOpenTaskCount(openTaskCount)}</span>
        </div>
        <h4 className="mt-2 line-clamp-2 font-display text-[16px] font-semibold leading-tight text-foreground transition-colors group-hover:text-foreground">{mission.title}</h4>
        <p className="mt-1 hidden truncate text-[12px] leading-relaxed text-muted-foreground/82 sm:block">{mission.summary}</p>
      </div>

      <div className="grid min-w-0 gap-2 sm:justify-items-end">
        <span className="text-[12px] font-semibold text-foreground">{mission.progress}%</span>
        <MissionProgressMeter status={mission.status} progress={mission.progress} className="w-full sm:w-[112px]" />
      </div>
    </button>
  );
}

function MissionRoom({
  mission,
  tab,
  onTab,
  onBack,
  onDrawer,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
  targetTaskId,
}: {
  mission: MissionViewModel;
  tab: MissionRoomTab;
  onTab: (tab: MissionRoomTab) => void;
  onBack: () => void;
  onDrawer: (drawer: DrawerKind) => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[]) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  targetTaskId?: string;
}) {
  const checkpoints = missionCheckpoints(mission);
  const tasks = missionTasks(mission);
  const notes = missionNotes(mission);
  const events = missionEvents(mission);
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const openTaskCount = tasks.filter((task) => task.result?.status !== "completed").length;

  return (
    <section className="grid min-w-0 max-w-full gap-4 overflow-x-clip lg:gap-6">
      <h3 className="sr-only">Missions</h3>
      <div data-testid="mobile-mission-switcher" className="sr-only" />
      <header data-testid="mission-command-bar" className="pb-1 pt-1">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Missions
        </button>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
          <h2 className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] font-display text-[26px] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[36px] lg:max-w-4xl lg:text-[44px]">{mission.title}</h2>
          <div className="min-w-0 pb-1">
            <p className="mb-2 text-[11px] font-bold text-muted-foreground">{mission.progress}%</p>
            <MissionProgressMeter status={mission.status} progress={mission.progress} />
          </div>
        </div>
      </header>

      <div data-testid="mission-surface-rail" className="min-w-0 max-w-full">
        <MissionTabRail tab={tab} onTab={onTab} openTaskCount={openTaskCount} noteCount={notes.length} blockedCheckpointCount={activeBlocker ? 1 : 0} missionBlocked={mission.status === "blocked"} />
      </div>

      <div className="min-h-[400px] min-w-0 max-w-full">
        {tab === "pulse" ? <MissionPulse mission={mission} checkpoints={checkpoints} onTab={onTab} /> : null}
        {tab === "tasks" ? <TasksPanel checkpoints={checkpoints} tasks={tasks} targetTaskId={targetTaskId} onApproveTask={onApproveTask} onCompleteTask={onCompleteTask} onUploadTaskDeliverable={onUploadTaskDeliverable} /> : null}
        {tab === "checkpoints" ? <SimplifiedCheckpointsPanel checkpoints={checkpoints} tasks={tasks} /> : null}
        {tab === "activity" ? <ActivityPanel notes={notes} events={events} /> : null}
      </div>
    </section>
  );
}

function MissionPulse({
  mission,
  checkpoints,
  onTab,
}: {
  mission: MissionViewModel;
  checkpoints: MissionCheckpointViewModel[];
  onTab: (tab: MissionRoomTab) => void;
}) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const requiredActionTitle = activeBlocker?.nextAction || mission.nextTask;
  const requiredActionReason = activeBlocker?.blockedReason || activeBlocker?.dependencyImpact;

  return (
    <section data-testid="mission-pulse" className="surface-elevated min-w-0 max-w-full overflow-hidden rounded-[22px] shadow-sm">
      <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Executive summary</span>
            <span className="rounded-full border border-brand-accent/15 bg-brand-accent/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-accent">{mission.status}</span>
          </div>
          <h4 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-tight text-foreground">{mission.review}</h4>
          <div className="mt-5 min-w-0 rounded-[18px] border border-foreground/8 bg-foreground/[0.025] p-5">
            <p className="text-[16px] font-semibold leading-relaxed text-foreground">{mission.recommendation}</p>
            <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">{mission.summary}</p>
          </div>
        </div>

        <div className="min-w-0 border-t border-foreground/8 bg-background/62 p-5 lg:border-l lg:border-t-0">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Next required action</p>
          {requiredActionTitle ? (
            <div className="mt-4 rounded-[18px] border border-foreground/8 bg-background p-4 shadow-sm">
              <p className="text-[15px] font-bold leading-snug text-foreground">{requiredActionTitle}</p>
              {requiredActionReason ? (
                <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-muted-foreground/84">{requiredActionReason}</p>
              ) : (
                <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-muted-foreground/84">This is the next task that keeps the recommendation moving.</p>
              )}
              <button
                type="button"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-[10px] bg-foreground px-3.5 text-[12px] font-bold text-background transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                onClick={() => onTab("tasks")}
              >
                Open work queue
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-foreground/8 bg-background p-4 shadow-sm">
              <p className="text-[15px] font-bold leading-snug text-foreground">No action required</p>
              <p className="mt-3 text-[12.5px] font-semibold leading-relaxed text-muted-foreground/84">Next review: {mission.review}.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TasksPanel({
  checkpoints,
  tasks,
  targetTaskId,
  onApproveTask,
  onCompleteTask,
  onUploadTaskDeliverable,
}: {
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
  targetTaskId?: string;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[]) => Promise<void>;
  onUploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
}) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const targetTask = targetTaskId ? tasks.find((task) => task.id === targetTaskId) : undefined;
  const [activeCheckpointId, setActiveCheckpointId] = useState(targetTask?.checkpointId ?? activeBlocker?.id ?? checkpoints[0]?.id ?? "");
  const [expandedTaskId, setExpandedTaskId] = useState<string>(targetTask?.id ?? tasks[0]?.id ?? "");
  const [approvedTaskIds, setApprovedTaskIds] = useState<string[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [completionNote, setCompletionNote] = useState<{ taskId: string; status: "completed" | "blocked"; note: string } | null>(null);
  const [taskDeliverables, setTaskDeliverables] = useState<Record<string, MissionTaskDeliverableViewModel[]>>({});
  const [deliverableErrors, setDeliverableErrors] = useState<Record<string, string>>({});
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    if (targetTask?.checkpointId) {
      setActiveCheckpointId(targetTask.checkpointId);
    }
  }, [targetTask?.checkpointId]);

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    document.getElementById(`task-group-${activeCheckpointId}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [activeCheckpointId]);

  const toggleTaskDetails = (taskId: string) => {
    setExpandedTaskId((current) => current === taskId ? "" : taskId);
  };

  function startCompletion(taskId: string, status: "completed" | "blocked") {
    setCompletionNote({ taskId, status, note: "" });
    setCompletionError(null);
  }

  async function confirmCompletion() {
    if (!completionNote) return;
    const note = completionNote.note.trim();
    if (!note) {
      setCompletionError("Please describe what you did or what happened before marking this task done.");
      return;
    }
    const task = tasks.find((item) => item.id === completionNote.taskId);
    const deliverables = task ? resolveTaskDeliverables(task, taskDeliverables[task.id]) : [];
    const missingDeliverable = completionNote.status === "completed" && deliverables.some((deliverable) => !isDeliverableSubmittable(deliverable));
    if (missingDeliverable) {
      setCompletionError("Add the required deliverable before submitting this task as done.");
      return;
    }
    const documentIds = deliverables.map((deliverable) => deliverable.documentId).filter(Boolean) as string[];
    setCompletionPending(true);
    setCompletionError(null);
    try {
      await onCompleteTask(completionNote.taskId, completionNote.status, note, documentIds);
      setCompletedTaskIds((current) => [...new Set([...current, completionNote.taskId])]);
      setCompletionNote(null);
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Task completion failed. Please try again.");
    } finally {
      setCompletionPending(false);
    }
  }

  async function uploadDeliverable(task: MissionTaskViewModel, deliverable: MissionTaskDeliverableViewModel, file: File) {
    setDeliverableErrors((current) => ({ ...current, [task.id]: "" }));
    setTaskDeliverables((current) => ({
      ...current,
      [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), {
        ...deliverable,
        status: "uploading",
        fileName: file.name,
      }),
    }));

    try {
      const uploaded = onUploadTaskDeliverable
        ? await onUploadTaskDeliverable(task.id, { title: deliverable.title, file })
        : {
            ...deliverable,
            id: deliverable.id,
            status: "uploaded" as const,
            documentId: `local-${task.id}-${Date.now()}`,
            fileName: file.name,
            validationSummary: "Ready for Manager review.",
          };
      setTaskDeliverables((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), { ...uploaded, id: deliverable.id }),
      }));
    } catch (error) {
      setTaskDeliverables((current) => ({
        ...current,
        [task.id]: replaceDeliverable(resolveTaskDeliverables(task, current[task.id]), {
          ...deliverable,
          status: "failed",
          fileName: file.name,
        }),
      }));
      setDeliverableErrors((current) => ({
        ...current,
        [task.id]: error instanceof Error ? error.message : "Deliverable upload failed.",
      }));
    }
  }

  return (
    <section className="surface-elevated rounded-[22px] p-4 shadow-sm sm:p-5">
      <h3 className="sr-only">Mission tasks</h3>
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <aside className="surface-elevated min-w-0 overflow-hidden rounded-[22px] p-4 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:self-start lg:overflow-y-auto">
          <div className="border-b border-foreground/8 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission checkpoints</p>
          </div>
          <div data-testid="mobile-task-stepper" className="mt-4 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:mt-5 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {checkpoints.map((checkpoint) => {
              const phaseTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
              const doneCount = phaseTasks.filter((task) => task.result?.status === "completed" || completedTaskIds.includes(task.id)).length;
              const inView = activeCheckpointId === checkpoint.id;
              return (
                <button
                  key={checkpoint.id}
                  type="button"
                  data-testid={`task-group-tab-${checkpoint.id}`}
                  aria-current={inView ? "true" : undefined}
                  onClick={() => setActiveCheckpointId(checkpoint.id)}
                  className={cn("relative flex min-w-[170px] gap-3 rounded-[12px] border px-2 py-2 text-left transition-all lg:w-full lg:min-w-0", inView ? "border-foreground bg-foreground text-background" : "border-foreground/8 bg-background text-foreground hover:bg-foreground/[0.04]")}
                >
                  <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold", inView ? "border-brand-accent bg-brand-accent text-foreground" : "border-foreground/10 bg-background text-muted-foreground")}>
                    {checkpoint.status === "Met" ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : checkpoint.phase}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate text-[12px] font-bold", inView ? "text-background" : "text-foreground")}>{checkpoint.title}</span>
                    <span className={cn("mt-0.5 block text-[10px] font-bold uppercase tracking-[0.08em]", inView ? "text-background/65" : "text-muted-foreground/80")}>{doneCount}/{phaseTasks.length} tasks</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          {checkpoints.map((checkpoint) => {
            const sectionActive = activeCheckpointId === checkpoint.id;
            const phaseTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
            const blockedBy = getBlockingDependency(checkpoint, checkpoints);
            const isLocked = Boolean(blockedBy);

            return (
              <section
                key={checkpoint.id}
                id={`task-group-${checkpoint.id}`}
                data-testid={`task-group-${checkpoint.id}`}
                data-active={sectionActive ? "true" : "false"}
                className={cn("scroll-mt-24 overflow-hidden rounded-[20px] border bg-background/85 shadow-sm transition-all lg:scroll-mt-6", sectionActive ? "border-brand-accent/35 shadow-lg shadow-brand-accent/5" : "border-foreground/8 max-lg:hidden", isLocked && !sectionActive && "opacity-70")}
              >
                <div className="border-b border-foreground/8 bg-foreground/[0.025] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Checkpoint {checkpoint.phase}</p>
                    <CheckpointStatusBadge status={checkpoint.status} />
                  </div>
                  <h3 className="mt-2 text-[18px] font-bold text-foreground">{checkpoint.title}</h3>
                  <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted-foreground/80">{checkpoint.question}</p>
                  {blockedBy ? (
                    <div className="mt-3 grid gap-2 rounded-[14px] border border-[#f59e0b]/20 bg-[#fffbeb] p-3 text-[12px] font-semibold leading-relaxed text-[#92400e]">
                      <p className="font-bold">Waiting on: {blockedBy.title}</p>
                      <p>{checkpoint.dependencyImpact}</p>
                    </div>
                  ) : null}
                </div>

                <div className="px-4 py-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/78">Tasks under this checkpoint</p>
                    <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">{phaseTasks.length} tasks</span>
                  </div>
                  <div className="grid gap-3">
                    {phaseTasks.map((task, taskIndex) => {
                      const approved = approvedTaskIds.includes(task.id) || task.approvalState === "approved";
                      const done = completedTaskIds.includes(task.id) || task.result?.status === "completed";
                      const blocked = task.approvalState === "blocked" || task.result?.status === "blocked";
                      const detailsOpen = expandedTaskId === task.id;
                      const deliverables = resolveTaskDeliverables(task, taskDeliverables[task.id]);
                      const hasBlockingDeliverable = deliverables.some((deliverable) => !isDeliverableSubmittable(deliverable));
                      const completionBlocked = task.approvalState === "needs approval" && !approved;
                      const isConfirmingCompletion = completionNote?.taskId === task.id;

                      return (
                        <div
                          key={task.id}
                          data-highlighted={targetTaskId === task.id ? "true" : undefined}
                          className={cn(
                            "grid min-w-0 gap-4 rounded-[16px] border bg-background/78 p-3.5 lg:grid-cols-[minmax(0,1fr)_180px]",
                            targetTaskId === task.id ? "border-brand-accent/50 shadow-lg shadow-brand-accent/10" : "border-foreground/8",
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold", blocked ? "bg-[#f97316] text-white" : done ? "bg-brand-accent text-background" : "bg-foreground/[0.07] text-foreground")}>{taskIndex + 1}</span>
                              <span className="rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">Task {taskIndex + 1}</span>
                              <p className="text-[15px] font-bold leading-snug text-foreground">{task.title}</p>
                              <span className="rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">{getTaskStatusLabel(task, approved, done)}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted-foreground/90">{task.owner} / {task.deadline}</p>
                            {detailsOpen ? <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-foreground/89"><span className="font-bold text-foreground">Why it matters:</span> {task.purpose}</p> : null}
                            {detailsOpen && deliverables.length ? (
                              <TaskDeliverables
                                task={task}
                                deliverables={deliverables}
                                error={deliverableErrors[task.id]}
                                onUpload={uploadDeliverable}
                              />
                            ) : null}
                            <button type="button" aria-label={`${detailsOpen ? "Collapse" : "Expand"} ${task.title}`} onClick={() => toggleTaskDetails(task.id)} className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-accent hover:underline">
                              {detailsOpen ? "Collapse" : "Expand"}
                            </button>
                            {detailsOpen ? <TaskDetails task={task} /> : null}
                            {completionBlocked ? (
            <p className="mt-3 rounded-[12px] border border-[#f97316]/20 bg-[#f97316]/10 p-3 text-[12px] font-semibold leading-snug text-[#c2410c]">
                                Approval is required before this task can be marked done.
                              </p>
                            ) : null}
                            {isConfirmingCompletion ? (
                              completionPending ? (
                                <div className="mt-4 rounded-[14px] border border-brand-accent/20 bg-brand-accent/[0.04] p-5 flex flex-col items-center justify-center text-center gap-3">
                                  <div className="flex gap-1.5" aria-hidden="true">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-accent" style={{ animationDelay: "0ms" }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-accent" style={{ animationDelay: "150ms" }} />
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-accent" style={{ animationDelay: "300ms" }} />
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-bold text-foreground">Manager is reviewing task results</p>
                                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                                      Analyzing outcome notes, updating checkpoint states, and re-routing active directives.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div data-testid={`task-completion-panel-${task.id}`} className="mt-4 grid gap-3 rounded-[14px] border border-brand-accent/20 bg-brand-accent/[0.04] p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">
                                    {completionNote.status === "blocked" ? "Why is this task blocked?" : "What did you do? What was the result?"}
                                  </p>
                                  <p className="text-[12px] font-semibold leading-relaxed text-foreground/80">
                                    Record a specific outcome note. The Manager uses this to update checkpoints and shape the next recommendation.
                                  </p>
                                  <textarea
                                    id={`task-note-${task.id}`}
                                    aria-label="Task result note"
                                    rows={3}
                                    value={completionNote.note}
                                    onChange={(e) => setCompletionNote((current) => current ? { ...current, note: e.target.value } : null)}
                                    placeholder={completionNote.status === "blocked" ? "e.g. The distributor rejected the submission — missing ISRC codes. Waiting on the label admin team." : "e.g. Submitted the Spotify editorial pitch for 'Night Drive' with genre context, release story, and target playlist. Confirmation received."}
                                    className="w-full resize-none rounded-[10px] border border-foreground/12 bg-background px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-brand-accent/40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                                  />
                                  {completionError ? (
                                    <p role="alert" className="text-[12px] font-semibold text-red-600">{completionError}</p>
                                  ) : null}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={confirmCompletion}
                                      className="rounded-[10px] bg-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-background transition-all hover:opacity-90"
                                    >
                                      {completionNote.status === "blocked" ? "Mark blocked" : "Confirm done"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setCompletionNote(null); setCompletionError(null); }}
                                      className="rounded-[10px] border border-foreground/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80 transition-colors hover:bg-foreground/5"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )
                            ) : null}
                          </div>
                          <div className="flex min-w-0 flex-col items-start justify-start gap-2 lg:items-end">
                            {task.approvalState === "needs approval" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setApprovedTaskIds((current) => [...new Set([...current, task.id])]);
                                  onApproveTask(task.id).catch(() => {
                                    setApprovedTaskIds((current) => current.filter((id) => id !== task.id));
                                  });
                                }}
                                disabled={approved || done}
                                className="w-full rounded-[10px] border border-foreground/10 px-3 py-2 text-[11px] font-bold text-muted-foreground/80 transition-colors hover:bg-foreground/5 hover:text-black disabled:opacity-40"
                              >
                                Approve
                              </button>
                            ) : null}
                            <button
                              type="button"
                              disabled={done || completionBlocked || blocked || isConfirmingCompletion || hasBlockingDeliverable}
                              onClick={() => startCompletion(task.id, "completed")}
                              className="w-full rounded-[10px] bg-foreground px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-background transition-all hover:opacity-90 disabled:opacity-35"
                            >
                              Mark done
                            </button>
                            {hasBlockingDeliverable ? (
                              <p className="text-right text-[11px] font-semibold leading-snug text-muted-foreground/78 lg:max-w-[180px]">
                                Add deliverable to submit.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TaskDeliverables({
  task,
  deliverables,
  error,
  onUpload,
}: {
  task: MissionTaskViewModel;
  deliverables: MissionTaskDeliverableViewModel[];
  error?: string;
  onUpload: (task: MissionTaskViewModel, deliverable: MissionTaskDeliverableViewModel, file: File) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 rounded-[12px] border border-foreground/8 bg-foreground/[0.022] p-3">
      {deliverables.map((deliverable) => {
        const inputId = `task-deliverable-${task.id}-${deliverable.id}`;
        return (
          <div key={deliverable.id} className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/78">Deliverable</span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{deliverable.fileName ?? deliverable.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", deliverableStatusClass(deliverable.status))}>
              {deliverableStatusLabel(deliverable.status)}
            </span>
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded-[8px] border border-foreground/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground"
            >
              {deliverable.status === "missing" || deliverable.status === "failed" ? "Upload" : "Replace"}
            </label>
            <input
              id={inputId}
              type="file"
              className="sr-only"
              aria-label={`Upload deliverable for ${task.title}`}
              accept=".pdf,.doc,.docx,.txt,.md,.csv,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onUpload(task, deliverable, file);
                event.currentTarget.value = "";
              }}
            />
            {deliverable.validationSummary ? (
              <span className="basis-full text-[11px] font-semibold leading-relaxed text-muted-foreground/80">{deliverable.validationSummary}</span>
            ) : null}
          </div>
        );
      })}
      {error ? <p role="alert" className="text-[11px] font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

function TaskDetails({ task }: { task: MissionTaskViewModel }) {
  return (
    <div className="mt-3 grid gap-3 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-3">
      <div className="grid gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Steps</p>
        {task.steps.map((step, index) => (
          <p key={step} className="text-[12px] leading-relaxed text-foreground/89">{index + 1}. {step}</p>
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground/90"><span className="font-bold text-foreground">Risk if late:</span> {task.riskIfLate}</p>
      {task.result ? <TaskResult result={task.result} /> : null}
    </div>
  );
}

function TaskResult({ result }: { result: MissionTaskResultViewModel }) {
  return (
    <div className="border-l-2 border-brand-accent/50 pl-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager note</p>
      <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground">{result.summary}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/90"><span className="font-bold text-foreground">Task result:</span> {result.userNote}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-foreground/88">{result.interpretation}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/90"><span className="font-bold text-foreground">Effect on mission:</span> {result.missionEffect}</p>
      <p className="mt-2 text-[12px] font-bold leading-relaxed text-brand-accent">{result.followUp}</p>
    </div>
  );
}

function SimplifiedCheckpointsPanel({ checkpoints, tasks }: { checkpoints: MissionCheckpointViewModel[]; tasks: MissionTaskViewModel[] }) {
  const initial = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision" || checkpoint.status === "Watching signal") ?? checkpoints[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const selected = checkpoints.find((checkpoint) => checkpoint.id === selectedId) ?? initial;

  if (!selected) return null;

  const auditedTasks = selected.requiredTaskIds
    .map((taskId) => tasks.find((task) => task.id === taskId))
    .filter(Boolean) as MissionTaskViewModel[];

  return (
    <section className="grid min-w-0 gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-6">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Mission checkpoints</p>
        <div className="relative grid gap-0 before:absolute before:bottom-4 before:left-[11px] before:top-4 before:w-px before:bg-foreground/12">
          {checkpoints.map((checkpoint) => {
            const selectedCheckpoint = checkpoint.id === selected.id;
            const complete = checkpoint.status === "Met" || checkpoint.status === "Ready for AI review";
            return (
              <button
                key={checkpoint.id}
                type="button"
                aria-current={selectedCheckpoint ? "true" : undefined}
                onClick={() => setSelectedId(checkpoint.id)}
                className={cn("relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 rounded-[12px] px-0 py-3 text-left transition-colors", selectedCheckpoint && "bg-brand-accent/[0.08] pr-3")}
              >
                <span className={cn("relative z-10 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold", selectedCheckpoint ? "border-brand-accent bg-brand-accent text-foreground ring-4 ring-brand-accent/15" : complete ? "border-foreground bg-foreground text-background" : "border-foreground/20 bg-background text-muted-foreground")}>
                  {complete ? <Check className="h-3 w-3" aria-hidden="true" /> : checkpoint.phase}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug text-foreground">{checkpoint.title}</span>
                  <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">{checkpoint.status}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div data-testid="checkpoint-inspector" className="min-w-0 border-t border-foreground/8 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Review &amp; analysis</p>
            <h3 className="mt-2 font-display text-[24px] font-semibold leading-tight text-foreground">{selected.title}</h3>
          </div>
          <CheckpointStatusBadge status={selected.status} />
        </div>

        <div className="mt-5 border-y border-foreground/8 py-5">
          <p className="text-[15px] font-semibold leading-relaxed text-foreground">{selected.recommendation || getCheckpointReviewCopy(selected, checkpoints)}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{selected.resultSummary || "The Manager is waiting for enough task evidence to complete this review."}</p>
          {selected.decisionRule ? <p className="mt-3 text-[12px] font-medium leading-relaxed text-muted-foreground">{selected.decisionRule}</p> : null}
        </div>

        <div className="mt-7">
          <h4 className="text-[12px] font-bold uppercase tracking-[0.12em] text-foreground">Task audits</h4>
          <div className="mt-3 divide-y divide-foreground/8 border-y border-foreground/8">
            {auditedTasks.length ? auditedTasks.map((task) => (
              <article key={task.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] sm:gap-6">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{task.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{task.result?.userNote || "No submission yet."}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Manager response</p>
                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-foreground/86">{task.result?.interpretation || "Waiting for task evidence."}</p>
                </div>
              </article>
            )) : <p className="py-5 text-[13px] text-muted-foreground">No task audits for this checkpoint.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckpointsPanel({ checkpoints, tasks }: { checkpoints: MissionCheckpointViewModel[]; tasks: MissionTaskViewModel[] }) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision") ?? checkpoints[0];
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(activeBlocker?.id ?? checkpoints[0]?.id ?? "");
  const selectedCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? activeBlocker;
  const clearedCount = checkpoints.filter((checkpoint) => checkpoint.status === "Met" || checkpoint.status === "Ready for AI review").length;

  // Mobile/tablet uses an in-place accordion: tapping a checkpoint expands its
  // manager review inline instead of dumping every review at the bottom of the list.
  const firstUnlockedId = checkpoints.find((checkpoint) => !getBlockingDependency(checkpoint, checkpoints))?.id;
  const [expandedCheckpointId, setExpandedCheckpointId] = useState(
    (activeBlocker && !getBlockingDependency(activeBlocker, checkpoints) ? activeBlocker.id : firstUnlockedId) ?? "",
  );

  useEffect(() => {
    document.querySelector('[data-testid="checkpoint-inspector"]')?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selectedCheckpointId]);

  if (!selectedCheckpoint) return null;

  return (
    <section className="surface-elevated min-w-0 max-w-full overflow-x-clip rounded-[22px] p-4 shadow-sm sm:p-5">
      <div className="min-w-0 space-y-5">
        <span className="sr-only">mission checkpoints</span>

        {/* MOBILE + TABLET: progressive-disclosure accordion */}
        <div data-testid="checkpoint-accordion" className="xl:hidden">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Mission checkpoints</p>
              <p className="mt-1 text-[13px] font-semibold text-foreground/88">Tap a checkpoint to see the manager&apos;s read.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-full bg-foreground/[0.045] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">Cleared {clearedCount}/{checkpoints.length}</span>
            </div>
          </div>
          <div data-testid="mobile-checkpoint-list" className="sr-only">Mobile checkpoint list</div>
          <div className="space-y-3">
            {checkpoints.map((checkpoint) => {
              const locked = Boolean(getBlockingDependency(checkpoint, checkpoints));
              const isOpen = expandedCheckpointId === checkpoint.id && !locked;
              const phaseTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
              return (
                <div
                  key={checkpoint.id}
                  data-testid={`checkpoint-accordion-item-${checkpoint.id}`}
                  className={cn(
                    "overflow-hidden rounded-[20px] border transition-all",
                    isOpen ? "border-brand-accent/40 bg-brand-accent/[0.02] shadow-lg shadow-brand-accent/5" : "border-foreground/8 bg-background/82",
                    locked ? "opacity-70" : "",
                  )}
                >
                  <button
                    type="button"
                    disabled={locked}
                    aria-expanded={isOpen}
                    data-testid={`checkpoint-accordion-toggle-${checkpoint.id}`}
                    onClick={() => setExpandedCheckpointId((current) => (current === checkpoint.id ? "" : checkpoint.id))}
                    className="w-full p-4 text-left disabled:cursor-not-allowed"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", checkpoint.status === "Needs revision" ? "bg-[#f97316] text-white" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? "bg-brand-accent text-background" : "bg-foreground/10 text-muted-foreground")}>
                          {checkpoint.status === "Needs revision" ? "!" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? <Check className="h-3 w-3" aria-hidden="true" /> : checkpoint.phase}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Checkpoint {checkpoint.phase}</span>
                          <span className="mt-0.5 block text-[15px] font-bold leading-tight text-foreground">{checkpoint.title}</span>
                          <span className="mt-1 block text-[12px] font-semibold leading-relaxed text-muted-foreground/90">{checkpoint.question}</span>
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <CheckpointStatusBadge status={checkpoint.status} />
                        {locked ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            <Lock className="h-3 w-3" aria-hidden="true" /> Locked
                          </span>
                        ) : (
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground/70 transition-transform", isOpen ? "rotate-180" : "")} aria-hidden="true" />
                        )}
                      </div>
                    </div>
                    {!isOpen && phaseTasks.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-9">
                        {phaseTasks.map((task) => (
                          <span key={task.id} className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", task.result?.status === "blocked" || task.approvalState === "blocked" ? "bg-[#f97316]" : task.result?.status === "completed" ? "bg-brand-accent" : "bg-foreground/20")} />
                            <span className={cn("text-[11px] font-semibold", task.result?.status === "completed" ? "text-muted-foreground line-through" : "text-foreground/80")}>{task.title}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </button>
                  {isOpen ? (
                    <div className="border-t border-foreground/8 px-4 pb-4 pt-4">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager review</p>
                      <CheckpointReviewBody checkpoint={checkpoint} checkpoints={checkpoints} tasks={tasks} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* DESKTOP: master-detail */}
        <div data-testid="checkpoint-workspace-grid" className="hidden gap-5 xl:grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] xl:items-start">
          <section data-testid="checkpoint-ledger-panel" className="min-w-0 overflow-hidden rounded-[24px] border border-foreground/8 bg-background/76 p-3 shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">Mission checkpoints</p>
                <p className="mt-1 text-[13px] font-semibold text-foreground/88">Complete tasks to unlock downstream phases.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-foreground/[0.045] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">Cleared {clearedCount}/{checkpoints.length}</span>
                <span className="rounded-full border border-[#f97316]/20 bg-[#f97316]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#c2410c]">Active blocker: {activeBlocker?.title ?? "None"}</span>
              </div>
            </div>
            <div data-testid="checkpoint-scroll-region" className="scrollbar-soft space-y-4 pr-1 xl:max-h-[calc(100vh-160px)] xl:overflow-y-auto xl:pr-2">
              {checkpoints.map((checkpoint) => {
                const isSelected = selectedCheckpoint.id === checkpoint.id;
                const locked = Boolean(getBlockingDependency(checkpoint, checkpoints));
                const phaseTasks = tasks.filter((task) => task.checkpointId === checkpoint.id);
                return (
                  <div key={checkpoint.id} className={cn("relative overflow-hidden rounded-[20px] border transition-all", isSelected ? "border-brand-accent/40 bg-brand-accent/[0.02] shadow-lg shadow-brand-accent/5" : "border-foreground/8 bg-background/82 hover:border-foreground/16", locked ? "opacity-60" : "opacity-100")}>
                    <button type="button" aria-current={isSelected ? "true" : undefined} onClick={() => setSelectedCheckpointId(checkpoint.id)} className="w-full p-4 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", checkpoint.status === "Needs revision" ? "bg-[#f97316] text-white" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? "bg-brand-accent text-background" : "bg-foreground/10 text-muted-foreground")}>
                            {checkpoint.status === "Needs revision" ? "!" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? <Check className="h-3 w-3" aria-hidden="true" /> : checkpoint.phase}
                          </span>
                          <span>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Checkpoint {checkpoint.phase}</span>
                            <span className={cn("mt-0.5 block text-[15px] font-bold leading-tight", isSelected ? "text-foreground" : "text-foreground/80")}>{checkpoint.title}</span>
                            <span className="mt-1 block text-[12px] font-semibold leading-relaxed text-muted-foreground/90">{checkpoint.question}</span>
                          </span>
                        </div>
                        <CheckpointStatusBadge status={checkpoint.status} />
                      </div>
                      <div className="mt-4 space-y-2 pl-9">
                        {phaseTasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-2">
                            <span className={cn("h-1.5 w-1.5 rounded-full", task.result?.status === "blocked" || task.approvalState === "blocked" ? "bg-[#f97316]" : task.result?.status === "completed" ? "bg-brand-accent" : "bg-foreground/20")} />
                            <span className={cn("truncate text-[12px] font-semibold", task.result?.status === "completed" ? "text-muted-foreground line-through" : "text-foreground/88")}>{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </button>
                    {locked ? (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-full border border-foreground/10 bg-background px-3 py-1.5 shadow-sm">
                          <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/88">Locked by earlier phase</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
          <CheckpointInspector checkpoint={selectedCheckpoint} checkpoints={checkpoints} tasks={tasks} />
        </div>
      </div>
    </section>
  );
}

function CheckpointInspector({
  checkpoint,
  checkpoints,
  tasks,
}: {
  checkpoint: MissionCheckpointViewModel;
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
}) {
  return (
    <aside data-testid="checkpoint-inspector" className="min-w-0 rounded-[24px] border border-foreground/8 bg-background/88 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager review</p>
          <h3 className="mt-2 font-display text-[24px] font-bold leading-tight text-foreground">{checkpoint.title}</h3>
        </div>
        <CheckpointStatusBadge status={checkpoint.status} />
      </div>
      <div className="mt-4">
        <CheckpointReviewBody checkpoint={checkpoint} checkpoints={checkpoints} tasks={tasks} />
      </div>
    </aside>
  );
}

// Shared manager-review content rendered by both the desktop inspector and the
// mobile accordion so the two surfaces never drift apart.
function CheckpointReviewBody({
  checkpoint,
  checkpoints,
  tasks,
}: {
  checkpoint: MissionCheckpointViewModel;
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
}) {
  const requiredTasks = checkpoint.requiredTaskIds.map((taskId) => tasks.find((task) => task.id === taskId)).filter(Boolean) as MissionTaskViewModel[];
  const resolvedCount = requiredTasks.filter((task) => task.result?.status && task.result.status !== "pending").length;
  const blockerCopy = getCheckpointBlockerCopy(checkpoint, checkpoints);
  const decision = getCheckpointDecision(checkpoint, checkpoints);

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-foreground/8 bg-foreground/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Manager recommendation / Current decision</p>
          <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", decision === "Needs fix" ? "border-[#f97316]/25 bg-[#fff8f3] text-[#9a3412]" : "border-brand-accent/25 bg-brand-accent/[0.07] text-brand-accent")}>{decision}</span>
        </div>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed text-foreground">{getCheckpointReviewCopy(checkpoint, checkpoints)}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/88">{checkpoint.resultSummary}</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Required task results</p>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/80">{resolvedCount}/{requiredTasks.length}</span>
        </div>
        <div className="mt-3 divide-y divide-foreground/7 overflow-hidden rounded-[16px] border border-foreground/8 bg-background">
          {requiredTasks.map((task) => (
            <div key={task.id} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-bold leading-snug text-foreground">{task.title}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", task.result?.status === "blocked" ? "bg-[#f97316]/12 text-[#c2410c]" : task.result ? "bg-brand-accent/10 text-brand-accent" : "bg-foreground/5 text-muted-foreground/88")}>{task.result?.status ?? "pending"}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/89">{task.result?.userNote ?? "No review note yet."}</p>
              </div>
              <p className="text-[12px] font-semibold leading-relaxed text-foreground/89">{task.result?.interpretation ?? "Manager is waiting for this task result before judging the checkpoint."}</p>
            </div>
          ))}
        </div>
      </div>

      {blockerCopy ? (
        <div className="rounded-[18px] border border-[#f97316]/18 bg-[#fff8f3] p-4 text-[#9a3412]">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em]">What is blocking this</p>
          <p className="mt-2 text-[14px] font-bold leading-relaxed">{blockerCopy}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">What to do next</p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed">{checkpoint.nextAction}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">What this holds back</p>
              <p className="mt-1 text-[13px] font-semibold leading-relaxed">{checkpoint.unlocks.length ? checkpoint.unlocks.join(", ") : checkpoint.dependencyImpact}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[18px] border border-brand-accent/16 bg-brand-accent/[0.055] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Checkpoint cleared</p>
          <p className="mt-2 text-[14px] font-bold leading-relaxed text-foreground">Next phase opened: {checkpoint.unlocks[0] ?? checkpoint.nextAction}</p>
          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground/88">{checkpoint.nextAction}</p>
        </div>
      )}
    </div>
  );
}

function ActivityPanel({ notes, events }: { notes: MissionNoteViewModel[]; events: MissionEventViewModel[] }) {
  const items = [
    ...notes.map((note, index) => ({ id: `note-${note.id}`, order: index, label: note.route || "Agent note", message: note.message })),
    ...events.map((event, index) => ({ id: `event-${event.type}-${index}`, order: notes.length + index, label: event.type || event.actor || "Mission change", message: event.summary })),
  ].sort((a, b) => a.order - b.order);

  return (
    <section className="mx-auto max-w-4xl py-2">
      <h3 className="font-display text-[22px] font-semibold text-foreground">Activity</h3>
      <div data-testid="mission-activity-feed" className="mt-5 divide-y divide-foreground/8 border-y border-foreground/8">
        {items.length ? items.map((item) => (
          <article key={item.id} className="grid gap-2 py-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{item.label}</p>
            <p className="text-[14px] font-medium leading-relaxed text-foreground/88">{item.message}</p>
          </article>
        )) : <p className="py-6 text-[13px] text-muted-foreground">No mission activity yet.</p>}
      </div>
    </section>
  );
}

function MissionRecapPanel({ mission, recap, events }: { mission: MissionViewModel; recap: MissionRecapViewModel; events: MissionEventViewModel[] }) {
  return (
    <div className="grid gap-5">
      <span className="sr-only">living recap of the mission</span>
      <div className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission recap</p>
              <span className="rounded-full border border-foreground/8 bg-background/74 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-foreground/78">{recap.confidence} confidence</span>
            </div>
            <h3 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-tight text-foreground">{recap.finalCall}</h3>
            <p className="mt-4 text-[14px] font-semibold leading-relaxed text-foreground/82">{recap.currentState}</p>
          </div>
          <div className="border-t border-foreground/8 bg-background/62 p-5 lg:border-l lg:border-t-0">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Original request</p>
            <p className="mt-3 text-[15px] font-bold leading-relaxed text-foreground">&quot;{recap.originalRequest}&quot;</p>
            <div className="mt-4 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] px-3.5 py-3">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/72">Review date</p>
              <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-foreground/82">{recap.reviewDate}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="surface-elevated rounded-[22px] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-foreground/8 pb-4">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission record</p>
            <h4 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground">Operating summary</h4>
          </div>
          <span className="rounded-full border border-foreground/8 bg-background/74 px-2.5 py-1 text-[11px] font-bold text-foreground/78">{mission.title}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recap.sections.map((item) => (
            <div key={item.label} className="rounded-[16px] border border-foreground/8 bg-background/72 p-4">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/72">{item.label}</p>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/86">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="surface-elevated rounded-[22px] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/8 pb-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission log</p>
          <span className="rounded-full bg-foreground/[0.045] px-2.5 py-1 text-[11px] font-bold text-muted-foreground">{events.length} updates</span>
        </div>
        <div className="mt-4 divide-y divide-foreground/7 overflow-hidden rounded-[16px] border border-foreground/8 bg-background/72">
          {events.map((event) => (
            <div key={`${event.type}-${event.summary}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">{event.type}</span>
              <span className="text-[13px] font-semibold leading-relaxed text-foreground/86">{event.summary}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-foreground/8 bg-background/72 p-4 text-[13px] font-semibold leading-relaxed text-foreground/84">
        <p>
          <span className="font-bold text-foreground">Evidence and decision limits:</span> Rejected moves: {recap.alternativesRejected.join(", ")}. Missing evidence: {recap.missingEvidence.join(", ")}. The decision changes if {recap.changeDecision}
        </p>
        <p className="mt-2">
          Override state: {recap.override}. Quality review: {recap.qualityGate}.
        </p>
      </div>
    </div>
  );
}

function MissionTabRail({
  tab,
  onTab,
  openTaskCount,
  noteCount,
  blockedCheckpointCount,
  missionBlocked,
}: {
  tab: MissionRoomTab;
  onTab: (tab: MissionRoomTab) => void;
  openTaskCount: number;
  noteCount: number;
  blockedCheckpointCount: number;
  missionBlocked: boolean;
}) {
  const items = [
    { id: "pulse", label: "Pulse", badge: missionBlocked ? "Action" : null },
    { id: "tasks", label: "Tasks", badge: String(openTaskCount) },
    { id: "checkpoints", label: "Checkpoints", badge: blockedCheckpointCount ? `${blockedCheckpointCount} blocked` : null },
    { id: "activity", label: "Activity", badge: noteCount ? String(noteCount) : null },
  ] as const;

  return (
    <div data-testid="mobile-mission-tabs" className="scrollbar-none flex w-full min-w-0 max-w-full gap-1 overflow-x-auto border-b border-foreground/8 pb-3 lg:overflow-visible">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          onClick={() => onTab(item.id)}
          className={cn(
            "relative flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.03em] transition-colors sm:px-3.5 sm:text-[11px]",
            tab === item.id
              ? "border-foreground bg-foreground text-background"
              : "border-transparent bg-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
          )}
        >
          {item.label}
          {item.badge ? (
            <span className={cn("max-sm:hidden rounded-full px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal", tab === item.id ? "bg-background/14 text-background" : "bg-foreground/[0.055] text-foreground/80")}>
              {item.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function MissionProgressMeter({
  status,
  progress,
  className,
}: {
  status: MissionViewModel["status"];
  progress: number;
  className?: string;
}) {
  return (
    <div className={cn("h-1 overflow-hidden rounded-full bg-foreground/8", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", getMissionProgressClass(status))} style={{ width: `${progress}%` }} />
    </div>
  );
}

function StatusBadge({ status }: { status: MissionViewModel["status"] }) {
  return (
    <span className={cn(
      "rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]",
      status === "blocked" ? "border-warning/10 bg-warning/10 text-warning" :
      status === "review" ? "border-amber-500/10 bg-amber-500/10 text-amber-600" :
      status === "complete" ? "border-success/10 bg-success/10 text-success" :
      "border-brand-accent/10 bg-brand-accent/10 text-brand-accent",
    )}>
      {status}
    </span>
  );
}

function CheckpointStatusBadge({ status }: { status: MissionCheckpointViewModel["status"] }) {
  return (
    <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", checkpointStatusClass(status))}>
      {status}
    </span>
  );
}

function getMissionProgressClass(status: MissionViewModel["status"]) {
  if (status === "blocked") return "bg-warning";
  if (status === "complete") return "bg-success";
  return "bg-foreground";
}

function getOpenTaskCount(mission: MissionViewModel) {
  return missionTasks(mission).filter((task) => task.result?.status !== "completed").length;
}

function formatOpenTaskCount(count: number) {
  return `${count} open ${count === 1 ? "task" : "tasks"}`;
}

function missionTasks(mission: MissionViewModel): MissionTaskViewModel[] {
  if (mission.tasks?.length) return mission.tasks;
  return [
    {
      id: `${mission.id}-next-task`,
      checkpointId: `${mission.id}-checkpoint`,
      title: mission.nextTask || "Define next mission task",
      owner: "Manager",
      deadline: "Next operating review",
      approvalState: "active",
      purpose: mission.recommendation || "Turn the mission recommendation into owner-ready work.",
      steps: ["Confirm the owner", "Record the evidence needed", "Return the result to the Manager review"],
      evidenceIds: [],
      dependency: mission.review || "Manager review",
      riskIfLate: "The mission remains a recommendation instead of becoming coordinated work.",
    },
  ];
}

function missionCheckpoints(mission: MissionViewModel): MissionCheckpointViewModel[] {
  if (mission.checkpoints?.length) return mission.checkpoints;
  return [
    {
      id: `${mission.id}-checkpoint`,
      phase: 1,
      title: mission.review || "Mission Review",
      status: mission.status === "blocked" ? "Needs revision" : mission.status === "review" ? "Ready for AI review" : mission.status === "complete" ? "Met" : "Waiting on tasks",
      question: "Does the current mission evidence support the next Manager recommendation?",
      requiredTaskIds: [`${mission.id}-next-task`],
      dependsOnCheckpointIds: [],
      unlocks: [],
      blockedReason: mission.status === "blocked" ? mission.nextTask : "",
      dependencyImpact: "Downstream work should wait until this review has task results.",
      watchedSignals: [mission.musicSubject, mission.review].filter(Boolean),
      decisionRule: "Do not change the mission state without task results or source-backed context.",
      recommendation: mission.recommendation,
      resultSummary: mission.summary,
      nextAction: mission.nextTask,
    },
  ];
}

function missionNotes(mission: MissionViewModel): MissionNoteViewModel[] {
  if (mission.notes?.length) return mission.notes;
  return [
    {
      id: `${mission.id}-manager-note`,
      route: "Manager -> Mission record",
      subject: `Current mission read for ${mission.title}`,
      message: mission.summary,
      status: mission.status,
      sourceBasis: mission.review,
      recommendedAction: mission.recommendation,
      resultingChange: mission.nextTask,
      briefType: "Manager note",
    },
  ];
}

function missionRecap(mission: MissionViewModel): MissionRecapViewModel {
  if (mission.recap) return mission.recap;
  return {
    finalCall: mission.recommendation,
    currentState: mission.summary,
    originalRequest: mission.title,
    confidence: "Current",
    reviewDate: mission.review,
    sections: [
      { label: "Task status summary", value: mission.nextTask },
      { label: "Checkpoint status summary", value: mission.review },
      { label: "Blockers and missing evidence", value: mission.status === "blocked" ? mission.nextTask : "No active blocker recorded." },
      { label: "What would change the recommendation", value: "New task results, source evidence, or artist context can change this mission path." },
    ],
    missingEvidence: [],
    alternativesRejected: [],
    changeDecision: "new evidence changes the Manager recommendation.",
    override: "None recorded",
    qualityGate: "Pending review",
  };
}

function missionEvents(mission: MissionViewModel): MissionEventViewModel[] {
  if (mission.events?.length) return mission.events;
  return [{ type: "mission_loaded", actor: "Manager", summary: mission.summary }];
}

function getTaskStatusLabel(task: MissionTaskViewModel, approved: boolean, done: boolean) {
  if (done) return "Done";
  if (task.result?.status === "blocked" || task.approvalState === "blocked") return "Blocked";
  if (approved) return "Approved";
  if (task.approvalState === "not_required") return "No approval needed";
  return task.approvalState;
}

const deliverableLanguagePattern = /\b(thesis|document|copy|sign[- ]?off|approval|written|split sheet|report|epk|pitch|confirmation|memo|brief)\b/i;

function resolveTaskDeliverables(task: MissionTaskViewModel, localDeliverables?: MissionTaskDeliverableViewModel[]) {
  if (localDeliverables?.length) return localDeliverables;
  if (task.deliverables?.length) return task.deliverables;
  if (!taskNeedsDeliverable(task)) return [];

  return [{
    id: `${task.id}-deliverable`,
    title: inferDeliverableTitle(task),
    status: "missing" as const,
  }];
}

function taskNeedsDeliverable(task: MissionTaskViewModel) {
  const taskText = [
    task.title,
    task.purpose,
    task.dependency,
    task.riskIfLate,
    ...task.steps,
    ...task.evidenceIds,
  ].join(" ");
  return deliverableLanguagePattern.test(taskText);
}

function inferDeliverableTitle(task: MissionTaskViewModel) {
  const explicitEvidence = task.evidenceIds.find((item) => !/^EV[-_]/i.test(item) && deliverableLanguagePattern.test(item));
  if (explicitEvidence) return cleanDeliverableTitle(explicitEvidence);
  const stepWithDeliverable = task.steps.find((step) => deliverableLanguagePattern.test(step));
  if (stepWithDeliverable) return cleanDeliverableTitle(stepWithDeliverable);
  return cleanDeliverableTitle(task.title);
}

function cleanDeliverableTitle(value: string) {
  return value
    .replace(/^(upload|submit|provide|prepare|confirm|write|create|send)\s+/i, "")
    .replace(/\s+(for manager review|for manager approval|to manager|before review)$/i, "")
    .trim() || "Required document";
}

function replaceDeliverable(deliverables: MissionTaskDeliverableViewModel[], next: MissionTaskDeliverableViewModel) {
  if (!deliverables.some((deliverable) => deliverable.id === next.id)) {
    return [...deliverables, next];
  }
  return deliverables.map((deliverable) => deliverable.id === next.id ? { ...deliverable, ...next } : deliverable);
}

function isDeliverableSubmittable(deliverable: MissionTaskDeliverableViewModel) {
  return Boolean(deliverable.documentId) && ["uploaded", "checking", "accepted"].includes(deliverable.status);
}

function deliverableStatusLabel(status: MissionTaskDeliverableViewModel["status"]) {
  if (status === "uploading") return "Uploading";
  if (status === "uploaded") return "Uploaded";
  if (status === "checking") return "Checking";
  if (status === "accepted") return "Accepted";
  if (status === "needs_revision") return "Needs revision";
  if (status === "failed") return "Failed";
  return "Missing";
}

function deliverableStatusClass(status: MissionTaskDeliverableViewModel["status"]) {
  if (status === "uploaded" || status === "checking" || status === "accepted") return "bg-success/10 text-success";
  if (status === "uploading") return "bg-brand-accent/10 text-brand-accent";
  if (status === "failed" || status === "needs_revision") return "bg-warning/10 text-warning";
  return "bg-foreground/[0.055] text-muted-foreground";
}

function getBlockingDependency(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  return checkpoint.dependsOnCheckpointIds
    .map((checkpointId) => checkpoints.find((candidate) => candidate.id === checkpointId))
    .find((dependency) => dependency && dependency.status !== "Met");
}

function checkpointStatusClass(status: MissionCheckpointViewModel["status"]) {
  if (status === "Needs revision") return "border-[#f97316]/30 bg-[#fff8f3] text-[#9a3412]";
  if (status === "Met" || status === "Ready for AI review") return "border-brand-accent/25 bg-brand-accent/[0.07] text-brand-accent";
  return "border-foreground/8 bg-background text-muted-foreground";
}

function getCheckpointDecision(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  if (checkpoint.status === "Needs revision") return "Needs fix";
  if (checkpoint.status === "Met" || checkpoint.status === "Ready for AI review") return "Continue";
  if (checkpoint.status === "Watching signal") return "Wait";
  return getBlockingDependency(checkpoint, checkpoints) ? "Wait" : "Create new work";
}

function getCheckpointReviewCopy(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  const dependency = getBlockingDependency(checkpoint, checkpoints);
  if (checkpoint.status === "Needs revision") return `${checkpoint.title} found a real hold: ${checkpoint.blockedReason}`;
  if (dependency) return `${checkpoint.title} remains conditional because ${dependency.title} is not cleared.`;
  if (checkpoint.status === "Met") return `${checkpoint.title} is clear. The Manager can move the mission into the next phase.`;
  if (checkpoint.status === "Ready for AI review") return checkpoint.resultSummary;
  if (checkpoint.status === "Watching signal") return "This review waits until the watched signals are available.";
  return checkpoint.recommendation;
}

function getCheckpointBlockerCopy(checkpoint: MissionCheckpointViewModel, checkpoints: MissionCheckpointViewModel[]) {
  if (checkpoint.status === "Needs revision") return checkpoint.blockedReason || `${checkpoint.title} needs a fix.`;
  const dependency = getBlockingDependency(checkpoint, checkpoints);
  return dependency ? `${dependency.title} has to clear before this checkpoint can finish.` : "";
}
