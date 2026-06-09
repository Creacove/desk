import { ClipboardCheck } from "lucide-react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import type { DrawerKind, MissionViewModel } from "../../types/cleanProduction";
import { useState } from "react";

export function MissionsWorkspace({
  missions,
  selectedMissionId,
  onSelectMission,
  onDrawer,
}: {
  missions: MissionViewModel[];
  selectedMissionId: string;
  onSelectMission: (id: string) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const [tab, setTab] = useState<"overview" | "tasks" | "checkpoints" | "notes" | "recap">("overview");
  const selected = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0];

  return (
    <section>
      <WorkspaceHeader eyebrow="Artist work" title="Missions" />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Active Missions</p>
          <div className="grid gap-3 mt-4">
            {missions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                className={mission.id === selected.id ? "rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4 text-left ring-1 ring-accent" : "rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4 text-left"}
                onClick={() => {
                  onSelectMission(mission.id);
                  setTab("overview");
                }}
              >
                <p className="text-sm font-semibold">{mission.title}</p>
                <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">{mission.review}</p>
              </button>
            ))}
          </div>
        </aside>
        <main className="min-w-0">
          <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">What is happening</p>
            <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">{selected.title}</h2>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">{selected.summary}</p>
            <div className="grid gap-4 md:grid-cols-2 mt-5">
              <MissionStat label="Mission pulse" value={`${selected.progress}%`} />
              <MissionStat label="Music subject" value={selected.musicSubject} />
              <MissionStat label="Next task" value={selected.nextTask} />
              <MissionStat label="Review" value={selected.review} />
            </div>
            <div className="flex flex-wrap gap-2 mt-6">
              {[
                ["overview", "Overview"],
                ["tasks", "Tasks"],
                ["checkpoints", "Checkpoints"],
                ["notes", "Notes"],
                ["recap", "Mission recap"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={tab === id ? "rounded-lg border border-foreground bg-foreground px-3 py-2 text-[12px] font-bold text-background" : "rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"} onClick={() => setTab(id as typeof tab)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            {tab === "overview" ? <MissionOverview mission={selected} onDrawer={onDrawer} /> : null}
            {tab === "tasks" ? <TasksPanel /> : null}
            {tab === "checkpoints" ? <CheckpointsPanel /> : null}
            {tab === "notes" ? <NotesPanel /> : null}
            {tab === "recap" ? <MissionRecapPanel /> : null}
          </div>
        </main>
      </div>
    </section>
  );
}

function MissionOverview({ mission, onDrawer }: { mission: MissionViewModel; onDrawer: (drawer: DrawerKind) => void }) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Recommendation</p>
      <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-3">{mission.recommendation}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <ProductButton variant="secondary" onClick={() => onDrawer("missionRecord")}>Mission recap</ProductButton>
        <ProductButton variant="secondary" onClick={() => onDrawer("evidence")}>View evidence</ProductButton>
      </div>
    </section>
  );
}

function TasksPanel() {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Release tasks</p>
      <div className="grid gap-3 mt-4">
        {["Confirm split sheet", "Submit Spotify for Artists pitch", "Build TikTok creator target list"].map((task, index) => (
          <div key={task} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Task {index + 1}</p>
            <p className="text-sm font-semibold mt-2">{task}</p>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Owner-ready work with purpose, dependency, evidence, and completion note.</p>
            <div className="mt-4 flex gap-3">
              <ProductButton variant="secondary">Approve</ProductButton>
              <ProductButton variant="secondary">Mark done</ProductButton>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CheckpointsPanel() {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission checkpoints</p>
      <div className="grid gap-3 mt-4">
        {["Rights & Metadata Gate", "Campaign Build", "72-hour signal review"].map((checkpoint) => (
          <div key={checkpoint} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-4 w-4 text-success" aria-hidden="true" />
              <p className="text-sm font-semibold">{checkpoint}</p>
            </div>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Manager recommendation depends on required task results, watched signals, and evidence limits.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotesPanel() {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Agent notes</p>
      <div className="grid gap-3 mt-4">
        <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="text-sm font-semibold">Manager -&gt; Marketing Lead</p>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Creator seeding request: build the creator target list around night-drive, Atlanta, and late-night transit context.</p>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mt-3">Evidence used: EV-204</p>
        </div>
        <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="text-sm font-semibold">Finance/Rights -&gt; Manager</p>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Rights blocker remains open until split confirmation is clean.</p>
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground mt-3">Resulting change: mission remains blocked</p>
        </div>
      </div>
    </section>
  );
}

function MissionRecapPanel() {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Living recap of the mission</p>
      <h2 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">Mission recap</h2>
      <div className="mt-5 space-y-5">
        <RecapBlock title="Original request" body="I want to drop a new song next week." />
        <RecapBlock title="Task status summary" body="Pitch work can continue, but split approval remains the release blocker." />
        <RecapBlock title="Checkpoint status summary" body="Rights & Metadata Gate is still waiting on collaborator confirmation." />
        <RecapBlock title="Agent notes that changed the mission" body="Marketing can prepare a creator brief, but Finance/Rights blocks release confidence." />
        <RecapBlock title="Decisions already made" body="Manager moved the target from next Friday to Friday, June 12, 2026." />
        <RecapBlock title="Blockers and missing evidence" body="Private analytics, smart-link clicks, royalty statements, and signed splits are still missing." />
      </div>
    </section>
  );
}

function RecapBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{title}</p>
      <p className="text-[13px] font-semibold leading-relaxed text-foreground/90 mt-2">{body}</p>
    </div>
  );
}

function MissionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
      <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
