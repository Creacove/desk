import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";

export type SetupPresentationTimingState = {
  level: "normal" | "reassure" | "extended";
  message?: string;
  canLeave: boolean;
  elapsedMs: number;
};

const REASSURE_AFTER_MS = 45_000;
const EXTENDED_AFTER_MS = 90_000;

export function setupPresentationTiming(
  snapshot: SetupPresentationSnapshot,
  nowMs = Date.now(),
): SetupPresentationTimingState {
  if (snapshot.setup.status === "completed" || snapshot.setup.phase === "ready") {
    return { level: "normal", canLeave: false, elapsedMs: 0 };
  }

  const phaseStartedAt = snapshot.setup.phaseStartedAt ?? (snapshot.setup.phase === "catalogue" ? snapshot.setup.startedAt : undefined);
  const startedAtMs = phaseStartedAt ? Date.parse(phaseStartedAt) : Number.NaN;
  const elapsedMs = Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;

  if (elapsedMs >= EXTENDED_AFTER_MS) {
    return {
      level: "extended",
      message: "This is taking a little longer. Your work is saved — you can leave this tab and come back.",
      canLeave: true,
      elapsedMs,
    };
  }

  if (elapsedMs >= REASSURE_AFTER_MS) {
    return {
      level: "reassure",
      message: reassuranceForPhase(snapshot.setup.phase),
      canLeave: false,
      elapsedMs,
    };
  }

  return { level: "normal", canLeave: false, elapsedMs };
}


function reassuranceForPhase(phase: SetupPresentationSnapshot["setup"]["phase"]) {
  if (phase === "catalogue") return "Desk is still bringing your catalogue together before it starts reading the signals.";
  if (phase === "synthesis") return "Your Manager is still connecting the evidence before it gives you the first read.";
  return "Desk is still checking signals before it gives you a read.";
}
