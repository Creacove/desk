import { useEffect, useMemo, useRef, useState } from "react";

import { createActiveRunFallback } from "../services/activeRunFallback";
import {
  createWorkspaceLiveSync,
  mergeWorkspaceInvalidations,
  type WorkspaceInvalidation,
} from "../services/workspaceLiveSync";
import type { ResourceKey } from "../services/resourceRequestCoordinator";

export type WorkspaceLiveStatus =
  | "Up to date"
  | "Catching up"
  | "Offline — updates resume when you're back"
  | "Updates delayed — Retry";

export type ActiveWorkspaceRun = {
  id: string;
  check: () => Promise<"active" | "terminal">;
  onTerminal?: () => void;
};

const NO_ACTIVE_RUNS: ActiveWorkspaceRun[] = [];

type Coordinator = {
  invalidate(workspaceId: string, key: ResourceKey): void;
  clearWorkspace(workspaceId: string): void;
};

export function useWorkspaceLiveSync({
  enabled,
  client,
  userId,
  workspaceId,
  coordinator,
  onInvalidations,
  activeRuns = NO_ACTIVE_RUNS,
}: {
  enabled: boolean;
  client: any | null;
  userId: string;
  workspaceId: string;
  coordinator: Coordinator;
  onInvalidations: (invalidations: WorkspaceInvalidation[]) => void | Promise<void>;
  activeRuns?: ActiveWorkspaceRun[];
}) {
  const [status, setStatus] = useState<WorkspaceLiveStatus>(() => navigator.onLine
    ? "Catching up"
    : "Offline — updates resume when you're back");
  const catchUpInFlight = useRef<Promise<void> | null>(null);
  const invalidationHandler = useRef(onInvalidations);
  invalidationHandler.current = onInvalidations;
  const stableRuns = useMemo(() => activeRuns, [activeRuns]);

  useEffect(() => {
    if (!enabled || !client || !workspaceId || !userId) return;
    let disposed = false;
    let hiddenStopTimer: number | undefined;
    let deferredInvalidations: WorkspaceInvalidation[] = [];

    const sync = createWorkspaceLiveSync({
      client,
      userId,
      workspaceId,
      onInvalidations: (invalidations) => {
        if (!canConnect()) {
          deferredInvalidations = mergeWorkspaceInvalidations(deferredInvalidations, invalidations);
          return;
        }
        void invalidationHandler.current(invalidations);
      },
      onReconcile: () => invalidationHandler.current([
        { scope: "workspace" },
        { scope: "activity" },
        { scope: "desk-brief" },
        { scope: "music-list" },
        { scope: "mission-list" },
        { scope: "conversation-list" },
      ]),
      onStatus: (nextStatus) => {
        if (nextStatus === "SUBSCRIBED") void catchUp();
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(nextStatus)) setStatus("Updates delayed — Retry");
      },
    });

    function canConnect() {
      return navigator.onLine && document.visibilityState === "visible";
    }

    function catchUp() {
      if (disposed || !canConnect()) return Promise.resolve();
      if (catchUpInFlight.current) return catchUpInFlight.current;
      setStatus("Catching up");
      const request = sync.catchUp()
        .then(() => {
          if (!disposed) setStatus("Up to date");
        })
        .catch(() => {
          if (!disposed) setStatus("Updates delayed — Retry");
        })
        .finally(() => {
          if (catchUpInFlight.current === request) catchUpInFlight.current = null;
        });
      catchUpInFlight.current = request;
      return request;
    }

    function connect() {
      if (!canConnect()) return;
      if (hiddenStopTimer) window.clearTimeout(hiddenStopTimer);
      hiddenStopTimer = undefined;
      sync.start();
    }

    function handleOnline() {
      connect();
      void catchUp();
    }

    function handleOffline() {
      setStatus("Offline — updates resume when you're back");
      sync.stop();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        connect();
        if (deferredInvalidations.length) {
          const next = deferredInvalidations;
          deferredInvalidations = [];
          void invalidationHandler.current(next);
        }
        void catchUp();
        return;
      }
      if (hiddenStopTimer) window.clearTimeout(hiddenStopTimer);
      hiddenStopTimer = window.setTimeout(() => sync.stop(), 120_000);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);
    if (canConnect()) connect();
    else if (!navigator.onLine) setStatus("Offline — updates resume when you're back");

    return () => {
      disposed = true;
      if (hiddenStopTimer) window.clearTimeout(hiddenStopTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
      sync.stop();
      coordinator.clearWorkspace(workspaceId);
    };
  }, [client, coordinator, enabled, userId, workspaceId]);

  useEffect(() => {
    if (!enabled || status !== "Updates delayed — Retry" || !stableRuns.length) return;
    const fallbacks = stableRuns.map((run) => createActiveRunFallback({
      delaysMs: [5_000, 10_000, 20_000, 30_000],
      deadlineMs: 6 * 60_000,
      isVisible: () => document.visibilityState === "visible",
      isOnline: () => navigator.onLine,
      check: run.check,
      onTerminal: () => run.onTerminal?.(),
    }));
    fallbacks.forEach((fallback) => fallback.start());
    return () => fallbacks.forEach((fallback) => fallback.stop());
  }, [enabled, stableRuns, status]);

  return { status };
}
