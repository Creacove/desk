import { ThinkingOrb, type ThinkingOrbProps } from "thinking-orbs";
import { useTheme } from "../app/theme";

type AppThinkingOrbProps = Omit<ThinkingOrbProps, "theme"> & {
  surface?: "normal" | "inverse";
};

/**
 * thinking-orbs ships exactly two tuned size presets: 20 and 64.
 * Vite/SWC does not type-check JSX at build time, so an invalid numeric size can
 * still reach production and make the package index an undefined preset.
 * Keep the validation at our adapter boundary so no caller can crash the app.
 */
export function normalizeThinkingOrbSize(size: unknown): 20 | 64 {
  if (size === undefined || size === null) return 64;
  if (size === 64) return 64;
  return 20;
}

export function AppThinkingOrb({ surface = "normal", size, ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  return <ThinkingOrb {...props} size={normalizeThinkingOrbSize(size)} theme={theme} />;
}
