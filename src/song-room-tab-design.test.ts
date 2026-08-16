import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

describe("song room tab visual system", () => {
  it("uses one bounded editorial shell for Files, Details, and Rights", () => {
    expect(music).toContain('data-testid="song-room-files" className="mx-auto w-full max-w-4xl"');
    expect(music).toContain('data-testid="song-room-details" className="mx-auto w-full max-w-4xl"');
    expect(music).toContain('data-testid="song-room-rights" className="mx-auto w-full max-w-4xl"');
  });

  it("uses the same section-title and supporting-copy scale across the song room", () => {
    expect(music.match(/text-\[20px\].*sm:text-\[22px\]/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(music).toContain('text-[12px] font-medium leading-5 text-muted-foreground/78');
  });

  it("keeps Details and Rights mobile-native instead of forcing desktop tables onto phones", () => {
    expect(music).toContain('data-testid="song-room-mobile-details"');
    expect(music).toContain('grid-cols-2 sm:grid-cols-[1.3fr_1fr_1.25fr_0.85fr_0.85fr_1.15fr]');
    expect(music).not.toContain('min-w-[620px]');
  });

  it("keeps Rights empty-state copy short", () => {
    expect(music).toContain('Add contributors and splits before release.');
  });
});
