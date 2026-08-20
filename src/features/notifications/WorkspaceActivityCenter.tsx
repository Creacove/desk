import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Check, Circle, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button, IconButton, SkeletonBlock, Timestamp } from "../../design-system/desktopPrimitives";
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

type ActivityDay = { key: string; label: string; events: WorkspaceOperatingEvent[] };

export function groupActivityByDay(events: WorkspaceOperatingEvent[], now = new Date()): ActivityDay[] {
  const groups = new Map<string, ActivityDay>();
  for (const event of events) {
    const date = new Date(event.createdAt);
    const validDate = !Number.isNaN(date.getTime());
    const key = validDate ? localDayKey(date) : "recent";
    const existing = groups.get(key);
    if (existing) existing.events.push(event);
    else groups.set(key, { key, label: validDate ? dayLabel(date, now) : "Recent", events: [event] });
  }
  return [...groups.values()];
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
  const groups = useMemo(() => groupActivityByDay(visibleEvents), [visibleEvents]);
  const initialLoading = Boolean(loadingOlder && events.length === 0 && !error);

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
          aria-busy={initialLoading || undefined}
          onOpenAutoFocus={() => {
            returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          className="fixed inset-x-3 bottom-3 z-[75] max-h-[84svh] overflow-hidden rounded-[22px] border border-foreground/10 bg-background text-foreground shadow-[0_32px_90px_rgba(17,19,24,0.20)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-3 motion-reduce:animate-none sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[min(92vw,34rem)] sm:max-h-none sm:rounded-[18px]"
        >
          <header className="flex items-center justify-between gap-5 border-b border-foreground/9 px-5 py-4 sm:px-6">
            <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.02em]">Activity</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton label="Close Activity Center" size="md" variant="ghost">
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
          </header>

          <div className="max-h-[calc(84svh-4.5rem)] overflow-y-auto px-5 py-4 sm:max-h-[calc(100svh-7rem)] sm:px-6">
            {error ? (
              <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[12px] font-semibold text-destructive">
                <span>{error}</span>
              </div>
            ) : null}

            {initialLoading ? (
              <ActivitySkeleton />
            ) : groups.length ? (
              <div className="grid gap-7">
                {groups.map((group) => (
                  <section key={group.key} aria-label={group.label}>
                    <h3 className="mb-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{group.label}</h3>
                    <div className="divide-y divide-foreground/[0.08]">
                      {group.events.map((event) => <ActivityRow key={event.id} event={event} onSelect={onSelect} />)}
                    </div>
                  </section>
                ))}
              </div>
            ) : !error ? (
              <div className="flex min-h-[18rem] items-center justify-center px-6 text-center">
                <div className="max-w-[18rem]">
                  <p className="font-display text-[18px] font-semibold tracking-[-0.015em] text-foreground">Nothing here yet</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-muted-foreground">Important work from Manager, Missions, and your workspace will appear here.</p>
                </div>
              </div>
            ) : null}

            {!initialLoading && (hasHiddenEvents || hasMore) ? (
              <Button
                variant="secondary"
                size="md"
                pending={Boolean(loadingOlder)}
                onClick={() => {
                  setVisibleLimit((current) => current + 20);
                  if (!hasHiddenEvents) onLoadOlder();
                }}
                className="mt-5 w-full"
              >
                Load earlier activity
              </Button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ActivitySkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-7">
      {[0, 1].map((group) => (
        <section key={group}>
          <SkeletonBlock className="mb-3 h-3 w-16" />
          <div className="divide-y divide-foreground/8">
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid min-h-[60px] grid-cols-[24px_minmax(0,1fr)_auto] items-start gap-3 py-3.5">
                <SkeletonBlock className="mt-0.5 h-6 w-6 rounded-full" />
                <div className="min-w-0 pt-0.5">
                  <SkeletonBlock className="h-3.5 w-[min(82%,19rem)]" />
                  <SkeletonBlock className="mt-2 h-3 w-[min(52%,11rem)] sm:hidden" />
                </div>
                <SkeletonBlock className="hidden h-3 w-14 sm:block" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ActivityRow({ event, onSelect }: { event: WorkspaceOperatingEvent; onSelect: (event: WorkspaceOperatingEvent) => void }) {
  const actionable = event.displayMode === "action";
  const completed = event.displayMode === "toast";
  const hasTarget = Boolean(event.targetId);

  const content = (
    <>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${actionable ? "bg-brand-accent/10 text-brand-accent" : "text-muted-foreground"}`} aria-hidden="true">
        {completed ? <Check className="h-3.5 w-3.5" /> : <Circle className={`h-2.5 w-2.5 ${actionable ? "fill-current" : "fill-foreground/15 stroke-foreground/15"}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] leading-[1.45] text-foreground ${actionable ? "font-semibold" : "font-medium"}`}>{event.summary}</span>
        <Timestamp value={event.createdAt} context="activity" className="mt-1 block sm:hidden" />
      </span>
      <span className="hidden shrink-0 items-center gap-3 sm:flex">
        <Timestamp value={event.createdAt} context="activity" />
        {hasTarget ? <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" /> : null}
      </span>
      {hasTarget ? <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 sm:hidden" aria-hidden="true" /> : null}
    </>
  );

  const rowClass = `group flex w-full items-start gap-3 py-3.5 text-left outline-none transition-colors duration-150 ${actionable ? "rounded-[12px] bg-brand-accent/[0.04] px-3 -mx-3 w-[calc(100%+1.5rem)]" : ""}`;

  return hasTarget ? (
    <button data-event-id={event.id} type="button" onClick={() => onSelect(event)} className={`${rowClass} hover:bg-foreground/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/20`}>
      {content}
    </button>
  ) : <div data-event-id={event.id} className={rowClass}>{content}</div>;
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayLabel(date: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
