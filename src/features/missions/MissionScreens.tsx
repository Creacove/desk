import { ClipboardCheck } from "lucide-react";
import { ProductButton, WorkspaceHeader } from "../../design-system/components";
import type { DrawerKind, MissionGenesisResultViewModel, MissionViewModel } from "../../types/cleanProduction";
import { useState } from "react";

export function MissionsWorkspace({
  missions,
  selectedMissionId,
  missionGenesisResult,
  missionGenesisAnswers,
  missionGenesisPending,
  onSelectMission,
  onRunMissionGenesis,
  onMissionGenesisAnswerChange,
  onSubmitMissionGenesisAnswers,
  onApproveTask,
  onCompleteTask,
  onDrawer,
}: {
  missions: MissionViewModel[];
  selectedMissionId: string;
  missionGenesisResult: MissionGenesisResultViewModel | null;
  missionGenesisAnswers: Record<string, string>;
  missionGenesisPending: boolean;
  onSelectMission: (id: string) => void;
  onRunMissionGenesis: () => void;
  onMissionGenesisAnswerChange: (key: string, value: string) => void;
  onSubmitMissionGenesisAnswers: () => void;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked") => Promise<void>;
  onDrawer: (drawer: DrawerKind) => void;
}) {
  const [tab, setTab] = useState<"overview" | "tasks" | "checkpoints" | "notes" | "recap">("overview");
  const selected = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0];

  return (
    <section>
      <WorkspaceHeader eyebrow="Artist work" title="Missions" />
      <MissionGenesisPanel
        result={missionGenesisResult}
        answers={missionGenesisAnswers}
        pending={missionGenesisPending}
        onRun={onRunMissionGenesis}
        onAnswerChange={onMissionGenesisAnswerChange}
        onSubmit={onSubmitMissionGenesisAnswers}
      />
      {!selected ? (
        <section className="rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">No active missions</p>
          <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
            Run Mission Genesis to decide whether this artist has durable management work worth organizing.
          </p>
        </section>
      ) : null}
      {selected ? (
        <>
      <section data-testid="missions-mobile-picker" className="mb-4 rounded-[16px] border border-foreground/10 bg-white p-3 shadow-[0_1px_6px_rgba(17,19,24,0.045)] lg:hidden">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Active Missions</p>
          <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{missions.length}</span>
        </div>
        <select
          aria-label="Select mission"
          value={selected.id}
          onChange={(event) => {
            onSelectMission(event.target.value);
            setTab("overview");
          }}
          className="h-10 w-full rounded-[12px] border border-foreground/10 bg-background px-3 text-[13px] font-semibold text-foreground outline-none"
        >
          {missions.map((mission) => (
            <option key={mission.id} value={mission.id}>{mission.title}</option>
          ))}
        </select>
      </section>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside data-testid="missions-desktop-list" className="hidden rounded-xl border border-foreground/10 bg-background shadow-sm p-4 lg:block">
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
            {tab === "tasks" ? <TasksPanel mission={selected} onApproveTask={onApproveTask} onCompleteTask={onCompleteTask} /> : null}
            {tab === "checkpoints" ? <CheckpointsPanel mission={selected} /> : null}
            {tab === "notes" ? <NotesPanel /> : null}
            {tab === "recap" ? <MissionRecapPanel /> : null}
          </div>
        </main>
      </div>
        </>
      ) : null}
    </section>
  );
}

