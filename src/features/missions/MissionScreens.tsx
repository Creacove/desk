import { ArrowLeft, Check, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type {
  DrawerKind,
  MissionCheckpointViewModel,
  MissionEventViewModel,
  MissionGenesisResultViewModel,
  MissionNoteViewModel,
  MissionRecapViewModel,
  MissionTaskResultViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";

type MissionRoomTab = "pulse" | "tasks" | "checkpoints" | "notes" | "recap";

export function MissionsWorkspace({
  missions,
  selectedMissionId,
  missionGenesisResult,
  missionGenesisPending,
  missionGenesisError,
  onSelectMission,
  onRunMissionGenesis,
  onOpenMissionGenesisQuestions,
  onApproveTask,
  onCompleteTask,
  onDrawer,
  openRoomRequestKey = 0,
  openRoomTab,
  openTaskId,
  listRequestKey = 0,
}: {
  missions: MissionViewModel[];
  selectedMissionId: string;
  missionGenesisResult: MissionGenesisResultViewModel | null;
  missionGenesisPending: boolean;
  missionGenesisError: string | null;
  onSelectMission: (id: string) => void;
  onRunMissionGenesis: () => void;
  onOpenMissionGenesisQuestions: () => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string) => Promise<void>;
  onDrawer: (drawer: DrawerKind) => void;
  openRoomRequestKey?: number;
  openRoomTab?: MissionRoomTab;
  openTaskId?: string | null;
  listRequestKey?: number;
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

  function openMission(mission: MissionViewModel, nextTab: MissionRoomTab = "pulse") {
    onSelectMission(mission.id);
    setRoomMode("room");
    setTab(nextTab);
  }

  if (!localMissions.length) {
    return (
      <section>
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <MissionGenesisPanel
          result={missionGenesisResult}
          pending={missionGenesisPending}
          error={missionGenesisError}
          onRun={onRunMissionGenesis}
          onOpenQuestions={onOpenMissionGenesisQuestions}
        />
        <EmptyMissionState onRunMissionGenesis={onRunMissionGenesis} missionGenesisPending={missionGenesisPending} />
      </section>
    );
  }

  if (!selected || roomMode === "list") {
    return (
      <section>
        <WorkspaceHeader eyebrow="Artist work" title="Missions" />
        <MissionGenesisPanel
          result={missionGenesisResult}
          pending={missionGenesisPending}
          error={missionGenesisError}
          onRun={onRunMissionGenesis}
          onOpenQuestions={onOpenMissionGenesisQuestions}
        />
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
      targetTaskId={openTaskId ?? undefined}
    />
  );
}

function MissionGenesisPanel({
  result,
  pending,
  error,
  onRun,
  onOpenQuestions,
}: {
  result: MissionGenesisResultViewModel | null;
  pending: boolean;
  error: string | null;
  onRun: () => void;
  onOpenQuestions: () => void;
}) {
  return (
    <section className="mb-5 rounded-[24px] border border-foreground/8 bg-background/88 p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission Genesis</p>
          <h2 className="mt-2 font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">
            Create only the mission this artist actually needs
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-muted-foreground/84">
            The Manager checks artist stage, signals, memory, budget, source limits, and execution capacity before activating mission work.
          </p>
        </div>
        <ProductButton variant="secondary" onClick={onRun} disabled={pending}>
          {pending ? "Running Mission Genesis" : "Run Mission Genesis"}
        </ProductButton>
      </div>
      {result ? (
        <div className="mt-5 rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{result.outcome.replace(/_/g, " ")}</p>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{result.title}</h3>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{result.body}</p>
          {result.questions.length ? (
            <div className="mt-4">
              <ProductButton variant="primary" onClick={onOpenQuestions}>
                Answer in Manager Office
              </ProductButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-5 rounded-[16px] border border-red-500/20 bg-red-500/[0.055] p-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-red-700">Mission Genesis failed</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-red-950/80">{error}</p>
        </div>
      ) : null}
    </section>
  );
}

function EmptyMissionState({
  onRunMissionGenesis,
  missionGenesisPending,
}: {
  onRunMissionGenesis: () => void;
  missionGenesisPending: boolean;
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
          <ProductButton onClick={onRunMissionGenesis} disabled={missionGenesisPending}>
            {missionGenesisPending ? "Running Mission Genesis" : "Run Mission Genesis for this artist"}
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
      <button type="button" onClick={() => onOpen(mission, "notes")}>notes</button>
      <button type="button" onClick={() => onOpen(mission, "recap")}>mission recap</button>
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
  const metrics = missionMetrics(mission);
  const statusColor = mission.status === "blocked" ? "bg-warning" : mission.status === "review" ? "bg-amber-500" : "bg-brand-accent";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex min-h-[250px] flex-col justify-between overflow-hidden rounded-[24px] border border-foreground/8 bg-background/85 p-6 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={mission.status} />
          <span className="text-[10px] font-bold text-muted-foreground/60">{mission.progress}% complete</span>
        </div>
        <h4 className="mt-4 font-display text-[20px] font-bold tracking-tight text-foreground transition-colors group-hover:text-brand-accent">{mission.title}</h4>
        <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-relaxed text-muted-foreground/85">{mission.summary}</p>
      </div>

      <div className="mt-6 w-full space-y-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
          <div className={cn("h-full rounded-full transition-all duration-500", statusColor)} style={{ width: `${mission.progress}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-foreground/5 pt-4 text-center">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">{metric.label}</p>
              <p className="mt-1 text-[13px] font-bold text-foreground">{metric.value}</p>
            </div>
          ))}
        </div>
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
  targetTaskId,
}: {
  mission: MissionViewModel;
  tab: MissionRoomTab;
  onTab: (tab: MissionRoomTab) => void;
  onBack: () => void;
  onDrawer: (drawer: DrawerKind) => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string) => Promise<void>;
  targetTaskId?: string;
}) {
  const checkpoints = missionCheckpoints(mission);
  const tasks = missionTasks(mission);
  const notes = missionNotes(mission);
  const recap = missionRecap(mission);
  const events = missionEvents(mission);
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const openTaskCount = tasks.filter((task) => task.result?.status !== "completed").length;
  const progressColor = mission.status === "blocked" ? "bg-warning" : mission.status === "review" ? "bg-amber-500" : mission.status === "complete" ? "bg-success" : "bg-foreground";

  return (
    <section className="grid gap-6">
      <h3 className="sr-only">Missions</h3>
      <div data-testid="mobile-mission-switcher" className="sr-only" />
      <div data-testid="mission-command-bar" className="rounded-[26px] border border-foreground/8 bg-background/88 p-5 shadow-sm">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-[12px] font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Missions
        </button>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">What is happening</p>
              <StatusBadge status={mission.status} />
            </div>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight text-foreground lg:text-[38px]">{mission.title}</h2>
            <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-relaxed text-muted-foreground/84">{mission.summary}</p>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-foreground/[0.018] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88">Progress</p>
              <p className="text-[12px] font-semibold text-foreground">{mission.progress}%</p>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/5">
              <div className={cn("h-full rounded-full transition-all duration-1000", progressColor)} style={{ width: `${mission.progress}%` }} />
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground/88">{mission.review}</p>
          </div>
        </div>
      </div>

      <div data-testid="mission-surface-rail">
        <div data-testid="mobile-mission-tabs" className="flex flex-wrap gap-2 border-b border-foreground/5 pb-4">
          {([
            { id: "pulse", label: "Pulse", badge: mission.status === "blocked" ? "Action needed" : null },
            { id: "tasks", label: "Tasks", badge: `${openTaskCount} Left` },
            { id: "checkpoints", label: "Checkpoints", badge: activeBlocker ? "1 Blocked" : null },
            { id: "notes", label: "Notes", badge: `${notes.length}` },
            { id: "recap", label: "Mission recap", badge: null },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => onTab(item.id)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.10em] transition-all",
                tab === item.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/10 bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
              {item.badge ? (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold normal-case tracking-normal", tab === item.id ? "bg-background text-foreground" : "bg-foreground/5 text-foreground/80")}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[400px]">
        {tab === "pulse" ? <MissionPulse mission={mission} checkpoints={checkpoints} onDrawer={onDrawer} /> : null}
        {tab === "tasks" ? <TasksPanel checkpoints={checkpoints} tasks={tasks} targetTaskId={targetTaskId} onApproveTask={onApproveTask} onCompleteTask={onCompleteTask} /> : null}
        {tab === "checkpoints" ? <CheckpointsPanel checkpoints={checkpoints} tasks={tasks} /> : null}
        {tab === "notes" ? <NotesPanel notes={notes} /> : null}
        {tab === "recap" ? <MissionRecapPanel mission={mission} recap={recap} events={events} /> : null}
      </div>
    </section>
  );
}

function MissionPulse({
  mission,
  checkpoints,
  onDrawer,
}: {
  mission: MissionViewModel;
  checkpoints: MissionCheckpointViewModel[];
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const changes = [
    activeBlocker ? `${activeBlocker.title} is the active blocker.` : "No active blocker is recorded.",
    mission.nextTask ? `Next task: ${mission.nextTask}.` : "No next task is recorded.",
    mission.review ? `Next review: ${mission.review}.` : "Review point is not set.",
  ];

  return (
    <section className="surface-elevated overflow-hidden rounded-[22px] shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission pulse</span>
            <span className="rounded-full border border-brand-accent/15 bg-brand-accent/[0.07] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-accent">{mission.status}</span>
          </div>
          <h4 className="mt-3 font-display text-[24px] font-bold leading-tight tracking-tight text-foreground">{mission.review}</h4>
          <div className="mt-5 rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Recommendation</p>
            <p className="mt-2 text-[15px] font-semibold leading-relaxed text-foreground">{mission.recommendation}</p>
            <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/86">{mission.summary}</p>
          </div>
          <div className="mt-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">What changed</p>
            <div className="mt-2 grid gap-2">
              {changes.map((change) => (
                <div key={change} className="rounded-[12px] border border-foreground/6 bg-background/76 px-3.5 py-2.5 text-[12px] font-semibold leading-relaxed text-foreground/86">
                  {change}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <ProductButton variant="secondary" onClick={() => onDrawer("missionRecord")}>Mission recap</ProductButton>
            <ProductButton variant="secondary" onClick={() => onDrawer("evidence")}>View evidence</ProductButton>
          </div>
        </div>
        <div className="border-t border-foreground/8 bg-background/62 p-5 lg:border-l lg:border-t-0">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/82">Mission state</p>
          <div className="mt-4 grid gap-3">
            {[
              { label: "Active blocker", value: activeBlocker?.title ?? "None" },
              { label: "Next review", value: mission.review },
              { label: "Next task", value: mission.nextTask },
              { label: "Music subject", value: mission.musicSubject },
            ].map((item) => (
              <div key={item.label} className="rounded-[14px] border border-foreground/8 bg-foreground/[0.02] px-3.5 py-3">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/72">{item.label}</p>
                <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-foreground/82">{item.value}</p>
              </div>
            ))}
          </div>
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
}: {
  checkpoints: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
  targetTaskId?: string;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked", note: string) => Promise<void>;
}) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision");
  const targetTask = targetTaskId ? tasks.find((task) => task.id === targetTaskId) : undefined;
  const [activeCheckpointId, setActiveCheckpointId] = useState(targetTask?.checkpointId ?? activeBlocker?.id ?? checkpoints[0]?.id ?? "");
  const [expandedTaskIds, setExpandedTaskIds] = useState<string[]>([]);
  const [approvedTaskIds, setApprovedTaskIds] = useState<string[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [completionNote, setCompletionNote] = useState<{ taskId: string; status: "completed" | "blocked"; note: string } | null>(null);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  useEffect(() => {
    if (targetTask?.checkpointId) {
      setActiveCheckpointId(targetTask.checkpointId);
    }
  }, [targetTask?.checkpointId]);

  const toggleTaskDetails = (taskId: string) => {
    setExpandedTaskIds((current) => (current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]));
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
    setCompletionPending(true);
    setCompletionError(null);
    try {
      await onCompleteTask(completionNote.taskId, completionNote.status, note);
      setCompletedTaskIds((current) => [...new Set([...current, completionNote.taskId])]);
      setCompletionNote(null);
    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Task completion failed. Please try again.");
    } finally {
      setCompletionPending(false);
    }
  }

  return (
    <section className="surface-elevated rounded-[22px] p-4 shadow-sm sm:p-5">
      <h3 className="sr-only">Mission tasks</h3>
      <div className="grid items-start gap-5 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-6">
        <aside className="surface-elevated min-w-0 overflow-hidden rounded-[22px] p-4 shadow-sm lg:sticky lg:top-6 lg:self-start">
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
                className={cn("scroll-mt-24 overflow-hidden rounded-[20px] border bg-background/85 shadow-sm transition-all lg:scroll-mt-6", sectionActive ? "border-brand-accent/35 shadow-lg shadow-brand-accent/5" : "border-foreground/8", isLocked && !sectionActive && "opacity-70")}
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
                      const detailsOpen = expandedTaskIds.includes(task.id);
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
                            <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-foreground/89"><span className="font-bold text-foreground">Why it matters:</span> {task.purpose}</p>
                            <button type="button" onClick={() => toggleTaskDetails(task.id)} className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-accent hover:underline">
                              {detailsOpen ? "Hide task details" : "Show task details"}
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
                                <div className="mt-4 grid gap-3 rounded-[14px] border border-brand-accent/20 bg-brand-accent/[0.04] p-4">
                                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">
                                    {completionNote.status === "blocked" ? "Why is this task blocked?" : "What did you do? What was the result?"}
                                  </p>
                                  <p className="text-[12px] font-semibold leading-relaxed text-foreground/80">
                                    Record a specific outcome note. The Manager uses this to update checkpoints and shape the next recommendation.
                                  </p>
                                  <textarea
                                    id={`task-note-${task.id}`}
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
                              disabled={done || completionBlocked || blocked || isConfirmingCompletion}
                              onClick={() => startCompletion(task.id, "completed")}
                              className="w-full rounded-[10px] bg-foreground px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-background transition-all hover:opacity-90 disabled:opacity-35"
                            >
                              Mark done
                            </button>
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

function CheckpointsPanel({ checkpoints, tasks }: { checkpoints: MissionCheckpointViewModel[]; tasks: MissionTaskViewModel[] }) {
  const activeBlocker = checkpoints.find((checkpoint) => checkpoint.status === "Needs revision") ?? checkpoints[0];
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(activeBlocker?.id ?? checkpoints[0]?.id ?? "");
  const selectedCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? activeBlocker;
  const clearedCount = checkpoints.filter((checkpoint) => checkpoint.status === "Met" || checkpoint.status === "Ready for AI review").length;

  if (!selectedCheckpoint) return null;

  return (
    <section className="surface-elevated rounded-[22px] p-4 shadow-sm sm:p-5">
      <div className="space-y-5">
        <span className="sr-only">mission checkpoints</span>
        <div data-testid="checkpoint-workspace-grid" className="grid gap-5 xl:h-[calc(100vh-300px)] xl:min-h-[600px] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] xl:overflow-hidden">
          <section data-testid="checkpoint-ledger-panel" className="min-w-0 overflow-hidden rounded-[24px] border border-foreground/8 bg-background/76 p-3 shadow-sm xl:flex xl:h-full xl:flex-col">
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
            <div data-testid="checkpoint-scroll-region" className="scrollbar-soft min-h-0 space-y-4 pr-1 lg:overflow-y-auto lg:pr-2 xl:flex-1">
              <div data-testid="mobile-checkpoint-list" className="sr-only">Mobile checkpoint list</div>
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
  const requiredTasks = checkpoint.requiredTaskIds.map((taskId) => tasks.find((task) => task.id === taskId)).filter(Boolean) as MissionTaskViewModel[];
  const resolvedCount = requiredTasks.filter((task) => task.result?.status && task.result.status !== "pending").length;
  const blockerCopy = getCheckpointBlockerCopy(checkpoint, checkpoints);
  const decision = getCheckpointDecision(checkpoint, checkpoints);

  return (
    <aside data-testid="checkpoint-inspector" className="scrollbar-soft min-w-0 rounded-[24px] border border-foreground/8 bg-background/88 p-5 shadow-sm lg:sticky lg:top-6 lg:self-start xl:h-full xl:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Manager review</p>
          <h3 className="mt-2 font-display text-[24px] font-bold leading-tight text-foreground">{checkpoint.title}</h3>
        </div>
        <CheckpointStatusBadge status={checkpoint.status} />
      </div>

      <div className="mt-4 rounded-[18px] border border-foreground/8 bg-foreground/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Manager recommendation / Current decision</p>
          <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", decision === "Needs fix" ? "border-[#f97316]/25 bg-[#fff8f3] text-[#9a3412]" : "border-brand-accent/25 bg-brand-accent/[0.07] text-brand-accent")}>{decision}</span>
        </div>
        <p className="mt-3 text-[15px] font-semibold leading-relaxed text-foreground">{getCheckpointReviewCopy(checkpoint, checkpoints)}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-foreground/88">{checkpoint.resultSummary}</p>
      </div>

      <div className="mt-5">
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
        <div className="mt-5 rounded-[18px] border border-[#f97316]/18 bg-[#fff8f3] p-4 text-[#9a3412]">
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
        <div className="mt-5 rounded-[18px] border border-brand-accent/16 bg-brand-accent/[0.055] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Checkpoint cleared</p>
          <p className="mt-2 text-[14px] font-bold leading-relaxed text-foreground">Next phase opened: {checkpoint.unlocks[0] ?? checkpoint.nextAction}</p>
          <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground/88">{checkpoint.nextAction}</p>
        </div>
      )}
    </aside>
  );
}

function NotesPanel({ notes }: { notes: MissionNoteViewModel[] }) {
  return (
    <section className="surface-panel rounded-[28px] p-8 shadow-2xl shadow-black/[0.02] lg:p-8">
      <p className="max-w-3xl text-[15px] leading-relaxed text-foreground/88">
        These are read-only handoffs moving through the mission. The user can inspect them, but agents do not need approval to file a note into memory, update a checkpoint, or prepare a recommendation.
      </p>
      <div className="mt-8 divide-y divide-foreground/5">
        {notes.map((note) => (
          <article key={note.id} className="py-7 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-brand-accent">{note.route}</p>
                <h3 className="mt-1.5 font-display text-[22px] font-bold tracking-tight text-foreground">{note.subject}</h3>
              </div>
              <span className="rounded-full bg-foreground/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground/88">{note.status}</span>
            </div>
            <p className="mt-5 max-w-4xl text-[16px] leading-relaxed text-foreground/80">{note.message}</p>
            <div className="mt-6 space-y-2 rounded-[14px] border border-foreground/5 bg-foreground/5 p-5">
              <p className="text-[13px] leading-relaxed text-black/70"><span className="font-bold text-foreground">Why it matters:</span> {note.recommendedAction}</p>
              <p className="text-[13px] leading-relaxed text-black/70"><span className="font-bold text-foreground">Evidence used:</span> {note.sourceBasis}</p>
              <p className="text-[13px] leading-relaxed text-black/70"><span className="font-bold text-foreground">Resulting change:</span> {note.resultingChange}</p>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/85">{note.briefType}</p>
          </article>
        ))}
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

function missionMetrics(mission: MissionViewModel) {
  const tasks = missionTasks(mission);
  const checkpoints = missionCheckpoints(mission);
  const notes = missionNotes(mission);

  return [
    { label: "Tasks", value: String(tasks.filter((task) => task.result?.status !== "completed").length) },
    { label: "Checkpoints", value: String(checkpoints.length) },
    { label: "Handoffs", value: String(notes.length) },
  ];
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
