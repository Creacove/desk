import { UserRound } from "lucide-react";
import { useState } from "react";

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
  onReassign,
}: TaskAssignmentContext & {
  assigneeUserId?: string | null;
  assignmentVersion?: number;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewer = roster.members.find((member) => member.userId === viewerUserId);
  const isOwner = viewer?.accessRole === "owner";
  const assignee = assigneeUserId ? roster.members.find((member) => member.userId === assigneeUserId) : undefined;
  const currentValue = assignee?.userId ?? "";

  async function changeAssignee(value: string) {
    if (!onReassign || !isOwner || pending) return;
    setPending(true);
    setError(null);
    try {
      await onReassign(value || null, assignmentVersion);
    } catch (reassignError) {
      setError(safeAssignmentError(reassignError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5 border-t border-foreground/8 pt-4" data-testid="task-assignee-control">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/72">Assignee</p>
            <p className="mt-1 text-[13px] font-semibold text-foreground">{assignee ? assignee.displayName : "Needs an owner"}</p>
            {assignee?.operatingTitle ? <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">{assignee.operatingTitle}</p> : null}
            {assignee && assignee.userId === viewerUserId ? <p className="mt-1 text-[11px] font-semibold text-brand-accent">Assigned to you</p> : null}
          </div>
        </div>
        {isOwner && onReassign ? (
          <label className="grid min-w-[12rem] gap-1.5 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/72">
            <span className="sr-only">Assign task</span>
            <select aria-label="Assign task" value={currentValue} disabled={pending} onChange={(event) => void changeAssignee(event.target.value)} className="min-h-10 rounded-[10px] border border-foreground/10 bg-background px-3 text-left text-[12px] font-semibold normal-case tracking-normal text-foreground outline-none focus:border-brand-accent/45 focus:ring-2 focus:ring-brand-accent/8">
              <option value="">Needs an owner</option>
              {roster.members.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}{member.accessRole === "owner" ? " · Owner" : ""}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-[11px] font-medium text-destructive">{error}</p> : null}
      {pending ? <p className="mt-2 text-[11px] font-medium text-muted-foreground">Saving assignment…</p> : null}
    </div>
  );
}

function safeAssignmentError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/conflict|changed|version|stale/i.test(message)) return "This task changed. Refresh and try again.";
  if (/forbidden|permission|not allowed/i.test(message)) return "You cannot reassign this task.";
  return message && !/^TEAM_[A-Z_]+$/.test(message) ? message : "Assignment could not be saved. Refresh and try again.";
}
