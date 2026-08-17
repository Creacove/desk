import { ThinkingOrb, type ThinkingOrbProps } from "thinking-orbs";
import { useTheme } from "../app/theme";

type AppThinkingOrbProps = Omit<ThinkingOrbProps, "theme"> & {
  surface?: "normal" | "inverse";
};

export function AppThinkingOrb({ surface = "normal", size = 20, ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  // thinking-orbs currently ships rendering presets only for 20px and 64px.
  // Passing any other numeric size makes the package dereference an undefined
  // preset at runtime (for example `preset.count`) and crashes the React tree.
  // Keep this boundary defensive even when a caller requests a custom size.
  const safeSize = size === 64 ? 64 : 20;

  return <ThinkingOrb {...props} size={safeSize} theme={theme} />;
}
