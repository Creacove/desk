import { Check, ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { WorkspaceRoster } from "../../types/workspaceTeam";

export type TaskAssignmentContext = {
  roster: WorkspaceRoster;
  viewerUserId: string;
  onReassign?: (assigneeUserId: string | null, expectedAssignmentVersion: number) => Promise<void> | void;
};

export function TaskAssigneeControl({
  roster,
  assigneeUserId,
  viewerUserId,
  assignmentVersion = 0,
  workMode,
  onReassign,
}: TaskAssignmentContext & {
  assigneeUserId?: string | null;
  assignmentVersion?: number;
  workMode?: string;
}) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const members = roster.members.filter((member) => member.accessRole === "owner" || member.accessRole === "member");
  const viewer = members.find((member) => member.userId === viewerUserId);
  const assignee = assigneeUserId ? members.find((member) => member.userId === assigneeUserId) : undefined;
  const canEdit = viewer?.accessRole === "owner" && Boolean(onReassign);

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // A workspace with one active person has no meaningful assignment choice.
  // The server already routes work to that person, so keeping this surface
  // hidden prevents the task drawer from asking an obvious question.
  if (members.length <= 1 || workMode === "manager_work") return null;

  async function changeAssignee(value: string | null) {
    if (!onReassign || !canEdit || pending) return;
    setPending(true);
    setError(null);
    try {
      await onReassign(value, assignmentVersion);
      setOpen(false);
    } catch (reassignError) {
      setError(safeAssignmentError(reassignError));
    } finally {
      setPending(false);
    }
  }

  const label = assignee?.displayName ?? "Needs owner";
  const triggerLabel = assignee ? `Assigned to ${assignee.displayName}. Change assignee` : "Assign task";

  return (
    <div ref={rootRef} className="relative mt-3" data-testid="task-assignee-control">
      {canEdit ? (
        <button
          type="button"
          aria-label={triggerLabel}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={pending}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.035] px-2.5 pr-2 text-[12px] font-semibold text-foreground transition-colors hover:border-foreground/16 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/28 disabled:pointer-events-none disabled:opacity-50"
        >
          <AssigneeAvatar name={assignee?.displayName} />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      ) : (
        <span
          aria-label={assignee ? `Assigned to ${assignee.displayName}` : "Needs an owner"}
          className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-full bg-foreground/[0.035] px-2.5 text-[12px] font-semibold text-muted-foreground"
        >
          <AssigneeAvatar name={assignee?.displayName} />
          <span className="truncate">{label}</span>
        </span>
      )}

      {open && canEdit ? (
        <div role="menu" aria-label="Team members" className="absolute left-0 top-full z-30 mt-2 min-w-[15rem] max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-foreground/10 bg-background p-1.5 shadow-[0_18px_45px_hsl(var(--foreground)/0.16)]">
          <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/68">Assign to</p>
          <button
            type="button"
            disabled={pending}
            aria-label="Leave unassigned"
            onClick={() => void changeAssignee(null)}
            className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/28 disabled:pointer-events-none disabled:opacity-50"
          >
            <AssigneeAvatar />
            <span className="min-w-0 flex-1 truncate">Needs owner</span>
            {!assignee ? <Check className="h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" /> : null}
          </button>
          {members.map((member) => (
            <button
              key={member.userId}
              type="button"
              disabled={pending}
              aria-label={`Assign to ${member.displayName}`}
              onClick={() => void changeAssignee(member.userId)}
              className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/28 disabled:pointer-events-none disabled:opacity-50"
            >
              <AssigneeAvatar name={member.displayName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-foreground">{member.displayName}</span>
                <span className="block truncate text-[11px] font-medium text-muted-foreground">
                  {member.operatingTitle || member.responsibilityTags.slice(0, 2).join(" · ") || "Team member"}
                </span>
              </span>
              {assignee?.userId === member.userId ? <Check className="h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-1.5 text-[11px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

function AssigneeAvatar({ name }: { name?: string }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-[9px] font-bold uppercase text-muted-foreground">
      {name ? initials(name) : <UserRound className="h-3 w-3" aria-hidden="true" />}
    </span>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "?";
}

function safeAssignmentError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/conflict|changed|version|stale/i.test(message)) return "This task changed. Refresh and try again.";
  if (/forbidden|permission|not allowed/i.test(message)) return "You cannot reassign this task.";
  return message && !/^TEAM_[A-Z_]+$/.test(message) ? message : "Assignment could not be saved. Refresh and try again.";
}
