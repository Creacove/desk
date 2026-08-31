import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/features/desk/deskHome.css"), "utf8");

describe("Desk Home visual contract", () => {
  it("uses the shared theme tokens and the compact two-up Today pattern", () => {
    expect(css).toContain(".home-today-band");
    expect(css).toContain("hsl(var(--surface-panel))");
    expect(css).toContain("hsl(var(--brand-accent) /");
    expect(css).toMatch(/\.home-today-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
    expect(css).toMatch(/\.home-today-row\s*\{[^}]*padding:/s);
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
