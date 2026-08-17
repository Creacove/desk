import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type { MissionCheckpointViewModel, MissionTaskViewModel, MissionViewModel } from "../../types/cleanProduction";
import {
  type TaskMutationState,
  getTaskPrimaryLabel,
  isTaskOptimisticallyDone,
  resolveTaskWorkMode,
} from "./missionModel";

export function MissionNow({
  mission,
  task,
  checkpoint,
  optimisticApproved,
  optimisticCompleted,
  mutations,
  onOpenTask,
}: {
  mission: MissionViewModel;
  task?: MissionTaskViewModel;
  checkpoint?: MissionCheckpointViewModel;
  optimisticApproved: string[];
  optimisticCompleted: string[];
  mutations: Record<string, TaskMutationState>;
  onOpenTask: (task: MissionTaskViewModel) => void;
}) {
  if (!task) {
    return (
      <section className="rounded-[20px] border border-foreground/8 bg-foreground/[0.018] px-4 py-5 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/65">Now</p>
        <h2 className="mt-2 font-display text-[21px] font-semibold tracking-[-0.02em] text-foreground">
          {mission.status === "complete" ? "This mission is complete." : "Nothing needs you right now."}
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-muted-foreground">
          {mission.status === "complete" ? mission.recommendation : `The Manager or your team is moving the next part forward. ${mission.nextTask || mission.summary}`}
        </p>
      </section>
    );
  }

  const approved = optimisticApproved.includes(task.id) || task.approvalState === "approved";
  const done = isTaskOptimisticallyDone(task, optimisticCompleted);
  const mutation = mutations[task.id];

  return (
    <section className="overflow-hidden rounded-[22px] border border-brand-accent/18 bg-brand-accent/[0.045]">
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Needs you</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <h2 className="font-display text-[23px] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[27px]">
              {task.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] font-medium leading-relaxed text-foreground/70">
              {task.purpose || checkpoint?.dependencyImpact || mission.nextTask}
            </p>
            <p className="mt-3 text-[11px] font-bold text-muted-foreground">
              {checkpoint?.title ? `${checkpoint.title} · ` : ""}{task.deadline}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenTask(task)}
            disabled={done || mutation?.status === "pending"}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[12px] bg-foreground px-4 text-[12px] font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-45 sm:w-auto"
          >
            {mutation?.status === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {done ? "Done" : getTaskPrimaryLabel(task, approved)}
          </button>
        </div>
      </div>
    </section>
  );
}

export function StageIcon({ complete, attention, phase }: { complete: boolean; attention: boolean; phase: number }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
        complete
          ? "border-brand-accent bg-brand-accent text-white"
          : attention
            ? "border-brand-accent/35 bg-brand-accent/[0.08] text-brand-accent"
            : "border-foreground/10 bg-background text-muted-foreground",
      )}
    >
      {complete ? <Check className="h-3.5 w-3.5" /> : phase}
    </span>
  );
}

export function TaskRow({
  task,
  approved,
  done,
  mutation,
  locked = false,
  onOpen,
}: {
  task: MissionTaskViewModel;
  approved: boolean;
  done: boolean;
  mutation?: TaskMutationState;
  locked?: boolean;
  onOpen: () => void;
}) {
  const workMode = resolveTaskWorkMode(task);
  const blocked = task.result?.status === "blocked" || task.approvalState === "blocked";
  const pending = mutation?.status === "pending";

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={locked}
      className="group grid min-h-[64px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 pr-2 text-left disabled:cursor-default disabled:opacity-55"
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-brand-accent bg-brand-accent text-white"
            : blocked
              ? "border-[#f97316]/50 bg-[#fff8f3]"
              : "border-foreground/16 bg-background",
        )}
      >
        {done ? <Check className="h-3 w-3" /> : pending ? <Loader2 className="h-3 w-3 animate-spin text-brand-accent" /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-[13px] font-bold text-foreground", done && "text-muted-foreground line-through decoration-foreground/25")}>
          {task.title}
        </span>
        <span className="mt-1 block truncate text-[10.5px] font-semibold text-muted-foreground/72">
          {done
            ? "Done"
            : locked
              ? "Not available yet"
              : mutation?.status === "error"
                ? (task.completionMode === "manager_draft" ? "Review failed · Tap to retry" : "Couldn’t save · Tap to retry")
                : pending
                  ? (task.completionMode === "manager_draft" && mutation?.kind === "complete" ? "Manager reviewing" : "Saving…")
                  : blocked
                    ? "Blocked"
                    : workMode === "manager_work"
                      ? "Manager working"
                      : task.approvalState === "needs approval" && !approved
                        ? "Needs approval"
                        : task.deadline}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/42 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

export function MissionBrief({ mission }: { mission: MissionViewModel }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-foreground/8 pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-[12px] font-bold text-foreground">Mission brief</span>
          <span className="mt-0.5 block text-[10.5px] font-semibold text-muted-foreground">Objective, Manager read and decision context</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="grid gap-5 pb-5 pt-3 sm:grid-cols-2">
          <BriefItem label="Current read" value={mission.review} />
          <BriefItem label="Manager recommendation" value={mission.recommendation} />
          <BriefItem label="Why this mission exists" value={mission.summary} />
          <BriefItem label="Next move" value={mission.nextTask} />
        </div>
      ) : null}
    </section>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">{label}</p>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-foreground/80">{value}</p>
    </div>
  );
}
