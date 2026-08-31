import { ChevronRight, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabaseClient";
import {
  describeTodayPermissionEffect,
  loadTodayManagerPermission,
  resolveTodayManagerPermission,
  type TodayPermissionDetail,
} from "../../services/todayPermissionAction";
import { answerTodayManagerQuestion } from "../../services/todayQuestionAction";
import { loadTodayExecutionProjection } from "../../services/todayExecutionSupabase";
import type { AttentionItem, MissionViewModel } from "../../types/cleanProduction";
import { GuidedContextQuestion } from "../manager/ManagerComposer";
import { getNextArtistTask, missionCheckpoints, missionTasks } from "../missions/missionModel";
import type { TodayExecutionProjection, TodayManagerItem } from "./todayProjection";

type TodayRuntimeExecutionProps = {
  missions: MissionViewModel[];
  fallbackItems?: AttentionItem[];
  onOpenMission: (missionId: string) => void;
  onManager: () => void;
  onOpenFallbackItem?: (item: AttentionItem) => void;
  refreshKey?: string | number;
};

export function TodayRuntimeExecution({
  missions,
  fallbackItems = [],
  onOpenMission,
  onManager,
  onOpenFallbackItem = () => undefined,
  refreshKey = 0,
}: TodayRuntimeExecutionProps) {
  const fallback = useMemo(() => fallbackProjection(missions), [missions]);
  const [projection, setProjection] = useState<TodayExecutionProjection>(fallback);
  const currentMissionIds = useMemo(() => missions.map((mission) => mission.id).filter(Boolean), [missions]);
  const missionSignature = useMemo(
    () => missions.map((mission) => `${mission.id}:${mission.status}:${mission.progress}:${mission.nextTask}`).join("|"),
    [missions],
  );

  useEffect(() => {
    let cancelled = false;
    setProjection(fallback);

    try {
      const client = createBrowserSupabaseClient();
      void loadTodayExecutionProjection(client, currentMissionIds)
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
  }, [fallback, currentMissionIds, missionSignature, refreshKey]);

  async function refreshProjection() {
    try {
      const client = createBrowserSupabaseClient();
      setProjection(await loadTodayExecutionProjection(client, currentMissionIds));
    } catch {
      // The mutation is already durable. Live-sync or the next Home refresh will
      // reconcile Today if this convenience refresh fails.
    }
  }

  const visibleFallbackItems = fallbackItems.slice(0, 2);
  const actionable = (projection.primary ? [projection.primary, ...projection.supporting] : projection.supporting)
    .slice(0, Math.max(0, 2 - visibleFallbackItems.length));
  const visibleWatches = projection.watches.slice(0, Math.max(0, 2 - actionable.length - visibleFallbackItems.length));
  const visibleItemCount = actionable.length + visibleFallbackItems.length + visibleWatches.length;

  if (!visibleItemCount) return null;

  return (
    <section data-testid="desk-today-execution" className="home-today-band">
      <div className="home-today-heading flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="home-section-label font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today</p>
        </div>
      </div>

      {visibleItemCount ? (
        <div className="home-today-list">
          {visibleFallbackItems.map((item, fallbackIndex) => (
            <button
              key={`${item.title}-${fallbackIndex}`}
              type="button"
              aria-label={`Open ${item.title}`}
              onClick={() => onOpenFallbackItem(item)}
              data-today-kind="attention"
              data-today-primary={fallbackIndex === 0 ? "true" : "false"}
              className={`home-today-row ${fallbackIndex === 0 ? "home-today-row-primary" : "home-today-row-supporting"} group`}
            >
              <span className="home-today-copy min-w-0">
                <span className="home-today-title block font-semibold text-foreground">{item.title}</span>
                <span className="home-today-description mt-1.5 block font-medium text-muted-foreground">{item.body}</span>
              </span>
              <ChevronRight className="home-today-chevron" aria-hidden="true" />
            </button>
          ))}
          {actionable.map((item) => item.kind === "question" ? (
            <TodayQuestionRow
              key={`${item.kind}:${item.id}`}
              item={item}
              primary={!visibleFallbackItems.length && projection.primary?.id === item.id && projection.primary.kind === item.kind}
              onManager={onManager}
              onResolved={refreshProjection}
            />
          ) : item.kind === "permission" && item.permissionRequestId ? (
            <TodayPermissionRow
              key={`${item.kind}:${item.id}`}
              item={item}
              primary={!visibleFallbackItems.length && projection.primary?.id === item.id && projection.primary.kind === item.kind}
              onOpenMission={onOpenMission}
              onResolved={refreshProjection}
            />
          ) : (
            <TodayActionRow
              key={`${item.kind}:${item.id}`}
              item={item}
              primary={!visibleFallbackItems.length && projection.primary?.id === item.id && projection.primary.kind === item.kind}
              onOpenMission={onOpenMission}
            />
          ))}
          {visibleWatches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenMission(item.missionId)}
              data-today-kind="watch"
              data-today-primary="false"
              className="home-today-row home-today-row-supporting group"
            >
              <span className="home-today-copy min-w-0">
                <span className="home-today-title flex items-center gap-2 font-semibold text-foreground">
                  <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  <span><strong>Desk is watching:</strong> {item.title}</span>
                </span>
                <span className="home-today-description mt-1.5 block font-medium text-muted-foreground">{item.whyNow}</span>
              </span>
              <ChevronRight className="home-today-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TodayQuestionRow({
  item,
  primary,
  onManager,
  onResolved,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onManager: () => void;
  onResolved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canAnswerHere = Boolean(item.contextRequestId && item.questionKey && item.conversationId && item.answerKind);

  async function submit(answerOverride?: string) {
    const answer = (answerOverride ?? value).trim();
    if (!answer || pending) return;
    if (!canAnswerHere) {
      onManager();
      return;
    }

    try {
      setPending(true);
      setError(null);
      const client = createBrowserSupabaseClient();
      await answerTodayManagerQuestion(client, item, answer);
      setValue("");
      setOpen(false);
      await onResolved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Desk could not save this answer.");
    } finally {
      setPending(false);
    }
  }

  if (open && canAnswerHere) {
    return (
      <div data-testid="desk-today-question" data-today-primary={primary ? "true" : "false"} className="home-today-expanded grid gap-3 py-4 pl-10">
        <div className="max-w-[48rem]">
          <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">{item.whyNow}</p>
        </div>
        <GuidedContextQuestion
          question={{
            key: item.questionKey!,
            question: item.title,
            reason: item.whyNow,
            answerKind: item.answerKind!,
            options: item.options ?? [],
          }}
          position={0}
          total={1}
          value={value}
          onChange={setValue}
          onSubmit={submit}
          onUseRecommendation={() => undefined}
          onAnswerLater={() => setOpen(false)}
          sendPending={pending}
        />
        {error ? <p role="alert" className="text-[12px] font-medium text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => canAnswerHere ? setOpen(true) : onManager()}
      className={`home-today-row ${primary ? "home-today-row-primary" : "home-today-row-supporting"} group w-full`}
      aria-label={`Answer: ${item.title}`}
      data-today-kind="question"
      data-today-primary={primary ? "true" : "false"}
    >
      <span className="home-today-copy min-w-0">
        <span className="home-today-title block font-semibold text-foreground">{item.title}</span>
        <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">{item.whyNow}</span>
      </span>
      <ChevronRight className="home-today-chevron" aria-hidden="true" />
    </button>
  );
}

function TodayPermissionRow({
  item,
  primary,
  onOpenMission,
  onResolved,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onOpenMission: (missionId: string) => void;
  onResolved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<TodayPermissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permissionId = item.permissionRequestId ?? item.id;

  async function openReview() {
    if (open) {
      setOpen(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createBrowserSupabaseClient();
      const next = await loadTodayManagerPermission(client, permissionId);
      if (next.status !== "pending") {
        await onResolved();
        return;
      }
      setDetail(next);
      setOpen(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Desk could not load this approval.");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    if (pendingDecision) return;
    try {
      setPendingDecision(decision);
      setError(null);
      const client = createBrowserSupabaseClient();
      await resolveTodayManagerPermission(client, permissionId, decision);
      setOpen(false);
      setDetail(null);
      await onResolved();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Desk could not resolve this approval.");
    } finally {
      setPendingDecision(null);
    }
  }

  const effect = detail ? describeTodayPermissionEffect(detail) : null;

  return (
    <div data-testid="desk-today-permission" data-today-primary={primary ? "true" : "false"}>
      <button
        type="button"
        onClick={openReview}
        className={`home-today-row ${primary ? "home-today-row-primary" : "home-today-row-supporting"} group w-full`}
        aria-label={`Review: ${item.title}`}
        data-today-kind="permission"
        data-today-primary={primary ? "true" : "false"}
      >
        <span className="home-today-copy min-w-0">
          <span className="home-today-title block font-semibold text-foreground">{item.title}</span>
          <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">{item.whyNow}</span>
        </span>
        <ChevronRight className={`home-today-chevron ${loading ? "animate-pulse" : ""} ${open ? "rotate-90" : ""}`} aria-hidden="true" />
      </button>

      {open ? (
        <div className="home-today-expanded mb-4 ml-10 max-w-[52rem] rounded-[14px] border border-foreground/10 bg-foreground/[0.018] p-4">
          {detail && effect ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{effect.actionLabel}</p>
                  {effect.targetLabel ? <p className="mt-1 text-[11px] font-medium text-muted-foreground">{effect.targetLabel}</p> : null}
                </div>
                <span className="rounded-full border border-foreground/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                  {effect.executable ? "Desk can execute" : "Prepared only"}
                </span>
              </div>

              {effect.details.length ? (
                <ul className="mt-3 space-y-1.5 text-[12px] font-medium leading-relaxed text-foreground/80">
                  {effect.details.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : null}

              {detail.risk ? <p className="mt-3 text-[12px] font-medium leading-relaxed text-muted-foreground"><strong className="text-foreground/75">Risk:</strong> {detail.risk}</p> : null}
              {effect.caution ? <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">{effect.caution}</p> : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={Boolean(pendingDecision)}
                  className="rounded-[10px] bg-foreground px-3.5 py-2 text-[12px] font-semibold text-background disabled:opacity-50"
                >
                  {pendingDecision === "approve" ? "Approving…" : effect.executable ? "Approve & run" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => void decide("reject")}
                  disabled={Boolean(pendingDecision)}
                  className="rounded-[10px] border border-foreground/12 px-3.5 py-2 text-[12px] font-semibold text-foreground disabled:opacity-50"
                >
                  {pendingDecision === "reject" ? "Rejecting…" : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMission(item.missionId)}
                  disabled={Boolean(pendingDecision)}
                  className="px-2 py-2 text-[12px] font-semibold text-muted-foreground disabled:opacity-50"
                >
                  Open Mission
                </button>
              </div>
            </>
          ) : null}
          {error ? <p role="alert" className="text-[12px] font-medium text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function TodayActionRow({
  item,
  primary,
  onOpenMission,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onOpenMission: (missionId: string) => void;
}) {
  const meta = compactMeta(item);
  return (
    <button
      type="button"
      onClick={() => onOpenMission(item.missionId)}
      className={`home-today-row ${primary ? "home-today-row-primary" : "home-today-row-supporting"} group w-full`}
      aria-label={`${ctaLabel(item.cta)}: ${item.title}`}
      data-today-kind={item.kind}
      data-today-primary={primary ? "true" : "false"}
    >
      <span className="home-today-copy min-w-0">
        <span className="home-today-title block font-semibold text-foreground">{item.title}</span>
        {item.whyNow ? (
          <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">
            {item.whyNow}
          </span>
        ) : null}
        {meta ? (
          <span className="home-today-meta mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.055em] text-muted-foreground/62">
            {meta}
          </span>
        ) : null}
      </span>
      <ChevronRight className="home-today-chevron" aria-hidden="true" />
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
