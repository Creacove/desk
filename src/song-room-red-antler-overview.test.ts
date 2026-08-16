import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");
const app = readFileSync("src/app/ProductionApp.tsx", "utf8");

describe("song room minimal hierarchy", () => {
  it("keeps only four job-based tabs and removes the campaign surface", () => {
    expect(music).toContain('const songTabs: SongRoomTab[] = ["overview", "files", "details", "rights"]');
    expect(music).not.toContain('<SongCampaignWorkspace');
    expect(music).not.toContain('ReleaseWorkAttachment');
  });

  it("keeps Manager conversational in the header while Overview leads with record value", () => {
    expect(music).toContain('Chat with Manager');
    expect(music).toContain('data-testid="song-room-overview-read"');
    expect(music).toContain('What matters now');
    expect(music).toContain('Review this record');
    expect(music).toContain('See what needs attention.');
    const songOverview = music.slice(music.indexOf('data-testid="song-room-overview-read"'), music.indexOf('function MusicManagerReadContent'));
    expect(songOverview).not.toContain('manager-read-metrics');
  });

  it("hides the global mobile tab bar while a music room is open", () => {
    expect(app).toContain('!(view === "musicWorkspace" && musicDetailOpen)');
  });
});
