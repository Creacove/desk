import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("thinking-orbs", () => ({
  ThinkingOrb: ({ theme }: { theme: "light" | "dark" }) => <canvas data-testid="thinking-orb" data-theme={theme} />,
}));

import { ThemeProvider } from "../app/theme";
import { AppThinkingOrb } from "./AppThinkingOrb";

describe("AppThinkingOrb", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = "";
    vi.restoreAllMocks();
  });

  it("matches the resolved app theme on a normal surface", () => {
    localStorage.setItem("ordersounds-theme-mode", "light");

    render(
      <ThemeProvider>
        <AppThinkingOrb state="working" size={20} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "light");
  });

  it("uses the dark-surface palette on an inverse button in light mode", () => {
    localStorage.setItem("ordersounds-theme-mode", "light");

    render(
      <ThemeProvider>
        <AppThinkingOrb surface="inverse" state="composing" size={20} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "dark");
  });

  it("uses the light-surface palette on an inverse button in dark mode", () => {
    localStorage.setItem("ordersounds-theme-mode", "dark");

    render(
      <ThemeProvider>
        <AppThinkingOrb surface="inverse" state="composing" size={20} />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "light");
  });
});
