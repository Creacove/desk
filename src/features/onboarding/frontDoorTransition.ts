type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
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
    startViewTransition.call(document, changeOnce);
    return "view-transition";
  } catch {
    changeOnce();
    return "immediate";
  }
}
