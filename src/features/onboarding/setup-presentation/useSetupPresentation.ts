import { useCallback, useEffect, useRef, useState } from "react";
import { reportBrowserServiceError } from "../../../lib/errorTelemetry";
import type { SetupPresentationLoader } from "../../../services/setupPresentation";
import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";
import { setupPresentationPollDelay } from "./setupPresentationPolling";
const RETRY_MS = [2_500, 5_000, 10_000] as const;
const MAX_CONSECUTIVE_FAILURES = 4;

export type SetupPresentationClientState = {
  snapshot: SetupPresentationSnapshot | null;
  state: "loading" | "ready" | "degraded";
  refresh: () => void;
};

export function useSetupPresentation({
  artistWorkspaceId,
  enabled,
  loadSnapshot,
  fixture,
}: {
  artistWorkspaceId: string;
  enabled: boolean;
  loadSnapshot: SetupPresentationLoader;
  fixture?: SetupPresentationSnapshot | null;
}): SetupPresentationClientState {
  const [snapshot, setSnapshot] = useState<SetupPresentationSnapshot | null>(fixture ?? null);
  const [state, setState] = useState<SetupPresentationClientState["state"]>(fixture ? "ready" : "loading");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const timerRef = useRef<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const failuresRef = useRef(0);
  const degradedRef = useRef(false);
  const workspaceRef = useRef(artistWorkspaceId);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const stopRequest = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const refresh = useCallback(() => {
    if (!enabled || fixture || degradedRef.current) return;
    clearTimer();
    stopRequest();
    setRefreshNonce((value) => value + 1);
  }, [clearTimer, enabled, fixture, stopRequest]);

  useEffect(() => {
    if (workspaceRef.current !== artistWorkspaceId) {
      workspaceRef.current = artistWorkspaceId;
      failuresRef.current = 0;
      degradedRef.current = false;
      setSnapshot(fixture ?? null);
      setState(fixture ? "ready" : "loading");
    }

    if (!enabled) return;
    if (fixture) {
      setSnapshot(fixture);
      setState("ready");
      return;
    }
    if (degradedRef.current) return;

    let disposed = false;

    const schedule = (delayMs: number) => {
      clearTimer();
      if (disposed || degradedRef.current) return;
      timerRef.current = window.setTimeout(() => void run(), delayMs);
    };

    const run = async () => {
      if (disposed || degradedRef.current || document.visibilityState === "hidden" || navigator.onLine === false) return;
      stopRequest();
      const controller = new AbortController();
      requestRef.current = controller;

      try {
        const next = await loadSnapshot(artistWorkspaceId, { signal: controller.signal });
        if (disposed || controller.signal.aborted) return;
        failuresRef.current = 0;
        setSnapshot(next);
        setState("ready");
        if (next.setup.status !== "completed" && next.setup.status !== "failed") schedule(setupPresentationPollDelay(next));
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        failuresRef.current += 1;
        reportBrowserServiceError(error, {
          operation: "setup_presentation_refresh",
          artist_workspace_id: artistWorkspaceId,
          presentation_version: 2,
          consecutive_failures: failuresRef.current,
        });
        if (failuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          degradedRef.current = true;
          setState("degraded");
          clearTimer();
          return;
        }
        const retryIndex = Math.min(failuresRef.current - 1, RETRY_MS.length - 1);
        schedule(RETRY_MS[retryIndex]);
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    };

    const resume = () => {
      if (disposed || degradedRef.current) return;
      if (document.visibilityState !== "hidden" && navigator.onLine !== false) {
        clearTimer();
        void run();
      }
    };

    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    void run();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      clearTimer();
      stopRequest();
    };
  }, [artistWorkspaceId, clearTimer, enabled, fixture, loadSnapshot, refreshNonce, stopRequest]);

  return { snapshot, state, refresh };
}
