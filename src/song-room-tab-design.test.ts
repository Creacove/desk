import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

describe("song room tab visual system", () => {
  it("lets every Song Room tab use the full desktop workspace width", () => {
    for (const testId of ["song-room-mobile-overview", "song-room-files", "song-room-details", "song-room-rights"]) {
      expect(music).toContain(`data-testid="${testId}" className="os-song-tab-panel w-full"`);
    }
  });

  it("uses the same section-title and supporting-copy scale across the song room", () => {
    expect(music.match(/text-\[20px\].*sm:text-\[22px\]/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(music).toContain("os-tab-intro");
    expect(music).toContain("os-section-label");
  });

  it("keeps Details and Rights mobile-native instead of forcing desktop tables onto phones", () => {
    expect(music).toContain('data-testid="song-room-mobile-details"');
    expect(music).toContain('grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]');
    expect(music).not.toContain('min-w-[620px]');
  });

  it("keeps Rights empty-state copy short", () => {
    expect(music).not.toContain('Add contributors and splits before release.');
    expect(music).toContain('>Set up splits</Button>');
  });
});
