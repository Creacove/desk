import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { MissionTaskViewModel } from "../../types/cleanProduction";
import {
  type TaskMutationState,
} from "./missionModel";

export function TaskRow({
  task,
  done,
  mutation,
  availableAfter,
  emphasized = false,
  onOpen,
}: {
  task: MissionTaskViewModel;
  done: boolean;
  mutation?: TaskMutationState;
  availableAfter?: string;
  emphasized?: boolean;
  onOpen: () => void;
}) {
  const pending = mutation?.status === "pending";
  const blocked = task.result?.status === "blocked" || task.approvalState === "blocked";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group grid min-h-[68px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
        emphasized && !done && !availableAfter
          ? "bg-foreground/[0.035] hover:bg-foreground/[0.055]"
          : "hover:bg-foreground/[0.025]",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-brand-accent bg-brand-accent text-white"
            : blocked
              ? "border-[#f97316]/45 bg-[#fff8f3]"
              : "border-foreground/16 bg-background",
        )}
      >
        {done ? <Check className="h-3 w-3" /> : pending ? <Loader2 className="h-3 w-3 animate-spin text-brand-accent" /> : null}
      </span>

      <span className="min-w-0">
        <span
          className={cn(
            "os-list-title block text-foreground",
            done && "font-semibold text-muted-foreground",
          )}
        >
          {task.title}
        </span>
        {availableAfter ? (
          <span className="os-list-meta mt-1 block font-medium text-muted-foreground">
            Available after {availableAfter}
          </span>
        ) : mutation?.status === "error" ? (
          <span className="os-list-meta mt-1 block font-medium text-destructive">Couldn’t save. Tap to retry.</span>
        ) : pending ? (
          <span className="os-list-meta mt-1 block font-medium text-muted-foreground">Saving…</span>
        ) : blocked ? (
          <span className="os-list-meta mt-1 block font-medium text-[#c65d17]">Changes requested</span>
        ) : null}
      </span>

      <ChevronRight className="h-4 w-4 text-muted-foreground/42 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}
