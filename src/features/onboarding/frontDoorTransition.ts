import { flushSync } from "react-dom";
import { reportBrowserServiceError } from "../../lib/errorTelemetry";

type TransitionPromise = {
  catch: (onRejected: (error: unknown) => void) => unknown;
};

type ViewTransition = {
  ready?: TransitionPromise;
  updateCallbackDone?: TransitionPromise;
  finished?: TransitionPromise;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition | undefined;
};

export function runFrontDoorTransition(change: () => void): "immediate" | "view-transition" {
  let changed = false;
  const changeOnce = () => {
    if (changed) return;
    changed = true;
    change();
  };

  const reducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = typeof document !== "undefined"
    ? (document as ViewTransitionDocument).startViewTransition
    : undefined;

  if (reducedMotion || typeof startViewTransition !== "function") {
    changeOnce();
    return "immediate";
  }

  try {
    const transition = startViewTransition.call(document, () => flushSync(changeOnce));
    observeTransition(transition);
    return "view-transition";
  } catch {
    changeOnce();
    return "immediate";
  }
}

function observeTransition(transition: ViewTransition | undefined) {
  if (!transition) return;
  const handleFailure = (error: unknown) => {
    if (isSkippedTransition(error)) return;
    reportBrowserServiceError(error, { stage: "front_door_transition" });
  };
  void transition.ready?.catch(handleFailure);
  void transition.updateCallbackDone?.catch(handleFailure);
  void transition.finished?.catch(handleFailure);
}

function isSkippedTransition(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (error instanceof DOMException && error.name === "AbortError") || /transition was skipped/i.test(message);
}
