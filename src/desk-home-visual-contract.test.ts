import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/features/desk/deskHome.css"), "utf8");
const today = readFileSync(join(process.cwd(), "src/features/desk/TodayRuntimeExecution.tsx"), "utf8");

describe("Desk Home visual contract", () => {
  it("uses the shared theme tokens and a focused Today surface", () => {
    expect(css).toContain(".home-today-band");
    expect(css).toContain(".home-today-surface");
    expect(css).toContain(".home-today-more");
    expect(css).toContain("hsl(var(--surface-panel))");
    expect(css).toContain("hsl(var(--brand-accent) /");
    expect(css).not.toMatch(/\.home-today-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
    expect(css).toMatch(/\.home-today-row\s*\{[^}]*padding:/s);
  });

  it("uses a neutral shell and an integrated approval tray", () => {
    const surface = css.match(/\.home-today-surface\s*\{([^}]*)\}/s)?.[1] ?? "";

    expect(surface).not.toContain("inset");
    expect(surface).not.toContain("brand-accent");
    expect(css).toContain(".home-today-review");
    expect(today).toContain('className="home-today-review"');
    expect(today).not.toContain("home-today-expanded mb-4 ml-10");
  });

  it("defines mobile, narrow mobile, dark theme, and reduced-motion behavior", () => {
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (max-width: 359px)");
    expect(css).toContain(".app-theme-dark .home-today-band");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps Home typography on the existing product fonts", () => {
    expect(css).toContain("var(--font-display)");
    expect(css).toContain("var(--font-ui)");
    expect(css).not.toContain("@font-face");
  });
});
