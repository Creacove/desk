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
      expect(music).toContain(`data-testid="${testId}" className="os-song-tab-panel w-full"`);
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
    expect(desktopCss).toContain("--os-room-max: 1120px");
    expect(desktopCss).toContain("--os-reading-max: 720px");
    expect(desktopCss).toContain("--os-form-max: 900px");
    expect(desktopCss).toContain(".os-room-rail");
    expect(desktopCss).toContain(".os-reading-measure");
    expect(desktopCss).toContain(".os-form-measure");
  });

  it("defines one readable list and body scale across product workspaces", () => {
    expect(desktopCss).toContain("--os-list-title-size: 16px");
    expect(desktopCss).toContain("--os-list-title-size: 17px");
    expect(desktopCss).toContain("--os-list-meta-size: 13px");
    expect(desktopCss).toContain("--os-body-size: 17px");
    expect(desktopCss).toContain(".os-list-frame");
    expect(desktopCss).toContain(".os-list-row");
    expect(desktopCss).toContain(".os-list-title");
    expect(desktopCss).toContain(".os-list-meta");
    expect(desktopCss).toContain(".os-body-copy");
    expect(music).toContain("os-list-title");
    expect(missions).toContain("os-list-title");
    expect(manager).toContain("os-list-title");
    expect(staff).toContain("os-list-title");
  });

  it("uses the same room rail for the catalog and both music detail rooms", () => {
    expect(music).toContain('data-testid="music-library" className="os-room-rail');
    expect(music).toContain('data-testid="music-song-detail" className="os-room-rail');
    expect(music).toContain('data-testid="music-project-detail" className="os-room-rail');
  });

  it("lets Project Room Manager Read use the full shared room width", () => {
    expect(music).toContain('data-testid="project-manager-read-copy"');
    expect(music).toContain('<div className="mt-4 w-full">');
    expect(music).toContain('className="os-body-copy whitespace-pre-line font-medium text-foreground/90"');
    expect(music).not.toContain('<div className="mt-4 max-w-4xl">');
  });

  it("uses semantic measures across the primary desk reading and working surfaces", () => {
    expect(desk).toContain("os-room-rail");
    expect(manager).toContain("os-form-measure");
    expect(missions).toContain("os-reading-measure");
    expect(staff).toContain("os-reading-measure");
  });

  it("keeps Manager, Missions, and team surfaces on the shared room rail", () => {
    expect(manager).toContain("os-room-rail");
    expect(missions).toContain("os-room-rail");
    expect(staff).toContain("os-room-rail");
  });
});
