import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceHeader, WorkspaceTabRail } from "../../design-system/components";
import {
  Button,
  DetailHeader,
  SkeletonBlock,
  SkeletonRows,
  Timestamp,
} from "../../design-system/desktopPrimitives";
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
  detailPending = false,
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
  detailPending?: boolean;
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

  if (!missions.length && detailPending) {
    return (
      <section className="app-workspace app-workspace-reveal pb-12" aria-busy="true">
        <WorkspaceHeader title="Missions" />
        <MissionListSkeleton />
      </section>
    );
  }

  if (!missions.length) {
    return (
      <section className="app-workspace app-workspace-reveal pb-12">
        <WorkspaceHeader title="Missions" />
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
      <section className="app-workspace app-workspace-reveal pb-12">
        <WorkspaceHeader title="Missions" />
        <MissionList activeMissions={activeMissions} completedMissions={completedMissions} onOpen={openMission} />
      </section>
    );
  }

  return (
    <MissionRoom
      mission={selected}
      detailPending={detailPending}
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

function MissionListSkeleton() {
  return (
    <div className="mt-5 grid gap-5 sm:mt-8">
      <div className="grid max-w-[420px] grid-cols-3 gap-1 rounded-[11px] bg-foreground/[0.025] p-1">
        <SkeletonBlock className="h-9" />
        <SkeletonBlock className="h-9" />
        <SkeletonBlock className="h-9" />
      </div>
      <SkeletonRows count={5} />
    </div>
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
      <p className="font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[30px]">No missions yet</p>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <Button onClick={onCreateFirstMission} pending={firstMissionPending} size="lg">
          Create first mission
        </Button>
        <Button variant="ghost" onClick={onOpenManager} size="lg">
          Work with Manager
        </Button>
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
        className="lg:max-w-[420px]"
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

  return <p className="border-t border-foreground/8 py-8 text-[14px] font-medium text-muted-foreground">{copy}</p>;
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
      className="group grid min-h-[78px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-5 py-4 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.018] focus-visible:bg-foreground/[0.022] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20 sm:min-h-[84px] lg:px-3 lg:-mx-3 lg:w-[calc(100%+1.5rem)]"
    >
      <div className="min-w-0">
        <h3 className="truncate font-display text-[16px] font-semibold tracking-[-0.012em] text-foreground sm:text-[17px]">{mission.title}</h3>
        {currentTask ? <p className="mt-1.5 truncate text-[13px] font-medium text-foreground/72">{currentTask.title}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="hidden text-[12px] font-medium text-muted-foreground sm:inline">{doneCount} of {tasks.length} done</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground/45 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
    </button>
  );
}

function MissionRoom({
  mission,
  detailPending,
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
  detailPending: boolean;
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

  const back = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to Missions"
      className="inline-flex min-h-10 items-center gap-2 rounded-[10px] px-2 -ml-2 text-[12px] font-semibold text-muted-foreground outline-none transition-colors duration-150 hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-accent/20"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Missions
    </button>
  );

  return (
    <section className="app-workspace app-workspace-reveal grid w-full min-w-0 gap-5 overflow-x-clip pb-14 sm:gap-7" aria-busy={detailPending || undefined}>
      {detailPending ? (
        <MissionRoomSkeleton back={back} />
      ) : (
        <>
          <DetailHeader back={back} title={mission.title} meta={`${doneCount} of ${tasks.length} done`} />

          {mission.subjectType === "music_item" && mission.subjectId && onOpenMusicSubject ? (
            <div className="max-w-[760px]">
              <SongContextAttachment title={mission.musicSubject} onOpenSong={() => onOpenMusicSubject({ id: mission.subjectId!, title: mission.musicSubject, type: "music_item" })} />
            </div>
          ) : null}

          <WorkspaceTabRail
            ariaLabel="Mission section"
            testId="mobile-mission-tabs"
            className="lg:max-w-[280px]"
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
        </>
      )}
    </section>
  );
}

function MissionRoomSkeleton({ back }: { back: React.ReactNode }) {
  return (
    <div className="grid gap-7">
      <div>
        <div className="mb-5">{back}</div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div>
            <SkeletonBlock className="h-9 w-[min(70%,38rem)]" />
            <SkeletonBlock className="mt-2 h-9 w-[min(46%,24rem)]" />
          </div>
          <SkeletonBlock className="h-4 w-20" />
        </div>
      </div>
      <div className="grid max-w-[280px] grid-cols-2 gap-1 rounded-[11px] bg-foreground/[0.025] p-1">
        <SkeletonBlock className="h-9" />
        <SkeletonBlock className="h-9" />
      </div>
      <SkeletonRows count={4} />
    </div>
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
    <section className="w-full max-w-[1120px] border-y border-foreground/9">
      {items.map((item) => (
        <article
          key={item.id}
          className="grid min-w-0 gap-1 border-b border-foreground/8 py-4 last:border-b-0 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8"
        >
          <p className="max-w-[760px] text-[14px] font-medium leading-[1.6] text-foreground/88">{item.message}</p>
          <p className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted-foreground lg:justify-end lg:text-right">
            <span>{item.actor}</span>
            {item.createdAt ? <><span aria-hidden="true">·</span><Timestamp value={item.createdAt} context="standalone" /></> : null}
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
