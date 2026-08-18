import { useEffect, useState } from "react";
import posthog, { isPostHogConfigured } from "../../../lib/posthog";

export const SETUP_PRESENTATION_FLAG = "desk-setup-presentation-v2";

export function useSetupPresentationFlag(): boolean {
  const localOverride = readLocalOverride();
  const testDefault = import.meta.env.MODE === "test" ? false : true;
  const [enabled, setEnabled] = useState(localOverride ?? testDefault);

  useEffect(() => {
    if (localOverride !== null) {
      setEnabled(localOverride);
      return;
    }
    if (import.meta.env.MODE === "test") {
      setEnabled(false);
      return;
    }
    if (!isPostHogConfigured) {
      setEnabled(true);
      return;
    }

    const readFlag = () => {
      // V2 is the release default. Only an explicit false remotely kills it.
      setEnabled(posthog.getFeatureFlag(SETUP_PRESENTATION_FLAG) !== false);
    };
    readFlag();
    const unsubscribe = posthog.onFeatureFlags(readFlag);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [localOverride]);

  return enabled;
}

function readLocalOverride(): boolean | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("setupPresentation");
  if (value === "v2") return true;
  if (value === "legacy") return false;
  return null;
}
