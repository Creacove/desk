import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./theme";

function ThemeProbe() {
  const { mode, resolvedMode, setMode } = useTheme();

  return (
    <div>
      <p data-testid="theme-mode">{mode}</p>
      <p data-testid="resolved-theme-mode">{resolvedMode}</p>
      <button type="button" onClick={() => setMode("dark")}>Dark</button>
      <button type="button" onClick={() => setMode("light")}>Light</button>
      <button type="button" onClick={() => setMode("system")}>System</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = "";
    vi.restoreAllMocks();
  });

  it("defaults to system mode and applies the current system appearance", () => {
    mockSystemDarkMode(true);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme-mode").textContent).toBe("system");
    expect(screen.getByTestId("resolved-theme-mode").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("app-theme-dark")).toBe(true);
  });

  it("persists an explicit dark override and updates the document theme classes", () => {
    mockSystemDarkMode(false);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => screen.getByRole("button", { name: "Dark" }).click());

    expect(localStorage.getItem("ordersounds-theme-mode")).toBe("dark");
    expect(screen.getByTestId("theme-mode").textContent).toBe("dark");
    expect(screen.getByTestId("resolved-theme-mode").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("app-theme-dark")).toBe(true);
    expect(document.documentElement.classList.contains("app-theme-light")).toBe(false);
  });

  it("returns to system mode and follows later system preference changes", () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    mockSystemDarkMode(false, listeners);

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => screen.getByRole("button", { name: "Dark" }).click());
    act(() => screen.getByRole("button", { name: "System" }).click());

    expect(localStorage.getItem("ordersounds-theme-mode")).toBeNull();
    expect(screen.getByTestId("theme-mode").textContent).toBe("system");
    expect(screen.getByTestId("resolved-theme-mode").textContent).toBe("light");
    expect(document.documentElement.classList.contains("app-theme-light")).toBe(true);

    act(() => {
      listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });

    expect(screen.getByTestId("resolved-theme-mode").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("app-theme-dark")).toBe(true);
  });
});

function mockSystemDarkMode(matches: boolean, listeners: Array<(event: MediaQueryListEvent) => void> = []) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: (_event: "change", listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
      removeEventListener: (_event: "change", listener: (event: MediaQueryListEvent) => void) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
