import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import { cn } from "../../lib/utils";
import type {
  DrawerKind,
  MissionEventViewModel,
  MissionNoteViewModel,
  MissionTaskDeliverableViewModel,
  MissionViewModel,
} from "../../types/cleanProduction";
import { SongContextAttachment } from "../music/SongRoomAttachments";
import { WorkSurface } from "./MissionWorkSurface";
import {
  type MissionRoomTab,
  type MissionSurface,
  getBlockingDependency,
  getCurrentStage,
  getMissionNextLine,
  humanUpdateLabel,
  isOpenArtistTask,
  missionCheckpoints,
  missionEvents,
  missionNeedsUser,
  missionNotes,
  missionTasks,
  taskIsDone,
} from "./missionModel";

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
        <MissionList activeMissions={activeMissions} completedMissions={completedMissions} onOpen={openMission} />
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
      <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[32px]">Nothing is in motion yet.</p>
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
        <MissionListSection title="Needs you" description="Work that cannot move forward without you." missions={needsYou} onOpen={onOpen} emphasis />
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
              {completedMissions.map((mission) => <MissionRow key={mission.id} mission={mission} onOpen={() => onOpen(mission)} completed />)}
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
          <h2 className={cn("font-display text-[21px] font-semibold tracking-[-0.02em]", emphasis ? "text-foreground" : "text-foreground/92")}>{title}</h2>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">{description}</p>
        </div>
        <span className="pb-0.5 text-[11px] font-bold text-muted-foreground/60">{missions.length}</span>
      </header>
      <div className="divide-y divide-foreground/8 border-y border-foreground/8">
        {missions.map((mission) => <MissionRow key={mission.id} mission={mission} onOpen={() => onOpen(mission)} attention={emphasis} />)}
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
          <h3 className={cn("truncate font-display text-[17px] font-semibold tracking-[-0.015em] text-foreground sm:text-[18px]", completed && "text-foreground/70")}>{mission.title}</h3>
        </div>
        <p className={cn("mt-1.5 line-clamp-1 text-[13px] font-medium", attention ? "text-foreground/82" : "text-muted-foreground")}>{completed ? "Mission complete" : next}</p>
        {!completed ? <p className="mt-1 text-[11px] font-semibold text-muted-foreground/62">{stage}{tasks.length ? ` · ${doneCount} of ${tasks.length} done` : ""}</p> : null}
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
  const openCount = tasks.filter((task) => {
    if (!isOpenArtistTask(task)) return false;
    const checkpoint = checkpoints.find((candidate) => candidate.id === task.checkpointId);
    return !checkpoint || !getBlockingDependency(checkpoint, checkpoints);
  }).length;
  const updateCount = notes.length + events.length;
  const currentStage = getCurrentStage(mission, tasks);

  return (
    <section className="app-workspace app-workspace-reveal mx-auto grid w-full max-w-[1040px] min-w-0 gap-5 overflow-x-clip pb-14 sm:gap-7">
      <header>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Missions"
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-[10px] pr-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Missions
        </button>

        <div className="max-w-[820px]">
          <h1 className="break-words font-display text-[30px] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-[42px] lg:text-[50px]">{mission.title}</h1>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">{currentStage}</p>
        </div>
      </header>

      {mission.subjectType === "music_item" && mission.subjectId && onOpenMusicSubject ? (
        <div className="max-w-[680px]">
          <SongContextAttachment title={mission.musicSubject} onOpenSong={() => onOpenMusicSubject({ id: mission.subjectId!, title: mission.musicSubject, type: "music_item" })} />
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
      ) : <UpdatesSurface notes={notes} events={events} />}
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
      className={cn("relative min-h-11 flex-1 px-3 text-[13px] font-bold transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
      aria-current={active ? "page" : undefined}
    >
      {label}
      {count ? <span className="ml-1.5 text-[10px] font-bold text-muted-foreground/65">{count}</span> : null}
      {active ? <span className="absolute inset-x-3 bottom-[-1px] h-[2px] rounded-full bg-brand-accent" /> : null}
    </button>
  );
}

function UpdatesSurface({ notes, events }: { notes: MissionNoteViewModel[]; events: MissionEventViewModel[] }) {
  const items = useMemo(
    () => [
      ...notes.map((note, index) => ({ id: `note-${note.id}`, order: index, label: humanUpdateLabel(note.route || "Manager update"), message: note.message })),
      ...events.map((event, index) => ({ id: `event-${event.type}-${index}`, order: notes.length + index, label: humanUpdateLabel(event.actor || event.type || "Mission update"), message: event.summary })),
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
      ) : <p className="border-t border-foreground/8 py-8 text-[13px] font-medium text-muted-foreground">No updates yet.</p>}
    </section>
  );
}
