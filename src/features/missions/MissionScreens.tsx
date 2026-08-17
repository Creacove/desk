import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProductButton, WorkspaceHeader, WorkspaceTabRail } from "../../design-system/components";
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
  missionCheckpoints,
  getNextArtistTask,
  missionEvents,
  missionNeedsUser,
  missionNotes,
  missionTasks,
  taskIsDone,
} from "./missionModel";

type MissionListTab = "todo" | "progress" | "done";

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
      <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[32px]">No missions yet</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ProductButton onClick={onCreateFirstMission} disabled={firstMissionPending}>
          {firstMissionPending ? "Opening Manager" : "Create first mission"}
        </ProductButton>
        <button
          type="button"
          onClick={onOpenManager}
          className="inline-flex min-h-11 items-center rounded-[12px] px-4 text-[13px] font-bold text-foreground transition-colors hover:bg-foreground/[0.045]"
        >
          Manager
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
  const toDo = activeMissions.filter(missionNeedsUser);
  const inProgress = activeMissions.filter((mission) => !missionNeedsUser(mission));
  const [activeTab, setActiveTab] = useState<MissionListTab>(toDo.length ? "todo" : inProgress.length ? "progress" : "done");

  const visible = activeTab === "todo" ? toDo : activeTab === "progress" ? inProgress : completedMissions;

  return (
    <div data-testid="mobile-mission-switcher" className="mt-5 grid w-full gap-5 pb-12 sm:mt-8">
      <WorkspaceTabRail
        ariaLabel="Mission status"
        testId="mission-status-tabs"
        active={activeTab}
        onChange={(value) => setActiveTab(value as MissionListTab)}
        items={[
          { id: "todo", label: "To do" },
          { id: "progress", label: "In progress" },
          { id: "done", label: "Done" },
        ]}
      />

      {visible.length ? (
        <div className="divide-y divide-foreground/8 border-y border-foreground/8">
          {visible.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              mode={activeTab}
              onOpen={() => onOpen(mission)}
            />
          ))}
        </div>
      ) : (
        <MissionListEmpty tab={activeTab} />
      )}
    </div>
  );
}

function MissionListEmpty({ tab }: { tab: MissionListTab }) {
  const copy = tab === "todo"
    ? "You’re all caught up"
    : tab === "progress"
      ? "Nothing in progress"
      : "Nothing completed yet";

  return <p className="border-t border-foreground/8 py-8 text-[14px] font-semibold text-muted-foreground">{copy}</p>;
}

function MissionRow({
  mission,
  mode,
  onOpen,
}: {
  mission: MissionViewModel;
  mode: MissionListTab;
  onOpen: () => void;
}) {
  const tasks = missionTasks(mission);
  const doneCount = tasks.filter(taskIsDone).length;
  const currentTask = mode === "todo" ? getNextArtistTask(tasks, missionCheckpoints(mission), []) : undefined;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group grid min-h-[82px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 text-left sm:min-h-[92px]"
    >
      <div className="min-w-0">
        <h3 className="truncate font-display text-[17px] font-semibold tracking-[-0.015em] text-foreground sm:text-[18px]">{mission.title}</h3>
        {currentTask ? <p className="mt-1.5 line-clamp-1 text-[13px] font-medium text-foreground/76">{currentTask.title}</p> : null}
        <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground/65">{doneCount} of {tasks.length} done</p>
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
  const doneCount = tasks.filter(taskIsDone).length;

  return (
    <section className="app-workspace app-workspace-reveal grid w-full min-w-0 gap-5 overflow-x-clip pb-14 sm:gap-7">
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

        <div>
          <h1 className="break-words font-display text-[30px] font-semibold leading-[1.04] tracking-[-0.035em] text-foreground sm:text-[42px] lg:text-[50px]">{mission.title}</h1>
          <p className="mt-3 text-[13px] font-semibold text-muted-foreground">{doneCount} of {tasks.length} done</p>
        </div>
      </header>

      {mission.subjectType === "music_item" && mission.subjectId && onOpenMusicSubject ? (
        <div className="max-w-[680px]">
          <SongContextAttachment title={mission.musicSubject} onOpenSong={() => onOpenMusicSubject({ id: mission.subjectId!, title: mission.musicSubject, type: "music_item" })} />
        </div>
      ) : null}

      <WorkspaceTabRail
        ariaLabel="Mission section"
        testId="mobile-mission-tabs"
        active={surface}
        onChange={(value) => onSurface(value as MissionSurface)}
        items={[
          { id: "work", label: "Work" },
          { id: "updates", label: "Updates" },
        ]}
      />

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

function UpdatesSurface({ notes, events }: { notes: MissionNoteViewModel[]; events: MissionEventViewModel[] }) {
  const items = useMemo(
    () => [
      ...notes.map((note, index) => ({
        id: `note-${note.id}`,
        order: index,
        message: note.message,
        actor: note.route === "manager" ? "Manager" : "Mission",
        createdAt: readCreatedAt(note),
      })),
      ...events.map((event, index) => ({
        id: `event-${(event as { id?: string }).id || event.type}-${index}`,
        order: notes.length + index,
        message: event.summary,
        actor: humanActor(event.actor),
        createdAt: readCreatedAt(event),
      })),
    ].sort((a, b) => {
      const left = a.createdAt ? Date.parse(a.createdAt) : a.order;
      const right = b.createdAt ? Date.parse(b.createdAt) : b.order;
      return right - left;
    }),
    [notes, events],
  );

  if (!items.length) {
    return <p className="border-t border-foreground/8 py-8 text-[13px] font-medium text-muted-foreground">No updates yet</p>;
  }

  return (
    <section className="max-w-[820px] border-y border-foreground/9">
      {items.map((item) => (
        <article key={item.id} className="border-b border-foreground/8 py-4 last:border-b-0">
          <p className="text-[13px] font-semibold leading-relaxed text-foreground">{item.message}</p>
          <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
            {item.actor}{item.createdAt ? ` · ${formatUpdateTime(item.createdAt)}` : ""}
          </p>
        </article>
      ))}
    </section>
  );
}

function humanActor(actor: MissionEventViewModel["actor"]) {
  if (actor === "artist") return "You";
  if (actor === "manager") return "Manager";
  return "Desk";
}

function readCreatedAt(value: MissionNoteViewModel | MissionEventViewModel) {
  return (value as { createdAt?: string }).createdAt;
}

function formatUpdateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayDiff = Math.round((today.getTime() - eventDay.getTime()) / 86_400_000);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(parsed);

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
}
