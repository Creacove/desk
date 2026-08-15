import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SongCampaignWorkspace } from "./features/music/SongCampaignWorkspace";
import { ReleaseWorkAttachment } from "./features/music/SongRoomAttachments";
import type { SongCampaignState } from "./features/music/songCampaign";
import type { MissionViewModel, MusicObjectViewModel } from "./types/cleanProduction";

const song: MusicObjectViewModel = {
  id: "song-1",
  kind: "song",
  title: "Down Below",
  lifecycle: "Released",
  lifecycleStage: "released",
  blocker: "None",
  sourceLimit: "Spotify catalog metadata only",
  managerReadStatus: "fresh",
  linkedMissionIds: [],
  linkedTaskCount: 0,
};

const mission: MissionViewModel = {
  id: "mission-1",
  title: "Service Down Below",
  status: "active",
  progress: 35,
  review: "Playlist research is ready.",
  summary: "Push the released record further.",
  recommendation: "Prepare the next outreach wave.",
  musicSubject: "Down Below",
  subjectType: "music_item",
  subjectId: "song-1",
  nextTask: "Prepare the next outreach wave",
};

const activeCampaign: SongCampaignState = {
  visible: true,
  phase: "post_release",
  managerStarted: true,
  documents: [],
  mission,
  nextMove: "build_release_kit",
};

afterEach(cleanup);

describe("song Campaign UX", () => {
  it("shows a released song as an active Campaign without changing the Manager accessibility action", () => {
    const onManager = vi.fn();
    const onCampaign = vi.fn();
    render(
      <ReleaseWorkAttachment
        missions={[mission]}
        campaign={activeCampaign}
        onTalkToManager={onManager}
        onOpenCampaign={onCampaign}
      />,
    );

    expect(screen.getByText("Campaign")).toBeInTheDocument();
    expect(screen.getByText("Continue with Manager")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Talk to Manager" }));
    fireEvent.click(screen.getByRole("button", { name: "Open campaign" }));
    expect(onManager).toHaveBeenCalledTimes(1);
    expect(onCampaign).toHaveBeenCalledTimes(1);
  });

  it("leads Campaign with one narrative spine and keeps deeper work in Manager, Files, or Mission", () => {
    const onManager = vi.fn();
    const onBuildKit = vi.fn();
    const onFiles = vi.fn();
    const onMission = vi.fn();
    render(
      <SongCampaignWorkspace
        song={song}
        campaign={activeCampaign}
        onContinueManager={onManager}
        onBuildReleaseKit={onBuildKit}
        onOpenFiles={onFiles}
        onOpenMission={onMission}
      />,
    );

    expect(screen.getByRole("region", { name: "Campaign for Down Below" })).toBeInTheDocument();
    expect(screen.getByText("Keep this record moving.")).toBeInTheDocument();
    expect(screen.getByText("Campaign spine")).toBeInTheDocument();
    expect(screen.getByText("Start with the release narrative")).toBeInTheDocument();
    expect(screen.getByText("Release kit")).toBeInTheDocument();
    expect(screen.getByText("Active work")).toBeInTheDocument();
    expect(screen.getByText("Opportunities")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Build campaign with Manager/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Open Files/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open mission/i }));
    expect(onBuildKit).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onMission).toHaveBeenCalledWith("mission-1");
  });
});
