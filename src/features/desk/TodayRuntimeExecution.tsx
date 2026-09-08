import { ChevronDown, ChevronRight, Eye } from "lucide-react";
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
import type { WorkspaceRoster, WorkspaceScope } from "../../types/workspaceTeam";
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
  /** undefined is solo; null means Team is active but its authenticated roster is still unavailable. */
  teamContext?: { viewer: { userId: string; accessRole: "owner" | "member" }; scope: WorkspaceScope; roster: WorkspaceRoster } | null;
};

type TodayQueueEntry =
  | { kind: "attention"; key: string; item: AttentionItem }
  | { kind: "manager"; key: string; item: TodayManagerItem; context?: string };

const TODAY_QUEUE_LIMIT = 6;

export function TodayRuntimeExecution({
  missions,
  fallbackItems = [],
  onOpenMission,
  onManager,
  onOpenFallbackItem = () => undefined,
  refreshKey = 0,
  teamContext,
}: TodayRuntimeExecutionProps) {
  const [showMore, setShowMore] = useState(false);
  const fallback = useMemo(
    () => teamContext === undefined ? fallbackProjection(missions) : emptyProjection(),
    [missions, teamContext],
  );
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
      if (teamContext === null) return;
      const client = createBrowserSupabaseClient();
      void loadTodayExecutionProjection(client, currentMissionIds, new Date(), teamContext)
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
  }, [fallback, currentMissionIds, missionSignature, refreshKey, teamContext]);

  async function refreshProjection() {
    try {
      if (teamContext === null) return;
      const client = createBrowserSupabaseClient();
      setProjection(await loadTodayExecutionProjection(client, currentMissionIds, new Date(), teamContext));
    } catch {
      // The mutation is already durable. Live-sync or the next Home refresh will
      // reconcile Today if this convenience refresh fails.
    }
  }

  const visibleFallbackItems = fallbackItems.slice(0, 3);
  const actionable = (projection.primary ? [projection.primary, ...projection.supporting] : projection.supporting)
    .slice(0, 3);
  const visibleWatches = projection.watches.slice(0, 3);
  const visibleUnassigned = teamContext?.viewer.accessRole === "owner" ? projection.unassigned.slice(0, 3) : [];
  const visibleTeam = teamContext ? projection.team.slice(0, 3) : [];
  const todayQueue: TodayQueueEntry[] = [
    ...visibleFallbackItems.map((item, index) => ({ kind: "attention" as const, key: `attention:${index}:${item.title}`, item })),
    ...actionable.map((item) => ({ kind: "manager" as const, key: `${item.kind}:${item.id}`, item })),
    ...visibleWatches.map((item) => ({ kind: "manager" as const, key: `watch:${item.id}`, item, context: "Watching" })),
    ...visibleUnassigned.map((item) => ({ kind: "manager" as const, key: `unassigned:${item.id}`, item, context: "Needs an owner" })),
    ...visibleTeam.map((item) => ({
      kind: "manager" as const,
      key: `team:${item.id}`,
      item,
      context: item.assigneeUserId
        ? `With ${teamContext?.roster.members.find((member) => member.userId === item.assigneeUserId)?.displayName ?? "your team"}`
        : "With your team",
    })),
  ].slice(0, TODAY_QUEUE_LIMIT);
  const [primaryEntry, ...moreEntries] = todayQueue;

  if (!primaryEntry) return null;

  return (
    <section data-testid="desk-today-execution" className="home-today-band">
      <div className="home-today-heading flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="home-section-label font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today</p>
        </div>
      </div>

      <div className="home-today-surface">
        <div data-testid="desk-today-next">
          {renderTodayEntry(primaryEntry, true)}
        </div>

        {moreEntries.length ? (
          <>
            <button
              type="button"
              className="home-today-more group w-full"
              aria-expanded={showMore}
              aria-label={`${showMore ? "Hide" : "Show"} ${moreEntries.length} more item${moreEntries.length === 1 ? "" : "s"} from Desk`}
              data-testid="desk-today-more"
              onClick={() => setShowMore((current) => !current)}
            >
              <span>More from Desk</span>
              <span className="home-today-more-count" aria-hidden="true">{moreEntries.length}</span>
              <ChevronDown className={`home-today-more-chevron ${showMore ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {showMore ? (
              <div data-testid="desk-today-more-items" className="home-today-more-list">
                {moreEntries.map((entry) => renderTodayEntry(entry, false))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );

  function renderTodayEntry(entry: TodayQueueEntry, primary: boolean) {
    if (entry.kind === "attention") {
      return (
        <button
          key={entry.key}
          type="button"
          aria-label={`Open ${entry.item.title}`}
          onClick={() => onOpenFallbackItem(entry.item)}
          data-today-kind="attention"
          data-today-primary={primary ? "true" : "false"}
          className={`home-today-row ${primary ? "home-today-row-primary" : "home-today-row-supporting"} group`}
        >
          <span className="home-today-copy min-w-0">
            <span className="home-today-title block font-semibold text-foreground">{entry.item.title}</span>
            <span className="home-today-description mt-1.5 block font-medium text-muted-foreground">{entry.item.body}</span>
          </span>
          <ChevronRight className="home-today-chevron" aria-hidden="true" />
        </button>
      );
    }

    const { item } = entry;
    if (item.kind === "question") {
      return (
        <TodayQuestionRow
          key={entry.key}
          item={item}
          primary={primary}
          onManager={onManager}
          onResolved={refreshProjection}
          context={entry.context}
        />
      );
    }
    if (item.kind === "permission" && item.permissionRequestId) {
      return (
        <TodayPermissionRow
          key={entry.key}
          item={item}
          primary={primary}
          onResolved={refreshProjection}
          context={entry.context}
        />
      );
    }
    return (
      <TodayActionRow
        key={entry.key}
        item={item}
        primary={primary}
        onOpenMission={onOpenMission}
        context={entry.context}
      />
    );
  }
}

function TodayQuestionRow({
  item,
  primary,
  onManager,
  onResolved,
  context,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onManager: () => void;
  onResolved: () => Promise<void>;
  context?: string;
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
        {item.whyNow ? <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">{item.whyNow}</span> : null}
        {context ? <span className="home-today-meta mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.055em] text-muted-foreground/62">{context}</span> : null}
      </span>
      <ChevronRight className="home-today-chevron" aria-hidden="true" />
    </button>
  );
}

function TodayPermissionRow({
  item,
  primary,
  onResolved,
  context,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onResolved: () => Promise<void>;
  context?: string;
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
          {item.whyNow ? <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">{item.whyNow}</span> : null}
          {context ? <span className="home-today-meta mt-1.5 block text-[11px] font-semibold uppercase tracking-[0.055em] text-muted-foreground/62">{context}</span> : null}
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
              </div>

              {effect.details.length ? (
                <ul className="mt-3 space-y-1.5 text-[12px] font-medium leading-relaxed text-foreground/80">
                  {effect.details.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void decide("approve")}
                  disabled={Boolean(pendingDecision)}
                  className="rounded-[10px] bg-foreground px-3.5 py-2 text-[12px] font-semibold text-background disabled:opacity-50"
                >
                  {pendingDecision === "approve" ? "Approving…" : effect.executable ? "Approve & run" : "Approve draft"}
                </button>
                <button
                  type="button"
                  onClick={() => void decide("reject")}
                  disabled={Boolean(pendingDecision)}
                  className="rounded-[10px] border border-foreground/12 px-3.5 py-2 text-[12px] font-semibold text-foreground disabled:opacity-50"
                >
                  {pendingDecision === "reject" ? "Rejecting…" : "Reject"}
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
  context,
}: {
  item: TodayManagerItem;
  primary: boolean;
  onOpenMission: (missionId: string) => void;
  context?: string;
}) {
  const meta = [context, compactMeta(item)].filter(Boolean).join(" · ");
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
        <span className="home-today-title flex items-center gap-2 font-semibold text-foreground">
          {item.kind === "watch" ? <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" /> : null}
          <span>{item.title}</span>
        </span>
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
      whyNow: task.purpose || mission.recommendation || "",
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
      whyNow: checkpoint.recommendation || "",
      cta: "view" as const,
      checkpointId: checkpoint.id,
    }];
  }).slice(0, 2);

  return {
    headline: actionable[0]?.headline ?? (watches.length ? "Desk is watching the active plan." : ""),
    primary: actionable[0],
    supporting: actionable.slice(1),
    watches,
    team: [],
    unassigned: [],
    generatedAt: new Date().toISOString(),
  };
}

function emptyProjection(): TodayExecutionProjection {
  return {
    headline: "",
    supporting: [],
    watches: [],
    team: [],
    unassigned: [],
    generatedAt: new Date().toISOString(),
  };
}
