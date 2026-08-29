import { Eye, MessageCircleQuestion, Play, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabaseClient";
import { loadTodayExecutionProjection } from "../../services/todayExecutionSupabase";
import type { MissionViewModel } from "../../types/cleanProduction";
import { getNextArtistTask, missionCheckpoints, missionTasks } from "../missions/missionModel";
import type { TodayExecutionProjection, TodayManagerItem } from "./todayProjection";

type TodayRuntimeExecutionProps = {
  missions: MissionViewModel[];
  onOpenMission: (missionId: string) => void;
  onManager: () => void;
  refreshKey?: string | number;
};

export function TodayRuntimeExecution({
  missions,
  onOpenMission,
  onManager,
  refreshKey = 0,
}: TodayRuntimeExecutionProps) {
  const fallback = useMemo(() => fallbackProjection(missions), [missions]);
  const [projection, setProjection] = useState<TodayExecutionProjection>(fallback);
  const missionSignature = useMemo(
    () => missions.map((mission) => `${mission.id}:${mission.status}:${mission.progress}:${mission.nextTask}`).join("|"),
    [missions],
  );

  useEffect(() => {
    let cancelled = false;
    setProjection(fallback);

    try {
      const client = createBrowserSupabaseClient();
      void loadTodayExecutionProjection(client)
        .then((next) => {
          if (!cancelled) setProjection(next);
        })
        .catch(() => {
          // Today is an execution projection, not a critical source-of-truth write.
          // Preserve the usable Mission fallback if its bounded read fails.
        });
    } catch {
      // Fixture/test environments may not have Supabase browser credentials.
    }

    return () => {
      cancelled = true;
    };
  }, [fallback, missionSignature, refreshKey]);

  if (!projection.primary && !projection.supporting.length && !projection.watches.length) return null;

  const actionable = projection.primary ? [projection.primary, ...projection.supporting] : projection.supporting;

  return (
    <section data-testid="desk-today-execution" className="mt-2 border-y border-foreground/9 py-5 sm:py-6">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today</p>
          <h2 className="mt-1.5 max-w-[48rem] font-display text-[22px] font-semibold leading-tight tracking-[-0.022em] text-foreground sm:text-[25px]">
            {projection.headline}
          </h2>
        </div>
      </div>

      {actionable.length ? (
        <div className="mt-5 divide-y divide-foreground/8 border-t border-foreground/8">
          {actionable.map((item, index) => (
            <TodayActionRow
              key={`${item.kind}:${item.id}`}
              item={item}
              index={index}
              primary={projection.primary?.id === item.id && projection.primary.kind === item.kind}
              onOpenMission={onOpenMission}
              onManager={onManager}
            />
          ))}
        </div>
      ) : null}

      {projection.watches.length ? (
        <div data-testid="desk-today-watches" className={actionable.length ? "mt-3" : "mt-5"}>
          {projection.watches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenMission(item.missionId)}
              className="flex w-full items-start gap-3 rounded-[12px] px-2 py-2.5 text-left outline-none hover:bg-foreground/[0.025] focus-visible:ring-2 focus-visible:ring-brand-accent/20"
            >
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              <span className="min-w-0 text-[12px] font-medium leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground/75">Desk is watching:</strong> {item.title}. {item.whyNow || "No action needed from you right now."}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TodayActionRow({
  item,
  index,
  primary,
  onOpenMission,
  onManager,
}: {
  item: TodayManagerItem;
  index: number;
  primary: boolean;
  onOpenMission: (missionId: string) => void;
  onManager: () => void;
}) {
  const onClick = item.kind === "question" ? onManager : () => onOpenMission(item.missionId);
  const meta = compactMeta(item);
  const Icon = item.kind === "question" ? MessageCircleQuestion : item.kind === "permission" ? ShieldCheck : Play;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-4 text-left outline-none hover:bg-foreground/[0.018] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20"
      aria-label={`${ctaLabel(item.cta)}: ${item.title}`}
      data-today-kind={item.kind}
      data-today-primary={primary ? "true" : "false"}
    >
      <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] font-semibold ${primary ? "bg-brand-accent/10 text-brand-accent" : "bg-foreground/[0.055] text-muted-foreground"}`}>
        {index + 1}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-snug text-foreground">{item.title}</span>
        {item.whyNow ? (
          <span className="mt-1 block max-w-[50rem] text-[12px] font-medium leading-relaxed text-muted-foreground">
            {item.whyNow}
          </span>
        ) : null}
        {meta ? (
          <span className="mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.055em] text-muted-foreground/62">
            {meta}
          </span>
        ) : null}
      </span>
      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-brand-accent">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {ctaLabel(item.cta)}
      </span>
    </button>
  );
}

function compactMeta(item: TodayManagerItem) {
  const values = [
    item.estimatedMinutes ? `${item.estimatedMinutes} min` : "",
    item.owner && item.owner.toLowerCase() !== "artist" ? item.owner : "",
    formatDeadline(item.deadline),
  ].filter(Boolean);
  return values.join(" · ");
}

function formatDeadline(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return sameDay
    ? `Due ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : `Due ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

function ctaLabel(cta: TodayManagerItem["cta"]) {
  const labels: Record<TodayManagerItem["cta"], string> = {
    answer: "Answer",
    review: "Review",
    start: "Start",
    continue: "Continue",
    fix: "Fix",
    resolve: "Resolve",
    view: "View",
  };
  return labels[cta];
}

function fallbackProjection(missions: MissionViewModel[]): TodayExecutionProjection {
  const active = missions.filter((mission) => !["complete", "archived", "cancelled", "candidate"].includes(mission.status));
  const actionable = active.flatMap((mission) => {
    const tasks = missionTasks(mission);
    const checkpoints = missionCheckpoints(mission);
    const task = getNextArtistTask(tasks, checkpoints, []);
    if (!task) return [];
    return [{
      id: task.id,
      kind: task.approvalState === "needs approval" ? "permission" as const : "task" as const,
      missionId: mission.id,
      missionTitle: mission.title,
      priorityTier: task.approvalState === "needs approval" ? 0 as const : 3 as const,
      priorityRank: 0,
      headline: task.approvalState === "needs approval"
        ? `One approval is blocking ${mission.title}.`
        : `${mission.title} is the priority today.`,
      title: task.title,
      whyNow: task.purpose || mission.recommendation || "This is the next ready human action in the current plan.",
      cta: task.approvalState === "needs approval" ? "review" as const : "start" as const,
      taskId: task.id,
      checkpointId: task.checkpointId,
      owner: task.owner,
    }];
  }).slice(0, 3);

  const actionableMissionIds = new Set(actionable.map((item) => item.missionId));
  const watches = active.flatMap((mission) => {
    if (actionableMissionIds.has(mission.id)) return [];
    const checkpoint = missionCheckpoints(mission).find((item) => item.status === "Watching signal");
    if (!checkpoint) return [];
    return [{
      id: checkpoint.id,
      kind: "watch" as const,
      missionId: mission.id,
      missionTitle: mission.title,
      priorityTier: 4 as const,
      priorityRank: 0,
      headline: "Desk is watching the active plan.",
      title: checkpoint.title,
      whyNow: checkpoint.recommendation || "No action needed from you right now.",
      cta: "view" as const,
      checkpointId: checkpoint.id,
    }];
  }).slice(0, 2);

  return {
    headline: actionable[0]?.headline ?? (watches.length ? "Desk is watching the active plan." : "No action needed from you right now."),
    primary: actionable[0],
    supporting: actionable.slice(1),
    watches,
    generatedAt: new Date().toISOString(),
  };
}
