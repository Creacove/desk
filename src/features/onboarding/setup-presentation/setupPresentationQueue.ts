import type { SetupPresentationFinding } from "../../../types/setupPresentation";
import {
  compareSetupPresentationFindingRevision,
  sortSetupPresentationFindings,
} from "../../../services/setupPresentationFindings";

export const SETUP_PRESENTATION_MIN_DWELL_MS = 600;
export const MAX_SETTLED_FINDINGS = 7;
export const MAX_KNOWN_FINDINGS = 128;

export type SetupPresentationQueuePhase = "idle" | "holding" | "landing" | "paused" | "stopped";

type KnownFinding = {
  revision: string;
  dedupeKey: string;
};

export type SetupPresentationQueueState = {
  sourceKey: string;
  phase: SetupPresentationQueuePhase;
  active: SetupPresentationFinding | null;
  pending: SetupPresentationFinding[];
  settled: SetupPresentationFinding[];
  settledCount: number;
  known: Record<string, KnownFinding>;
  activeSinceMs: number | null;
  generation: number;
  pausedFrom: Exclude<SetupPresentationQueuePhase, "paused" | "stopped"> | null;
};

export type SetupPresentationQueueAction =
  | {
      type: "ingest";
      sourceKey: string;
      findings: SetupPresentationFinding[];
      nowMs: number;
    }
  | {
      type: "dwell_elapsed";
      nowMs: number;
      generation: number;
    }
  | {
      type: "landing_complete";
      nowMs: number;
      generation: number;
    }
  | {
      type: "pause";
      nowMs: number;
    }
  | {
      type: "resume";
      nowMs: number;
    }
  | {
      type: "stop";
    };

export function createSetupPresentationQueueState(sourceKey = ""): SetupPresentationQueueState {
  return {
    sourceKey,
    phase: "idle",
    active: null,
    pending: [],
    settled: [],
    settledCount: 0,
    known: {},
    activeSinceMs: null,
    generation: 0,
    pausedFrom: null,
  };
}

export function setupPresentationQueueReducer(
  state: SetupPresentationQueueState,
  action: SetupPresentationQueueAction,
): SetupPresentationQueueState {
  if (state.phase === "stopped") return state;

  switch (action.type) {
    case "ingest":
      return ingestFindings(state, action);
    case "dwell_elapsed":
      if (
        state.phase !== "holding"
        || state.active === null
        || state.pending.length === 0
        || state.activeSinceMs === null
        || action.generation !== state.generation
        || action.nowMs - state.activeSinceMs < SETUP_PRESENTATION_MIN_DWELL_MS
      ) {
        return state;
      }
      return { ...state, phase: "landing", activeSinceMs: null, pausedFrom: null };
    case "landing_complete":
      return completeLanding(state, action);
    case "pause":
      if (state.phase === "paused") return state;
      return {
        ...state,
        phase: "paused",
        pausedFrom: state.phase,
        activeSinceMs: null,
      };
    case "resume":
      if (state.phase !== "paused") return state;
      if (state.active === null) {
        return { ...state, phase: "idle", activeSinceMs: null, pausedFrom: null };
      }
      if (state.pausedFrom === "landing") {
        return { ...state, phase: "landing", activeSinceMs: null, pausedFrom: null };
      }
      return { ...state, phase: "holding", activeSinceMs: action.nowMs, pausedFrom: null };
    case "stop":
      return {
        ...state,
        phase: "stopped",
        active: null,
        pending: [],
        settled: [],
        settledCount: 0,
        known: {},
        activeSinceMs: null,
        generation: state.generation + 1,
        pausedFrom: null,
      };
  }
}

function ingestFindings(
  state: SetupPresentationQueueState,
  action: Extract<SetupPresentationQueueAction, { type: "ingest" }>,
): SetupPresentationQueueState {
  if (state.sourceKey && state.sourceKey !== action.sourceKey) {
    const reset = createSetupPresentationQueueState(action.sourceKey);
    reset.generation = state.generation + 1;
    return ingestIntoState(reset, sortSetupPresentationFindings(action.findings), action.nowMs);
  }

  const sourceKey = state.sourceKey || action.sourceKey;
  const orderedFindings = state.active === null && state.pending.length === 0 && state.settledCount === 0
    ? sortSetupPresentationFindings(action.findings)
    : action.findings;

  return ingestIntoState({ ...state, sourceKey }, orderedFindings, action.nowMs);
}