function MissionGenesisPanel({
  result,
  answers,
  pending,
  onRun,
  onAnswerChange,
  onSubmit,
}: {
  result: MissionGenesisResultViewModel | null;
  answers: Record<string, string>;
  pending: boolean;
  onRun: () => void;
  onAnswerChange: (key: string, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="mb-5 rounded-xl border border-foreground/10 bg-background p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission Genesis</p>
          <h2 className="mt-2 font-display text-[18px] font-bold tracking-tight text-foreground">Create only the mission this artist actually needs</h2>
          <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-muted-foreground/82">
            The Manager checks artist stage, signals, context, memory, source limits, budget, and team capacity before activating mission work.
          </p>
        </div>
        <ProductButton variant="secondary" onClick={onRun} disabled={pending}>
          {pending ? "Running Mission Genesis" : "Run Mission Genesis"}
        </ProductButton>
      </div>
      {result ? (
        <div className="mt-5 rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{result.outcome.replaceAll("_", " ")}</p>
          <h3 className="mt-2 text-sm font-semibold text-foreground">{result.title}</h3>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{result.body}</p>
          {result.questions.length ? (
            <div className="mt-4 grid gap-3">
              {result.questions.map((question) => (
                <label key={question.key} className="grid gap-1.5 text-[12px] font-semibold text-foreground">
                  <span>{question.question}</span>
                  <span className="text-[11px] leading-relaxed text-muted-foreground/82">{question.reason}</span>
                  {question.answerKind === "single_select" ? (
                    <select
                      aria-label={question.question}
                      value={answers[question.key] ?? ""}
                      onChange={(event) => onAnswerChange(question.key, event.target.value)}
                      className="h-10 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-semibold outline-none"
                    >
                      <option value="">Select answer</option>
                      {(question.options ?? []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={question.question}
                      value={answers[question.key] ?? ""}
                      onChange={(event) => onAnswerChange(question.key, event.target.value)}
                      className="h-10 rounded-[10px] border border-foreground/10 bg-background px-3 text-[13px] font-semibold outline-none"
                    />
                  )}
                </label>
              ))}
              <div>
                <ProductButton variant="primary" onClick={onSubmit} disabled={pending}>
                  {pending ? "Continuing Mission Genesis" : "Continue Mission Genesis"}
                </ProductButton>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
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

function TasksPanel({
  mission,
  onApproveTask,
  onCompleteTask,
}: {
  mission: MissionViewModel;
  onApproveTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string, status: "completed" | "blocked") => Promise<void>;
}) {
  const tasks = mission.tasks ?? [];
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission tasks</p>
      <div className="grid gap-3 mt-4">
        {tasks.length ? tasks.map((task, index) => (
          <div key={task.id} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Task {index + 1}</p>
            <p className="text-sm font-semibold mt-2">{task.title}</p>
            <p className="mt-2 inline-flex rounded-full border border-foreground/10 bg-background px-2.5 py-1 font-ui text-[11px] font-semibold text-muted-foreground">
              {task.status}
            </p>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">
              {task.purpose ?? "Owner-ready work with purpose, dependency, evidence, and completion note."}
            </p>
            {task.managerInterpretation ? <p className="mt-3 text-[12px] font-semibold leading-relaxed text-foreground/90">{task.managerInterpretation}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <ProductButton
                variant="secondary"
                disabled={task.status === "approved" || task.status === "completed"}
                onClick={() => {
                  void onApproveTask(task.id);
                }}
              >
                Approve
              </ProductButton>
              <ProductButton
                variant="secondary"
                disabled={task.status === "completed"}
                onClick={() => {
                  void onCompleteTask(task.id, "completed");
                }}
              >
                Mark done
              </ProductButton>
              <ProductButton
                variant="quiet"
                disabled={task.status === "completed" || task.status === "blocked"}
                onClick={() => {
                  void onCompleteTask(task.id, "blocked");
                }}
              >
                Mark blocked
              </ProductButton>
            </div>
          </div>
        )) : (
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82">No tasks have been generated for this mission yet.</p>
        )}
      </div>
    </section>
  );
}

function CheckpointsPanel({ mission }: { mission: MissionViewModel }) {
  const checkpoints = mission.checkpoints ?? [];
  return (
    <section className="rounded-xl border border-foreground/10 bg-background shadow-sm p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission checkpoints</p>
      <div className="grid gap-3 mt-4">
        {checkpoints.length ? checkpoints.map((checkpoint) => (
          <div key={checkpoint.id} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-4">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-4 w-4 text-success" aria-hidden="true" />
              <p className="text-sm font-semibold">{checkpoint.title}</p>
            </div>
            <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">{checkpoint.question}</p>
            {checkpoint.recommendation ? <p className="mt-3 text-[12px] font-semibold leading-relaxed text-foreground/90">{checkpoint.recommendation}</p> : null}
          </div>
        )) : (
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82">No checkpoints have been generated for this mission yet.</p>
        )}
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
