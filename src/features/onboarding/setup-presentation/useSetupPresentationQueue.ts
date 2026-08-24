import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import type { SetupPresentationFinding, SetupPresentationStatus } from "../../../types/setupPresentation";
import {
  SETUP_PRESENTATION_MIN_DWELL_MS,
  createSetupPresentationQueueState,
  getCollapsedSettledCount,
  getVisibleSettledFindings,
  setupPresentationQueueReducer,
  type SetupPresentationQueueState,
} from "./setupPresentationQueue";

export const SETUP_PRESENTATION_LANDING_MS = 220;

type UseSetupPresentationQueueOptions = {
  sourceKey: string;
  findings: SetupPresentationFinding[];
  status: SetupPresentationStatus;
  enabled?: boolean;
  reducedMotion?: boolean;
};

export type SetupPresentationQueueClientState = {
  state: SetupPresentationQueueState;
  active: SetupPresentationFinding | null;
  settled: SetupPresentationFinding[];
  collapsedSettledCount: number;
  reducedMotion: boolean;
  onLandingAnimationEnd: () => void;
};

export function useSetupPresentationQueue({
  sourceKey,
  findings,
  status,
  enabled = true,
  reducedMotion: reducedMotionOverride,
}: UseSetupPresentationQueueOptions): SetupPresentationQueueClientState {
  const [state, dispatch] = useReducer(
    setupPresentationQueueReducer,
    sourceKey,
    createSetupPresentationQueueState,
  );
  const [systemReducedMotion, setSystemReducedMotion] = useState(readPrefersReducedMotion);
  const reducedMotion = reducedMotionOverride ?? systemReducedMotion;
  const completed = status === "completed";
  const failed = status === "failed";
  const terminal = completed || failed;
  const findingsSignature = JSON.stringify(findings);

  useEffect(() => {
    if (!enabled || failed) {
      dispatch({ type: "stop" });
      return;
    }
    if (completed) return;
    if (state.phase === "stopped") {
      dispatch({ type: "restart", sourceKey, findings, nowMs: Date.now() });
      return;
    }
    dispatch({ type: "ingest", sourceKey, findings, nowMs: Date.now() });
  }, [completed, enabled, failed, findingsSignature, sourceKey, state.phase]);

  useEffect(() => {
    const mediaQuery = readMotionMediaQuery();
    if (!mediaQuery) return;
    const update = () => setSystemReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!enabled || terminal) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        dispatch({ type: "pause", nowMs: Date.now() });
      } else {
        dispatch({ type: "resume", nowMs: Date.now() });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, terminal]);

  useEffect(() => {
    if (completed || state.phase !== "holding" || state.active === null || state.pending.length === 0 || state.activeSinceMs === null) return;
    const remaining = Math.max(0, SETUP_PRESENTATION_MIN_DWELL_MS - (Date.now() - state.activeSinceMs));
    const timer = window.setTimeout(() => {
      dispatch({ type: "dwell_elapsed", nowMs: Date.now(), generation: state.generation });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [completed, state.active, state.activeSinceMs, state.generation, state.pending.length, state.phase]);

  useEffect(() => {
    if (completed || state.phase !== "landing" || state.active === null) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "landing_complete", nowMs: Date.now(), generation: state.generation });
    }, reducedMotion ? 0 : SETUP_PRESENTATION_LANDING_MS);
    return () => window.clearTimeout(timer);
  }, [completed, reducedMotion, state.active, state.generation, state.phase]);

  const onLandingAnimationEnd = useCallback(() => {
    if (completed || state.phase !== "landing") return;
    dispatch({ type: "landing_complete", nowMs: Date.now(), generation: state.generation });
  }, [completed, state.generation, state.phase]);

  return useMemo(() => ({
    state,
    active: state.active,
    settled: getVisibleSettledFindings(state),
    collapsedSettledCount: getCollapsedSettledCount(state),
    reducedMotion,
    onLandingAnimationEnd,
  }), [onLandingAnimationEnd, reducedMotion, state]);
}

function readMotionMediaQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

function readPrefersReducedMotion() {
  return readMotionMediaQuery()?.matches ?? false;
}