function ingestIntoState(
  state: SetupPresentationQueueState,
  findings: SetupPresentationFinding[],
  nowMs: number,
): SetupPresentationQueueState {
  let next = state;
  for (const finding of findings) {
    const visibleMatch = findVisibleMatch(next, finding);
    if (visibleMatch) {
      if (visibleMatch.id !== finding.id || visibleMatch.dedupeKey !== finding.dedupeKey) continue;
      if (compareSetupPresentationFindingRevision(finding.revision, visibleMatch.revision) <= 0) continue;
      next = replaceVisibleFinding(next, visibleMatch, finding);
      next = rememberKnown(next, finding);
      continue;
    }

    const knownById = next.known[finding.id];
    if (knownById) {
      if (knownById.dedupeKey !== finding.dedupeKey) continue;
      if (compareSetupPresentationFindingRevision(finding.revision, knownById.revision) <= 0) continue;
      next = rememberKnown(next, finding);
      continue;
    }

    const knownWithDedupe = Object.values(next.known).find((known) => known.dedupeKey === finding.dedupeKey);
    if (knownWithDedupe) continue;

    next = addNewFinding(next, finding, nowMs);
  }
  return next;
}

function addNewFinding(
  state: SetupPresentationQueueState,
  finding: SetupPresentationFinding,
  nowMs: number,
): SetupPresentationQueueState {
  const known = rememberKnown(state, finding).known;
  if (state.active === null) {
    return {
      ...state,
      known,
      active: finding,
      phase: state.phase === "paused" ? "paused" : "holding",
      activeSinceMs: state.phase === "paused" ? null : nowMs,
    };
  }

  return {
    ...state,
    known,
    pending: [...state.pending, finding],
  };
}

function completeLanding(
  state: SetupPresentationQueueState,
  action: Extract<SetupPresentationQueueAction, { type: "landing_complete" }>,
): SetupPresentationQueueState {
  if (state.phase !== "landing" || state.active === null || action.generation !== state.generation) return state;

  const settled = [...state.settled, state.active].slice(-MAX_SETTLED_FINDINGS);
  const nextActive = state.pending[0] ?? null;
  return {
    ...state,
    phase: nextActive ? "holding" : "idle",
    active: nextActive,
    pending: state.pending.slice(1),
    settled,
    settledCount: state.settledCount + 1,
    activeSinceMs: nextActive ? action.nowMs : null,
    generation: state.generation + 1,
    pausedFrom: null,
  };
}

function findVisibleMatch(
  state: SetupPresentationQueueState,
  finding: SetupPresentationFinding,
): SetupPresentationFinding | null {
  if (state.active && (state.active.id === finding.id || state.active.dedupeKey === finding.dedupeKey)) return state.active;
  const pending = state.pending.find((item) => item.id === finding.id || item.dedupeKey === finding.dedupeKey);
  if (pending) return pending;
  return state.settled.find((item) => item.id === finding.id || item.dedupeKey === finding.dedupeKey) ?? null;
}

function replaceVisibleFinding(
  state: SetupPresentationQueueState,
  previous: SetupPresentationFinding,
  replacement: SetupPresentationFinding,
): SetupPresentationQueueState {
  return {
    ...state,
    active: state.active?.id === previous.id ? replacement : state.active,
    pending: state.pending.map((item) => item.id === previous.id ? replacement : item),
    settled: state.settled.map((item) => item.id === previous.id ? replacement : item),
  };
}

function rememberKnown(
  state: SetupPresentationQueueState,
  finding: SetupPresentationFinding,
): SetupPresentationQueueState {
  const known = {
    ...state.known,
    [finding.id]: { revision: finding.revision, dedupeKey: finding.dedupeKey },
  };
  const keys = Object.keys(known);
  while (keys.length > MAX_KNOWN_FINDINGS) {
    const oldest = keys.shift();
    if (oldest) delete known[oldest];
  }
  return { ...state, known };
}

export function getVisibleSettledFindings(state: SetupPresentationQueueState): SetupPresentationFinding[] {
  return state.settled.slice(-MAX_SETTLED_FINDINGS);
}

export function getCollapsedSettledCount(state: SetupPresentationQueueState): number {
  return Math.max(0, state.settledCount - state.settled.length);
}

export function hasQueuedSuccessor(state: SetupPresentationQueueState): boolean {
  return state.pending.length > 0;
}

