import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

describe("Song Room desktop workspace width", () => {
  it("does not center Song Room tabs inside a narrow reading column", () => {
    for (const testId of ["song-room-mobile-overview", "song-room-files", "song-room-details", "song-room-rights"]) {
      expect(music).toContain(`data-testid="${testId}" className="w-full"`);
    }
  });

  it("keeps the record-review copy focused on the record rather than the Manager feature", () => {
    expect(music).toContain("What matters now");
    expect(music).toContain("Manager review");
    expect(music).toContain("Review record");
    expect(music).not.toContain("Get Manager’s take on this record.");
  });
});
