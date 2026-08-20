import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/music/MusicScreens.tsx"), "utf8");

describe("Song Room manager hierarchy", () => {
  it("keeps the Manager CTA primary in the current Song Room contract", () => {
    expect(source).toContain("Continue with Manager");
    expect(source).toContain("hover:text-brand-accent");
  });

  it("uses a desktop-native record hero", () => {
    expect(source).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(source).toContain('text-[40px] font-semibold leading-[0.95]');
    expect(source).toContain('xl:text-[48px]');
  });

  it("uses the shared action primitive for Manager entry points", () => {
    expect(source).toContain('import { Button } from "../../design-system/desktopPrimitives";');
    expect(source).toMatch(/<Button[\s\S]*?aria-label="Chat with Manager"/);
    expect(source).toContain('size="md"');
    expect(source).toContain('size="lg"');
    expect(source).not.toContain('px-4.5');
  });

  it("collapses the empty Manager review into a quiet row", () => {
    expect(source).toContain('Manager review');
    expect(source).toContain('Review record');
    expect(source).not.toContain('See what needs attention.');
    expect(source).not.toContain('A quick assessment of the song, files, rights and release setup.');
  });

  it("gives an ungenerated project review an intentional next step", () => {
    expect(source).toContain("Ask Manager for a concise view of the release package before choosing the next move.");
  });
});
