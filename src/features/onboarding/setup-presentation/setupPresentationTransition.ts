type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

export function enterDeskWithProgressiveTransition(enter: () => void): "immediate" | "view-transition" {
  let entered = false;
  const enterOnce = () => {
    if (entered) return;
    entered = true;
    enter();
  };

  const reducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const startViewTransition = typeof document !== "undefined"
    ? (document as ViewTransitionDocument).startViewTransition
    : undefined;

  if (reducedMotion || typeof startViewTransition !== "function") {
    enterOnce();
    return "immediate";
  }

  try {
    startViewTransition.call(document, enterOnce);
    return "view-transition";
  } catch {
    enterOnce();
    return "immediate";
  }
}
