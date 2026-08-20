import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const desk = readFileSync("src/features/desk/DeskHQ.tsx", "utf8");
const manager = readFileSync("src/features/manager/ManagerScreens.tsx", "utf8");
const missions = readFileSync("src/features/missions/MissionScreens.tsx", "utf8");
const staff = readFileSync("src/features/staff/StaffScreens.tsx", "utf8");
const desktopCss = readFileSync("src/design-system/desktop-premium.css", "utf8");

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

  it("defines one shared width vocabulary for desk content and reading surfaces", () => {
    expect(desktopCss).toContain("--os-content-max: 1320px");
    expect(desktopCss).toContain("--os-reading-max: 720px");
    expect(desktopCss).toContain("--os-form-max: 900px");
    expect(desktopCss).toContain(".os-reading-measure");
    expect(desktopCss).toContain(".os-form-measure");
  });

  it("uses semantic measures across the primary desk reading and working surfaces", () => {
    expect(desk).toContain("os-form-measure");
    expect(manager).toContain("os-form-measure");
    expect(missions).toContain("os-reading-measure");
    expect(staff).toContain("os-reading-measure");
  });
});
