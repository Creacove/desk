import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Check, Clock3, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkspaceEventCursor, WorkspaceOperatingEvent } from "../../services/workspaceLiveSync";

export function activityCursorKey(userId: string, workspaceId: string) {
  return `ordersounds.activityCursor.v1:${userId}:${workspaceId}`;
}

export function readActivityCursor(storage: Pick<Storage, "getItem">, userId: string, workspaceId: string): WorkspaceEventCursor | null {
  try {
    const value = JSON.parse(storage.getItem(activityCursorKey(userId, workspaceId)) ?? "null");
    return value && typeof value.createdAt === "string" && typeof value.id === "string" ? value : null;
  } catch {
    return null;
  }
}

export function countUnreadActivity(events: WorkspaceOperatingEvent[], cursor: WorkspaceEventCursor | null) {
  return events.filter((event) => !cursor || event.createdAt > cursor.createdAt || (event.createdAt === cursor.createdAt && event.id > cursor.id)).length;
}

export function WorkspaceActivityCenter({
  open,
  events,
  error,
  hasMore,
  loadingOlder,
  onOpenChange,
  onSelect,
  onLoadOlder,
  onSeen,
}: {
  open: boolean;
  events: WorkspaceOperatingEvent[];
  error?: string | null;
  hasMore: boolean;
  loadingOlder?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (event: WorkspaceOperatingEvent) => void;
  onLoadOlder: () => void;
  onSeen: (cursor: WorkspaceEventCursor) => void;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(20);
  const visibleEvents = events.slice(0, visibleLimit);
  const hasHiddenEvents = events.length > visibleLimit;
  const groups = useMemo(() => ({
    needsYou: visibleEvents.filter((event) => event.displayMode === "action"),
    completed: visibleEvents.filter((event) => event.displayMode === "toast"),
    background: visibleEvents.filter((event) => event.displayMode !== "action" && event.displayMode !== "toast"),
  }), [visibleEvents]);

  useEffect(() => {
    if (!open) return;
    setVisibleLimit(20);
    const newest = events[0];
    if (newest) onSeen({ createdAt: newest.createdAt, id: newest.id });
  }, [events, onSeen, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[74] bg-foreground/20 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:animate-none" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          className="fixed inset-x-3 bottom-3 z-[75] max-h-[84svh] overflow-hidden rounded-[22px] border border-foreground/10 bg-background text-foreground shadow-[0_32px_90px_rgba(17,19,24,0.24)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-3 motion-reduce:animate-none sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[min(92vw,32rem)] sm:max-h-none sm:rounded-[20px]"
        >
          <header className="flex items-start justify-between gap-5 border-b border-foreground/10 px-5 py-4">
            <div>
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Activity</p>
              <Dialog.Title className="mt-1 font-display text-[22px] font-semibold tracking-tight">Your workspace, as it happens</Dialog.Title>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">Decisions, completed work, and quiet background updates.</p>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close Activity Center" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-foreground/10 bg-foreground/[0.04] text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="max-h-[calc(84svh-7.5rem)] overflow-y-auto px-5 py-5 sm:max-h-[calc(100svh-10rem)]">
            {error ? <p role="alert" className="mb-4 rounded-[12px] border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[12px] font-semibold text-destructive">{error}</p> : null}
            <div className="grid gap-7">
              <ActivityGroup title="Needs you" events={groups.needsYou} empty="Nothing is waiting on you." icon="action" onSelect={onSelect} />
              <ActivityGroup title="Recently completed" events={groups.completed} empty="Completed work will appear here." icon="completed" onSelect={onSelect} />
              <ActivityGroup title="Background activity" events={groups.background} empty="No new background activity." icon="background" onSelect={onSelect} />
            </div>
            {hasHiddenEvents || hasMore ? (
              <button
                type="button"
                disabled={loadingOlder}
                onClick={() => {
                  setVisibleLimit((current) => current + 20);
                  if (!hasHiddenEvents) onLoadOlder();
                }}
                className="mt-6 w-full rounded-[11px] border border-foreground/10 px-3 py-2.5 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground disabled:opacity-50"
              >
                {loadingOlder ? "Loading earlier activity…" : "Load earlier activity"}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ActivityGroup({
  title,
  events,
  empty,
  icon,
  onSelect,
}: {
  title: string;
  events: WorkspaceOperatingEvent[];
  empty: string;
  icon: "action" | "completed" | "background";
  onSelect: (event: WorkspaceOperatingEvent) => void;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground/70">{events.length}</span>
      </div>
      <div className="grid gap-2">
        {events.length ? events.map((event) => {
          const content = <>
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-foreground/[0.06] text-muted-foreground" aria-hidden="true">
              {icon === "action" ? <ArrowUpRight className="h-3.5 w-3.5" /> : icon === "completed" ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-snug text-foreground">{event.summary}</span>
              <span className="mt-1 block text-[10px] font-semibold text-muted-foreground/75">{formatEventTime(event.createdAt)}</span>
            </span>
            {event.targetId
              ? <ArrowUpRight className="mt-1 h-3.5 w-3.5 text-muted-foreground/45 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              : <span aria-hidden="true" />}
          </>;
          const rowClass = "group grid grid-cols-[28px_minmax(0,1fr)_16px] items-start gap-3 rounded-[14px] border border-foreground/9 bg-foreground/[0.025] px-3 py-3 text-left";
          return event.targetId ? (
            <button key={event.id} data-event-id={event.id} type="button" onClick={() => onSelect(event)} className={`${rowClass} transition-[border-color,background-color,transform] hover:border-foreground/16 hover:bg-foreground/[0.05] active:translate-y-px motion-reduce:transition-none`}>
              {content}
            </button>
          ) : (
            <div key={event.id} data-event-id={event.id} className={rowClass}>{content}</div>
          );
        }) : <p className="rounded-[13px] border border-dashed border-foreground/10 px-3 py-3 text-[12px] font-medium text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
