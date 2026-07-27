import { ThinkingOrb, type ThinkingOrbProps } from "thinking-orbs";
import { useTheme } from "../app/theme";

type AppThinkingOrbProps = Omit<ThinkingOrbProps, "theme"> & {
  surface?: "normal" | "inverse";
};

export function AppThinkingOrb({ surface = "normal", ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  return <ThinkingOrb {...props} theme={theme} />;
}
