import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/features/music/MusicScreens.tsx"), "utf8");

describe("Song Room manager hierarchy", () => {
  it("makes Chat with Manager the primary desktop CTA", () => {
    expect(source).toContain('aria-label="Chat with Manager"');
    expect(source).toContain('Chat with Manager\n            </button>');
    expect(source).toContain('bg-brand-accent px-4.5 text-[12px] font-bold text-white');
  });

  it("uses a desktop-native record hero", () => {
    expect(source).toContain('grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(source).toContain('text-[40px] font-semibold leading-[0.95]');
    expect(source).toContain('xl:text-[48px]');
  });

  it("collapses the empty Manager review into a quiet row", () => {
    expect(source).toContain('Manager review');
    expect(source).toContain('Review record');
    expect(source).not.toContain('See what needs attention.');
    expect(source).not.toContain('A quick assessment of the song, files, rights and release setup.');
  });
});